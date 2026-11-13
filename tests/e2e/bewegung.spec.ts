import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { animationenFertig, cspMelden } from './hilfen';
import { HEUTE, SZENARIEN, datensaetze } from './szenarien';

// Bewegung im Tab „Mappe“ (B21). Was sich seit dem letzten Blick geändert hat, bewegt sich einmal,
// höchstens 400 ms lang, nur mit den Tokens aus design/tokens.css. Kein Inhalt steckt nur in der
// Bewegung: Mit und ohne „Bewegung reduzieren“ ist der Endzustand derselbe, Bild für Bild, und nichts
// im Tab bewegt sich von selbst.

async function beispielPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText('Bonitaet', { x: 60, y: 700, size: 18, font: f });
  return Buffer.from(await doc.save());
}

/**
 * Lädt ein Szenario, ohne Petras Bonitätsnachweis. 04-fertig: eine Unterlage bis „alles da“;
 * 01-standard: zwei offen (Petras Bonität, Max’ Gehalt läuft bald ab).
 */
async function laden(page: Page, szenario: '04-fertig' | '01-standard', dateien?: number[]) {
  const daten = datensaetze(SZENARIEN.find((s) => s.id === szenario)!);
  const petraBonitaet = (daten.dokumente as { id: string; personId: string; typ: string }[]).find(
    (d) => d.personId.endsWith('-2') && d.typ === 'bonitaet',
  )?.id;
  daten.versionen = (daten.versionen as { dokumentId: string }[]).filter(
    (v) => v.dokumentId !== petraBonitaet,
  );
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  await page.evaluate(
    async ({ daten, dateien }) => {
      const db = await new Promise<IDBDatabase>((ok) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => ok(r.result);
      });
      const orte = [...db.objectStoreNames];
      const tx = db.transaction(orte, 'readwrite');
      for (const ort of orte) tx.objectStore(ort).clear();
      for (const [ort, liste] of Object.entries(daten))
        for (const d of liste as object[]) tx.objectStore(ort).put(d);
      // Mit `dateien`: zu jeder Version eine echte PDF, damit die Mappe wirklich gebaut wird.
      if (dateien)
        for (const v of (daten as { versionen: { original: string }[] }).versionen)
          tx.objectStore('dateien').put({
            id: v.original,
            createdAt: new Date().toISOString(),
            typ: 'application/pdf',
            groesse: dateien.length,
            daten: new Uint8Array(dateien).buffer,
          });
      await new Promise((ok) => (tx.oncomplete = ok));
      db.close();
    },
    { daten, dateien },
  );
  await page.goto('about:blank');
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible();
}

async function bonitaetHochladen(page: Page) {
  await page.getByRole('button', { name: /^Bonitäts/ }).click();
  const blatt = page.getByRole('dialog');
  await blatt.locator('[data-feld="pdf"]').setInputFiles({
    name: 'bonitaet.pdf',
    mimeType: 'application/pdf',
    buffer: await beispielPdf(),
  });
  await blatt.getByRole('button', { name: 'Heute' }).click();
  await blatt.getByRole('button', { name: 'Speichern' }).click();
  await expect(blatt).toBeHidden();
}

interface Bewegung {
  name: string;
  dauer: number;
  verzoegerung: number;
  schleife: boolean;
}

/**
 * Zeichnet auf, was während der Bewegung zu sehen ist: Die Marken bleiben nur rund 400 ms, darum misst
 * ein Beobachter im Browser mit, statt danach nachzusehen. Je Wähler: erster Fund, mit „inert“ und Text.
 */
async function aufzeichnen(page: Page, waehler: string[]) {
  await page.evaluate((waehler) => {
    const w = window as unknown as {
      __gesehen: Record<string, string>;
      __bewegungen: Bewegung[];
    };
    w.__gesehen = {};
    w.__bewegungen = [];
    const bekannt = new WeakSet<Animation>();
    const pruefen = () => {
      for (const s of waehler) {
        const e = document.querySelector(s);
        if (e && !(s in w.__gesehen))
          w.__gesehen[s] =
            (e.hasAttribute('inert') ? '[inert] ' : '') + (e.textContent ?? '').trim();
      }
      for (const a of document.getAnimations()) {
        if (bekannt.has(a)) continue;
        bekannt.add(a);
        const z = a.effect!.getComputedTiming();
        w.__bewegungen.push({
          name: ((a as CSSAnimation).animationName ?? 'transition').replace(/^svelte-\w+-/, ''),
          dauer: Number(z.duration),
          verzoegerung: Number(a.effect!.getTiming().delay ?? 0),
          schleife: z.iterations === Infinity,
        });
      }
    };
    new MutationObserver(pruefen).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }, waehler);
}

