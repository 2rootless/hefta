// App-Icon in App, Web-App und Android einsetzen: F1 mit gefächerten Seiten nach DP8 (Planung PC6); vorher D002.
// Quelle: der Ordner des Designs. Aufruf: node scripts/icon-einsetzen.mjs
// Kopiert die fertigen Dateien des Designs; nur was D002 nicht als Datei liefert, wird hier gerechnet:
// die Altformen für Android vor Version 8 (eckig und rund), das Startsymbol und die iOS-Ersatzbilder.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const D = 'design/dp8/DP8_an-planung_icon-faecher-voll';
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

// Web-App: Favicon, Manifest, Home-Bildschirm
kopie(`${D}/favicon/favicon.svg`, 'public/icons/favicon.svg');
kopie(`${D}/favicon/favicon-16.png`, 'public/icons/favicon-16.png');
kopie(`${D}/favicon/favicon-32.png`, 'public/icons/favicon-32.png');
kopie(`${D}/web/apple-touch-icon.png`, 'public/icons/apple-touch-icon.png');
kopie(`${D}/web/hefta-icon-192.png`, 'public/icons/icon-192.png');
kopie(`${D}/web/hefta-icon-512.png`, 'public/icons/icon-512.png');
kopie(`${D}/web/hefta-icon-maskable-512.png`, 'public/icons/icon-maskable-512.png');

// iOS: Ersatzbilder neben AppIcon.icon, flach (hell, dunkel, getönt gleich)
for (const art of ['hell', 'dunkel', 'getoent'])
  kopie(
    `${D}/flach/hefta-icon-flach-1024.png`,
    `ios/App/App/Assets.xcassets/AppIcon.appiconset/hefta-${art}.png`,
  );

// Android: adaptives Icon (Vordergrund, einfarbig), Symbol der Erinnerungen
for (const [d] of DICHTEN) {
  for (const n of ['ic_launcher_foreground', 'ic_launcher_monochrome'])
    kopie(`${D}/android/png/mipmap-${d}/${n}.png`, `${RES}/mipmap-${d}/${n}.png`);
  kopie(
    `${D}/android/png/drawable-${d}/ic_stat_hefta.png`,
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

for (const [d, f] of DICHTEN) {
  const k = 48 * f;
  const flach = svg(`${D}/flach/hefta-icon-flach.svg`, k);
  await bild(
    `${RES}/mipmap-${d}/ic_launcher.png`,
    `<div style="position:relative;width:${k}px;height:${k}px;border-radius:${k * 0.18}px;overflow:hidden">${flach}</div>`,
    k,
  );
  await bild(
    `${RES}/mipmap-${d}/ic_launcher_round.png`,
    `<div style="position:relative;width:${k}px;height:${k}px;border-radius:50%;overflow:hidden">${flach}</div>`,
    k,
  );
}
// Startsymbol (Android 12+): 240 dp, darin der Kreis von 160 dp. Vorder- und Hintergrund des adaptiven Icons
// so gesetzt, dass 108 dp auf 240 dp kommen, wie Android es mit dem Icon selbst tut.
{
  const k = 960;
  await bild(
    `${RES}/drawable-xxxhdpi/start_symbol.png`,
    `<div style="position:relative;width:${k}px;height:${k}px">` +
      `<div style="position:absolute;left:160px;top:160px;width:640px;height:640px;border-radius:50%;overflow:hidden">` +
      `<div style="position:absolute;left:-160px;top:-160px;width:${k}px;height:${k}px">${svg(`${D}/android/ic_launcher_background.svg`, k)}` +
      `${svg(`${D}/android/ic_launcher_foreground.svg`, k)}</div></div></div>`,
    k,
  );
}
await browser.close();
console.log('Icon nach DP8 eingesetzt.');
