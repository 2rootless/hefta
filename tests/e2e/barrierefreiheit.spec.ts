import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { PDFDocument } from '@cantoo/pdf-lib';
import { cspMelden } from './hilfen';
import { HEUTE, SZENARIEN, datensaetze } from './szenarien';

// Lesereihenfolge der Übersicht (design/unterlage-warum-haushalt.md, Abschnitt 4, lesefolge-U01.png).
// Geprüft wird der Zugänglichkeitsbaum des Browsers; VoiceOver selbst lässt sich hier nicht starten.

async function laden(page: Page, szenario: string, pfad = '/') {
  const leer = await PDFDocument.create();
  leer.addPage([595, 842]);
  const pdf = [...(await leer.save())];
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

const ueberschriften = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('main h1, main h2, main h3')].map(
      (h) =>
        `${h.tagName} ${h.querySelector('a')?.getAttribute('aria-label') ?? h.textContent?.replace(/\s+/g, ' ').trim()}`,
    ),
  );

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
  await page.clock.setFixedTime(HEUTE);
});

test('Tab „Mappe“: Überschriften, Personen als Links, Zeilen mit Stand, Reihenfolge', async ({
  page,
  browserName,
}) => {
  await laden(page, '01-standard');

  // Das Logo ist Schmuck. Ein Band gibt es im Tab „Mappe“ nicht mehr (B12b).
  await expect(page.getByRole('img', { name: /mappe/i })).toHaveCount(0);
  await expect(page.getByRole('img', { name: /^Fortschritt: / })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Haushalt bearbeiten: / })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Einstellungen' })).toBeVisible();

  // Überschriften: „Eure Mappe“, die Aufgaben, dann je Person ein Reiter, Bürgen nach der Trennzeile.
  const kopf = await ueberschriften(page);
  expect(kopf).toHaveLength(5);
  expect(kopf[0]).toBe('H1 Eure Mappe');
  expect(kopf[1]).toMatch(/^H2 Noch [a-zäöüß]+ Dinge?, dann seid ihr startklar\.$/);
  expect(kopf[2]).toBe('H2 Max Hauptmieter');
  expect(kopf[3]).toBe('H2 Lea Mitmieterin');
  expect(kopf[4]).toBe('H2 Petra Bürgin');

  // Jede Zeile sagt Unterlage, Stand und Marke in Worten.
  await expect(page.getByRole('link', { name: /^Selbstauskunft .+ da$/ }).first()).toBeVisible();
  await expect(
    page.getByRole('link', { name: /^Bonitäts.?nachweis fehlt noch$/ }).first(),
  ).toBeVisible();

  // Aufgaben tun etwas auf dieser Seite: Knöpfe. Was eine andere Seite öffnet, ist ein Link.
  await expect(page.getByRole('button', { name: /^Bonitätsnachweis für Petra/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mappe trotzdem teilen' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Jetzt sichern' })).toBeVisible();
  const haupt = page.getByRole('link', { name: /^Unterlagen hinzufügen, [a-zäöüß]+ offen$/ });
  await expect(haupt).toBeVisible();

  const baum = await page.locator('body').ariaSnapshot();
  const zeilen = baum.split('\n').map((z) => z.trim());
  const stelle = (muster: RegExp) => {
    const i = zeilen.findIndex((z) => muster.test(z));
    expect(i, String(muster)).toBeGreaterThanOrEqual(0);
    return i;
  };
  const reihenfolge = [
    /link "Einstellungen"/,
    /heading "Eure Mappe"/,
    /link "Haushalt bearbeiten: /,
    /heading "Noch /,
    /link "Max Hauptmieter"/,
    /link "Lea Mitmieterin"/,
    /Zusätzlich, falls der Vermieter fragt/,
    /link "Petra Bürgin"/,
    /link "Jetzt sichern"/,
    /link "Unterlagen hinzufügen, /,
    /button "Mappe trotzdem teilen"/,
  ].map(stelle);
  expect(reihenfolge).toEqual([...reihenfolge].sort((a, b) => a - b));

  // Abschrift für das Design: was der Browser Screenreadern anbietet, von oben nach unten.
  if (browserName === 'chromium')
    writeFileSync(
      'docs/lesefolge-U01-ist.txt',
      `Zugänglichkeitsbaum aus Chromium (Szenario 01-standard). Das ist NICHT VoiceOver.\n\n${baum}\n`,
    );
});

