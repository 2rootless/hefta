import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import type { Page } from '@playwright/test';
import { animationenFertig } from './hilfen';
import { SZENARIEN, datensaetze } from './szenarien';

// Ein Szenario aus szenarien.ts in die Datenbank legen und eine Seite öffnen (wie bilder-app.spec.ts).

let beispiel = '';
async function beispielPdf(): Promise<string> {
  if (beispiel) return beispiel;
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of ['Verdienstabrechnung Oktober 2026', 'Seite 2'])
    doc.addPage([595, 842]).drawText(text, { x: 60, y: 760, size: 18, font: schrift });
  beispiel = Buffer.from(await doc.save()).toString('base64');
  return beispiel;
}

/** Ein PDF mit je einem Text pro Seite, oben links. */
export async function pdfMit(seiten: string[], groesse = 12): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of seiten)
    for (const [i, zeile] of text.split('\n').entries())
      (i === 0 ? doc.addPage([595, 842]) : doc.getPage(doc.getPageCount() - 1)).drawText(zeile, {
        x: 60,
        y: 760 - i * 20,
        size: groesse,
        font: schrift,
      });
  return Buffer.from(await doc.save());
}

/** Gehaltsabrechnungen wie in den Mustermappen, neuester Monat zuerst. */
export async function gehaltsPdfs(monate: string[]) {
  const liste = [];
  for (const monat of monate) {
    const doc = await PDFDocument.create();
    const fett = await doc.embedFont(StandardFonts.HelveticaBold);
    const schrift = await doc.embedFont(StandardFonts.Helvetica);
    const s = doc.addPage([595, 842]);
    s.drawText('Musterwerk GmbH', { x: 60, y: 780, size: 14, font: fett });
    s.drawText(`Verdienstabrechnung ${monat} 2026`, { x: 60, y: 750, size: 14, font: fett });
    s.drawText('Mitarbeiter: Max Mustermann', { x: 60, y: 720, size: 11, font: schrift });
    liste.push({
      name: `Gehalt_${monat}_2026.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from(await doc.save()),
    });
  }
  return liste;
}

export async function szenarioLaden(page: Page, szenario: string, pfad: string) {
  const s = SZENARIEN.find((x) => x.id === szenario);
  if (!s) throw new Error(`Szenario ${szenario} gibt es nicht`);
  await page.route('**/__leer', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>leer</title>' }),
  );
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  await page.goto('/__leer');
  await page.evaluate(
    async ({ daten, pdf }) => {
      const db = await new Promise<IDBDatabase>((ok, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => fehler(r.error);
      });
      const orte = [...db.objectStoreNames];
      const tx = db.transaction(orte, 'readwrite');
      for (const ort of orte) tx.objectStore(ort).clear();
      for (const [ort, liste] of Object.entries(daten))
        for (const d of liste as object[]) tx.objectStore(ort).put(d);
      const bytes = Uint8Array.from(atob(pdf), (z) => z.charCodeAt(0));
      for (const v of (daten as { versionen: { original: string }[] }).versionen)
        tx.objectStore('dateien').put({
          id: v.original,
          createdAt: new Date().toISOString(),
          typ: 'application/pdf',
          groesse: bytes.length,
          daten: bytes.buffer,
        });
      await new Promise((ok) => (tx.oncomplete = ok));
      db.close();
    },
    { daten: datensaetze(s), pdf: await beispielPdf() },
  );
  await page.goto(`/#${pfad}`);
  await page.locator('main h1, main h2').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await animationenFertig(page);
}
