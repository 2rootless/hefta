import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { cspMelden } from './hilfen';
import { SZENARIEN, datensaetze } from './szenarien';

// Telefon mit Land (E222, DP77, E224) im echten Feld, in WebKit und Chromium: feste Form erst beim Verlassen, „Wird
// zu …“, Fehler mit Warnzeichen und ohne Tintenrand, Umstellung des Landes mit Satz, Blatt „Land der Nummer“ mit
// Suche, offener Punkt für eine Nummer, die sich nicht umsetzen lässt. Nur Nummern nach W7 (Fassung 24).

async function kontaktOeffnen(page: Page) {
  await cspMelden(page);
  await haushaltMitMax(page);
  await page.getByRole('link', { name: /^Unterlagen hinzufügen/ }).click();
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  await page.getByRole('button', { name: 'Ausfüllen' }).click();
  await expect(page.getByLabel('Telefon')).toBeVisible();
}

const feld = (page: Page) => page.getByLabel('Telefon');
async function eintragen(page: Page, nummer: string) {
  await feld(page).fill(nummer);
  await page.getByLabel('E-Mail').focus();
}

test('TL1, TL2, TL7, TL3: feste Form beim Verlassen, „Wird zu …“, Fehler mit Warnzeichen ohne Tintenrand', async ({
  page,
}) => {
  await kontaktOeffnen(page);
  const land = page.getByRole('button', { name: 'Land der Nummer: Deutschland' });
  await expect(land).toBeVisible();
  expect((await land.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // Beim Tippen bleibt die Eingabe, wie sie ist (W8); erst beim Verlassen kommt die feste Form.
  await feld(page).fill('01713920001');
  await expect(feld(page)).toHaveValue('01713920001');
  await page.getByLabel('E-Mail').focus();
  await expect(feld(page)).toHaveValue('0171 3920001');
  await expect(page.getByText('Wird zu +49 171 3920001.')).toBeVisible();
  await expect(feld(page)).not.toHaveAttribute('aria-invalid', 'true');

  await eintragen(page, '+49 0171 3920001');
  await expect(feld(page)).toHaveValue('0171 3920001');

  await eintragen(page, '3920001');
  await expect(
    page.getByText('Die Vorwahl fehlt. In Deutschland beginnt sie mit 0.'),
  ).toBeVisible();

  await eintragen(page, '0171 3920001-12');
  const fehler = page.getByText(
    /Eine Durchwahl \(„-12“\) kann Hefta nicht übernehmen\. Trag die Nummer/,
  );
  await expect(fehler).toBeVisible();
  await expect(feld(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(feld(page)).toHaveValue('0171 3920001-12');
  await expect(page.locator('.telefon .warnzeichen')).toBeVisible();
  // Kein Tintenrand: Der bedeutet nach W33 „Hefta fragt nach“.
  expect(await feld(page).evaluate((e) => getComputedStyle(e).boxShadow)).toBe('none');
  // Der Fehler ist für VoiceOver mit dem Feld verbunden und beginnt mit „Fehler:“.
  const beschreibung = await feld(page).evaluate(
    (e) => document.getElementById(e.getAttribute('aria-describedby')!)!.textContent,
  );
  expect(beschreibung).toMatch(/^\s*!?\s*Fehler: Eine Durchwahl/);
  // Beim Tippen verschwindet der Fehler; er kommt erst wieder, wenn die Nummer fertig ist.
  await feld(page).press('End');
  await feld(page).press('Backspace');
  await expect(feld(page)).toHaveValue('0171 3920001-1');
  await expect(fehler).toHaveCount(0);
});

test('TL14, TL21: „+44“ bei Deutschland stellt das Land um und sagt es; „+49“ bei Großbritannien zurück', async ({
  page,
}) => {
  await kontaktOeffnen(page);
  await eintragen(page, '+44 20 7946 0018');
  await expect(feld(page)).toHaveValue('+44 20 7946 0018');
  await expect(
    page.getByRole('button', { name: 'Land der Nummer: Vereinigtes Königreich' }),
  ).toBeVisible();
  await expect(page.getByText('Das Land hat Hefta nach der Vorwahl +44 gestellt.')).toBeVisible();
  // Ausländische Nummern stehen schon international da: kein „Wird zu“.
  await expect(page.getByText(/^Wird zu/)).toHaveCount(0);
  await eintragen(page, '+49 171 3920001');
  await expect(feld(page)).toHaveValue('0171 3920001');
  await expect(page.getByRole('button', { name: 'Land der Nummer: Deutschland' })).toBeVisible();
  await expect(page.getByText('Das Land hat Hefta nach der Vorwahl +49 gestellt.')).toBeVisible();
});

test('Blatt „Land der Nummer“: oft gewählt, Suche ohne Umlaute und nach Vorwahl, Haken am gewählten Land', async ({
  page,
}) => {
  await kontaktOeffnen(page);
  await page.getByRole('button', { name: 'Land der Nummer: Deutschland' }).click();
  const blatt = page.getByRole('dialog', { name: 'Land der Nummer' });
  await expect(blatt).toBeVisible();
  await expect(blatt.getByText('Oft gewählt')).toBeVisible();
  await expect(
    blatt.getByRole('button', { name: 'Deutschland, plus 49, ausgewählt' }).first(),
  ).toBeVisible();
  const suche = blatt.getByPlaceholder('Land oder Vorwahl suchen');
  await suche.fill('osterreich');
  await expect(blatt.getByText('1 Land', { exact: true })).toBeVisible();
  await suche.fill('0043');
  await expect(blatt.getByText('1 Land', { exact: true })).toBeVisible();
  await suche.fill('xyzq');
  await expect(
    blatt.getByText('Kein Land gefunden. Gesucht wird nach Name oder Vorwahl.'),
  ).toBeVisible();
  await suche.fill('Öster');
  await blatt.getByRole('button', { name: 'Österreich, plus 43' }).click();
  await expect(blatt).toBeHidden();
  await expect(page.getByRole('button', { name: 'Land der Nummer: Österreich' })).toBeVisible();
  // Zeilen 52 px hoch.
  await page.getByRole('button', { name: 'Land der Nummer: Österreich' }).click();
  const zeile = blatt.getByRole('button', { name: 'Schweiz, plus 41' }).first();
  expect(Math.round((await zeile.boundingBox())!.height)).toBeGreaterThanOrEqual(52);
});

/** Lädt ein Szenario; Max trägt eine Nummer wie vor E222, ohne Land und ohne internationale Nummer. */
async function mitAlterNummer(page: Page, telefon: string) {
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  const daten = datensaetze(SZENARIEN.find((s) => s.id === '01-standard')!) as {
    personen: { vorname: string; kontakt: Record<string, string> }[];
  };
  for (const p of daten.personen)
    if (p.vorname === 'Max') p.kontakt = { telefon, email: 'max.mustermann@example.com' };
  await page.evaluate(async (daten) => {
    const db = await new Promise<IDBDatabase>((ok) => {
      const r = indexedDB.open('hefta');
      r.onsuccess = () => ok(r.result);
    });
    const orte = [...db.objectStoreNames];
    const tx = db.transaction(orte, 'readwrite');
    for (const ort of orte) tx.objectStore(ort).clear();
    for (const [ort, liste] of Object.entries(daten))
      for (const d of liste as object[]) tx.objectStore(ort).put(d);
    await new Promise((ok) => (tx.oncomplete = ok));
    db.close();
  }, daten);
  await page.goto('about:blank');
  await page.goto('/#/');
  await page.locator('main h1').first().waitFor();
}

test('TL27: eine alte Nummer, die sich nicht umsetzen lässt, wird ein offener Punkt; TL28 wird still umgesetzt', async ({
  page,
}) => {
  await mitAlterNummer(page, '0171 3920001-12');
  await expect(page.getByText('Telefonnummer von Max prüfen')).toBeVisible();
  await expect(
    page.getByText('So steht sie da: „0171 3920001-12“. Bis dahin steht sie nicht in der Mappe.'),
  ).toBeVisible();
  // Antippen öffnet die Selbstauskunft beim Teil „Kontakt“, mit der alten Eingabe und dem passenden Fehler.
  await page.getByText('Telefonnummer von Max prüfen').click();
  await expect(feld(page)).toHaveValue('0171 3920001-12');
  await expect(page.getByText(/Eine Durchwahl/)).toBeVisible();

  // TL28: still umgesetzt, kein offener Punkt.
  await mitAlterNummer(page, '+49 (0)171 3920001');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/Telefonnummer von Max/)).toHaveCount(0);
});
