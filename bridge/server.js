// bridge/server.js
// Local WebSocket server running on port 9001
// Acts as a message relay between the Stream Deck plugin (port 9002) and the Firefox extension (port 9001)
//
// Run with: node server.js

const { WebSocketServer, WebSocket } = require("ws");

const EXTENSION_PORT = 9001; // Firefox extension connects here
const PLUGIN_PORT = 9002;    // Stream Deck plugin connects here

let extensionSocket = null;
let pluginSocket = null;

// --- Extension-facing server ---
const extensionServer = new WebSocketServer({ port: EXTENSION_PORT });
extensionServer.on("listening", () =>
  console.log(`[Bridge] Extension server listening on ws://127.0.0.1:${EXTENSION_PORT}`)
);

extensionServer.on("connection", (ws) => {
  console.log("[Bridge] Firefox extension connected");
  extensionSocket = ws;

  ws.on("message", (data) => {
    // Forward state updates and command results to the Stream Deck plugin
    if (pluginSocket && pluginSocket.readyState === WebSocket.OPEN) {
      pluginSocket.send(data.toString());
    }
  });

  ws.on("close", () => {
    console.log("[Bridge] Firefox extension disconnected");
    extensionSocket = null;
  });
});

// --- Stream Deck Plugin-facing server ---
const pluginServer = new WebSocketServer({ port: PLUGIN_PORT });
pluginServer.on("listening", () =>
  console.log(`[Bridge] Plugin server listening on ws://127.0.0.1:${PLUGIN_PORT}`)
);

pluginServer.on("connection", (ws) => {
  console.log("[Bridge] Stream Deck plugin connected");
  pluginSocket = ws;

  ws.on("message", (data) => {
    // Forward plugin commands to the Firefox extension
    if (extensionSocket && extensionSocket.readyState === WebSocket.OPEN) {
      extensionSocket.send(data.toString());
    } else {
      ws.send(JSON.stringify({ type: "error", message: "Firefox extension not connected" }));
    }
  });

  ws.on("close", () => {
    console.log("[Bridge] Stream Deck plugin disconnected");
    pluginSocket = null;
  });
});

console.log("[Bridge] YouTube Stream Deck bridge starting...");
