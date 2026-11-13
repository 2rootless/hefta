import { readFileSync } from 'node:fs';
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { expect, test, type Page } from '@playwright/test';
import { cspMelden } from './hilfen';
import { HEUTE, SZENARIEN, datensaetze } from './szenarien';

// Letzte Runde aus dem Test am iPhone: mit zwei Fingern vergrößern, der freiwillige Satz beim Erstellen,
// Verkleinern auch bei Scans mit Textschicht.

async function laden(page: Page, szenario: string, pfad: string, pdf: number[]) {
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  await page.evaluate(
    async ({ daten, pdf }) => {
      const db = await new Promise<IDBDatabase>((ok) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => ok(r.result);
      });
      const orte = [...db.objectStoreNames];
      const tx = db.transaction(orte, 'readwrite');
      for (const ort of orte) tx.objectStore(ort).clear();
      for (const [ort, liste] of Object.entries(daten))
        for (const d of liste as object[]) tx.objectStore(ort).put(d);
      for (const v of (daten as { versionen: { original: string }[] }).versionen)
        tx.objectStore('dateien').put({
          id: v.original,
          createdAt: new Date().toISOString(),
          typ: 'application/pdf',
          groesse: pdf.length,
          daten: new Uint8Array(pdf).buffer,
        });
      await new Promise((ok) => (tx.oncomplete = ok));
      db.close();
    },
    { daten: datensaetze(SZENARIEN.find((s) => s.id === szenario)!), pdf },
  );
  await page.goto('about:blank');
  await page.goto(`/#${pfad}`);
  await page.locator('main h1').first().waitFor();
}

async function textPdf(): Promise<number[]> {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  for (const n of [1, 2])
    doc.addPage([595, 842]).drawText(`Seite ${n}`, { x: 60, y: 700, size: 18, font: f });
  return [...(await doc.save())];
}

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
  await page.clock.setFixedTime(HEUTE);
});

