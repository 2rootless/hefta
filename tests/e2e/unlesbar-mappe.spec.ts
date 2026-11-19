import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { expect, test, type Page } from '@playwright/test';
import { hefteAnlegen } from './hefte-hilfen';
import { cspMelden } from './hilfen';
import { szenarioLaden } from './szenario-laden';
import { HEUTE } from './szenarien';

// PC126 K5 mit Designs Ablauf (PC127, DP83 a): Lässt sich eine Datei der Mappe nicht öffnen, steht das in einem Blatt
// über der Seite, bevor etwas hinausgeht: bei „Als PDF teilen“, „PDF ansehen“ und „Mappe laden und Mail öffnen“.
// „Datei austauschen“ öffnet die Unterlage mit der markierten Datei, „Diesmal weglassen“ baut die Mappe ohne die
// ganze Unterlage, die Auswahl wird „Eigene Auswahl“, und der Satz der Mail folgt ihr. Nur Musterdaten (W7).

const MAX = 'p-04-fertig-0';
const TITEL = /^Eine Datei in „Gehaltsnachweise, .+“ von Max kann Hefta nicht öffnen\.$/;
const SATZ = 'Tauscht die Datei aus oder lasst die Unterlage diesmal weg.';

/** Legt statt der ersten Datei von Max’ Gehaltsnachweisen die angegebenen Bytes ab (am Hinzufügen vorbei). */
async function dateiErsetzen(page: Page, bytes: number[]) {
  await page.evaluate(
    async ({ person, bytes }) => {
      const db = await new Promise<IDBDatabase>((ok) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => ok(r.result);
      });
      const alle = <T>(ort: string) =>
        new Promise<T[]>((ok) => {
          const r = db.transaction(ort).objectStore(ort).getAll();
          r.onsuccess = () => ok(r.result as T[]);
        });
      const dok = (await alle<{ id: string; personId: string; typ: string }>('dokumente')).find(
        (d) => d.personId === person && d.typ === 'gehaltsnachweis',
      )!;
      const version = (await alle<{ dokumentId: string; original: string }>('versionen')).find(
        (v) => v.dokumentId === dok.id,
      )!;
      const daten = new Uint8Array(bytes);
      const tx = db.transaction('dateien', 'readwrite');
      tx.objectStore('dateien').put({
        id: version.original,
        createdAt: new Date().toISOString(),
        typ: 'application/pdf',
        groesse: daten.length,
        daten: daten.buffer,
      });
      await new Promise((ok) => (tx.oncomplete = ok));
      db.close();
    },
    { person: MAX, bytes },
  );
}

const KAPUTT = [...new TextEncoder().encode('%PDF-1.7\nkaputt, kein PDF mehr\n')];

/** PC132 (DP84): Alle Dateien sind leer, wie in Designs Lauf für DP82. */
async function alleLeeren(page: Page) {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok) => {
      const r = indexedDB.open('hefta');
      r.onsuccess = () => ok(r.result);
    });
    const tx = db.transaction('dateien', 'readwrite');
    const ort = tx.objectStore('dateien');
    const alle = await new Promise<{ id: string }[]>((ok) => {
      const r = ort.getAll();
      r.onsuccess = () => ok(r.result as { id: string }[]);
    });
    for (const d of alle) ort.put({ ...d, groesse: 0, daten: new ArrayBuffer(0) });
    await new Promise((ok) => (tx.oncomplete = ok));
    db.close();
  });
}

async function mitPasswort(): Promise<number[]> {
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText('Gehalt', { x: 60, y: 700, size: 18, font: schrift });
  doc.encrypt({ userPassword: 'geheim', ownerPassword: 'geheim-x' });
  return [...(await doc.save())];
}

async function mappeOeffnen(page: Page, bytes: number[]) {
  await szenarioLaden(page, '04-fertig', '/wohnungen');
  await dateiErsetzen(page, bytes);
  await page.goto('/#/mappe');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Mappe teilen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PDF ansehen' })).toBeVisible({ timeout: 30_000 });
}

