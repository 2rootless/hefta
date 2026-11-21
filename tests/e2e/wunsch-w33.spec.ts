import { expect, test, type Page } from '@playwright/test';
import { gelbAusserhalbVonDokumenten, tintenrandImFokus } from './nachfrage-pruefen';
import { szenarioLaden } from './szenario-laden';
/** DP77 (TL26): Nachgefragt wird nur bei einer gültigen Sonderrufnummer; eine zu kurze Nummer ist ein Fehler im Feld.
 *  0900 mit erfundenen Ziffern (W7), wie in ruecklauf-iphone.spec.ts. */
const SONDER = `0900 ${'1'.repeat(7)}`;

// wunsch-W33 (Wunschliste Fassung 17, DP49b): Nachfrage überall gleich. Geprüft werden NF5 (Fokus ohne
// Tintenrand) und NF6 (kein Gelb außerhalb eines Dokuments), je mit Gegenprobe, in Chromium und WebKit, bei
// 390 und 1440 px, hell und dunkel. Den Prüfzustand selbst prüft nachfrage.spec.ts (NF1 bis NF13).

const ANSICHTEN = [
  [390, 'light'],
  [390, 'dark'],
  [1440, 'light'],
  [1440, 'dark'],
] as const;

/** Selbstauskunft von Max, Teil „Kontakt“ offen, Telefon und Mail ungewöhnlich, nach „Weiter“. */
async function mitNachfrage(page: Page, breite: number, schema: 'light' | 'dark') {
  await page.setViewportSize({ width: breite, height: 900 });
  await page.emulateMedia({ colorScheme: schema });
  await szenarioLaden(page, '02-neustart', '/selbstauskunft/p-02-neustart-0');
  await page.getByRole('button', { name: /^Kontakt/ }).click();
  await page.getByRole('textbox', { name: /^Telefon/ }).fill(SONDER);
  await page.getByRole('textbox', { name: /^E-Mail/ }).fill('max.mustermann@example');
  await page.getByRole('button', { name: /^Weiter( zu |: )/ }).click();
  await expect(page.locator('.nachfrage.an')).toHaveCount(2);
}

for (const [breite, schema] of ANSICHTEN) {
  test(`wunsch-W33: Fokus ohne Tintenrand, kein Gelb außerhalb von Dokumenten, ${breite} px, ${schema}`, async ({
    page,
  }) => {
    await mitNachfrage(page, breite, schema);
    // NF6: Die Nachfrage ist Tinte auf Blatt, nirgends Gelb.
    expect(await gelbAusserhalbVonDokumenten(page)).toEqual([]);
    // NF5: Tippt man ins Feld, geht der Prüfzustand zurück, und der Fokus hat keinen Rand in Tinte.
    expect(await tintenrandImFokus(page, '[data-feld="email"]')).toBe(false);
    // Auch das Telefonfeld mit Land aus 2.0.1 (E222, DP77).
    expect(await tintenrandImFokus(page, '[data-feld="telefon"]')).toBe(false);
    await expect(page.locator('[data-feld="email"]')).not.toHaveClass(/pruefzustand/);
    // Auch die anderen Textfelder zeigen den Fokus ohne Tintenrand.
    await page.getByRole('button', { name: /^Einkommen/ }).click();
    expect(await tintenrandImFokus(page, '[data-feld="beruf"]')).toBe(false);
  });
}

test('wunsch-W33 Gegenprobe: Ein Fokus mit Tintenrand und eine gelbe Fläche werden rot', async ({
  page,
}) => {
  await mitNachfrage(page, 390, 'light');
  // Absichtlich falsche Fassungen über CSSOM (die Inhaltsrichtlinie sperrt eingefügte Style-Blöcke):
  // der alte Fokus aus DP33 A4 und die gelbe Nachfrage aus DP49.
  await page.evaluate(() => {
    const blatt = [...document.styleSheets].find((s) => s.href?.startsWith(location.origin))!;
    blatt.insertRule(
      '.eingabe input:focus, .telefon input:focus { box-shadow: inset 0 0 0 2px var(--ink) !important }',
      blatt.cssRules.length,
    );
    blatt.insertRule(
      '.nachfrage.an .sichtbar > span:last-child { background: rgba(247, 206, 70, 0.55) !important }',
      blatt.cssRules.length,
    );
  });
  expect(await gelbAusserhalbVonDokumenten(page)).toEqual(['span.', 'span.']);
  expect(await tintenrandImFokus(page, '[data-feld="telefon"]')).toBe(true);
});
