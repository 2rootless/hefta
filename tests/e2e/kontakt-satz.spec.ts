import { expect, test } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// PC64, Punkt 7: Unter den Kontaktangaben steht, dass eine Angabe reicht. Das stimmt (W10): Der Teil
// „Kontakt“ ist fertig, sobald Telefon oder E-Mail da ist (selbstauskunft.test.ts, nur E-Mail).
test('Kontakt: Satz unter den Angaben, eine Angabe reicht', async ({ page }) => {
  await szenarioLaden(page, '02-neustart', '/selbstauskunft/p-02-neustart-0');
  const knopf = page.getByRole('button', { name: /Kontakt/ }).first();
  if (await knopf.isVisible().catch(() => false)) await knopf.click();
  const satz = page.getByText('Eine Angabe reicht, die zweite ist freiwillig.');
  await expect(satz).toBeVisible();
  // Der Satz steht unter beiden Feldern.
  const unter = await page.evaluate(() => {
    const s = [...document.querySelectorAll('p.hinweis')].find((p) =>
      p.textContent?.includes('Eine Angabe reicht'),
    )!;
    const mail = document.querySelector('[data-feld="email"]')!;
    return s.getBoundingClientRect().top > mail.getBoundingClientRect().bottom;
  });
  expect(unter).toBe(true);
});

// PC130 K7: Der Satz steht im offenen Teil einmal, nicht noch einmal als „Eine Angabe genügt“ im Kopf. Zugeklappt
// steht der kurze Satz, denn dort fehlt der lange.
test('K7: „Eine Angabe genügt/reicht“ steht im offenen Teil „Kontakt“ einmal', async ({ page }) => {
  await szenarioLaden(page, '02-neustart', '/selbstauskunft/p-02-neustart-0');
  const knopf = page.getByRole('button', { name: /^Kontakt/ }).first();
  if (await knopf.isVisible().catch(() => false)) {
    // Zugeklappt: der kurze Satz, einmal.
    await expect(knopf).toContainText('Eine Angabe genügt');
    await knopf.click();
  }
  const offen = page.locator('section.teil.offen');
  await expect(offen.getByText('Eine Angabe reicht, die zweite ist freiwillig.')).toBeVisible();
  await expect(offen.getByText(/Eine Angabe (genügt|reicht)/)).toHaveCount(1);
});
