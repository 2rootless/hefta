import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_NAME } from '../src/app/name.ts';
import { FRAGE_REIHE, FRAGEN } from '../src/rueckmeldung/fragen.ts';
import { webRahmen } from './ratgeber.ts';

// Die Seite hefta.de/rueckmeldung/ (E54, B19 Fassung 2 und 5): nur noch für Links von außen, etwa aus
// einer Mail. Hefta selbst fragt im Fenster. Beim Bau aus src/i18n/de.json erzeugt, im Stil der
// Vermieterseite. Das Skript liegt als eigene Datei daneben (CSP ohne Inline-Skript) und sendet nur
// {f, a} an /api/rueckmeldung, nach dem Tipp auf „Abschicken“.

const wurzel = join(import.meta.dirname, '..');
export const RUECKMELDUNG_PFAD = 'rueckmeldung';

type Baum = { [k: string]: string | Baum };
const de = JSON.parse(readFileSync(join(wurzel, 'src/i18n/de.json'), 'utf8')) as Baum;
const rm = de.rueckmeldung as Baum;
const suchen = (pfad: string) =>
  pfad.split('.').reduce<string | Baum | undefined>((k, s) => (k as Baum | undefined)?.[s], rm);
const text = (pfad: string): string => {
  // Release 2.0: Die Fragen, „aus“ und „deine“ liegen in der App unter `rueckmeldung.*` (du/ihr-Paare), nicht
  // unter `rueckmeldung.seite.*`. Fehlt der Schlüssel unter `seite.`, gilt derselbe eine Ebene höher.
  let wert = suchen(pfad) ?? (pfad.startsWith('seite.') ? suchen(pfad.slice(6)) : undefined);
  if (wert === undefined) throw new Error(`Text fehlt: rueckmeldung.${pfad}`);
  // Paar „ihr“/„du“ (B28b): Die Seite spricht wie die übrige Website mit „ihr“ an (DP32).
  if (typeof wert === 'object' && 'ihr' in wert) wert = wert.ihr!;
  return (wert as string).replaceAll('{app}', APP_NAME);
};
const esc = (t: string) =>
  t.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

