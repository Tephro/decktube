// popup.js
const bgPage = browser.extension.getBackgroundPage();

function update() {
  const ws = bgPage.ws;
  const state = bgPage.lastKnownState;

  const bridgeEl = document.getElementById("bridgeStatus");
  if (ws && ws.readyState === WebSocket.OPEN) {
    bridgeEl.textContent = "Connected";
    bridgeEl.className = "";
  } else {
    bridgeEl.textContent = "Disconnected";
    bridgeEl.className = "off";
  }

  if (state) {
    document.getElementById("videoTitle").textContent = state.title || "No title";
    document.getElementById("videoInfo").textContent =
      `${state.paused ? "⏸ Paused" : "▶ Playing"} | Vol: ${state.volume}%`;
  }
}

update();
setInterval(update, 1000);
