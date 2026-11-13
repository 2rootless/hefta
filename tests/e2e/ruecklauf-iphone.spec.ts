import { readFileSync } from 'node:fs';
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { expect, test, type Page } from '@playwright/test';
import { SZENARIEN, datensaetze } from './szenarien';

// Rückmeldungen aus dem ersten Test am iPhone (4. November 2026). Läuft auch in WebKit.

async function pdfMit(seiten: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of seiten)
    doc.addPage([595, 842]).drawText(text, { x: 60, y: 700, size: 18, font: f });
  return Buffer.from(await doc.save());
}

async function laden(page: Page, szenario: string, pfad: string) {
  const pdf = [...(await pdfMit(['Seite eins', 'Seite zwei']))];
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  await page.evaluate(
    async ({ daten, pdf }) => {
      const db = await new Promise<IDBDatabase>((ok) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => ok(r.result);
      });
      const orte = [...db.objectStoreNames];
      const tx = db.transaction(orte, 'readwrite');
      for (const ort of orte) tx.objectStore(ort).clear();
      for (const [ort, liste] of Object.entries(daten))
        for (const d of liste as object[]) tx.objectStore(ort).put(d);
      for (const v of (daten as { versionen: { original: string }[] }).versionen)
        tx.objectStore('dateien').put({
          id: v.original,
          createdAt: new Date().toISOString(),
          typ: 'application/pdf',
          groesse: pdf.length,
          daten: new Uint8Array(pdf).buffer,
        });
      await new Promise((ok) => (tx.oncomplete = ok));
      db.close();
    },
    { daten: datensaetze(SZENARIEN.find((s) => s.id === szenario)!), pdf },
  );
  await page.goto('about:blank');
  await page.goto(`/#${pfad}`);
  await page.locator('main h1').first().waitFor();
}

/** Stellt die Monate einer Serie ein: nur diese bleiben, alle auf eigener Datei. */
async function monateSetzen(page: Page, monate: string[]) {
  await page.evaluate(async (monate) => {
    const db = await new Promise<IDBDatabase>((ok) => {
      const r = indexedDB.open('hefta');
      r.onsuccess = () => ok(r.result);
    });
    const tx = db.transaction('versionen', 'readwrite');
    const ort = tx.objectStore('versionen');
    const alle = await new Promise<{ id: string; dokumentId: string }[]>((ok) => {
      const r = ort.getAll();
      r.onsuccess = () => ok(r.result);
    });
    const serie = alle.filter((v) => v.dokumentId.endsWith('-0-gehaltsnachweis'));
    for (const v of serie) ort.delete(v.id);
    monate.forEach((monat, i) =>
      ort.put({
        ...serie[0]!,
        id: `m-${monat}`,
        abrechnungsmonat: monat,
        eigene: null,
        seiten: null,
        createdAt: `2026-10-0${i + 1}T10:00:00.000Z`,
      }),
    );
    await new Promise((ok) => (tx.oncomplete = ok));
    db.close();
  }, monate);
  await page.reload();
  await page.locator('main h1').first().waitFor();
}

test('Vorname geändert: Überall steht der neue Name, auch bei den Unterlagen', async ({ page }) => {
  await laden(page, '01-standard', '/person-aendern/p-01-standard-1');
  const vorname = page.getByLabel('Vorname');
  await vorname.click();
  await vorname.fill('Marie');
  await expect(page.getByText(/^Wir nennen sie Marie\./)).toBeVisible();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByLabel('Vorname')).toHaveCount(0);
  await page.goto('about:blank');
  await page.goto('/#/unterlage/p-01-standard-1/gehaltsnachweis');
  await expect(page.getByText('Für Marie', { exact: true })).toBeVisible();
  await expect(page.getByText('Für Lea', { exact: true })).toHaveCount(0);
});

test('Eigens gewählter Rufname bleibt, auch wenn sich der Vorname ändert', async ({ page }) => {
  await laden(page, '01-standard', '/person-aendern/p-01-standard-1');
  await page.locator('.rufname').getByRole('button').click();
  await page.getByLabel('Rufname').fill('Leonie');
  await page.getByLabel('Vorname').click();
  await page.getByLabel('Vorname').fill('Lea Marie');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByLabel('Vorname')).toHaveCount(0);
  await page.goto('about:blank');
  await page.goto('/#/unterlage/p-01-standard-1/gehaltsnachweis');
  await expect(page.getByText('Für Leonie', { exact: true })).toBeVisible();
});

