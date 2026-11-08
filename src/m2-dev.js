import { createPool } from './audio/pool.js';
import { createPlayerBroker } from './core/player-broker.js';

let heightFrame = 0;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initM2, { once: true });
} else {
  initM2();
}

function initM2() {
  const container = document.getElementById('player-container');
  const fileInput = document.getElementById('m2-file');
  const loadButton = document.getElementById('m2-load');
  const swapButton = document.getElementById('m2-swap');
  const toggleButton = document.getElementById('m2-toggle');
  const status = document.getElementById('m2-status');
  const seek = document.getElementById('m2-seek');
  if (!container || !fileInput || !loadButton) return;

  const pool = createPool();
  for (const element of [pool.audioA, pool.audioB]) {
    element.controls = true;
    container.append(element);
  }
  const broker = createPlayerBroker({ pool });
  window.__pmpBroker = broker;
  window.__pmpPool = pool;

  let file = null;
  let draggingSeek = false;

  const setStatus = (text) => {
    if (status) status.textContent = text;
  };

  const paintSeek = (time, duration) => {
    if (!seek || !Number.isFinite(duration) || duration <= 0) return;
    const pct = Math.min(100, Math.max(0, (time / duration) * 100));
    seek.style.setProperty('--seek-progress', `${pct}%`);
  };

  const showSeek = (time, duration) => {
    if (!seek || draggingSeek || !Number.isFinite(time)) return;
    if (Number.isFinite(duration) && duration > 0) seek.max = String(duration);
    seek.value = String(time);
    paintSeek(time, duration);
  };

  const syncVisible = () => {
    const active = broker.getCurrentElement();
    for (const element of [pool.audioA, pool.audioB]) {
      element.hidden = element !== active;
    }
    if (toggleButton) toggleButton.textContent = active.paused ? 'Play' : 'Pause';
  };

  fileInput.addEventListener('change', () => {
    file = fileInput.files?.[0] ?? null;
    setStatus(file ? `Ready: ${file.name}` : 'Ready.');
  });

  loadButton.addEventListener('click', () => {
    if (!file) {
      setStatus('Pick a file first.');
      return;
    }
    const track = { id: file.name, title: file.name };
    broker.loadTrack(track, file, { autoplay: true });
    syncVisible();
  });

  swapButton?.addEventListener('click', () => {
    if (!broker.getState().track) {
      setStatus('Load a track first.');
      return;
    }
    broker.swapElement();
    syncVisible();
    setStatus('Swapped elements.');
  });

  toggleButton?.addEventListener('click', () => {
    const active = broker.getCurrentElement();
    if (active.paused) broker.play();
    else broker.pause();
    syncVisible();
  });

  broker.subscribe((event) => {
    const { state, track, currentTime, duration } = event;
    showSeek(currentTime, duration);
    if (event.type === 'trackchange') {
      setStatus(`Loaded ${track.title}.`);
    }
    if (event.type === 'statechange') {
      if (state === 'loading') setStatus('Loading…');
      else if (state === 'playing') {
        setStatus('Playing. Lock the screen.');
        if (track) setMediaSessionMetadata(track);
      }
      else if (state === 'paused') setStatus('Paused.');
      else if (state === 'ended') setStatus('Ended.');
      else if (state === 'error') setStatus('Playback error.');
      setMediaSessionPlaybackState(state);
      syncVisible();
    }
    if (event.type === 'error') {
      setStatus(`Playback failed: ${event.error?.message ?? 'unknown'}`);
      console.error('[m2] playback failed', event.error);
    }
  });

  // iOS keeps focus on a touched range, so focus is not a drag signal.
  let dragTimer = 0;
  const stopSeekDrag = () => {
    draggingSeek = false;
    clearTimeout(dragTimer);
  };
  seek?.addEventListener('pointerdown', () => {
    draggingSeek = true;
    clearTimeout(dragTimer);
    dragTimer = setTimeout(() => {
      draggingSeek = false;
    }, 800);
  });
  seek?.addEventListener('input', () => {
    clearTimeout(dragTimer);
    dragTimer = setTimeout(() => {
      draggingSeek = false;
    }, 800);
  });
  for (const type of ['pointerup', 'pointercancel', 'touchend', 'change', 'blur']) {
    seek?.addEventListener(type, stopSeekDrag);
  }

  seek?.addEventListener('input', () => {
    const time = Number(seek.value);
    broker.seek(time);
    paintSeek(time, broker.getState().duration);
  });

  setupMediaSession(broker);

  document.addEventListener('sw-update-available', () => {
    console.info('[m2] sw-update-available');
    try {
      localStorage.setItem('m1-sw-update-available', '1');
    } catch (err) {
      console.info('[m2] could not record update event:', err);
    }
  });

  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'FORMAT_BRIDGE_PROGRESS') {
      console.info('[m2] format-bridge', event.data);
    }
  });

  window.addEventListener('online', retryFormatBridge);
  window.addEventListener('resize', scheduleAppHeight);
  window.addEventListener('orientationchange', scheduleAppHeight);
  window.visualViewport?.addEventListener('resize', scheduleAppHeight);

  // Long-press the Pocket title for 1s to toggle an on-screen debug log.
  const mark = document.querySelector('.app-mark');
  const debug = document.getElementById('debug-log');
  let pressTimer = 0;
  let debugTimer = 0;

  const refreshDebug = async () => {
    if (!debug || debug.hidden) return;
    const reg = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null;
    const keys = typeof caches === 'undefined' ? [] : await caches.keys();
    const app = document.getElementById('app');
    const rect = app.getBoundingClientRect();
    const state = broker.getState();
    const active = broker.getCurrentElement();
    debug.textContent = [
      `version   v${__APP_VERSION__}`,
      `url       ${location.href}`,
      `viewport  ${window.innerWidth}x${window.innerHeight}`,
      `app       ${Math.round(rect.width)}x${Math.round(rect.height)}`,
      `isolated  ${window.crossOriginIsolated}`,
      `SAB       ${typeof SharedArrayBuffer}`,
      `sw        ${reg?.active?.state ?? 'none'}`,
      `caches    ${keys.join(', ') || 'none'}`,
      `broker    ${state.state} ${state.currentTime.toFixed(1)}/${Number.isFinite(state.duration) ? state.duration.toFixed(1) : '?'}`,
      `active    ${active === pool.audioA ? 'A' : 'B'}`,
      `urlA      ${pool.audioA.src || '-'}`,
      `urlB      ${pool.audioB.src || '-'}`,
      `media     ${navigator.mediaSession?.playbackState ?? 'n/a'}`,
    ].join('\n');
  };

  const toggleDebug = () => {
    if (!debug) return;
    debug.hidden = !debug.hidden;
    clearInterval(debugTimer);
    if (!debug.hidden) {
      refreshDebug();
      debugTimer = setInterval(refreshDebug, 1000);
    }
  };

  mark?.addEventListener('pointerdown', () => {
    clearTimeout(pressTimer);
    pressTimer = setTimeout(toggleDebug, 1000);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    mark?.addEventListener(type, () => clearTimeout(pressTimer));
  }
  mark?.addEventListener('contextmenu', (event) => event.preventDefault());

  syncVisible();
  syncAppHeight();
  logEnvironment();
}

