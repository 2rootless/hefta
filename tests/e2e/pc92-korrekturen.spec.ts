import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { erstePerson } from './einrichtung';

// PC92 (E194): kleine Korrekturen, die noch in 2.0 kommen. Je K ein Test mit Gegenprobe.

test('K1: „Über Hefta“ zeigt „Rückmeldung geben“ ohne Testschalter (Hinweis an Apple stimmt)', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  expect(
    await page.evaluate(() => (globalThis as { __heftaEmpfangTest?: boolean }).__heftaEmpfangTest),
  ).toBe(undefined);
  await page.evaluate(() => (location.hash = '#/einstellungen'));
  await expect(page.getByRole('heading', { level: 2, name: 'Über Hefta' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Rückmeldung geben/ })).toBeVisible();
  await expect(page.getByText('Freiwillig, vier kurze Fragen')).toBeVisible();
});

test('K5: Beim Haushalt steht unter „Bürge hinzufügen“ „Hilft, wenn das Einkommen knapp ist“ (DP61-2 U5, E186)', async ({
  page,
}) => {
  await erstePerson(page, { vorname: 'Max', bezeichnung: 'Hauptmieter' });
  const zeile = page.getByRole('link', { name: /Bürge hinzufügen/ });
  await expect(zeile).toContainText('Hilft, wenn das Einkommen knapp ist');
  await expect(page.getByText(/Nur nötig, wenn/)).toHaveCount(0);
  // Gegenprobe: Der alte Satz steht nirgends mehr in den Texten der App.
  expect(readFileSync('src/i18n/de.json', 'utf8')).not.toContain('Nur nötig, wenn');
});

test('K6: „Schreib an hallo@hefta.de.“ statt „Schreib uns“ (E166, PC86 Abschnitt 4); Rechtstexte bleiben', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  await page.evaluate(() => (location.hash = '#/einstellungen'));
  const zeile = page.locator('.listenzeile.rueck .tx');
  await expect(zeile).toHaveText(/^Mehr zu sagen\? Schreibt? an hallo@\u200b?hefta\.de\.$/);
  await expect(zeile.getByRole('link', { name: /hallo@/ })).toHaveCount(1);
  await expect(page.locator('main')).not.toContainText(/Schreibt? uns/);
  // Gegenprobe: In den Texten der App steht „Schreib uns“ nirgends mehr; die Rechtstexte („wir“ meint dort den
  // Verantwortlichen) bleiben, wie sie sind.
  const texte = readFileSync('src/i18n/de.json', 'utf8');
  expect(texte).not.toMatch(/Schreibt? uns/);
  expect(texte).toContain('Datenschutzerklärung');
});
