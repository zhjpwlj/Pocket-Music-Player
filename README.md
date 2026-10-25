# Pocket Music Player

Client-side music player PWA. Current state: Milestone 1 — installable shell,
Service Worker precache, COOP/COEP, and a static-blob background-audio proof.

## Run

```sh
npm install
npm run dev
npm test
npm run build
```

`npm run build` writes `dist/`, including the Service Worker and `_headers`.

## Deploy

- Build command: `npm run build`
- Publish directory: `dist`

Use a host that honors `_headers` (Netlify or Cloudflare Pages). GitHub Pages
does not send COOP/COEP, which the format bridge needs for
`SharedArrayBuffer`.

## Docs

- `MILESTONE-1.md` — scope, local evidence, device checklist, deviations.
- `public/assets/wasm/README.md` — placeholder disclosure.

## Device check

Install to the iPhone Home Screen, then run the checklist in
`MILESTONE-1.md` with Safari Web Inspector attached.
