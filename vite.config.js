import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const sha = process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) || (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
})();

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version}+${sha}`),
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
