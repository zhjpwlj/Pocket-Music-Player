function audioElement(createElement) {
  const el = createElement('audio');
  el.preload = 'auto';
  el.loop = true;
  return el;
}

export function createPool({ createElement = (tag) => document.createElement(tag) } = {}) {
  return {
    audioA: audioElement(createElement),
    audioB: audioElement(createElement),
    audioLive: audioElement(createElement),
  };
}
