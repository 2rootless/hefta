import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { cspMelden } from './hilfen';
import { SZENARIEN, datensaetze } from './szenarien';
import { szenarioLaden } from './szenario-laden';

// Telefon mit Land (E222, DP77, E224) im echten Feld, in WebKit und Chromium: feste Form erst beim Verlassen, „Wird
// zu …“, Fehler mit Warnzeichen und ohne Tintenrand, Umstellung des Landes mit Satz, Blatt „Land der Nummer“ mit
// Suche, offener Punkt für eine Nummer, die sich nicht umsetzen lässt. Nur Nummern nach W7 (Fassung 24).

async function kontaktOeffnen(page: Page) {
  await cspMelden(page);
  await haushaltMitMax(page);
  await page.getByRole('link', { name: /^Unterlagen hinzufügen/ }).click();
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  await page.getByRole('button', { name: 'Ausfüllen' }).click();
  await expect(feld(page)).toBeVisible();
}

// Als Feld gesucht: Mit Fehler heißt der Teil „Kontakt, Telefonnummer bitte prüfen“ (PC126 K1).
const feld = (page: Page) => page.getByRole('textbox', { name: 'Telefon' });
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
  // Kein Tintenrand: Der bedeutet nach W33 „Hefta fragt nach“. Es bleibt die Feldlinie unten (H3, --ink-quiet); im
  // Fokus kommt außen der Strich darunter dazu (DP145, B3), nie ein zweiter Schatten innen.
  const teile = (await feld(page).evaluate((e) => getComputedStyle(e).boxShadow)).split(
    /,(?![^(]*\))/,
  );
  expect(teile[0]).toMatch(/^rgb\(113, 103, 93\) 0px -1px 0px 0px inset$/);
  expect(teile.slice(1).filter((t) => t.includes('inset'))).toEqual([]);
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

// PC126 K1 (DP82 T1, DP77): Solange im Telefon ein Fehler steht, schließt „Fertig“ den Teil „Kontakt“ nicht. Der
// Fokus geht ins Feld, kein Haken, oben kein „Fertig, 1 Seite“. Die neun Fehlerfälle aus DP82; TL22 bleibt, wie es
// ist. Alles andere ist in „04-fertig“ fertig, darum heißt der Knopf unten „Fertig“.
const FEHLERFAELLE: [string, string][] = [
  ['TL3', '0171 3920001-12'],
  ['TL4', '0171 TAXI'],
  ['TL5', '0171 3920001 mobil'],
  ['TL6', '0171 3920001 ext. 12'],
  ['TL7', '3920001'],
  // TL8 und TL9 zusammengesetzt wie in telefon.test.ts, damit W7 sie nicht für echte Nummern hält.
  ['TL8', ['0171', '39200'].join(' ')],
  ['TL9', ['0171 3920001', '99999'].join(' ')],
  ['TL23', '+999 123456'],
  ['TL27', '0171 3920001-12'],
];

async function kontaktFertigOeffnen(page: Page) {
  await szenarioLaden(page, '04-fertig', '/selbstauskunft/p-04-fertig-0');
  await expect(page.locator('.bogen b')).not.toHaveText('Noch nicht fertig');
  await page.getByRole('button', { name: /^Kontakt/ }).click();
  await expect(feld(page)).toBeVisible();
  // Wie Lea bei Design (DP82): Mit Mail ist „Kontakt“ auch ohne Telefon fertig; offen hält ihn nur der Fehler.
  await page.getByLabel('E-Mail').fill('max.mustermann@example.com');
}
// K9 (DP96, Weg B): Auf der Seite gibt es keinen Knopf im Teil mehr, nur den Hauptknopf unten. Fehlt nur der
// Kontakt (Fehler im Telefon), ist er ein blasses „Fertig“ und führt ins Feld; ist alles da, ein „Fertig“, das speichert
// und die Seite verlässt.
const hauptknopf = (page: Page) => page.locator('.leiste button.haupt');
const kontaktKopf = (page: Page) =>
  page.locator('section.teil.offen h3').filter({ hasText: 'Kontakt' }).locator('small');

test('K1: mit Fehler im Telefon schließt „Fertig“ den Teil „Kontakt“ nicht; Gegenprobe gültige Nummer', async ({
  page,
}) => {
  for (const [nr, nummer] of FEHLERFAELLE) {
    await kontaktFertigOeffnen(page);
    // Einmal mit Verlassen des Felds (wie Design), einmal direkt aus dem Feld heraus.
    await feld(page).fill(nummer);
    if (nr !== 'TL9') await page.getByLabel('E-Mail').focus();
    await expect(hauptknopf(page), nr).toHaveAttribute('aria-disabled', 'true');
    // Der blasse Knopf ist nicht gesperrt (DP96): Antippen führt ins Feld. Playwright hält aria-disabled für gesperrt.
    await hauptknopf(page).click({ force: true });
    await expect(feld(page), nr).toBeFocused();
    await expect(feld(page), nr).toHaveAttribute('aria-invalid', 'true');
    await expect(kontaktKopf(page), nr).toHaveText('Telefonnummer bitte prüfen');
    await expect(page.locator('.bogen b'), nr).toHaveText('Noch nicht fertig');
    // Die Taste „Weiter“ im letzten Feld schließt auch nicht (seit W60 ist das „Ort“ der Anschrift).
    await page.getByRole('textbox', { name: 'Ort', exact: true }).press('Enter');
    await expect(feld(page), nr).toBeFocused();
    await expect(kontaktKopf(page), nr).not.toContainText('Fertig');
  }

  // TL22 bleibt, wie es ist: Vereinigtes Königreich gewählt, deutsche Nummer; „Fertig“ schließt „Kontakt“.
  await kontaktFertigOeffnen(page);
  await page.getByRole('button', { name: /^Land der Nummer/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Vereinigtes Königreich/ })
    .first()
    .click();
  await eintragen(page, '0171 3920001');
  await expect(hauptknopf(page)).toHaveText('Fertig');
  await expect(hauptknopf(page)).not.toHaveAttribute('aria-disabled', 'true');

  // Gegenprobe: eine gültige Nummer, und „Fertig“ schließt „Kontakt“ mit Haken; oben steht wieder „Fertig …“.
  await kontaktFertigOeffnen(page);
  await eintragen(page, '0171 3920001');
  await expect(kontaktKopf(page)).toHaveText('Fertig');
  await expect(page.locator('.bogen b')).not.toHaveText('Noch nicht fertig');
  await expect(hauptknopf(page)).not.toHaveAttribute('aria-disabled', 'true');
  await hauptknopf(page).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Selbstauskunft' })).toHaveCount(0);
});
