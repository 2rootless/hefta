// Liefert dist-web/ (die Website, build/webseite.ts) für Browsertests und zum Ansehen aus, so wie Cloudflare
// Pages es tut: Kopfzeilen aus _headers (/*), Weiterleitungen aus _redirects, Ordner ohne Schrägstrich am
// Ende bekommen ihn per 308, Unbekanntes die 404-Seite. Aufruf: node scripts/vorschau-web.mjs [port]
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist-web');
const PORT = Number(process.argv[2] ?? 4175);
const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

const kopfzeilen = {};
let abschnitt = '';
for (const zeile of readFileSync(join(WURZEL, '_headers'), 'utf8').split('\n')) {
  if (!zeile.trim()) continue;
  if (!zeile.startsWith(' ')) {
    abschnitt = zeile.trim();
    continue;
  }
  if (abschnitt !== '/*') continue;
  const stelle = zeile.indexOf(':');
  kopfzeilen[zeile.slice(0, stelle).trim()] = zeile.slice(stelle + 1).trim();
}

const weiter = new Map();
for (const zeile of readFileSync(join(WURZEL, '_redirects'), 'utf8').split('\n')) {
  const [von, nach, code] = zeile.trim().split(/\s+/);
  if (von && nach) weiter.set(von, { nach, code: Number(code ?? 302) });
}

createServer((anfrage, antwort) => {
  const url = new URL(anfrage.url, 'http://x');
  const pfad = decodeURIComponent(url.pathname);
  const regel = weiter.get(pfad);
  if (regel) {
    antwort.writeHead(regel.code, { ...kopfzeilen, Location: regel.nach + url.search });
    antwort.end();
    return;
  }
  let datei = join(WURZEL, pfad);
  if (
    !pfad.includes('..') &&
    !pfad.endsWith('/') &&
    existsSync(datei) &&
    statSync(datei).isDirectory()
  ) {
    antwort.writeHead(308, { ...kopfzeilen, Location: `${pfad}/${url.search}` });
    antwort.end();
    return;
  }
  if (pfad.endsWith('/')) datei = join(datei, 'index.html');
  if (pfad.includes('..') || !existsSync(datei) || !statSync(datei).isFile()) {
    antwort.writeHead(404, { ...kopfzeilen, 'Content-Type': TYPEN['.html'] });
    antwort.end(readFileSync(join(WURZEL, '404.html')));
    return;
  }
  antwort.writeHead(200, {
    ...kopfzeilen,
    'Content-Type': TYPEN[extname(datei)] ?? 'application/octet-stream',
  });
  antwort.end(readFileSync(datei));
}).listen(PORT);
