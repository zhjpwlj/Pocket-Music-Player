// src/main.js
const bootPromise = boot();
bootPromise.then(() => {
  document.dispatchEvent(new CustomEvent('boot-complete'));
});

async function boot() {
  const reg = await registerServiceWorker();
  if (reg) {
    triggerFormatBridgePrecache(reg);
    installUpdateListener(reg);
  }
  // Persistence is best-effort. Never let it gate precache or boot.
  requestPersistentStorage();
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (err) {
    console.warn('[boot] SW registration failed:', err);
    return null;
  }
}

async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return;
  try {
    const granted = await navigator.storage.persist();
    console.info('[boot] persistent storage:', granted);
  } catch (err) {
    console.info('[boot] persistent storage request failed:', err);
  }
}

async function triggerFormatBridgePrecache(reg) {
  const ready = await navigator.serviceWorker.ready;
  const active = ready.active;
  if (!active) return;

  const required = [
    '/assets/wasm/ffmpeg-audio.wasm',
    '/assets/wasm/ffmpeg-audio.worker.js',
  ];

  const cache = await caches.open('format-bridge');
  const present = await Promise.all(required.map((u) => cache.match(u)));
  if (present.every(Boolean)) return;

  const trigger = () => active.postMessage({ type: 'PRECACHE_FORMAT_BRIDGE' });
  // First load: clientsClaim may take control after this boot pass.
  if (navigator.serviceWorker.controller) {
    trigger();
  } else {
    navigator.serviceWorker.addEventListener('controllerchange', trigger, { once: true });
  }

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const fresh = await Promise.all(required.map((u) => cache.match(u)));
    if (fresh.every(Boolean)) return;
    trigger();
  });
}

function installUpdateListener(reg) {
  const notify = () => {
    // A waiting worker with no active one is the first install, not an update.
    if (reg.active && reg.waiting) {
      document.dispatchEvent(new CustomEvent('sw-update-available'));
    }
  };
  reg.addEventListener('updatefound', () => {
    const incoming = reg.installing;
    incoming?.addEventListener('statechange', () => {
      if (incoming.state === 'installed') notify();
    });
  });
  notify();

  document.addEventListener('sw-apply-update', () => {
    reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  });
}
