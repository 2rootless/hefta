import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { pruefen } from './pruef-c';
import { pdfMit } from './szenario-laden';

// DP45 Grundlücken (PC59, E126). G1: Wohnberechtigungsschein beim Haushalt, Prüfkatalog G1a bis G1d,
// Test wunsch-W28 mit Gegenprobe.

const JETZT = new Date(2026, 10, 16, 10, 0);

// Lange Wörter tragen weiche Trennstellen (G5, 320 px mit 130 %); die Vergleiche lassen sie zu.
const WBS = /Wohn­?berech­?tigungs­?schein/;
const SOZIAL = /Sozial­?wohnung/;
const ETIKETT = /in Heften für Sozial­?wohnungen/;
const KEINE = /Keine Sozial­?wohnung/;
const AUS =
  /Keine Sozial­?wohnung: Der Wohn­?berech­?tigungs­?schein bleibt in der Mappe und kommt hier nicht mit\./;

const leer = {
  beworben: null,
  gefragtAm: null,
  termin: null,
  ergebnis: null,
  loeschbitteAm: null,
  nachgefasstAm: null,
  abgelegtAm: null,
};

function heft(id: string, adresse: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    createdAt: '2026-11-14T10:00:00.000Z',
    updatedAt: '2026-11-14T10:00:00.000Z',
    haushaltId: null,
    adresse,
    link: null,
    quelle: '',
    inseratText: null,
    kennung: `k-${id}`,
    ereignisse: { ...leer },
    notiz: '',
    angaben: { titel: null, stadtteil: null, warm: null, zimmer: null, flaeche: null },
    ...extra,
  };
}

