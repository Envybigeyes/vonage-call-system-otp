const express = require('express');
const { verifyToken } = require('./auth');

const router = express.Router();

/**
 * Initiate call (UNCHANGED LOGIC EXPECTATION)
 * You already create the call elsewhere — this file ONLY fixes call stability
 */

/**
 * ANSWER WEBHOOK — STATELESS (CRITICAL)
 * NEVER use Maps, memory, or temp UUIDs here
 */
router.post('/answer/:call_uuid', (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  res.status(200).json([
    {
      action: 'talk',
      voiceName: 'Joey',
      text: 'Please enter your six digit one time passcode.'
    },
    {
      action: 'input',
      dtmf: {
        maxDigits: 6,
        timeOut: 10
      },
      eventUrl: [
        `${process.env.BASE_URL}/api/advanced-calls/dtmf-handler/${req.params.call_uuid}`
      ]
    }
  ]);
});

/**
 * DTMF HANDLER — SAFE & SIMPLE
 */
router.post('/dtmf-handler/:call_uuid', express.json(), (req, res) => {
  const digits = req.body?.dtmf?.digits;

  console.log('📟 DTMF:', req.params.call_uuid, digits);

  if (!digits) {
    return res.json([
      {
        action: 'talk',
        text: 'No digits received. Goodbye.'
      }
    ]);
  }

  // TODO: Validate OTP against DB here

  res.json([
    {
      action: 'talk',
      text: 'Thank you. Your code has been received. Goodbye.'
    }
  ]);
});

module.exports = router;