test('Ohne Bürgen gibt es keine Trennzeile: Die Personen sind Ebene 2', async ({ page }) => {
  await laden(page, '23-ohne-datum');
  const kopf = await ueberschriften(page);
  expect(kopf).toContain('H2 Max Hauptmieter');
  await expect(page.getByText('Zusätzlich, falls der Vermieter fragt')).toHaveCount(0);
  expect(kopf.some((k) => k.includes('Im Mietvertrag'))).toBe(false);
});

test('Personenansicht und Rutsch: Band als ein Satz, Personen als Tasten', async ({ page }) => {
  await laden(page, '01-standard', '/person/p-01-standard-0');
  await expect(page.getByRole('img', { name: /^Max: \S+ von \S+ aktuell$/ })).toHaveCount(1);
  await expect(page.getByRole('link', { name: /^Bonitäts/ })).toBeVisible();

  await laden(page, '01-standard', '/rutsch');
  await page.getByRole('button', { name: /^Max/ }).click();
  await expect(page.getByRole('img', { name: /^Schritt \S+ von \S+: .+ für Max$/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Zu Petra springen' })).toBeVisible();
  // Die Steine liest niemand einzeln vor.
  await expect(page.getByRole('button', { name: /^Schritt \d+ von/ })).toHaveCount(0);
});

test('Fokus: nach einem Seitenwechsel auf dem Titel, sichtbarer Ring, Felder behalten ihn', async ({
  page,
  browserName,
}) => {
  await laden(page, '01-standard');
  await page.getByRole('link', { name: /^Lea Mitmieterin$/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lea' })).toBeFocused();

  await page.getByRole('link', { name: 'Ändern', exact: false }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();

  // Ein Formular, das ein Feld fokussiert, behält den Fokus dort.
  await page.evaluate(() => (location.hash = '#/person-neu/mitmieter'));
  await expect(page.getByLabel('Vorname', { exact: true })).toBeFocused();

  if (browserName === 'chromium') {
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const stil = getComputedStyle(document.activeElement!);
      return `${stil.outlineWidth} ${stil.outlineOffset}`;
    });
    expect(ring).toBe('3px 2px');
  }
});

test('Große Schrift: Standard ist pixelgleich, --px vergrößert nur die Schrift', async ({
  page,
}) => {
  await laden(page, '01-standard');
  const schrift = () =>
    page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.setProperty('font-size', 'calc(17 * var(--px))');
      document.body.append(probe);
      const groesse = getComputedStyle(probe).fontSize;
      probe.remove();
      return groesse;
    });
  const karte = page.locator('.blatt .zeilen').first();
  const breite = () => karte.evaluate((e) => e.getBoundingClientRect().width);
  expect(await schrift()).toBe('17px');
  const vorher = await breite();
  await page.evaluate(() => document.documentElement.style.setProperty('--px', '2px'));
  expect(await schrift()).toBe('34px');
  expect(await breite()).toBe(vorher);
});

test('Bewegung reduzieren: kurzes Überblenden, kein Schieben', async ({ page }) => {
  await laden(page, '01-standard');
  // E58: Die Tokens regeln es an einer Stelle. Überblenden bleibt (120 ms), alles andere ist 0.
  const werte = await page.evaluate(() => {
    // Eigene Probe: Die Klasse am Rahmen fällt nach dem Wechsel weg (PC8 A5).
    const e = document.createElement('div');
    e.className = 'einblenden';
    document.body.append(e);
    const wurzel = getComputedStyle(document.documentElement);
    // Der Bau schreibt „120ms“ als „.12s“: in Millisekunden vergleichen.
    const ms = (w: string) => Math.round(parseFloat(w) * (w.trim().endsWith('ms') ? 1 : 1000));
    return {
      einblenden: ms(getComputedStyle(e).animationDuration),
      lang: ms(wurzel.getPropertyValue('--bw-lang')),
      kurz: ms(wurzel.getPropertyValue('--bw-kurz')),
      blende: ms(wurzel.getPropertyValue('--bw-blende')),
    };
  });
  expect(werte).toEqual({ einblenden: 120, lang: 0, kurz: 0, blende: 120 });
});
