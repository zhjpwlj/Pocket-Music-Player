// M1 placeholder. Replaced by the real audio-only FFmpeg worker in M8.
// This file exists so the service-worker precache path can be verified offline.
self.onmessage = () => {
  self.postMessage({
    type: 'format-bridge-unavailable',
    reason: 'M1 placeholder; real FFmpeg worker lands in M8',
  });
};
