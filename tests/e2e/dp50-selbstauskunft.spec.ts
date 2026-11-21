import { expect, test, type Page } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// DP50, „Nachfrage in der gebauten Selbstauskunft“: Nummer und Pfeil der geschlossenen Teile stehen an
// der ersten Zeile, nicht mittig. Bei 320 px mit 130 % steht der Knopf über „Angaben löschen“, in voller
// Breite. (Die Nachfrage selbst ist seit DP49b der Tintenrand, getestet in wunsch-w33.)

async function rutschStart(page: Page) {
  await szenarioLaden(page, '02-neustart', '/rutsch');
  await page.getByRole('button', { name: /^Los geht/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Selbstauskunft' })).toBeVisible();
}

test('Geschlossene Teile: Nummer und Pfeil an der ersten Zeile, auch bei zweizeiligem Titel', async ({
  page,
}) => {
  await page.setViewportSize({ width: 340, height: 800 });
  await rutschStart(page);
  const lagen = await page.locator('button.teil.zu').evaluateAll((teile) =>
    teile.map((t) => {
      const top = (s: string) => t.querySelector(s)!.getBoundingClientRect().top;
      const titel = t.querySelector('.tx b')!;
      const zeilen = Math.round(
        titel.getBoundingClientRect().height / parseFloat(getComputedStyle(titel).lineHeight),
      );
      return { nr: top('.nummer') - top('.tx b'), pfeil: top('.pfeil') - top('.tx b'), zeilen };
    }),
  );
  // Gegenprobe-Fall: Mindestens ein Teil hat einen Titel über zwei Zeilen; mittig stünde die Nummer
  // dort deutlich tiefer.
  expect(lagen.some((l) => l.zeilen >= 2)).toBe(true);
  for (const l of lagen) {
    expect(Math.abs(l.nr)).toBeLessThan(6);
    expect(Math.abs(l.pfeil)).toBeLessThan(6);
  }
});

test('320 px mit 130 %: „Weiter“ über „Angaben löschen“, in voller Breite', async ({ page }) => {
  await rutschStart(page);
  await page.setViewportSize({ width: 246, height: 437 });
  await page.getByRole('button', { name: 'Ausfüllen' }).click();
  await page.getByLabel('Telefon', { exact: true }).fill('0171 3920001');
  const weiter = page.getByRole('button', { name: /^Weiter/ }).first();
  const loeschen = page.getByRole('button', { name: 'Angaben löschen' });
  await expect(weiter).toBeVisible();
  await expect(loeschen).toBeVisible();
  const w = await weiter.evaluate((e) => e.getBoundingClientRect().toJSON() as DOMRect);
  const l = await loeschen.evaluate((e) => e.getBoundingClientRect().toJSON() as DOMRect);
  const fuss = await weiter.evaluate(
    (e) => e.closest('.teil-fuss')!.getBoundingClientRect().toJSON() as DOMRect,
  );
  expect(w.bottom).toBeLessThanOrEqual(l.top + 1);
  expect(Math.abs(w.width - fuss.width)).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});
