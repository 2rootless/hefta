import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { stimmungMuster } from './stimmung-muster';
import { expect, test, type Page } from '@playwright/test';
import { cspMelden } from './hilfen';
import { HEUTE, SZENARIEN, datensaetze } from './szenarien';

// Rückmeldungen aus dem Test auf dem iPhone (1. November 2026), läuft auch in WebKit: Eingeklapptes
// öffnet sich, der Rutsch lässt sich frei durchblättern, die Vorschau der Mappe wird groß.

async function beispielPdf(seiten: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  for (let n = 1; n <= seiten; n++)
    doc.addPage([595, 842]).drawText(`Seite ${n}`, { x: 60, y: 700, size: 18, font: f });
  return Buffer.from(await doc.save());
}

async function laden(page: Page, szenario: string, pfad: string) {
  const pdf = [...(await beispielPdf(2))];
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

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
  await page.clock.setFixedTime(HEUTE);
});

test('„Kann helfen“ klappt auf und wieder zu; Ausweiskopie und Datenkopie bietet Hefta nicht mehr an (PC207, 1)', async ({
  page,
}) => {
  await laden(page, '01-standard', '/person/p-01-standard-1');
  const kopf = page.getByRole('button', { name: /^Kann helfen \d/ });
  await expect(kopf).toHaveAttribute('aria-expanded', 'false');
  await kopf.click();
  await expect(kopf).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('link', { name: /^Empfehlung/ })).toBeVisible();
  await kopf.click();
  await expect(page.getByRole('link', { name: /^Empfehlung/ })).toHaveCount(0);
  // Nichts abgelegt: kein Abschnitt „Meist unnötig“, keine Ausweiskopie.
  await expect(page.getByRole('button', { name: /^Meist unnötig/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Ausweis/ })).toHaveCount(0);

  // Auch in „Eigene Auswahl“ nicht.
  await laden(page, '04-fertig', '/mappe');
  await page.getByRole('button', { name: /^Eigene Auswahl/ }).click();
  await expect(page.getByRole('switch', { name: /^Ausweis/ })).toHaveCount(0);
  await expect(page.getByRole('switch', { name: /Datenkopie/ })).toHaveCount(0);
});

test('Rutsch: Register und Haarlinie, Springen; nichts geht verloren (DP39)', async ({ page }) => {
  await laden(page, '03-mehrere-offen', '/rutsch');
  // Schon auf dem Start führt ein Tipp auf die Person zu ihrer ersten Unterlage.
  await page.locator('.pz-knopf').filter({ hasText: 'Lea' }).click();
  await expect(page.getByText('3 von 5')).toBeVisible();
  await expect(page.getByText('Für Lea')).toBeVisible();

  // Die Reiter wechseln die Person, die Haarlinie springt innerhalb der Person.
  const navi = page.getByRole('navigation', { name: 'Zwischen den Schritten wechseln' });
  await navi.getByRole('button', { name: /^Max( Fertig)?$/ }).click();
  await expect(page.getByText('1 von 5')).toBeVisible();
  const linie = page.locator('.register-rahmen .haarlinie');
  await linie.getByRole('button').nth(1).click();
  await expect(page.getByText('2 von 5')).toBeVisible();
  await page.locator('[data-feld="pdf"]').setInputFiles({
    name: 'bonitaet.pdf',
    mimeType: 'application/pdf',
    buffer: await beispielPdf(1),
  });
  await expect(page.getByText('bonitaet.pdf, 1 Seite')).toBeVisible();
  await page.getByRole('button', { name: 'Speichern und weiter' }).click();
  await expect(page.getByText('3 von 5')).toBeVisible();
  // Zurück auf die Unterlage: schon da, eine neuere Datei geht.
  await navi.getByRole('button', { name: /^Max( Fertig)?$/ }).click();
  await expect(page.getByText('1 von 5')).toBeVisible();
  await linie.getByRole('button').nth(1).click();
  await expect(page.getByText(/^Ist schon da/)).toBeVisible();
  await expect(page.getByText('Neuere Datei wählen', { exact: true })).toBeVisible();

  // Vor bis ans Ende: Je Person eine Reihe, ein Tipp führt wieder hin.
  await navi.getByRole('button', { name: /^Lea( Fertig)?$/ }).click();
  await linie.getByRole('button').last().click();
  await expect(page.getByText('5 von 5')).toBeVisible();
  await page.getByRole('button', { name: /^(Überspringen|Noch nicht da)$/ }).click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: stimmungMuster('P10a', { teil: 'satz' }),
    }),
  ).toBeVisible();
  await expect(page.getByText(/Eine Unterlage ist drin\./)).toBeVisible();
  await expect(page.getByText(/Vier habt ihr übersprungen/)).toBeVisible();
  await page.locator('.pz-knopf').filter({ hasText: 'Lea' }).click();
  await expect(page.getByText('3 von 5')).toBeVisible();
  await expect(page.getByText('Für Lea')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('Runde ohne Arbeit: „Hier war schon alles da.“, darunter, was noch offen ist (R3e)', async ({
  page,
}) => {
  await laden(page, '22-alles-schon-da', '/rutsch');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hier war schon alles da.' }),
  ).toBeVisible();
  await expect(page.getByText('Bei Lea ist aber noch etwas offen.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Noch offen' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Zur Übersicht' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mappe trotzdem erstellen' })).toHaveCount(0);
});

test('Unterlage ohne Datum: Die Personenansicht sagt es und führt zum Nachtragen', async ({
  page,
}) => {
  await laden(page, '23-ohne-datum', '/person/p-23-ohne-datum-0');
  const zeile = page.getByRole('link', { name: /^Bonitäts.?nachweis/ });
  // W48: Im Browser erinnert Hefta nie; dann sagt der Satz, was er zeigt (W10).
  await expect(zeile).toContainText('Ohne Datum zeigt Hefta nicht, wann sie zu alt wird');
  await expect(zeile).not.toContainText('erinnert');
  await expect(zeile).toContainText('Datum eintragen');
  await zeile.click();
  // „Datum eintragen“ landet direkt im Feld, die Seite sagt, warum (UL3).
  await expect(page.getByLabel('Ausgestellt am')).toBeFocused();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Wann wurde er ausgestellt?' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Speichern' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.getByRole('button', { name: 'Heute' }).click();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText(/^Vom .*Kommt in die Mappe\.$/)).toBeVisible();
});