test('Serie am 4. November: Es fehlt der August, nicht der November', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 4, 10));
  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/gehaltsnachweis');
  await monateSetzen(page, ['2026-10', '2026-09']);
  await expect(
    page.getByText('September bis Oktober sind in der Mappe.', { exact: false }),
  ).toContainText('August fehlt noch.');
  await expect(
    page.locator('.leiste').getByRole('button', { name: 'August hinzufügen' }),
  ).toBeVisible();
  // Ist alles da, wird am 4. November nichts verlangt, und unten steht „Fertig“.
  await monateSetzen(page, ['2026-10', '2026-09', '2026-08']);
  await expect(page.locator('.leiste').getByRole('button', { name: 'Fertig' })).toBeVisible();
  await expect(page.getByRole('button', { name: /November hinzufügen/ })).toHaveCount(0);
});

test('Zurück oben links tut dasselbe wie die Wischgeste', async ({ page }) => {
  await laden(page, '01-standard', '/');
  await page.getByRole('link', { name: /^Haushalt bearbeiten: / }).click();
  await expect(page.getByRole('heading', { name: 'Euer Haushalt' })).toBeVisible();
  await page.getByRole('link', { name: /Ändern.*Lea/ }).click();
  await expect(page.getByLabel('Vorname')).toHaveValue('Lea');
  await page.getByRole('link', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('heading', { name: 'Euer Haushalt' })).toBeVisible();
  // Eine Seite zurück, kein neuer Eintrag: Vorwärts steht die verlassene Seite.
  await page.goForward();
  await expect(page.getByLabel('Vorname')).toHaveValue('Lea');
  await page.goBack();
  await page.locator('a.zurueck').click();
  await expect(page.locator('main h1')).toContainText('Mappe');
});

