import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { pruefen } from './pruef-c';
import {
  FALSCH,
  KAPUTT,
  LANG,
  M1,
  M2,
  M3,
  M4,
  M4z,
  M5,
  M6,
  M7,
  pdf,
  type Datei,
  type Probe,
} from './vermieter-hilfe';

// Prüfkatalog der Vermieter-Seite (design/vermieter-seite.md, VS1 bis VS14, dazu C1 bis C26) mit den
// Kontaktbögen aus dem Produkt. Die Ansichten stammen aus design/werkzeug/vs_pruef.py.
test.use({ baseURL: 'http://localhost:4174', trace: 'off' });
test.skip(({ browserName }) => browserName !== 'chromium', 'Die Bögen entstehen in Chromium');

let grossPfad = '';

interface Ansicht {
  id: string;
  breite: number;
  hoehe: number;
  zoom?: number;
  grau?: boolean;
}
const BREIT: Ansicht[] = [
  { id: '1280', breite: 1280, hoehe: 860 },
  { id: '1024', breite: 1024, hoehe: 768 },
  { id: '1280-grau', breite: 1280, hoehe: 860, grau: true },
];
const SCHMAL: Ansicht[] = [
  { id: '390', breite: 390, hoehe: 844 },
  { id: '430', breite: 430, hoehe: 932 },
  { id: '320-text130', breite: 320, hoehe: 568, zoom: 1.3 },
  { id: '390-text130', breite: 390, hoehe: 844, zoom: 1.3 },
  { id: '390-grau', breite: 390, hoehe: 844, grau: true },
];

interface Bild {
  id: string;
  mappen?: Probe[];
  nummer?: number;
  fehler?: boolean;
  hash?: string;
  ziehen?: boolean;
}
const DREI = [M1, M2, M3];
const FUENF = [M1, M2, M3, M5, M7];
const BILDER_BREIT: Bild[] = [
  { id: 'VS1-leer' },
  { id: 'VS1b-ziehen', ziehen: true },
  { id: 'VS2-drei-mappen', mappen: DREI, nummer: 1 },
  { id: 'VS3-mappe-offen-allein', mappen: DREI, nummer: 2 },
  { id: 'VS3b-datensparsam', mappen: [M1, M2, M3, M4], nummer: 4 },
  { id: 'VS3c-lange-namen', mappen: [M1, LANG, M6], nummer: 2 },
  { id: 'VS3d-ohne-selbstauskunft', mappen: [M1, LANG, M6], nummer: 3 },
  { id: 'VS4-ohne-lesehilfe', mappen: DREI, nummer: 3 },
  { id: 'VS5-fehler', mappen: FUENF, nummer: 4, fehler: true },
  { id: 'VS5b-passt-nicht', mappen: FUENF, nummer: 5 },
  { id: 'VS7-schritte', mappen: DREI, hash: '#/schritte' },
  { id: 'VS8-rechtliches', mappen: DREI, hash: '#/rechtliches' },
  { id: 'VS9-anfordern', mappen: DREI, hash: '#/mappe/1/anfordern' },
  { id: 'VS9b-anfordern-allein', mappen: DREI, hash: '#/mappe/2/anfordern' },
  { id: 'VS9c-anfordern-datensparsam', mappen: [M1, M2, M3, M4], hash: '#/mappe/4/anfordern' },
  { id: 'VS9d-anfordern-lange-namen', mappen: [M1, LANG, M6], hash: '#/mappe/2/anfordern' },
  { id: 'VS9e-anfordern-ohne-selbstauskunft', mappen: [M1, LANG, M6], hash: '#/mappe/3/anfordern' },
  { id: 'VS9f-anfordern-fuer-vertrag', mappen: [M1, M2, M3, M4z], hash: '#/mappe/4/anfordern' },
];
const BILDER_SCHMAL: Bild[] = [
  { id: 'VS6a-leer' },
  { id: 'VS6b-liste', mappen: DREI },
  { id: 'VS6c-mappe', mappen: DREI, nummer: 1 },
  { id: 'VS6d-allein', mappen: DREI, nummer: 2 },
  { id: 'VS6e-ohne-lesehilfe', mappen: DREI, nummer: 3 },
  { id: 'VS6f-fehler', mappen: FUENF, fehler: true },
  { id: 'VS6g-lange-namen', mappen: [M1, LANG, M6], nummer: 2 },
  { id: 'VS6h-datensparsam', mappen: [M1, M2, M3, M4], nummer: 4 },
  { id: 'VS6i-schritte', mappen: DREI, hash: '#/schritte' },
  { id: 'VS6j-anfordern', mappen: DREI, hash: '#/mappe/1/anfordern' },
  { id: 'VS6k-anfordern-lange-namen', mappen: [M1, LANG, M6], hash: '#/mappe/2/anfordern' },
  { id: 'VS6l-rechtliches', hash: '#/rechtliches' },
];

