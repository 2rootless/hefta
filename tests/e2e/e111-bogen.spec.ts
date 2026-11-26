import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from '@cantoo/pdf-lib';

// E111 „Der Bogen selbst“ (DP134; PC205, Abschnitt 2; PC208, Schritt 4): die Selbstauskunft im Browser, ohne Haushalt.
// Namen aus der Namensliste (W40, W7), Telefon und Mail wie im Muster.

const BILDER = process.env.E111_BILDER ? 'docs/e111-bilder' : '';

async function bild(page: Page, name: string) {
  if (!BILDER) return;
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: `${BILDER}/${name}.png`, fullPage: true });
}

async function oeffnen(page: Page) {
  await page.goto('/__leer');
  await page.goto('/#/selbstauskunft');
  await page.locator('main h1').waitFor();
}

async function ausfuellen(
  page: Page,
  p: { vor: string; nach: string; tel: string; netto: string },
) {
  const blatt = page.locator('section.blatt');
  await blatt.getByRole('textbox', { name: 'Vorname' }).fill(p.vor);
  await blatt.getByRole('textbox', { name: 'Nachname' }).fill(p.nach);
  await blatt.getByRole('textbox', { name: 'Telefon' }).fill(p.tel);
  await blatt.getByRole('textbox', { name: 'Netto im Monat, in Euro' }).fill(p.netto);
  await blatt
    .getByRole('radiogroup', { name: 'Frage 1: Insolvenzverfahren' })
    .getByRole('radio', { name: 'Nein' })
    .click();
  await blatt
    .getByRole('radiogroup', { name: 'Frage 2: Räumungstitel' })
    .getByRole('radio', { name: 'Nein' })
    .click();
}

test('E111: ein Bogen, „Es fehlt noch“, PDF mit einer Seite, bleibt im Browser', async ({
  page,
}) => {
  await oeffnen(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Selbst.?auskunft/);
  await expect(page.getByRole('link', { name: 'Ratgeber' })).toHaveAttribute('href', '/ratgeber/');
  await expect(page.locator('.leiste')).toContainText(
    'Es fehlt noch: Vorname, Nachname, Kontakt, Netto, 2 Fragen',
  );
  await bild(page, '1-einstieg');
  // WBS unter HAUSHALT, als Gruppe mit Namen (E15).
  const wbs = page.getByRole('radiogroup', { name: 'Wohnberechtigungsschein' });
  await expect(wbs).toHaveCount(1);
  await ausfuellen(page, { vor: 'Jarne', nach: 'Ostendorp', tel: '0171 3920011', netto: '2.800' });
  await page.getByRole('textbox', { name: 'Ort für die Unterschrift' }).fill('Lüneburg');
  await expect(page.locator('.leiste')).not.toContainText('Es fehlt noch');
  // Der Satz unter einem Feld ist an das Feld gebunden (PC205, Abschnitt 2).
  const satz = await page
    .getByRole('textbox', { name: 'E-Mail' })
    .evaluate(
      (e) => document.getElementById(e.getAttribute('aria-describedby') ?? '')?.textContent,
    );
  expect(satz).toBe('Für den Kontakt reicht eine Angabe: Anschrift, Telefon oder E-Mail.');
  await bild(page, '2-ausgefuellt');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^PDF erstellen/ }).click();
  const datei = await download;
  expect(datei.suggestedFilename()).toBe('Selbstauskunft Jarne Ostendorp.pdf');
  const pdf = await PDFDocument.load(readFileSync((await datei.path())!));
  expect(pdf.getPageCount()).toBe(1);

  // Bleibt in diesem Browser: neu laden, alles ist noch da.
  await page.waitForTimeout(600);
  await page.reload();
  await page.locator('main h1').waitFor();
  await expect(page.getByRole('textbox', { name: 'Vorname' })).toHaveValue('Jarne');
});

