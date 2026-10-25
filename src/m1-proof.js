import testToneDataUri from './m1-test-tone.js';
import { isNaturalWrap } from './utils/wrap.js';

const SESSION_ID = 'm1-proof';
let objectUrl = null;
let lastTime = 0;
let suppressWrap = false;
let manualSeek = false;
let draggingSeek = false;
let wrapCount = 0;
let heightFrame = 0;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initM1Proof, { once: true });
} else {
  initM1Proof();
}

function initM1Proof() {
  const audio = document.getElementById('m1-proof');
  const button = document.getElementById('m1-proof-button');
  const status = document.getElementById('m1-proof-status');
  const seek = document.getElementById('m1-seek');
  if (!audio || !button) return;

  const setStatus = (text) => {
    if (status) status.textContent = text;
  };

  // iOS keeps the audio session open only when the element never reaches a
  // natural end. loop = true makes the 30s clip wrap instead.
  audio.loop = true;

  button.addEventListener('click', () => {
    try {
      if (!objectUrl) {
        // Decode synchronously so play() stays inside the user gesture.
        objectUrl = URL.createObjectURL(dataUriToBlob(testToneDataUri));
        audio.src = objectUrl;
        audio.load();
      }
      if (audio.readyState > 0) {
        // Guard before moving currentTime: timeupdate can beat seeking.
        manualSeek = true;
        suppressWrap = true;
        lastTime = 0;
        audio.currentTime = 0;
      }
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch((err) => {
          setStatus(`Playback failed: ${err.message}`);
          console.error('[m1] playback failed', err);
        });
      }
    } catch (err) {
      setStatus(`Could not load the test clip: ${err.message}`);
      console.error('[m1] test clip failed', err);
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    lastTime = 0;
    if (seek && Number.isFinite(audio.duration)) {
      seek.max = String(audio.duration);
      seek.value = '0';
    }
    setMediaSessionMetadata();
    setStatus(`Loaded ${formatSeconds(audio.duration)}. loop=${audio.loop}.`);
  });

  audio.addEventListener('play', () => {
    setupMediaSession(audio);
    setStatus('Playing. Lock the screen.');
  });

  audio.addEventListener('pause', () => {
    setMediaSessionPlaybackState('paused');
    setStatus('Paused.');
  });

  audio.addEventListener('seeking', () => {
    // A loop wrap also fires seeking near 0. Only an app-driven seek sets
    // manualSeek, so the natural wrap keeps its near-end previous value.
    if (manualSeek) {
      suppressWrap = true;
      lastTime = audio.currentTime;
    } else if (audio.currentTime > 1) {
      lastTime = audio.currentTime;
    }
  });

  audio.addEventListener('seeked', () => {
    manualSeek = false;
  });

  audio.addEventListener('timeupdate', () => {
    const now = audio.currentTime;
    if (suppressWrap) {
      suppressWrap = false;
      manualSeek = false;
      lastTime = now;
      if (seek && !draggingSeek) seek.value = String(now);
      return;
    }
    manualSeek = false;
    if (isNaturalWrap(lastTime, now, audio.duration)) {
      wrapCount += 1;
      setMediaSessionPlaybackState('playing');
      document.dispatchEvent(new CustomEvent('track-ended', {
        detail: { sessionId: SESSION_ID },
      }));
      setStatus(`Wrap #${wrapCount} at ${formatSeconds(audio.duration)}. Session still open.`);
    }
    lastTime = now;
    if (seek && !draggingSeek) seek.value = String(now);
  });

  // iOS keeps focus on a touched range, so focus is not a drag signal.
  seek?.addEventListener('pointerdown', () => {
    draggingSeek = true;
  });
  for (const type of ['pointerup', 'pointercancel', 'blur']) {
    seek?.addEventListener(type, () => {
      draggingSeek = false;
    });
  }

  seek?.addEventListener('input', () => {
    if (!Number.isFinite(audio.duration)) return;
    // Guard before moving currentTime: timeupdate can beat seeking.
    manualSeek = true;
    suppressWrap = true;
    lastTime = Number(seek.value);
    audio.currentTime = Number(seek.value);
  });

  // Native media controls are shadow DOM and may not expose their scrubber.
  // Mark any direct interaction so Safari can suppress a manual seek.
  for (const type of ['pointerdown', 'touchstart', 'keydown']) {
    audio.addEventListener(type, () => {
      manualSeek = true;
    }, { passive: true });
  }

  audio.addEventListener('ended', () => {
    console.warn('[m1] ended fired despite loop=true');
    setStatus('Unexpected: ended fired.');
  });

  document.addEventListener('track-ended', (event) => {
    if (event.detail?.sessionId === SESSION_ID) {
      console.info('[m1] track-ended', event.detail);
    }
  });

  document.addEventListener('sw-update-available', () => {
    console.info('[m1] sw-update-available');
    try {
      localStorage.setItem('m1-sw-update-available', '1');
    } catch (err) {
      console.info('[m1] could not record update event:', err);
    }
  });

  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'FORMAT_BRIDGE_PROGRESS') {
      console.info('[m1] format-bridge', event.data);
    }
  });

  window.addEventListener('online', retryFormatBridge);
  window.addEventListener('resize', scheduleAppHeight);
  window.addEventListener('orientationchange', scheduleAppHeight);
  window.visualViewport?.addEventListener('resize', scheduleAppHeight);
  window.addEventListener('beforeunload', () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });

  syncAppHeight();
  logEnvironment();
}

