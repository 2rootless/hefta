import { expect, test } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { cspMelden } from './hilfen';
import { szenarioLaden } from './szenario-laden';

// PC127 (DP83 c, N4 d) für 2.0.1: Unter „Erste Person im Mietvertrag.“ steht, wie man die Hauptmieterin herausnimmt,
// aber nur, wenn noch jemand im Mietvertrag steht. Steht sie allein darin, kommt kein Satz. Nur Musterdaten (W7).

const RAUS_IHR =
  'Zum Herausnehmen wählt zuerst „Bürgschaft“. Dann steht „Aus diesem Haushalt nehmen“ darunter.';
const RAUS = /^Zum Herausnehmen wähl/;

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
});

test('N4 d: mit Mitmieterin steht der Satz, und er stimmt; Gegenprobe an der Mitmieterin', async ({
  page,
}) => {
  // Max (Hauptmieter), Lea (im Vertrag), Petra (Bürgin): „ihr“.
  await szenarioLaden(page, '04-fertig', '/person-aendern/p-04-fertig-0');
  await expect(page.getByText('Erste Person im Mietvertrag.')).toBeVisible();
  await expect(page.getByText(RAUS_IHR)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aus diesem Haushalt nehmen' })).toHaveCount(0);
  // Der Satz stimmt: Nach „Bürgschaft“ steht „Aus diesem Haushalt nehmen“ darunter.
  await page.getByRole('radio', { name: 'Bürgschaft' }).click();
  await expect(page.getByRole('button', { name: 'Aus diesem Haushalt nehmen' })).toBeVisible();
  await expect(page.getByText(RAUS)).toHaveCount(0);

  // Gegenprobe: Lea ist nicht Hauptmieterin; bei ihr steht der Satz nicht.
  await page.evaluate(() => (window.location.hash = '#/person-aendern/p-04-fertig-1'));
  await expect(page.getByText('Steht mit im Mietvertrag.')).toBeVisible();
  await expect(page.getByText(RAUS)).toHaveCount(0);
});

test('N4 d: steht die Hauptmieterin allein im Vertrag, kommt kein Satz', async ({ page }) => {
  await haushaltMitMax(page);
  await page.goto('/#/haushalt');
  await page.getByRole('link', { name: 'Ändern Max' }).click();
  await expect(page.getByText('Erste Person im Mietvertrag.')).toBeVisible();
  await expect(page.getByText(RAUS)).toHaveCount(0);
});
