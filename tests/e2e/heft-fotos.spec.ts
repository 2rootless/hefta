import { expect, test } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';

// Fotos der Besichtigung (Zeile 9, B21): auswählen, ansehen, löschen mit „Rückgängig“; nach dem Neuladen
// noch da.

// Ein rotes Quadrat, 8 × 8 Pixel.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAWSURBVChTY/jPwPAfH2ZAF0DHw0MBAMLXf4F1N6FEAAAAAElFTkSuQmCC',
  'base64',
);

test('Fotos im Heft: auswählen, groß ansehen, löschen und zurückholen', async ({ page }) => {
  await haushaltMitMax(page);
  await page.evaluate(
    () =>
      new Promise<void>((fertig, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction(['hefte'], 'readwrite');
          const jetzt = new Date().toISOString();
          tx.objectStore('hefte').put({
            id: 'foto',
            createdAt: jetzt,
            updatedAt: jetzt,
            haushaltId: null,
            adresse: 'Weg 7\n20259 Hamburg',
            link: null,
            quelle: '',
            inseratText: null,
            kennung: 'k-foto',
            ereignisse: { beworben: null, gefragtAm: null, termin: null, ergebnis: null },
            notiz: '',
          });
          tx.oncomplete = () => {
            db.close();
            fertig();
          };
          tx.onerror = () => fehler(tx.error);
        };
        r.onerror = () => fehler(r.error);
      }),
  );
  await page.goto('/#/heft/foto');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Aufnehmen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Auswählen' })).toBeVisible();

  await page.locator('input[type="file"][multiple]').setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: PNG },
    { name: 'b.png', mimeType: 'image/png', buffer: PNG },
  ]);
  await expect(page.getByRole('button', { name: /^Foto \d ansehen$/ })).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole('button', { name: /^Foto \d ansehen$/ })).toHaveCount(2);

  await page.getByRole('button', { name: 'Foto 1 ansehen' }).click();
  await page.getByRole('button', { name: 'Foto löschen' }).click();
  await expect(page.getByRole('button', { name: /^Foto \d ansehen$/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('button', { name: /^Foto \d ansehen$/ })).toHaveCount(2);
});
