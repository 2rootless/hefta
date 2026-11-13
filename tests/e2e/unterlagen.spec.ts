import AxeBuilder from '@axe-core/playwright';
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { haushaltMitMax } from './einrichtung';
import { animationenFertig, cspMelden } from './hilfen';

// Abnahme M3: drei Gehaltsabrechnungen als PDF ergeben eine Serie; eine vierte schiebt die Serie weiter.
// Dazu: passwortgeschütztes PDF, Seiten weglassen, Versionen löschen, „Noch nicht“.

async function pdfDatei(info: TestInfo, name: string, seiten: string[], passwort?: string) {
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of seiten)
    doc.addPage([595, 842]).drawText(text, { x: 60, y: 700, size: 18, font: schrift });
  if (passwort) doc.encrypt({ userPassword: passwort, ownerPassword: `${passwort}-x` });
  const pfad = info.outputPath(name);
  writeFileSync(pfad, await doc.save());
  return pfad;
}

async function maxOeffnen(page: Page) {
  await haushaltMitMax(page);
  // Auf den Namensbereich tippen (in der Mitte liegt das Eintragen-Feld).
  await page.getByRole('link', { name: /^Max Hauptmieter$/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Max' })).toBeVisible();
}

/** Zeile antippen, auf der Seite der Unterlage (UL1) hinzufügen: Das Blatt zum Hochladen geht auf. */
async function hochladenOeffnen(page: Page, zeile: RegExp) {
  await page.getByRole('link', { name: zeile }).click();
  // Ist etwas zu tun, die Hauptaktion unten, sonst das Feld „Neue Version hinzufügen“.
  await page.locator('.leiste .haupt, button.eintragen').first().click();
}

/** Von der Seite der Unterlage zurück zur Person. */
async function zurueckZuMax(page: Page) {
  await page.getByRole('link', { name: 'Max', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Max' })).toBeVisible();
}

async function gehaltHochladen(
  page: Page,
  datei: string,
  monat: { chip?: string; anders?: string },
) {
  await hochladenOeffnen(page, /^Gehalts.?nachweise/);
  const blatt = page.getByRole('dialog');
  await blatt.locator('[data-feld="pdf"]').setInputFiles(datei);
  await expect(blatt.getByRole('radiogroup').first()).toBeVisible();
  // Gehalt ist eine Serie: Monate als Mehrfachauswahl (RS2). Erst die Vorbelegung abwählen.
  await monatWaehlen(blatt, monat.chip ?? null);
  if (monat.anders) {
    await blatt.getByRole('button', { name: 'Anderer Monat' }).click();
    await blatt.locator('input[type=month]').fill(monat.anders);
    await blatt.locator('input[type=month]').dispatchEvent('change');
  }
  await blatt.getByRole('button', { name: 'Speichern' }).click();
  await expect(blatt).toBeHidden();
  await zurueckZuMax(page);
}

async function monatWaehlen(blatt: Locator, chip: string | null) {
  if (!chip) return;
  // Eine Seite: ein Monat. Mehrere Seiten: je Seite eine Auswahl (OR3).
  const auswahl = await blatt.getByRole('combobox').all();
  for (const feld of auswahl) await feld.selectOption({ label: chip });
  if (!auswahl.length) await blatt.getByRole('radio', { name: chip, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
  // Fester Tag: 6. November 2026. Ohne Angabe „spät“ ist die Oktober-Abrechnung erst ab 28.11. fällig.
  await page.clock.setFixedTime(new Date(2026, 10, 6, 10, 0));
});

test('drei Gehaltsabrechnungen ergeben eine Serie, eine vierte schiebt sie weiter', async ({
  page,
  browserName,
}, info) => {
  await maxOeffnen(page);
  const juli = await pdfDatei(info, 'juli.pdf', ['Abrechnung Juli']);
  const august = await pdfDatei(info, 'august.pdf', ['Abrechnung August', 'Seite 2']);
  const september = await pdfDatei(info, 'september.pdf', ['Abrechnung September']);
  const oktober = await pdfDatei(info, 'oktober.pdf', ['Abrechnung Oktober']);

  // Erstes Hochladen: Menü, dann Blatt mit Vorschau und vorbelegtem Monat (wie im Entwurf).
  await hochladenOeffnen(page, /^Gehalts.?nachweise/);
  const blatt = page.getByRole('dialog');
  await expect(blatt.getByText('Für Max')).toBeVisible();
  await expect(blatt.getByText(/unter „Durchsuchen“/)).toBeVisible();
  await blatt.locator('[data-feld="pdf"]').setInputFiles(august);
  await expect(blatt.getByRole('button', { name: 'Seite 2 ansehen' })).toBeVisible();
  await expect(blatt.getByText('august.pdf, 2 Seiten')).toBeVisible();
  // Mehrere Seiten: je Seite ein Monat (OR3); ohne Fund auf der Seite gilt der Monat im Dateinamen.
  await expect(blatt.getByRole('combobox').first()).toHaveValue('2026-08');
  await expect(blatt.getByText('Bleibt auf deinem Gerät. Nichts wird hochgeladen.')).toBeVisible();
  if (browserName === 'chromium') {
    await animationenFertig(page);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await page.screenshot({ path: 'docs/screenshots/m3-hochladen.png' });
  }
  // Seite 2 groß ansehen, vergrößern und dort weglassen; dann Monat August wählen.
  await blatt.getByRole('button', { name: 'Seite 2 ansehen' }).click();
  const ansicht = page.getByRole('dialog', { name: 'Seite 2 von 2' });
  await expect(ansicht.getByRole('img', { name: 'Seite 2' })).toBeVisible();
  await ansicht.getByRole('button', { name: '3×' }).click();
  await ansicht.getByRole('button', { name: 'Vorige Seite' }).click();
  await expect(page.getByRole('dialog', { name: 'Seite 1 von 2' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await ansicht.getByRole('switch', { name: 'Kommt in die Mappe' }).uncheck();
  await ansicht.getByRole('button', { name: 'Fertig' }).click();
  await expect(ansicht).toBeHidden();
  await expect(blatt.getByText('august.pdf, 1 Seite')).toBeVisible();
  await expect(blatt.getByRole('button', { name: 'Seite 2 ansehen, weggelassen' })).toBeVisible();
  await monatWaehlen(blatt, 'August');
  await blatt.getByRole('button', { name: 'Speichern' }).click();
  await expect(blatt).toBeHidden();
  await zurueckZuMax(page);

  const zeile = page.getByRole('listitem').filter({ hasText: 'Gehalts' });
  await expect(zeile).toContainText(/August\. .* fehlen noch/);

  await gehaltHochladen(page, juli, { anders: '2026-07' });
  await gehaltHochladen(page, september, { chip: 'September' });
  await expect(zeile).toContainText('Juli bis September');
  await expect(zeile).not.toContainText('Fehlt noch');

  // Neue Version: Datei gewählt, dann doch abbrechen. Nichts wird gespeichert, alles geht zu.
  await hochladenOeffnen(page, /^Gehalts.?nachweise/);
  const abbruch = page.getByRole('dialog');
  await abbruch.locator('[data-feld="pdf"]').setInputFiles(oktober);
  await expect(abbruch.getByText('oktober.pdf, 1 Seite')).toBeVisible();
  await abbruch.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await zurueckZuMax(page);
  await expect(zeile).toContainText('Juli bis September');

  // Vierte Abrechnung schiebt die Serie weiter, die älteste bleibt gespeichert.
  await hochladenOeffnen(page, /^Gehalts.?nachweise/);
  const neu = page.getByRole('dialog');
  await neu.locator('[data-feld="pdf"]').setInputFiles(juli);
  await expect(neu.getByText('juli.pdf, 1 Seite')).toBeVisible();
  // Falsche Datei erwischt: direkt wechseln, ohne erst abzubrechen.
  await neu.getByLabel('Andere Datei wählen').setInputFiles(oktober);
  await expect(neu.getByText('oktober.pdf, 1 Seite')).toBeVisible();
  await expect(neu.getByText('juli.pdf, 1 Seite')).toHaveCount(0);
  await monatWaehlen(neu, 'Oktober');
  await neu.getByRole('button', { name: 'Speichern' }).click();
  await expect(neu).toBeHidden();
  await zurueckZuMax(page);
  await expect(zeile).toContainText('August bis Oktober');

  // Seite der Unterlage (UL2): die drei neuesten in der Mappe, der älteste Monat darunter.
  await page.getByRole('link', { name: /^Gehalts.?nachweise/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: /die drei neuesten/ })).toBeVisible();
  await expect(page.getByText('August bis Oktober sind in der Mappe.')).toBeVisible();
  const aelter = page.getByRole('link', { name: /Juli 2026/ });
  await expect(aelter).toContainText('Nicht in der Mappe.');
  await expect(page.getByRole('link', { name: /Oktober 2026/ })).not.toContainText('Nicht in der');

  // Älteste löschen, sofort (UL4, OR7b).
  await aelter.click();
  await page.getByRole('button', { name: 'Diese Version löschen' }).click();
  await expect(page.getByRole('link', { name: /Juli 2026/ })).toHaveCount(0);
  await zurueckZuMax(page);

  // Bleibt nach dem Neuladen; Übersicht zeigt Gehalt als erledigt.
  await page.reload();
  await expect(zeile).toContainText('August bis Oktober');
  await page.locator('a.zurueck').click();
  await expect(page.getByText('Noch zwei Dinge, dann bist du startklar.')).toBeVisible();
  if (browserName === 'chromium') {
    await animationenFertig(page);
    await page.screenshot({ path: 'docs/screenshots/m3-uebersicht.png', fullPage: true });
  }
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('passwortgeschütztes PDF: entsperren, ohne Passwort speichern, Größe sehen', async ({
  page,
}, info) => {
  await maxOeffnen(page);
  const geschuetzt = await pdfDatei(info, 'bonitaet.pdf', ['BonitaetsCheck', 'Seite 2'], 'geheim');

  await hochladenOeffnen(page, /^Bonitäts.?nachweis/);
  const blatt = page.getByRole('dialog');
  await blatt.locator('[data-feld="pdf"]').setInputFiles(geschuetzt);
  await expect(blatt.getByText(/^Die Datei ist mit einem Passwort geschützt\./)).toBeVisible();
  await expect(blatt.getByText(/Hefta speichert das Passwort nicht/)).toBeVisible();
  // D5: Solange die Datei gesperrt ist, ist „Entsperren“ die Hauptaktion; Datum und Rest kommen danach.
  await expect(blatt.getByRole('button', { name: 'Speichern' })).toHaveCount(0);
  await expect(blatt.locator('[data-feld="datum"]')).toHaveCount(0);
  await expect(blatt.getByRole('button', { name: 'Entsperren' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );

  await blatt.getByLabel('Passwort der Datei').fill('falsch');
  await blatt.getByRole('button', { name: 'Entsperren' }).click();
  await expect(
    blatt.getByText('Das Passwort passt nicht. Achte auf Groß- und Kleinschreibung.'),
  ).toBeVisible();

  await blatt.getByLabel('Passwort der Datei').fill('geheim');
  await blatt.getByRole('button', { name: 'Entsperren' }).click();
  await expect(
    blatt.getByText(/Entsperrt\. Gespeichert wird die Datei ohne Passwort: \d+ KB\./),
  ).toBeVisible();
  await expect(blatt.getByRole('button', { name: 'Seite 2 ansehen' })).toBeVisible();

  await blatt.locator('[data-feld="datum"]').fill('2026-11-02');
  await blatt.getByRole('button', { name: 'Speichern' }).click();
  await expect(blatt).toBeHidden();
  await expect(page.getByText('als Bilder')).toHaveCount(0);
  await zurueckZuMax(page);
  const zeile = page.getByRole('listitem').filter({ hasText: 'Bonitäts' });
  await expect(zeile).toContainText('Vom 2. November');
});

test('„Noch nicht“ lässt einen fälligen neuen Monat eine Woche ruhen', async ({ page }, info) => {
  await maxOeffnen(page);
  for (const [name, monat] of [
    ['jul.pdf', '2026-07'],
    ['aug.pdf', '2026-08'],
    ['sep.pdf', '2026-09'],
  ] as const) {
    await gehaltHochladen(page, await pdfDatei(info, name, [name]), { anders: monat });
  }
  // Zeitsprung: 29. November, die Oktober-Abrechnung kann jetzt da sein.
  await page.clock.setFixedTime(new Date(2026, 10, 29, 10, 0));
  await page.reload();
  const zeile = page.getByRole('listitem').filter({ hasText: 'Gehalts' });
  await expect(zeile).toContainText('Neuer Monat: Oktober kann da sein');
  await zeile.getByRole('link').click();
  await page.getByRole('button', { name: 'Oktober hinzufügen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Noch nicht' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await zurueckZuMax(page);
  await expect(zeile).toContainText('Juli bis September');
  await expect(zeile).not.toContainText('Neuer Monat');

  // Eine Woche später fragt Hefta wieder.
  await page.clock.setFixedTime(new Date(2026, 11, 7, 10, 0));
  await page.reload();
  await expect(zeile).toContainText('Neuer Monat: Oktober kann da sein');
});

test('schwierige Dateien: viele Seiten auswählen (D2, D3), Word-Datei (D7), ohne Datum (D6)', async ({
  page,
}, info) => {
  await maxOeffnen(page);
  const dick = await pdfDatei(
    info,
    'kontoauszug.pdf',
    Array.from({ length: 12 }, (_, i) => `Seite ${i + 1}`),
  );

  // D7: Eine Word-Datei geht nicht; der Hinweis steht da, man versucht es direkt nochmal.
  await hochladenOeffnen(page, /^Bonitäts.?nachweis/);
  const blatt = page.getByRole('dialog');
  await blatt.locator('[data-feld="pdf"]').setInputFiles({
    name: 'Lebenslauf.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: Buffer.from('Kein PDF, sondern Word'),
  });
  await expect(
    blatt.getByText(/^Diese Datei kann Hefta nicht öffnen\. Im Moment geht es mit PDFs\./),
  ).toBeVisible();

  // D2: zwölf Seiten machen die Mappe dick; erst drei Seiten und „+9“.
  await blatt.locator('[data-feld="pdf"]').setInputFiles(dick);
  await expect(blatt.getByText(/^Zwölf Seiten machen die Mappe dick\./)).toBeVisible();
  await expect(blatt.getByRole('button', { name: 'Alle 12 Seiten ansehen' })).toHaveText('+9');
  await expect(blatt.getByRole('checkbox')).toHaveCount(3);

  // D3: drei auswählen, in derselben Ansicht: Kreis unter der Seite, Tipp auf die Seite macht sie groß.
  await blatt.getByRole('button', { name: 'Seiten auswählen' }).click();
  await expect(blatt.getByText('Tipp die Seiten an, die der Vermieter sehen soll.')).toBeVisible();
  for (const n of [1, 2, 5])
    await blatt.getByRole('checkbox', { name: `Seite ${n} kommt in die Mappe` }).click();
  await expect(blatt.getByText('3 von 12 Seiten kommen in die Mappe')).toBeVisible();
  await blatt.getByRole('button', { name: 'Seite 7 ansehen, weggelassen' }).click();
  const gross = page.getByRole('dialog', { name: 'Seite 7 von 12' });
  await gross.getByRole('switch', { name: 'Kommt in die Mappe' }).check();
  await page.keyboard.press('Escape');
  await expect(gross).toBeHidden();
  await expect(blatt).toBeVisible();
  await expect(blatt.getByText('4 von 12 Seiten kommen in die Mappe')).toBeVisible();
  await expect(blatt.getByRole('checkbox', { name: 'Seite 7 kommt in die Mappe' })).toBeChecked();
  // Das Blatt lässt sich nicht zur Seite schieben.
  expect(await blatt.evaluate((d) => d.scrollWidth - d.clientWidth)).toBeLessThanOrEqual(0);

  // Keine Seite: Der Knopf bleibt gedämpft. Mit Seiten geht es auch ohne Datum (D6).
  await blatt.getByRole('button', { name: 'Alle', exact: true }).click();
  await blatt.getByRole('button', { name: 'Keine', exact: true }).click();
  await expect(blatt.getByRole('button', { name: 'Speichern' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await blatt.getByRole('checkbox', { name: 'Seite 3 kommt in die Mappe' }).click();
  await expect(blatt.getByText(/^Ohne Datum kann Hefta nicht erinnern/)).toBeVisible();
  await blatt.getByRole('button', { name: 'Speichern' }).click();
  await expect(blatt).toBeHidden();
  await zurueckZuMax(page);
  const zeile = page.getByRole('listitem').filter({ hasText: 'Bonitäts' });
  await expect(zeile).not.toContainText('Fehlt');

  // Das Datum lässt sich später nachtragen: Die Zeile führt direkt ins Feld (UL3).
  await page.getByRole('link', { name: /^Bonitäts.?nachweis/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Wann wurde er ausgestellt?' }),
  ).toBeVisible();
  const feld = page.getByLabel('Ausgestellt am');
  await expect(feld).toBeFocused();
  await feld.fill('2026-10-20');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Vom 20. Oktober 2026. Kommt in die Mappe.')).toBeVisible();
  await zurueckZuMax(page);
  await expect(zeile).toContainText('Vom 20. Oktober');
});

test('PDF eines Lohnportals (geschützt, ohne Passwort): kommt mit Text in die Mappe', async ({
  page,
}, info) => {
  await maxOeffnen(page);
  await hochladenOeffnen(page, /^Bonitäts.?nachweis/);
  const blatt = page.getByRole('dialog');
  await blatt.locator('[data-feld="pdf"]').setInputFiles('tests/fixtures/portal-aes-256.pdf');
  await expect(blatt.getByText('portal-aes-256.pdf, 1 Seite')).toBeVisible();
  await blatt.getByRole('button', { name: 'Speichern' }).click();
  await expect(blatt).toBeHidden();
  await expect(page.getByText(/portal-aes-256\.pdf, 1 Seite/)).toBeVisible();

  await page.evaluate(() => (location.hash = '#/mappe'));
  const sichern = page.getByRole('button', { name: 'PDF ansehen' });
  await expect(sichern).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/(Datei fehlt|Dateien fehlen) in der Mappe/)).toHaveCount(0);
  const [download] = await Promise.all([page.waitForEvent('download'), sichern.click()]);
  const pfad = info.outputPath('mappe.pdf');
  await download.saveAs(pfad);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const dok = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(pfad)) }).promise;
  let alles = '';
  for (let n = 1; n <= dok.numPages; n++) {
    const inhalt = await (await dok.getPage(n)).getTextContent();
    alles += inhalt.items.map((i) => ('str' in i ? i.str : '')).join(' ');
  }
  expect(alles).toContain('Lohnzettel aes-256');
});

test('Mehrere Gehaltsdateien: „Entfernen“ je Datei, „Andere Datei wählen“ nur bei einer (RS3b)', async ({
  page,
}, info) => {
  await maxOeffnen(page);
  await hochladenOeffnen(page, /^Gehalts.?nachweise/);
  const blatt = page.getByRole('dialog');
  await blatt
    .locator('[data-feld="pdf"]')
    .setInputFiles([
      await pdfDatei(info, 'juli.pdf', ['Gehaltsabrechnung Juli 2026']),
      await pdfDatei(info, 'august.pdf', ['Gehaltsabrechnung August 2026']),
      await pdfDatei(info, 'sept.pdf', ['Gehaltsabrechnung September 2026']),
    ]);
  const entfernen = blatt.getByRole('button', { name: /^Entfernen/ });
  await expect(entfernen).toHaveCount(3);
  await expect(blatt.getByLabel('Andere Datei wählen')).toHaveCount(0);

  await blatt.getByRole('button', { name: 'Entfernen august.pdf' }).click();
  await expect(entfernen).toHaveCount(2);
  await expect(blatt.getByText('august.pdf')).toHaveCount(0);

  // Bleibt eine Datei, ist „Andere Datei wählen“ wieder eindeutig.
  await blatt.getByRole('button', { name: 'Entfernen sept.pdf' }).click();
  await expect(entfernen).toHaveCount(0);
  await expect(blatt.getByLabel('Andere Datei wählen')).toBeAttached();
  await expect(blatt.getByText(/^juli\.pdf/)).toBeVisible();
});

test('Kein Datum gefunden: Die Seite steht da, das Feld darunter (D11c)', async ({
  page,
}, info) => {
  await maxOeffnen(page);
  await hochladenOeffnen(page, /^Bonitäts.?nachweis/);
  const blatt = page.getByRole('dialog');
  await blatt
    .locator('[data-feld="pdf"]')
    .setInputFiles(await pdfDatei(info, 'ohne.pdf', ['Auskunft ohne Angabe']));
  await blatt.getByRole('button', { name: 'Im Dokument auswählen' }).click();

  const auswahl = page.getByRole('dialog', { name: 'Kein Datum gefunden.' });
  await expect(auswahl.getByText(/^Auf dieser Seite hat Hefta kein Datum erkannt/)).toBeVisible();
  await expect(auswahl.getByRole('img', { name: 'Seite 1' })).toBeVisible();
  const nehmen = auswahl.getByRole('button', { name: 'Datum übernehmen' });
  await expect(nehmen).toHaveAttribute('aria-disabled', 'true');
  await nehmen.click({ force: true });
  await expect(auswahl.getByText('Es fehlt noch: Datum')).toBeVisible();
  await expect(auswahl).toBeVisible();

  await auswahl.getByLabel('Datum auf der Seite').fill('2026-10-20');
  await nehmen.click();
  await expect(auswahl).toBeHidden();
  await expect(blatt.locator('[data-feld="datum"]')).toHaveValue('2026-10-20');
});

test('Datum und Monat: im Dokument erkannt oder dort ausgewählt, Datei direkt gewechselt', async ({
  page,
}, info) => {
  await maxOeffnen(page);
  const klar = await pdfDatei(info, 'auskunft.pdf', ['Auskunft, ausgestellt am 20.10.2026']);
  const unklar = await pdfDatei(info, 'nachweis.pdf', ['Einzug 01.03.2024, Auszug 15.05.2025']);
  const lang = await pdfDatei(
    info,
    'lang.pdf',
    Array.from({ length: 30 }, (_, i) => `Seite ${i + 1}`),
  );

  await hochladenOeffnen(page, /^Bonitäts.?nachweis/);
  const blatt = page.getByRole('dialog');
  const datum = blatt.locator('[data-feld="datum"]');
  // Wechsel, während die lange Datei noch lädt: Es gilt die neue, das Blatt bleibt, wo es ist.
  await blatt.locator('[data-feld="pdf"]').setInputFiles(lang);
  await blatt.getByLabel('Andere Datei wählen').setInputFiles(klar);
  await expect(blatt.getByText('auskunft.pdf, 1 Seite')).toBeVisible();
  await expect(blatt.getByRole('checkbox')).toHaveCount(1);
  await expect(datum).toHaveValue('2026-10-20');
  await expect(
    blatt.getByText(/^Im Dokument gefunden: 20\.\sOktober 2026 \(Seite 1\)/),
  ).toBeVisible();

  // Andere Datei, zwei Daten ohne klaren Bezug: Hefta rät nicht, man wählt im Dokument.
  await blatt.getByLabel('Andere Datei wählen').setInputFiles(unklar);
  await expect(blatt.getByText('nachweis.pdf, 1 Seite')).toBeVisible();
  await expect(datum).toHaveValue('');
  await blatt.getByRole('button', { name: 'Im Dokument auswählen' }).click();
  // D11b: die gefundenen Daten als große Auswahl mit dem Wort davor; auf der Seite antippbar.
  const auswahl = page.getByRole('dialog', { name: 'Welches Datum?' });
  await expect(auswahl.getByText(/^Hefta hat zwei Daten gefunden/)).toBeVisible();
  const einzug = auswahl.getByRole('radio', { name: /^01\.03\.2024 „Einzug“ · Seite 1/ });
  const auszug = auswahl.getByRole('radio', { name: /^15\.05\.2025 „Auszug“ · Seite 1/ });
  await expect(einzug).toHaveAttribute('aria-checked', 'true');
  await auswahl.getByRole('button', { name: '15.05.2025 wählen' }).click();
  await expect(auszug).toHaveAttribute('aria-checked', 'true');
  await einzug.click();
  await expect(einzug).toHaveAttribute('aria-checked', 'true');
  await auswahl.getByRole('button', { name: 'Keins davon' }).click();
  await expect(auswahl).toBeHidden();
  await expect(datum).toHaveValue('');
  await blatt.getByRole('button', { name: 'Im Dokument auswählen' }).click();
  await auszug.click();
  await auswahl.getByRole('button', { name: 'Datum übernehmen' }).click();
  await expect(auswahl).toBeHidden();
  await expect(datum).toHaveValue('2025-05-15');
  await blatt.getByRole('button', { name: 'Speichern' }).click();
  await expect(blatt).toBeHidden();
  await zurueckZuMax(page);

  // Gehalt: Der Monat steht im Dokument und ersetzt die Vorbelegung.
  await hochladenOeffnen(page, /^Gehalts.?nachweise/);
  const gehalt = page.getByRole('dialog');
  await gehalt
    .locator('[data-feld="pdf"]')
    .setInputFiles(await pdfDatei(info, 'lohn.pdf', ['Gehaltsabrechnung Oktober 2026']));
  await expect(gehalt.getByRole('radio', { name: 'Oktober' })).toBeChecked();
  await expect(gehalt.getByRole('radio', { name: 'September' })).not.toBeChecked();
  await expect(gehalt.getByText(/^Aus dem Dokument erkannt: Oktober/)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('Datum wird auch ohne „for await“ über Streams erkannt, wie auf echten iPhones', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    delete (ReadableStream.prototype as unknown as Record<symbol, unknown>)[Symbol.asyncIterator];
  });
  await maxOeffnen(page);
  await hochladenOeffnen(page, /^Bonitäts.?nachweis/);
  const blatt = page.getByRole('dialog');
  await blatt
    .locator('[data-feld="pdf"]')
    .setInputFiles(await pdfDatei(info, 'alt.pdf', ['Ausgestellt am 20.10.2026']));
  await expect(blatt.locator('[data-feld="datum"]')).toHaveValue('2026-10-20');
});

test('drei Gehaltsnachweise auf einmal: je Datei ein Monat, erkannt aus dem Namen', async ({
  page,
}, info) => {
  await maxOeffnen(page);
  const dateien = [
    await pdfDatei(info, 'Gehalt_September_2026.pdf', ['Abrechnung September']),
    await pdfDatei(info, 'Gehalt_Juli_2026.pdf', ['Abrechnung Juli']),
    await pdfDatei(info, 'scan_0815.pdf', ['Abrechnung ohne Monat im Namen']),
  ];
  await hochladenOeffnen(page, /^Gehalts.?nachweise/);
  const blatt = page.getByRole('dialog');
  await blatt.locator('[data-feld="pdf"]').setInputFiles(dateien);
  await expect(blatt.getByText('Welcher Monat ist welche Datei?')).toBeVisible();
  await expect(blatt.getByLabel('Gehalt_September_2026.pdf')).toHaveValue('2026-09');
  await expect(blatt.getByLabel('Gehalt_Juli_2026.pdf')).toHaveValue('2026-07');
  // Ohne Monat im Namen: der erwartete Monat, sonst der nächste freie davor (hier August).
  await blatt.getByLabel('scan_0815.pdf').selectOption('2026-07');
  await expect(blatt.getByText('Jeder Monat nur einmal.').first()).toBeVisible();
  await blatt.getByLabel('scan_0815.pdf').selectOption('2026-08');
  await blatt.getByRole('button', { name: 'Speichern' }).click();
  await expect(blatt).toBeHidden();
  await zurueckZuMax(page);
  const zeile = page.getByRole('listitem').filter({ hasText: 'Gehalts' });
  await expect(zeile).toContainText('Juli bis September');

  await page.getByRole('link', { name: /^Gehalts.?nachweise/ }).click();
  await expect(page.getByRole('listitem')).toHaveCount(3);
});
