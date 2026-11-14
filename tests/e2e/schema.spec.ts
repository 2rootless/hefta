import { expect, test } from '@playwright/test';

// Schema 2 (Hefta 2): Wer Version 1 im Browser nutzt, hat eine Datenbank in Schema 1. Beim ersten Öffnen
// nach dem Update baut der Browser sie um. Das prüft dieser Test im echten Browser, auch in WebKit,
// denn dort liegen die Daten der meisten (docs/32-bauplan-hefta-2-schritt-1.md).

test('Schema 1 → 2: Die Bewerbung mit Adresse wird ein Heft, nichts geht verloren', async ({
  page,
}) => {
  // Eine Seite derselben Herkunft, die die App nicht startet: Sonst legt sie Schema 2 an, bevor der Test kann.
  await page.goto('/lizenzen.txt');
  // Eine Datenbank wie aus Version 1, von Hand angelegt, bevor die App sie öffnet.
  await page.evaluate(
    () =>
      new Promise<void>((fertig, fehler) => {
        const r = indexedDB.open('hefta', 1);
        r.onupgradeneeded = () => {
          const db = r.result;
          for (const ort of [
            'personen',
            'haushalte',
            'dokumente',
            'versionen',
            'exportprofile',
            'einstellungen',
            'dateien',
          ])
            db.createObjectStore(ort, { keyPath: 'id' });
          const zug = db.createObjectStore('zugehoerigkeiten', { keyPath: 'id' });
          zug.createIndex('haushaltId', 'haushaltId');
          zug.createIndex('personId', 'personId');
          db.createObjectStore('bewerbungen', { keyPath: 'id' }).createIndex(
            'haushaltId',
            'haushaltId',
          );
          const zeit = '2026-11-01T10:00:00.000Z';
          r.transaction!.objectStore('bewerbungen').put({
            id: 'b1',
            createdAt: zeit,
            updatedAt: zeit,
            haushaltId: 'h1',
            adresse: 'Hauptstraße 12\n22767 Hamburg',
            quelle: '',
            inseratText: null,
            kennungen: {},
          });
        };
        r.onsuccess = () => {
          r.result.close();
          fertig();
        };
        r.onerror = () => fehler(r.error);
      }),
  );

  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Fangt an, wo ihr gerade seid' }),
  ).toBeVisible();
  const stand = await page.evaluate(
    () =>
      new Promise<{ version: number; hefte: unknown[]; bewerbungen: number }>((fertig) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction(['hefte', 'bewerbungen']);
          const h = tx.objectStore('hefte').getAll();
          const b = tx.objectStore('bewerbungen').count();
          tx.oncomplete = () => {
            fertig({ version: db.version, hefte: h.result, bewerbungen: b.result });
            db.close();
          };
        };
      }),
  );
  expect(stand.version).toBe(2);
  expect(stand.bewerbungen).toBe(1);
  expect(stand.hefte).toHaveLength(1);
  expect(stand.hefte[0]).toMatchObject({
    haushaltId: 'h1',
    adresse: 'Hauptstraße 12\n22767 Hamburg',
    ausVersion1: true,
  });
});