/** Dieselbe Adresse wie im Impressum (src/app/impressum.ts liest sie dort aus). */
const ADRESSE = /mailto:([^"?]+)/.exec(
  readFileSync(join(wurzel, 'data/impressum.de.html'), 'utf8'),
)![1]!;

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/**
 * DP32, Abschnitt 4: „{Zahl} kurze Fragen“, die Zahl als Wort aus derselben Quelle wie in der App
 * (`FRAGE_REIHE`). Die Seite spricht wie die übrige Website mit „ihr“ an.
 */
function kurzeFragen(): string {
  const n = FRAGE_REIHE.length;
  const wort = (de.zahlwoerter as unknown as string[])[n] ?? String(n);
  return text('seite.kurzeFragen').replace('{Zahl}', wort.charAt(0).toUpperCase() + wort.slice(1));
}

export function rueckmeldungHtml(): string {
  const mail = `mailto:${ADRESSE}?subject=${encodeURIComponent(text('betreffAnderes'))}`;
  const fragen = FRAGE_REIHE.map((f) => {
    const optionen = (FRAGEN[f] as readonly string[])
      .map(
        (a) =>
          `<label class="rm-a"><input type="radio" name="${f}" value="${a}" />` +
          `<span>${esc(text(`antworten.${f}.${a}`))}</span></label>`,
      )
      .join('');
    const anders =
      f === 'fehlt'
        ? `<a class="link-satz rm-mail" href="${esc(mail)}">${esc(text('seite.anderes'))}</a>`
        : '';
    return (
      `<fieldset class="rm-q" data-frage="${f}"><legend>${esc(text(`seite.fragen.${f}`))}</legend>` +
      `${optionen}${anders}</fieldset>`
    );
  }).join('');
  // PC40: im Rahmen der Landingpage (Kopf und Fuß), ohne aufgeschlagenen Reiter. Das Skript bleibt eine Datei
  // daneben, die Seite bleibt für Suchmaschinen gesperrt.
  return webRahmen(
    text('seite.titel'),
    '',
    `<main id="inhalt" class="rg-text rm"><form id="rm" novalidate><h1 id="rm-titel">${esc(kurzeFragen())}</h1>` +
      `${fragen}<p class="klein">${esc(text('seite.satz'))}</p>` +
      `<p class="rm-aus klein" role="status" hidden>${esc(text('seite.aus'))}</p>` +
      `<button class="knopf" type="submit" disabled>${esc(text('abschicken'))}</button></form>` +
      `<section id="rm-danke" hidden><h1 tabindex="-1">${esc(text('danke'))}</h1>` +
      `<p class="rm-deine"></p><p class="rm-links"><button class="link-satz rm-aendern" type="button">${esc(text('aendern'))}</button>` +
      `<a class="link-satz" href="/">${esc(text('seite.zurueck'))}</a></p></section>` +
      `<p class="klein"><a class="link-satz" href="/datenschutz/">${esc(text('seite.recht'))}</a></p></main>`,
    {
      reiter: null,
      csp: CSP,
      kopf:
        `<meta name="robots" content="noindex" />` +
        `<link rel="stylesheet" href="/${RUECKMELDUNG_PFAD}/rueckmeldung.css" />` +
        `<script type="module" src="/${RUECKMELDUNG_PFAD}/rueckmeldung.js"></script>`,
    },
  );
}

/** Das Skript der Seite: Vorwahl aus ?f=…&a=…, Abschicken, Danke, ohne Netz. */
export function rueckmeldungJs(): string {
  const woerter = {
    deine: text('seite.deine'),
    deineMehr: text('seite.deineMehr'),
    antworten: Object.fromEntries(
      FRAGE_REIHE.map((f) => [
        f,
        Object.fromEntries(
          (FRAGEN[f] as readonly string[]).map((a) => [a, text(`antworten.${f}.${a}`)]),
        ),
      ]),
    ),
  };
  return `// Erzeugt von build/rueckmeldungSeite.ts. Sendet nur {f, a}, nur nach „Abschicken“.
const W = ${JSON.stringify(woerter)};
const form = document.getElementById('rm');
const knopf = form.querySelector('button[type=submit]');
const aus = form.querySelector('.rm-aus');
const danke = document.getElementById('rm-danke');
const q = new URLSearchParams(location.search);
const vor = q.get('f');
if (vor && Object.hasOwn(W.antworten, vor)) {
  // Mit Vorwahl: nur diese Frage, die Antwort gewählt und änderbar.
  form.querySelectorAll('.rm-q').forEach((e) => (e.hidden = e.dataset.frage !== vor));
  form.querySelector('#rm-titel').hidden = true;
  const a = q.get('a') || '';
  for (const feld of form.querySelectorAll('input[name="' + vor + '"]')) if (feld.value === a) feld.checked = true;
}
const gewaehlt = () =>
  [...form.querySelectorAll('.rm-q:not([hidden]) input:checked')].map((e) => ({ f: e.name, a: e.value }));
const pruefen = () => (knopf.disabled = gewaehlt().length === 0);
form.addEventListener('change', pruefen);
pruefen();
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const liste = gewaehlt();
  if (!liste.length) return;
  knopf.disabled = true;
  aus.hidden = true;
  try {
    for (const x of liste) {
      const r = await fetch('/api/rueckmeldung', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(x),
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
      if (!r.ok) throw new Error(String(r.status));
    }
  } catch {
    aus.hidden = false;
    knopf.disabled = false;
    return;
  }
  const namen = liste.map((x) => W.antworten[x.f][x.a]);
  danke.querySelector('.rm-deine').textContent =
    (namen.length > 1 ? W.deineMehr : W.deine) + ' ' + namen.join(', ');
  form.hidden = true;
  danke.hidden = false;
  danke.querySelector('h1').focus();
});
danke.querySelector('.rm-aendern').addEventListener('click', () => {
  danke.hidden = true;
  form.hidden = false;
  pruefen();
});
`;
}

const STIL = `.rm-q{border:0;margin:0;padding:0}.rm-q legend{padding:0;margin-bottom:10px}
.rm-a{display:flex;align-items:center;gap:12px;min-height:54px;border-top:1px solid currentColor;border-top-color:var(--linie, rgb(0 0 0 / 0.12));cursor:pointer}
.rm-a input{flex:none;width:22px;height:22px;margin:0}
.rm-mail{display:inline-flex;align-items:center;min-height:44px;margin-top:8px}.rm-links{display:flex;flex-wrap:wrap;gap:4px 24px;margin-top:12px}
.rm .knopf{margin-top:20px;border:0;font:inherit;cursor:pointer}.rm .knopf:disabled{opacity:.45;cursor:default}
.rm-aendern{background:none;border:0;padding:0;font:inherit;cursor:pointer;min-height:44px}
`;

export function rueckmeldungSchreiben(ziel: string): void {
  const ordner = join(ziel, RUECKMELDUNG_PFAD);
  mkdirSync(ordner, { recursive: true });
  writeFileSync(join(ordner, 'index.html'), rueckmeldungHtml());
  writeFileSync(join(ordner, 'rueckmeldung.js'), rueckmeldungJs());
  writeFileSync(join(ordner, 'rueckmeldung.css'), STIL);
}
