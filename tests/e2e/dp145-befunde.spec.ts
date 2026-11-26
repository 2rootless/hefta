import { expect, test, type Page } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// DP145 (PC212, Abschnitt 1): Befunde von Design am Bau, je mit Gegenprobe. Namen aus der Namensliste (W40),
// Telefon wie im Muster.

async function oeffnen(page: Page) {
  await page.goto('/__leer');
  await page.goto('/#/selbstauskunft');
  await page.locator('main h1').waitFor();
}

async function ausfuellen(
  page: Page,
  p: { vor: string; nach: string; tel: string; beruf: string; arbeitgeber: string },
) {
  const blatt = page.locator('section.blatt');
  await blatt.getByRole('textbox', { name: 'Vorname' }).fill(p.vor);
  await blatt.getByRole('textbox', { name: 'Nachname' }).fill(p.nach);
  await blatt.getByRole('textbox', { name: 'Telefon' }).fill(p.tel);
  await blatt.getByRole('textbox', { name: 'Beruf' }).fill(p.beruf);
  await blatt.getByRole('textbox', { name: /^Arbeitgeber/ }).fill(p.arbeitgeber);
  await blatt.getByRole('textbox', { name: 'Netto im Monat, in Euro' }).fill('2.800');
  for (const g of ['Frage 1: Insolvenzverfahren', 'Frage 2: Räumungstitel'])
    await blatt.getByRole('radiogroup', { name: g }).getByRole('radio', { name: 'Nein' }).click();
}

/** Farben der Zeichen in den Reitern des Bogens, in Reihenfolge. */
async function bogenFarben(page: Page): Promise<string[]> {
  return page
    .getByRole('tab')
    .evaluateAll((tabs) =>
      tabs.map((t) => getComputedStyle(t.querySelector('.zeichen')!).backgroundColor),
    );
}

/** Farben der Personen im angelegten Haushalt, nach Reihenfolge, als Farbe der App. */
async function haushaltFarben(page: Page): Promise<string[]> {
  const nummern = await page.evaluate(
    () =>
      new Promise<number[]>((fertig, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const q = r.result
            .transaction('zugehoerigkeiten')
            .objectStore('zugehoerigkeiten')
            .getAll();
          q.onsuccess = () =>
            fertig(
              (q.result as { reihenfolge: number; farbe: number }[])
                .sort((a, b) => a.reihenfolge - b.reihenfolge)
                .map((z) => z.farbe),
            );
          q.onerror = () => fehler(q.error);
        };
        r.onerror = () => fehler(r.error);
      }),
  );
  return page.evaluate(
    (ns) =>
      ns.map((n) => {
        const s = document.createElement('span');
        s.style.background = `var(--person-${n})`;
        document.body.append(s);
        const f = getComputedStyle(s).backgroundColor;
        s.remove();
        return f;
      }),
    nummern,
  );
}

async function zweiBoegenUebernehmen(page: Page, telSelin = '0171 3920012') {
  await oeffnen(page);
  await ausfuellen(page, {
    vor: 'Jarne',
    nach: 'Ostendorp',
    tel: '0171 3920011',
    beruf: 'Logistikplaner',
    arbeitgeber: 'Tidenwerk Logistik',
  });
  await page.getByRole('button', { name: /Weitere Person hinzufügen/ }).click();
  await ausfuellen(page, {
    vor: 'Selin',
    nach: 'Akgül',
    tel: telSelin,
    beruf: 'Statikerin',
    arbeitgeber: 'Seilerkoppel Ingenieure',
  });
  const vorher = await bogenFarben(page);
  await page.getByRole('button', { name: 'Haushalt anlegen' }).click();
  await page.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  await page.locator('main h1').waitFor();
  return vorher;
}

test('B2 und B5: nach dem Übernehmen kein „Telefonnummer prüfen“, kein „Selbstauskunft fehlt noch“, dieselben Farben', async ({
  page,
}) => {
  const vorher = await zweiBoegenUebernehmen(page);
  const haupt = page.locator('main');
  await expect(haupt).toContainText('Jarne');
  await expect(haupt).not.toContainText('Telefonnummer von');
  await expect(haupt).not.toContainText(/Selbstauskunft fehlt noch/);
  // B5: Die zweite Person ist im Bogen schon in der zweiten Farbe der App (#8c89d3), danach dieselbe.
  expect(vorher[1]).toBe('rgb(140, 137, 211)');
  expect(await haushaltFarben(page)).toEqual(vorher);
});

