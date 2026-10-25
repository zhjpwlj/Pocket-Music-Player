import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: 'src/sw.js',
      formats: ['es'],
      fileName: () => 'sw.js',
    },
  },
});