function aufgezeichnet(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __gesehen: Record<string, string>; __bewegungen: Bewegung[] };
    return { gesehen: w.__gesehen, bewegungen: w.__bewegungen };
  });
}

function bewegungen(page: Page): Promise<Bewegung[]> {
  return page.evaluate(() =>
    document.getAnimations().map((a) => {
      const z = a.effect!.getComputedTiming();
      return {
        name: (a as CSSAnimation).animationName ?? 'transition',
        dauer: Number(z.duration),
        verzoegerung: Number(a.effect!.getTiming().delay ?? 0),
        schleife: z.iterations === Infinity,
      };
    }),
  );
}

function regelnEinhalten(liste: Bewegung[]) {
  // Jede Bewegung höchstens 300 ms, mit Verzögerung höchstens 400 ms, Verzögerung in Takten.
  for (const b of liste) {
    expect(b.dauer).toBeLessThanOrEqual(300);
    expect(b.dauer + b.verzoegerung).toBeLessThanOrEqual(400);
    expect(b.verzoegerung % 40).toBe(0);
    expect(b.schleife).toBe(false);
  }
}

async function endzustand(page: Page) {
  await expect(page.getByText('Alles da. Ihr seid startklar.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mappe teilen' })).toBeVisible();
  // Nach der Bewegung sind die Marken weg, und was ging, ist ganz heraus.
  await expect(page.locator('.moment, .kam, .geist, .neu, .blende')).toHaveCount(0);
  const laufend = (await bewegungen(page)).filter((b) => b.schleife);
  expect(laufend).toHaveLength(0);
}

/** Bild des Tabs nach der Bewegung, für den Vergleich mit „Bewegung reduzieren“. */
async function bildNachher(browser: Browser, reduziert: boolean): Promise<Buffer> {
  const kontext = await browser.newContext({
    reducedMotion: reduziert ? 'reduce' : 'no-preference',
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block',
  });
  const page = await kontext.newPage();
  await page.clock.setFixedTime(HEUTE);
  await laden(page, '01-standard');
  await bonitaetHochladen(page);
  await expect(page.locator('.kam, .geist, .neu, .blende')).toHaveCount(0);
  await animationenFertig(page);
  await page.mouse.move(0, 0);
  const bild = await page.locator('main').screenshot({ animations: 'disabled', caret: 'hide' });
  await kontext.close();
  return bild;
}

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
  await page.clock.setFixedTime(HEUTE);
});

