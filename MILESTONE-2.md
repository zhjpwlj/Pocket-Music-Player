# Milestone 2 — Player broker (A/B element pool, blob lifecycle)

Status: **local verification complete, device acceptance pending.**

Scope is M2 only. No sessions, library, gapless, themes, auto-advance, or
`audioLive` loading is included. Files load from the file picker.

## What ships

| Area | Implementation |
| --- | --- |
| Element pool | `src/audio/pool.js` creates `audioA`, `audioB`, `audioLive`; all `preload="auto"`, `loop=true` |
| Blob URLs | `src/audio/blob.js` is the only creator/revoker; one live URL per element |
| Broker | `src/core/player-broker.js` with `loadTrack`, `play`, `pause`, `seek`, `swapElement`, `getState`, `getCurrentElement`, `subscribe`, `destroy` |
| Exclusivity | `play()` pauses the other A/B element and `audioLive` |
| Time updates | `time-update` throttled to ~1 Hz |
| Dev UI | `src/m2-dev.js`: file picker, Load & Play, Swap to other element, play/pause, seek |
| Diagnostics | Long-press Pocket 1 s: pool URLs, active element, broker state |

## Broker contract

```js
createPlayerBroker({ pool, blob? })
  .loadTrack(trackRef, blobFile, { autoplay = true })
  .play() .pause() .seek(seconds)
  .swapElement()
  .getState()          // { state, track, currentTime, duration, activeElement }
  .getCurrentElement()
  .subscribe(fn) -> unsubscribe
  .destroy()
```

Blob store:

```js
createBlobStore({ createObjectURL?, revokeObjectURL? })
  .createUrl(file) -> { url, revoke }
  .revokeUrl(handle)
  .assignUrl(element, file)   // revokes the element's previous handle first
  .revokeElement(element)
  .getElementUrl(element)
```

## Local evidence

Headless Firefox against `dist/` served with the `_headers` values applied by a
local server.

- `npm test` — 17 tests pass: blob 4, pool 3, player broker 10.
- `npm run build` — 9 precache URLs, about 101 kB.
- Pick a WAV, Load & Play → state `playing`, active element A, only A has a
  `blob:` URL.
- Seek to 1 s, swap → active element B, B has a `blob:` URL, A's `src` is empty,
  playback continues, and `fetch(oldUrl)` fails (revoked).
- `crossOriginIsolated: true`.

## Verification procedures

### V-Pool-1 — A/B independence

- [ ] Load a file, play, record `audioA.src` and `audioB.src`.
- [ ] Swap. Confirm the outgoing URL is revoked (`fetch` fails), the incoming
  URL is live, and playback continues from the same position.

### V-Blob-1 — create/revoke symmetry

- [ ] Run 20 load/swap cycles.
- [ ] Confirm `createObjectURL` count equals `revokeObjectURL` count.
- [ ] Confirm no console warning about an unknown handle.

### V-Exclusive-1 — playback exclusivity

- [ ] Load file 1 into A and play.
- [ ] Load file 2 into B and play. A pauses.
- [ ] Play A again. B pauses.

### B16 — blob URL count bounded by element count

- [ ] V-Blob-1 passes after 20 cycles; at most two live URLs exist.

## Device acceptance — still required

Run on a real iPhone with iOS 26.x, installed to the Home Screen, with Safari
Web Inspector attached over USB.

- [ ] **V-Audio-1** — Tap play, lock the screen, audio keeps playing.
- [ ] **V-Audio-2** — Audio continues for at least 10 minutes in the background.
- [ ] **V-Pool-1** — Swap while playing; no audible gap, old URL revoked.
- [ ] **V-Exclusive-1** — Only one element audible.
- [ ] **V-MediaSession-1** — Lock screen shows the file name; play, pause,
  previous, next work (basic M1 wiring, not the M5 controller).
- [ ] **B1** — After one online run, airplane mode still loads the shell.

## Deviations from the M2 pack

1. **`V-Wrap-1` is dropped.** M1 proved loop-wrap detection with a 30 s tone.
   The M2 pack assigns wrap handling to M3 and forbids auto-advance here.
   `loop=true` stays on the pool elements so background playback still holds.
2. **Basic Media Session stays.** The pack lists "no Media Session wiring" as an
   M2 non-goal, but M1's lock-screen check must keep passing. The dev UI keeps
   metadata plus play/pause/prev/next; the session-aware controller is M5.
3. **`loop=true` set at pool creation.** The pack places this in M3. Setting it
   now keeps M1 background playback working and costs nothing later.
4. **`audioLive` is created but never loaded or routed.** No Web Audio in M2.
5. **The M1 test-tone page is replaced by the file picker.** M2 loads real files
   from the picker, per pack.

## Risks

- **Autoplay after `loadedmetadata`.** The pack requires `play()` there, which
  may sit outside the iOS gesture stack. Device check decides.
- **Swap timing.** The incoming element seeks and plays on `loadedmetadata`;
  a slow decode can make the swap audible.
- **Revoke race.** The outgoing URL is revoked after the swap. WebKit may still
  hold it briefly; `onError` on an inactive element is ignored.

## Deploy

Build command: `npm run build`. Publish directory: `dist`.

## Gate

Stop for M2 review before starting M3.
