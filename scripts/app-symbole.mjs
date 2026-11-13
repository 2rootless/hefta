// App-Symbole, Startbild und Mitteilungssymbol für iOS und Android aus dem Symbolsatz des Designs
// (design/symbole-b11/app, B11, Liste für Code, Teil 5). Aufruf: node scripts/app-symbole.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Seit D002 (Planung PC3) kommen App-Icon und Symbol der Erinnerungen aus design/d002 (scripts/icon-einsetzen.mjs).
// Dieses Skript würde sie mit dem alten Symbol aus B11 auf Koralle überschreiben; darum läuft es nicht mehr.
if (!process.env.B11_TROTZDEM) {
  console.error('Veraltet seit D002: node scripts/icon-einsetzen.mjs benutzen.');
  process.exit(1);
}

const B11 = 'design/symbole-b11/app';
const IOS = 'ios/App/App/Assets.xcassets';
const RES = 'android/app/src/main/res';
const DICHTEN = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];

const browser = await chromium.launch();
const seite = await browser.newPage();
/** Eine SVG-Datei des Designs in eine PNG der Kante `kante` rechnen; `maske` schneidet rund aus. */
async function png(ziel, svgDatei, kante, { maske = false, farbe } = {}) {
  let svg = fs.readFileSync(svgDatei, 'utf8');
  if (farbe) svg = svg.replaceAll('currentColor', farbe);
  await seite.setViewportSize({ width: kante, height: kante });
  await seite.setContent(
    `<html><body style="margin:0;background:transparent"><div style="width:${kante}px;height:${kante}px;overflow:hidden;${maske ? 'border-radius:50%' : ''}">${svg.replace(/width="\d+" height="\d+"/, `width="${kante}" height="${kante}"`)}</div></body></html>`,
  );
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  await seite.screenshot({
    path: ziel,
    omitBackground: true,
    clip: { x: 0, y: 0, width: kante, height: kante },
  });
}
const json = (datei, inhalt) => fs.writeFileSync(datei, JSON.stringify(inhalt, null, 2) + '\n');

// iOS: App-Symbol hell, dunkel, getönt (Xcode, AppIcon mit Erscheinungen).
const icon = `${IOS}/AppIcon.appiconset`;
for (const f of fs.readdirSync(icon)) if (f.endsWith('.png')) fs.rmSync(`${icon}/${f}`);
for (const art of ['hell', 'dunkel', 'getoent'])
  fs.copyFileSync(`${B11}/ios/hefta-ios-${art}-1024.png`, `${icon}/hefta-${art}.png`);
const bild = (datei, aussehen) => ({
  ...(aussehen ? { appearances: [{ appearance: 'luminosity', value: aussehen }] } : {}),
  filename: datei,
  idiom: 'universal',
  platform: 'ios',
  size: '1024x1024',
});
json(`${icon}/Contents.json`, {
  images: [
    bild('hefta-hell.png'),
    bild('hefta-dunkel.png', 'dark'),
    bild('hefta-getoent.png', 'tinted'),
  ],
  info: { author: 'xcode', version: 1 },
});

// iOS: Startbild = Marke 64 pt mittig auf --ground (Launch Screen), hell und dunkel.
fs.rmSync(`${IOS}/Splash.imageset`, { recursive: true, force: true });
const marke = `${IOS}/StartMarke.imageset`;
fs.mkdirSync(marke, { recursive: true });
const bilder = [];
for (const [aussehen, farbe] of [
  ['hell', '#191a2c'],
  ['dunkel', '#f1f2f8'],
])
  for (const f of [1, 2, 3]) {
    const datei = `marke-${aussehen}@${f}x.png`;
    await png(`${marke}/${datei}`, `${B11}/start/hefta-marke-start.svg`, 64 * f, { farbe });
    bilder.push({
      ...(aussehen === 'dunkel'
        ? { appearances: [{ appearance: 'luminosity', value: 'dark' }] }
        : {}),
      filename: datei,
      idiom: 'universal',
      scale: `${f}x`,
    });
  }
json(`${marke}/Contents.json`, { images: bilder, info: { author: 'xcode', version: 1 } });
const grund = `${IOS}/StartGrund.colorset`;
fs.mkdirSync(grund, { recursive: true });
const farbe = (hex) => ({
  'color-space': 'srgb',
  components: {
    red: `0x${hex.slice(1, 3)}`,
    green: `0x${hex.slice(3, 5)}`,
    blue: `0x${hex.slice(5, 7)}`,
    alpha: '1.000',
  },
});
json(`${grund}/Contents.json`, {
  colors: [
    { color: farbe('#F5F6FA'), idiom: 'universal' },
    {
      appearances: [{ appearance: 'luminosity', value: 'dark' }],
      color: farbe('#14151F'),
      idiom: 'universal',
    },
  ],
  info: { author: 'xcode', version: 1 },
});

// Android: adaptive icon (Vordergrund, einfarbig), Altformen, Startsymbol, Mitteilung.
for (const [d, f] of DICHTEN) {
  await png(
    `${RES}/mipmap-${d}/ic_launcher_foreground.png`,
    `${B11}/android/hefta-android-vordergrund-432.svg`,
    108 * f,
  );
  await png(
    `${RES}/mipmap-${d}/ic_launcher_monochrome.png`,
    `${B11}/android/hefta-android-einfarbig-432.svg`,
    108 * f,
  );
  await png(`${RES}/mipmap-${d}/ic_launcher.png`, `${B11}/android/hefta-play-512.svg`, 48 * f);
  await png(
    `${RES}/mipmap-${d}/ic_launcher_round.png`,
    `${B11}/android/hefta-play-512.svg`,
    48 * f,
    { maske: true },
  );
  fs.mkdirSync(`${RES}/drawable-${d}`, { recursive: true });
  fs.copyFileSync(
    `${B11}/android/mitteilung/drawable-${d}/ic_stat_hefta.png`,
    `${RES}/drawable-${d}/ic_stat_hefta.png`,
  );
  for (const lage of ['port', 'land'])
    fs.rmSync(`${RES}/drawable-${lage}-${d}`, { recursive: true, force: true });
}
fs.rmSync(`${RES}/drawable/splash.png`, { force: true });
// Kreis von 160 dp im Grund des Icons gleich ins Bild: Die Hintergrundfarbe des Symbols setzt nicht jede
// Android-Fassung um (Emulator, 7.11.).
{
  const svg = fs
    .readFileSync(`${B11}/android/hefta-android-start-symbol-960.svg`, 'utf8')
    .replace(/(<svg[^>]*>)/, '$1<circle cx="480" cy="480" r="320" fill="#3f130b"/>');
  fs.writeFileSync(`${RES}/drawable-xxxhdpi/.start.svg`, svg);
  await png(`${RES}/drawable-xxxhdpi/start_symbol.png`, `${RES}/drawable-xxxhdpi/.start.svg`, 960);
  fs.rmSync(`${RES}/drawable-xxxhdpi/.start.svg`);
}
await browser.close();
console.log('App-Symbole, Startbilder und Mitteilungssymbol aus B11 geschrieben.');
