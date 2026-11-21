// App-Symbol in App, Web-App und Android einsetzen: A1b nach DP111 (PC178, 2.1): die Form von 2.0 (DP8) mit den Farben
// von A1 (DP63b), Strich 3,2 wie das Logo. Vorher A1 (DP63b), DP8, D002.
// Quelle: design/dp111/app-symbol und design/dp111/icon-composer. Aufruf: node scripts/icon-einsetzen.mjs
// Kopiert die fertigen Dateien des Designs; gerechnet wird nur, was DP111 nicht als Datei liefert: das getönte
// Ersatzbild für iOS, der Vordergrund des adaptiven Android-Symbols, die Altformen für Android vor Version 8 und das
// Startsymbol. Die Ebenen für Icon Composer (ios/App/App/AppIcon.icon/Assets) kommen unverändert aus DP111; Farben,
// Deckkraft und Schatten je Darstellung stehen in icon.json (nach TEST.md, von Hand).
// Einfarbiges Android-Symbol und Symbol der Erinnerungen bleiben nach DP8 (nur die Klammer, ohne Farbe).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const DP8 = 'design/dp8/DP8_an-planung_icon-faecher-voll';
const A1 = 'design/dp111/app-symbol';
const EBENEN = 'design/dp111/icon-composer';
const RES = 'android/app/src/main/res';
const DICHTEN = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];
const kopie = (von, nach) => {
  fs.mkdirSync(path.dirname(nach), { recursive: true });
  fs.copyFileSync(von, nach);
};

// Web-App: Favicon, Manifest, Home-Bildschirm. PC85 (W34, DP63a): Das Favicon ist nicht mehr das App-Symbol,
// sondern F1, das Zeichen frei, aus design/logo/favicon-dp63a-f1/.
const F1 = 'design/logo/favicon-dp63a-f1';
kopie(`${F1}/favicon.svg`, 'public/icons/favicon.svg');
kopie(`${F1}/favicon-16.png`, 'public/icons/favicon-16.png');
kopie(`${F1}/favicon-32.png`, 'public/icons/favicon-32.png');
kopie(`${A1}/apple-touch-icon-A1b-180.png`, 'public/icons/apple-touch-icon.png');
kopie(`${A1}/icon-A1b-192.png`, 'public/icons/icon-192.png');
kopie(`${A1}/icon-A1b-512.png`, 'public/icons/icon-512.png');
kopie(`${A1}/icon-maskable-A1b-512.png`, 'public/icons/icon-maskable-512.png');

// iOS: Ebenen für Icon Composer (ab iOS 26), unverändert aus DP111.
for (const ebene of fs.readdirSync(EBENEN).filter((d) => d.endsWith('.svg')))
  kopie(`${EBENEN}/${ebene}`, `ios/App/App/AppIcon.icon/Assets/${ebene}`);

// iOS: Ersatzbilder neben AppIcon.icon (bis iOS 18). Hell und dunkel gleich, die flache 1024er aus DP111; das
// getönte wird unten in Graustufen gerechnet.
for (const art of ['hell', 'dunkel'])
  kopie(
    `${A1}/app-symbol-A1b-1024.png`,
    `ios/App/App/Assets.xcassets/AppIcon.appiconset/hefta-${art}.png`,
  );

// Android: einfarbiges Symbol und Symbol der Erinnerungen wie bisher nach DP8
for (const [d] of DICHTEN) {
  kopie(
    `${DP8}/android/png/mipmap-${d}/ic_launcher_monochrome.png`,
    `${RES}/mipmap-${d}/ic_launcher_monochrome.png`,
  );
  kopie(
    `${DP8}/android/png/drawable-${d}/ic_stat_hefta.png`,
    `${RES}/drawable-${d}/ic_stat_hefta.png`,
  );
}

// Gerechnet: Altformen und Startsymbol
const browser = await chromium.launch();
const seite = await browser.newPage();
async function bild(ziel, html, kante) {
  await seite.setViewportSize({ width: kante, height: kante });
  await seite.setContent(
    `<html><body style="margin:0;background:transparent">${html}</body></html>`,
  );
  await seite.screenshot({
    path: ziel,
    omitBackground: true,
    clip: { x: 0, y: 0, width: kante, height: kante },
  });
}
const svg = (datei, kante) =>
  fs
    .readFileSync(datei, 'utf8')
    .replace(/<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/, '<svg$1')
    .replace(
      '<svg',
      `<svg width="${kante}" height="${kante}" style="display:block;position:absolute;inset:0"`,
    );

// iOS getönt: dasselbe Symbol in Graustufen
{
  const k = 1024;
  await bild(
    'ios/App/App/Assets.xcassets/AppIcon.appiconset/hefta-getoent.png',
    `<div style="position:relative;width:${k}px;height:${k}px;filter:grayscale(1)">${svg(`${A1}/app-symbol-A1b-quadrat.svg`, k)}</div>`,
    k,
  );
}

for (const [d, f] of DICHTEN) {
  // Adaptiver Vordergrund (108 dp): die Fassung für runde Masken aus DP111, ganz deckend.
  const v = 108 * f;
  await bild(
    `${RES}/mipmap-${d}/ic_launcher_foreground.png`,
    `<div style="position:relative;width:${v}px;height:${v}px">${svg(`${A1}/app-symbol-A1b-maskable.svg`, v)}</div>`,
    v,
  );
  // Altformen (48 dp): eckig mit Rundung und rund.
  const k = 48 * f;
  await bild(
    `${RES}/mipmap-${d}/ic_launcher.png`,
    `<div style="position:relative;width:${k}px;height:${k}px;border-radius:${k * 0.18}px;overflow:hidden">${svg(`${A1}/app-symbol-A1b-quadrat.svg`, k)}</div>`,
    k,
  );
  await bild(
    `${RES}/mipmap-${d}/ic_launcher_round.png`,
    `<div style="position:relative;width:${k}px;height:${k}px;border-radius:50%;overflow:hidden">${svg(`${A1}/app-symbol-A1b-maskable.svg`, k)}</div>`,
    k,
  );
}
// Startsymbol (Android 12+): 240 dp, darin der Kreis von 160 dp, mit der Fassung für runde Masken.
{
  const k = 960;
  await bild(
    `${RES}/drawable-xxxhdpi/start_symbol.png`,
    `<div style="position:relative;width:${k}px;height:${k}px">` +
      `<div style="position:absolute;left:160px;top:160px;width:640px;height:640px;border-radius:50%;overflow:hidden">` +
      `<div style="position:absolute;left:-80px;top:-80px;width:800px;height:800px">${svg(`${A1}/app-symbol-A1b-maskable.svg`, 800)}</div></div></div>`,
    k,
  );
}
await browser.close();
console.log('App-Symbol A1b nach DP111 eingesetzt.');