test('Großes Bild: mit zwei Fingern vergrößern, der Punkt unter den Fingern bleibt', async ({
  page,
  browserName,
}) => {
  // Echte Berührungen mit zwei Fingern lassen sich nur in Chromium auslösen.
  test.skip(browserName !== 'chromium', 'braucht das Chrome-Protokoll');
  await laden(page, '04-fertig', '/mappe', await textPdf());
  await page
    .getByText(/^\d+ Seiten$/)
    .first()
    .waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Deckblatt groß ansehen' }).click();
  await page.getByRole('button', { name: 'Ganze Mappe ansehen' }).click();
  const ansicht = page.getByRole('dialog', { name: /^Seite 1 von \d+$/ });
  await expect(ansicht.getByRole('img', { name: 'Seite 1' })).toBeVisible();
  const ganz = ansicht.getByRole('button', { name: 'Ganz' });
  await expect(ganz).toHaveAttribute('aria-pressed', 'true');

  const cdp = await page.context().newCDPSession(page);
  const finger = (a: number[], b: number[]) => [
    { x: a[0]!, y: a[1]!, id: 0 },
    { x: b[0]!, y: b[1]!, id: 1 },
  ];
  const geste = async (von: number[][], nach: number[][]) => {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: finger(von[0]!, von[1]!),
    });
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      const punkt = (k: number) =>
        [0, 1].map((a) => von[k]![a]! + (nach[k]![a]! - von[k]![a]!) * t);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: finger(punkt(0), punkt(1)),
      });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  };
  const blatt = () =>
    page.evaluate(() => {
      const f = document.querySelector<HTMLElement>('dialog[open] .flaeche')!;
      const b = document.querySelector<HTMLElement>('dialog[open] .blatt')!;
      const r = b.getBoundingClientRect();
      const stil = getComputedStyle(f);
      const breite = f.clientWidth - parseFloat(stil.paddingLeft) - parseFloat(stil.paddingRight);
      return { links: r.left, oben: r.top, breite: r.width, hoehe: r.height, flaeche: breite };
    });

  // Aufziehen: etwa doppelt so groß, die Knöpfe stimmen danach (rastet bei 2× ein).
  await geste(
    [
      [145, 400],
      [245, 400],
    ],
    [
      [95, 400],
      [295, 400],
    ],
  );
  await expect(ansicht.getByRole('button', { name: '2×' })).toHaveAttribute('aria-pressed', 'true');
  await expect(ganz).toHaveAttribute('aria-pressed', 'false');
  const zwei = await blatt();
  expect(zwei.breite / zwei.flaeche).toBeCloseTo(2, 1);

  // Noch weiter, abseits der Mitte: Derselbe Punkt der Seite bleibt unter den Fingern.
  const mitte = { x: 150, y: 350 };
  const anteilX = (mitte.x - zwei.links) / zwei.breite;
  const anteilY = (mitte.y - zwei.oben) / zwei.hoehe;
  await geste(
    [
      [110, 350],
      [190, 350],
    ],
    [
      [90, 350],
      [210, 350],
    ],
  );
  const danach = await blatt();
  expect(danach.breite / danach.flaeche).toBeCloseTo(3, 0);
  expect(Math.abs((mitte.x - danach.links) / danach.breite - anteilX)).toBeLessThan(0.02);
  expect(Math.abs((mitte.y - danach.oben) / danach.hoehe - anteilY)).toBeLessThan(0.02);
  // Die App vergrößert, nicht der Browser.
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);

  // Ganz zusammen: wieder die ganze Seite, oben angelegt, und „Ganz“ stimmt.
  await geste(
    [
      [60, 400],
      [330, 400],
    ],
    [
      [180, 400],
      [210, 400],
    ],
  );
  await expect(ganz).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('dialog[open] .blatt')).toHaveClass(/ganz/);
  expect(
    await page.evaluate(() => document.querySelector('dialog[open] .flaeche')!.scrollTop),
  ).toBe(0);

  // Ein Finger bleibt beim Scrollen, und die Knöpfe gehen weiter.
  await ansicht.getByRole('button', { name: '3×' }).click();
  const drei = await blatt();
  expect(drei.breite / drei.flaeche).toBeCloseTo(3, 1);
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('Der freiwillige Satz steht bei „Mappe erstellen“ und kommt aufs Deckblatt', async ({
  page,
}, info) => {
  await laden(page, '04-fertig', '/mappe', await textPdf());
  await page
    .getByText(/^\d+ Seiten$/)
    .first()
    .waitFor({ timeout: 30_000 });

  // Nicht doppelt: In „Mappe anpassen“ ist er weg.
  await page.evaluate(() => (location.hash = '#/mappe/anpassen'));
  await page.getByRole('heading', { name: 'Mappe anpassen' }).waitFor();
  await expect(page.getByText('Ein Satz zu euch')).toHaveCount(0);
  await page
    .getByRole('link', { name: /Mappe teilen|Zurück/ })
    .first()
    .click();
  await page
    .getByText(/^\d+ Seiten$/)
    .first()
    .waitFor({ timeout: 30_000 });

  const SATZ = 'Wir sind ein ruhiges Paar und suchen ab Januar.';
  await page.evaluate(() => (location.hash = '#/mappe/deckblatt'));
  await page.getByRole('button', { name: 'Satz ändern' }).click();
  const blatt = page.getByRole('dialog', { name: 'Ein Satz zu euch' });
  await blatt.getByRole('textbox').fill(SATZ);
  await blatt.getByRole('button', { name: 'Übernehmen' }).click();
  await page.evaluate(() => (location.hash = '#/mappe'));
  await page.getByRole('button', { name: 'PDF ansehen' }).waitFor({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'PDF ansehen' })).toBeEnabled({ timeout: 30_000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF ansehen' }).click(),
  ]);
  const pfad = info.outputPath('mappe.pdf');
  await download.saveAs(pfad);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const dok = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(pfad)) }).promise;
  const inhalt = await (await dok.getPage(1)).getTextContent();
  const text = inhalt.items.map((i) => ('str' in i ? i.str : '')).join(' ');
  expect(text.replace(/\s+/g, ' ')).toContain('ruhiges Paar');

  // Bleibt, und „Übernehmen“ ohne Änderung lässt die Mappe nicht auf „wird berechnet“ stehen.
  await page.reload();
  await page
    .getByText(/^\d+ Seiten$/)
    .first()
    .waitFor({ timeout: 30_000 });
  // Seit B23 steht der Satz auf der großen Ansicht des Deckblatts zum Ändern bereit.
  await page.evaluate(() => (location.hash = '#/mappe/deckblatt'));
  await page.getByRole('button', { name: 'Satz ändern' }).click();
  await expect(blatt.getByRole('textbox')).toHaveValue(SATZ);
  await blatt.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(blatt).toBeHidden();
  await page.evaluate(() => (location.hash = '#/mappe'));
  await expect(page.getByRole('button', { name: 'PDF ansehen' })).toBeEnabled({ timeout: 10_000 });
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('Scan mit Textschicht: wird kleiner, der Text bleibt lesbar und markierbar', async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  // Ein Scan, wie ihn Scan-Apps ablegen: ganze Seite als großes JPEG, Text unsichtbar darüber.
  await page.goto('/');
  const jpeg = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 2480;
    c.height = 3508;
    const ctx = c.getContext('2d')!;
    const bild = ctx.createImageData(c.width, c.height);
    let x = 1;
    for (let i = 0; i < bild.data.length; i += 4) {
      x = (x * 1664525 + 1013904223) >>> 0;
      const wert = 225 + (x >>> 26);
      bild.data[i] = wert;
      bild.data[i + 1] = wert;
      bild.data[i + 2] = wert;
      bild.data[i + 3] = 255;
    }
    ctx.putImageData(bild, 0, 0);
    ctx.fillStyle = '#111';
    ctx.font = '60px sans-serif';
    ctx.fillText('Gehaltsabrechnung', 300, 500);
    const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), 'image/jpeg', 0.9));
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const bild = await doc.embedJpg(new Uint8Array(jpeg));
  const seite = doc.addPage([595, 842]);
  seite.drawImage(bild, { x: 0, y: 0, width: 595, height: 842 });
  seite.drawText('Textschicht bleibt', { x: 60, y: 700, size: 18, font: f, opacity: 0 });
  const pdf = [...(await doc.save())];
  expect(pdf.length).toBeGreaterThan(1024 * 1024);

  await laden(page, '04-fertig', '/mappe', pdf);
  const moeglich = page.getByText(/Verkleinert wären es etwa/);
  await moeglich.waitFor({ timeout: 120_000 });
  const groesse = (s: string) => {
    const m = /([\d,]+) (KB|MB)/.exec(s)!;
    return parseFloat(m[1]!.replace(',', '.')) * (m[2] === 'MB' ? 1024 : 1);
  };
  const geschaetzt = groesse(/etwa (.*)\./.exec(await moeglich.innerText())![1]!);
  const vorher = groesse(
    await page
      .getByText(/^Die Mappe ist .*groß/)
      .first()
      .innerText(),
  );
  expect(geschaetzt).toBeLessThan(vorher * 0.5);

  await page.getByRole('button', { name: 'Scans und Bilder verkleinern' }).click();
  await page.getByText('verkleinert', { exact: true }).waitFor({ timeout: 120_000 });
  const nachher = groesse(await page.locator('.stand .zahlen span').last().innerText());
  expect(nachher).toBeLessThan(vorher * 0.5);
  // Die Schätzung liegt in der Nähe dessen, was wirklich herauskommt.
  expect(geschaetzt / nachher).toBeGreaterThan(0.5);
  expect(geschaetzt / nachher).toBeLessThan(2);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF ansehen' }).click({ timeout: 60_000 }),
  ]);
  const pfad = info.outputPath('mappe.pdf');
  await download.saveAs(pfad);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const dok = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(pfad)) }).promise;
  let gefunden = false;
  for (let n = 1; n <= dok.numPages; n++) {
    const inhalt = await (await dok.getPage(n)).getTextContent();
    if (inhalt.items.some((i) => 'str' in i && i.str.includes('Textschicht bleibt')))
      gefunden = true;
  }
  expect(gefunden).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('Bitte zum Löschen: aus als Standard, Satz auf eigener Seite, auf dem Deckblatt und im Anhang (AM4, P25, P26)', async ({
  page,
}, info) => {
  await laden(page, '04-fertig', '/mappe/anpassen', await textPdf());
  const schalter = page.getByRole('switch', { name: 'Bitte, die Unterlagen zu löschen' });
  await expect(schalter).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText(/falls ihr die Wohnung nicht bekommt$/)).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Hinweis und Lesehilfe' })).toBeVisible();

  // Beim Einschalten steht der Vorschlag da, gesiezt und ganz.
  await schalter.click();
  await expect(
    page.getByText(/^„Falls die Wohnung an jemand anderen geht, löschen Sie/),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Satz ändern' }).click();
  await page.getByRole('heading', { name: 'Bitte an den Vermieter' }).waitFor();
  const feld = page.getByRole('textbox', { name: 'Bitte an den Vermieter' });
  await expect(page.getByRole('button', { name: 'Vorschlag wieder einsetzen' })).toHaveCount(0);

  // Ein Absatz, höchstens 120 Zeichen.
  await feld.fill('Zeile eins\nZeile zwei');
  await expect(feld).toHaveValue('Zeile eins Zeile zwei');
  await feld.fill('x'.repeat(200));
  await expect(page.getByText('120 von 120 Zeichen')).toBeVisible();
  await page.getByRole('button', { name: 'Vorschlag wieder einsetzen' }).click();
  await expect(feld).toHaveValue(/^Falls die Wohnung/);

  // Ganz leer schaltet sie aus; eingeschaltet steht wieder der Vorschlag da.
  await feld.fill('');
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.getByRole('heading', { name: 'Mappe anpassen' }).waitFor();
  await expect(schalter).toHaveAttribute('aria-checked', 'false');
  await schalter.click();
  await expect(
    page.getByText(/^„Falls die Wohnung an jemand anderen geht, löschen Sie/),
  ).toBeVisible();

  // Ohne Deckblatt gesperrt, die Wahl bleibt.
  await page.getByRole('switch', { name: 'Deckblatt' }).click();
  await expect(page.getByText('Nur mit Deckblatt')).toBeVisible();
  await expect(schalter).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('switch', { name: 'Deckblatt' }).click();
  await expect(schalter).toHaveAttribute('aria-checked', 'true');

  // In der Mappe: auf dem Deckblatt und zeichengleich im Anhang.
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.getByRole('heading', { name: 'Mappe teilen' }).waitFor();
  await expect(page.getByRole('button', { name: 'PDF ansehen' })).toBeEnabled({ timeout: 30_000 });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF ansehen' }).click(),
  ]);
  const pfad = info.outputPath('mappe.pdf');
  await download.saveAs(pfad);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const dok = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(pfad)) }).promise;
  const inhalt = await (await dok.getPage(1)).getTextContent();
  const text = inhalt.items
    .map((i) => ('str' in i ? i.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ');
  const SATZ =
    'Falls die Wohnung an jemand anderen geht, löschen Sie diese Unterlagen bitte. Vielen Dank.';
  expect(text).toContain(SATZ);
  const anhaenge = await dok.getAttachments();
  const [id] = [...anhaenge!.entries()].find(([, a]) => a.filename === 'hefta.json')!;
  const anhang = JSON.parse(new TextDecoder().decode((await dok.getAttachmentContent(id))!));
  expect(anhang.loeschwunsch).toBe(SATZ);
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});
