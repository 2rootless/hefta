import { expect, test, type Page } from '@playwright/test';
import { gehaltsPdfs, szenarioLaden } from './szenario-laden';
import { alsInhalt } from './dateien';

// CP41 (DP50): Eine Abrechnung mit einer Seite steht in derselben Form wie Seiten mehrerer Dateien:
// Kopf mit Name und „1 Seite“, „Seite 1“ mit „Oktober gefunden“, Vorschau mit Lupe, der Monat als Auswahl.
// Der Satz darüber: „Eine Datei, eine Seite. Stimmt der Monat?“. Gegenprobe: keine Monats-Pillen mehr.

/** Monate der gespeicherten Gehaltsnachweise. */
function gespeicherteMonate(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string[]>((fertig) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const tx = r.result.transaction('versionen');
          const q = tx.objectStore('versionen').getAll();
          q.onsuccess = () => {
            r.result.close();
            fertig(
              (q.result as { abrechnungsmonat: string | null }[])
                .map((v) => v.abrechnungsmonat ?? '')
                .filter(Boolean),
            );
          };
        };
      }),
  );
}

test('Eine Datei, eine Seite: dieselbe Form, der Monat aus dem Text, gespeichert', async ({
  page,
}) => {
  await szenarioLaden(page, '02-neustart', '/unterlage/p-02-neustart-0/gehaltsnachweis');
  await page
    .getByRole('button', { name: /hinzufügen/i })
    .first()
    .click();
  const vorher = await gespeicherteMonate(page);
  await page.locator('[data-feld="pdf"]').setInputFiles(alsInhalt(await gehaltsPdfs(['Oktober'])));
  const blatt = page.getByRole('dialog');
  await expect(blatt.getByText('Eine Datei, eine Seite. Stimmt der Monat?')).toBeVisible({
    timeout: 30_000,
  });
  await expect(blatt.locator('.w16-kopf small')).toHaveText('1 Seite');
  await expect(blatt.locator('.w16-seite')).toContainText('Seite 1');
  await expect(blatt.locator('.w16-seite')).toContainText('Oktober gefunden');
  await expect(blatt.locator('.w16-vorschau')).toHaveCount(1);
  await expect(blatt.locator('.w16-monat select')).toHaveValue('2026-10');
  // Gegenprobe: Die alte Form mit Monats-Pillen („Für welchen Monat?“) gibt es hier nicht mehr.
  await expect(blatt.getByText('Für welchen Monat?')).toHaveCount(0);

  await blatt.getByRole('button', { name: /^Speichern/ }).click();
  await expect.poll(async () => (await gespeicherteMonate(page)).length).toBe(vorher.length + 1);
  expect(await gespeicherteMonate(page)).toContain('2026-10');
});

test('„Anderer Monat …“ am Ende der Auswahl, bei einer Datei „Andere Datei wählen“ (PC79)', async ({
  page,
}) => {
  await szenarioLaden(page, '02-neustart', '/unterlage/p-02-neustart-0/gehaltsnachweis');
  await page
    .getByRole('button', { name: /hinzufügen/i })
    .first()
    .click();
  const vorher = await gespeicherteMonate(page);
  await page.locator('[data-feld="pdf"]').setInputFiles(alsInhalt(await gehaltsPdfs(['Oktober'])));
  const blatt = page.getByRole('dialog');
  const auswahl = blatt.locator('.w16-monat select');
  await expect(auswahl).toHaveValue('2026-10', { timeout: 30_000 });
  // Eine Datei: kein „Entfernen“, dafür „Andere Datei wählen“ (RS3b).
  await expect(blatt.getByRole('button', { name: /^Entfernen/ })).toHaveCount(0);
  await expect(blatt.getByLabel('Andere Datei wählen')).toHaveCount(1);
  // Der letzte Eintrag öffnet das Monatsfeld; erst dann gibt es eins.
  await expect(auswahl.locator('option').last()).toHaveText('Anderer Monat …');
  await expect(blatt.locator('input[type=month]')).toHaveCount(0);
  await auswahl.selectOption({ label: 'Anderer Monat …' });
  const feld = blatt.locator('input[type=month]');
  await feld.fill('2026-03');
  await feld.dispatchEvent('change');
  await expect(auswahl).toHaveValue('anderer');

  await blatt.getByRole('button', { name: /^Speichern/ }).click();
  await expect.poll(async () => (await gespeicherteMonate(page)).length).toBe(vorher.length + 1);
  const nachher = await gespeicherteMonate(page);
  expect(nachher).toContain('2026-03');
  expect(nachher.filter((m) => m === '2026-10').length).toBe(
    vorher.filter((m) => m === '2026-10').length,
  );
});
