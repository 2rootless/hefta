import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { APP_NAME, APP_STORE_ADRESSE, APP_STORE_ID, PLAY_ADRESSE } from '../src/app/name.ts';
import { RATGEBER } from '../src/domain/ratgeber.ts';
import { cspHeader } from './csp.ts';
import {
  DATENSCHUTZ_PFAD,
  RATGEBER_ORDNER,
  RATGEBER_PFAD,
  ratgeberSchreiben,
  ARTIKEL_BLATT,
  artikelInhalt,
  ratgeberUebersichtHtml,
  webRahmen,
} from './ratgeber.ts';
import { RUECKMELDUNG_PFAD, rueckmeldungSchreiben } from './rueckmeldungSeite.ts';

// hefta.de als Website (B22, E50, E70, Planung 13e): Auf „/“ liegt die Landingpage, die Mappe zieht nach
// /mappe/, der Ratgeber nach /ratgeber/. Gebaut wird in einen eigenen Ordner, `dist-web/`. `dist/` bleibt,
// wie es ist: Die Apps im Store bringen es mit und wissen von der Website nichts.

const wurzel = join(import.meta.dirname, '..');
const web = join(wurzel, 'web');

export const WEB_ORDNER = 'dist-web';
/** Die Mappe im Browser. */
export const MAPPE_PFAD = 'mappe';
/** Wo der Beitrag früher lag; leitet dauerhaft weiter (E70). */
export const ALTER_RATGEBER = 'was-darf-der-vermieter-verlangen';

/**
 * Welcher Stand der Landingpage: „hefta2“ (Hefta 2 im Web) oder „v1“ (Version 1). Der Auftraggeber
 * entscheidet, ob die Seite vor oder mit Version 2.0 online geht (Planung 13e).
 */
export type WebStand = 'hefta2' | 'v1';
export const webStand = (): WebStand => (process.env.HEFTA_WEB_STAND === 'v1' ? 'v1' : 'hefta2');

/** Für die Seiten der Website: kein Skript von fremden Hosts, keine Verbindung, nichts Eingebettetes. */
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const esc = (t: string) =>
  t.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

/** Das Abzeichen von Apple (Marketing-Tools, deutsch, geladen am 13.11.2026), hell und dunkel. */
const ABZEICHEN_APPLE =
  '<picture><source srcset="/app-store-dunkel.svg" media="(prefers-color-scheme: dark)" />' +
  '<img src="/app-store.svg" alt="Laden im App Store" width="150" height="50" /></picture>';
const ABZEICHEN_PLAY = '<span>Jetzt bei<small>Google Play</small></span>';

/** Die Blätter „Ratgeber“ auf „/“: die Liste der Beiträge und jeder Beitrag als eigenes Blatt. */
export function ratgeberBlatt(): string {
  const m = RATGEBER.seiten.m;
  const beitraege = [
    { pfad: `/${RATGEBER_PFAD.m}/`, titel: m.h1, text: m.uebersicht.text, fund: m.uebersicht.fund },
  ];
  const liste = beitraege
    .map(
      (b) =>
        `<li><a href="#${ARTIKEL_BLATT}"><h2>${esc(b.titel)}</h2><p>${esc(b.text)}</p>` +
        `<span class="wo">${esc(b.fund)}</span></a></li>`,
    )
    .join('');
  return (
    `<div id="ratgeber" class="blatt-rat"><section class="rat-blatt" aria-labelledby="rat-blatt-t"><div class="innen">` +
    `<p class="kicker">Ratgeber</p><h1 id="rat-blatt-t">Ratgeber</h1>` +
    `<p class="lead">Beiträge rund um die Bewerbung um eine Wohnung.</p>` +
    `<ul class="rat-liste">${liste}</ul></div></section></div>` +
    // Der Beitrag selbst als Blatt (Auftraggeber 15.11.): Er öffnet sich ohne Laden, das App-Banner bleibt.
    `<div id="${ARTIKEL_BLATT}" class="blatt-artikel"><div class="rg-blatt"><div class="innen rg-wrap">` +
    `${artikelInhalt(true)}</div></div></div>`
  );
}

export function landingpageHtml(stand: WebStand): string {
  const datei = stand === 'v1' ? 'version1.html' : 'hefta2.html';
  const play = PLAY_ADRESSE
    ? `<a class="abz abz-play" href="${esc(PLAY_ADRESSE)}">${ABZEICHEN_PLAY}</a>`
    : '';
  let html = readFileSync(join(web, datei), 'utf8');
  // Auftraggeber 15.11.: Der Ratgeber als drittes Blatt, das wie ein Reiter wechselt (nur Hefta 2).
  html = html.replace('%RATGEBER_BLATT%', ratgeberBlatt());
  for (const [platz, wert] of [
    ['%CSP%', CSP],
    ['%APP_STORE_ID%', APP_STORE_ID],
    ['%APP_STORE_LINK%', APP_STORE_ADRESSE],
    ['%APP_STORE_ABZEICHEN%', ABZEICHEN_APPLE],
    ['%PLAY%', play],
  ] as const) {
    if (!html.includes(platz)) throw new Error(`web/${datei}: Platzhalter ${platz} fehlt`);
    html = html.replaceAll(platz, wert);
  }
  // Cloudflare würde die Mailadresse sonst hinter einem nachgeladenen Skript verstecken.
  return html
    .replace('<body>', '<body><!--email_off-->')
    .replace('</body>', '<!--/email_off--></body>');
}

/** `/ratgeber/`: Die Übersicht steht seit DP36 bei den Seiten des Ratgebers (build/ratgeber.ts). */
export { ratgeberUebersichtHtml };

