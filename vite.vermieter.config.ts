import { svelte } from '@sveltejs/vite-plugin-svelte';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { vermieterCspMeta, vermieterHeadersFile } from './build/csp.ts';
import { lizenzenText } from './build/hefta-plugin.ts';
import { ratgeberSchreiben } from './build/ratgeber.ts';
import { APP_NAME } from './src/app/name.ts';

const wurzel = import.meta.dirname;
const ziel = join(wurzel, 'dist-vermieter');
const pdfjs = join(wurzel, 'node_modules', 'pdfjs-dist');

// Lädt Worker und Bilddecoder gleich beim Öffnen der Seite. Ohne sie blieben Scans ohne Netz stumm
// weiß. Dieselbe Adresse wie später in PDF.js, darum findet der Worker sie dann schon im Speicher.
const HUELLE = `import './wasm/openjpeg_nowasm_fallback.js';
import './wasm/jbig2_nowasm_fallback.js';
import './pdf.worker.min.mjs';
`;

function vermieterBau(): Plugin {
  return {
    name: 'hefta-vermieter',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html
          .replaceAll('%APP_NAME%', APP_NAME)
          .replace(
            '<!--csp-->',
            `<meta http-equiv="Content-Security-Policy" content="${vermieterCspMeta}" />`,
          ),
    },
    closeBundle() {
      const pdf = join(ziel, 'pdfjs');
      mkdirSync(join(pdf, 'wasm'), { recursive: true });
      cpSync(join(pdfjs, 'legacy/build/pdf.worker.min.mjs'), join(pdf, 'pdf.worker.min.mjs'));
      for (const d of [
        'jbig2_nowasm_fallback.js',
        'openjpeg_nowasm_fallback.js',
        'LICENSE_JBIG2',
        'LICENSE_OPENJPEG',
        'LICENSE_PDFJS_JBIG2',
        'LICENSE_PDFJS_OPENJPEG',
      ]) {
        cpSync(join(pdfjs, 'wasm', d), join(pdf, 'wasm', d));
      }
      writeFileSync(join(pdf, 'huelle.mjs'), HUELLE);
      mkdirSync(join(ziel, 'icons'), { recursive: true });
      cpSync(join(wurzel, 'public/icons/favicon.svg'), join(ziel, 'icons/favicon.svg'));
      writeFileSync(join(ziel, '_headers'), vermieterHeadersFile);
      writeFileSync(join(ziel, 'robots.txt'), readFileSync(join(wurzel, 'public/robots.txt')));
      writeFileSync(join(ziel, 'lizenzen.txt'), lizenzenText());
      ratgeberSchreiben(ziel, 'v');
    },
  };
}

// Eigener Build für die eigene Adresse: keine Datei, kein Speicher und kein Service Worker der App.
export default defineConfig({
  root: join(wurzel, 'vermieter'),
  base: './',
  publicDir: false,
  plugins: [svelte({ configFile: join(wurzel, 'svelte.config.js') }), vermieterBau()],
  build: {
    outDir: ziel,
    emptyOutDir: true,
    target: ['safari17', 'chrome120', 'firefox121'],
    sourcemap: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
  },
});
