import { expect, test, type Page } from '@playwright/test';
import { farbe } from './nachfrage-pruefen';
import { szenarioLaden } from './szenario-laden';
/** DP77 (TL26): Nachgefragt wird nur bei einer gültigen Sonderrufnummer; eine zu kurze Nummer ist ein Fehler im Feld.
 *  0900 mit erfundenen Ziffern (W7), wie in ruecklauf-iphone.spec.ts. */
const SONDER = `0900 ${'1'.repeat(7)}`;

// DP49b, Prüfkatalog NF1 bis NF13 für die Nachfrage im Kontakt der Selbstauskunft (App). NF5 und NF6 mit
// Gegenprobe stehen in wunsch-w33.spec.ts; NF9 bis NF11 (Zeile, Vermieterseite, Foto) kommen mit DP51 und dem
// Schwärzen. Seit dem Telefonfeld mit Land (E222, DP77) ist eine zu kurze Nummer ein Fehler im Feld; nachgefragt
// wird nur noch bei einer gültigen Sonderrufnummer (TL26).

/** Lage im Dokument, nicht im Fenster: Bei 320 px rollt die Seite zum Knopf. */
const imDokument = (e: Element) => e.getBoundingClientRect().top + window.scrollY;

async function kontakt(page: Page) {
  await szenarioLaden(page, '02-neustart', '/selbstauskunft/p-02-neustart-0');
  await page.getByRole('button', { name: /^Kontakt/ }).click();
  return {
    telefon: page.getByRole('textbox', { name: /^Telefon/ }),
    email: page.getByRole('textbox', { name: /^E-Mail/ }),
    weiter: page.getByRole('button', { name: /^Weiter( zu |: )/ }),
    stimmt: page.getByRole('button', { name: 'Stimmt', exact: true }),
    aktiv: page.locator('.nachfrage.an'),
  };
}

test('NF1, NF4, NF13: Prüfzustand am Feld, Satz mit „?“, Knopf „Stimmt“; vorgelesen und beschrieben', async ({
  page,
}) => {
  const k = await kontakt(page);
  await k.telefon.fill(SONDER);
  const emailVor = (await k.email.boundingBox())!.y;
  await k.weiter.click();
  await expect(k.telefon).toHaveClass(/pruefzustand/);
  await expect(k.email).not.toHaveClass(/pruefzustand/);
  await expect(k.aktiv).toHaveCount(1);
  await expect(k.aktiv.locator('svg.zeichen circle')).toHaveCount(1);
  await expect(k.stimmt).toBeVisible();
  // NF1: „E-Mail“ bleibt an seiner Stelle.
  expect((await k.email.boundingBox())!.y).toBe(emailVor);
  // NF13: Der Satz ist ein Live-Bereich und die Beschreibung des Felds.
  await expect(k.telefon).toHaveAccessibleDescription('Sieht ungewöhnlich aus. Stimmt sie?');
  // Vorgelesen wird nur der Satz der aktiven Nachfrage; die leere Zeile trägt ihn nur unsichtbar.
  await expect(k.aktiv.locator('.visually-hidden')).toHaveText(
    'Sieht ungewöhnlich aus. Stimmt sie?',
  );
  await expect(page.locator('.nachfrage:not(.an) .visually-hidden')).toHaveCount(0);
  // NF4: dieselbe Nachfrage an der Mail; zwei zugleich zeigen je ihren Satz (Offene Frage 2).
  await k.email.fill('max.mustermann@example');
  await k.weiter.click();
  await expect(k.email).toHaveClass(/pruefzustand/);
  await expect(k.telefon).toHaveClass(/pruefzustand/);
  await expect(k.aktiv).toHaveCount(2);
});