/** VS1 bis VS14, wie VS_JS in design/werkzeug/vs_pruef.py, mit Knöpfen statt Links in der Mappe. */
function vsPruefen(): string[] {
  const out: string[] = [];
  const s = document.querySelector<HTMLElement>('.s')!;
  const ohne = (e: Element) => (e as HTMLElement).innerText.replace(/­/g, '');
  const T = ohne(s);
  document
    .querySelectorAll('.s select, .s [aria-sort], .s [role=search], .s input[type=search]')
    .forEach((e) => out.push('VS1-bedienung:' + e.tagName));
  document.querySelectorAll('.s a, .s button').forEach((e) => {
    if (/sortier|ordnen nach|filter|suchen|rangliste|bewerten/i.test(e.textContent ?? ''))
      out.push('VS1-knopf:' + e.textContent!.trim().slice(0, 20));
  });
  [...document.querySelectorAll('.vs-nr')].forEach((e, i) => {
    if (Number(e.textContent) !== i + 1) out.push('VS1-reihenfolge');
  });
  if (/€|\bEUR\b|\bEuro\b|\bnetto\b|\bbrutto\b/i.test(T.replace('Nettoeinkommen', '')))
    out.push('VS2-betrag');
  if (/\b\d{1,3}(\.\d{3})*,\d{2}\b/.test(T) || /Einkommen\w*\s*:\s*\d/.test(T))
    out.push('VS2-einkommen-zahl');
  const du = T.match(/\b(du|dich|dir|dein\w*|euch|euer|eure\w*|ihr seid)\b/i);
  if (du) out.push('VS3-du:' + du[0]);
  const imp = T.match(
    /(^|[.!?\n]\s*)(Öffne|Zieh|Lad|Wähl|Schick|Prüf|Lösch|Bitte lösch)\b(?![a-zäöüß])/m,
  );
  if (imp) out.push('VS3-imperativ:' + imp[2]);
  document
    .querySelectorAll('.s textarea, .s input:not([type=file]), .s [contenteditable]')
    .forEach((e) => out.push('VS4-eingabe:' + e.tagName));
  // VS15 (design/nachforderung.md): die Mail. Sie ist keine Mappe, darum gelten VS5 und VS8 dort nicht.
  document.querySelectorAll<HTMLElement>('.vs-anf').forEach((d) => {
    const mail = d.querySelector<HTMLElement>('.vs-mt')!.innerText;
    const fragen = mail.includes('drei Fragen des Musterbogens');
    if (fragen === (d.dataset.ziel === 'zusage')) out.push('VS15-fragen');
    const fehlt = mail.indexOf('brauchen wir noch');
    if (fehlt >= 0 && mail.indexOf('entschieden') > fehlt) out.push('VS15-zusage');
    const ohne15 = mail
      .replace(/Nicht nötig sind[^\n]*/, '')
      .replace('nicht die Datenkopie nach Art. 15 DSGVO', '');
    if (/Ausweis|Datenkopie|Mietschuldenfreiheit/.test(ohne15)) out.push('VS15-nicht-noetig');
    const namen = [...mail.matchAll(/^– Von (.*?): /gm)].flatMap(([, n]) => n!.split(/, | und /));
    if (namen.length !== Number(d.dataset.posten)) out.push('VS15-posten');
    if (!mail.trimEnd().endsWith('[Ihr Name]')) out.push('VS15-absender');
    if (!/Ein Hinweis, keine Rechtsberatung/.test(ohne(d))) out.push('VS15-hinweis');
  });
  document.querySelectorAll('.vs-detail:not(.vs-wann):not(.vs-anf)').forEach((d) => {
    const l = d.querySelector('.vs-loesch');
    if (!l || !/Datenschutzkonferenz/.test(ohne(l))) out.push('VS5-loeschhinweis');
    if (![...d.querySelectorAll('a, button')].some((a) => a.textContent?.trim() === 'Mappe öffnen'))
      out.push('VS8-mappe-oeffnen');
    if (d.querySelector('.vs-was') && !/Hefta prüft sie nicht/.test(ohne(d)))
      out.push('VS7-herkunft');
  });
  document.querySelectorAll('.s *:not(input)').forEach((e) => {
    if (getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1)
      out.push('VS6-gekuerzt:' + e.textContent!.trim().slice(0, 20));
  });
  document.querySelectorAll<HTMLElement>('.vs-st').forEach((e) => {
    if (!e.innerText.trim()) out.push('VS9-stand-ohne-text');
    if (!e.classList.contains('vs-st-ohne') && e.querySelector('svg')) out.push('VS13-zeichen');
    if (/\balles\b|vollständig|fehlt/i.test(ohne(e))) out.push('VS13-wort:' + ohne(e).slice(0, 20));
  });
  document.querySelectorAll('.vs-pruef').forEach((e) => {
    const q = e.querySelector('.vs-quelle');
    if (!q || !/Stand/.test(ohne(q))) out.push('VS10-quelle');
  });
  document.querySelectorAll('.vs-dx').forEach((e) => {
    if (!/üblich/.test(ohne(e))) out.push('VS11-ohne-schritt');
  });
  document.querySelectorAll('.vs-nd').forEach((e) => {
    const l = e.closest('.vs-g')?.querySelector('.vs-gl');
    if (!l || !/Entscheidung/.test(ohne(l))) out.push('VS11-ohne-schritt');
  });
  document.querySelectorAll<HTMLElement>('.vs-detail[data-ziel]').forEach((d) => {
    if (d.dataset.ziel !== 'zusage')
      d.querySelectorAll('.vs-dx').forEach((e) => {
        if (/vor dem Vertrag/.test(ohne(e))) out.push('VS14-vertrag-als-luecke');
      });
  });
  document.querySelectorAll<HTMLElement>('.vs-st, .vs-cnt').forEach((e) => {
    if (/(^|\s)([2-9]|1[0-2]) (übliche|Mappen|Unterlagen)/.test(e.innerText))
      out.push('VS12-ziffer:' + e.innerText.trim().slice(0, 20));
  });
  // Eigene Zusätze: keine Du-Formen ist VS3; hier die Sätze, die die Prüfung beseitigt hat.
  if (
    /Verlangen dürfen|können Sie nicht verlangen|Nichts geht an Hefta|Quellcode ist offen/.test(T)
  )
    out.push('VS-text');
  return out;
}

