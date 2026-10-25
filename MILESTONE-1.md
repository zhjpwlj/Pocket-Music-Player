# Milestone 1 — Installable shell + background-audio proof

Status: **local verification complete, device acceptance pending.**
Scope is M1 only. No player broker, views, themes, OPFS library, FFmpeg,
mediabunny, or classify work is included.

## What ships

| Area | Implementation |
| --- | --- |
| Installable shell | `public/manifest.json` (standalone, 4 icons), Apple meta tags, Home Screen icon |
| Safe areas | `env(safe-area-inset-*)` padding on `#app` |
| Viewport | `100dvh` primary, `100lvh` standalone fallback, JS height sync |
| Service Worker | Workbox precache, navigation fallback, format-bridge cache, update flow |
| COOP/COEP | `public/_headers` sets COOP `same-origin`, COEP `require-corp`, CORP `same-origin` |
| Background audio proof | 30 s generated tone as a `blob:` URL, `loop = true`, wrap detection |
| Media Session | Metadata plus play/pause/prev/next handlers |
| Diagnostics | `crossOriginIsolated`, `SharedArrayBuffer`, cache names, height, update marker |

## Local evidence

All checks ran in headless Firefox against `dist/` served with the `_headers`
values applied by a local server.

- `npm test` — 5/5 `isNaturalWrap` tests pass.
- `npm run build` — 9 precache URLs, about 176 kB.
- `crossOriginIsolated: true`, `typeof SharedArrayBuffer === "function"`.
- `#app` height equals `window.innerHeight` (682 px in the test viewport).
- Audio source is `blob:`, `loop === true`, duration 30 s.
- Media Session metadata title and `playing` playback state are set.
- Natural loop wrap dispatches `track-ended` exactly once and keeps the session open.
- Manual seek through the app range control does not fire `track-ended`.
- Format bridge precaches both placeholder assets on first controlled load.
- Offline: `fetch('/index.html')` and the hashed JS return 200; offline navigation
  reload renders the shell.
- SW update A → B: `registration.waiting === "installed"`,
  `sw-update-available` marker set, `sw-apply-update` reloads, new shell served,
  `waiting` cleared.

## Device acceptance — still required

Run on a real iPhone with iOS 26.x, installed to the Home Screen, with Safari
Web Inspector attached over USB. None of these were possible in this
environment.

- [ ] **Install** — Add to Home Screen, opens standalone, correct icon and title.
- [ ] **V-Viewport-1** — Shell fills the visible viewport, safe areas clear the
  notch and home indicator, no page scroll or clipped controls.
- [ ] **V-Audio-1** — Tap play, lock the screen, tone keeps playing.
- [ ] **V-Audio-2** — Audio continues for at least 10 minutes in the background.
- [ ] **V-MediaSession-1** — Lock screen shows the tone title; play, pause,
  previous, and next controls work.
- [ ] **V-Wrap-1** — Move the app range near the end, let it wrap; `track-ended`
  fires exactly once and the session stays open.
- [ ] **B1** — After one online run, airplane mode still loads the shell and the
  format-bridge cache holds both assets.
- [ ] **Update** — Deploy a new build, reopen the PWA, confirm the update event
  and that applying it reloads into the new shell.

Native `<audio controls>` scrubbing is shadow DOM. On iOS, a scrub back to the
start can look like a loop wrap. Use the app's **Manual seek (wrap guard)**
range for V-Wrap-1. This is a proof harness limitation, not a player design.

## Deviations from the supplied snippets

1. **`_headers` uses indented header lines.** Some hosts reject the literal
   block form; the values are unchanged.
2. **Service Worker is bundled by Vite before Workbox injection.**
   `workbox injectManifest` does not bundle ESM imports, so `src/sw.js` is
   built to `dist/sw.js` first, then the manifest is injected.
3. **Navigation route replaced.** The supplied `app-shell` CacheFirst route
   never populated, so offline reload failed. It is now
   `NavigationRoute(createHandlerBoundToURL('index.html'))` against the
   precache.
4. **Format bridge assets are labeled placeholders.** `ffmpeg-audio.wasm` and
   `ffmpeg-audio.worker.js` exist only to test precache and offline behavior.
   Milestone 8 replaces them. See `public/assets/wasm/README.md`.
5. **Test tone is an embedded base64 module.** Vite emitted the `?inline` MP3
   as a URL, which Workbox did not precache.
6. **Custom range seek added.** Native media-control seek events are not
   observable to page JS, so V-Wrap-1 needs a deterministic seek input.
7. **`navigator.storage.persist()` is non-blocking.** Awaiting it delayed the
   automatic format-bridge precache.
8. **Update notification requires an active worker.** The first install is not
   reported as an update.

## Deploy

Build command: `npm run build`. Publish directory: `dist`.

The host must honor `_headers`; Netlify and Cloudflare Pages do. GitHub Pages
does not send COOP/COEP, so `crossOriginIsolated` will be false there and the
format bridge cannot use `SharedArrayBuffer`.

## Gate

Stop for M1 review before starting M2.
