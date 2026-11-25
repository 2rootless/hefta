import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from '@cantoo/pdf-lib';
import { hefteAnlegen } from './hefte-hilfen';
import { pdfMit, szenarioLaden } from './szenario-laden';

// E112, Bürgschaftserklärung (DP41 Abschnitt 6, Prüfkatalog E1 bis E10) und DP49 Punkt 5 (B1, B2): Die
// Erklärung gilt je Wohnung und ist freiwillig. Im Heft steht sie an der Bürgin; „Erklärung vorbereiten“
// führt zum Formular, das PDF hat zwei Blätter, ein Scan von Blatt 1 kommt für dieses Heft zur Bürgin.

const ALT = new Date(Date.now() - 2 * 3600_000).toISOString();
const leer = {
  beworben: null,
  gefragtAm: null,
  termin: null,
  ergebnis: null,
  loeschbitteAm: null,
  nachgefasstAm: null,
  abgelegtAm: null,
};
const heft = (id: string, adresse: string) => ({
  id,
  createdAt: ALT,
  updatedAt: ALT,
  haushaltId: null,
  adresse,
  link: null,
  quelle: '',
  inseratText: null,
  kennung: `k-${id}`,
  ereignisse: { ...leer },
  notiz: '',
  einzug: '2027-01-01',
  angaben: { titel: null, stadtteil: null, warm: null, anbieter: 'Hausverwaltung Beispiel GmbH' },
});

const PETRA = 'p-02-neustart-2';

async function mitHeften(page: Page, szenario = '02-neustart', pfad = '/heft/h8') {
  await szenarioLaden(page, szenario, '/wohnungen');
  await hefteAnlegen(page, [
    heft('h8', 'Lindenring 8\n20259 Hamburg'),
    heft('h3', 'Lindenring 3\n20259 Hamburg'),
  ]);
  await page.goto('/__leer');
  await page.goto(`/#${pfad}`);
  await page.locator('main h1').first().waitFor();
}

const mappeImHeft = (page: Page) => page.locator('section.heft-mappe');

/** Versionen der Bürgschaftserklärung in der Datenbank, mit ihrem Heft. */
function erklaerungen(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ heftId: string | null }[]>((fertig) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const tx = r.result.transaction(['dokumente', 'versionen'], 'readonly');
          const aus: { heftId: string | null }[] = [];
          tx.objectStore('dokumente').getAll().onsuccess = (e) => {
            const ids = new Set(
              ((e.target as IDBRequest).result as { id: string; typ: string }[])
                .filter((d) => d.typ === 'buergschaftserklaerung')
                .map((d) => d.id),
            );
            tx.objectStore('versionen').getAll().onsuccess = (v) => {
              for (const x of (v.target as IDBRequest).result as {
                dokumentId: string;
                heftId?: string;
              }[])
                if (ids.has(x.dokumentId)) aus.push({ heftId: x.heftId ?? null });
            };
          };
          tx.oncomplete = () => {
            r.result.close();
            fertig(aus);
          };
        };
      }),
  );
}

