import { expect, test, type Page } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// 2.1.1 (PC191, DP119): Bei 320 px mit 130 % (246 CSS-px) ragte die Personenseite 11 px hinaus, mit Max allein im
// Mietvertrag. Nachgestellt: Max gibt den Vertrag ab („Bürgt“), dann fragt Hefta nach einer neuen Person (W42,
// Fall 4) und zeigt das Feld „Vorname“. Gemessen am 24.11.:
// - Ursache war das Feld selbst: Ohne die Klasse `eingabe` (vor PC190, Bau 176) ist es so breit wie sein Inhalt
//   und zieht die Spalte auf 262 px. `min-width: 0` an den Fieldsets hält sie in der Spalte, das Feld aber nicht.
// - Seit PC190 ist das Feld so breit wie die Spalte; dann ragt nichts hinaus, auch mit `min-width: min-content`.
// - `min-width: 0` an `fieldset.rollen` und `fieldset.feld` (DP119) bleibt als Absicherung und wird hier geprüft.
// Gegenprobe: das Feld wie vor PC190.

async function ueberstand(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

const regeln = (page: Page, css: string[]) =>
  page.evaluate((c) => {
    const s = document.styleSheets[document.styleSheets.length - 1]!;
    for (const r of c) s.insertRule(r, s.cssRules.length);
  }, css);

test('DP119: Personenseite bei 246 px mit Max allein ohne Überlauf; Gegenprobe mit dem Feld vor PC190', async ({
  page,
}) => {
  await page.setViewportSize({ width: 246, height: 532 });
  await szenarioLaden(page, '11-allein', '/person-aendern/p-11-allein-0/person');
  // W54: Max allein soll bürgen; die Frage nach einer neuen Person im Vertrag steht auf der Seite.
  await page.locator('.person-ziele [data-z="buerge"]').click();
  await expect(page.locator('.person-ziele .frage input')).toBeVisible();
  expect(await ueberstand(page)).toBe(0);
  // Gegenprobe: das Feld „Vorname“ starr breit statt schrumpfend (wie vor PC190).
  await regeln(page, [
    '.person-ziele .frage input { flex: none !important; width: 20em !important }',
  ]);
  expect(await ueberstand(page)).toBeGreaterThan(0);
});
