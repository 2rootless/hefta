import { expect, test, type Page } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// Aufgabenzeile der Übersicht (C33 nach PC170).
// DP104: 12 px innen, 8 px zwischen Zeichen, Text und Pfeil (W22); der Pfeil bleibt 16 px breit (C33b).
// DP107: Im schmalen Kasten (bis 260 px innen) 8 px seitlich, 4 px Zeichen–Text, 8 px Text–Pfeil, damit das längste
// Stück eines Namens („Ausbildungs-“, fett) mindestens 4 px vor dem Pfeil endet (C33). Breiter gilt DP104 (C33c).
// Szenario „Lebenslagen“: Lea ist in Ausbildung, die Übersicht zeigt „BAföG-Bescheid oder Ausbildungsvertrag“.

async function messen(page: Page) {
  return page.evaluate(() => {
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    const rg = document.createRange();
    return [...document.querySelectorAll('.aufgaben .aufgabe')].map((a) => {
      const cs = getComputedStyle(a);
      const pfeil = a.querySelector(':scope > svg')!.getBoundingClientRect();
      // Rechte Kante der Schrift im Text: jede Zeile jedes Textknotens, nicht die Kante des Kastens.
      let rechts = -Infinity;
      const tw = document.createTreeWalker(a.querySelector('.tx')!, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = tw.nextNode())) {
        if (!n.textContent?.trim()) continue;
        rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) if (q.width > 0.5) rechts = Math.max(rechts, q.right);
      }
      return {
        titel: (a.querySelector('.tx b')?.textContent ?? '').replace(/­/g, ''),
        padding: cs.padding,
        gap: cs.columnGap,
        pfeil: Math.round((pfeil.width / zoom) * 10) / 10,
        abstand: Math.round(((pfeil.left - rechts) / zoom) * 10) / 10,
      };
    });
  });
}

async function oeffnen(page: Page, breite: number, zoom: number) {
  await page.setViewportSize({ width: breite, height: 844 });
  await szenarioLaden(page, '09-lebenslagen', '/');
  await page.locator('.aufgaben .aufgabe').first().waitFor();
  if (zoom !== 1)
    await page.evaluate((z) => document.documentElement.style.setProperty('zoom', String(z)), zoom);
  await page.waitForTimeout(150);
}

async function regel(page: Page, css: string) {
  await page.evaluate((c) => {
    const s = document.styleSheets[document.styleSheets.length - 1]!;
    s.insertRule(c, s.cssRules.length);
  }, css);
  await page.waitForTimeout(50);
}

const BREIT = { padding: '12px', gap: '8px' };
const SCHMAL = { padding: '12px 8px', gap: '0px' };

for (const [breite, zoom, soll] of [
  [390, 1, BREIT],
  [1440, 1, BREIT],
  [320, 1.3, SCHMAL],
] as const)
  test(`DP104/DP107: Aufgabenzeile ${breite} px${zoom !== 1 ? ' mit 130 %' : ''}: Raster, Pfeil 16 px, Text 4 px vor dem Pfeil`, async ({
    page,
  }) => {
    await oeffnen(page, breite, zoom);
    const m = await messen(page);
    expect(m.some((z) => /Ausbildungsvertrag/.test(z.titel))).toBe(true);
    for (const z of m) {
      expect({ padding: z.padding, gap: z.gap, pfeil: z.pfeil }, z.titel).toEqual({
        ...soll,
        pfeil: 16,
      });
      expect(z.abstand, z.titel).toBeGreaterThanOrEqual(4);
    }
  });

test('C33 Gegenprobe: DP104 ohne die Regel für den schmalen Kasten wird bei 320 px mit 130 % rot', async ({
  page,
}) => {
  await oeffnen(page, 320, 1.3);
  await regel(page, '.aufgaben .aufgabe{padding:12px !important;gap:8px !important}');
  await regel(page, '.aufgaben .aufgabe .sym{margin-right:0 !important}');
  await regel(page, '.aufgaben .aufgabe > svg{margin-left:0 !important}');
  const lang = (await messen(page)).find((z) => /Ausbildungsvertrag/.test(z.titel))!;
  expect(lang.abstand).toBeLessThan(4);
});

test('C33c Gegenprobe: die schmale Fassung für alle Breiten wird bei 390 px rot', async ({
  page,
}) => {
  await oeffnen(page, 390, 1);
  await regel(page, '.aufgaben .aufgabe{padding:12px 8px !important;gap:0 !important}');
  const m = await messen(page);
  expect(m.every((z) => z.padding === BREIT.padding && z.gap === BREIT.gap)).toBe(false);
});

test('C33b Gegenprobe: ein Pfeil, der schrumpfen darf, wird bei 320 px mit 130 % rot', async ({
  page,
}) => {
  await oeffnen(page, 320, 1.3);
  await regel(page, '.aufgaben .aufgabe > svg{flex:0 1 16px !important;min-width:0 !important}');
  await page.evaluate(() => {
    for (const t of document.querySelectorAll('.aufgaben .aufgabe .tx b'))
      t.textContent = 'Ein sehr langer Name, der den Pfeil schmaler drücken würde, wenn er dürfte';
  });
  expect((await messen(page)).some((z) => z.pfeil < 16)).toBe(true);
});
