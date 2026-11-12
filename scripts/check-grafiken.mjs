// Prüft die eigenen Grafiken in src/grafiken/ (E58), bevor gebaut wird. Regeln: src/grafiken/README.md.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ORDNER = 'src/grafiken';
const PLAETZE = ['erster-start', 'wohnungen-leer', 'alles-da', 'zusage'];
const herkunft = JSON.parse(readFileSync(join(ORDNER, 'herkunft.json'), 'utf8'));
const fehler = [];

const dateien = readdirSync(ORDNER).filter((d) => d.endsWith('.svg'));
for (const datei of dateien) {
  const pfad = join(ORDNER, datei);
  const name = datei.replace(/\.svg$/, '');
  const svg = readFileSync(pfad, 'utf8');
  const melden = (text) => fehler.push(`${datei}: ${text}`);
  if (!PLAETZE.includes(name)) melden(`kein Platz dieses Namens (${PLAETZE.join(', ')})`);
  const h = herkunft[datei];
  if (!h || !h.von || !h.lizenz) melden('fehlt in herkunft.json (von, lizenz)');
  if (statSync(pfad).size > 30 * 1024) melden('größer als 30 KB');
  if (!/^\s*(<!--[\s\S]*?-->\s*)?<svg[\s>]/.test(svg)) melden('beginnt nicht mit <svg>');
  if (/<script|<image|<foreignObject|<iframe/i.test(svg))
    melden('enthält Skript, Bild oder Fremdinhalt');
  if (/\son[a-z]+\s*=/i.test(svg)) melden('enthält ein on…-Attribut');
  for (const m of svg.matchAll(/(?:xlink:)?href\s*=\s*["']([^"']*)["']/g))
    if (!m[1].startsWith('#')) melden(`Link nach außen: ${m[1]}`);
  if (/url\(\s*["']?(?!#)/i.test(svg)) melden('url(…) nach außen');
  for (const m of svg.matchAll(/(?:fill|stroke|stop-color|color)\s*[=:]\s*["']?([^"';>\s]+)/g)) {
    const wert = m[1];
    if (!/^(none|currentColor|inherit|transparent|var\(--[a-z0-9-]+\)?)$/i.test(wert))
      melden(`feste Farbe ${wert}; nur none, currentColor oder var(--…)`);
  }
}
for (const datei of Object.keys(herkunft))
  if (!dateien.includes(datei)) fehler.push(`herkunft.json nennt ${datei}, die Datei fehlt`);

if (fehler.length) {
  console.error(`Grafiken (E58):\n- ${fehler.join('\n- ')}`);
  process.exit(1);
}
console.log(`Grafiken: ${dateien.length} geprüft, alle eigen und ohne feste Farben.`);
