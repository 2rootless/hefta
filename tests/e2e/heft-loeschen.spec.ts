import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { hefteAnlegen } from './hefte-hilfen';

// Heft löschen (DP49 Punkt 12, W31, Prüfkatalog H1 bis H3): unten im Heft, grau, die Bitte in der Seite;
// danach „Rückgängig“ an der Stelle des Hefts, bis man die Liste verlässt. Fotos und Notizen gehen mit,
// die Unterlagen der Personen bleiben.

const ALT = new Date(Date.now() - 2 * 3600_000).toISOString();
const leer = {
  beworben: null,
  gefragtAm: null,
  termin: null,
  ergebnis: null,
  loeschbitteAm: null,
  nachgefasstAm: null,
  abgelegtAm: null,
};
const heft = (id: string, adresse: string, extra: Record<string, unknown> = {}) => ({
  id,
  createdAt: ALT,
  updatedAt: ALT,
  haushaltId: null,
  adresse,
  link: null,
  quelle: '',
  inseratText: null,
  kennung: `k-${id}`,
  ereignisse: { ...leer },
  notiz: '',
  ...extra,
});

/** Zwei Fotos als Dateien, älter als die Schonfrist von `verwaisteDateienLoeschen`. */
async function fotosAnlegen(page: Page, ids: string[]) {
  await page.evaluate(
    ({ ids, alt }) =>
      new Promise<void>((fertig, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const tx = r.result.transaction('dateien', 'readwrite');
          for (const id of ids)
            tx.objectStore('dateien').put({
              id,
              createdAt: alt,
              typ: 'image/png',
              groesse: 3,
              // WebKit im Test speichert keine Blobs in IndexedDB (wie `dateiSpeichern`).
              daten: new Uint8Array([1, 2, 3]).buffer,
            });
          tx.oncomplete = () => {
            r.result.close();
            fertig();
          };
          tx.onerror = () => fehler(tx.error);
        };
      }),
    { ids, alt: ALT },
  );
}

/** Was in der Datenbank steht: das Heft, seine Fotos, die Zahl der Unterlagen. */
function stand(page: Page, heftId: string, fotos: string[]) {
  return page.evaluate(
    ({ heftId, fotos }) =>
      new Promise<{ heft: boolean; fotos: number; dokumente: number }>((fertig) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const tx = r.result.transaction(['hefte', 'dateien', 'dokumente'], 'readonly');
          const aus = { heft: false, fotos: 0, dokumente: 0 };
          tx.objectStore('hefte').get(heftId).onsuccess = (e) =>
            (aus.heft = !!(e.target as IDBRequest).result);
          for (const f of fotos)
            tx.objectStore('dateien').get(f).onsuccess = (e) => {
              if ((e.target as IDBRequest).result) aus.fotos++;
            };
          tx.objectStore('dokumente').count().onsuccess = (e) =>
            (aus.dokumente = (e.target as IDBRequest<number>).result);
          tx.oncomplete = () => {
            r.result.close();
            fertig(aus);
          };
        };
      }),
    { heftId, fotos },
  );
}

const FOTOS = ['foto-acht-1', 'foto-acht-2'];

async function vorbereiten(page: Page) {
  await haushaltMitMax(page);
  await fotosAnlegen(page, FOTOS);
  await hefteAnlegen(page, [
    heft('drei', 'Lindenring 3\n20259 Hamburg'),
    heft('acht', 'Lindenring 8\n20259 Hamburg', {
      notiz: 'Balkon nach Süden',
      fotos: FOTOS,
    }),
    heft('muster', 'Musterweg 7\n20255 Hamburg'),
  ]);
  await page.goto('/#/wohnungen');
  await page.reload();
  await expect(page.getByRole('link', { name: /Lindenring 8/ }).first()).toBeVisible();
  const reihe = await reiheLesen(page);
  await page
    .getByRole('link', { name: /Lindenring 8/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: /Lindenring 8/ })).toBeVisible();
  return reihe;
}

