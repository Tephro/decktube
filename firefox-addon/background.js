// background.js - Firefox extension background script
// Acts as the bridge between the Stream Deck plugin (via WebSocket) and YouTube tabs (via content script)

const WS_PORT = 8765;
let ws = null;
let lastKnownState = null;

// --- WebSocket Server (communicates with Stream Deck plugin) ---
function startWebSocketServer() {
  // Firefox extensions can't natively host a WebSocket server,
  // so we use a native messaging host as the WS relay.
  // For development/simple setup, we connect TO the Stream Deck plugin's WS server.
  connectToStreamDeck();
}

function connectToStreamDeck() {
  ws = new WebSocket(`ws://127.0.0.1:${WS_PORT}`);

  ws.onopen = () => {
    console.log('[Bridge] Connected to Stream Deck plugin');
    sendToStreamDeck({ type: 'EXTENSION_READY' });
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleStreamDeckMessage(message);
    } catch (e) {
      console.error('[Bridge] Failed to parse message:', e);
    }
  };

  ws.onclose = () => {
    console.log('[Bridge] Disconnected. Retrying in 3s...');
    setTimeout(connectToStreamDeck, 3000);
  };

  ws.onerror = (err) => {
    console.error('[Bridge] WebSocket error:', err);
  };
}

function sendToStreamDeck(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// --- Handle commands from Stream Deck ---
async function handleStreamDeckMessage(message) {
  if (message.type === 'COMMAND') {
    const result = await sendCommandToYouTube(message.command);
    sendToStreamDeck({ type: 'STATE_UPDATE', state: result });
  } else if (message.type === 'GET_STATE') {
    const result = await sendCommandToYouTube({ action: 'getstate' });
    sendToStreamDeck({ type: 'STATE_UPDATE', state: result });
  }
}

// --- Find active YouTube tab and send command ---
async function sendCommandToYouTube(command) {
  const tabs = await browser.tabs.query({ url: '*://www.youtube.com/watch*' });

  if (tabs.length === 0) {
    return { error: 'No active YouTube tab found' };
  }

  // Prefer the most recently active YouTube tab
  const tab = tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];

  try {
    const response = await browser.tabs.sendMessage(tab.id, {
      type: 'YOUTUBE_COMMAND',
      command,
    });
    return response.state;
  } catch (e) {
    // Content script may not be loaded yet
    await browser.tabs.executeScript(tab.id, { file: 'content.js' });
    try {
      const response = await browser.tabs.sendMessage(tab.id, {
        type: 'YOUTUBE_COMMAND',
        command,
      });
      return response.state;
    } catch (e2) {
      return { error: 'Failed to communicate with YouTube tab' };
    }
  }
}

// --- Listen for state updates pushed from content script ---
browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'YOUTUBE_STATE_UPDATE') {
    lastKnownState = message.state;
    sendToStreamDeck({ type: 'STATE_UPDATE', state: message.state });
  }
});

// Start everything
startWebSocketServer();
