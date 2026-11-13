import AxeBuilder from '@axe-core/playwright';
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { haushaltDesAuftraggebers } from './einrichtung';
import { animationenFertig, cspMelden } from './hilfen';

// Abnahme Stil C: Haushalt des Auftraggebers in zwei Schritten (Max, Lea, ein Kind, Bürgin Petra),
// Unterlagen in einem Rutsch mit Pause und Überspringen, Übersicht, Personenansicht, Haushalt
// bearbeiten, Backup-Rundlauf.

async function barrierefrei(page: Page, wo: string) {
  await animationenFertig(page);
  const ergebnis = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    ergebnis.violations.map(
      (v) => `${wo}: ${v.id} – ${v.help} (${v.nodes.map((n) => n.target).join(', ')})`,
    ),
  ).toEqual([]);
}

async function pdfDatei(info: TestInfo, name: string) {
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText(name, { x: 60, y: 700, size: 18, font: schrift });
  const pfad = info.outputPath(name);
  writeFileSync(pfad, await doc.save());
  return pfad;
}

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
  await page.clock.setFixedTime(new Date(2026, 10, 6, 10, 0));
});

test('Einrichtung in zwei Schritten, Rutsch mit Pause, Übersicht und Person', async ({
  page,
  browserName,
}, info) => {
  const bilder = browserName === 'chromium';
  const start = Date.now();
  await haushaltDesAuftraggebers(page);
  expect(Date.now() - start).toBeLessThan(60_000);

  // R0: alle offenen Unterlagen, Person für Person.
  await expect(page.getByText(/^\S+ Stück, eine nach der anderen/)).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveText([/^Max \d+$/, /^Lea \d+$/, /^Petra \d+$/]);
  if (bilder) {
    await barrierefrei(page, 'Rutsch Start');
    await page.screenshot({ path: 'docs/screenshots/stilc-rutsch-start.png' });
  }
  await page.getByRole('button', { name: 'Los geht’s' }).click();

  // Zuerst die Selbstauskunft von Max, direkt im Ablauf (M4). Ja/Nein ohne Vorauswahl.
  await expect(page.getByText('Für Max')).toBeVisible();
  await expect(page.getByText(/^1 von \d+$/)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: /Selbst.?auskunft/ })).toBeVisible();
  const weiterSA = page.getByRole('button', { name: 'Speichern und weiter' });
  await expect(weiterSA).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText(/^Noch 5 Teile\./)).toBeVisible();
  // Akkordeon (A1): Teil 1 ist offen, die anderen tippt man an.
  await page.getByLabel('E-Mail').fill('max@example.org');
  await page.getByRole('button', { name: /^Einkommen Pflicht/ }).click();
  await page.getByLabel('Netto im Monat').fill('2800');
  await page.getByRole('radio', { name: 'Mindestens' }).click();
  await page.getByRole('button', { name: /^Fragen, die Vermieter stellen dürfen Zweimal/ }).click();
  for (const frage of ['Insolvenzverfahren', 'Räumungstitel']) {
    await page
      .getByRole('radiogroup', { name: new RegExp(frage) })
      .getByRole('radio', { name: 'Nein' })
      .click();
  }
  // Zwei Antworten reichen für „fertig“, aber der Teil bleibt offen: Die Frage nach der Zusage steht
  // noch darunter. Weiter geht es über den Knopf; von selbst erst, wenn alle drei beantwortet sind.
  await expect(page.getByRole('radiogroup', { name: /Mietrückstände/ })).toBeVisible();
  await page.getByRole('button', { name: /^Weiter: / }).click();
  await expect(page.getByRole('radiogroup', { name: /Haustiere/ })).toBeVisible();
  await page
    .getByRole('radiogroup', { name: /Haustiere/ })
    .getByRole('radio', { name: 'Ja' })
    .click();
  await page.getByLabel('Welche? (freiwillig)').fill('eine Katze');
  await page.getByLabel('Ort für die Unterschrift').fill('Hamburg');
  // Fertige Teile zeigen ihre Zusammenfassung.
  await expect(
    page.getByRole('button', { name: /Einkommen mindestens 2\.800 € netto Ändern/ }),
  ).toBeVisible();
  if (bilder) {
    await barrierefrei(page, 'Rutsch Selbstauskunft');
    await page.screenshot({
      path: 'docs/screenshots/m4-rutsch-selbstauskunft.png',
      fullPage: true,
    });
  }
  await weiterSA.click();

  // R1: nächste Unterlage für Max mit Hilfesatz; hochladen.
  await expect(page.getByText(/^2 von \d+$/)).toBeVisible();
  const erste = await page.getByRole('heading', { level: 1 }).innerText();
  if (bilder) {
    await barrierefrei(page, 'Rutsch Schritt');
    await page.screenshot({ path: 'docs/screenshots/stilc-rutsch-schritt.png' });
  }
  // Falsche Datei gewählt: „Abbrechen“ führt zurück zum Schritt, nichts ist gespeichert.
  await page.locator('[data-feld="pdf"]').setInputFiles(await pdfDatei(info, 'falsch.pdf'));
  await expect(page.getByText('falsch.pdf, 1 Seite')).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByText('falsch.pdf, 1 Seite')).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(erste);
  await expect(page.getByText(/^2 von \d+$/)).toBeVisible();
  // Oder gleich eine andere Datei wählen, ohne Umweg.
  await page.locator('[data-feld="pdf"]').setInputFiles(await pdfDatei(info, 'falsch.pdf'));
  await expect(page.getByText('falsch.pdf, 1 Seite')).toBeVisible();
  await page.getByLabel('Andere Datei wählen').setInputFiles(await pdfDatei(info, 'erste.pdf'));
  await expect(page.getByText('erste.pdf, 1 Seite')).toBeVisible();
  if (bilder) await page.screenshot({ path: 'docs/screenshots/stilc-rutsch-gewaehlt.png' });
  // Gehaltsnachweise: September ist vorbelegt (6. November, Abrechnung meist spät).
  await expect(page.getByRole('radio', { name: 'September' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: 'Speichern und weiter' }).click();

  // Serie (RS1): Monatsmarken, der nächste Monat als Kachel, „Weiter zur nächsten Unterlage“.
  await expect(
    page.getByText('September ist drin. Noch zwei Monate, der neueste zuerst.'),
  ).toBeVisible();
  await expect(page.getByText('Juli und August bleiben auf der Übersicht offen.')).toBeVisible();
  if (bilder) {
    await barrierefrei(page, 'Rutsch Serie');
    await page.screenshot({ path: 'docs/screenshots/stilc-rutsch-serie.png' });
  }
  // Eine Seite gehört zu genau einem Monat (OR3): Die Wahl ersetzt die Vorbelegung.
  await page.locator('[data-feld="pdf"]').setInputFiles(await pdfDatei(info, 'juli-august.pdf'));
  await page.getByRole('radio', { name: 'Juli' }).click();
  await expect(page.getByRole('radio', { name: 'Juli' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: 'August' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  if (bilder) {
    await barrierefrei(page, 'Rutsch mehrere Monate');
    await page.screenshot({ path: 'docs/screenshots/rs2-mehrere-monate.png', fullPage: true });
  }
  await page.getByRole('button', { name: /Speichern und weiter/ }).click();
  await page.getByRole('button', { name: /Weiter zur nächsten/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(erste);

  // Überspringen, dann Pause: zurück zur Übersicht mit „Weitermachen“.
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await page.getByRole('link', { name: 'Pause' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Weitermachen/ })).toBeVisible();
  if (bilder) {
    await barrierefrei(page, 'Übersicht pausiert');
    await page.screenshot({
      path: 'docs/screenshots/stilc-uebersicht-pausiert.png',
      fullPage: true,
    });
  }

  // Weitermachen setzt bei Leas Selbstauskunft fort: Haustiere und Ort hat der Haushalt schon (A2).
  await page.getByRole('link', { name: /^Weitermachen/ }).click();
  await expect(page.getByText(/^4 von \d+$/)).toBeVisible();
  await expect(page.getByText('Für Lea', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Was für den ganzen Haushalt gilt, hat Max schon eingetragen.'),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Von Max: Drei Personen ziehen ein (zwei im Mietvertrag, ein Kind), eine Katze, Hamburg',
    ),
  ).toBeVisible();
  await expect(page.getByText(/^Noch 3 Teile\.$/)).toBeVisible();
  // Alles Restliche überspringen bis zum Ende.
  const ende = page.getByRole('heading', { level: 1, name: 'Gut gemacht.' });
  const zaehler = page.getByText(/^\d+ von \d+$/);
  while (!(await ende.isVisible())) {
    const vorher = await zaehler.innerText();
    await page.getByRole('button', { name: /^(Überspringen|Noch nicht da)$/ }).click();
    await expect(ende.or(zaehler.filter({ hasNotText: vorher }))).toBeVisible();
  }
  await expect(page.locator('.lead')).toContainText('Zwei Unterlagen sind drin.');
  if (bilder) {
    await barrierefrei(page, 'Rutsch Ende');
    await page.screenshot({ path: 'docs/screenshots/stilc-rutsch-ende.png' });
  }
  await page.getByRole('link', { name: 'Zur Übersicht' }).click();

  // Tab „Mappe“ (B12b): je Person ein Blatt mit Reiter, Kind, Trennzeile, Bürgin darunter.
  await expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible();
  await expect(page.locator('.blatt .reiter')).toHaveText([/Max/, /Lea/, /Petra/]);
  await expect(page.locator('.blatt').filter({ hasText: 'Petra' })).toContainText('Bürgin');
  await expect(page.getByText('Zusätzlich, falls der Vermieter fragt')).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: 'Haushalt bearbeiten: Zwei im Mietvertrag, ein Kind zieht mit ein. Eine Person bürgt.',
    }),
  ).toBeVisible();
  await expect(page.getByText('Zusätzlich, falls der Vermieter fragt')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Unterlagen hinzufügen/ })).toBeVisible();
  if (bilder) {
    await barrierefrei(page, 'Übersicht');
    await page.screenshot({ path: 'docs/screenshots/stilc-uebersicht.png', fullPage: true });
    await page.emulateMedia({ colorScheme: 'dark' });
    await barrierefrei(page, 'Übersicht dunkel');
    await page.screenshot({ path: 'docs/screenshots/stilc-uebersicht-dunkel.png', fullPage: true });
    await page.emulateMedia({ colorScheme: 'light' });
  }

  // Personenansicht: ohne „zum Haushalt“, zurück heißt „Übersicht“.
  await page.getByRole('link', { name: /^Max Hauptmieter$/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Max', exact: true })).toBeVisible();
  await expect(page.getByText('zum Haushalt')).toHaveCount(0);
  await expect(page.locator('a.zurueck')).toBeVisible();

  // Selbstauskunft auf eigener Seite: ausgefüllt, als PDF ansehen zeigt sie in der Seitenansicht.
  await page.getByRole('link', { name: /^Selbst.?auskunft/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Selbst.?auskunft/ })).toBeVisible();
  await expect(page.getByText('Von Max. Änderungen werden sofort gespeichert.')).toBeVisible();
  await expect(page.getByText('Fertig, 1 Seite')).toBeVisible();
  if (bilder) {
    await barrierefrei(page, 'Selbstauskunft');
    await page.screenshot({ path: 'docs/screenshots/m4-selbstauskunft.png', fullPage: true });
  }
  // Kein neuer Tab, kein Download: die Seitenansicht von Hefta.
  let neuerTab = false;
  page.context().once('page', () => (neuerTab = true));
  await page.getByRole('button', { name: 'Als PDF ansehen' }).click();
  const ansicht = page.getByRole('dialog', { name: 'Seite 1 von 1' });
  await expect(ansicht).toBeVisible();
  await ansicht.getByRole('button', { name: 'Fertig' }).click();
  await expect(ansicht).toBeHidden();
  expect(neuerTab).toBe(false);
  await page.getByRole('button', { name: 'Fertig', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Max', exact: true })).toBeVisible();

  // Angaben ändern auf eigenem Bildschirm: Lebenssituation wechselt den Einkommensnachweis.
  await page.getByRole('link', { name: 'Ändern', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Max ändern' })).toBeVisible();
  await page.getByLabel(/Einkommen\?$/).selectOption({ label: 'Selbstständig oder freiberuflich' });
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Max', exact: true })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Einkommens' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Gehalts' })).toHaveCount(0);

  // Haushalt bearbeiten über die Kopfzeile: Petra herausnehmen.
  await page.locator('a.zurueck').click();
  await page.getByRole('link', { name: /^Haushalt bearbeiten: / }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Euer Haushalt' })).toBeVisible();
  if (bilder) {
    await barrierefrei(page, 'Haushalt');
    await page.screenshot({ path: 'docs/screenshots/stilc-haushalt.png', fullPage: true });
  }
  // Petras Seite in zwei Abschnitten (K3b); herausnehmen ist umkehrbar und braucht keine Rückfrage.
  await page.getByRole('link', { name: 'Ändern Petra' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'In eurem Haushalt' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Über Petra' })).toBeVisible();
  if (bilder) {
    await barrierefrei(page, 'Person ändern');
    await page.screenshot({ path: 'docs/screenshots/k-person-aendern.png', fullPage: true });
  }
  await page.getByRole('button', { name: 'Aus diesem Haushalt nehmen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Euer Haushalt' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ändern Petra' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Herausgenommen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zurückholen Petra' })).toBeVisible();
  if (bilder) {
    await barrierefrei(page, 'Haushalt mit Herausgenommenen');
    await page.screenshot({ path: 'docs/screenshots/k-herausgenommen.png', fullPage: true });
  }

  // „Wer bürgt?“ zeigt zuerst „Schon in Hefta“ (K1); Petra kommt mit allem zurück (K2).
  await page.getByRole('link', { name: /Bürge hinzufügen/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Schon in Hefta' })).toBeVisible();
  if (bilder) await page.screenshot({ path: 'docs/screenshots/k-schon-in-mappe.png' });
  await page.getByRole('button', { name: /Petra Mustermann/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Petra kommt dazu' })).toBeVisible();
  if (bilder) {
    await barrierefrei(page, 'Bekannte Person');
    await page.screenshot({ path: 'docs/screenshots/k-kommt-dazu.png', fullPage: true });
  }
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Euer Haushalt' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Herausgenommen' })).toHaveCount(0);

  // Namensabgleich (K1b): Lea herausnehmen, dann als „neue“ Lea Mustermann eintippen.
  await page.getByRole('link', { name: 'Ändern Lea' }).click();
  await page.getByRole('button', { name: 'Aus diesem Haushalt nehmen' }).click();
  await page.getByRole('link', { name: /Weitere Person im Vertrag|Mitmieter hinzufügen/ }).click();
  await page.getByRole('button', { name: /Neue Person anlegen/ }).click();
  await page.getByLabel('Vorname').fill('lea');
  await page.getByLabel('Nachname').fill('mustermann');
  await expect(page.getByRole('status')).toContainText('ist schon in Hefta');
  await page.getByRole('button', { name: 'Nehmen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lea kommt dazu' })).toBeVisible();
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Euer Haushalt' })).toBeVisible();

  // Ganz löschen als eigener Schritt (K4b), aus „Petra ändern“.
  await page.getByRole('link', { name: 'Ändern Petra' }).click();
  await page.getByRole('link', { name: 'Petra ganz löschen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Petra ganz löschen?' })).toBeVisible();
  await expect(page.getByRole('listitem').first()).toHaveText('Petra Mustermann');
  if (bilder) {
    await barrierefrei(page, 'Ganz löschen');
    await page.screenshot({ path: 'docs/screenshots/k-ganz-loeschen.png', fullPage: true });
  }
  await page.getByRole('button', { name: 'Petra löschen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Euer Haushalt' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ändern Petra' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Herausgenommen' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Fertig', exact: true }).click();
  await expect(page.locator('.blatt')).toHaveCount(2);

  // Nach dem Neuladen ist alles noch da.
  await page.reload();
  await expect(page.locator('.blatt')).toHaveCount(2);

  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('Backup mit Passwort: sichern, alles löschen, einspielen ergibt denselben Haushalt', async ({
  page,
  browserName,
}, info) => {
  await haushaltDesAuftraggebers(page);
  await page.getByRole('button', { name: 'Später', exact: true }).click();
  await expect(page.getByText('Noch kein Backup')).toBeVisible();
  await page.getByRole('link', { name: 'Jetzt sichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Backup erstellen' })).toBeVisible();
  // E25: Langform mit Namen, keine Summe
  await expect(page.getByText('Im Mietvertrag', { exact: true })).toBeVisible();
  await expect(page.getByText('Ein Kind', { exact: true })).toBeVisible();
  await expect(page.getByText('Bürgt', { exact: true })).toBeVisible();

  // Ungleiche Passwörter: Fehler erst nach Verlassen des zweiten Felds (S4), zu kurz sperrt.
  await page.getByLabel('Passwort', { exact: true }).fill('Sommer in Hamburg');
  await page.getByLabel('Noch einmal').fill('Sommer in Hambur');
  await expect(page.getByText('Die beiden Passwörter sind nicht gleich.')).toHaveCount(0);
  await page.getByLabel('Noch einmal').blur();
  await expect(page.getByText('Die beiden Passwörter sind nicht gleich.')).toBeVisible();
  await page.getByLabel('Noch einmal').fill('Sommer in Hamburg');
  await expect(page.getByText('Die beiden Passwörter sind nicht gleich.')).toHaveCount(0);
  if (browserName === 'chromium') await barrierefrei(page, 'Backup erstellen');

  // Ohne Teilen-Blatt im Test-Browser: Der Knopf lädt die Datei direkt herunter.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Backup sichern' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^hefta-backup-\d{4}-\d{2}-\d{2}\.hefta$/);
  const pfad = info.outputPath(download.suggestedFilename());
  await download.saveAs(pfad);
  await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
  await expect(page.getByText('Gesichert. Letztes Backup: gerade eben.')).toBeVisible();
  await expect(page.getByText('Letztes heute')).toBeVisible();
  if (browserName === 'chromium') await barrierefrei(page, 'Einstellungen');

  // Alles löschen als eigener Bildschirm (S9): Zahlen, Backup ist frisch, also kein Hinweis.
  await page.getByRole('link', { name: /^Alles löschen/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Alles löschen?' })).toBeVisible();
  await expect(page.getByText('Im Mietvertrag', { exact: true })).toBeVisible();
  await expect(page.getByText('Ein Kind', { exact: true })).toBeVisible();
  await expect(page.getByText('Erst Backup erstellen')).toHaveCount(0);
  if (browserName === 'chromium') await barrierefrei(page, 'Alles löschen');
  await page.getByRole('button', { name: 'Alles endgültig löschen' }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Fang an, wo du gerade bist' }),
  ).toBeVisible();

  // Einspielen (S6–S8): falsches Passwort, dann richtiges.
  // Ohne Haushalt am iPhone in Safari: erst der Hinweis auf die App (E30), dann das Einspielen.
  await page.goto('/#/einstellungen');
  await page.getByRole('link', { name: /^Backup einspielen/ }).click();
  await page.getByRole('button', { name: 'Weiter im Browser', exact: true }).click();
  await page.locator('input[type=file]').first().setInputFiles(pfad);
  await expect(page.getByRole('heading', { level: 1, name: 'Backup einspielen' })).toBeVisible();
  await expect(page.getByText('Sichtbar nach dem Passwort')).toBeVisible();
  // Die App ist leer: kein Hinweis „ersetzt alles“.
  await expect(page.getByText(/ersetzt alles/)).toHaveCount(0);
  await page.getByLabel('Passwort des Backups').fill('falsch');
  await page.getByRole('button', { name: 'Einspielen' }).click();
  await expect(page.getByText(/Das Passwort passt nicht\. Achte auf/)).toBeVisible();
  await expect(page.getByLabel('Passwort des Backups')).toBeFocused();
  await expect(page.getByLabel('Passwort des Backups')).toHaveValue('falsch');
  // E25: vor dem Passwort nur Datum und „mit Passwort“, keine Zählung
  await expect(page.getByText(/^Vom .*, mit Passwort, /)).toBeVisible();
  await expect(page.getByText('Bürgt', { exact: true })).toHaveCount(0);
  if (browserName === 'chromium') await barrierefrei(page, 'Backup einspielen');

  await page.getByLabel('Passwort des Backups').fill('Sommer in Hamburg');
  await page.getByLabel('Passwort des Backups').press('Enter');
  await expect(page.getByText('Bürgt', { exact: true })).toHaveCount(1);
  await expect(page.getByText(/Erstellt am /)).toBeVisible();
  await page.getByRole('button', { name: 'Einspielen' }).click();
  await expect(
    page.getByText(
      /^Eingespielt, Stand \d.*: \d+ Unterlagen?\. Zwei im Mietvertrag, ein Kind zieht mit ein\. Eine Person bürgt\.$/,
    ),
  ).toBeVisible();

  // Vom ersten Start aus geht es gleich auf die Übersicht: Dahinter liegt kein alter Startbildschirm.
  await expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible();
  await expect(page.locator('.blatt')).toHaveCount(3);
  await expect(
    page.getByRole('link', {
      name: 'Haushalt bearbeiten: Zwei im Mietvertrag, ein Kind zieht mit ein. Eine Person bürgt.',
    }),
  ).toBeVisible();
  await expect(page.getByText('Letztes Backup heute')).toBeVisible();
});