test('Nach dem Löschen führt der Weg zurück nicht zur gelöschten Version', async ({ page }) => {
  await laden(page, '25-unterlage-seiten', '/person/p-25-unterlage-seiten-0');
  await page
    .getByRole('link', { name: /Bonitäts.?nachweis/ })
    .first()
    .click();
  await page.getByRole('link', { name: /Version vom 12\.\sJuli/ }).click();
  await page.getByRole('button', { name: 'Diese Version löschen' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'gelöscht.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeVisible();
  // Eine Stelle zurück: die Person, nicht die Seite der gelöschten Version.
  await page.goBack();
  await expect(page).toHaveURL(/#\/person\/p-25-unterlage-seiten-0$/);
});

test('Seite verschieben: zurück in der Liste, mit Rückgängig; „Fertig“ auf „Seiten bearbeiten“', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 10, 4, 10));
  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/gehaltsnachweis');
  await monateSetzen(page, ['2026-09']);
  await page.getByRole('link', { name: /September 2026/ }).click();
  await page.getByRole('link', { name: 'Seiten bearbeiten' }).first().click();
  await expect(page.locator('.leiste').getByRole('button', { name: 'Fertig' })).toBeVisible();
  await page.getByRole('button', { name: 'Was mit Seite 2 geschehen soll' }).click();
  await page.getByRole('button', { name: /^Verschieben/ }).click();
  await page.getByLabel('Anderer Monat').fill('2026-08');
  await page.getByRole('button', { name: 'Dorthin verschieben' }).click();
  await expect(page).toHaveURL(/gehaltsnachweis$/);
  await expect(
    page.getByRole('status').filter({ hasText: 'Seite 2 ist jetzt bei August 2026.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /August 2026/ })).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('link', { name: /August 2026/ })).toHaveCount(0);
});

test('Löschen und Rückgängig: Die Datei bleibt da, bis „Rückgängig“ vorbei ist', async ({
  page,
}) => {
  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/bonitaet');
  const dateien = () =>
    page.evaluate(
      () =>
        new Promise<number>((ok) => {
          const r = indexedDB.open('hefta');
          r.onsuccess = () => {
            const c = r.result.transaction('dateien').objectStore('dateien').count();
            c.onsuccess = () => {
              ok(c.result);
              r.result.close();
            };
          };
        }),
    );
  const vorher = await dateien();
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByRole('button', { name: /Version vom 12\.\sJuli löschen/ }).click();
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeVisible();
  expect(await dateien()).toBe(vorher);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('link', { name: /Version vom 12\.\sJuli/ })).toBeVisible();
  expect(await dateien()).toBe(vorher);
});

test('Backup: Die Vorschau zählt weitere Erwachsene mit (E25: als Zählung unter „Ziehen mit ein“)', async ({
  page,
}) => {
  await laden(page, '06-drei-erwachsene', '/einstellungen/backup');
  await expect(page.getByText('Ziehen mit ein')).toBeVisible();
  await expect(page.getByText('Eine weitere Person', { exact: true })).toBeVisible();
  await expect(page.getByText('Zwei Kinder', { exact: true })).toBeVisible();
  await expect(page.getByText(/\d Personen/)).toHaveCount(0);
});

test('Selbstauskunft: Hinweis zum Format, Knopf zum nächsten Teil, von wem der Haushaltsteil ist', async ({
  page,
}) => {
  await laden(page, '02-neustart', '/selbstauskunft/p-02-neustart-0');
  await page.getByRole('button', { name: /^Kontakt/ }).click();
  const email = page.getByLabel('E-Mail');
  await email.fill('max-at-beispiel');
  await expect(page.getByText(/sieht nicht nach einer E-Mail-Adresse aus/)).toHaveCount(0);
  await page.getByLabel('Telefon').click();
  await expect(page.getByText(/sieht nicht nach einer E-Mail-Adresse aus/)).toBeVisible();
  await email.fill('max@beispiel.de');
  await page.getByLabel('Telefon').fill('abc');
  await email.click();
  await expect(page.getByText(/sieht nicht nach einer Telefonnummer aus/)).toBeVisible();
  // Nur ein Hinweis: Es wird trotzdem gespeichert, und der Knopf führt weiter.
  await page.getByLabel('Telefon').fill('040 123456');
  await email.click();
  await expect(page.getByText(/sieht nicht nach einer Telefonnummer aus/)).toHaveCount(0);
  await page.getByRole('button', { name: /^Weiter: / }).click();
  await expect(page.getByLabel('E-Mail')).toHaveCount(0);

  // Rückmeldung 12.11.: Wer im E-Mail-Feld direkt „Weiter“ tippt, sieht den Hinweis trotzdem. Der erste
  // Tipp zeigt ihn, der zweite geht weiter; im zugeklappten Teil bleibt ein kurzer Hinweis.
  await page.getByRole('button', { name: /^Kontakt/ }).click();
  await page.getByLabel('E-Mail').fill('max-at-beispiel');
  await page.getByRole('button', { name: /^Weiter: / }).click();
  await expect(page.getByText(/sieht nicht nach einer E-Mail-Adresse aus/)).toBeVisible();
  await expect(page.getByLabel('E-Mail')).toBeVisible();
  await page.getByRole('button', { name: /^Weiter: / }).click();
  await expect(page.getByLabel('E-Mail')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Kontakt/ })).toContainText('E-Mail bitte prüfen');
  // Mit der Eingabetaste im letzten Feld genauso.
  await page.getByRole('button', { name: /^Kontakt/ }).click();
  await page.getByLabel('E-Mail').fill('max@beispiel');
  await page.getByLabel('E-Mail').press('Enter');
  await expect(page.getByText(/sieht nicht nach einer E-Mail-Adresse aus/)).toBeVisible();
  // Beide zweifelhaft: ein Satz für beide (Planung 12r).
  await page.getByLabel('Telefon').fill('abc');
  await page.getByRole('button', { name: /^Weiter: / }).click();
  await page.getByRole('button', { name: /^Weiter: / }).click();
  await expect(page.getByRole('button', { name: /^Kontakt/ })).toContainText(
    'E-Mail und Telefonnummer bitte prüfen',
  );
});

test('Mehrere Dateien: Eine Datei mit zwei Monaten wird je Seite geprüft und getrennt gespeichert', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 10, 4, 10));
  await laden(page, '02-neustart', '/unterlage/p-02-neustart-0/gehaltsnachweis');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await page.locator('[data-feld="pdf"]').setInputFiles([
    {
      name: 'oktober.pdf',
      mimeType: 'application/pdf',
      buffer: await pdfMit(['Abrechnung Oktober 2026']),
    },
    {
      name: 'septemberaugust.pdf',
      mimeType: 'application/pdf',
      buffer: await pdfMit(['Abrechnung September 2026', 'Abrechnung August 2026']),
    },
  ]);
  const blatt = page.getByRole('dialog');
  await expect(blatt.getByLabel('Monat von Seite 1')).toHaveValue('2026-09', { timeout: 30_000 });
  await expect(blatt.getByLabel('Monat von Seite 2')).toHaveValue('2026-08');
  await blatt.getByRole('button', { name: /^Speichern/ }).click();
  await expect(blatt).toBeHidden();
  for (const monat of ['Oktober 2026', 'September 2026', 'August 2026'])
    await expect(page.getByRole('link', { name: new RegExp(monat) })).toBeVisible();
  await expect(page.locator('.leiste').getByRole('button', { name: 'Fertig' })).toBeVisible();
});

