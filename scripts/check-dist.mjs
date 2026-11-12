// Frühwarnung nach dem Build: Taucht in dist/ eine Adresse zu einem unbekannten fremden Host auf,
// scheitert der Build. Erlaubt sind nur Namensräume und Doku-Links, die nie geladen werden
// (XML/SVG/XMP-Namensräume, Fehlertexte von Svelte, Lizenzhinweise).
// Die eigentliche Sperre ist die Content-Security-Policy (connect-src 'self').
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const ERLAUBT = new Set([
  'www.w3.org',
  'ns.adobe.com',
  'www.xfa.org',
  'purl.org',
  'www.aiim.org',
  'svelte.dev',
  'github.com',
  'www.apache.org',
  'example.com',
  'foo.bar',
  // Selbsttests der URL-Polyfills in PDF.js (Fassung für ältere Browser), werden nie geladen.
  'a',
  'x',
  // E30: Link „Im App Store laden“ am iPhone in Safari. Ein Link, den man antippt, keine Anfrage.
  'apps.apple.com',
]);
// Der Hinweis auf dem Deckblatt ist ein Link im PDF: Er wird nur geöffnet, wenn jemand ihn antippt.
ERLAUBT.add(/APP_DOMAIN = '([^']+)'/.exec(readFileSync('src/app/name.ts', 'utf8'))[1]);
// Quellen des Regelkatalogs: werden nur als Text angezeigt und vom Nutzer selbst geöffnet, nie geladen.
const katalog = JSON.parse(readFileSync('data/regelkatalog.de.json', 'utf8'));
for (const quelle of katalog.grundlage ?? []) ERLAUBT.add(new URL(quelle.url).host);
for (const weg of Object.values(katalog.vermieter?.pruefwege ?? {}))
  ERLAUBT.add(new URL(weg.url).host);
// Quellen des Ratgebers: Links, die der Nutzer selbst öffnet.
const ratgeber = JSON.parse(readFileSync('data/ratgeber.de.json', 'utf8'));
for (const quelle of ratgeber.quellen) ERLAUBT.add(new URL(quelle.url).host);
// Links im Text des Datenschutz-Generators: Auch sie öffnet nur, wer sie antippt.
const datenschutz = readFileSync('data/datenschutz.de.html', 'utf8');
for (const [, host] of datenschutz.matchAll(/href="https?:\/\/([a-zA-Z0-9.-]+)/g))
  ERLAUBT.add(host);
// Die eigene Adresse der Vermieter-Seite steht im Link auf dem Deckblatt.
for (const host of [...ERLAUBT]) if (host.startsWith('hefta.')) ERLAUBT.add(`vermieter.${host}`);

const TEXT = new Set(['.js', '.mjs', '.css', '.html', '.webmanifest', '.json']);

function dateien(ordner) {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    return statSync(pfad).isDirectory() ? dateien(pfad) : [pfad];
  });
}

const funde = [];
for (const datei of [...dateien('dist'), ...dateien('dist-vermieter')]) {
  if (!TEXT.has(extname(datei))) continue;
  const inhalt = readFileSync(datei, 'utf8');
  for (const [, host] of inhalt.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)) {
    if (!ERLAUBT.has(host)) funde.push(`${datei}: ${host}`);
  }
}

// E54, E57: Die einzige Verbindung nach außen ist der Empfang der Rückmeldung. Keine andere Adresse
// unter /api/, und die CSP erlaubt genau diese eine.
const EMPFANG = 'https://hefta.de/api/rueckmeldung';
for (const datei of dateien('dist')) {
  if (!TEXT.has(extname(datei))) continue;
  const inhalt = readFileSync(datei, 'utf8');
  for (const [adresse] of inhalt.matchAll(/https:\/\/hefta\.de\/api\/[a-zA-Z0-9/_-]*/g))
    if (adresse !== EMPFANG) funde.push(`${datei}: ${adresse}`);
}
for (const datei of ['dist/index.html', 'dist/_headers']) {
  const csp = readFileSync(datei, 'utf8');
  if (!csp.includes(`connect-src 'self' ${EMPFANG};`))
    funde.push(`${datei}: connect-src erlaubt nicht genau den Empfang`);
}

// Die Lizenztexte reisen mit: die App, die Schrift und jede Bibliothek aus package.json.
const lizenzen = readFileSync('dist/lizenzen.txt', 'utf8');
if (lizenzen !== readFileSync('dist-vermieter/lizenzen.txt', 'utf8'))
  funde.push('dist-vermieter/lizenzen.txt weicht ab');
// Die Vermieter-Seite hat keinen Service Worker, kein Manifest und verbietet jede Verbindung.
for (const fehlt of ['sw.js', 'manifest.webmanifest']) {
  if (existsSync(`dist-vermieter/${fehlt}`))
    funde.push(`dist-vermieter/${fehlt} darf es nicht geben`);
}
if (!readFileSync('dist-vermieter/_headers', 'utf8').includes("connect-src 'none'"))
  funde.push("dist-vermieter/_headers: connect-src 'none' fehlt");
const paket = JSON.parse(readFileSync('package.json', 'utf8'));
for (const pflicht of [
  'GNU AFFERO GENERAL PUBLIC LICENSE',
  'SIL OPEN FONT LICENSE',
  ...Object.keys(paket.dependencies),
]) {
  if (!lizenzen.includes(pflicht)) funde.push(`dist/lizenzen.txt: ${pflicht} fehlt`);
}

if (funde.length) {
  console.error('Befunde im Build:\n' + [...new Set(funde)].join('\n'));
  process.exit(1);
}
console.log('dist/: keine Adressen zu fremden Hosts.');
