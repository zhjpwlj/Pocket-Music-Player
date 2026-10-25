// workbox-config.js
// Mode: injectManifest. WASM binaries are precached by src/sw.js, not here.
module.exports = {
  globDirectory: 'dist/',
  globPatterns: [
    '**/*.{html,css,js,json,png,svg,webp,woff2}',
    'assets/silent.mp3',
  ],
  globIgnores: [
    'assets/wasm/**',
    'sw.js',
    'workbox-*.js',
  ],
  swDest: 'dist/sw.js',
  swSrc: 'dist/sw.js',
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
};