function setupMediaSession(broker) {
  if (!('mediaSession' in navigator)) return;
  const handlers = {
    play: () => broker.play(),
    pause: () => broker.pause(),
    previoustrack: () => broker.seek(0),
    nexttrack: () => broker.seek(broker.getCurrentElement().currentTime + 10),
  };
  for (const [action, handler] of Object.entries(handlers)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (err) {
      console.info('[m2] mediaSession action unsupported:', action, err);
    }
  }
}

function setMediaSessionMetadata(track) {
  if (!('mediaSession' in navigator)) return;
  const data = { title: track.title, artist: 'Pocket Music Player', album: 'Milestone 2' };
  try {
    navigator.mediaSession.metadata =
      typeof MediaMetadata === 'undefined' ? data : new MediaMetadata(data);
  } catch (err) {
    console.info('[m2] mediaSession metadata failed:', err);
  }
}

function setMediaSessionPlaybackState(state) {
  if (!('mediaSession' in navigator)) return;
  const mapped = state === 'playing' ? 'playing' : state === 'idle' ? 'none' : 'paused';
  try {
    navigator.mediaSession.playbackState = mapped;
  } catch (err) {
    console.info('[m2] mediaSession playbackState failed:', err);
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
}

async function logEnvironment() {
  console.info('[m2] SharedArrayBuffer:', typeof SharedArrayBuffer);
  console.info('[m2] crossOriginIsolated:', window.crossOriginIsolated);
  if (navigator.storage?.persist) {
    try {
      console.info('[m2] storage.persist():', await navigator.storage.persist());
    } catch (err) {
      console.info('[m2] storage.persist() failed:', err);
    }
  }
}

function retryFormatBridge() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => reg.active?.postMessage({ type: 'PRECACHE_FORMAT_BRIDGE' }))
    .catch(() => {});
}