function dataUriToBlob(dataUri) {
  const comma = dataUri.indexOf(',');
  if (comma < 0) throw new Error('test clip is not a data URI');
  const header = dataUri.slice(0, comma);
  const payload = dataUri.slice(comma + 1);
  const mime = /^data:([^;]+)/.exec(header)?.[1] || 'audio/mpeg';
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function setMediaSessionMetadata() {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'M1 proof — 30s test tone',
    artist: 'Pocket Music Player',
    album: 'Milestone 1',
  });
}

function setupMediaSession(audio) {
  if (!('mediaSession' in navigator)) return;
  const handlers = {
    play: () => {
      audio.play().catch(() => {});
    },
    pause: () => audio.pause(),
    previoustrack: () => {
      audio.currentTime = 0;
    },
    nexttrack: () => {
      if (Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(audio.duration - 0.5, audio.currentTime + 10);
      }
    },
    seekbackward: null,
    seekforward: null,
  };
  for (const [action, handler] of Object.entries(handlers)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (err) {
      console.info('[m1] mediaSession action unsupported:', action, err);
    }
  }
  setMediaSessionPlaybackState('playing');
}

function setMediaSessionPlaybackState(state) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = state;
  } catch (err) {
    console.info('[m1] mediaSession playbackState failed:', err);
  }
}

function scheduleAppHeight() {
  if (heightFrame) return;
  heightFrame = requestAnimationFrame(() => {
    heightFrame = 0;
    syncAppHeight();
  });
}

function syncAppHeight() {
  const app = document.getElementById('app');
  if (!app) return;
  app.style.removeProperty('height');
  const cssHeight = app.getBoundingClientRect().height;
  const innerHeight = window.innerHeight;
  if (Number.isFinite(innerHeight) && innerHeight > 0 && Math.abs(innerHeight - cssHeight) > 1) {
    app.style.height = `${innerHeight}px`;
  }
  logViewport(app);
}

function logViewport(app) {
  console.info(
    '[m1] viewport innerHeight:',
    window.innerHeight,
    'visualViewport:',
    window.visualViewport?.height,
    'app:',
    app?.getBoundingClientRect().height,
  );
}

async function logEnvironment() {
  console.info('[m1] SharedArrayBuffer:', typeof SharedArrayBuffer);
  console.info('[m1] crossOriginIsolated:', window.crossOriginIsolated);
  if (navigator.storage?.persist) {
    try {
      console.info('[m1] storage.persist():', await navigator.storage.persist());
    } catch (err) {
      console.info('[m1] storage.persist() failed:', err);
    }
  }
  if (navigator.storage?.persisted) {
    try {
      console.info('[m1] storage.persisted():', await navigator.storage.persisted());
    } catch (err) {
      console.info('[m1] storage.persisted() failed:', err);
    }
  }
}

function retryFormatBridge() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => reg.active?.postMessage({ type: 'PRECACHE_FORMAT_BRIDGE' }))
    .catch(() => {});
}

function formatSeconds(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}s` : 'unknown';
}
