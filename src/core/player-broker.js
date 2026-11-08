import { blob as defaultBlob } from '../audio/blob.js';

const TIME_UPDATE_MS = 1000;

export function createPlayerBroker({ pool, blob = defaultBlob } = {}) {
  if (!pool?.audioA || !pool?.audioB) {
    throw new TypeError('createPlayerBroker requires pool.audioA and pool.audioB');
  }

  let active = pool.audioA;
  let other = pool.audioB;
  let track = null;
  let file = null;
  let state = 'idle';
  let pendingAutoplay = false;
  let pendingSeek = null;
  let swapOutgoing = null;
  let lastUpdate = 0;
  const listeners = new Set();

  function getState() {
    return {
      state,
      track,
      currentTime: active.currentTime,
      duration: active.duration,
      activeElement: active,
    };
  }

  function emit(type, extra = {}) {
    const event = { type, ...getState(), ...extra };
    for (const fn of [...listeners]) fn(event);
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') throw new TypeError('subscribe requires a function');
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function validate(trackRef, source) {
    if (!trackRef || typeof trackRef.id !== 'string' || typeof trackRef.title !== 'string') {
      throw new TypeError('trackRef must have id and title');
    }
    if (!(source instanceof Blob)) {
      throw new TypeError('loadTrack requires a Blob');
    }
  }

  function loadTrack(trackRef, source, { autoplay = true } = {}) {
    validate(trackRef, source);
    other.pause();
    active.pause();
    track = trackRef;
    file = source;
    pendingAutoplay = autoplay;
    pendingSeek = null;
    state = 'loading';
    blob.assignUrl(active, source);
    emit('trackchange');
    emit('statechange');
  }

  function startPlayback({ exclusive = true } = {}) {
    if (exclusive) other.pause();
    pool.audioLive?.pause();
    const result = active.play();
    if (result && typeof result.catch === 'function') {
      result.catch((error) => {
        state = 'paused';
        emit('statechange');
        emit('error', { error });
      });
    }
  }

  function play() {
    if (!track) return;
    startPlayback();
  }

  function pause() {
    active.pause();
  }

  function seek(seconds) {
    if (!Number.isFinite(seconds)) return;
    let time = seconds;
    if (Number.isFinite(active.duration)) {
      time = Math.min(Math.max(time, 0), active.duration);
    }
    active.currentTime = time;
    emit('time-update');
  }

  // Dev-only A/B proof: same track, other element, same position. The
  // outgoing element keeps playing until the incoming one reports `playing`,
  // so the handover has no silent gap.
  function swapElement() {
    if (!file) return;
    const time = active.currentTime;
    const wasPlaying = !active.paused;
    const outgoing = active;
    active = other;
    other = outgoing;
    pendingSeek = time;
    pendingAutoplay = wasPlaying;
    swapOutgoing = wasPlaying ? outgoing : null;
    state = 'loading';
    blob.assignUrl(active, file);
    if (!wasPlaying) {
      outgoing.pause();
      blob.revokeElement(outgoing);
      outgoing.removeAttribute('src');
      outgoing.load();
    }
    emit('statechange');
  }

  function getCurrentElement() {
    return active;
  }

  function onLoadedMetadata(element) {
    if (element !== active) return;
    if (swapOutgoing) {
      active.currentTime = swapOutgoing.currentTime;
      pendingSeek = null;
    } else if (pendingSeek !== null) {
      active.currentTime = pendingSeek;
      pendingSeek = null;
    }
    if (pendingAutoplay) {
      pendingAutoplay = false;
      startPlayback({ exclusive: !swapOutgoing });
    } else {
      state = 'paused';
      emit('statechange');
    }
  }

  function onPlaying(element) {
    if (element !== active) return;
    if (swapOutgoing) {
      const outgoing = swapOutgoing;
      swapOutgoing = null;
      outgoing.pause();
      blob.revokeElement(outgoing);
      outgoing.removeAttribute('src');
      outgoing.load();
    }
    if (state !== 'playing') {
      state = 'playing';
      emit('statechange');
    }
  }

  function onPlay(element) {
    if (element !== active) return;
    state = 'playing';
    emit('statechange');
  }

  function onPause(element) {
    if (element !== active || state === 'loading' || state === 'ended') return;
    state = 'paused';
    emit('statechange');
  }

  function onTimeUpdate(element) {
    if (element !== active) return;
    const now = Date.now();
    if (now - lastUpdate < TIME_UPDATE_MS) return;
    lastUpdate = now;
    emit('time-update');
  }

  function onEnded(element) {
    if (element !== active) return;
    // M2 has no auto-advance; loop=true normally prevents this.
    state = 'ended';
    emit('statechange');
  }

  function onError(element) {
    if (element !== active) return;
    state = 'error';
    emit('statechange');
    emit('error', { error: element.error });
  }

  const events = { loadedmetadata: onLoadedMetadata, play: onPlay, playing: onPlaying, pause: onPause, timeupdate: onTimeUpdate, ended: onEnded, error: onError };
  const bound = [];
  for (const element of [pool.audioA, pool.audioB]) {
    for (const [type, handler] of Object.entries(events)) {
      const listener = () => handler(element);
      element.addEventListener(type, listener);
      bound.push([element, type, listener]);
    }
  }

  function destroy() {
    for (const [element, type, listener] of bound) {
      element.removeEventListener(type, listener);
    }
    pool.audioA.pause();
    pool.audioB.pause();
    for (const element of [pool.audioA, pool.audioB]) {
      element.removeAttribute('src');
      element.load();
      blob.revokeElement(element);
    }
    state = 'idle';
    track = null;
    file = null;
    listeners.clear();
  }

  return { loadTrack, play, pause, seek, swapElement, getState, getCurrentElement, subscribe, destroy };
}
