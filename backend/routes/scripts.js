const express = require('express');
const { db } = require('../database');
const { verifyToken } = require('./auth');

const router = express.Router();

router.get('/', verifyToken, (req, res) => {
  try {
    const scripts = db.prepare('SELECT * FROM scripts ORDER BY created_at DESC').all();
    res.json(scripts);
  } catch (err) {
    console.error('Get scripts error:', err);
    res.status(500).json({ error: 'Failed to fetch scripts' });
  }
});

router.post('/', verifyToken, (req, res) => {
  const { name, content, language } = req.body;

  try {
    const insert = db.prepare('INSERT INTO scripts (name, content, language) VALUES (?, ?, ?)');
    const result = insert.run(name, content, language || 'en-US');

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Save script error:', err);
    res.status(500).json({ error: 'Failed to save script' });
  }
});

router.delete('/:id', verifyToken, (req, res) => {
  try {
    db.prepare('DELETE FROM scripts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete script error:', err);
    res.status(500).json({ error: 'Failed to delete script' });
  }
});

module.exports = router;
