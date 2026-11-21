import { expect, test } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// PC64, Punkt 7, und DP50: Oben im Teil „Kontakt“ steht, wofür er da ist und dass eine Angabe reicht. Das
// stimmt (W10): Der Teil ist fertig, sobald Telefon oder E-Mail da ist (selbstauskunft.test.ts, nur E-Mail).
// Das leere zweite Feld sagt dann „freiwillig“.
test('Kontakt: Satz oben im Teil, eine Angabe reicht, das zweite Feld ist freiwillig', async ({
  page,
}) => {
  await szenarioLaden(page, '02-neustart', '/selbstauskunft/p-02-neustart-0');
  const knopf = page.getByRole('button', { name: /Kontakt/ }).first();
  if (await knopf.isVisible().catch(() => false)) await knopf.click();
  const satz = page.getByText(
    'Darüber meldet sich der Vermieter. Eine Angabe reicht, Telefon oder E-Mail; die zweite ist freiwillig.',
  );
  await expect(satz).toBeVisible();
  const telefon = page.getByRole('textbox', { name: /^Telefon/ });
  const email = page.getByRole('textbox', { name: /^E-Mail/ });
  // Der Satz steht über den Feldern.
  expect((await satz.boundingBox())!.y).toBeLessThan((await telefon.boundingBox())!.y);
  await telefon.fill('0171 3920007');
  await expect(email).toHaveAttribute('placeholder', 'freiwillig');
  await expect(telefon).not.toHaveAttribute('placeholder', /./);
  await telefon.fill('');
  await email.fill('max@example.com');
  await expect(telefon).toHaveAttribute('placeholder', 'freiwillig');
});

// PC130 K7: Der Satz steht im offenen Teil einmal, nicht noch einmal im Kopf. Zugeklappt steht der kurze Satz, denn
// dort fehlt der lange; seit DP49 (Liste 8) heißt er „Eine Angabe reicht, Telefon oder E-Mail“ (2.1).
test('K7: „Eine Angabe genügt/reicht“ steht im offenen Teil „Kontakt“ einmal', async ({ page }) => {
  await szenarioLaden(page, '02-neustart', '/selbstauskunft/p-02-neustart-0');
  const knopf = page.getByRole('button', { name: /^Kontakt/ }).first();
  if (await knopf.isVisible().catch(() => false)) {
    // Zugeklappt: der kurze Satz, einmal.
    await expect(knopf).toContainText('Eine Angabe reicht, Telefon oder E-Mail');
    await knopf.click();
  }
  const offen = page.locator('section.teil.offen');
  await expect(
    offen.getByText('Eine Angabe reicht, Telefon oder E-Mail; die zweite ist freiwillig.'),
  ).toBeVisible();
  await expect(offen.getByText(/Eine Angabe (genügt|reicht)/)).toHaveCount(1);
});