test('NF2: „Stimmt“ blendet in 300 ms zurück, dann geht es weiter', async ({ page }) => {
  const k = await kontakt(page);
  await k.telefon.fill(SONDER);
  await k.weiter.click();
  await expect(k.aktiv).toHaveCount(1);
  const start = await page.evaluate(() => performance.now());
  await k.stimmt.click();
  await expect(k.telefon).not.toHaveClass(/pruefzustand/);
  await expect(k.email).toHaveCount(0);
  const dauer = (await page.evaluate(() => performance.now())) - start;
  expect(dauer, 'erst zurückblenden, dann weiter').toBeGreaterThanOrEqual(280);
  await expect(page.getByRole('button', { name: /^Kontakt/ })).toContainText(
    'Telefonnummer bitte prüfen',
  );
});

test('NF3: Tippt man nach der Nachfrage ins Feld, geht der Prüfzustand zurück, der Knopf heißt „Weiter“', async ({
  page,
}) => {
  const k = await kontakt(page);
  await k.telefon.fill(SONDER);
  // Der Cursor steht noch im Feld: Auch der Tipp hinein führt zurück.
  await k.weiter.click();
  await expect(k.telefon).toHaveClass(/pruefzustand/);
  await k.telefon.click();
  await expect(k.telefon).not.toHaveClass(/pruefzustand/);
  await expect(k.aktiv).toHaveCount(0);
  await expect(k.weiter).toBeVisible();
});

test('NF6, NF7: kein Gelb und kein Rot; im Dunkeln Rand in heller Tinte, Fläche wie die Karte', async ({
  page,
}) => {
  for (const schema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: schema });
    const k = await kontakt(page);
    await k.telefon.fill(SONDER);
    await k.weiter.click();
    await expect(k.telefon).toHaveClass(/pruefzustand/);
    await page.waitForTimeout(350);
    const tinte = await farbe(page, '--ink');
    const flaeche = await farbe(page, '--surface');
    // DP63c: Rot gibt es in der App nur noch als --accent-text.
    const rot = await farbe(page, '--accent-text');
    const stil = await k.telefon.evaluate((e) => {
      const s = getComputedStyle(e);
      return { schatten: s.boxShadow, grund: s.backgroundColor };
    });
    expect(stil.schatten).toContain(tinte);
    expect(stil.schatten).toContain('inset');
    expect(stil.grund).toBe(flaeche);
    const satzFarbe = await k.aktiv.evaluate((e) => getComputedStyle(e).color);
    expect(satzFarbe).toBe(tinte);
    expect([stil.schatten, satzFarbe].join(' ')).not.toContain(rot);
  }
});

test('NF8: 320 px mit 130 %: Der Satz braucht zwei Zeilen, ihr Platz ist vorher schon frei', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(() =>
    addEventListener('DOMContentLoaded', () =>
      document.documentElement.style.setProperty('--px', '1.3px'),
    ),
  );
  const k = await kontakt(page);
  await k.telefon.fill(SONDER);
  const zeile = page.locator('.nachfrage').first();
  const vorher = (await zeile.boundingBox())!.height;
  const emailVor = await k.email.evaluate(imDokument);
  await k.weiter.click();
  await expect(k.aktiv).toHaveCount(1);
  const satz = (await k.aktiv.locator('.sichtbar').boundingBox())!.height;
  expect(satz, 'zwei Zeilen zu je 26 px').toBeGreaterThanOrEqual(2 * 20 * 1.3 - 1);
  expect((await zeile.boundingBox())!.height).toBe(vorher);
  expect(await k.email.evaluate(imDokument)).toBe(emailVor);
});

test('NF12: Bei reduzierter Bewegung stehen Prüfzustand und Satz sofort, ohne Überblenden (DP150)', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const k = await kontakt(page);
  expect(await k.telefon.evaluate((e) => getComputedStyle(e).transitionDuration)).toBe('0s');
  const satz = page.locator('.nachfrage .sichtbar').first();
  expect(await satz.evaluate((e) => getComputedStyle(e).transitionDuration)).toBe('0s');
  // Gegenprobe: ohne „Bewegung reduzieren“ blendet die Fläche ruhig über, nie der Rand, und der Satz auch.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await k.telefon.evaluate((e) => getComputedStyle(e).transitionProperty)).toBe(
    'background-color',
  );
  expect(await satz.evaluate((e) => getComputedStyle(e).transitionDuration)).toBe('0.3s');
});
