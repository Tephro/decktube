// content.js - Injected into YouTube tabs
// Listens for commands from background.js and controls the YouTube player

let titlePollInterval = null;

function getVideo() {
  return document.querySelector('video');
}

function getVideoTitle() {
  const titleEl =
    document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
    document.querySelector('h1.title') ||
    document.querySelector('#title h1');
  return titleEl ? titleEl.innerText.trim() : document.title.replace(' - YouTube', '').trim();
}

function getVideoState() {
  const video = getVideo();
  if (!video) return null;
  return {
    title: getVideoTitle(),
    paused: video.paused,
    volume: Math.round(video.volume * 100),
    muted: video.muted,
    currentTime: video.currentTime,
    duration: video.duration,
  };
}

function handleCommand(command) {
  const video = getVideo();
  if (!video) return { error: 'No video found' };

  switch (command.action) {
    case 'playpause':
      if (video.paused) { video.play(); } else { video.pause(); }
      break;
    case 'skipforward':
      video.currentTime = Math.min(video.currentTime + (command.seconds || 10), video.duration);
      break;
    case 'skipback':
      video.currentTime = Math.max(video.currentTime - (command.seconds || 10), 0);
      break;
    case 'volumeup':
      video.volume = Math.min(video.volume + (command.step || 0.1), 1);
      video.muted = false;
      break;
    case 'volumedown':
      video.volume = Math.max(video.volume - (command.step || 0.1), 0);
      break;
    case 'mute':
      video.muted = !video.muted;
      break;
    case 'getstate':
      break;
    default:
      return { error: `Unknown action: ${command.action}` };
  }

  return getVideoState();
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'YOUTUBE_COMMAND') {
    const result = handleCommand(message.command);
    sendResponse({ success: true, state: result });
  }
  return true;
});

function startStatePoll() {
  if (titlePollInterval) return;
  titlePollInterval = setInterval(() => {
    const state = getVideoState();
    if (state) {
      browser.runtime.sendMessage({ type: 'YOUTUBE_STATE_UPDATE', state });
    }
  }, 2000);
}

function stopStatePoll() {
  if (titlePollInterval) {
    clearInterval(titlePollInterval);
    titlePollInterval = null;
  }
}

const video = getVideo();
if (video) {
  startStatePoll();
} else {
  const observer = new MutationObserver(() => {
    if (getVideo()) {
      observer.disconnect();
      startStatePoll();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

window.addEventListener('beforeunload', stopStatePoll);