async function hefteAnlegen(page: Page, hefte: unknown[]) {
  await page.evaluate(
    (liste) =>
      new Promise<void>((fertig, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction('hefte', 'readwrite');
          for (const h of liste as object[]) tx.objectStore('hefte').put(h);
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

async function gehe(page: Page, pfad: string) {
  await page.evaluate((h) => (window.location.hash = h), `#${pfad}`);
}

/** Schein ablegen (G1): PDF wählen, „Gültig bis“ ist gelesen, Personen und Räume dazu, speichern. */
async function scheinAblegen(page: Page, gueltigBis = '31.03.2027') {
  await gehe(page, '/');
  const abschnitt = page.locator('section.haushalt-unterlagen');
  await expect(abschnitt.getByRole('heading', { name: 'Für den ganzen Haushalt' })).toBeVisible();
  await expect(abschnitt).toContainText(
    'Nur für Sozialwohnungen. Hast du einen, leg ihn hier einmal ab.',
  );
  await abschnitt.getByRole('link', { name: WBS }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(WBS);
  await page.locator('input[data-feld="pdf"]').setInputFiles({
    name: 'WBS.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit([
      `Wohnberechtigungsschein\nAusgestellt am 01.04.2026\nGültig bis ${gueltigBis}\nFür 3 Personen`,
    ]),
  });
  const [t, m, j] = gueltigBis.split('.');
  await expect(page.locator('input[data-feld="gueltig-bis"]')).toHaveValue(`${j}-${m}-${t}`);
  await expect(page.getByText('So steht es auf dem Schein.')).toBeVisible();
  await expect(page.getByText('Eine Seite. Antippen vergrößert.')).toBeVisible();
  await page.locator('select[data-feld="personen"]').selectOption({ label: 'Drei' });
  await page.locator('input[data-feld="raeume"]').fill('Bis 3 Räume');
  await expect(page.getByText('Kurz vor „Gültig bis“ sagt Hefta Bescheid.')).toBeVisible();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('section.haushalt-unterlagen')).toBeVisible();
}

async function bewerbenListe(page: Page, id: string) {
  await gehe(page, `/heft/${id}/bewerben`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Bewerben mit wenigen Tipps' }),
  ).toBeVisible();
  // Die Liste steht über der Zeile „Nur, was verlangt ist“; ohne Unterlagen ist sie leer.
  await expect(page.locator('.blatt .mpf')).toBeVisible();
  return page.locator('.blatt .mp');
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(JETZT);
});

test('wunsch-W28, G1a bis G1c: Schein einmal beim Haushalt, in zwei Sozialwohnungen, Gegenprobe', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await hefteAnlegen(page, [
    heft('sozial-a', 'Lindenring 8\n20259 Hamburg', { sozialwohnung: true }),
    heft('sozial-b', 'Musterweg 7\n20259 Hamburg', { sozialwohnung: true }),
    heft('frei', 'Lindenring 3\n20259 Hamburg'),
  ]);
  await page.reload();
  await scheinAblegen(page);

  // Danach im Reiter „Mappe“: Stand und Etikett (DP45-1).
  const zeile = page.locator('section.haushalt-unterlagen .zeile', {
    hasText: WBS,
  });
  await expect(zeile).toContainText('Gültig bis 31. März 2027, für drei Personen');
  await expect(zeile).toContainText(ETIKETT);

  // G1a: in beiden Heften für Sozialwohnungen, ohne neues Hochladen.
  for (const id of ['sozial-a', 'sozial-b']) {
    await gehe(page, `/heft/${id}`);
    const teil = page.locator('section.heft-haushalt');
    await expect(teil.getByRole('switch', { name: SOZIAL })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(teil).toContainText('gültig bis 31. März 2027');
    await expect(teil).toContainText('aus der Mappe');
    await expect(await bewerbenListe(page, id)).toContainText([WBS]);
  }

  // G1b, Gegenprobe W28: Heft ohne Sozialwohnung zeigt ihn nicht.
  await gehe(page, '/heft/frei');
  const frei = page.locator('section.heft-haushalt');
  await expect(frei.getByRole('switch', { name: SOZIAL })).toHaveAttribute('aria-checked', 'false');
  await expect(frei).toContainText(AUS);
  await expect(frei).not.toContainText('aus der Mappe');
  const liste = await bewerbenListe(page, 'frei');
  await expect(liste.filter({ hasText: WBS })).toHaveCount(0);

  // G1c: Schalter später aus: Der Schein verschwindet aus diesem Heft und bleibt in der Mappe.
  await gehe(page, '/heft/sozial-a');
  await page.locator('section.heft-haushalt').getByRole('switch', { name: SOZIAL }).click();
  await expect(page.locator('section.heft-haushalt')).toContainText(KEINE);
  const nachher = await bewerbenListe(page, 'sozial-a');
  await expect(nachher.filter({ hasText: WBS })).toHaveCount(0);
  await gehe(page, '/');
  await expect(page.locator('section.haushalt-unterlagen .zeile', { hasText: WBS })).toContainText(
    'Gültig bis 31. März 2027',
  );
});

test('G1d, K3: abgelaufener Schein bleibt in der Mappe, geht aber nur angeschaltet mit', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await hefteAnlegen(page, [
    heft('sozial', 'Lindenring 8\n20259 Hamburg', { sozialwohnung: true }),
  ]);
  await page.reload();
  await scheinAblegen(page, '31.10.2026');

  await expect(page.locator('section.haushalt-unterlagen .zeile', { hasText: WBS })).toContainText(
    'Abgelaufen am 31. Oktober 2026',
  );
  await gehe(page, '/heft/sozial');
  const teil = page.locator('section.heft-haushalt');
  await expect(teil).toContainText('abgelaufen am 31. Oktober 2026');
  await expect(teil).not.toContainText('aus der Mappe');
  const mit = teil.getByRole('switch', { name: /Trotzdem mitschicken/ });
  await expect(mit).toHaveAttribute('aria-checked', 'false');
  const ohne = await bewerbenListe(page, 'sozial');
  await expect(ohne.filter({ hasText: WBS })).toHaveCount(0);

  await gehe(page, '/heft/sozial');
  await page
    .locator('section.heft-haushalt')
    .getByRole('switch', { name: /Trotzdem mitschicken/ })
    .click();
  await expect(page.locator('section.heft-haushalt')).toContainText('aus der Mappe');
  await expect(await bewerbenListe(page, 'sozial')).toContainText([WBS]);
});

/** „Wer vermietet?“ im Heft: Genossenschaft aus der Mappe wählen oder einen Namen eintippen. */
async function vermieterWaehlen(page: Page, id: string, wahl: { geno?: string; andere?: string }) {
  await gehe(page, `/heft/${id}`);
  await page
    .locator('section.heft-haushalt')
    .getByRole('link', { name: /Wer vermietet/ })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Wer vermietet?' })).toBeVisible();
  if (wahl.geno) await page.getByRole('switch', { name: new RegExp(wahl.geno) }).click();
  if (wahl.andere) await page.locator('input[data-feld="anbieter"]').fill(wahl.andere);
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(page.locator('section.heft-haushalt')).toBeVisible();
}

