import { test, type Page } from '@playwright/test';

// Hilfen für die Tests der Hefte (hefte.spec.ts, neues-heft-app.spec.ts).

/** Wünsche des Haushalts direkt in die Datenbank (der Bildschirm dafür kommt mit E45). */
export async function wuenscheSetzen(page: Page, wuensche: unknown) {
  await page.evaluate(
    (w) =>
      new Promise<void>((fertig, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction('haushalte', 'readwrite');
          const st = tx.objectStore('haushalte');
          const alle = st.getAll();
          alle.onsuccess = () => {
            for (const h of alle.result as Record<string, unknown>[]) st.put({ ...h, wuensche: w });
          };
          tx.oncomplete = () => {
            db.close();
            fertig();
          };
          tx.onerror = () => fehler(tx.error);
        };
        r.onerror = () => fehler(r.error);
      }),
    wuensche,
  );
}

/** Bild der ganzen Seite ohne Verrutschen fester Leisten: das Fenster so hoch wie die Seite. */
export async function ganzesBild(page: Page, name: string) {
  // Erst, wenn jede Bewegung zu Ende ist, sonst steht die Seite halb eingeblendet im Bild.
  // Das Bewegungs-Modul bricht seine Animationen am Ende mit `cancel` ab; dann scheitert `finished`.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  const hoehe = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: 390, height: hoehe });
  await page.screenshot({ path: test.info().outputPath(name) });
  await page.setViewportSize({ width: 390, height: 844 });
}

/** Hefte direkt in die Datenbank legen, am Haushalt, wenn es einen gibt. */
export async function hefteAnlegen(page: Page, hefte: unknown[]) {
  await page.evaluate(
    (liste) =>
      new Promise<void>((fertig, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction(['haushalte', 'hefte'], 'readwrite');
          const hh = tx.objectStore('haushalte').getAll();
          hh.onsuccess = () => {
            const haushaltId = (hh.result[0] as { id: string } | undefined)?.id ?? null;
            for (const h of liste as { haushaltId: string | null }[])
              tx.objectStore('hefte').put({ ...h, haushaltId });
          };
          tx.oncomplete = () => {
            db.close();
            fertig();
          };
          tx.onerror = () => fehler(tx.error);
        };
        r.onerror = () => fehler(r.error);
      }),
    hefte,
  );
}
