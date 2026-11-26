import { expect, test } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// PC208, Schritt 5 (E376, W28; DP134, Abschnitt 1): Der Wohnberechtigungsschein ist in der App eine freiwillige Angabe
// beim Haushalt. Ein Ja zeigt unter „Mappe“, „Für den ganzen Haushalt“: „Ihr habt einen. Noch nicht abgelegt.“

test('WBS in der App: Ja in der Selbstauskunft, Unterzeile unter „Für den ganzen Haushalt“', async ({
  page,
}) => {
  await szenarioLaden(page, '01-standard', '/');
  const abschnitt = page.locator('section.haushalt-unterlagen');
  await expect(abschnitt).toContainText('Nur für Sozialwohnungen.');
  await page.evaluate(() => (window.location.hash = '#/selbstauskunft/p-01-standard-0'));
  await page.getByRole('button', { name: /^Für euren ganzen Haushalt/ }).click();
  const gruppe = page.getByRole('radiogroup', { name: 'Wohnberechtigungsschein' });
  await expect(gruppe).toBeVisible();
  await expect(page.getByText('Nur für eine Sozialwohnung. Sonst frei lassen.')).toBeVisible();
  await gruppe.getByRole('radio', { name: 'Ja' }).click();
  // Der Teil bleibt offen: Die Angabe ist freiwillig und schließt nichts.
  await expect(gruppe).toBeVisible();
  await page.waitForTimeout(700);
  await page.evaluate(() => (window.location.hash = '#/'));
  await expect(abschnitt).toContainText(/(Ihr habt|Du hast) einen\. Noch nicht abgelegt\./);
  // Gegenprobe: Nein zeigt wieder den gewohnten Satz.
  await page.evaluate(() => (window.location.hash = '#/selbstauskunft/p-01-standard-0'));
  await page.getByRole('button', { name: /^Für euren ganzen Haushalt/ }).click();
  await page
    .getByRole('radiogroup', { name: 'Wohnberechtigungsschein' })
    .getByRole('radio', { name: 'Nein' })
    .click();
  await page.waitForTimeout(700);
  await page.evaluate(() => (window.location.hash = '#/'));
  await expect(abschnitt).toContainText('Nur für Sozialwohnungen.');
});
