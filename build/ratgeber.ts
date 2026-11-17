import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ADRESSE, APP_NAME, APP_STORE_ID, VERMIETER_ADRESSE } from '../src/app/name.ts';
import { fundstelle, mitName, RATGEBER, type Stimme } from '../src/domain/ratgeber.ts';
import { FRAGE_REIHE } from '../src/rueckmeldung/fragen.ts';

// Die Ratgeberseite (design/ratgeber.md, RG1 und RG2): beim Bau aus data/ratgeber.de.json erzeugt, als fertiges
// HTML. Kein Skript, keine Zählung, nichts von fremden Hosts; Links auf die Quellen öffnet nur, wer sie antippt.

const wurzel = join(import.meta.dirname, '..');

/** Eigener Ordner für die Dateien der Seite: Der Service Worker der App lässt ihn in Ruhe. */
export const RATGEBER_ORDNER = 'ratgeber';
export const RATGEBER_PFAD: Record<Stimme, string> = {
  m: RATGEBER.seiten.m.pfad,
  v: RATGEBER.seiten.v.pfad,
};

const CSP = [
  "default-src 'none'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const esc = (text: string) =>
  mitName(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

function fund(f: string): string {
  const { text, url } = fundstelle(f);
  return `<a class="rg-f" href="${esc(url)}" rel="noreferrer">${esc(text)}</a>`;
}

/** Eine Fundstelle mit eigenem Text, etwa „Orientierungshilfe, Einleitung“ unter dem Zitat. */
function fundMitText(f: string, text: string): string {
  return `<a class="rg-f" href="${esc(fundstelle(f).url)}" rel="noreferrer">${esc(text)}</a>`;
}

const ziele: Record<Stimme, Record<string, string>> = {
  // Seit der Landingpage (B22): „Hefta öffnen“ führt zur Mappe, Impressum und Datenschutz haben eigene Seiten.
  m: {
    start: '/mappe/',
    recht: '/impressum/',
    datenschutz: '/datenschutz/',
    beispiel: '/beispiel-mappe.pdf',
    andere: `${VERMIETER_ADRESSE}/${RATGEBER_PFAD.v}/`,
  },
  v: { start: '/', recht: '/#/rechtliches', andere: `${APP_ADRESSE}/${RATGEBER_PFAD.m}/` },
};

function schritt(s: (typeof RATGEBER.schritte)[number], stimme: Stimme): string {
  const punkte = s.vor.map((p) => `<li><span>${esc(p.text)}</span> ${fund(p.fund)}</li>`).join('');
  const nochNicht = s.nochNicht
    ? `<p class="rg-nn"><b>Noch nicht:</b> ${esc(s.nochNicht.text)} ${fund(s.nochNicht.fund)}</p>`
    : '';
  return (
    `<section class="rg-step sec" aria-label="Schritt ${s.nr}"><div class="rg-sh">` +
    `<span class="vs-sn">${s.nr}</span><div><h2 class="vs-h2">${esc(s.titel[stimme])}</h2>` +
    `<p class="rg-wann">${esc(s.wann[stimme])}</p></div></div>` +
    `<p class="rg-vl">Vorgesehen</p><ul class="rg-vor">${punkte}</ul>${nochNicht}</section>`
  );
}

/** Die fertige Seite als HTML: für Mieter im Satz von DP36, für Vermieter wie bisher. */
export function ratgeberHtml(stimme: Stimme): string {
  return stimme === 'm' ? artikelHtml() : vermieterHtml();
}

/** Die Seite auf vermieter.hefta.de, im Stil der Vermieter-Seite. */
function vermieterHtml(): string {
  const stimme: Stimme = 'v';
  const s = RATGEBER.seiten.v;
  const ziel = ziele.v;
  const danach = 'danach' in s.kern ? ` ${esc(s.kern.danach)}` : '';
  const punkte = s.mehr.punkte
    .map(
      (p) =>
        `<li><b>${esc(p.titel)}</b> ${esc(p.text)}${'fund' in p && p.fund ? ` ${fund(p.fund)}` : ''}</li>`,
    )
    .join('');
  const nie = RATGEBER.nie
    .map(
      (n) => `<li><div><b>${esc(n.was)}</b><span>${esc(n.warum)}</span></div>${fund(n.fund)}</li>`,
    )
    .join('');
  const quellen = RATGEBER.quellen
    .map(
      (q) =>
        `<li><a class="vs-lk" href="${esc(q.url)}" rel="noreferrer">${esc(q.titel)}</a><span>${esc(q.wo)}</span></li>`,
    )
    .join('');
  const haupt =
    `<h1 class="vs-h1">${esc(s.h1)}</h1><p class="vs-lead">${esc(s.einleitung)}</p>` +
    `<section class="rg-kern sec"><p class="rg-k">${esc(s.kern.zitat)}</p>` +
    `<p class="vs-sub">${esc(s.kern.text)} ${fund(s.kern.fund)}${danach}</p></section>` +
    RATGEBER.schritte.map((x) => schritt(x, stimme)).join('') +
    `<section class="rg-nie sec" aria-label="${esc(RATGEBER.nieKopf.titel)}"><h2 class="vs-h2">${esc(RATGEBER.nieKopf.titel)}</h2>` +
    `<p class="vs-sub">${esc(RATGEBER.nieKopf.text)}</p><ul class="rg-nl">${nie}</ul></section>` +
    `<section class="rg-mehr sec"><h2 class="vs-h2">${esc(s.mehr.titel)}</h2><ul class="rg-tl">${punkte}</ul></section>` +
    `<section class="rg-loesch sec"><h2 class="vs-h2">${esc(s.loesch.titel)}</h2>` +
    `<p>${esc(s.loesch.text)} ${fund(s.loesch.fund)}</p><p class="vs-sub">${esc(s.loesch.unter)}</p></section>` +
    `<section class="rg-cta sec"><h2 class="vs-h2">${esc(s.cta.titel)}</h2><p>${esc(s.cta.text)}</p><div class="vs-akt">` +
    `<a class="vs-btn" href="${ziel[s.cta.knopf.ziel]}">${esc(s.cta.knopf.text)}</a>` +
    `<a class="vs-lk" href="${ziel[s.cta.link.ziel]}">${esc(s.cta.link.text)}</a></div></section>` +
    `<footer class="rg-fuss"><h2 class="vs-h3">${esc(RATGEBER.fuss.titel)}</h2><ul class="rg-q">${quellen}</ul>` +
    `<p class="vs-quelle">${esc(RATGEBER.fuss.satz)}</p><p class="vs-links">` +
    `<a class="vs-lk" href="${ziel.recht}">${esc(RATGEBER.fuss.recht)}</a>` +
    `<a class="vs-lk" href="${ziel[s.andere.ziel]}">${esc(s.andere.text)}</a></p></footer>`;
  return (
    `<!doctype html>\n<html lang="de"><head><meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}" />` +
    `<title>${esc(s.h1)} | ${APP_NAME}</title><meta name="description" content="${esc(s.beschreibung)}" />` +
    FAVICONS +
    `<link rel="stylesheet" href="/${RATGEBER_ORDNER}/ratgeber.css" /></head>` +
    `<body><div class="s"><header class="vs-top"><a class="vs-brand" href="/">` +
    `<img class="vs-logo" src="/${RATGEBER_ORDNER}/logo.svg" alt="" /><span>${esc(s.marke)}</span></a>` +
    `<span class="vs-tr"><a class="vs-lk" href="${ziel[s.kopfLink.ziel]}">${esc(s.kopfLink.text)}</a></span></header>` +
    `<main class="rg" data-voice="${stimme}">${haupt}</main></div></body></html>\n`
  );
}

// ── DP36: der Ratgeber auf hefta.de im Kleid der Landingpage ───────────────────────────────────────────────
// Kopf und Fuß wie auf „/“ (web/hefta2.html), Stile aus /seite.css und /ratgeber/artikel.css. Kein Skript:
// Die Reiter sind hier einfache Links, „Ratgeber“ ist der aufgeschlagene.

/** PC86 (E178, W13): Im Fuß steht das Logo mit 24 px statt Haus und „hefta“. */
const LOGO_FUSS =
  '<a class="zeichen logo-fuss" href="/" aria-label="Hefta, zur Startseite"><picture>' +
  '<source srcset="/icons/hefta-logo-dunkel.svg" media="(prefers-color-scheme: dark)">' +
  '<img src="/icons/hefta-logo.svg" alt="Hefta" width="74" height="24"></picture></a>';
/** PC85 (W35, DP63a): Im Kopf steht das Logo, hell und dunkel, 93 × 30; der Fuß behält das Zeichen. */
const LOGO_KOPF =
  '<a class="zeichen logo-kopf" href="/" aria-label="Hefta, zur Startseite"><picture>' +
  '<source srcset="/icons/hefta-logo-dunkel.svg" media="(prefers-color-scheme: dark)">' +
  '<img src="/icons/hefta-logo.svg" alt="Hefta" width="93" height="30"></picture></a>';
/** PC85: Favicon als SVG und als PNG für Safari, auf jeder Seite. */
const FAVICONS =
  `<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml" />` +
  `<link rel="icon" href="/icons/favicon-32.png" type="image/png" sizes="32x32" />` +
  `<link rel="icon" href="/icons/favicon-16.png" type="image/png" sizes="16x16" />`;
const PFEIL_ZURUECK =
  '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5 5.5 8 10 12.5"/></svg>';

/** Der Stapel aus DP34 (wie auf der Landingpage), hier höchstens 300 px breit und ganz nachgeladen. */
const STAPEL =
  '<figure class="mappe-stapel" aria-label="Beispiel einer Mappe: vorn das Deckblatt für die Lindenring 3, dahinter Selbstauskunft und Unterlagen">' +
  [4, 3, 2, 1]
    .map(
      (n) =>
        `<img class="ms-${n}" src="/mappe-seite-${n}.jpg" alt="" width="520" height="735" loading="lazy" decoding="async" />`,
    )
    .join('') +
  '</figure>';

/** Rahmen der Seiten unter /ratgeber/: Kopf mit Reitern, ein Blatt, Fuß wie auf der Landingpage. */
export function webRahmen(
  titel: string,
  beschreibung: string,
  haupt: string,
  // PC40: Datenschutz, Impressum und Rückmeldung tragen denselben Rahmen, ohne aufgeschlagenen Reiter.
  {
    reiter = 'rat',
    csp = CSP,
    kopf = '',
  }: { reiter?: 'rat' | null; csp?: string; kopf?: string } = {},
): string {
  const rat = reiter === 'rat' ? ' aria-current="page"' : '';
  return (
    `<!doctype html>\n<html lang="de"><head><meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
    `<meta http-equiv="Content-Security-Policy" content="${csp}" />` +
    `<meta name="color-scheme" content="light dark" />` +
    // Auftraggeber 15.11.: Das Banner von Safari mit dem App-Symbol steht auf jeder Seite, wie auf „/“.
    `<meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}" />` +
    `<title>${esc(titel)} | ${APP_NAME}</title>` +
    (beschreibung ? `<meta name="description" content="${esc(beschreibung)}" />` : '') +
    `<link rel="preload" href="/archivo.woff2" as="font" type="font/woff2" crossorigin />` +
    FAVICONS +
    `<link rel="stylesheet" href="/seite.css" />` +
    `<link rel="stylesheet" href="/${RATGEBER_ORDNER}/artikel.css" />${kopf}</head>` +
    `<body class="rg-seite${reiter ? '' : ' ohne-reiter'}"><a class="sprung" href="#inhalt">Zum Inhalt</a>` +
    `<header class="oben"><div class="innen">${LOGO_KOPF}<nav class="reiter" aria-label="Für wen">` +
    `<a href="/#mieter" class="r-mieter">Für Mieter</a><a href="/#vermieter" class="r-verm">Für Vermieter</a>` +
    `<a href="/#ratgeber" class="r-rat"${rat}>Ratgeber</a></nav></div></header>` +
    `<div class="rg-blatt"><div class="innen rg-wrap">${haupt}</div></div>` +
    `<footer class="fuss"><div class="innen">${LOGO_FUSS}<nav aria-label="Rechtliches und Kontakt">` +
    `<a href="/impressum/">Impressum</a><a href="/${DATENSCHUTZ_PFAD}/">Datenschutz</a>` +
    `<a href="/rueckmeldung/">Rückmeldung</a><a href="mailto:hallo@hefta.de">hallo@hefta.de</a></nav></div></footer>` +
    // Cloudflare würde die Mailadresse sonst hinter einem nachgeladenen Skript verstecken.
    `</body></html>\n`
  )
    .replace(/<body[^>]*>/, '$&<!--email_off-->')
    .replace('</body>', '<!--/email_off--></body>');
}

function artikelSchritt(s: (typeof RATGEBER.schritte)[number]): string {
  const punkte = s.vor.map((p) => `<li>${esc(p.text)} ${fund(p.fund)}</li>`).join('');
  const nochNicht = s.nochNicht
    ? `<p class="noch"><b>Noch nicht.</b> ${esc(s.nochNicht.text)} ${fund(s.nochNicht.fund)}</p>`
    : '';
  return (
    `<section class="rg-step" id="s${s.nr}" aria-labelledby="s${s.nr}-t">` +
    `<div class="schritt"><span class="nr">${s.nr}</span><h2 id="s${s.nr}-t">${esc(s.titel.m)}</h2></div>` +
    `<p class="unter">${esc(s.wann.m)}</p><p class="etikett">Vorgesehen</p>` +
    `<ul class="punkte">${punkte}</ul>${nochNicht}</section>`
  );
}

/** Der Beitrag für Mieter nach DP36 (satz/ratgeber-artikel.html, werkzeug/text.py). */
function artikelHtml(): string {
  const s = RATGEBER.seiten.m;
  return webRahmen(s.h1, s.beschreibung, artikelInhalt(false));
}

/** Wo der Beitrag auf „/“ als Blatt liegt (Auftraggeber 15.11.: Der Ratgeber ist keine eigene Seite). */
export const ARTIKEL_BLATT = RATGEBER_PFAD.m.split('/').pop()!;

/**
 * Inhalt des Beitrags: als eigene Seite (`main`, für Suchmaschinen und Links von außen) oder als Blatt auf „/“
 * (`article`, dort gibt es schon ein `main`).
 */
export function artikelInhalt(blatt: boolean): string {
  const s = RATGEBER.seiten.m;
  const ziel = ziele.m;
  const nie = RATGEBER.nie
    .map((n) => `<div><dt>${esc(n.was)}</dt><dd>${esc(n.warum)} ${fund(n.fund)}</dd></div>`)
    .join('');
  const mehr = s.mehr.punkte
    .map(
      (p) =>
        `<p><b>${esc(p.titel)}</b> ${esc(p.text)}${'fund' in p && p.fund ? ` ${fund(p.fund)}` : ''}</p>`,
    )
    .join('');
  const quellen = RATGEBER.quellen
    .map(
      (q) =>
        `<li><a class="link-satz" href="${esc(q.url)}" rel="noreferrer">${esc(q.titel)}</a><span class="wo">, ${esc(q.wo)}</span></li>`,
    )
    .join('');
  const links = s.mappe.links
    .map((l) => `<a class="link-satz" href="${ziel[l.ziel]}">${esc(l.text)}</a>`)
    .join(' ');
  const inhalt = [
    ...RATGEBER.schritte.map((x) => [`s${x.nr}`, `${x.nr}. ${x.titel.m}`]),
    ['kein', s.inhalt.kein],
    ['mehr', s.inhalt.mehr],
    ['absage', s.inhalt.absage],
    ['quellen', s.inhalt.quellen],
  ]
    .map(([id, text]) => `<a href="#${id}">${esc(text!)}</a>`)
    .join('');
  return (
    (blatt
      ? `<article class="rg-artikel" data-voice="m" aria-labelledby="rg-titel">`
      : `<main id="inhalt" class="rg-artikel" data-voice="m">`) +
    `<a class="zurueck" href="${blatt ? '' : '/'}#ratgeber">${PFEIL_ZURUECK}Ratgeber</a>` +
    `<p class="kicker">${esc(s.kicker)}</p><h1 id="rg-titel">${esc(s.h1)}</h1><p class="lead">${esc(s.einleitung)}</p>` +
    `<section class="rg-kern" aria-label="Kernsatz"><blockquote><p class="rg-k">${esc(s.kern.zitat)}</p>` +
    `<cite>${fundMitText('Einleitung', s.kern.quelle)}</cite></blockquote><p>${esc(s.kern.text)}</p></section>` +
    RATGEBER.schritte.map(artikelSchritt).join('') +
    `<h2 id="kein">${esc(RATGEBER.nieKopf.titel)}</h2><p>${esc(RATGEBER.nieKopf.text)}</p>` +
    `<dl class="kein rg-nl">${nie}</dl>` +
    `<h2 id="mehr">${esc(s.mehr.titel)}</h2><div class="mehr">${mehr}</div>` +
    `<h2 id="absage">${esc(s.loesch.titel)}</h2><div class="absage">` +
    `<p>${esc(s.loesch.text)} ${fund(s.loesch.fund)}</p><p>${esc(s.loesch.unter)}</p></div>` +
    `<h2 id="mappe">${esc(s.mappe.titel)}</h2><div class="mappe"><p>${esc(s.mappe.text)}</p>${STAPEL}` +
    `<a class="knopf" href="${ziel[s.mappe.knopf.ziel]}">${esc(s.mappe.knopf.text)}</a>` +
    `<p class="klein">${links}</p></div>` +
    `<h2 id="quellen">${esc(RATGEBER.fuss.titel)}</h2><ul class="quellen rg-q">${quellen}</ul>` +
    `<p class="klein">${esc(RATGEBER.fuss.satz)}</p>${blatt ? '</article>' : '</main>'}` +
    `<aside><nav class="toc" aria-label="Auf dieser Seite"><p>Auf dieser Seite</p>${inhalt}</nav></aside>`
  );
}

/** `/ratgeber/`: die Übersicht der Beiträge (E59, DP36). Heute einer; weitere kommen als Einträge dazu. */
export function ratgeberUebersichtHtml(): string {
  const m = RATGEBER.seiten.m;
  const beitraege = [
    { pfad: `/${RATGEBER_PFAD.m}/`, titel: m.h1, text: m.uebersicht.text, fund: m.uebersicht.fund },
  ];
  const liste = beitraege
    .map(
      (b) =>
        `<li><a href="${b.pfad}"><h2>${esc(b.titel)}</h2><p>${esc(b.text)}</p>` +
        `<span class="wo">${esc(b.fund)}</span></a></li>`,
    )
    .join('');
  return webRahmen(
    'Ratgeber',
    'Beiträge rund um die Bewerbung um eine Wohnung.',
    `<main id="inhalt" class="rg-artikel rg-uebersicht"><p class="kicker">Ratgeber</p><h1>Ratgeber</h1>` +
      `<p class="lead">Beiträge rund um die Bewerbung um eine Wohnung.</p><ul class="liste">${liste}</ul></main>`,
  );
}

/** Die Zahl der Rückmeldefragen als Wort („vier“), aus `FRAGE_REIHE` wie in der App (DP33, Fehler 5). */
function fragenZahlwort(): string {
  const de = JSON.parse(readFileSync(join(wurzel, 'src/i18n/de.json'), 'utf8')) as {
    zahlwoerter: string[];
  };
  return de.zahlwoerter[FRAGE_REIHE.length] ?? String(FRAGE_REIHE.length);
}

/** Die Datenschutzerklärung als eigene Seite: Sie läuft ohne App, und ihre Sprungmarken funktionieren. */
export const DATENSCHUTZ_PFAD = 'datenschutz';

/** Der Text des Generators, unverändert: Er steht als Datei im Repository, die Seite trägt ihn nur. */
export const datenschutzText = () =>
  readFileSync(join(wurzel, 'data/datenschutz.de.html'), 'utf8').replaceAll('\r\n', '\n');

export function datenschutzHtml(stimme: Stimme): string {
  const zusatz = JSON.parse(
    readFileSync(join(wurzel, 'data/datenschutz-zusatz.de.json'), 'utf8'),
  ) as {
    titel: string;
    einleitung: string;
    stand: string;
    abschnitte: { titel: string; text: string }[];
  };
  const block =
    `<section class="ds-zusatz" aria-label="${esc(zusatz.titel)}"><h2>${esc(zusatz.titel)}</h2>` +
    `<p>${esc(zusatz.einleitung)}</p><p class="ds-stand">${esc(zusatz.stand)}</p>` +
    zusatz.abschnitte
      // DP33, Fehler 5: Die Zahl der Fragen kommt aus derselben Quelle wie in der App.
      .map(
        (a) =>
          `<h3>${esc(a.titel)}</h3><p>${esc(a.text.replaceAll('{fragen}', fragenZahlwort()))}</p>`,
      )
      .join('') +
    '</section>';
  // Die Ergänzung steht zwischen Überschrift und Generatortext; dessen Wortlaut bleibt, wie er ist.
  const ende = datenschutzText().indexOf('</h1>') + '</h1>'.length;
  // PC81 B11 (QA13): Die Überschrift darf trennen. Ein weiches Trennzeichen ändert keinen Buchstaben; nicht jeder
  // Browser kennt die deutschen Trennregeln für „hyphens: auto“.
  const text = datenschutzText();
  const kopf = text
    .slice(0, ende)
    .replace('Datenschutzerklärung</h1>', 'Datenschutz&shy;erklärung</h1>');
  const haupt = kopf + block + text.slice(ende);
  // PC40: Auf hefta.de im Rahmen der Landingpage; auf vermieter.hefta.de bleibt der Rahmen der Vermieter-Seite.
  if (stimme === 'm')
    return webRahmen(
      'Datenschutzerklärung',
      '',
      `<main id="inhalt" class="rg-text ds">${haupt}</main>`,
      { reiter: null },
    );
  return (
    `<!doctype html>\n<html lang="de"><head><meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}" />` +
    `<title>Datenschutzerklärung | ${APP_NAME}</title>` +
    FAVICONS +
    `<link rel="stylesheet" href="/${RATGEBER_ORDNER}/ratgeber.css" /></head>` +
    `<body><div class="s"><header class="vs-top"><a class="vs-brand" href="/">` +
    `<img class="vs-logo" src="/${RATGEBER_ORDNER}/logo.svg" alt="" /><span>${APP_NAME}</span></a>` +
    `<span class="vs-tr"><a class="vs-lk" href="${ziele[stimme].recht}">Impressum</a></span></header>` +
    // Cloudflare verschleiert sonst die Mailadresse („Email Address Obfuscation“): Aus dem Text würde
    // „[email protected]“ mit einem nachgeladenen Skript. So bleibt er Zeichen für Zeichen, auch ohne JavaScript.
    `<!--email_off--><main class="ds">${haupt}</main><!--/email_off--></div></body></html>\n`
  );
}

/** Schreibt Seite und Zubehör in den fertigen Build. */
export function ratgeberSchreiben(ziel: string, stimme: Stimme): void {
  const ordner = join(ziel, RATGEBER_ORDNER);
  const seite = join(ziel, RATGEBER_PFAD[stimme]);
  mkdirSync(ordner, { recursive: true });
  mkdirSync(seite, { recursive: true });
  writeFileSync(join(seite, 'index.html'), ratgeberHtml(stimme));
  mkdirSync(join(ziel, DATENSCHUTZ_PFAD), { recursive: true });
  writeFileSync(join(ziel, DATENSCHUTZ_PFAD, 'index.html'), datenschutzHtml(stimme));
  const schriften = join(wurzel, 'node_modules/@fontsource-variable/archivo/files');
  cpSync(join(schriften, 'archivo-latin-wdth-normal.woff2'), join(ordner, 'latin.woff2'));
  cpSync(join(schriften, 'archivo-latin-ext-wdth-normal.woff2'), join(ordner, 'latin-ext.woff2'));
  cpSync(join(wurzel, 'design/logo/hefta-logo.svg'), join(ordner, 'logo.svg'));
  // DP36: Der Beitrag für Mieter trägt /seite.css der Landingpage und dazu diese Datei.
  if (stimme === 'm')
    cpSync(join(wurzel, 'build/ratgeber-artikel.css'), join(ordner, 'artikel.css'));
  writeFileSync(
    join(ordner, 'ratgeber.css'),
    readFileSync(join(wurzel, 'src/vermieter/vermieter.css'), 'utf8') +
      readFileSync(join(wurzel, 'build/ratgeber.css'), 'utf8'),
  );
}

const ohneTrennung = (t: string) => t.replaceAll('­', '').replaceAll(' ', ' ');
const flach = (html: string) =>
  ohneTrennung(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Text einer Quelle, so normalisiert, dass Zeilenumbrüche und Trennungen beim Vergleich nicht zählen. */
export const quelleNormal = (text: string) =>
  ohneTrennung(text)
    .replace(/-\s*\r?\n\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const ZUSCHREIBUNG =
  /Orientierungshilfe|Datenschutzkonferenz|Datenschutzbehörde|Musterbogen|Abschnitt|Einleitung|BGB|DSGVO|AGG/;
const RECHTSWORT =
  /unzulässig|nicht zulässig|\bdürfen\b|\bdarf\b|\bmüssen\b|\bmusst\b|kannst? nicht|nicht erforderlich|verlangen|verlangt werden/i;

/**
 * Die Regel, die das Risiko trägt (Entscheidung W): Sie gilt als Prüfung, nicht als Stil. RG1 Zuschreibung,
 * RG2 Stimme, RG3 gleicher Inhalt, RG4 keine Beträge, RG5 Fundstellen führen zur Quelle, RG6 Zitate wörtlich,
 * dazu der Satz „keine Rechtsberatung“ und kein Skript auf der Seite.
 */
/** `quellen` null: Die Texte der Quellen fehlen (öffentliches Repository), die Zitate prüft dann nur RG6 lokal. */
export function ratgeberBefunde(html: string, stimme: Stimme, quellen: string | null): string[] {
  const out: string[] = [];
  const main = /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? '';
  // Quellen und Fuß tragen keine Aussagen: bis dorthin wird geprüft (DP36: Quellen stehen im Beitrag).
  const ohneFuss = main.split(/<footer|<h2 id="quellen"/)[0]!;
  for (const [, , attr, inhalt] of ohneFuss.matchAll(/<(p|li|dd)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    if (attr!.includes('rg-k')) continue;
    const t = flach(inhalt!);
    if (RECHTSWORT.test(t) && !ZUSCHREIBUNG.test(t) && !inhalt!.includes('class="rg-f"'))
      out.push(`RG1-ohne-quelle: ${t.slice(0, 50)}`);
  }
  if (!/<section class="rg-kern[\s\S]*?class="rg-f"[\s\S]*?<\/section>/.test(main))
    out.push('RG1-kernsatz-ohne-fundstelle');
  const text = flach(main);
  const ohneZitate = text.replace(/„[^“]*“/g, '');
  // Mieter: „ihr“ (E66, Planung 13g). Falsch sind „du“ und „Sie“; ein großes „Ihr“ steht auch am Satzanfang
  // und nach einer Überschrift, darum zählt nur „Ihnen“ und „Sie“ mitten im Satz.
  const stimmeFalsch =
    stimme === 'm'
      ? (/\b(du|dich|dir|dein\w*)\b/i.exec(ohneZitate) ??
        /[^.!?:\n]\s(Sie|Ihnen)\b/.exec(ohneZitate))
      : /\b(du|dich|dir|dein\w*|euch|euer|eure\w*)\b/i.exec(ohneZitate);
  if (stimmeFalsch) out.push(`RG2-stimme: ${stimmeFalsch[0].trim()}`);
  const schritte = main.match(/class="[^"]*\brg-step\b/g)?.length ?? 0;
  if (schritte !== RATGEBER.schritte.length) out.push('RG3-schritte');
  const nie =
    /class="[^"]*\brg-nl\b[^"]*">([\s\S]*?)<\/(ul|dl)>/.exec(main)?.[1]?.match(/<(li|dt)>/g)
      ?.length ?? 0;
  if (nie !== RATGEBER.nie.length) out.push('RG3-liste');
  if (/€|\bEUR\b|\bEuro\b/.test(text) || /\b\d{1,3}(\.\d{3})*,\d{2}\b/.test(text))
    out.push('RG4-betrag');
  for (const [, url, wort] of main.matchAll(/class="rg-f" href="([^"]+)"[^>]*>([^<]*)</g))
    if (!url!.includes('datenschutzkonferenz-online.de')) out.push(`RG5-fundstelle: ${wort}`);
  if (!/class="[^"]*\brg-q\b/.test(main)) out.push('RG5-quellen');
  if (quellen !== null) {
    for (const [, zitat] of text.matchAll(/„([^“]+)“/g)) {
      const teile = zitat!
        .split('…')
        .map((t) => t.trim().replace(/[ ,.;:!]+$/, ''))
        .filter(Boolean);
      if (!teile.every((t) => quellen.includes(t))) out.push(`RG6-zitat: ${zitat!.slice(0, 60)}`);
    }
  }
  if (!text.includes('Ein Hinweis, keine Rechtsberatung')) out.push('RG-hinweis-fehlt');
  if (/<script|\son\w+=|\sstyle=/i.test(html)) out.push('RG-statisch');
  return out;
}