/** `/impressum/`: der Text aus dem Generator, unverändert (data/impressum.de.html, src/app/impressum.ts). */
export function impressumSeiteHtml(): string {
  const text = readFileSync(join(wurzel, 'data/impressum.de.html'), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
  // PC40: im Rahmen der Landingpage, ohne aufgeschlagenen Reiter.
  return webRahmen('Impressum', '', `<main id="inhalt" class="rg-text ds">${text}</main>`, {
    reiter: null,
  });
}

/**
 * Vorschau auf pages.dev (Planung 13g, Punkt 5): `HEFTA_WEB_VORSCHAU=1` sperrt die ganze Seite für Suchmaschinen,
 * per Kopfzeile und robots.txt. Nie für hefta.de.
 */
export const webVorschau = (): boolean => process.env.HEFTA_WEB_VORSCHAU === '1';

export function webHeadersFuer(vorschau: boolean): string {
  return vorschau
    ? webHeaders.replace('/*\n', '/*\n  X-Robots-Tag: noindex, nofollow\n')
    : webHeaders;
}

export const webHeaders = `/*
  Content-Security-Policy: ${cspHeader}
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  Cross-Origin-Opener-Policy: same-origin
  Permissions-Policy: geolocation=(), microphone=(), payment=(), usb=(), interest-cohort=()

/
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-cache

/${MAPPE_PFAD}/
  Cache-Control: no-cache

/${MAPPE_PFAD}/index.html
  Cache-Control: no-cache

/${MAPPE_PFAD}/sw.js
  Cache-Control: no-cache

/${MAPPE_PFAD}/manifest.webmanifest
  Cache-Control: no-cache

/${MAPPE_PFAD}/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

/** Dauerhafte Weiterleitungen (Cloudflare Pages, `_redirects`). Links mit „#/…“ leitet web/weiter.js. */
export const webRedirects = [
  `/${ALTER_RATGEBER} /${RATGEBER_PFAD.m}/ 301`,
  `/${ALTER_RATGEBER}/ /${RATGEBER_PFAD.m}/ 301`,
  '',
].join('\n');

/** Was im Bau der App liegt, aber zur Website gehört: Es steht in dist-web/ an seinem eigenen Platz. */
const NUR_WEBSITE = new Set([
  '_headers',
  '404.html',
  'robots.txt',
  RATGEBER_ORDNER,
  DATENSCHUTZ_PFAD,
  RUECKMELDUNG_PFAD,
  ALTER_RATGEBER,
]);

/** Baut dist-web/ aus dem fertigen dist/ und den Vorlagen in web/. */
export function webseiteBauen(
  app: string,
  ziel: string,
  stand: WebStand = webStand(),
  vorschau: boolean = webVorschau(),
): void {
  rmSync(ziel, { recursive: true, force: true });
  mkdirSync(join(ziel, MAPPE_PFAD), { recursive: true });
  for (const name of readdirSync(app)) {
    if (NUR_WEBSITE.has(name)) continue;
    cpSync(join(app, name), join(ziel, MAPPE_PFAD, name), { recursive: true });
  }
  ratgeberSchreiben(ziel, 'm');
  writeFileSync(join(ziel, RATGEBER_ORDNER, 'index.html'), ratgeberUebersichtHtml());
  mkdirSync(join(ziel, 'impressum'), { recursive: true });
  writeFileSync(join(ziel, 'impressum', 'index.html'), impressumSeiteHtml());
  rueckmeldungSchreiben(ziel);

  writeFileSync(join(ziel, 'index.html'), landingpageHtml(stand));
  for (const datei of [
    'seite.css',
    'hefta.js',
    'weiter.js',
    'sw.js',
    'icon.svg',
    'app-store.svg',
    'app-store-dunkel.svg',
    'beispiel-mappe.pdf',
    // DP34: die Seiten des Stapels.
    'mappe-seite-1.jpg',
    'mappe-seite-2.jpg',
    'mappe-seite-3.jpg',
    'mappe-seite-4.jpg',
  ])
    cpSync(join(web, datei), join(ziel, datei));
  // PC36: Archivo, gekürzt auf die Zeichen der Seite (scripts/schrift-kuerzen.py), 59 statt 90 KB.
  cpSync(join(web, 'archivo.woff2'), join(ziel, 'archivo.woff2'));
  // Für frühere Installationen auf dem Home-Bildschirm und das Symbol in Safari.
  cpSync(join(wurzel, 'public', 'icons'), join(ziel, 'icons'), { recursive: true });
  writeFileSync(
    join(ziel, 'robots.txt'),
    vorschau ? 'User-agent: *\nDisallow: /\n' : readFileSync(join(wurzel, 'public', 'robots.txt')),
  );
  writeFileSync(
    join(ziel, '404.html'),
    readFileSync(join(wurzel, 'public', '404.html'), 'utf8')
      .replaceAll('%APP_NAME%', APP_NAME)
      .replace('href="./"', 'href="/"')
      // PC88 QA17 und U9: Auch die 404-Seite zeigt im Tab das Favicon F1 und hat das Symbol für den Home-Bildschirm.
      .replace(
        '</title>',
        '</title>' +
          '<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml" />' +
          '<link rel="icon" href="/icons/favicon-32.png" type="image/png" sizes="32x32" />' +
          '<link rel="icon" href="/icons/favicon-16.png" type="image/png" sizes="16x16" />' +
          '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
      ),
  );
  writeFileSync(join(ziel, '_headers'), webHeadersFuer(vorschau));
  writeFileSync(join(ziel, '_redirects'), webRedirects);
  if (!existsSync(join(ziel, MAPPE_PFAD, 'index.html'))) throw new Error('dist-web: Mappe fehlt');
}
