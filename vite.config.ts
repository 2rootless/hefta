/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { heftaBau } from './build/hefta-plugin.ts';

const paket = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  base: './',
  plugins: [svelte(), heftaBau()],
  define: {
    __APP_VERSION__: JSON.stringify(paket.version),
  },
  build: {
    target: ['safari17', 'chrome120', 'firefox121'],
    sourcemap: false,
    // Keine data:-URLs für Schriften und Bilder; alles als eigene Datei vom eigenen Host.
    assetsInlineLimit: 0,
    // PDF.js und pdf-lib sind groß, werden aber nur bei Bedarf nachgeladen (nicht im Start-Bundle).
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ['src/**/*.test.ts', 'build/**/*.test.ts'],
    environment: 'node',
  },
});