async function aufbauen(page: Page, b: Bild, grossPfad: string) {
  await page.goto('about:blank');
  await page.goto('/');
  await page.locator('h1').first().waitFor({ state: 'attached' });
  await page.evaluate(() => document.fonts.ready);
  if (b.mappen?.length) {
    const dateien: Datei[] = [];
    for (const m of b.mappen) dateien.push(await pdf(m));
    await page.locator('input[type=file]').setInputFiles(dateien as never);
    await expect(page.locator('.vs-row')).toHaveCount(b.mappen.length, { timeout: 60_000 });
    await expect(page.locator('.vs-liest')).toHaveCount(0);
  }
  if (b.fehler) {
    await page
      .locator('input[type=file]')
      .setInputFiles([
        FALSCH,
        KAPUTT,
        await pdf({ datei: 'Mappe_Schulz.pdf', seiten: 2, passwort: 'geheim' }),
        { ...(await pdf(M1)), name: 'Bewerbung_Mustermann (1).pdf' },
      ] as never);
    await expect(page.locator('.vs-err li')).toHaveCount(4, { timeout: 30_000 });
    await page.locator('input[type=file]').setInputFiles(grossPfad);
    await expect(page.locator('.vs-err li')).toHaveCount(5, { timeout: 30_000 });
  }
  if (b.nummer) await page.evaluate((n) => (window.location.hash = `#/mappe/${n}`), b.nummer);
  if (b.hash) await page.evaluate((h) => (window.location.hash = h), b.hash);
  if (b.ziehen) {
    const dt = await page.evaluateHandle(() => {
      const d = new DataTransfer();
      for (const n of ['a.pdf', 'b.pdf', 'c.pdf']) d.items.add(new File(['x'], n));
      return d;
    });
    await page.dispatchEvent('body', 'dragover', { dataTransfer: dt });
  }
  await page.waitForTimeout(120);
}

