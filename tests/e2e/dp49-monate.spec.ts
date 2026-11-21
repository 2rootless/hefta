import { expect, test } from '@playwright/test';
import { gehaltsPdfs, szenarioLaden } from './szenario-laden';
import { alsInhalt } from './dateien';

// DP49 Punkt 7: Monate zuordnen in einer Form. Jede Seite hat dieselbe Form, ob ihre Datei eine oder
// mehrere Seiten hat: Kopf „Seite n“ mit „{Monat} gefunden“, Vorschau mit Lupe, der Monat als gefüllte
// Fläche mit Pfeil. Je Datei oben Name und Seitenzahl. Die Fassung mit Rahmen und Doppelpfeil fällt weg.

/** Prüft die eine Form im offenen Blatt; gibt Befunde zurück (leer heißt: alles in derselben Form). */
function eineFormPruefen(): string[] {
  const befunde: string[] = [];
  const dateien = document.querySelectorAll<HTMLElement>('dialog[open] .zuordnung > li');
  if (!dateien.length) befunde.push('keine Datei im Blatt');
  for (const d of dateien) {
    const kopf = d.querySelector('.w16-kopf');
    if (
      !kopf?.querySelector('.dateiname') ||
      !/\d|Seite/.test(kopf.querySelector('small')?.textContent ?? '')
    )
      befunde.push('Datei ohne Name und Seitenzahl oben');
    const seiten = d.querySelectorAll('.w16-seite, .kopfzeile');
    if (!seiten.length) befunde.push('Seite ohne Kopf „Seite n“');
    for (const s of seiten)
      if (!/^Seite \d+/.test(s.querySelector('b')?.textContent ?? ''))
        befunde.push('Kopf ohne „Seite n“');
    for (const sel of d.querySelectorAll('select')) {
      const st = getComputedStyle(sel);
      if (parseFloat(st.borderTopWidth) > 0 && st.borderTopStyle !== 'none')
        befunde.push('Monatswahl mit Rahmen');
      if (st.appearance !== 'none' && st.webkitAppearance !== 'none')
        befunde.push('Monatswahl mit Pfeil des Systems');
      if (!sel.parentElement?.querySelector('.w16-pfeil, .pfeil'))
        befunde.push('Monatswahl ohne Pfeil');
    }
  }
  return befunde;
}

test('DP49 Punkt 7: zwei Dateien mit je einer Seite in derselben Form wie Seiten einer Datei; Gegenprobe', async ({
  page,
}) => {
  await szenarioLaden(page, '02-neustart', '/unterlage/p-02-neustart-0/gehaltsnachweis');
  await page
    .getByRole('button', { name: /hinzufügen/i })
    .first()
    .click();
  await page
    .locator('[data-feld="pdf"]')
    .setInputFiles(alsInhalt(await gehaltsPdfs(['Oktober', 'September'])));
  const blatt = page.getByRole('dialog');
  await expect(blatt.locator('.w16-vorschau')).toHaveCount(2, { timeout: 30_000 });
  await expect(
    blatt.getByText('Zwei Dateien, zwei Seiten. Welcher Monat ist welche Seite?'),
  ).toBeVisible();
  await expect(blatt.locator('.w16-kopf small').first()).toHaveText('1 Seite');
  await expect(blatt.locator('.w16-seite').first()).toContainText('Seite 1');
  await expect(blatt.locator('.w16-seite').first()).toContainText(/(Oktober|September) gefunden/);
  expect(await page.evaluate(eineFormPruefen)).toEqual([]);

  // Gegenprobe: die alte Fassung mit Rahmen und Pfeil des Systems wird rot.
  await page.evaluate(() => {
    const s = document.styleSheets[0]!;
    s.insertRule(
      '.w16-monat select{border:1px solid black!important;appearance:auto!important;-webkit-appearance:menulist!important}',
      s.cssRules.length,
    );
  });
  const befunde = await page.evaluate(eineFormPruefen);
  expect(befunde).toContain('Monatswahl mit Rahmen');
});
