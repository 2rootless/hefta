import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { szenarioLaden } from './szenario-laden';
import { M1, pdf } from './vermieter-hilfe';

// wunsch-W57 (PC198, E363, E366): Es gibt keinen „Hauptmieter“ und keinen „Mitmieter“ mehr, weder in der App noch in
// der Mappe noch auf der Vermieterseite. Sichtbar sind nur „Im Mietvertrag“, „Bürgt“ und „Ansprechperson“. Eine Mappe
// aus 2.0 oder 2.1 (Lesehilfe Fassung 1) wird weiter richtig gelesen. Jede Prüfung hat eine Gegenprobe.

const ALT = /hauptmiet|mitmiet/i;
const funde = (text: string) => [
  ...new Set((text.match(/\S*(hauptmiet|mitmiet)\S*/gi) ?? []).map((w) => w)),
];

async function sichtbar(page: Page) {
  return page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => (d.open = true));
    return (
      document.body.innerText +
      ' ' +
      [...document.querySelectorAll('[aria-label],[alt],[title]')]
        .map(
          (e) =>
            `${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('alt') ?? ''} ${e.getAttribute('title') ?? ''}`,
        )
        .join(' ')
    );
  });
}

test('wunsch-W57, App: kein „Hauptmieter“, kein „Mitmieter“ auf den Seiten zu Haushalt und Personen', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Texte genügen in Chromium');
  const seiten = [
    '/',
    '/haushalt',
    '/person/p-01-standard-0',
    '/person/p-01-standard-1',
    '/person/p-01-standard-2',
    '/person-aendern/p-01-standard-0/person',
    '/person-aendern/p-01-standard-1/person',
    '/selbstauskunft/p-01-standard-0',
    '/selbstauskunft/p-01-standard-2',
    '/rutsch',
    '/einstellungen',
  ];
  const gefunden: string[] = [];
  await szenarioLaden(page, '01-standard', '/');
  for (const s of seiten) {
    await page.goto(`/#${s}`);
    await page.locator('main h1, main h2').first().waitFor();
    for (const w of funde(await sichtbar(page))) gefunden.push(`${s}: ${w}`);
  }
  expect(gefunden).toEqual([]);
  // Gegenprobe: ein altes Rollenwort auf der Seite fällt auf.
  await page.evaluate(() => {
    const p = document.createElement('p');
    p.textContent = 'Max, Hauptmieter';
    document.querySelector('main')!.append(p);
  });
  expect(funde(await sichtbar(page))).toEqual(['Hauptmieter']);
});

async function mappeText(page: Page, ziel: string) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF ansehen' }).click(),
  ]);
  await download.saveAs(ziel);
  const daten = new Uint8Array(readFileSync(ziel));
  const dok = await pdfjs.getDocument({ data: daten.slice(), verbosity: 0 }).promise;
  const seiten: string[] = [];
  for (let n = 1; n <= dok.numPages; n++)
    seiten.push(
      (await (await dok.getPage(n)).getTextContent()).items
        .map((i) => ('str' in i ? i.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        // Name und „, bürgt“ sind zwei Textstücke der Kopfzeile.
        .replace(/ ,/g, ','),
    );
  const anhaenge = (await dok.getAttachments()) as Record<string, { content: Uint8Array }> | null;
  const lesehilfe = anhaenge?.['hefta.json']
    ? (JSON.parse(new TextDecoder().decode(anhaenge['hefta.json'].content)) as {
        hefta: number;
        haushalt: { personen: { name: string; rolle: string; ansprech?: true; kontakt?: true }[] };
      })
    : null;
  return { seiten, lesehilfe };
}

test('wunsch-W57, Mappe: Deckblatt, Kopfzeilen und Lesehilfe ohne Rollenwort; die Ansprechperson zuerst', async ({
  page,
  browserName,
}, info) => {
  test.skip(browserName !== 'chromium', 'Die Mappe entsteht in beiden Browsern gleich');
  test.setTimeout(180_000);
  await szenarioLaden(page, '01-standard', '/mappe');
  await expect(page.getByRole('button', { name: 'PDF ansehen' })).toBeEnabled({ timeout: 60_000 });
  const { seiten, lesehilfe } = await mappeText(page, info.outputPath('mappe.pdf'));
  const ganz = seiten.join(' ');
  expect(funde(ganz)).toEqual([]);
  // Deckblatt: „Im Mietvertrag“ und „Bürgt“ als Überschriften; Kopfzeile der Bürgin „…, bürgt“.
  expect(seiten[0]).toContain('Im Mietvertrag');
  expect(seiten[0]).toContain('Bürgt');
  // Kopfzeile der Bürgin „Petra Mustermann, bürgt“; im Vertrag nur der Name.
  expect(seiten.slice(1).some((s) => s.includes('Petra Mustermann, bürgt'))).toBe(true);
  expect(seiten.slice(1).some((s) => /Max Mustermann,/.test(s))).toBe(false);
  // Kontakt auf dem Deckblatt ist die Ansprechperson (Max, die erste im Vertrag).
  const kontakt = seiten[0]!.split('Kontakt')[1] ?? '';
  expect(kontakt.trimStart().startsWith('Max Mustermann')).toBe(true);
  // Ohne Heft gibt es keine Kennung und darum keine Lesehilfe; Fassung 2 prüft src/pdf/anhang.test.ts.
  if (lesehilfe) {
    expect(lesehilfe.hefta).toBe(2);
    expect(lesehilfe.haushalt.personen.some((p) => 'kontakt' in p)).toBe(false);
  }
  // Gegenprobe: das Deckblatt einer Mappe aus 2.0 (Designs echte Mappe, DP78) nennt „Hauptmieter“.
  const alt = await pdfjs.getDocument({
    data: new Uint8Array(readFileSync('tests/fixtures/stress/SE1-2-0-alt.pdf')),
    verbosity: 0,
  }).promise;
  const altText = (await (await alt.getPage(1)).getTextContent()).items
    .map((i) => ('str' in i ? i.str : ''))
    .join(' ');
  expect(ALT.test(altText)).toBe(true);
});

test.describe('wunsch-W57, Vermieterseite', () => {
  test.use({ baseURL: 'http://localhost:4174', viewport: { width: 1280, height: 860 } });

  test('eine Mappe aus 2.1 (Fassung 1, mit „Hauptmieter“ auf dem Papier) wird gelesen und ohne „Hauptmieter“ gezeigt', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Lesen genügt in Chromium');
    const datei = await pdf(M1);
    // Gegenprobe: Auf dem Papier der alten Mappe steht das alte Rollenwort.
    const papier = await pdfjs.getDocument({ data: new Uint8Array(datei.buffer), verbosity: 0 })
      .promise;
    const seite1 = (await (await papier.getPage(1)).getTextContent()).items
      .map((i) => ('str' in i ? i.str : ''))
      .join(' ');
    expect(ALT.test(seite1)).toBe(true);
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles([datei]);
    await expect(page.getByRole('status')).toHaveCount(0, { timeout: 60_000 });
    // Die Lesehilfe wird gezeigt (sie passt zur Mappe), mit „Im Mietvertrag“, ohne „Hauptmieter“.
    await expect(page.locator('.vs-was').first()).toBeVisible({ timeout: 30_000 });
    const text = await sichtbar(page);
    expect(text).toContain('Im Mietvertrag');
    expect(funde(text)).toEqual([]);
  });
});