test.describe('mit Bewegung', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('„Alles da“ (B21-02): Kasten, Satz, Haken, Knopf; danach Ruhe', async ({ page }) => {
    await laden(page, '04-fertig');
    await expect(page.getByText('Noch ein Ding, dann seid ihr startklar.')).toBeVisible();
    await aufzeichnen(page, [
      '.aufgaben.fertig.moment',
      '.zeile.da.kam',
      '.einblenden-neu',
      '.leiste .geist',
    ]);
    await bonitaetHochladen(page);
    await endzustand(page);
    const { gesehen, bewegungen: liste } = await aufgezeichnet(page);
    // Die Zeile im Blatt tönt, der Haken zieht sich; „trotzdem teilen“ geht und ist nicht erreichbar.
    expect(gesehen).toEqual({
      '.aufgaben.fertig.moment': expect.stringContaining('Alles da. Ihr seid startklar.'),
      '.zeile.da.kam': expect.stringMatching(/^Bonitäts/),
      '.einblenden-neu': 'Mappe teilen',
      '.leiste .geist': '[inert] Mappe trotzdem teilen',
    });
    regelnEinhalten(liste);
    expect(liste.map((b) => b.name)).toEqual(
      expect.arrayContaining(['fertig-grund', 'bw-steigen', 'bw-haken', 'bw-toenen', 'bw-zu']),
    );
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  });

  test('Eine Unterlage kommt an (B21-01): Aufgabe schließt ihren Platz, Zahl steigt ein', async ({
    page,
  }) => {
    await laden(page, '01-standard');
    await expect(page.locator('.aufgabe')).toHaveCount(2);
    await aufzeichnen(page, [
      'li.geist',
      '.zeile.da.kam',
      '.leiste small.neu',
      '#aufgaben-titel.blende',
    ]);
    await bonitaetHochladen(page);
    // Danach: eine Aufgabe, keine Marken.
    await expect(page.locator('.kam, .geist, .neu, .blende')).toHaveCount(0);
    await expect(page.locator('.aufgabe')).toHaveCount(1);
    const { gesehen, bewegungen: liste } = await aufgezeichnet(page);
    // Die Aufgabe blieb kurz als Geist stehen, nicht erreichbar, und schloss ihren Platz.
    expect(gesehen).toEqual({
      'li.geist': expect.stringMatching(/^\[inert\] Bonitäts/),
      '.zeile.da.kam': expect.stringMatching(/^Bonitäts/),
      '.leiste small.neu': '1 offen',
      '#aufgaben-titel.blende': expect.stringContaining('Noch ein Ding'),
    });
    regelnEinhalten(liste);
    expect(liste.map((b) => b.name)).toEqual(
      expect.arrayContaining(['aufgabe-zu', 'bw-zahl', 'bw-toenen', 'bw-haken']),
    );
  });

  test('zurück in den Tab ohne Änderung: nichts bewegt sich', async ({ page }) => {
    await laden(page, '01-standard');
    await page.evaluate(() => (location.hash = '#/einstellungen'));
    await expect(page.getByRole('heading', { level: 2, name: 'Über Hefta' })).toBeVisible();
    await page.evaluate(() => (location.hash = '#/'));
    await expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible();
    await expect(page.locator('.moment, .kam, .geist, .neu, .blende')).toHaveCount(0);
  });

  test('Endzustand mit und ohne „Bewegung reduzieren“ Bild für Bild gleich', async ({
    browser,
  }) => {
    const mit = await bildNachher(browser, false);
    const ohne = await bildNachher(browser, true);
    expect(mit.equals(ohne)).toBe(true);
  });
});

test('Mappe entsteht (B21-06): nach 400 ms ein ruhiger Kasten mit echtem Fortschritt, dann der Knopf', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CPU bremsen geht nur in Chromium');
  await laden(page, '04-fertig', [...(await beispielPdf())]);
  await aufzeichnen(page, ['.bau[role="status"]', '.bau-linie[role="progressbar"]']);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 40 });
  const start = Date.now();
  await page.evaluate(() => (location.hash = '#/mappe'));
  await expect(page.locator('.bau')).toBeVisible({ timeout: 30_000 });
  expect(Date.now() - start).toBeGreaterThanOrEqual(400);
  // Fortschritt mit Wert, nie unbestimmt; keine Schleife.
  const wert = page.locator('.bau-linie');
  await expect(wert).toHaveAttribute('aria-valuemax', /^[1-9]\d*$/);
  for (const b of await bewegungen(page)) expect(b.schleife).toBe(false);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await expect(page.locator('.bau')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Als PDF teilen' })).toBeVisible();
  const { gesehen } = await aufgezeichnet(page);
  expect(gesehen['.bau[role="status"]']).toContain('Hefta legt die Mappe zusammen.');
});

test.describe('Bewegung reduzieren', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('derselbe Endzustand; was geht, ist sofort weg', async ({ page }) => {
    await laden(page, '04-fertig');
    await bonitaetHochladen(page);
    // Keine Geister: Was geht, verschwindet sofort. Nur Überblenden mit 120 ms bleibt.
    await expect(page.locator('.geist')).toHaveCount(0);
    for (const b of await bewegungen(page)) expect([0, 120]).toContain(b.dauer);
    await endzustand(page);
  });
});