test('G2a bis G2c: Mitgliedschaften beim Haushalt, jede nur in den Heften ihrer Genossenschaft', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await hefteAnlegen(page, [
    heft('geno-a', 'Lindenring 8\n20259 Hamburg'),
    heft('anders', 'Musterweg 7\n20259 Hamburg'),
    heft('geno-b', 'Lindenring 3\n20259 Hamburg'),
  ]);
  await page.reload();

  // Ablegen: Muster eG mit Nachweis, dann „Weitere Genossenschaft“ ohne Nachweis.
  await gehe(page, '/');
  const abschnitt = page.locator('section.haushalt-unterlagen');
  await expect(abschnitt).toContainText(
    'Bist du Mitglied, steht es in jedem Heft für diese Genossenschaft.',
  );
  await abschnitt.getByRole('link', { name: /Genossenschaft/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^Genossen­?schaft$/ })).toBeVisible();
  await page.locator('input[data-feld="geno-name"]').fill('Wohnungsgenossenschaft Muster eG');
  await page.locator('input[data-feld="geno-nummer"]').fill('004711');
  await page.locator('input[data-feld="pdf"]').setInputFiles({
    name: 'Mitgliedsbescheinigung.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit(['Mitgliedsbescheinigung\nWohnungsgenossenschaft Muster eG\nNr. 004711']),
  });
  await expect(page.getByText('PDF, eine Seite')).toBeVisible();
  await page.getByRole('button', { name: 'Weitere Genossenschaft' }).click();
  await expect(page.locator('input[data-feld="geno-name"]')).toHaveValue('');
  await page.locator('input[data-feld="geno-name"]').fill('Beispiel eG');
  await page.locator('input[data-feld="geno-nummer"]').fill('17');
  await page.getByRole('button', { name: 'Speichern' }).click();
  const zeilen = page.locator('section.haushalt-unterlagen .zeile');
  // Die Uhr steht im Test: Beide sind „gleich alt“, die Reihenfolge ist dann nicht festgelegt.
  await expect(zeilen.filter({ hasText: 'Genossenschaft' })).toHaveCount(2);
  await expect(
    zeilen.filter({ hasText: /Mitglied der Wohnungs.?genossen.?schaft Muster eG, Nr. 004711/ }),
  ).toContainText('in Heften dieser Genossenschaft');
  await expect(zeilen.filter({ hasText: 'Mitglied der Beispiel eG, Nr. 17' })).toHaveCount(1);

  // G2a: Heft dieser Genossenschaft: Mitgliedschaft „aus der Mappe“, in der Mappe dabei.
  await vermieterWaehlen(page, 'geno-a', { geno: 'Wohnungs.?genossen.?schaft Muster eG' });
  const a = page.locator('section.heft-haushalt');
  await expect(a).toContainText(/Wer vermietet\s*Wohnungs.?genossen.?schaft Muster eG/);
  // DP50 Ü3: „Nr. 004711“ mit geschütztem Leerzeichen.
  await expect(a).toContainText(/Wohnungs.?genossen.?schaft Muster eG, Nr\.\u00a0004711/);
  await expect(a).toContainText('aus der Mappe');
  await expect(await bewerbenListe(page, 'geno-a')).toContainText(['Mitgliedschaft']);

  // G2b: andere Vermieterin: keine Mitgliedschaft.
  await vermieterWaehlen(page, 'anders', { andere: 'Hausverwaltung Beispiel GmbH' });
  const b = page.locator('section.heft-haushalt');
  await expect(b).toContainText('Hausverwaltung Beispiel GmbH');
  await expect(b).not.toContainText('Mitgliedschaft');
  const ohne = await bewerbenListe(page, 'anders');
  await expect(ohne.filter({ hasText: 'Mitgliedschaft' })).toHaveCount(0);

  // G2c: zwei Genossenschaften, jede nur in ihren Heften.
  await vermieterWaehlen(page, 'geno-b', { geno: 'Beispiel eG' });
  const c = page.locator('section.heft-haushalt');
  await expect(c).toContainText('Beispiel eG, Nr. 17');
  await expect(c).not.toContainText('Muster eG');
  await gehe(page, '/heft/geno-a');
  await expect(page.locator('section.heft-haushalt')).not.toContainText('Beispiel eG');
});

