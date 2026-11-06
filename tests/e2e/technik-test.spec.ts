import { expect, test } from '@playwright/test';
import { pruefung } from './hilfen';

test.beforeEach(async ({ page }) => {
  await page.goto('/#/technik-test');
  await page.getByRole('heading', { level: 1, name: 'Technik-Test' }).waitFor();
});

test('baut die Beispiel-Mappe: Schwärzung eingebrannt, EXIF weg, Hochkant richtig, Metadaten neutral', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Mappe bauen' }).click();
  const mappe = await pruefung(page, 'mappe', 90_000);
  for (const id of [
    'exif-entfernt',
    'hochkant',
    'raster',
    'schwaerzung',
    'schrift',
    'metadaten',
    'fremde-hosts',
    'csp',
  ]) {
    const p = await pruefung(page, id);
    expect(p.ok, p.text).toBe('true');
  }
  expect(mappe.text).toContain('Seiten');
  await expect(page.getByRole('link', { name: 'Herunterladen' })).toBeVisible();
});

test('entsperrt ein passwortgeschütztes PDF und zeigt die Größe', async ({ page }) => {
  await page.getByRole('button', { name: 'Beispiel mit Passwort testen' }).click();
  const erkennung = await pruefung(page, 'pw-erkennung');
  expect(erkennung.ok, erkennung.text).toBe('true');
  const raster = await pruefung(page, 'pw-raster');
  expect(raster.ok, raster.text).toBe('true');
  expect(raster.text).toMatch(/gerastert \d/);
});

test('Backup mit Passwort: speichern, herunterladen, einspielen ist identisch; falsches Passwort klar', async ({
  page,
}, info) => {
  await page.locator('[data-feld="megabyte"]').selectOption('10');
  await page.getByRole('button', { name: 'Testdaten speichern' }).click();
  expect((await pruefung(page, 'testdaten')).ok).toBe('true');

  await page.locator('[data-feld="backup-passwort"]').fill('Sommer in Hamburg');
  await page.getByRole('button', { name: 'Backup erstellen' }).click();
  expect((await pruefung(page, 'backup')).ok).toBe('true');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Herunterladen' }).click(),
  ]);
  const pfad = info.outputPath('backup.hefta');
  await download.saveAs(pfad);

  await page.locator('[data-feld="import-passwort"]').fill('falsch');
  await page.locator('[data-feld="backup-datei"]').setInputFiles(pfad);
  const falsch = await pruefung(page, 'einspielen');
  expect(falsch.ok).toBe('false');
  expect(falsch.text).toContain('Das Passwort passt nicht.');

  await page.locator('[data-feld="import-passwort"]').fill('Sommer in Hamburg');
  await page.locator('[data-feld="backup-datei"]').setInputFiles([]);
  await page.locator('[data-feld="backup-datei"]').setInputFiles(pfad);
  await expect(page.locator('[data-pruefung="einspielen"]')).toHaveAttribute('data-ok', 'true', {
    timeout: 60_000,
  });
});

test('Version 2: schräges Foto wird erkannt, gerade gerückt und ein A4-PDF', async ({ page }) => {
  await page.getByRole('button', { name: 'Beispielfoto gerade rücken' }).click();
  for (const id of ['foto-ecken', 'foto-seite', 'foto-pdf']) {
    const p = await pruefung(page, id, 60_000);
    expect(p.ok, p.text).toBe('true');
  }
  await expect(page.getByRole('img', { name: 'Gerade gerückte Seite' })).toBeVisible();
});