test('B1: Im Heft steht der Hinweis an der Bürgin, ruhig; „Erklärung vorbereiten“ führt zum Formular (E2)', async ({
  page,
}) => {
  await mitHeften(page);
  const mappe = mappeImHeft(page);
  await expect(
    mappe.getByRole('heading', { name: 'In der Mappe für diese Wohnung' }),
  ).toBeVisible();
  const petra = mappe.locator('li.buerge');
  await expect(petra.getByText(/^Bürgin\. /)).toBeVisible();
  await expect(
    petra.getByText('Ohne Bürgschaftserklärung für diese Wohnung.', { exact: false }),
  ).toBeVisible();
  // Gegenprobe B1: nur an der Bürgin, nirgends sonst auf der Seite, und nicht in Rot (W5).
  await expect(page.getByText('Ohne Bürgschaftserklärung', { exact: false })).toHaveCount(1);
  const farbe = await petra.locator('.erklaerung p').evaluate((e) => getComputedStyle(e).color);
  const akzent = await page.evaluate(() => {
    const p = document.createElement('p');
    p.style.color = 'var(--accent-text)';
    document.body.append(p);
    const c = getComputedStyle(p).color;
    p.remove();
    return c;
  });
  expect(farbe).not.toBe(akzent);
  // Max und Lea ohne Hinweis.
  await expect(mappe.locator('li:not(.buerge) .erklaerung')).toHaveCount(0);

  await petra.getByRole('link', { name: 'Erklärung vorbereiten' }).click();
  await expect(page).toHaveURL(new RegExp(`#/buergschaft/${PETRA}/h8$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Bürgschafts.?erklärung/);
  await expect(page.getByText('Petra unterschreibt es von Hand', { exact: false })).toBeVisible();
  // Aus dem Heft: Bürgin, Mieter, Wohnung, Vermieter, Einzug.
  await expect(page.getByLabel('Name').first()).toHaveValue('Petra Mustermann');
  await expect(page.locator('.mieter li')).toHaveText([
    /Max .*Im Mietvertrag/,
    /Lea .*Im Mietvertrag/,
  ]);
  await expect(page.getByLabel('Anschrift und Lage')).toHaveValue('Lindenring 8, 20259 Hamburg');
  await expect(page.getByLabel('Name').nth(1)).toHaveValue('Hausverwaltung Beispiel GmbH');
  await expect(page.getByLabel('Einzug zum')).toHaveValue('2027-01-01');
  // Offen: Anschrift der Bürgin, Anschrift des Vermieters, Höchstbetrag, Art.
  await expect(page.getByRole('button', { name: /^PDF erstellen/ })).toContainText('4 offen');
  // Keine Art ist vorgewählt.
  await expect(page.getByRole('radio', { checked: true, name: /bürgschaft/i })).toHaveCount(0);
});

test('E3: Ohne Höchstbetrag und Art zwei Fehler mit Warnzeichen, kein PDF; E4 und E9: danach zwei Blätter, Scan für dieses Heft', async ({
  page,
}) => {
  await mitHeften(page, '02-neustart', `/buergschaft/${PETRA}/h8`);
  const vorher = await erklaerungen(page);
  await page.getByRole('button', { name: /^PDF erstellen/ }).click();
  await expect(page.getByText('Ohne Höchstbetrag erstellt Hefta kein PDF.')).toBeVisible();
  await expect(page.getByText('Bitte eine Art wählen.')).toBeVisible();
  await expect(page.locator('.fehler .warnzeichen')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Im PDF' })).toHaveCount(0);
  // Der Fokus springt zum ersten fehlenden Feld.
  await expect(page.locator('.betrag-feld input')).toBeFocused();

  await page.locator('.betrag-feld input').fill('3600');
  await page.getByRole('radio', { name: /^Ausfallbürgschaft/ }).click();
  await expect(page.getByText('Ohne Höchstbetrag', { exact: false })).toHaveCount(0);
  await page.getByLabel('Anschrift').first().fill('Musterweg 7, 12345 Musterstadt');
  await page
    .getByLabel('Anschrift', { exact: true })
    .nth(1)
    .fill('Beispielstraße 1, 12345 Musterstadt');
  // E4: Alles da, der Knopf zählt nichts mehr.
  const knopf = page.getByRole('button', { name: /^PDF erstellen/ });
  await expect(knopf).not.toContainText('offen');
  await knopf.click();

  await expect(page.getByRole('heading', { name: 'Im PDF' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Blatt 1: Erklärung')).toBeVisible();
  await expect(page.getByText('Blatt 2: Für Petra')).toBeVisible();
  await expect(
    page.getByText('Was sie verspricht. Bleibt bei ihr, nicht in der Mappe.'),
  ).toBeVisible();
  // E9: Hefta legt das PDF nicht selbst ab, schon gar nicht Blatt 2.
  expect(await erklaerungen(page)).toEqual(vorher);

  // Das PDF selbst: zwei Seiten, Blatt 1 mit Betrag und Art.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Drucken oder teilen' }).click();
  const datei = await download;
  const bytes = readFileSync((await datei.path())!);
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  expect(datei.suggestedFilename()).toBe('Buergschaftserklaerung_Petra-Mustermann.pdf');

  // „Unterschriebenes Blatt hinzufügen“: Die Seite der Unterlage öffnet die Auswahl gleich.
  await page.getByRole('button', { name: /^Unterschriebenes Blatt hinzufügen/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/unterlage/${PETRA}/buergschaftserklaerung$`));
  await page.locator('[data-feld="pdf"]').setInputFiles({
    name: 'scan.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit(['Bürgschaftserklärung für ein Mietverhältnis\nunterschrieben']),
  });
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect.poll(() => erklaerungen(page)).toEqual([{ heftId: 'h8' }]);

  // Im Heft h8 ist sie da; Gegenprobe: Im Heft h3 fehlt sie weiter.
  await page.goto('/#/heft/h8');
  await expect(
    mappeImHeft(page).getByText(/^Bürgschaftserklärung für diese Wohnung, vom /),
  ).toBeVisible();
  await page.goto('/#/heft/h3');
  await expect(
    mappeImHeft(page).getByText('Ohne Bürgschaftserklärung für diese Wohnung.', { exact: false }),
  ).toBeVisible();
});

