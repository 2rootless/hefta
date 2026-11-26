import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from '@cantoo/pdf-lib';
import { hefteAnlegen } from './hefte-hilfen';
import { pdfMit, szenarioLaden } from './szenario-laden';

// E112, Bürgschaftserklärung (DP41 Abschnitt 6, Prüfkatalog E1 bis E10) und DP49 Punkt 5 (B1, B2): Die
// Erklärung gilt je Wohnung und ist freiwillig. Im Heft steht sie an der Person, die bürgt; „Erklärung vorbereiten“
// führt zu den vier Teilen (W63), das PDF hat zwei Blätter, ein Scan von Blatt 1 kommt für dieses Heft zu ihr.

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

/** W63: einen Teil der Bürgschaft öffnen (zugeklappt: die Zeile antippen). */
async function teil(page: Page, name: string) {
  await page.locator('.akkordeon.formblatt > .teil').first().waitFor();
  const zu = page.locator('button.teil.zu', { hasText: name });
  if (await zu.count()) await zu.click();
  await expect(page.locator('section.teil.offen h3')).toContainText(name);
}

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
  // PC202 (H1, E363): „Bürgt.“ statt „Bürgin.“
  await expect(petra.getByText(/^Bürgt\. /)).toBeVisible();
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
  await expect(
    page.getByText('Petra unterschreibt die Erklärung von Hand', { exact: false }),
  ).toBeVisible();
  // W63 (U11): Gespeichert wird sofort, mit demselben Satz wie in der Selbstauskunft; zurück geht es zum Heft (W39).
  await expect(
    page.getByText('Änderungen werden sofort gespeichert.', { exact: false }),
  ).toBeVisible();
  await expect(page.locator('.kopf a.zurueck')).toHaveText(/Heft/);
  await expect(page.getByRole('link', { name: 'Abbrechen' })).toHaveCount(0);
  // U1: vier Teile auf dem Formblatt, wie die Selbstauskunft.
  await expect(page.locator('.akkordeon.formblatt > .teil')).toHaveCount(4);

  // Aus dem Heft: Name aus dem Haushalt (U7), Mieter, Wohnung in drei Feldern (W60), Vermieter, Einzug.
  await teil(page, 'Wer bürgt');
  await expect(page.locator('.name-zeile')).toContainText('Petra Mustermann');
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0);
  await teil(page, 'Für wen und Vermieter');
  await expect(page.locator('.mieter li')).toHaveText([
    /Max .*Im Mietvertrag/,
    /Lea .*Im Mietvertrag/,
  ]);
  await expect(page.getByLabel('Vermieter', { exact: true })).toHaveValue(
    'Hausverwaltung Beispiel GmbH',
  );
  await teil(page, 'Wohnung und Mietvertrag');
  await expect(page.getByLabel('Straße und Hausnummer')).toHaveValue('Lindenring 8');
  await expect(page.getByLabel('PLZ')).toHaveValue('20259');
  await expect(page.getByLabel('Ort', { exact: true })).toHaveValue('Hamburg');
  await expect(page.getByLabel('Einzug zum')).toHaveValue('2027-01-01');
  // U5: Was fehlt, steht als „Es fehlt noch: …“ mit Namen, kein Zähler, kein „Pflicht“.
  await teil(page, 'Höchstbetrag und Art');
  await expect(page.locator('.leiste')).toContainText(
    /Es fehlt noch: Höchstbetrag und Art.der.Bürgschaft\./,
  );
  await expect(page.locator('main')).not.toContainText('Pflicht');
  await expect(page.locator('.leiste')).not.toContainText('offen');
  // Keine Art ist vorgewählt.
  await expect(page.getByRole('radio', { checked: true, name: /bürgschaft/i })).toHaveCount(0);
});