function teilenZaehlen(page: Page) {
  return page.addInitScript(() => {
    const w = window as unknown as { __geteilt: number };
    w.__geteilt = 0;
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', {
      value: async () => {
        w.__geteilt++;
      },
    });
  });
}
const geteilt = (page: Page) =>
  page.evaluate(() => (window as unknown as { __geteilt: number }).__geteilt);

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
  await page.clock.setFixedTime(HEUTE);
});

test('K5 „Als PDF teilen“ und „PDF ansehen“: erst das Blatt; „Diesmal weglassen“ gibt „Eigene Auswahl“', async ({
  page,
}) => {
  await teilenZaehlen(page);
  let geladen = 0;
  page.on('download', () => geladen++);
  await mappeOeffnen(page, KAPUTT);

  // „Als PDF teilen“: das Blatt, nichts geteilt.
  await page.getByRole('button', { name: 'Als PDF teilen' }).click();
  const blatt = page.getByRole('dialog', { name: TITEL });
  await expect(blatt).toBeVisible();
  await expect(blatt.getByText(SATZ)).toBeVisible();
  await expect(blatt.getByRole('link', { name: 'Datei austauschen' })).toBeVisible();
  expect(await geteilt(page)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(blatt).toBeHidden();

  // „PDF ansehen“: dasselbe Blatt, keine Datei geladen.
  await page.getByRole('button', { name: 'PDF ansehen' }).click();
  await expect(blatt).toBeVisible();
  expect(geladen).toBe(0);

  // „Diesmal weglassen“: ohne die ganze Unterlage, Auswahl „Eigene Auswahl“. PC132 (DP84 U4): Danach geht es mit
  // „PDF ansehen“ gleich weiter, ohne zweiten Tipp (im Browser wird die Mappe geladen); dann geht auch das Teilen.
  await blatt.getByRole('button', { name: 'Diesmal weglassen' }).click();
  await expect(blatt).toBeHidden();
  await expect(page.getByRole('button', { name: /^Eigene Auswahl, gewählt/ })).toBeVisible();
  await expect.poll(() => geladen, { timeout: 30_000 }).toBe(1);
  await expect(page.getByRole('dialog', { name: TITEL })).toHaveCount(0);
  await page.getByRole('button', { name: 'Als PDF teilen' }).click();
  await expect.poll(() => geteilt(page)).toBe(1);
  await expect(page.getByRole('dialog', { name: TITEL })).toHaveCount(0);
});

test('K5 „Datei austauschen“ öffnet die Unterlage mit markierter Datei; im Überblick der Vermerk', async ({
  page,
}) => {
  await teilenZaehlen(page);
  await mappeOeffnen(page, KAPUTT);
  await page.getByRole('button', { name: 'Als PDF teilen' }).click();
  await page
    .getByRole('dialog', { name: TITEL })
    .getByRole('link', { name: 'Datei austauschen' })
    .click();
  await expect(page).toHaveURL(new RegExp(`#/unterlage/${MAX}/gehaltsnachweis$`));
  await expect(page.getByText('Diese Datei kann Hefta nicht öffnen.')).toHaveCount(1);

  // Überblick im Tab „Mappe“: an Max’ Gehaltsnachweisen der Vermerk statt „da“, auch nach einem Neuladen
  // (PC132, DP84 U6).
  await page.evaluate(() => (window.location.hash = '#/'));
  await page.reload();
  const zeile = page.getByRole('link', { name: /^Gehaltsnachweise/ }).first();
  await expect(zeile).toContainText('eine Datei lässt sich nicht öffnen');
  expect(await geteilt(page)).toBe(0);
});

test('K5 PDF mit Passwort am Hinzufügen vorbei: auch dann hält das Blatt die Mappe an', async ({
  page,
}) => {
  await teilenZaehlen(page);
  await mappeOeffnen(page, await mitPasswort());
  await page.getByRole('button', { name: 'Als PDF teilen' }).click();
  await expect(page.getByRole('dialog', { name: TITEL })).toBeVisible();
  expect(await geteilt(page)).toBe(0);
});

test('K5 „Mappe laden und Mail öffnen“: erst das Blatt, keine Mail; nach dem Weglassen folgt der Satz', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined });
    (window as unknown as { __heftaMailTest: (l: string) => void }).__heftaMailTest = (l) => {
      (window as unknown as { __mailLink: string }).__mailLink = l;
    };
  });
  let geladen = 0;
  page.on('download', () => geladen++);
  await szenarioLaden(page, '04-fertig', '/wohnungen');
  await dateiErsetzen(page, KAPUTT);
  await hefteAnlegen(page, [
    {
      id: 'k5',
      createdAt: '2026-11-03T10:00:00.000Z',
      updatedAt: '2026-11-03T10:00:00.000Z',
      haushaltId: null,
      adresse: 'Musterweg 7\n00100 Musterstadt',
      link: 'https://www.example.org/wohnung/7',
      quelle: '',
      inseratText: 'Mail an vermietung@example.com',
      kennung: 'k-k5',
      ereignisse: {
        beworben: null,
        gefragtAm: null,
        termin: null,
        ergebnis: null,
        loeschbitteAm: null,
        nachgefasstAm: null,
        abgelegtAm: null,
      },
      notiz: '',
      angaben: { titel: null, stadtteil: null, warm: null, zimmer: null, flaeche: null },
    },
  ]);
  await page.goto('/#/wohnungen');
  await page.reload();
  await page.evaluate(() => (window.location.hash = '#/heft/k5'));
  await page.getByRole('link', { name: 'Jetzt bewerben' }).click();
  await page.getByRole('button', { name: 'Mail', exact: true }).click();
  await expect(
    page.getByText(/Unsere Mappe mit den üblichen Unterlagen liegt bei\./),
  ).toBeVisible();

  const knopf = page.getByRole('button', { name: 'Mappe laden und Mail öffnen' });
  await knopf.click();
  const blatt = page.getByRole('dialog', { name: TITEL });
  await expect(blatt).toBeVisible({ timeout: 30_000 });
  await expect(blatt.getByText(SATZ)).toBeVisible();
  expect(geladen).toBe(0);
  expect(
    await page.evaluate(() => (window as unknown as { __mailLink?: string }).__mailLink ?? ''),
  ).toBe('');

  // PC132 (DP84 U4, U5): „Diesmal weglassen“ macht gleich weiter: Mappe laden, Mail öffnen, mit dem passenden Satz.
  const laden = page.waitForEvent('download', { timeout: 30_000 });
  await blatt.getByRole('button', { name: 'Diesmal weglassen' }).click();
  await laden;
  await expect(page.getByText(/Unsere Mappe liegt bei\./)).toBeVisible();
  await expect(page.getByText(/mit den üblichen Unterlagen/)).toHaveCount(0);
  const link = await page.evaluate(
    () => (window as unknown as { __mailLink?: string }).__mailLink ?? '',
  );
  expect(decodeURIComponent(link)).toContain('Unsere Mappe liegt bei.');
  expect(decodeURIComponent(link)).not.toContain('üblichen Unterlagen');
});

test('K5 (PC132): Fehlen alle Dateien, hält das Blatt die Mappe auch an', async ({ page }) => {
  await teilenZaehlen(page);
  await szenarioLaden(page, '04-fertig', '/wohnungen');
  await alleLeeren(page);
  await page.goto('/#/mappe');
  await page.reload();
  await expect(page.getByRole('button', { name: 'PDF ansehen' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Als PDF teilen' }).click();
  await expect(page.getByRole('dialog', { name: /kann Hefta nicht öffnen\.$/ })).toBeVisible();
  expect(await geteilt(page)).toBe(0);
});
