import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';

// wunsch-W36 (Fassung 20, PC88): Logo und Einstellungen stehen im Kopf von „Mappe“ und „Wohnungen“ gleich, in Lage
// und Größe. Gemessen wie DP63c, Abschnitt 8: linke obere Ecke von Logo und Knopf „Einstellungen“.

async function kopf(page: Page) {
  return page.evaluate(() => {
    const kasten = (e: Element | null) => {
      const r = e!.getBoundingClientRect();
      return {
        x: Math.round(r.left),
        y: Math.round(r.top),
        b: Math.round(r.width),
        h: Math.round(r.height),
      };
    };
    const logo =
      [...document.querySelectorAll('header img')].find(
        (i) => i.getBoundingClientRect().width > 0,
      ) ?? null;
    return {
      logo: kasten(logo),
      einstellungen: kasten(document.querySelector('header a[href="#/einstellungen"]')),
    };
  });
}

for (const [breite, zoom] of [
  [390, 1],
  [320, 1.3],
  [1280, 1],
] as const) {
  test(`wunsch-W36: Kopf von „Mappe“ wie „Wohnungen“, ${breite} px${zoom !== 1 ? ' mit 130 %' : ''}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: breite, height: 844 });
    await haushaltMitMax(page);
    const messen = async (hash: string) => {
      await page.goto(`/${hash}`);
      await expect(page.locator('header a[href="#/einstellungen"]')).toBeVisible();
      await expect(page.locator('header img:visible').first()).toBeVisible();
      await page.waitForTimeout(300);
      if (zoom !== 1)
        await page.evaluate(
          (z) => document.documentElement.style.setProperty('zoom', String(z)),
          zoom,
        );
      await page.waitForTimeout(100);
      return kopf(page);
    };
    const wohnungen = await messen('#/wohnungen');
    const mappe = await messen('#/');
    expect(mappe).toEqual(wohnungen);
    // Gegenprobe: 4 px Versatz im Kopf von „Mappe“ fällt auf.
    await page.evaluate(() => {
      const s = document.styleSheets[0]!;
      s.insertRule('.kopfzeile{transform:translateX(4px)}', s.cssRules.length);
    });
    expect(await kopf(page)).not.toEqual(wohnungen);
  });
}
