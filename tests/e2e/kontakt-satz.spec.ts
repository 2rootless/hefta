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
