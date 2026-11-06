// Liefert dist-vermieter/ für die Browser-Tests mit den echten Kopfzeilen aus _headers aus. Die Regel
// für den Worker von PDF.js steht nur dort; „vite preview“ kennt sie nicht.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const WURZEL = 'dist-vermieter';
const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
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

createServer((anfrage, antwort) => {
  const pfad = decodeURIComponent(new URL(anfrage.url, 'http://x').pathname);
  const datei = join(WURZEL, pfad.endsWith('/') ? `${pfad}index.html` : pfad);
  if (pfad.includes('..') || !existsSync(datei) || !statSync(datei).isFile()) {
    antwort.writeHead(404, kopfzeilen);
    antwort.end();
    return;
  }
  antwort.writeHead(200, {
    ...kopfzeilen,
    'Content-Type': TYPEN[extname(datei)] ?? 'application/octet-stream',
  });
  antwort.end(readFileSync(datei));
}).listen(4174);
