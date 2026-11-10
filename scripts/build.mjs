import {build} from 'vite';
import {rm} from 'node:fs/promises';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(root, 'dist');
const watch = process.argv.includes('--watch') ? {} : null;

await rm(outDir, {recursive: true, force: true});

// Popup: a regular HTML page, ES modules are allowed there.
await build({
  configFile: false,
  root: resolve(root, 'src'),
  base: './',
  publicDir: resolve(root, 'public'),
  build: {
    outDir,
    emptyOutDir: false,
    watch,
    rollupOptions: {
      input: {popup: resolve(root, 'src/popup/index.html')}
    }
  }
});

// Content scripts can't be ES modules, so each one is bundled into a single IIFE.
const contentScripts = [
  ['bridge', 'src/content/bridge.ts'],
  ['main', 'src/main/index.ts']
];

for(const [name, entry] of contentScripts) {
  await build({
    configFile: false,
    publicDir: false,
    build: {
      outDir: resolve(outDir, 'content'),
      emptyOutDir: false,
      copyPublicDir: false,
      minify: false,
      watch,
      lib: {
        entry: resolve(root, entry),
        formats: ['iife'],
        name: `tgdl_${name}`,
        fileName: () => `${name}.js`
      }
    }
  });
}