test('B2: Auf der Personenseite „Je Wohnung, freiwillig“, nicht in „x von y“ und nicht auf der Haarlinie', async ({
  page,
}) => {
  await mitHeften(page, '02-neustart', `/person/${PETRA}`);
  await expect(page.getByRole('heading', { name: 'Je Wohnung, freiwillig' })).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: /Bürgschafts.?erklärung.*Lindenring 3: noch keine\. Lindenring 8: noch keine\./,
    }),
  ).toBeVisible();
  const linie = page.getByRole('list', { name: 'Stand der Unterlagen' });
  await expect(linie.getByRole('listitem', { name: /Bürgschaft/ })).toHaveCount(0);
  await expect(page.locator('.zahl')).toHaveText(/^0 von 3 da$/);
});

test('Erklärung von vor DP49 (ohne Wohnung): im Heft genannt und mit „Erklärung vorbereiten“', async ({
  page,
}) => {
  await mitHeften(page, '01-standard', '/heft/h8');
  const petra = mappeImHeft(page).locator('li.buerge');
  await expect(
    petra.getByText(/^Bürgschaftserklärung vom .+, für keine bestimmte Wohnung$/),
  ).toBeVisible();
  await expect(petra.getByRole('link', { name: 'Erklärung vorbereiten' })).toBeVisible();
});

test('E1: ohne Heft alles leer, „6 offen“, „+ Weitere Person“; E10: 320 px bei 130 %, dunkel, kein Überlauf', async ({
  page,
}) => {
  await mitHeften(page, '02-neustart', '/buergschaft');
  await expect(
    page.getByText('Der Bürge unterschreibt es von Hand', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^PDF erstellen/ })).toContainText('6 offen');
  await page.getByRole('button', { name: 'Weitere Person' }).click();
  await expect(page.getByLabel('Mieter 2')).toBeVisible();

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 246, height: 437 });
  const ueberlauf = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  expect(await ueberlauf()).toBe(0);
  await page.locator('.betrag-feld input').fill('2400');
  await page.getByRole('radio', { name: /^Selbstschuldnerische/ }).click();
  await page.getByRole('button', { name: /^PDF erstellen/ }).click();
  await expect(page.getByRole('heading', { name: 'Im PDF' })).toBeVisible({ timeout: 20_000 });
  expect(await ueberlauf()).toBe(0);
  // Ohne Person gibt es kein „Danach“: Der Scan hätte keine Person.
  await expect(page.getByRole('heading', { name: 'Danach' })).toHaveCount(0);
  await expect(page.getByText('Blatt 2: Für die Person, die bürgt')).toBeVisible();
});