test('„Abbrechen“ wirkt auch, solange die Datei noch gelesen wird', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 4, 10));
  await laden(page, '02-neustart', '/rutsch');
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  await page.locator('button[aria-label*="Gehalts"]').first().click();
  await page.locator('[data-feld="pdf"]').setInputFiles({
    name: 'lang.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit(Array.from({ length: 80 }, (_, i) => `Seite ${i + 1}`)),
  });
  await expect(page.getByText('Einen Moment …')).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.locator('[data-feld="pdf"]')).toBeAttached();
  await expect(page.getByText(/^lang\.pdf/)).toHaveCount(0);
  await expect(page.getByText('Einen Moment …')).toHaveCount(0);
});

test('Monat direkt im großen Bild wählen; danach steht man, wo man war', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 4, 10));
  await page.setViewportSize({ width: 390, height: 500 });
  await laden(page, '02-neustart', '/rutsch');
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  const schritt = page.locator('button[aria-label*="Gehalts"]').first();
  await schritt.click();
  await page.locator('[data-feld="pdf"]').setInputFiles({
    name: 'scan.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit([
      'Abrechnung Oktober 2026',
      'Abrechnung September 2026',
      'Abrechnung August 2026',
    ]),
  });
  await expect(page.getByLabel('Monat von Seite 3')).toHaveValue('2026-08', { timeout: 30_000 });
  await page.getByLabel('Monat von Seite 3').scrollIntoViewIfNeeded();
  const vorher = await page.evaluate(() => window.scrollY);
  expect(vorher).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Seite 3 groß ansehen' }).click();
  const gross = page.getByRole('dialog');
  await gross.getByLabel('Monat dieser Seite').selectOption('2026-07');
  await gross.getByRole('button', { name: 'Fertig' }).click();
  await expect(gross).toBeHidden();
  await expect(page.getByLabel('Monat von Seite 3')).toHaveValue('2026-07');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(vorher);
});

test('Bonität mit zwei Seiten: Nur das Zertifikat ist vorgewählt; fremder Name: Ja, zu Lea', async ({
  page,
}) => {
  await laden(page, '02-neustart', '/unterlage/p-02-neustart-0/bonitaet');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await page.locator('[data-feld="pdf"]').setInputFiles({
    name: 'schufa.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit([
      'Zertifikat Max Mustermann vom 20.10.2026',
      'Max Mustermann Ihre Daten im Einzelnen',
    ]),
  });
  const blatt = page.getByRole('dialog');
  await expect(blatt.getByText(/^Nur die Seite für den Vermieter ist ausgewählt/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(blatt.getByRole('checkbox', { name: /Seite 1/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(blatt.getByRole('checkbox', { name: /Seite 2/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  // Wer sie will, wählt sie an; der Hinweis geht.
  await blatt.getByRole('checkbox', { name: /Seite 2/ }).click();
  await expect(blatt.getByText(/^Nur die Seite für den Vermieter/)).toHaveCount(0);
});

test('Hochladen: Name einer anderen Person im Haushalt, Knopf „Ja, zu … hinzufügen“', async ({
  page,
}) => {
  await laden(page, '01-standard', '/unterlage/p-01-standard-0/bonitaet');
  await page
    .getByRole('button', { name: /hinzufügen/i })
    .first()
    .click();
  await page.locator('[data-feld="pdf"]').setInputFiles({
    name: 'lea.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit(['Lea Mustermann Bonitaet']),
  });
  const blatt = page.getByRole('dialog');
  const kasten = blatt.getByRole('group', { name: 'Bitte prüfen' });
  await kasten.getByRole('button', { name: 'Ja, zu Lea hinzufügen' }).click({ timeout: 30_000 });
  await expect(blatt).toBeHidden();
  await page.goto('about:blank');
  await page.goto('/#/unterlage/p-01-standard-1/bonitaet');
  await expect(page.getByRole('link', { name: /Version/ }).first()).toBeVisible();
});

test('Hochladen: Name steht gar nicht darauf, Frage ohne Sperre; altes Datum sagt es gleich', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 10, 4, 10));
  await laden(page, '02-neustart', '/unterlage/p-02-neustart-0/bonitaet');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await page.locator('[data-feld="pdf"]').setInputFiles({
    name: 'fremd.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit(['Erika Beispielfrau Auskunft vom 01.02.2026']),
  });
  const blatt = page.getByRole('dialog');
  const kasten = blatt.getByRole('group', { name: 'Bitte prüfen' });
  await expect(kasten).toContainText('Mustermann', { timeout: 30_000 });
  await kasten.getByRole('button', { name: 'Passt so' }).click();
  await expect(kasten).toHaveCount(0);
  await blatt.locator('[data-feld="datum"]').fill('2026-02-01');
  await expect(blatt.getByText(/nicht älter als/)).toBeVisible();
});

test('BAföG und Unterhalt: wählbar, und aus dem Dokument erkannt', async ({ page }) => {
  await laden(page, '09-lebenslagen', '/');
  const person = await page.evaluate(
    () =>
      new Promise<string>((ok) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const g = r.result.transaction('personen').objectStore('personen').getAll();
          g.onsuccess = () => {
            ok(
              (g.result as { id: string; lebenssituation: string }[]).find(
                (p) => p.lebenssituation === 'studierend_azubi',
              )!.id,
            );
            r.result.close();
          };
        };
      }),
  );
  await page.goto('about:blank');
  await page.goto(`/#/unterlage/${person}/einkommen_ausbildung`);
  await page.locator('main h1').first().waitFor();
  await page
    .getByRole('button', { name: /hinzufügen/i })
    .first()
    .click();
  await page.locator('[data-feld="pdf"]').setInputFiles({
    name: 'beides.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit([
      'BAfoeG Bescheid Bundesausbildungsförderungsgesetz',
      'Unterhaltsnachweis der Eltern',
    ]),
  });
  const blatt = page.getByRole('dialog');
  await expect(blatt.getByRole('radio', { name: 'BAföG und Unterhalt' })).toHaveAttribute(
    'aria-checked',
    'true',
    {
      timeout: 30_000,
    },
  );
  await expect(blatt.getByText('Aus dem Dokument erkannt. Du kannst es ändern.')).toBeVisible();
  await blatt.getByRole('radio', { name: 'Unterhaltsnachweis' }).click();
  await expect(blatt.getByText('Aus dem Dokument erkannt. Du kannst es ändern.')).toHaveCount(0);
});