/** Die Zeilen der Liste von oben nach unten, auch die eines gelöschten Hefts. */
function reiheLesen(page: Page) {
  return (
    page
      .locator('.hefte')
      // Während des Seitenwechsels stehen kurz zwei Listen da; die neue ist die letzte.
      .last()
      .evaluate((e) =>
        [...e.querySelectorAll('a.z .ti, .weg-tx')].map((x) => (x.textContent ?? '').trim()),
      )
  );
}

test('H1: „Heft löschen“ grau unten, Bitte in der Seite; „Behalten“ löscht nichts', async ({
  page,
}) => {
  await vorbereiten(page);
  const knopf = page.getByRole('button', { name: 'Heft löschen' });
  await knopf.scrollIntoViewIfNeeded();
  await knopf.click();
  const karte = page.getByRole('group', { name: 'Lindenring 8 löschen?' });
  await expect(karte).toBeVisible();
  await expect(karte).toContainText(
    'Das Heft verschwindet von diesem Gerät, mit seinen Notizen und Fotos. Die Unterlagen von Max bleiben.',
  );
  // W5: „Löschen“ in Tinte, nicht in Rot; kein Dialog.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await karte.getByRole('button', { name: 'Behalten' }).click();
  await expect(karte).toHaveCount(0);
  expect(await stand(page, 'acht', FOTOS)).toMatchObject({ heft: true, fotos: 2 });
});

test('H2: Löschen, „Rückgängig“ an der Stelle des Hefts holt es mit Notiz und Fotos zurück', async ({
  page,
}) => {
  const reiheVorher = await vorbereiten(page);
  const vorher = await stand(page, 'acht', FOTOS);
  await page.getByRole('button', { name: 'Heft löschen' }).click();
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect(page).toHaveURL(/#\/wohnungen$/);
  const zeile = page.getByRole('status').filter({ hasText: 'Lindenring 8 gelöscht' });
  await expect(zeile).toBeVisible();
  await expect(page.getByText('„Rückgängig“ bleibt, bis du die Liste verlässt.')).toBeVisible();
  // An der Stelle des Hefts: Die Zeile steht, wo vorher das Heft stand.
  // Nach dem Seitenwechsel: erst dann steht nur noch die neue Liste da.
  await expect
    .poll(async () =>
      (await reiheLesen(page)).findIndex((x) => x.includes('Lindenring 8 gelöscht')),
    )
    .toBe(reiheVorher.findIndex((x) => x.includes('Lindenring 8')));
  expect((await reiheLesen(page)).length).toBe(reiheVorher.length);
  expect(await stand(page, 'acht', FOTOS)).toMatchObject({ heft: false, fotos: 2 });
  // Ohne Zeitdruck: nach einer Weile noch da.
  await page.waitForTimeout(1500);
  await expect(zeile).toBeVisible();

  await zeile.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(zeile).toHaveCount(0);
  await page
    .getByRole('link', { name: /Lindenring 8/ })
    .first()
    .click();
  await expect(page.getByRole('textbox', { name: 'Notizen' })).toHaveValue('Balkon nach Süden');
  expect(await stand(page, 'acht', FOTOS)).toEqual(vorher);
});

test('H3: Liste verlassen, dann ist das Heft mit Fotos weg; Unterlagen bleiben. Gegenprobe wird rot', async ({
  page,
}) => {
  await vorbereiten(page);
  const vorher = await stand(page, 'acht', FOTOS);
  await page.getByRole('button', { name: 'Heft löschen' }).click();
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect(page.getByText('Lindenring 8 gelöscht')).toBeVisible();
  await page.getByRole('link', { name: 'Mappe' }).click();
  await expect
    .poll(() => stand(page, 'acht', FOTOS))
    .toEqual({
      heft: false,
      fotos: 0,
      dokumente: vorher.dokumente,
    });
  // Zurück in der Liste: kein „Rückgängig“ mehr.
  await page.getByRole('link', { name: 'Wohnungen', exact: true }).click();
  await expect(page.getByText('Lindenring 8 gelöscht')).toHaveCount(0);
  // Gegenprobe: Ein Heft, das noch in der Datenbank steht, sieht die Prüfung.
  await hefteAnlegen(page, [heft('acht', 'Lindenring 8\n20259 Hamburg')]);
  expect((await stand(page, 'acht', FOTOS)).heft).toBe(true);
});