test('Mappe erstellen: Das Deckblatt öffnet die ganze Mappe; Einzeldateien über die Liste (ME1, ME6)', async ({
  page,
}) => {
  await laden(page, '04-fertig', '/mappe');
  await page
    .getByText(/^\d+ Seiten$/)
    .first()
    .waitFor({ timeout: 30000 });
  // Die Leiste kleiner Seiten gibt es nicht mehr.
  await expect(page.getByText('Tipp auf eine Seite, um sie groß zu sehen.')).toHaveCount(0);
  const anzahl = Number(
    (
      await page
        .getByText(/^\d+ Seiten$/)
        .first()
        .innerText()
    ).split(' ')[0],
  );

  await page.getByRole('button', { name: 'Deckblatt groß ansehen' }).click();
  await page.getByRole('button', { name: 'Ganze Mappe ansehen' }).click();
  // DP50 P2: die ganze Mappe im Leser mit Blätterer „1 / n“ (dp50-leser.spec.ts prüft ihn genauer).
  const ansicht = page.getByRole('dialog', { name: /^Mappe/ });
  await expect(ansicht.getByRole('img', { name: 'Seite 1' })).toBeVisible();
  await expect(ansicht.getByText(`1 / ${anzahl}`)).toBeVisible();
  // Nur ansehen: In der Vorschau gibt es nichts abzuwählen.
  await expect(ansicht.getByRole('switch')).toHaveCount(0);
  await ansicht.getByRole('button', { name: 'Zurück' }).click();
  await expect(ansicht).toBeHidden();

  // Das große Deckblatt führt zurück zu „Mappe erstellen“.
  await page.getByRole('link', { name: 'Mappe teilen' }).click();
  // WebKit verliert den Wechsel per Hash manchmal, solange die vorige Navigation noch läuft: wiederholen.
  await expect(async () => {
    await page.evaluate(() => (location.hash = '#/mappe/anpassen'));
    await expect(page.getByRole('radio', { name: 'Einzeldateien' })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await page.getByRole('radio', { name: 'Einzeldateien' }).click();
  await page
    .getByRole('link', { name: /Mappe teilen|Zurück/ })
    .first()
    .click();
  await page.getByText(/^\d+ Dateien$/).waitFor({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /^Mappe ansehen/ })).toHaveCount(0);
  await page
    .getByRole('button', { name: /^Dateien ansehen/ })
    .first()
    .click();
  await page
    .getByRole('button', { name: /\.pdf ansehen$/ })
    .first()
    .click();
  await expect(page.getByRole('dialog', { name: /^Seite 1 von \d+$/ })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('Mappe teilen (B23): Satz, Liste, Stand unten, Auswahl je Person (ME5, ME8)', async ({
  page,
}) => {
  await laden(page, '04-fertig', '/mappe');
  await page
    .getByText(/^\d+ Seiten$/)
    .first()
    .waitFor({ timeout: 30000 });
  // B23 „Mappe teilen“: Satz unter dem Titel, Liste, was drinliegt, Stand unten, „Als PDF teilen“.
  await expect(
    page.getByText('Ein PDF mit Deckblatt und Lesehilfe. Ihr schickt es, wohin ihr wollt.'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Was in der Mappe liegt' })).toBeVisible();
  await expect(page.locator('ul.inhalt li').first()).toContainText('Selbst');
  await expect(page.locator('.stand-unten').getByText('Alles da')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Als PDF teilen' })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole('link', { name: /Nachricht ans Inserat/ })).toHaveCount(0);

  // Eigene Auswahl: immer nur eine Person offen, mit Stand.
  await page.getByRole('button', { name: /^Eigene Auswahl/ }).click();
  const max = page.getByRole('button', { name: /^Max Im Mietvertrag · \d+ von \d+ dabei/ });
  const lea = page.getByRole('button', { name: /^Lea .* von \d+ dabei/ });
  await expect(max).toHaveAttribute('aria-expanded', 'true');
  await expect(lea).toHaveAttribute('aria-expanded', 'false');
  await lea.click();
  await expect(max).toHaveAttribute('aria-expanded', 'false');
  await expect(lea).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('switch', { name: /, Max$/ })).toHaveCount(0);
  await expect(page.getByRole('switch', { name: /, Lea$/ }).first()).toBeVisible();

  // Ohne Bürgen gibt es nichts zu wählen: Der Abschnitt steht trotzdem da, nur zum Ansehen (56).
  await laden(page, '11-allein', '/mappe');
  await page
    .getByText(/^\d+ Seiten?$/)
    .first()
    .waitFor({ timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Wer ist dabei?' })).toBeVisible();
  await expect(
    page.getByText('Wer im Mietvertrag steht, ist immer dabei.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(
    page.getByText('Ein PDF mit Deckblatt und Lesehilfe. Du schickst es, wohin du willst.'),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('Seite einer Unterlage: Stand, Hinweis, „Warum?“, ältere Version, löschen (UL1, UL4, WB1)', async ({
  page,
}) => {
  await laden(page, '25-unterlage-seiten', '/person/p-25-unterlage-seiten-0');
  const zeile = page.getByRole('link', { name: /^Bonitäts.?nachweis/ });
  await zeile.click();
  await expect(page.getByRole('heading', { level: 1, name: /Bonitäts/ })).toBeFocused();
  await expect(page.getByText('Für Max')).toBeVisible();
  await expect(page.getByText('Vom 20. Oktober 2026. Kommt in die Mappe.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seite 1 groß ansehen' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Version vom 12\.\sJuli/ })).toContainText(
    'Nicht in der Mappe.',
  );
  await expect(page.getByText('Die neue kommt in die Mappe, diese bleibt hier')).toBeVisible();

  // „Warum?“: drei Abschnitte, Fokus auf dem Titel, danach zurück auf den Link.
  const warum = page.getByRole('button', { name: 'Warum?' });
  await warum.click();
  const blatt = page.getByRole('dialog', { name: /Bonitäts/ });
  await expect(blatt.getByRole('heading', { level: 2 })).toBeFocused();
  await expect(blatt.getByText('Üblich', { exact: true })).toBeVisible();
  for (const titel of ['Ab wann Vermieter fragen dürfen', 'Was üblich ist', 'Gut zu wissen'])
    await expect(blatt.getByRole('heading', { level: 3, name: titel })).toBeVisible();
  await expect(blatt.getByRole('listitem')).toHaveText([
    'Besichtigung: noch nicht',
    'Ich will die Wohnung: noch nicht',
    'Zusage: dürfen fragen',
  ]);
  await expect(blatt.getByRole('link', { name: /Orientierungshilfe.*Januar 2026/ })).toBeVisible();
  // PC81 B12: Eigene Quellen je Satz nur, wo die Orientierungshilfe ihn nicht trägt; bei der Bonität keine.
  await expect(blatt.locator('.satz-quelle')).toHaveCount(0);
  await expect(blatt.getByText(/Stand der Angaben in Hefta: 30\.\sOktober 2026/)).toBeVisible();
  await expect(blatt.getByText(/29,95/)).toHaveCount(0);
  await blatt.getByRole('button', { name: 'Verstanden' }).click();
  await expect(blatt).toBeHidden();
  await expect(warum).toBeFocused();

  // Notiz: nur für dich.
  await page.getByRole('button', { name: /^Notiz hinzufügen/ }).click();
  await page
    .getByRole('dialog', { name: 'Notiz' })
    .getByRole('textbox')
    .fill('Für Altbau reicht das');
  await page
    .getByRole('dialog', { name: 'Notiz' })
    .getByRole('button', { name: 'Speichern' })
    .click();
  await expect(page.getByText('Für Altbau reicht das')).toBeVisible();

  // Datum ändern: Die Zeile „Ausgestellt am“ führt ins Feld und wieder zurück (DP39, 3).
  await page.getByRole('link', { name: /^Ausgestellt am/ }).click();
  await expect(page.getByLabel('Ausgestellt am')).toHaveValue('2026-10-20');
  await page.getByLabel('Ausgestellt am').fill('2026-10-21');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Vom 21. Oktober 2026. Kommt in die Mappe.')).toBeVisible();

  // Ältere Version: nicht in der Mappe, Original sichern, löschen (UL4, UL4b).
  await page.getByRole('link', { name: /Version vom 12\.\sJuli/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Version vom 12. Juli' })).toBeVisible();
  await expect(
    page.getByText('Nicht in der Mappe. In die Mappe kommt immer die neueste.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Original sichern/ })).toBeVisible();
  // Löschen wirkt sofort, „Rückgängig“ holt sie zurück (OR7b).
  await page.getByRole('button', { name: 'Diese Version löschen' }).click();
  await expect(page.getByRole('link', { name: /Version vom 12\.\sJuli/ })).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'gelöscht.' })).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('link', { name: /Version vom 12\.\sJuli/ })).toBeVisible();
  await page.getByRole('link', { name: /Version vom 12\.\sJuli/ }).click();
  await page.getByRole('button', { name: 'Diese Version löschen' }).click();
  await expect(page.getByRole('link', { name: /Version vom 12\.\sJuli/ })).toHaveCount(0);

  // Die letzte Version: Danach fehlt die Unterlage wieder, die Seite bietet „Hinzufügen“.
  // Beim Überblenden stehen kurz beide Seiten da.
  await expect(page.locator('main')).toHaveCount(1);
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Diese Version löschen' }).click();
  await expect(page.getByText('Fehlt noch.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hinzufügen', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('Serie, zu alt, „Meist unnötig“: Satz und Hauptaktion passen (UL2, UL5, UL6, WB2, WB3)', async ({
  page,
}) => {
  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/gehaltsnachweis');
  await expect(
    page.getByText('Juni bis August sind in der Mappe.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'September hinzufügen' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Ältere Monate' })).toBeVisible();
  await expect(page.getByRole('link', { name: /April 2026/ })).toContainText('Nicht in der Mappe.');

  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-2/bonitaet');
  await expect(page.getByText('Für Petra')).toBeVisible();
  await expect(
    page.getByText('Zu alt, vom 12. Juli 2026. Kommt trotzdem in die Mappe, bis ein neuer da ist.'),
  ).toBeVisible();
  // DP39, 3 (W10, PD44 RU2): Der Satz zum Alter entfällt.
  await expect(
    page.getByText('Viele Vermieter wollen ihn nicht älter als drei Monate.'),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Version hinzufügen' })).toBeVisible();

  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/ausweiskopie');
  // PC207, 1: Abgelegtes bleibt, mit dem Grund, warum es nie in die Mappe kommt.
  await expect(
    page.getByText(/^Eine Ausweiskopie darf ein Vermieter nicht verlangen\./),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Gespeichert' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ändern' })).toHaveCount(0);
  // Nichts zu tun: Unten steht nur der Weg zurück.
  await expect(page.locator('.leiste').getByRole('button')).toHaveText('Fertig');
  await page.getByRole('button', { name: 'Warum?' }).click();
  const ausweis = page.getByRole('dialog', { name: /Ausweis/ });
  await expect(ausweis.getByText('Meist unnötig', { exact: true })).toBeVisible();
  // Nie verlangbar: keine Marken.
  await expect(ausweis.getByRole('listitem')).toHaveCount(0);
  await ausweis.getByRole('button', { name: 'Schließen' }).click();

  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/mietzahlung');
  await page.getByRole('button', { name: 'Warum?' }).click();
  const miete = page.getByRole('dialog', { name: /Miet.?zahlungen/ });
  // PC65 (W32): Empfehlung statt Regel.
  await expect(
    miete.getByText(/Viele Vermieter fragen, ob die Miete bisher pünktlich gezahlt wurde/),
  ).toBeVisible();
  await expect(miete.getByRole('listitem')).toHaveCount(0);
});

test('Rolle wechseln auf der Personenseite: wirkt sofort, mit Zeile danach, nichts geht verloren (HA1, W54)', async ({
  page,
}) => {
  await laden(page, '25-unterlage-seiten', '/person-aendern/p-25-unterlage-seiten-2');
  const ziele = page.locator('.person-ziele');
  await expect(ziele.locator('.platz b')).toHaveText('Bürgt');
  // PC208: Eine Form (Bürge, Bürgin, neutral) gibt es nicht mehr, auch nicht für Bürgen.
  await expect(page.getByRole('radio', { name: 'Bürgin' })).toHaveCount(0);
  // W54: Das Ziel wirkt sofort, ohne „Speichern“; „Rückgängig“ holt den Stand davor.
  await ziele.locator('[data-z="vertrag"]').click();
  await expect(ziele.locator('.folge')).toContainText('steht jetzt im Mietvertrag.');
  await expect(ziele.locator('.platz b')).toHaveText('Im Mietvertrag');
  await ziele.locator('.rueck').click();
  await expect(ziele.locator('.platz b')).toHaveText('Bürgt');
  await ziele.locator('[data-z="vertrag"]').click();
  await expect(ziele.locator('.platz b')).toHaveText('Im Mietvertrag');

  // Die Erklärung bleibt gespeichert und steht unter „Nicht mehr nötig“, nicht im Band.
  await page.evaluate(() => (location.hash = '#/person/p-25-unterlage-seiten-2'));
  await page.getByRole('button', { name: /^Nicht mehr nötig 1/ }).click();
  await page.getByRole('link', { name: /^Bürgschafts.?erklärung/ }).click();
  await expect(
    page.getByText('Gespeichert. Wird nicht mehr gebraucht, kommt nicht in die Mappe.'),
  ).toBeVisible();

  // W42: Wer allein im Vertrag steht und bürgen soll, braucht jemanden im Vertrag; bis dahin bleibt alles, wie es ist.
  await laden(page, '23-ohne-datum', '/person-aendern/p-23-ohne-datum-0');
  const allein = page.locator('.person-ziele');
  await allein.locator('[data-z="buerge"]').click();
  await expect(allein.getByText('Wer kommt in den Mietvertrag?')).toBeVisible();
  await expect(allein.locator('.platz b')).toHaveText('Im Mietvertrag');
  await allein.getByRole('button', { name: 'Doch nicht' }).click();
  await expect(allein.getByText('Wer kommt in den Mietvertrag?')).toHaveCount(0);
});

test('Lebenslage ändern: Was statt wessen gebraucht wird (HA2)', async ({ page }) => {
  await laden(page, '09-lebenslagen', '/person-aendern/p-09-lebenslagen-1');
  await expect(page.getByText(/^Statt /)).toHaveCount(0);
  await page.getByLabel(/Einkommen\?$/).selectOption({ label: 'Angestellt' });
  await expect(page.getByText(/^Statt /)).toBeVisible();
  await expect(
    page.getByText(/braucht Lea dann Gehalts.?nachweise der letzten drei Monate\./),
  ).toBeVisible();
});

test('Fehlt eine Datei im Speicher, sagt die Mappe es, statt sie still wegzulassen', async ({
  page,
}) => {
  await laden(page, '04-fertig', '/');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok) => {
      const r = indexedDB.open('hefta');
      r.onsuccess = () => ok(r.result);
    });
    const tx = db.transaction('dateien', 'readwrite');
    tx.objectStore('dateien').clear();
    await new Promise((ok) => (tx.oncomplete = ok));
    db.close();
  });
  await page.evaluate(() => (location.hash = '#/mappe'));
  await expect(page.getByText(/(Datei fehlt|Dateien fehlen) in der Mappe/).first()).toBeVisible({
    timeout: 30_000,
  });
  // Die Selbstauskünfte stehen trotzdem drin, die Mappe geht.
  await expect(page.getByRole('button', { name: 'PDF ansehen' })).toBeVisible();
});

test('Fehlt eine Datei, nennt die Mappe sie mit Rufname und führt zur Seite der Unterlage', async ({
  page,
}) => {
  await laden(page, '04-fertig', '/');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok) => {
      const r = indexedDB.open('hefta');
      r.onsuccess = () => ok(r.result);
    });
    const tx = db.transaction('versionen', 'readwrite');
    const ort = tx.objectStore('versionen');
    const alle = await new Promise<{ dokumentId: string; original: string }[]>((ok) => {
      const r = ort.getAll();
      r.onsuccess = () => ok(r.result);
    });
    for (const v of alle.filter((x) => x.dokumentId.endsWith('-0-bonitaet')))
      ort.put({ ...v, original: 'gibt-es-nicht' });
    await new Promise((ok) => (tx.oncomplete = ok));
    db.close();
    location.hash = '#/mappe';
    location.reload();
  });
  await expect(
    page.getByRole('link', {
      name: /^Bonitätsnachweis von Max eine Datei lässt sich nicht öffnen/,
    }),
  ).toBeVisible({ timeout: 30_000 });
  // PC132 (DP84): Der Hinweis vor dem Bauen bleibt, „Teilen geht trotzdem“ fällt weg; geteilt wird nur über das
  // Blatt aus DP83 (unlesbar-mappe.spec).
  await expect(page.getByRole('button', { name: 'Als PDF teilen' })).toBeVisible();
  await expect(page.getByText('Eine Datei fehlt in der Mappe')).toBeVisible();
  await expect(page.getByText('Ladet sie noch einmal hoch.', { exact: true })).toBeVisible();
  await expect(page.getByText(/Teilen geht trotzdem/)).toHaveCount(0);
  await page.getByRole('link', { name: /^Bonitätsnachweis von Max/ }).click();
  await expect(page).toHaveURL(/#\/unterlage\/p-04-fertig-0\/bonitaet$/);
});

test('Freitext mit fremden Zeichen: Hefta nennt das Feld und führt dorthin', async ({ page }) => {
  await laden(page, '26-fremde-zeichen', '/mappe');
  await expect(
    page.getByRole('link', { name: /^Arbeitgeber bei Max Ein paar Zeichen/ }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole('link', { name: /^Arbeitgeber bei Max/ }).click();
  await expect(page).toHaveURL(/#\/selbstauskunft\/p-26-fremde-zeichen-0\/feld\/arbeitgeber$/);
  // Der Teil ist offen, der Fokus steht im Feld.
  await expect(page.getByLabel(/Arbeitgeber/)).toBeFocused();
});

test('Ohne Datum: alles erreichbar, Datum eintragen und wieder entfernen (OR8, OR9)', async ({
  page,
}) => {
  await laden(page, '23-ohne-datum', '/unterlage/p-23-ohne-datum-0/bonitaet');
  await expect(page.getByText(/^Ohne Datum\. Kommt in die Mappe, aber/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Diese Version löschen' })).toBeVisible();
  await page.getByRole('link', { name: /^Ausgestellt am/ }).click();
  await page.getByRole('button', { name: 'Heute' }).click();
  await expect(page.getByRole('button', { name: 'Datum entfernen' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await page.getByRole('link', { name: /^Ausgestellt am/ }).click();
  await page.getByRole('button', { name: 'Datum entfernen' }).click();
  await expect(page.getByText(/^Ohne Datum\. Kommt in die Mappe, aber/)).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByText(/^Vom .*Kommt in die Mappe\.$/)).toBeVisible();
});

test('Dieselbe Datei in mehreren Monaten: aufteilen, Rückgängig (OR1, OR2)', async ({ page }) => {
  await laden(page, '04-fertig', '/');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok) => {
      const r = indexedDB.open('hefta');
      r.onsuccess = () => ok(r.result);
    });
    const tx = db.transaction('versionen', 'readwrite');
    const ort = tx.objectStore('versionen');
    const alle = await new Promise<{ dokumentId: string; original: string }[]>((ok) => {
      const r = ort.getAll();
      r.onsuccess = () => ok(r.result);
    });
    const serie = alle.filter((x) => x.dokumentId.endsWith('-0-gehaltsnachweis'));
    for (const v of serie) ort.put({ ...v, original: serie[0]!.original });
    await new Promise((ok) => (tx.oncomplete = ok));
    db.close();
    location.hash = '#/unterlage/p-04-fertig-0/gehaltsnachweis';
    location.reload();
  });
  await expect(page.getByText(/enthalten dieselbe Datei\./)).toBeVisible();
  // Eine Frage, kein Fehler: Sie steht im Kasten, nicht als Hauptaktion unten (OR1).
  const kasten = page.getByRole('group', { name: 'Bitte prüfen' });
  await expect(kasten.getByRole('button', { name: 'Passt so' })).toBeVisible();
  await expect(page.locator('.leiste').getByText('Seiten aufteilen')).toHaveCount(0);
  await kasten.getByRole('link', { name: 'Seiten aufteilen' }).click();
  await expect(page.getByRole('combobox')).toHaveCount(2);
  // Die Beispiel-PDF hat zwei Seiten, einer der drei Monate geht leer aus.
  await expect(page.getByText(/bekommt keine Seite/)).toBeVisible();
  await page.getByRole('button', { name: /^Aufteilen/ }).click();
  await expect(page.getByText(/^Erledigt\./)).toBeVisible();
  await expect(page.getByText(/enthalten dieselbe Datei\./)).toHaveCount(0);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByText(/enthalten dieselbe Datei\./)).toBeVisible();

  // Keine Seite geht verloren: Vor und nach dem Aufteilen steht gleich viel in der Mappe.
  const seitenInMappe = async () => {
    await page.evaluate(() => (location.hash = '#/mappe'));
    await expect(page.getByRole('heading', { level: 1, name: 'Mappe teilen' })).toBeVisible();
    await expect(page.locator('main')).toHaveCount(1);
    const zahl = page
      .locator('main')
      .getByText(/^\d+ Seiten$/)
      .first();
    await zahl.waitFor({ timeout: 30_000 });
    const wert = parseInt(await zahl.innerText());
    await page.evaluate(() => (location.hash = '#/unterlage/p-04-fertig-0/gehaltsnachweis'));
    return wert;
  };
  const vorher = await seitenInMappe();
  await page.getByRole('link', { name: 'Seiten aufteilen' }).click();
  await expect(page.getByRole('combobox')).toHaveCount(2);
  await page.getByRole('button', { name: /^Aufteilen/ }).click();
  await expect(page.getByText(/^Erledigt\./)).toBeVisible();
  expect(await seitenInMappe()).toBe(vorher);
});

test('Seiten bearbeiten: aus der Mappe nehmen, löschen, Rückgängig (OR4, OR5)', async ({
  page,
}) => {
  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/bonitaet');
  await page.getByRole('link', { name: 'Seiten bearbeiten' }).click();
  await expect(
    page.getByText('2 von 2 Seiten kommen in die Mappe.', { exact: false }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Was mit Seite 2 geschehen soll' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Nicht in die Mappe/ })
    .click();
  await expect(
    page.getByText('1 von 2 Seiten kommen in die Mappe.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('Nicht in der Mappe. Bleibt hier gespeichert.')).toBeVisible();

  // Die letzte Seite in der Mappe bleibt drin, sonst wäre es eine Version ohne Inhalt.
  await page.getByRole('button', { name: 'Was mit Seite 1 geschehen soll' }).click();
  await expect(page.getByRole('dialog').getByText(/letzte Seite in der Mappe/)).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Was mit Seite 2 geschehen soll' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Löschen/ })
    .click();
  await expect(page.getByText('Seite 2 gelöscht.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Was mit Seite 2 geschehen soll' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('button', { name: 'Was mit Seite 2 geschehen soll' })).toBeVisible();
});

test('Seite verschieben: zu einer anderen Person, die Datei bleibt, Rückgängig (OR6)', async ({
  page,
}) => {
  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/bonitaet');
  await page.getByRole('link', { name: 'Seiten bearbeiten' }).click();
  await page.getByRole('button', { name: 'Was mit Seite 2 geschehen soll' }).click();
  const blatt = page.getByRole('dialog');
  await blatt.getByRole('button', { name: /^Verschieben/ }).click();
  await expect(blatt.getByRole('heading', { name: 'Wohin mit Seite 2?' })).toBeVisible();
  await blatt.getByRole('button', { name: /^Lea/ }).click();
  await blatt.getByRole('button', { name: /^Miet.?zahlungen/ }).click();
  // Zurück in die Liste der Unterlage; die Zeile sagt, wo die Seite jetzt liegt.
  await expect(page.getByText(/^Seite 2 ist jetzt bei Lea: Miet.?zahlungen\.$/)).toBeVisible();
  await expect(page).toHaveURL(/\/bonitaet$/);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByText(/^Seite 2 ist jetzt/)).toHaveCount(0);
  await page.getByRole('link', { name: 'Seiten bearbeiten' }).click();
  await expect(page.getByRole('button', { name: 'Was mit Seite 2 geschehen soll' })).toBeVisible();

  // Noch einmal, diesmal bleibt es dabei: Bei Lea steht die Seite, bei Max fehlt sie.
  await page.getByRole('button', { name: 'Was mit Seite 2 geschehen soll' }).click();
  await blatt.getByRole('button', { name: /^Verschieben/ }).click();
  await blatt.getByRole('button', { name: /^Lea/ }).click();
  await blatt.getByRole('button', { name: /^Miet.?zahlungen/ }).click();
  await expect(page.getByText(/^Seite 2 ist jetzt bei Lea/)).toBeVisible();
  await page.evaluate(() => (location.hash = '#/unterlage/p-25-unterlage-seiten-1/mietzahlung'));
  await expect(page.getByText(/^1 Seite\b/)).toBeVisible();
  // Sätze über „Mietzahlungen“ stehen in der Mehrzahl.
  await expect(page.getByText(/wann sie zu alt sind\.$/)).toBeVisible();
});

test('Löschen in der Liste: wischen und „Bearbeiten“, mit Rückgängig (OR7, OR7c)', async ({
  page,
}) => {
  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/bonitaet');
  const zeile = page.getByRole('link', { name: /Version vom 12\.\sJuli/ });
  await expect(zeile).toBeVisible();

  // Ganz durchwischen löscht sofort. In die Mitte: Unten liegt die feste Leiste über der Zeile.
  await zeile.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  const r = (await zeile.boundingBox())!;
  await page.mouse.move(r.x + r.width - 10, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width - 60, r.y + r.height / 2, { steps: 4 });
  await page.mouse.move(r.x + 5, r.y + r.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(zeile).toHaveCount(0);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(zeile).toBeVisible();

  // Ohne Wischen: Der Weg für VoiceOver, Schalter und Tastatur, ein Knopf, der beim Fokus erscheint.
  const knopf = page.getByRole('button', { name: /Version vom 12\.\sJuli löschen/ });
  await knopf.focus();
  await expect(knopf).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(zeile).toHaveCount(0);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(zeile).toBeVisible();
  // DP39, 3: „Ältere Versionen“ ohne „Bearbeiten“.
  await expect(page.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0);
});

test('Personenansicht: Unterlage mit allen Versionen löschen, Rückgängig (OR7)', async ({
  page,
}) => {
  await laden(page, '25-unterlage-seiten', '/person/p-25-unterlage-seiten-0');
  // DP39, 2: kein „Bearbeiten“; ohne Wischen löscht der Knopf, der beim Fokus erscheint.
  await expect(page.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Bonitäts.?nachweis löschen/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/^Bonitätsnachweis gelöscht\./)).toBeVisible();
  await expect(page.getByRole('link', { name: /^Bonitäts.?nachweis.*Fehlt noch/ })).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('link', { name: /^Bonitäts.?nachweis.*Fehlt noch/ })).toHaveCount(0);
});
/** Ändert gespeicherte Versionen wie im echten Leben (dieselbe Datei, Gelesenes) und lädt neu. */
async function versionenPatchen(
  page: Page,
  endung: string,
  patch: Record<string, unknown>,
  gleicheDatei = false,
) {
  await page.evaluate(
    async ({ endung, patch, gleicheDatei }) => {
      const db = await new Promise<IDBDatabase>((ok) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => ok(r.result);
      });
      const tx = db.transaction('versionen', 'readwrite');
      const ort = tx.objectStore('versionen');
      const alle = await new Promise<{ dokumentId: string; original: string }[]>((ok) => {
        const r = ort.getAll();
        r.onsuccess = () => ok(r.result);
      });
      const treffer = alle.filter((x) => x.dokumentId.endsWith(endung));
      for (const v of treffer)
        ort.put({ ...v, ...patch, ...(gleicheDatei ? { original: treffer[0]!.original } : {}) });
      await new Promise((ok) => (tx.oncomplete = ok));
      db.close();
    },
    { endung, patch, gleicheDatei },
  );
  await page.reload();
}

const FAKTEN = (seite: Record<string, unknown>) => ({
  erkannteWerte: {
    stand: 1,
    hash: null,
    seiten: [{ monat: null, von: null, leer: false, textHash: null, woerter: [], ...seite }],
  },
  eigene: [0],
  seiten: [0],
});

test('Prüfhinweis Name: Übersicht, Person, Seite, Mappe; „Passt so“ gilt für immer (PH1, PH3, PH5)', async ({
  page,
}) => {
  await laden(page, '04-fertig', '/');
  await versionenPatchen(page, '-0-bonitaet', FAKTEN({ woerter: ['lea', 'mustermann'] }));
  // Tab „Mappe“: Marke „prüfen“ an der Zeile, der Satz nennt es, Teilen bleibt (Nachricht 10.11. k, l, m).
  await expect(page.getByRole('link', { name: /^Bonitäts.?nachweis .* prüfen ?: / })).toBeVisible();
  await expect(page.getByText('Alles da. Eine Unterlage solltet ihr noch prüfen.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mappe teilen' })).toBeVisible();

  await page.evaluate(() => (location.hash = '#/person/p-04-fertig-0'));
  await expect(page.getByText(/^Bitte prüfen: Auf dem Dokument steht Lea/)).toBeVisible();

  await page.evaluate(() => (location.hash = '#/mappe'));
  await expect(page.getByText('Eine Sache solltet ihr vorher ansehen')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Als PDF teilen' })).toBeVisible();

  await page.evaluate(() => (location.hash = '#/unterlage/p-04-fertig-0/bonitaet'));
  const kasten = page.getByRole('group', { name: 'Bitte prüfen' });
  await expect(kasten).toContainText(
    /Auf dem Dokument steht Lea .*, nicht Max\. Gehört es zu Lea\?/,
  );
  await kasten.getByRole('button', { name: 'Passt so' }).click();
  await expect(kasten).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(kasten).toHaveCount(0);
});

test('Prüfhinweis Name: „Zu Lea verschieben“ und Rückgängig', async ({ page }) => {
  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/bonitaet');
  await versionenPatchen(page, '-0-bonitaet', FAKTEN({ woerter: ['lea', 'mustermann'] }));
  const kasten = page.getByRole('group', { name: 'Bitte prüfen' });
  await kasten.getByRole('button', { name: 'Zu Lea verschieben' }).click();
  await expect(page.getByText('Passt jetzt.')).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(kasten).toBeVisible();
});

test('Prüfhinweis Monat: Auf der Seite steht ein anderer Monat (PH2)', async ({ page }) => {
  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/gehaltsnachweis');
  await versionenPatchen(page, '-0-gehaltsnachweis', FAKTEN({ monat: '2025-03' }));
  const kasten = page.getByRole('group', { name: 'Bitte prüfen' });
  await expect(kasten).toContainText(/März 2025/);
  await expect(kasten.getByRole('button', { name: /^Nach März/ })).toBeVisible();
});

test('Gleich nach dem Hochladen: „Seite 1 von 2“, „Passt so“ bleibt (PH4)', async ({ page }) => {
  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/bonitaet');
  await page.getByRole('button', { name: /^Neue Version hinzufügen/ }).click();
  const blatt = page.getByRole('dialog');
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  doc
    .addPage([595, 842])
    .drawText('Max Mustermann, Seite 1 von 2', { x: 60, y: 700, size: 12, font: schrift });
  await blatt.locator('[data-feld="pdf"]').setInputFiles({
    name: 'bonitaet.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  const kasten = blatt.getByRole('group', { name: 'Bitte prüfen' });
  await expect(kasten).toContainText('Fehlt die zweite?', { timeout: 30_000 });
  await expect(kasten.getByRole('button', { name: 'Seite dazunehmen' })).toBeVisible();
  await kasten.getByRole('button', { name: 'Passt so' }).click();
  await expect(kasten).toHaveCount(0);
  await blatt.getByRole('button', { name: 'Speichern' }).click();
  await expect(blatt).toBeHidden();
  // Gelesen ist schon, die Antwort gilt: Auf der Seite fragt Hefta nicht noch einmal.
  await expect(page.getByRole('group', { name: 'Bitte prüfen' })).toHaveCount(0);
});

test('Vorhandene Dateien liest Hefta einmal im Hintergrund nach', async ({ page }) => {
  await laden(page, '04-fertig', '/');
  await versionenPatchen(page, '-0-bonitaet', { erkannteWerte: null });
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((ok) => {
            const r = indexedDB.open('hefta');
            r.onsuccess = () => ok(r.result);
          });
          const alle = await new Promise<
            { dokumentId: string; erkannteWerte: { hash: string | null } | null }[]
          >((ok) => {
            const r = db.transaction('versionen').objectStore('versionen').getAll();
            r.onsuccess = () => ok(r.result);
          });
          db.close();
          return alle.find((v) => v.dokumentId.endsWith('-0-bonitaet'))?.erkannteWerte?.hash ?? '';
        }),
      { timeout: 20_000 },
    )
    .toMatch(/^[0-9a-f]{64}$/);
});

test('Monat passt nicht: Die Seite der Serie sagt, welcher Monat; die Seite des Monats nicht (PH2)', async ({
  page,
}) => {
  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/gehaltsnachweis');
  await versionenPatchen(page, '-0-gehaltsnachweis', FAKTEN({ monat: '2025-03' }));
  const kasten = page.getByRole('group', { name: 'Bitte prüfen' });
  await expect(kasten).toContainText(
    // DP33 A1: Das Zeichen ist jetzt eins aus B11, kein „?“ mehr im Text.
    /^\s*Bei .+ 2026 steht auf der Seite „März 2025“\. Gehört sie zu März 2025\?/,
  );
  const titel = (await kasten.locator('b').first().innerText()).trim();
  await page.getByRole('link', { name: new RegExp(`^${titel}`) }).click();
  await expect(kasten).toContainText(/^\s*Auf der Seite steht „März 2025“\./);
  await kasten.getByRole('button', { name: /^Nach März/ }).click();
  await expect(page.getByText('Passt jetzt.')).toBeVisible();
});

test('Blatt zu einer Seite: Pfeil nur bei „Verschieben“; Stand der Ziele folgt dem Etikett (OR5, OR6)', async ({
  page,
}) => {
  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/bonitaet');
  await page.getByRole('link', { name: 'Seiten bearbeiten' }).click();
  await page.getByRole('button', { name: 'Was mit Seite 2 geschehen soll' }).click();
  const blatt = page.getByRole('dialog');
  await expect(blatt.getByRole('button', { name: /^Verschieben/ }).locator('svg')).toHaveCount(1);
  await expect(blatt.getByRole('button', { name: /^Löschen/ }).locator('svg')).toHaveCount(0);
  await blatt.getByRole('button', { name: /^Verschieben/ }).click();
  await expect(
    blatt.getByRole('button', { name: /^SCHUFA-Datenkopie Noch nicht gespeichert/ }),
  ).toBeVisible();
  await expect(
    blatt.getByRole('button', { name: /^Empfehlung des Vorvermieters Noch nicht dabei/ }),
  ).toBeVisible();
});

test('Bonitätsnachweis: Prüfcode statt Panik, nichts wird als offen gezählt', async ({ page }) => {
  await laden(page, '04-fertig', '/unterlage/p-04-fertig-0/bonitaet');
  // HEUTE ist der 6. November 2026: Tag 57.
  await versionenPatchen(page, '-0-bonitaet', {
    ...FAKTEN({ woerter: ['pruefcode'] }),
    ausstellungsdatum: '2026-09-10',
  });
  await expect(
    page.getByText(/^Der Prüfcode läuft am 9\.\sNovember ab\. Danach kann der Vermieter/),
  ).toBeVisible();
  await page.evaluate(() => (location.hash = '#/person/p-04-fertig-0'));
  await expect(
    page.getByText(/^Vom 10\.\sSeptember\. Prüfcode läuft am 9\.\sNovember ab$/),
  ).toBeVisible();
  await page.evaluate(() => (location.hash = '#/'));
  // Nichts offen: Der Tab „Mappe“ sagt „startklar“, die Zeile „prüfbar bis“.
  await expect(page.getByText(stimmungMuster('P4', { teil: 'satz' }))).toBeVisible();
  await expect(page.getByText(/^prüfbar bis 9\.\sNov/)).toBeVisible();

  // Tag 70: abgelaufen, kommt aber in die Mappe.
  await versionenPatchen(page, '-0-bonitaet', {
    ...FAKTEN({ woerter: ['pruefcode'] }),
    ausstellungsdatum: '2026-08-28',
  });
  await page.evaluate(() => (location.hash = '#/unterlage/p-04-fertig-0/bonitaet'));
  await expect(
    page.getByText(/^Vom 28\.\sAugust 2026\. Prüfcode abgelaufen, kommt in die Mappe\.$/),
  ).toBeVisible();

  // Ohne das Wort im Text gibt es keinen Prüfcode: ein Scan oder ein anderer Anbieter.
  await versionenPatchen(page, '-0-bonitaet', {
    ...FAKTEN({ woerter: ['auskunft'] }),
    ausstellungsdatum: '2026-08-28',
  });
  await expect(page.getByText(/^Vom 28\.\sAugust 2026\. Kommt in die Mappe\.$/)).toBeVisible();
});

test('Mappe erstellen: Was zu alt ist, steht im Block oben und führt zur Unterlage (PH5)', async ({
  page,
}) => {
  await laden(page, '25-unterlage-seiten', '/mappe');
  const zeile = page.getByRole('link', {
    name: /^Bonitäts.?nachweis von Petra Zu alt, vom 12\.\sJuli/,
  });
  await expect(zeile).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/^Bei Petra ist/)).toHaveCount(0);
  await zeile.click();
  await expect(page).toHaveURL(/#\/unterlage\/p-25-unterlage-seiten-2\/bonitaet$/);
  await expect(page.getByRole('button', { name: 'Warum?' })).toBeVisible();
});

test('Prüfcode abgelaufen ist kein Mangel: Es steht nicht im Block', async ({ page }) => {
  await laden(page, '04-fertig', '/');
  await versionenPatchen(page, '-0-bonitaet', {
    ...FAKTEN({ woerter: ['pruefcode'] }),
    ausstellungsdatum: '2026-08-28',
  });
  await page.evaluate(() => (location.hash = '#/mappe'));
  await expect(page.getByRole('heading', { level: 1, name: 'Mappe teilen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Als PDF teilen' })).toBeVisible();
  await expect(page.getByText(/solltest du vorher ansehen/)).toHaveCount(0);
});

test('„Seiten auswählen“ gleich nach dem Hochladen: Auch noch nicht geladene Seiten sind draußen', async ({
  page,
}) => {
  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/bonitaet');
  await page.getByRole('button', { name: /^Neue Version hinzufügen/ }).click();
  const blatt = page.getByRole('dialog');
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  for (let n = 1; n <= 40; n++)
    doc.addPage([595, 842]).drawText(`Seite ${n}`, { x: 60, y: 700, size: 12, font: schrift });
  await blatt.locator('[data-feld="pdf"]').setInputFiles({
    name: 'viele.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  // Nicht warten: Der Knopf erscheint, sobald die Datei offen ist, die Bilder kommen danach.
  await blatt.getByRole('button', { name: 'Seiten auswählen' }).click();
  await expect(blatt.getByText('Tippt die Seiten an, die der Vermieter sehen soll.')).toBeVisible();
  await expect(blatt.getByRole('checkbox')).toHaveCount(40, { timeout: 60_000 });
  await expect(blatt.getByRole('checkbox', { checked: true })).toHaveCount(0);
  await expect(blatt.getByText('Tippt die Seiten an, die der Vermieter sehen soll.')).toBeVisible();
});

test('„Speichern“ getippt, während die Datei noch lädt: Der Tipp geht nicht verloren', async ({
  page,
}) => {
  await laden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-0/bonitaet');
  await page.getByRole('button', { name: /^Neue Version hinzufügen/ }).click();
  const blatt = page.getByRole('dialog');
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  for (let n = 1; n <= 5; n++)
    doc.addPage([595, 842]).drawText(`Seite ${n}`, { x: 60, y: 700, size: 12, font: schrift });
  await blatt.locator('[data-feld="pdf"]').setInputFiles({
    name: 'fuenf.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await blatt.getByRole('button', { name: 'Speichern' }).click();
  await expect(blatt).toBeHidden({ timeout: 30_000 });
});

test('Aussehen der Mappe: Farben der Personen sind Standard, Wahl bleibt, Vorschau aus der echten Hefta (AM1 bis AM3)', async ({
  page,
}) => {
  await laden(page, '04-fertig', '/mappe/anpassen');
  const groß = page.getByRole('button', { name: 'Vorschau eurer Mappe groß ansehen' });
  await expect(groß).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('radio', { name: /^Farben der Personen/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  // Die Vorschau zeigt hier die echte Hefta des Szenarios (Max und Lea), nicht die Beispiel-Mappe (W40 betrifft sie nicht).
  await expect(page.getByText(/^Kopfzeile einer Unterlage von Lea/)).toBeVisible();
  const bildVorher = await groß.locator('img').first().getAttribute('src');

  await page.getByRole('radio', { name: /^Eine Farbe/ }).click();
  await page.getByRole('radio', { name: 'Bordeaux' }).click();
  await expect
    .poll(() => groß.locator('img').first().getAttribute('src'), { timeout: 30_000 })
    .not.toBe(bildVorher);

  await page.reload();
  await expect(page.getByRole('radio', { name: 'Bordeaux' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  await page.getByRole('radio', { name: /^Farben der Personen/ }).click();
  await expect(page.getByText(/^Ein kleines Quadrat vor dem Namen/)).toBeVisible();

  // Tipp: die ganze Mappe groß.
  await groß.click();
  await expect(page.getByRole('dialog', { name: /^Seite 1 von \d+/ })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('Aussehen der Mappe ohne Unterlagen: Beispiel, als Beispiel benannt', async ({ page }) => {
  await laden(page, '02-neustart', '/mappe/anpassen');
  await expect(page.getByText('Beispiel. Mit euren Namen sieht es genauso aus.')).toBeVisible({
    timeout: 30_000,
  });
  // W40: Die Beispiel-Mappe zeigt Haushalt A der Namensliste (Selin statt Lea).
  await expect(page.getByText(/^Kopfzeile einer Unterlage von Selin/)).toBeVisible();
});

test('Farbe bei der Person: wählen, vergebene wird getauscht, wirkt überall (PF1, PF1b)', async ({
  page,
}) => {
  await laden(page, '01-standard', '/person-aendern/p-01-standard-2');
  const gruppe = page.getByRole('radiogroup', { name: /^Farbe/ });
  const minze = gruppe.getByRole('radio', { name: 'Minze' });
  // B14: zwölf Farben.
  await expect(gruppe.getByRole('radio')).toHaveCount(12);
  await expect(minze).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.marke')).toHaveText('Farbe Minze');
  await expect(
    page.getByText(/Eine Farbe mit Buchstabe hat schon jemand\. Wählt ihr sie, tauscht ihr\.$/),
  ).toBeVisible();

  // Vergeben: gewählt wird trotzdem, Max bekommt dafür die bisherige. Noch ist nichts gespeichert.
  const koralle = gruppe.getByRole('radio', { name: 'Apricot, hat Max' });
  await expect(koralle).toHaveText('M');
  await koralle.click();
  await expect(page.getByRole('status')).toHaveText('Max bekommt dafür Minze.');
  await expect(gruppe.getByRole('radio', { name: 'Apricot' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(gruppe.getByRole('radio', { name: 'Minze, hat Max' })).toHaveText('M');

  // Frei: gewählt, die Meldung geht, Max steht wieder bei Apricot.
  await gruppe.getByRole('radio', { name: 'Honig' }).click();
  await expect(page.locator('.marke')).toHaveText('Farbe Honig');
  await expect(page.getByRole('status')).toHaveText('');
  await expect(gruppe.getByRole('radio', { name: 'Apricot, hat Max' })).toHaveText('M');
  await expect(minze).toHaveAttribute('aria-checked', 'false');

  // Erst „Speichern“ schreibt, danach gilt es überall.
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('radiogroup', { name: /^Farbe/ })).toHaveCount(0);
  await page.goto('about:blank');
  await page.goto('/#/haushalt');
  // Petra bürgt: Zeichen mit Umriss in ihrer neuen Farbe (DP39, 5).
  await expect(
    page.locator('.faecher .zeile', { hasText: 'Petra' }).locator('.zeichen'),
  ).toHaveAttribute('style', /--p-app: ?#efce7e/);
  await page.goto('about:blank');
  await page.goto('/#/person-aendern/p-01-standard-2');
  await expect(gruppe.getByRole('radio', { name: 'Honig' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('.marke')).toHaveText('Farbe Honig');

  // Bei Max steht jetzt Honig als vergeben, Minze ist wieder frei.
  await page.goto('about:blank');
  await page.goto('/#/person-aendern/p-01-standard-0');
  await expect(gruppe.getByRole('radio', { name: 'Honig, hat Petra' })).toHaveText('P');
  await expect(gruppe.getByRole('radio', { name: 'Minze', exact: true })).toBeVisible();

  // Die Mappe nimmt die neue Farbe, im Druckton (AM3), und sagt, wo man sie ändert.
  await page.goto('about:blank');
  await page.goto('/#/mappe/anpassen');
  // Erst tippen, wenn die Vorschau dasteht: Sie schiebt die Wahl darunter nach unten (CP44).
  await page.locator('main h1').first().waitFor();
  await expect(page.getByText('Vorschau wird erstellt …')).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole('radio', { name: /^Farben der Personen/ }).click();
  await expect(page.getByText(/Tippt? auf einen Namen, um die Farbe zu ändern\.$/)).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('.personen i')
        .nth(2)
        .evaluate((e) => (e as HTMLElement).style.getPropertyValue('--ton')),
    )
    .toBe('#86754c');
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('Farbe: Wer allein ist, liest nichts von Buchstaben; bei sechs Personen bleibt die Wahl da', async ({
  page,
}) => {
  await laden(page, '11-allein', '/person-aendern/p-11-allein-0');
  await expect(page.getByText('Gilt überall, auch in der Mappe.', { exact: true })).toBeVisible();

  await laden(page, '27-sechs-personen', '/person-aendern/p-27-sechs-personen-3');
  const gruppe = page.getByRole('radiogroup', { name: /^Farbe/ });
  await expect(gruppe.getByRole('radio', { name: /, hat / })).toHaveCount(5);
  // Sina hat Petrol (Testdaten in der Reihenfolge der Vergabe, PC48).
  await expect(gruppe.getByRole('radio', { name: 'Petrol' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  // Vergeben: Es geht trotzdem, getauscht wird.
  await gruppe.getByRole('radio', { name: 'Ton, hat Petra' }).click();
  await expect(page.getByRole('status')).toHaveText('Petra bekommt dafür Petrol.');
});

test('Vorschau: sagt, was aus ist, liest keine Datei, erst der Tipp baut die ganze Mappe', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const zaehler = window as unknown as { __gelesen: number };
    zaehler.__gelesen = 0;
    const lesen = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (this: IDBObjectStore, schluessel: IDBValidKey) {
      if (this.name === 'dateien') zaehler.__gelesen++;
      return lesen.call(this, schluessel);
    };
  });
  const gelesen = () => page.evaluate(() => (window as unknown as { __gelesen: number }).__gelesen);
  await laden(page, '04-fertig', '/mappe/anpassen');
  const groß = page.getByRole('button', { name: /^Vorschau eurer Mappe groß ansehen/ });
  await expect(groß).toBeVisible({ timeout: 30_000 });
  const bildVorher = await groß.locator('img').first().getAttribute('src');
  await page.getByRole('radio', { name: /^Eine Farbe/ }).click();
  await expect
    .poll(() => groß.locator('img').first().getAttribute('src'), { timeout: 30_000 })
    .not.toBe(bildVorher);
  expect(await gelesen()).toBe(0);

  // Die ganze Mappe kommt mit allen Seiten. Das Deckblatt ist noch an: Seite 1 und die Dateien.
  await groß.click();
  const blatt = page.getByRole('dialog', { name: /^Seite 1 von \d+/ });
  await expect(blatt).toBeVisible({ timeout: 30_000 });
  const titel = await blatt.evaluate(
    (d) => document.getElementById(d.getAttribute('aria-labelledby')!)?.textContent ?? '',
  );
  const mitDeckblatt = Number(titel.match(/von (\d+)/)?.[1]);
  expect(await gelesen()).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(blatt).toBeHidden();

  // Aus: Der Ausschnitt bleibt, die Bildunterschrift und der Name des Knopfs sagen es.
  await page.getByRole('switch', { name: 'Deckblatt' }).click();
  await expect(page.getByText(/^Deckblatt ist aus\. So sähe es aus\./)).toBeVisible();
  await expect(groß.locator('img')).toHaveCount(2);
  await expect(groß).toHaveAccessibleName(/Deckblatt ist aus\. So sähe es aus\.$/);
  await page.getByRole('switch', { name: 'Kopf- und Fußzeile' }).click();
  await expect(page.getByText('Kopfzeile ist aus. So sähe sie aus.')).toBeVisible();

  // Und die ganze Mappe hält sich an die Einstellungen: eine Seite weniger.
  await groß.click();
  const ohne = page.getByRole('dialog', { name: new RegExp(`^Seite 1 von ${mitDeckblatt - 1}`) });
  await expect(ohne).toBeVisible({ timeout: 30_000 });
});

test('Vorschau ohne Unterlagen: Der Satz zum Beispiel steht im Kasten, über den Ausschnitten', async ({
  page,
}) => {
  await laden(page, '02-neustart', '/mappe/anpassen');
  const satz = page.getByText('Beispiel. Mit euren Namen sieht es genauso aus.');
  await expect(satz).toBeVisible({ timeout: 30_000 });
  const groß = page.getByRole('button', { name: /^Vorschau eurer Mappe groß ansehen/ });
  await expect(groß.locator('.beispiel')).toBeVisible();
  await expect(groß).toHaveAccessibleName(/Beispiel\. Mit euren Namen sieht es genauso aus\.$/);
  const obenSatz = (await satz.boundingBox())!.y;
  const obenBild = (await groß.locator('img').first().boundingBox())!.y;
  expect(obenSatz).toBeLessThan(obenBild);
  await groß.click();
  await expect(page.getByRole('dialog', { name: /^Seite 1 von \d+/ })).toBeVisible({
    timeout: 30_000,
  });
});

test('Neues Logo: Symbole, Zeichen im Kopf, Ziel offen und erreicht, Kachel beim ersten Start (LG1 bis LG3)', async ({
  page,
  request,
}) => {
  const groesse = async (pfad: string) => {
    const antwort = await request.get(pfad);
    expect(antwort.ok(), pfad).toBe(true);
    const png = await antwort.body();
    return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
  };
  const manifest = (await (await request.get('/manifest.webmanifest')).json()) as {
    icons: { src: string; sizes: string; purpose: string }[];
  };
  expect(manifest.icons.map((i) => i.purpose)).toEqual(['any', 'any', 'maskable']);
  for (const i of manifest.icons) expect(await groesse(`/${i.src}`)).toBe(i.sizes);
  expect(await groesse('/icons/apple-touch-icon.png')).toBe('180x180');
  expect(await groesse('/icons/favicon-32.png')).toBe('32x32');
  expect(await groesse('/icons/favicon-16.png')).toBe('16x16');

  const stil = (selektor: string, feld: string) =>
    page
      .locator(selektor)
      .first()
      .evaluate((e, f) => getComputedStyle(e).getPropertyValue(f), feld);

  // LG1 und LG2: Das Ziel stand am Ende des Bands. Der Tab „Mappe“ (B12b) hat kein Band mehr und
  // darum auch kein Ziel; „startklar“ steht im Kasten oben. Das Logo im Kopf bleibt.
  await laden(page, '01-standard', '/');
  await expect(page.locator('.logo img').first()).toHaveJSProperty('naturalWidth', 186);
  await expect(page.locator('svg.ziel')).toHaveCount(0);
  await laden(page, '04-fertig', '/');
  await expect(page.locator('.aufgaben.fertig')).toBeVisible();
  expect(await stil('.logo img', 'width')).not.toBe('0px');

  // LG3: Erster Start. Seit Hefta 2 (B15, B16) der Tab „Wohnungen“ mit dem Logo im Kopf statt der Kachel.
  await page.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.deleteDatabase('hefta');
        r.onsuccess = r.onerror = r.onblocked = ok;
      }),
  );
  await page.goto('about:blank');
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Fang an, wo du gerade bist' }),
  ).toBeVisible();
  await expect(page.locator('.kopf .logo').first()).toBeVisible();
});

test.describe('ohne Service Worker', () => {
  test.use({ serviceWorkers: 'block' });

  test('Aussehen der Mappe: Scheitert die Vorschau, steht das da, und die Wahl geht weiter', async ({
    page,
  }) => {
    // Der Baustein der Vorschau lädt nicht (etwa nach einem halben Update): kein ewiges „wird erstellt“.
    await page.route(/mappeVorschau-[^/]*\.js$/, (route) => route.abort());
    await laden(page, '04-fertig', '/mappe/anpassen');
    await expect(page.getByText(/^Gerade keine Vorschau\./)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('radio', { name: /^Eine Farbe/ }).click();
    // Gespeichert ist die Wahl erst kurz nach dem Tipp.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<string>((ok) => {
              const r = indexedDB.open('hefta');
              r.onsuccess = () => {
                const g = r.result.transaction('haushalte').objectStore('haushalte').getAll();
                g.onsuccess = () => {
                  ok((g.result[0] as { mappeAussehen?: { art: string } }).mappeAussehen?.art ?? '');
                  r.result.close();
                };
              };
            }),
        ),
      )
      .toBe('einefarbe');
    await page.reload();
    await expect(page.getByRole('radio', { name: /^Eine Farbe/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
