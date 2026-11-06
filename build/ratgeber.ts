import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ADRESSE, APP_NAME, VERMIETER_ADRESSE } from '../src/app/name.ts';
import { fundstelle, mitName, RATGEBER, type Stimme } from '../src/domain/ratgeber.ts';

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

const ziele: Record<Stimme, Record<string, string>> = {
  m: {
    start: '/',
    recht: '/#/einstellungen/rechtliches',
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

/** Die fertige Seite als HTML. */
export function ratgeberHtml(stimme: Stimme): string {
  const s = RATGEBER.seiten[stimme];
  const ziel = ziele[stimme];
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
    `<meta name="robots" content="noindex, nofollow" />` +
    `<title>${esc(s.h1)} | ${APP_NAME}</title><meta name="description" content="${esc(s.beschreibung)}" />` +
    `<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml" />` +
    `<link rel="stylesheet" href="/${RATGEBER_ORDNER}/ratgeber.css" /></head>` +
    `<body><div class="s"><header class="vs-top"><a class="vs-brand" href="/">` +
    `<img class="vs-logo" src="/${RATGEBER_ORDNER}/logo.svg" alt="" /><span>${esc(s.marke)}</span></a>` +
    `<span class="vs-tr"><a class="vs-lk" href="${ziel[s.kopfLink.ziel]}">${esc(s.kopfLink.text)}</a></span></header>` +
    `<main class="rg" data-voice="${stimme}">${haupt}</main></div></body></html>\n`
  );
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
    zusatz.abschnitte.map((a) => `<h3>${esc(a.titel)}</h3><p>${esc(a.text)}</p>`).join('') +
    '</section>';
  // Die Ergänzung steht zwischen Überschrift und Generatortext; dessen Wortlaut bleibt, wie er ist.
  const ende = datenschutzText().indexOf('</h1>') + '</h1>'.length;
  const text = datenschutzText();
  const haupt = text.slice(0, ende) + block + text.slice(ende);
  return (
    `<!doctype html>\n<html lang="de"><head><meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}" />` +
    `<meta name="robots" content="noindex, nofollow" />` +
    `<title>Datenschutzerklärung | ${APP_NAME}</title>` +
    `<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml" />` +
    `<link rel="stylesheet" href="/${RATGEBER_ORDNER}/ratgeber.css" /></head>` +
    `<body><div class="s"><header class="vs-top"><a class="vs-brand" href="/">` +
    `<img class="vs-logo" src="/${RATGEBER_ORDNER}/logo.svg" alt="" /><span>${APP_NAME}</span></a>` +
    `<span class="vs-tr"><a class="vs-lk" href="${ziele[stimme].recht}">Impressum</a></span></header>` +
    `<main class="ds">${haupt}</main></div></body></html>\n`
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
  const ohneFuss = main.split('<footer')[0]!;
  for (const [, , attr, inhalt] of ohneFuss.matchAll(/<(p|li)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    if (attr!.includes('rg-k')) continue;
    const t = flach(inhalt!);
    if (RECHTSWORT.test(t) && !ZUSCHREIBUNG.test(t) && !inhalt!.includes('class="rg-f"'))
      out.push(`RG1-ohne-quelle: ${t.slice(0, 50)}`);
  }
  if (!/<section class="rg-kern[\s\S]*?class="rg-f"[\s\S]*?<\/section>/.test(main))
    out.push('RG1-kernsatz-ohne-fundstelle');
  const text = flach(main);
  const ohneZitate = text.replace(/„[^“]*“/g, '');
  const stimmeFalsch =
    stimme === 'm'
      ? /[^.!?:\n]\s(Sie|Ihnen|Ihre?[rsmn]?)\b/.exec(ohneZitate)
      : /\b(du|dich|dir|dein\w*|euch|euer|eure\w*)\b/i.exec(ohneZitate);
  if (stimmeFalsch) out.push(`RG2-stimme: ${stimmeFalsch[0].trim()}`);
  const schritte = main.match(/class="rg-step/g)?.length ?? 0;
  if (schritte !== RATGEBER.schritte.length) out.push('RG3-schritte');
  const nie = /<ul class="rg-nl">([\s\S]*?)<\/ul>/.exec(main)?.[1]?.match(/<li>/g)?.length ?? 0;
  if (nie !== RATGEBER.nie.length) out.push('RG3-liste');
  if (/€|\bEUR\b|\bEuro\b/.test(text) || /\b\d{1,3}(\.\d{3})*,\d{2}\b/.test(text))
    out.push('RG4-betrag');
  for (const [, url, wort] of main.matchAll(/class="rg-f" href="([^"]+)"[^>]*>([^<]*)</g))
    if (!url!.includes('datenschutzkonferenz-online.de')) out.push(`RG5-fundstelle: ${wort}`);
  if (!main.includes('class="rg-q"')) out.push('RG5-quellen');
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
