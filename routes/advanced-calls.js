const express = require('express');
const router = express.Router();

/**
 * ANSWER WEBHOOK — Vonage calls this when call is answered
 */
router.post('/answer', (req, res) => {
  // Get the call UUID from Vonage's request parameters
  const callUuid = req.query.uuid || req.body.uuid || req.query.conversation_uuid;
  
  console.log('📞 Call answered:', callUuid);
  
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
        `${process.env.BASE_URL}/api/advanced-calls/dtmf-handler/${callUuid}`
      ]
    }
  ]);
});

/**
 * DTMF HANDLER — Processes the entered digits
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
