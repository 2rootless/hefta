import { expect, test } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';

// Fotos der Besichtigung (Zeile 9, B21): auswählen, ansehen, löschen mit „Rückgängig“; nach dem Neuladen
// noch da.

// Ein rotes Quadrat, 8 × 8 Pixel.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAWSURBVChTY/jPwPAfH2ZAF0DHw0MBAMLXf4F1N6FEAAAAAElFTkSuQmCC',
  'base64',
);

test('Fotos im Heft: auswählen, groß ansehen, schließen, löschen und zurückholen', async ({
  page,
  browserName,
}) => {
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

  // PC31 (A2): „Schließen“ oben, 44 px, und nach unten wischen schließt; seitlich wischen nicht.
  const blatt = page.getByRole('dialog', { name: 'Fotos' });
  await page.getByRole('button', { name: 'Foto 1 ansehen' }).click();
  const zu = blatt.getByRole('button', { name: 'Schließen' });
  await expect(zu).toBeVisible();
  const box = (await zu.boundingBox())!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  expect(box.y).toBeLessThan(((await blatt.boundingBox())!.y ?? 0) + 60);
  await zu.click();
  await expect(blatt).toBeHidden();
  if (browserName === 'chromium') {
    const wischen = (dx: number, dy: number) =>
      page.evaluate(
        ({ dx, dy }) => {
          const ziel = document.querySelector('dialog[open] .platz img')!;
          const r = ziel.getBoundingClientRect();
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 3;
          const beruehrung = (cx: number, cy: number) =>
            new Touch({ identifier: 1, target: ziel, clientX: cx, clientY: cy });
          const senden = (art: string, liste: Touch[]) =>
            ziel.dispatchEvent(
              new TouchEvent(art, { touches: liste, changedTouches: liste, bubbles: true }),
            );
          senden('touchstart', [beruehrung(x, y)]);
          for (let i = 1; i <= 6; i++)
            senden('touchmove', [beruehrung(x + (dx * i) / 6, y + (dy * i) / 6)]);
          ziel.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true }));
        },
        { dx, dy },
      );
    await page.getByRole('button', { name: 'Foto 1 ansehen' }).click();
    await expect(blatt.locator('.platz img').first()).toBeVisible();
    await wischen(160, 20);
    await expect(blatt).toBeVisible();
    await wischen(0, 140);
    await expect(blatt).toBeHidden();
  }

  await page.getByRole('button', { name: 'Foto 1 ansehen' }).click();
  await page.getByRole('button', { name: 'Foto löschen' }).click();
  await expect(page.getByRole('button', { name: /^Foto \d ansehen$/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('button', { name: /^Foto \d ansehen$/ })).toHaveCount(2);
});
