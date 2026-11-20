import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';

// DP73 (PC106), Punkte für 2.0.1.

/** Alle Textstellen und Beschriftungen der Seite mit einem U+200B. */
const nullbreite = (page: Page) =>
  page.evaluate(() => {
    const zeichen = String.fromCharCode(0x200b);
    const funde: string[] = [];
    const gang = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    for (let n = gang.nextNode(); n; n = gang.nextNode())
      if (n.textContent?.includes(zeichen)) funde.push(n.textContent);
    for (const el of document.querySelectorAll('[aria-label], [title]'))
      for (const name of ['aria-label', 'title'])
        if (el.getAttribute(name)?.includes(zeichen)) funde.push(el.getAttribute(name)!);
    return funde;
  });

test('Z1: hallo@hefta.de in den Einstellungen bricht mit <wbr> um, ohne U+200B; Gegenprobe', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await page.goto('/#/einstellungen');
  const adresse = page.locator('a.adresse');
  await expect(adresse).toBeVisible();
  expect(await adresse.evaluate((e) => e.textContent)).toBe('hallo@hefta.de');
  await expect(adresse.locator('wbr')).toHaveCount(1);
  expect(await nullbreite(page)).toEqual([]);
  await page.evaluate(() => {
    const p = document.createElement('p');
    p.textContent = `hallo@${String.fromCharCode(0x200b)}hefta.de`;
    document.body.append(p);
  });
  expect(await nullbreite(page)).toHaveLength(1);
});

/** Lage, Größe und Schrift der Überschrift eines Reiters (DP73 C1). */
const ueberschrift = (page: Page) =>
  page
    .locator('main h1')
    .first()
    .evaluate((h) => {
      const r = h.getBoundingClientRect();
      const s = getComputedStyle(h);
      return {
        x: Math.round(r.left),
        y: Math.round(r.top),
        schrift: s.fontSize,
        zeile: s.lineHeight,
        gewicht: s.fontWeight,
      };
    });

for (const [breite, zoom] of [
  [390, 1],
  [320, 1.3],
  [1280, 1],
] as const) {
  test(`C1: Überschrift auf „Mappe“ wie auf „Wohnungen“, ${breite} px${zoom !== 1 ? ' mit 130 %' : ''}; Gegenprobe`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: breite, height: 844 });
    await haushaltMitMax(page);
    const messen = async (hash: string) => {
      await page.goto(`/${hash}`);
      await expect(page.locator('main h1').first()).toBeVisible();
      await page.waitForTimeout(300);
      if (zoom !== 1)
        await page.evaluate(
          (z) => document.documentElement.style.setProperty('zoom', String(z)),
          zoom,
        );
      await page.waitForTimeout(100);
      return ueberschrift(page);
    };
    const wohnungen = await messen('#/wohnungen');
    const mappe = await messen('#/');
    expect(mappe).toEqual(wohnungen);
    // Gegenprobe: 4 px Versatz fällt auf.
    await page.evaluate(() => {
      const s = document.styleSheets[0]!;
      s.insertRule('main h1{transform:translateX(4px)}', s.cssRules.length);
    });
    expect(await ueberschrift(page)).not.toEqual(wohnungen);
  });
}
