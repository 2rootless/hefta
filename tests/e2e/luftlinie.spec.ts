import { expect, test } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { wuenscheSetzen } from './hefte-hilfen';

// Luftlinie nach Postleitzahl (E46, E50, Zeile 5): Ort mit Postleitzahl in den Wünschen, die Wohnung aus
// ihrer Adresse; „ca.“ in ganzen Kilometern, mit Spanne „knapp“. Nichts geht hinaus.

test('Ort mit Postleitzahl: Heft zeigt die Luftlinie als „ca.“ mit Abweichung', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await wuenscheSetzen(page, {
    warmBis: null,
    zimmerAb: null,
    flaecheAb: null,
    ort: { name: 'UKE', kmBis: 1, plz: '20251' },
    einzugVon: null,
    einzugBis: null,
  });
  await page.evaluate(
    () =>
      new Promise<void>((fertig, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction(['haushalte', 'hefte'], 'readwrite');
          const hh = tx.objectStore('haushalte').getAll();
          hh.onsuccess = () => {
            const jetzt = new Date().toISOString();
            tx.objectStore('hefte').put({
              id: 'lage',
              createdAt: jetzt,
              updatedAt: jetzt,
              haushaltId: (hh.result[0] as { id: string }).id,
              adresse: 'Lindenallee 3\n20259 Hamburg',
              link: null,
              quelle: '',
              inseratText: null,
              kennung: 'k-lage',
              angaben: {
                titel: 'Altbau',
                stadtteil: 'Eimsbüttel',
                warm: 1200,
                zimmer: 3,
                flaeche: 70,
              },
              ereignisse: { beworben: null, gefragtAm: null, termin: null, ergebnis: null },
              notiz: '',
            });
          };
          tx.oncomplete = () => {
            db.close();
            fertig();
          };
          tx.onerror = () => fehler(tx.error);
        };
        r.onerror = () => fehler(r.error);
      }),
  );
  await page.goto('/#/heft/lage');
  await page.reload();
  await expect(page.getByText(/UKE ca\.\s\d\skm entfernt, bis 1\skm gewünscht/)).toBeVisible();
});

test('Wünsche: Postleitzahl des Orts eingeben', async ({ page }) => {
  await haushaltMitMax(page);
  await page.goto('/#/wuensche');
  await page.getByRole('button', { name: /Weg dorthin/ }).click();
  await page.getByPlaceholder('Ort, etwa Arbeit, Uni oder Kita').fill('UKE');
  await page.getByRole('textbox', { name: 'Höchstens entfernt' }).fill('5');
  await page.getByRole('textbox', { name: 'Postleitzahl des Orts' }).fill('20251');
  await expect(
    page.getByText('Damit rechnet Hefta die Luftlinie, ungefähr und nur auf diesem Gerät.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  const ort = await page.evaluate(
    () =>
      new Promise<unknown>((fertig) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const q = r.result.transaction('haushalte').objectStore('haushalte').getAll();
          q.onsuccess = () => fertig((q.result[0] as { wuensche: { ort: unknown } }).wuensche.ort);
        };
      }),
  );
  expect(ort).toEqual({ name: 'UKE', kmBis: 5, plz: '20251' });
});
