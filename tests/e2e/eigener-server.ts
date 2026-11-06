import { readFile, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join } from 'node:path';

const TYPEN: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

/**
 * Ein Server nur für einen Test: Er liefert den Build, `sw.js` aber mit eigenem Stand. So lässt sich eine neue
 * Version zeigen, ohne `dist/` zu ändern: Tests daneben merken nichts, und ein abgebrochener Lauf kann kein
 * verändertes `sw.js` zurücklassen, das später mit deployt würde. Eigener Port heißt auch eigener Service Worker.
 */
export async function eigenerServer() {
  const sw = readFileSync('dist/sw.js', 'utf8');
  if (!/const VERSION = "[0-9a-f]+"/.test(sw)) throw new Error('VERSION fehlt in dist/sw.js');
  let aktuell = sw;
  const server = createServer((anfrage, antwort) => {
    const pfad = new URL(anfrage.url ?? '/', 'http://localhost').pathname;
    if (pfad === '/sw.js') {
      antwort.writeHead(200, { 'Content-Type': TYPEN['.js']!, 'Cache-Control': 'no-store' });
      antwort.end(aktuell);
      return;
    }
    const datei = join('dist', pfad === '/' ? 'index.html' : decodeURIComponent(pfad));
    readFile(datei, (fehler, inhalt) => {
      if (fehler) {
        antwort.writeHead(404).end();
        return;
      }
      antwort.writeHead(200, {
        'Content-Type': TYPEN[extname(datei)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      antwort.end(inhalt);
    });
  });
  await new Promise<void>((fertig) => server.listen(0, fertig));
  return {
    adresse: `http://localhost:${(server.address() as AddressInfo).port}/`,
    /** Ab jetzt sieht der Browser beim nächsten Nachfragen ein anderes `sw.js`. */
    neueVersion() {
      aktuell = sw.replace(/const VERSION = "([0-9a-f]+)"/, 'const VERSION = "$1-neu"');
    },
    schliessen() {
      return new Promise<void>((fertig) => {
        server.close(() => fertig());
        server.closeAllConnections();
      });
    },
  };
}
