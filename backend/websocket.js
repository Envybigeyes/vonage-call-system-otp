const WebSocket = require('ws');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected');

    ws.on('message', (message) => {
      console.log('📨 Received:', message.toString());
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
  });

  global.wss = wss;
  console.log('✅ WebSocket server ready');
}

module.exports = { setupWebSocket };
