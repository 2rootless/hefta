import { expect, test, type Page } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// DP145 (PC212) und DP148: Befunde von Design am Bau, je mit Gegenprobe. Die Teile zum Bogen im Browser entfielen mit
// E385 (PC214); dafür gibt es tests/e2e/ohne-haushalt.spec.ts.

const STRICH = /rgb\(\d+, \d+, \d+\) 0px 3px 0px 0px/;

/** Der Schatten des Felds im Fokus und ohne. Seit DP148, K3 steht der Strich sofort; `poll` wartet nur aufs Zeichnen. */
async function schattenPruefen(page: Page, feld: ReturnType<Page['locator']>, linie: boolean) {
  const schatten = () => feld.evaluate((e) => getComputedStyle(e).boxShadow);
  // Der Strich gilt dem Tastaturfokus (:focus-visible). WebKit unter Linux wertet einen Fokus per Skript nach einem
  // Mausklick nicht so; ein Tastendruck vorher macht die Tastatur zur letzten Eingabe, wie beim echten Tab.
  await page.keyboard.press('Shift');
  await feld.focus();
  await expect.poll(schatten).toMatch(STRICH);
  if (linie) expect(await schatten()).toMatch(/inset/);
  // Gegenprobe: ohne Fokus kein Strich. Der Fokus geht auf ein anderes Feld; `blur()` löst ihn in Chromium am
  // Datumsfeld nicht.
  await page.locator('main input:not([type="date"])').last().focus();
  await expect.poll(schatten).not.toMatch(STRICH);
}

test('B3: Fokusstrich in den Feldern des Formblatts und am Datumsfeld der Bürgschaft (W33)', async ({
  page,
}) => {
  await szenarioLaden(page, '04-fertig', '/selbstauskunft/p-04-fertig-0');
  const zu = page.locator('main .formblatt button[aria-expanded="false"]').first();
  await expect(page.locator('main .formblatt').first()).toBeVisible();
  if (!(await page.locator('main .formblatt .eingabe input').first().isVisible())) await zu.click();
  const feld = page.locator('main .formblatt .eingabe input').first();
  await expect(feld).toBeVisible();
  // Die Feldlinie bleibt im Fokus.
  await schattenPruefen(page, feld, true);

  // Das Datumsfeld der Bürgschaft (seit E385 die der App, auch ohne Haushalt).
  await page.goto('/__leer');
  await page.goto('/#/buergschaft');
  await page.locator('main h1').waitFor();
  await page.getByRole('textbox', { name: 'Vorname' }).fill('Hiltrud');
  await page.getByRole('textbox', { name: 'Nachname' }).fill('Ostendorp');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page
    .getByRole('button', { name: /^Wohnung/ })
    .first()
    .click();
  const datum = page.locator('main input[type="date"]');
  await schattenPruefen(page, datum, false);
});

test('B4: „Eigene Auswahl“ verspricht keine Ausweiskopie', async ({ page }) => {
  await szenarioLaden(page, '04-fertig', '/mappe');
  await expect(page.getByText('Unterlage für Unterlage', { exact: true })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Ausweiskopie');
});

test('K3: Der Fokusstrich blendet nicht über, auch nicht bei „Bewegung reduzieren“; nur die Fläche darf', async ({
  page,
}) => {
  await szenarioLaden(page, '04-fertig', '/selbstauskunft/p-04-fertig-0');
  const zu = page.locator('main .formblatt button[aria-expanded="false"]').first();
  if (!(await page.locator('main .formblatt .eingabe input').first().isVisible())) await zu.click();
  const feld = page.locator('main .formblatt .eingabe input').first();
  const uebergang = () => feld.evaluate((e) => getComputedStyle(e).transitionProperty);
  expect(await uebergang()).not.toContain('box-shadow');
  await feld.focus();
  // Gleich nach dem Fokus steht der Strich ganz da (kein Zwischenwert wie 1.8px).
  expect(await feld.evaluate((e) => getComputedStyle(e).boxShadow)).toMatch(STRICH);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await feld.evaluate((e) => getComputedStyle(e).transitionDuration)).toMatch(/^0s/);
});

test('K1 und K2: Die Ausweiskopie bleibt gespeichert und kommt in keine Mappe; kein „Braucht ihr sie doch“', async ({
  page,
}) => {
  await szenarioLaden(
    page,
    '25-unterlage-seiten',
    '/unterlage/p-25-unterlage-seiten-0/ausweiskopie',
  );
  const main = page.locator('main');
  await expect(main).toContainText('Bleibt gespeichert, kommt aber in keine Mappe.');
  await expect(main.getByRole('button', { name: 'Warum?' }).first()).toBeVisible();
  await expect(main).not.toContainText('doch');
  await expect(main).not.toContainText('Eine Kopie muss nicht in die Mappe.');
  // K2: Auf der Personenseite sagt die Gruppe, in der nur die Kopie liegt, dasselbe; Gegenprobe: „standardmäßig“ fehlt.
  await page.goto('/#/person/p-25-unterlage-seiten-0');
  await page.locator('main h1').first().waitFor();
  await page.getByRole('button', { name: /^Meist unnötig/ }).click();
  await expect(main).toContainText('Bleibt gespeichert, kommt aber in keine Mappe.');
  await expect(main).not.toContainText('standardmäßig');
});