test('Nur die gewählten Seiten stehen in der Monatsliste', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 4, 10));
  await laden(page, '02-neustart', '/unterlage/p-02-neustart-0/gehaltsnachweis');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await page.locator('[data-feld="pdf"]').setInputFiles({
    name: 'zwei.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit(['Abrechnung Oktober 2026', 'Abrechnung September 2026']),
  });
  const blatt = page.getByRole('dialog');
  await expect(blatt.getByLabel('Monat von Seite 2')).toBeVisible({ timeout: 30_000 });
  await blatt.getByRole('checkbox', { name: /Seite 2/ }).click();
  await expect(blatt.getByLabel('Monat von Seite 2')).toHaveCount(0);
  await expect(blatt.getByLabel('Monat von Seite 1')).toHaveValue('2026-10');
  await blatt.getByRole('checkbox', { name: /Seite 2/ }).click();
  await expect(blatt.getByLabel('Monat von Seite 2')).toHaveValue('2026-09');
});

test('Monate aus dem Dateinamen, wenn die Seiten nichts sagen', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 4, 10));
  await laden(page, '02-neustart', '/unterlage/p-02-neustart-0/gehaltsnachweis');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await page.locator('[data-feld="pdf"]').setInputFiles({
    name: 'Gehalt_SeptemberAugust.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit(['Seite ohne Datum', 'Noch eine Seite ohne Datum']),
  });
  const blatt = page.getByRole('dialog');
  await expect(blatt.getByLabel('Monat von Seite 1')).toHaveValue('2026-09', { timeout: 30_000 });
  await expect(blatt.getByLabel('Monat von Seite 2')).toHaveValue('2026-08');
});

