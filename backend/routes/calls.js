const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { verifyToken } = require('./auth');

const router = express.Router();

router.get('/', verifyToken, (req, res) => {
  try {
    const calls = db.prepare(`
      SELECT c.*, s.name as script_name 
      FROM calls c 
      LEFT JOIN scripts s ON c.script_id = s.id 
      ORDER BY c.started_at DESC 
      LIMIT 100
    `).all();
    res.json(calls);
  } catch (err) {
    console.error('Get calls error:', err);
    res.status(500).json({ error: 'Failed to fetch calls' });
  }
});

router.get('/:call_uuid', verifyToken, (req, res) => {
  try {
    const call = db.prepare('SELECT * FROM calls WHERE call_uuid = ?').get(req.params.call_uuid);
    const dtmf = db.prepare('SELECT * FROM dtmf_logs WHERE call_uuid = ? ORDER BY timestamp').all(req.params.call_uuid);
    const events = db.prepare('SELECT * FROM call_events WHERE call_uuid = ? ORDER BY timestamp').all(req.params.call_uuid);

    res.json({ call, dtmf, events });
  } catch (err) {
    console.error('Get call details error:', err);
    res.status(500).json({ error: 'Failed to fetch call details' });
  }
});

router.post('/initiate', verifyToken, async (req, res) => {
  const { phone_number, language, script_id, custom_script, recording_enabled } = req.body;

  try {
    const vonage = req.app.locals.vonage;

    let scriptContent = custom_script;
    if (script_id && !custom_script) {
      const script = db.prepare('SELECT content FROM scripts WHERE id = ?').get(script_id);
      scriptContent = script?.content || 'Hello, this is a test call.';
    }

    const voiceName = language === 'es-ES' ? 'Lucia' : 'Joey';

    const ncco = [
      {
        action: 'talk',
        text: scriptContent,
        voiceName: voiceName,
        language: language
      },
      {
        action: 'input',
        eventUrl: [`${process.env.BASE_URL}/webhooks/dtmf`],
        dtmf: {
          maxDigits: 1,
          timeOut: 10
        }
      }
    ];

    if (recording_enabled) {
      ncco.push({
        action: 'record',
        eventUrl: [`${process.env.BASE_URL}/webhooks/recording`],
        endOnSilence: 3,
        format: 'mp3'
      });
    }

    // FIXED: Use correct method for v2.11.1
    vonage.calls.create({
      to: [{
        type: 'phone',
        number: phone_number
      }],
      from: {
        type: 'phone',
        number: process.env.VONAGE_PHONE_NUMBER
      },
      answer_url: [`${process.env.BASE_URL}/webhooks/answer`],
      answer_method: 'GET',
      ncco: ncco
    }, (err, result) => {
      if (err) {
        console.error('Vonage error:', err);
        return res.status(500).json({ error: err.message || 'Call failed' });
      }

      const insert = db.prepare(`
        INSERT INTO calls (call_uuid, phone_number, language, script_id, custom_script, recording_enabled, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(result.uuid, phone_number, language, script_id, custom_script, recording_enabled ? 1 : 0, 'ringing');

      const logEvent = db.prepare('INSERT INTO call_events (call_uuid, event_type, event_data) VALUES (?, ?, ?)');
      logEvent.run(result.uuid, 'initiated', JSON.stringify(result));

      res.json({ success: true, call_uuid: result.uuid, vonage_response: result });
    });
  } catch (err) {
    console.error('Call initiation error:', err);
    res.status(500).json({ error: err.message || 'Failed to initiate call' });
  }
});

router.post('/:call_uuid/record', verifyToken, async (req, res) => {
  try {
    const vonage = req.app.locals.vonage;
    
    vonage.calls.update(req.params.call_uuid, {
      action: 'start_recording'
    }, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to start recording' });
      }
      
      db.prepare('UPDATE calls SET recording_enabled = 1 WHERE call_uuid = ?').run(req.params.call_uuid);
      res.json({ success: true });
    });
  } catch (err) {
    console.error('Recording start error:', err);
    res.status(500).json({ error: 'Failed to start recording' });
  }
});

router.post('/:call_uuid/escalate', verifyToken, async (req, res) => {
  try {
    const vonage = req.app.locals.vonage;
    
    vonage.calls.update(req.params.call_uuid, {
      action: 'transfer',
      destination: {
        type: 'ncco',
        ncco: [{
          action: 'connect',
          endpoint: [{
            type: 'phone',
            number: process.env.ADMIN_PHONE
          }]
        }]
      }
    }, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to escalate' });
      }
      
      const logEvent = db.prepare('INSERT INTO call_events (call_uuid, event_type, event_data) VALUES (?, ?, ?)');
      logEvent.run(req.params.call_uuid, 'escalated', JSON.stringify({ to: process.env.ADMIN_PHONE }));
      
      res.json({ success: true });
    });
  } catch (err) {
    console.error('Escalation error:', err);
    res.status(500).json({ error: 'Failed to escalate call' });
  }
});

router.post('/:call_uuid/hangup', verifyToken, async (req, res) => {
  try {
    const vonage = req.app.locals.vonage;
    
    vonage.calls.update(req.params.call_uuid, { action: 'hangup' }, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to hang up' });
      }
      
      db.prepare('UPDATE calls SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE call_uuid = ?')
        .run('completed', req.params.call_uuid);
      
      res.json({ success: true });
    });
  } catch (err) {
    console.error('Hangup error:', err);
    res.status(500).json({ error: 'Failed to hang up call' });
  }
});

router.get('/analytics/stats', verifyToken, (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM calls').get().count;
    const completed = db.prepare('SELECT COUNT(*) as count FROM calls WHERE status = ?').get('completed').count;
    const failed = db.prepare('SELECT COUNT(*) as count FROM calls WHERE status = ?').get('failed').count;
    const avgDuration = db.prepare('SELECT AVG(duration) as avg FROM calls WHERE duration IS NOT NULL').get().avg;

    res.json({
      total_calls: total,
      completed_calls: completed,
      failed_calls: failed,
      average_duration: Math.round(avgDuration || 0),
      success_rate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
