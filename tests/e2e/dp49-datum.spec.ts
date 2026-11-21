import { expect, test, type Page } from '@playwright/test';
import { pdfMit, szenarioLaden } from './szenario-laden';

// DP49 Punkt 11: „Welches Datum?“ Hefta sucht zuerst auf den Seiten, die in die Mappe gehen; Daten auf
// ausgeschalteten Seiten zählen nur, wenn sonst keins passt. Bis drei Funde stehen alle in der Liste, ab vier
// nur die der gezeigten Seite, darunter „Auf Seite n: … weitere ›“. Antippen blättert.

async function hochladen(page: Page, seiten: string[]) {
  await szenarioLaden(page, '02-neustart', '/unterlage/p-02-neustart-0/bonitaet');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await page.locator('[data-feld="pdf"]').setInputFiles({
    name: 'auskunft.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit(seiten),
  });
}

const ansicht = (page: Page) => page.locator('dialog[open]').last();
const liste = (page: Page) => ansicht(page).getByRole('radiogroup', { name: 'Gefundene Daten' });

test('Ab vier Funden: nur die der gezeigten Seite, „Auf Seite 2: zwei weitere ›“ blättert hin', async ({
  page,
}) => {
  await hochladen(page, [
    'Bonitätsauskunft\nAusgestellt am 20.10.2026\nKunde seit 03.04.2019\nAnfrage vom 15.10.2026',
    // Ein Tag in der Zukunft („Gültig bis“) zählt nicht als Ausstellungstag.
    'Seite zwei\nStand 18.10.2026\nGeprüft am 16.10.2026\nGültig bis 31.12.2026',
  ]);
  await page.getByRole('button', { name: 'Im Dokument auswählen' }).click({ timeout: 30_000 });
  await expect(
    ansicht(page).getByText(/hat fünf Daten gefunden\. Hier stehen die der Seite/),
  ).toBeVisible();
  await expect(liste(page).getByRole('radio')).toHaveCount(3);
  const weiter = ansicht(page).getByRole('button', { name: 'Auf Seite 2: zwei weitere' });
  await expect(weiter).toBeVisible();
  await weiter.click();
  await expect(ansicht(page).getByText('Seite 2 von 2')).toBeVisible();
  await expect(liste(page).getByRole('radio')).toHaveCount(2);
  await expect(
    ansicht(page).getByRole('button', { name: 'Auf Seite 1: drei weitere' }),
  ).toBeVisible();
  // Gegenprobe: Ohne die Regel stünden alle fünf in der Liste.
  expect(await liste(page).getByRole('radio').count()).not.toBe(5);
});

test('Bis drei Funde alle mit Seite; eine ausgeschaltete Seite zählt nur, wenn sonst keins passt', async ({
  page,
}) => {
  await hochladen(page, [
    'Bonitätsauskunft\nAusgestellt am 20.10.2026',
    'Seite zwei\nKunde seit 03.04.2019',
    'Anhang\nAlter Stand 01.02.2020',
  ]);
  // Seite 3 geht nicht in die Mappe.
  const schalter = page.getByRole('checkbox', { name: 'Seite 3 kommt in die Mappe' });
  await schalter.click({ timeout: 30_000 });
  await expect(schalter).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Im Dokument auswählen' }).click();
  await expect(
    ansicht(page).getByText(
      /hat zwei Daten gefunden\. Antippen zeigt die Seite, auf der es steht\./,
    ),
  ).toBeVisible();
  await expect(liste(page).getByRole('radio')).toHaveCount(2);
  await expect(liste(page)).not.toContainText('01.02.2020');
  await expect(
    ansicht(page).getByText(
      'Seite 3 geht nicht in die Mappe. Ihre Daten zählen nur, wenn sonst keins passt.',
    ),
  ).toBeVisible();
  // Antippen blättert zur Seite des Datums.
  await liste(page)
    .getByRole('radio', { name: /03\.04\.2019/ })
    .click();
  await expect(ansicht(page).getByText('Seite 2 von 3')).toBeVisible();
});

test('Gegenprobe: Steht nur auf der ausgeschalteten Seite ein Datum, zählt es doch', async ({
  page,
}) => {
  await hochladen(page, ['Bonitätsauskunft ohne Datum', 'Anhang\nAusgestellt am 20.10.2026']);
  const schalter = page.getByRole('checkbox', { name: 'Seite 2 kommt in die Mappe' });
  await schalter.click({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Im Dokument auswählen' }).click();
  await expect(liste(page).getByRole('radio', { name: /20\.10\.2026/ })).toBeVisible();
});