for (const [gruppe, ansichten, bilder] of [
  ['breit', BREIT, BILDER_BREIT],
  ['schmal', SCHMAL, BILDER_SCHMAL],
] as const) {
  for (const ansicht of ansichten) {
    test(`Vermieter-Seite ${gruppe} ${ansicht.id}`, async ({ page }, info) => {
      test.setTimeout(420_000);
      // 101 MB für den Fall „zu groß“: nur einmal je Worker, nicht je Ansicht.
      if (!grossPfad) {
        grossPfad = info.outputPath('Scans_komplett.pdf');
        writeFileSync(
          grossPfad,
          Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(101 * 1024 * 1024)]),
        );
      }
      await page.setViewportSize({ width: ansicht.breite, height: ansicht.hoehe });
      const konsole: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') konsole.push(m.text());
      });
      page.on('pageerror', (e) => konsole.push(e.message));
      const befunde: Record<string, unknown> = {};
      const png: { id: string; bild: string }[] = [];
      for (const b of bilder) {
        konsole.length = 0;
        await aufbauen(page, b, grossPfad);
        if (ansicht.zoom) {
          await page.evaluate(
            (z) => document.documentElement.style.setProperty('zoom', String(z)),
            ansicht.zoom,
          );
          await page.waitForTimeout(100);
        }
        if (ansicht.grau) {
          await page.evaluate(() =>
            document.documentElement.style.setProperty('filter', 'grayscale(1)'),
          );
        }
        const r = (await page.evaluate(pruefen)) as Record<string, unknown>;
        const fehler = Object.fromEntries(
          Object.entries(r).filter(
            ([k, v]) => k !== 'hoehe' && (Array.isArray(v) ? v.length : !!v),
          ),
        );
        const vs = await page.evaluate(vsPruefen);
        if (vs.length) fehler.vs = vs;
        if (konsole.length) fehler.konsole = konsole.map((z) => z.slice(0, 160));
        if (Object.keys(fehler).length) befunde[b.id] = fehler;
        png.push({
          id: b.id,
          bild: (await page.screenshot({ fullPage: true })).toString('base64'),
        });
      }
      const kontext = await page.context().browser()!.newContext({ deviceScaleFactor: 1 });
      const bogen = await kontext.newPage();
      await bogen.setViewportSize({ width: 1400, height: 800 });
      const breite = ansicht.breite > 900 ? 620 : ansicht.breite;
      await bogen.setContent(
        `<body style="margin:0;background:#c9ccd6;display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;padding:24px;font:13px sans-serif">` +
          png
            .map(
              (p) =>
                `<figure style="margin:0"><figcaption style="padding:6px 0">${p.id}</figcaption><img style="display:block;width:${breite}px" src="data:image/png;base64,${p.bild}"></figure>`,
            )
            .join('') +
          '</body>',
      );
      await bogen.waitForLoadState('load');
      await bogen.screenshot({
        path: `docs/screenshots/bogen-VS-${ansicht.id}.png`,
        fullPage: true,
      });
      await kontext.close();
      expect(befunde).toEqual({});
    });
  }
}
