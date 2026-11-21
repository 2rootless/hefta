import { expect, test } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// PC187, Lücke aus CP110 (DP116, Frage 2): Fehlt im Rutsch nur das Netto, sagt der Satz über dem blassen Knopf
// genau das Feld: „Es fehlt noch: Netto im Monat.“, wie auf der Seite der Selbstauskunft (eine Quelle).

test('Rutsch: Fehlt nur das Netto, steht „Es fehlt noch: Netto im Monat.“ über dem Knopf', async ({
  page,
}) => {
  await szenarioLaden(page, '28-nur-netto', '/rutsch');
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Selbstauskunft');
  await page.getByRole('button', { name: /^Ausfüllen/ }).click();
  const satz = page.locator('.leiste').getByText(/^Es fehlt noch:/);
  await expect(satz).toHaveText(
    `Es fehlt noch: Netto${String.fromCharCode(0xa0)}im${String.fromCharCode(0xa0)}Monat.`,
  );
  // Gegenprobe: nicht der Name des Teils, kein anderes Feld.
  await expect(page.locator('.leiste')).not.toContainText('Es fehlt noch: Einkommen');
  await expect(page.locator('.leiste')).not.toContainText('Telefon');
  // Mit Netto ist der Satz weg.
  await page
    .getByLabel(/^Netto/)
    .first()
    .fill('2800');
  await expect(satz).toHaveCount(0);
});