test('E111: zwei Bögen mit Reitern, HAUSHALT gleich, eine Datei mit zwei Seiten; Übernehmen legt den Haushalt an', async ({
  page,
}) => {
  await oeffnen(page);
  await ausfuellen(page, { vor: 'Jarne', nach: 'Ostendorp', tel: '0171 3920011', netto: '2.800' });
  await page.getByRole('button', { name: /Weitere Person hinzufügen/ }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.locator('.leiste')).toContainText('Es fehlt noch bei der neuen Person');
  await ausfuellen(page, {
    vor: 'Selin',
    nach: 'Akgül',
    tel: '0171 3920012',
    netto: 'mindestens 3.100',
  });
  await expect(page.getByText('in allen Bögen gleich')).toBeVisible();
  await page
    .getByRole('radiogroup', { name: 'Wohnberechtigungsschein' })
    .getByRole('radio', { name: 'Ja' })
    .click();
  await page
    .getByRole('group', { name: 'Kinder' })
    .getByRole('button', { name: 'Mehr Kinder' })
    .click();
  // Reiter wechseln: Jarnes Bogen hat dieselbe Angabe unter HAUSHALT.
  await page.getByRole('tab', { name: /Jarne/ }).click();
  await expect(
    page
      .getByRole('radiogroup', { name: 'Wohnberechtigungsschein' })
      .getByRole('radio', { name: 'Ja' }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.leiste')).toContainText('2 Bögen in einer Datei');
  await bild(page, '3-zwei-boegen');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^PDF erstellen/ }).click();
  const datei = await download;
  expect(datei.suggestedFilename()).toBe('Selbstauskünfte Jarne Ostendorp und Selin Akgül.pdf');
  expect((await PDFDocument.load(readFileSync((await datei.path())!))).getPageCount()).toBe(2);

  // Übernehmen: der Kasten sagt, was geschieht, mit dem Schein (E15); danach gibt es den Haushalt.
  await page.getByRole('button', { name: 'Haushalt anlegen' }).click();
  await expect(
    page
      .getByRole('listitem')
      .filter({ hasText: 'Jarne und Selin stehen im Mietvertrag. Jarne ist Ansprechperson.' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('listitem')
      .filter({ hasText: /Der Wohnberechtigungsschein gehört dann zum Haushalt/ }),
  ).toBeVisible();
  await bild(page, '4-uebernehmen');
  await page.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('/#/selbstauskunft');
  await page.locator('main h1').waitFor();
  // Hier bleibt nichts doppelt.
  await expect(page.getByRole('textbox', { name: 'Vorname' })).toHaveValue('');
});

test('E17: ab 1600 px das Pult statt der Leiste, ab 2400 px zwei Bögen nebeneinander', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await oeffnen(page);
  await expect(page.locator('aside.pult')).toBeVisible();
  await expect(page.locator('.leiste')).toBeHidden();
  await bild(page, '5-1920');
  await page.setViewportSize({ width: 2560, height: 1440 });
  await ausfuellen(page, { vor: 'Jarne', nach: 'Ostendorp', tel: '0171 3920011', netto: '2.800' });
  await page.getByRole('button', { name: /Weitere Person hinzufügen/ }).click();
  await expect(page.locator('section.blatt')).toHaveCount(2);
  const [a, b] = await page
    .locator('section.blatt')
    .evaluateAll((l) => l.map((e) => e.getBoundingClientRect().x));
  expect(b! - a!).toBeGreaterThan(300);
  await bild(page, '6-2560');
});

test('Bilder: Vorlage der Bürgschaft (W63, DP135), 390 und 1920', async ({ page }) => {
  test.skip(!BILDER, 'nur mit E111_BILDER=1');
  await page.goto('/__leer');
  await page.goto('/#/buergschaft');
  await page.locator('main h1').waitFor();
  await bild(page, '7-buergschaft-390');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await bild(page, '8-buergschaft-1920');
});
