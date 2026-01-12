const express = require('express');
const { db } = require('../database');
const { verifyToken } = require('./auth');

const router = express.Router();

// Get all reactive scripts
router.get('/', verifyToken, (req, res) => {
  try {
    const scripts = db.prepare('SELECT * FROM reactive_scripts ORDER BY created_at DESC').all();
    res.json(scripts.map(s => ({
      ...s,
      script_flow: JSON.parse(s.script_flow)
    })));
  } catch (err) {
    console.error('Get reactive scripts error:', err);
    res.status(500).json({ error: 'Failed to fetch scripts' });
  }
});

// Save reactive script
router.post('/', verifyToken, (req, res) => {
  const { name, script_flow, language, voice } = req.body;

  try {
    const insert = db.prepare(`
      INSERT INTO reactive_scripts (name, script_flow, language, voice)
      VALUES (?, ?, ?, ?)
    `);
    const result = insert.run(name, JSON.stringify(script_flow), language || 'en-US', voice || 'aura-asteria-en');

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Save reactive script error:', err);
    res.status(500).json({ error: 'Failed to save script' });
  }
});

// Get single reactive script
router.get('/:id', verifyToken, (req, res) => {
  try {
    const script = db.prepare('SELECT * FROM reactive_scripts WHERE id = ?').get(req.params.id);
    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }
    res.json({
      ...script,
      script_flow: JSON.parse(script.script_flow)
    });
  } catch (err) {
    console.error('Get script error:', err);
    res.status(500).json({ error: 'Failed to fetch script' });
  }
});

// Delete reactive script
router.delete('/:id', verifyToken, (req, res) => {
  try {
    db.prepare('DELETE FROM reactive_scripts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete script error:', err);
    res.status(500).json({ error: 'Failed to delete script' });
  }
});

module.exports = router;
