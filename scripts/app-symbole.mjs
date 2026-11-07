// App-Symbole und Startbilder für iOS und Android aus dem Logo des Kits (design/logo), bis das Design
// eigene liefert (B11, E28). Aufruf: node scripts/app-symbole.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const KORALLE = '#ff8466';
const GRUND = '#f5f6fa';
const ZEICHEN =
  '<path d="M20.6 22.2V17.2L16 13.2l-4.6 4v7.4c0 3.6 3 5 7 5s7-1.4 7-5V13.6L16 5.4 6.5 13.6v9.2" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" stroke="FARBE"/>';

/** Zeichen auf Fläche; `skala` ist der Anteil des Zeichens an der Kante wie im Kit (0,677 bzw. 0,55). */
const svg = (kante, { grund, farbe, skala, rund = false }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${kante}" height="${kante}" viewBox="0 0 32 32">` +
  (grund
    ? rund
      ? `<circle cx="16" cy="16" r="16" fill="${grund}"/>`
      : `<rect width="32" height="32" fill="${grund}"/>`
    : '') +
  `<g transform="translate(16 16) scale(${skala}) translate(-15.95 -17.5)">${ZEICHEN.replace('FARBE', farbe)}</g></svg>`;

const startbild = (b, h, kante) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${b}" height="${h}"><rect width="${b}" height="${h}" fill="${GRUND}"/>` +
  `<g transform="translate(${(b - kante) / 2} ${(h - kante) / 2})">${svg(kante, {
    grund: KORALLE,
    farbe: '#fff',
    skala: 0.677,
  })
    .replace('<svg ', '<svg x="0" y="0" ')
    .replace('<rect width="32" height="32"', '<rect width="32" height="32" rx="7"')}</g></svg>`;

const browser = await chromium.launch();
const seite = await browser.newPage();
async function png(datei, inhalt, b, h = b) {
  await seite.setViewportSize({ width: b, height: h });
  await seite.setContent(
    `<html><body style="margin:0;background:transparent">${inhalt}</body></html>`,
  );
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  await seite.screenshot({
    path: datei,
    omitBackground: true,
    clip: { x: 0, y: 0, width: b, height: h },
  });
}

// iOS: eine Größe, ohne Transparenz und ohne Rundung (iOS rundet selbst).
await png(
  'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
  svg(1024, { grund: KORALLE, farbe: '#fff', skala: 0.677 }),
  1024,
);
for (const n of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
  await png(`ios/App/App/Assets.xcassets/Splash.imageset/${n}`, startbild(2732, 2732, 360), 2732);

// Android: Symbole je Dichte, rund, und adaptive icon (Vordergrund 108 dp, Zeichen in der sicheren Zone).
const res = 'android/app/src/main/res';
for (const [d, f] of [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
]) {
  const k = Math.round(48 * f);
  await png(
    `${res}/mipmap-${d}/ic_launcher.png`,
    svg(k, { grund: KORALLE, farbe: '#fff', skala: 0.677 }),
    k,
  );
  await png(
    `${res}/mipmap-${d}/ic_launcher_round.png`,
    svg(k, { grund: KORALLE, farbe: '#fff', skala: 0.55, rund: true }),
    k,
  );
  const v = Math.round(108 * f);
  await png(
    `${res}/mipmap-${d}/ic_launcher_foreground.png`,
    svg(v, { farbe: '#fff', skala: 0.45 }),
    v,
  );
}
for (const [d, f] of [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
]) {
  const [b, h] = [Math.round(320 * f), Math.round(480 * f)];
  await png(`${res}/drawable-port-${d}/splash.png`, startbild(b, h, Math.round(72 * f)), b, h);
  await png(`${res}/drawable-land-${d}/splash.png`, startbild(h, b, Math.round(72 * f)), h, b);
}
await png(`${res}/drawable/splash.png`, startbild(480, 800, 108), 480, 800);
fs.writeFileSync(
  `${res}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${KORALLE.toUpperCase()}</color>\n</resources>\n`,
);
await browser.close();
console.log('App-Symbole und Startbilder geschrieben.');