test('Gegenprobe B2: eine Nummer, die sich nicht umsetzen lässt, kommt als offener Punkt an', async ({
  page,
}) => {
  await zweiBoegenUebernehmen(page, '12');
  await expect(page.locator('main')).toContainText('Telefonnummer von Selin prüfen');
  await expect(page.locator('main')).not.toContainText('Telefonnummer von Jarne prüfen');
});

test('F3: Gibt es schon einen Haushalt, sagt der Kasten, dass er bleibt; beim ersten Mal nicht', async ({
  page,
}) => {
  const jarne = {
    vor: 'Jarne',
    nach: 'Ostendorp',
    tel: '0171 3920011',
    beruf: 'Logistikplaner',
    arbeitgeber: 'Tidenwerk Logistik',
  };
  await oeffnen(page);
  await ausfuellen(page, jarne);
  await page.getByRole('button', { name: 'Haushalt anlegen' }).click();
  await expect(page.getByRole('button', { name: 'Übernehmen', exact: true })).toBeVisible();
  await expect(page.getByText(/bisheriger bleibt/)).toHaveCount(0);
  await szenarioLaden(page, '04-fertig', '/selbstauskunft');
  await page.locator('main h1').waitFor();
  if ((await page.getByRole('textbox', { name: 'Vorname' }).inputValue()) === '')
    await ausfuellen(page, jarne);
  await page.getByRole('button', { name: 'Haushalt anlegen' }).click();
  await expect(
    page.getByRole('listitem').filter({
      hasText: 'Dafür entsteht ein neuer Haushalt. Dein bisheriger bleibt, wie er ist.',
    }),
  ).toBeVisible();
});

const STRICH = /rgb\(\d+, \d+, \d+\) 0px 3px 0px 0px/;

/** Der Schatten des Felds im Fokus und ohne; das Feld blendet in 300 ms über (DP49b), darum mit Warten. */
async function schattenPruefen(page: Page, feld: ReturnType<Page['locator']>, linie: boolean) {
  const schatten = () => feld.evaluate((e) => getComputedStyle(e).boxShadow);
  await feld.focus();
  await expect.poll(schatten).toMatch(STRICH);
  if (linie) expect(await schatten()).toMatch(/inset/);
  // Gegenprobe: ohne Fokus kein Strich. Der Fokus geht auf ein anderes Feld; `blur()` löst ihn in Chromium am
  // Datumsfeld nicht.
  await page.locator('main input:not([type="date"])').last().focus();
  await expect.poll(schatten).not.toMatch(STRICH);
}

test('B3: Fokusstrich in den Feldern des Formblatts und am Datumsfeld der Vorlage (W33)', async ({
  page,
}) => {
  await szenarioLaden(page, '04-fertig', '/selbstauskunft/p-04-fertig-0');
  const zu = page.locator('main .formblatt button[aria-expanded="false"]').first();
  await expect(page.locator('main .formblatt').first()).toBeVisible();
  if (!(await page.locator('main .formblatt .eingabe input').first().isVisible())) await zu.click();
  const feld = page.locator('main .formblatt .eingabe input').first();
  await expect(feld).toBeVisible();
  // Die Feldlinie bleibt im Fokus.
  await schattenPruefen(page, feld, true);

  await page.goto('/__leer');
  await page.goto('/#/buergschaft');
  await page.locator('main h1').waitFor();
  const datum = page.locator('main input[type="date"]');
  await schattenPruefen(page, datum, false);
});

test('B4: „Eigene Auswahl“ verspricht keine Ausweiskopie', async ({ page }) => {
  await szenarioLaden(page, '04-fertig', '/mappe');
  await expect(page.getByText('Unterlage für Unterlage', { exact: true })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Ausweiskopie');
});

test('B7: Beruf und Arbeitgeber stehen bei 390 px untereinander, ab 480 px nebeneinander', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await oeffnen(page);
  const lage = () =>
    page.evaluate(() => {
      const [a, b] = [...document.querySelectorAll('main .zwei.text > *')].map((e) =>
        e.getBoundingClientRect(),
      );
      return { untereinander: b!.top >= a!.bottom - 1 };
    });
  expect((await lage()).untereinander).toBe(true);
  await page.setViewportSize({ width: 800, height: 844 });
  expect((await lage()).untereinander).toBe(false);
});