/** Auf der Seite einer Unterlage hochladen: Hauptaktion unten, Datei, ggf. Monat, speichern. */
async function hochladenHier(page: Page, name: string, text: string, monat?: string) {
  const plus = page.locator('button.zeile.plus', { hasNotText: 'Notiz' });
  if (await plus.count()) await plus.first().click();
  else await page.locator('.leiste .haupt').click();
  const blatt = page.getByRole('dialog');
  await blatt.locator('[data-feld="pdf"]').setInputFiles({
    name,
    mimeType: 'application/pdf',
    buffer: await pdfMit([text]),
  });
  // DP49 Punkt 7: Der Monat steht je Seite in einer Auswahlliste.
  if (monat) {
    const auswahl = blatt.locator('.w16-monat select').first();
    const wert = await auswahl.locator('option', { hasText: monat }).first().getAttribute('value');
    await auswahl.selectOption(wert!);
  }
  await blatt.getByRole('button', { name: 'Speichern' }).click();
  await expect(blatt).toBeHidden();
}

test('G3a, G3c: Neu im Job, Abrechnung ab dem Anfang und Arbeitsvertrag, dann Vorschlag', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await page.getByRole('link', { name: /^Max Im Mietvertrag$/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Max' })).toBeVisible();
  await page.getByRole('link', { name: /^Gehalts.?nachweise/ }).click();
  await expect(page.getByText('Seit wann bist du dort?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Länger als drei Monate' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Seit Kurzem' }).click();
  const anfang = page.locator('input[data-feld="neu-seit"]');
  await anfang.fill('2026-09-01');
  await anfang.dispatchEvent('change');
  await expect(
    page.getByText('Für die Monate davor gibt es keine Abrechnung. Hefta fragt nicht danach.'),
  ).toBeVisible();
  const vertrag = page.locator('.neu-im-job a.zeile');
  await expect(vertrag).toContainText('oder eine Bestätigung des Arbeitgebers');
  await expect(vertrag).toContainText('Fehlt noch');
  await expect(
    page.getByText('In der Mappe steht dazu: „Neu im Job seit 1. September 2026“.'),
  ).toBeVisible();

  // Eine Abrechnung ab dem Anfang, dann der Vertrag: kein „fehlt noch“ für Juli und August.
  await hochladenHier(page, 'september.pdf', 'Abrechnung September 2026', 'September');
  await vertrag.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Arbeits.?vertrag/);
  await hochladenHier(page, 'vertrag.pdf', 'Arbeitsvertrag');
  // W39 (2.0.1): „Zurück“ führt dorthin, woher man kam, hier zu den Gehaltsnachweisen; von dort zu Max.
  await page.getByRole('link', { name: 'Zurück', exact: true }).click();
  await page.getByRole('link', { name: 'Max', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Max' })).toBeVisible();
  const zeile = page.getByRole('link', { name: /^Gehalts.?nachweise/ });
  await expect(zeile).toContainText('Neu im Job: September und Arbeitsvertrag');
  // Zwischen Tag und Monat ein geschütztes Leerzeichen (tagZusammen).
  await expect(page.getByText(/Angestellt, seit 1\.\sSeptember/)).toBeVisible();
  await expect(page.getByText(/Juli|August/)).toHaveCount(0);

  // G3c: Anfang mehr als drei Monate her: Hefta schlägt „Länger als drei Monate“ vor.
  await zeile.click();
  await anfang.fill('2026-07-01');
  await anfang.dispatchEvent('change');
  await expect(page.getByText(/mehr als drei Monate zurück/)).toBeVisible();
  await page.getByRole('button', { name: 'Umstellen' }).click();
  await expect(page.getByRole('button', { name: 'Länger als drei Monate' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('G4a, G4b: Noch keine SCHUFA, Grund freiwillig, zählt nicht, später doch ein Nachweis', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await page.getByRole('link', { name: /^Max Im Mietvertrag$/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Max' })).toBeVisible();
  const zaehler = page.locator('.zahl');
  const vorher = await zaehler.textContent();
  await page.getByRole('link', { name: /^Bonitäts.?nachweis/ }).click();
  await expect(page.getByText('Wie ist es bei dir?')).toBeVisible();
  await page.getByRole('button', { name: 'Ich bekomme noch keinen' }).click();
  await expect(page.getByText('Warum, in deinen Worten')).toBeVisible();
  // K1: nur zwei Vorgaben, kein „Neu in Deutschland“.
  await expect(page.getByRole('button', { name: 'Neu in Deutschland' })).toHaveCount(0);
  await expect(page.getByText('Ohne ihn steht dort nur', { exact: false })).toBeVisible();
  await expect(page.locator('h1 + .satz, .satz').first()).toContainText(
    'Noch keiner möglich. Steht so in der Mappe.',
  );
  await page.getByRole('button', { name: 'Bisher keine Verträge auf meinen Namen' }).click();
  await expect(
    page.getByText(
      'Das steht so in der Mappe, als deine Angabe. Hefta legt keinen Ersatz-Nachweis an.',
    ),
  ).toBeVisible();
  const statt = page.locator('.bonitaet-wahl a.zeile');
  await expect(statt).toContainText([
    'Mietzahlungen der letzten Monate',
    'Arbeitsvertrag',
    'Eine Bürgschaft',
  ]);
  await expect(page.getByText('Ob das reicht, entscheidet der Vermieter.')).toBeVisible();

  // Auf der Personenseite: die Zeile wörtlich; der Zähler hat eine Unterlage weniger.
  await page.getByRole('link', { name: 'Max', exact: true }).click();
  const zeile = page.getByRole('link', { name: /^Bonitäts.?nachweis/ });
  await expect(zeile).toContainText(
    'Noch keiner möglich: bisher keine Verträge auf deinen Namen. Steht so in der Mappe.',
  );
  const nachher = await zaehler.textContent();
  const gesamt = (s: string | null) => Number(/von (\d+)/.exec(s ?? '')?.[1]);
  expect(gesamt(nachher)).toBe(gesamt(vorher) - 1);

  // G4b: „Ich habe einen“: Die Angabe verschwindet, der Nachweis fehlt wieder wie jeder andere.
  await zeile.click();
  await page.getByRole('button', { name: 'Ich habe einen' }).click();
  await expect(page.getByText('Warum, in deinen Worten')).toHaveCount(0);
  await page.getByRole('link', { name: 'Max', exact: true }).click();
  await expect(zeile).not.toContainText('Noch keiner möglich');
  expect(gesamt(await zaehler.textContent())).toBe(gesamt(vorher));
});

test('G5 (DP45): dunkel, 320 px mit 130 %: alle neuen Bildschirme lesbar, kein Überlauf', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await haushaltMitMax(page);
  await hefteAnlegen(page, [
    heft('sozial', 'Lindenring 8\n20259 Hamburg', { sozialwohnung: true }),
  ]);
  await page.reload();
  await scheinAblegen(page);
  await gehe(page, '/haushalt-unterlage/genossenschaft/neu');
  await page.locator('input[data-feld="geno-name"]').fill('Wohnungsgenossenschaft Muster eG');
  await page.locator('input[data-feld="geno-nummer"]').fill('004711');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('section.haushalt-unterlagen')).toBeVisible();
  const max = await page.evaluate(
    () =>
      new Promise<string>((ok) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const q = r.result.transaction('personen').objectStore('personen').getAll();
          q.onsuccess = () => ok((q.result[0] as { id: string }).id);
        };
      }),
  );
  // 320 px mit 130 % Schrift wie bei Safari: ein Fenster von 246 CSS-Pixeln.
  await page.setViewportSize({ width: 246, height: 437 });
  // Erst nach dem Umstellen laden: WebKit behält sonst die alte Höhe der Rasterzeile im Reiter (CP37).
  await page.reload();
  const seiten: [string, string][] = [
    ['/', 'section.haushalt-unterlagen'],
    ['/haushalt-unterlage/wbs', 'input[data-feld="gueltig-bis"]'],
    ['/haushalt-unterlage/genossenschaft/neu', 'input[data-feld="geno-name"]'],
    ['/heft/sozial', 'section.heft-haushalt'],
    ['/heft/sozial/vermieter', 'input[data-feld="anbieter"]'],
    [`/unterlage/${max}/gehaltsnachweis`, '.neu-im-job'],
    [`/unterlage/${max}/bonitaet`, '.bonitaet-wahl'],
  ];
  for (const [pfad, merkmal] of seiten) {
    await gehe(page, pfad);
    await page.locator(merkmal).first().scrollIntoViewIfNeeded();
    if (pfad.endsWith('gehaltsnachweis'))
      await page.getByRole('button', { name: 'Seit Kurzem' }).click();
    if (pfad.endsWith('bonitaet')) {
      await page.getByRole('button', { name: 'Ich bekomme noch keinen' }).click();
      await page.getByRole('button', { name: 'Eigener Grund' }).click();
    }
    await page.waitForTimeout(300);
    const r = await page.evaluate(pruefen);
    const befunde = Object.fromEntries(
      Object.entries(r).filter(([k, v]) => k !== 'hoehe' && (Array.isArray(v) ? v.length : !!v)),
    );
    expect(befunde, pfad).toEqual({});
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), pfad).toBe(
      0,
    );
  }
});