test('Dieselbe Datei: Hinweis schon beim Auswählen, nicht erst nach dem Speichern', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 10, 4, 10));
  await laden(page, '02-neustart', '/unterlage/p-02-neustart-0/gehaltsnachweis');
  const datei = {
    name: 'oktober.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit(['Max Mustermann Abrechnung Oktober 2026']),
  };
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await page.locator('[data-feld="pdf"]').setInputFiles(datei);
  const blatt = page.getByRole('dialog');
  await expect(blatt.getByText(/^oktober\.pdf/)).toBeVisible({ timeout: 30_000 });
  await expect(blatt.getByText(/^Diese Datei ist schon da/)).toHaveCount(0);
  await blatt.getByRole('button', { name: /^Speichern/ }).click();
  await expect(blatt).toBeHidden();
  await page
    .locator('.leiste')
    .getByRole('button', { name: /hinzufügen/i })
    .click();
  await page.locator('[data-feld="pdf"]').setInputFiles(datei);
  await expect(
    blatt.getByText(/^Diese Datei ist schon da: Gehalts.*Oktober 2026, Max\./),
  ).toBeVisible({
    timeout: 30_000,
  });
});

test('Einmal Gebautes kommt sofort wieder: Hin und her wechseln liest keine Datei', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const zaehler = window as unknown as { __gelesen: number };
    zaehler.__gelesen = 0;
    const lesen = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (this: IDBObjectStore, schluessel: IDBValidKey) {
      if (this.name === 'dateien') zaehler.__gelesen++;
      return lesen.call(this, schluessel);
    };
  });
  const gelesen = () => page.evaluate(() => (window as unknown as { __gelesen: number }).__gelesen);
  await laden(page, '04-fertig', '/mappe');
  const teilen = page.locator('.leiste').getByRole('button', { name: /teilen/i });
  await expect(teilen)
    .toHaveAttribute('aria-disabled', /^(?!true).*|^$/, { timeout: 30_000 })
    .catch(() => {});
  await expect(page.getByRole('button', { name: 'PDF ansehen' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('radio', { name: /^Alles/ }).click();
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', { name: 'PDF ansehen' })).toBeVisible({ timeout: 30_000 });
  const nachBeiden = await gelesen();
  expect(nachBeiden).toBeGreaterThan(0);
  await page.getByRole('radio', { name: /^Nur das Übliche/ }).click();
  await expect(page.getByRole('button', { name: 'PDF ansehen' })).toBeVisible();
  await page.getByRole('radio', { name: /^Alles/ }).click();
  await expect(page.getByRole('button', { name: 'PDF ansehen' })).toBeVisible();
  await page.waitForTimeout(700);
  expect(await gelesen()).toBe(nachBeiden);
});

test('Farbe gleich in „Mappe anpassen“ ändern, getauscht wird; die Vorschau folgt', async ({
  page,
}) => {
  await laden(page, '04-fertig', '/mappe/anpassen');
  const gross = page.getByRole('button', { name: /^Vorschau eurer Mappe groß ansehen/ });
  await expect(gross).toBeVisible({ timeout: 30_000 });
  const vorher = await gross.locator('img').first().getAttribute('src');
  await page.getByRole('button', { name: 'Farbe von Lea' }).click();
  const blatt = page.getByRole('dialog');
  await blatt.getByRole('radio', { name: 'Apricot, hat Max' }).click();
  await expect(blatt.getByRole('status')).toHaveText('Max bekommt dafür Pistazie.');
  await expect
    .poll(() => gross.locator('img').first().getAttribute('src'), { timeout: 30_000 })
    .not.toBe(vorher);
  await page.goto('about:blank');
  await page.goto('/#/person-aendern/p-04-fertig-0');
  const wahl = page.getByRole('radiogroup', { name: /^Farbe/ });
  await expect(wahl.getByRole('radio', { name: 'Pistazie' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('Backup vom ersten Start aus: danach die Übersicht, mit Bestätigung', async ({ page }) => {
  const backup = readFileSync('tests/fixtures/backup/schema1-offen.hefta');
  await page.goto('/');
  // Hefta 2: Ohne Haushalt spielt man das Backup über die Einstellungen ein (B15).
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  await page.getByRole('link', { name: /^Backup einspielen/ }).click();
  await page.getByRole('heading', { name: 'Hefta gibt es als App.' }).waitFor();
  await page.getByRole('button', { name: 'Weiter im Browser', exact: true }).click();
  await page.getByRole('heading', { name: 'Backup einspielen' }).waitFor();
  await page.locator('input[type=file]').first().setInputFiles({
    name: 'hefta-backup.hefta',
    mimeType: 'application/octet-stream',
    buffer: backup,
  });
  await expect(page.getByText('Eine weitere Person', { exact: true }).last()).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Einspielen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Mappe$/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('.meldung')).toContainText('im Mietvertrag');
  // Hinter der Übersicht liegt nichts: kein altes Standbild beim Zurückwischen.
  await expect.poll(() => page.evaluate(() => history.state?.stelle)).toBe(0);
});
