import { expect, test } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// PC207, 1 (E379, E380): Nach dem Update sagt die Mappe einmal, dass abgelegte Ausweiskopien und Datenkopien gespeichert
// bleiben, aber in keine Mappe mehr kommen. Nur, wenn es solche gibt.

test('PC207, 1: Hinweis einmal, nur mit abgelegter Ausweiskopie; „Schließen“ merkt es sich', async ({
  page,
}) => {
  await szenarioLaden(page, '25-unterlage-seiten', '/');
  const hinweis = page.getByText('Ausweiskopie und Datenkopie bleiben draußen.');
  await expect(hinweis).toBeVisible();
  await page.getByRole('status').getByRole('button', { name: 'Schließen' }).click();
  await expect(hinweis).toHaveCount(0);
  await page.reload();
  await page.locator('main h1, main h2').first().waitFor();
  await expect(hinweis).toHaveCount(0);
  // Gegenprobe: ohne abgelegte Ausweiskopie kein Hinweis.
  await szenarioLaden(page, '01-standard', '/');
  await expect(page.getByText('Ausweiskopie und Datenkopie bleiben draußen.')).toHaveCount(0);
});