test('W63: sofort gespeichert, „Fertig“ zurück zum Heft; E4 und E9: zwei Blätter, Scan für dieses Heft', async ({
  page,
}) => {
  await mitHeften(page);
  await mappeImHeft(page)
    .locator('li.buerge')
    .getByRole('link', { name: 'Erklärung vorbereiten' })
    .click();
  const vorher = await erklaerungen(page);
  await teil(page, 'Höchstbetrag und Art');
  // Der blasse Knopf führt ins erste fehlende Feld.
  await page.getByRole('button', { name: /^Fertig/ }).click({ force: true });
  await expect(page.locator('[data-feld="hoechstbetrag"]')).toBeFocused();
  await page.locator('[data-feld="hoechstbetrag"]').fill('3600');
  await expect(page.locator('.leiste')).toContainText(/Es fehlt noch: Art.der.Bürgschaft\./);
  await page.getByRole('radio', { name: /^Gewöhnliche Bürgschaft/ }).click();
  await expect(page.locator('.leiste')).not.toContainText('Es fehlt noch');
  await expect(page.getByText('Fertig, 2 Blätter')).toBeVisible();

  // „Fertig“ führt zurück ins Heft; die Angaben sind gespeichert und beim nächsten Öffnen wieder da (U11).
  await page.getByRole('button', { name: /^Fertig/ }).click();
  await expect(page).toHaveURL(/#\/heft\/h8$/);
  await mappeImHeft(page)
    .locator('li.buerge')
    .getByRole('link', { name: 'Erklärung vorbereiten' })
    .click();
  await expect(page.locator('button.teil.zu', { hasText: 'Höchstbetrag und Art' })).toContainText(
    '3.600 Euro, Gewöhnliche Bürgschaft',
  );
  // Gegenprobe: im anderen Heft nichts davon.
  await page.goto(`/#/buergschaft/${PETRA}/h3`);
  await teil(page, 'Höchstbetrag und Art');
  await expect(page.locator('[data-feld="hoechstbetrag"]')).toHaveValue('');
  await page.goto(`/#/buergschaft/${PETRA}/h8`);
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

test('E1 (seit E385): ohne Heft die Bürgschaft der App für eine Person ohne Haushalt; „Für wen“ von Hand; E10: 320 px bei 130 %, dunkel, kein Überlauf', async ({
  page,
}) => {
  await mitHeften(page, '02-neustart', '/buergschaft');
  // W63 (DP135, U11): im Browser zurück zum Ratgeber.
  await expect(page.getByRole('link', { name: 'Ratgeber' })).toHaveAttribute('href', '/ratgeber/');
  await page.getByRole('textbox', { name: 'Vorname' }).fill('Hiltrud');
  await page.getByRole('textbox', { name: 'Nachname' }).fill('Ostendorp');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page).toHaveURL(/#\/buergschaft\/[\w-]+$/);
  await expect(page.locator('main')).not.toContainText('Pflicht');
  await page
    .getByRole('button', { name: /^Für wen/ })
    .first()
    .click();
  await page.getByRole('button', { name: '+ Weitere Person' }).click();
  await expect(page.getByRole('textbox', { name: 'Im Mietvertrag: Person 2' })).toBeVisible();
  // W30: Der Satz „Alle, die in den Mietvertrag gehen.“ ist an das erste Feld gebunden; Gegenprobe: der Betrag nicht.
  const satzVon = (feld: ReturnType<typeof page.getByLabel>) =>
    feld.evaluate((e) =>
      (e.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .join(' '),
    );
  const fuerWen = 'Alle, die in den Mietvertrag gehen.';
  expect(await satzVon(page.getByRole('textbox', { name: 'Im Mietvertrag: Person 1' }))).toBe(
    fuerWen,
  );
  await page
    .getByRole('button', { name: /^Höchstbetrag/ })
    .first()
    .click();
  expect(await satzVon(page.locator('[data-feld="hoechstbetrag"]'))).not.toBe(fuerWen);

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 246, height: 437 });
  const ueberlauf = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  expect(await ueberlauf()).toBe(0);
  await page.locator('[data-feld="hoechstbetrag"]').fill('2400');
  await page.getByRole('radio', { name: /^Selbstschuldnerische/ }).click();
  // Sofort gespeichert, in der Datenbank wie alles andere (auch im Backup).
  await page.waitForTimeout(600);
  await page.reload();
  await page
    .getByRole('button', { name: /^Höchstbetrag/ })
    .first()
    .click();
  await expect(page.locator('[data-feld="hoechstbetrag"]')).toHaveValue('2.400');
  expect(await ueberlauf()).toBe(0);
});
