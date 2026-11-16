import { expect, test, type Page } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// PC66 (W22): In den Einstellungen begannen die Namen der Schalter unter „Erinnerungen“ an der Kante der
// Karte, und die Schalter stießen rechts an. Der Auftraggeber fand dasselbe bei „Eigene Auswahl“ in „Mappe
// teilen“. Gemessen bei 390 px und bei 320 px mit 130 % (246 px), hell und dunkel: Text und Bedienelement
// halten in ihrer Karte denselben Abstand wie die Zeilen der anderen Karten.

const BREITEN: [number, number][] = [
  [390, 844],
  [246, 600],
];

/** Abstand des Texts und des Elements rechts zur Kante der Karte, in px. */
async function abstaende(page: Page, zeile: string, karte: string, text: string, rechts: string) {
  return page
    .locator(zeile)
    .first()
    .evaluate(
      (z, [karteSel, textSel, rechtsSel]) => {
        const k = (z.closest(karteSel!) ?? z).getBoundingClientRect();
        const t = z.querySelector(textSel!)!.getBoundingClientRect();
        const r = z.querySelector(rechtsSel!)!.getBoundingClientRect();
        return { links: Math.round(t.left - k.left), rechts: Math.round(k.right - r.right) };
      },
      [karte, text, rechts],
    );
}

for (const [breite, hoehe] of BREITEN) {
  for (const schema of ['light', 'dark'] as const) {
    test(`Einstellungen, Erinnerungen: Innenabstand wie die anderen Karten (${breite} px, ${schema})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: breite, height: hoehe });
      await page.emulateMedia({ colorScheme: schema });
      await page.addInitScript(() => {
        (window as unknown as { __heftaErinnerungenTest: boolean }).__heftaErinnerungenTest = true;
      });
      await szenarioLaden(page, '01-standard', '/einstellungen');
      await expect(page.getByRole('switch').first()).toBeVisible();
      // Bezug: die Zeile „Backup erstellen“ in der Karte darüber.
      const bezug = await abstaende(page, 'a.listenzeile', 'ul.zeilen', '.tx', 'svg');
      expect(bezug.links).toBeGreaterThanOrEqual(12);
      for (const i of [0, 1]) {
        const s = await page
          .getByRole('switch')
          .nth(i)
          .evaluate((z) => {
            const k = z.closest('ul.zeilen')!.getBoundingClientRect();
            const t = z.querySelector('.tx')!.getBoundingClientRect();
            const b = z.querySelector('.bahn')!.getBoundingClientRect();
            return { links: Math.round(t.left - k.left), rechts: Math.round(k.right - b.right) };
          });
        expect(s.links, 'Text der Zeile mit Schalter').toBe(bezug.links);
        expect(s.rechts, 'Schalter rechts').toBe(bezug.rechts);
      }
    });
  }

  test(`Mappe teilen, „Eigene Auswahl“: Text und Pfeil mit Innenabstand (${breite} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: breite, height: hoehe });
    await szenarioLaden(page, '04-fertig', '/mappe');
    await page.getByRole('button', { name: /^Eigene Auswahl/ }).click();
    const a = await abstaende(page, 'button.eigene', 'button.eigene', '.tx', 'svg');
    expect(a.links).toBeGreaterThanOrEqual(12);
    expect(a.rechts).toBeGreaterThanOrEqual(12);
    // Die Zeile ist rundum umrandet, nicht nur oben.
    const rand = await page
      .locator('button.eigene')
      .evaluate((e) => getComputedStyle(e).borderLeftWidth);
    expect(rand).toBe('1px');
  });
}
