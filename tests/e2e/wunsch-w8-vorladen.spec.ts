import { expect, test, type Page } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// K14 (W8, PC139): Personenseite, Selbstauskunft und Unterlage sind auch beim ersten Öffnen nie leer. Hefta lädt
// sie kurz nach dem Start vor. Gemessen wird je Bild (requestAnimationFrame), ob `main` sichtbaren Text hat.
// Gegenprobe: Ohne Vorladen (`__heftaOhneVorladen`) gibt es leere Bilder. Nur Musterdaten (W7).

/** Leere Bilder in `main` während `tun` und 1,2 s danach. */
async function leereBilder(page: Page, tun: () => Promise<void>): Promise<number> {
  await page.evaluate(() => {
    const w = window as unknown as { __leer: number; __laeuft: boolean };
    w.__leer = 0;
    w.__laeuft = true;
    const schritt = () => {
      const main = document.querySelector('main');
      if (!main || main.innerText.trim().length === 0) w.__leer += 1;
      if (w.__laeuft) requestAnimationFrame(schritt);
    };
    requestAnimationFrame(schritt);
  });
  await tun();
  await page.waitForTimeout(1200);
  return page.evaluate(() => {
    const w = window as unknown as { __leer: number; __laeuft: boolean };
    w.__laeuft = false;
    return w.__leer;
  });
}

async function wege(page: Page): Promise<Record<string, number>> {
  await page.setViewportSize({ width: 390, height: 844 });
  await szenarioLaden(page, '04-fertig', '/');
  await page.locator('main h1').first().waitFor();
  // Zeit für das Vorladen nach dem Start.
  await page.waitForTimeout(1500);
  const ergebnis: Record<string, number> = {};
  ergebnis['Mappe → Personenseite'] = await leereBilder(page, () =>
    page.getByRole('link', { name: /^Max/ }).first().click(),
  );
  await expect(page.locator('main h1').first()).toHaveText(/^Max/);
  ergebnis['Personenseite → Selbstauskunft'] = await leereBilder(page, () =>
    page
      .getByRole('link', { name: /^Selbstauskunft/ })
      .first()
      .click(),
  );
  await page.locator('a.zurueck').click();
  await expect(page.locator('main h1').first()).toHaveText(/^Max/);
  ergebnis['Personenseite → Unterlage'] = await leereBilder(page, () =>
    page
      .getByRole('link', { name: /^Gehaltsnachweise/ })
      .first()
      .click(),
  );
  return ergebnis;
}

test('wunsch-W8 (K14): Personenseite, Selbstauskunft und Unterlage ohne leeres Bild', async ({
  page,
}) => {
  test.setTimeout(60_000);
  expect(await wege(page)).toEqual({
    'Mappe → Personenseite': 0,
    'Personenseite → Selbstauskunft': 0,
    'Personenseite → Unterlage': 0,
  });
});

test('wunsch-W8 (K14), Gegenprobe: ohne Vorladen ist beim ersten Öffnen ein Bild leer', async ({
  page,
  browserName,
}) => {
  // Gemessen in WebKit (CP77): 3 bis 5 leere Bilder. Chromium lädt die Dateien oft im selben Bild.
  test.skip(browserName !== 'webkit', 'nur WebKit');
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    (window as unknown as { __heftaOhneVorladen: boolean }).__heftaOhneVorladen = true;
  });
  const ergebnis = await wege(page);
  expect(Object.values(ergebnis).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
});
