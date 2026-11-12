import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { ganzesBild } from './hefte-hilfen';

// Zeile 9: Termin eintragen und ändern, „In den Kalender“ (im Browser eine .ics-Datei), „Stand selbst
// setzen“, das Ergebnis und „Wieder hervorholen“. Die Hefte legt der Test direkt in die Datenbank.

const JETZT = new Date(2026, 10, 8, 20, 0); // So, 8. Nov. 2026, abends

function tag(versatz: number, stunde = 12, minute = 0): string {
  return new Date(2026, 10, 8 + versatz, stunde, minute).toISOString();
}

const leer = {
  beworben: null,
  gefragtAm: null,
  termin: null,
  ergebnis: null,
  loeschbitteAm: null,
  nachgefasstAm: null,
  abgelegtAm: null,
};

function heft(id: string, titel: string, ereignisse: Record<string, unknown>) {
  return {
    id,
    createdAt: tag(-10),
    updatedAt: tag(-10),
    haushaltId: null,
    adresse: 'Musterweg 5\n20000 Hamburg',
    link: null,
    quelle: '',
    inseratText: null,
    kennung: `k-${id}`,
    ereignisse: { ...leer, ...ereignisse },
    notiz: '',
    angaben: { titel, stadtteil: 'Altona', warm: 1000, zimmer: 2, flaeche: 50 },
  };
}

/** Wie in der App: über „Wohnungen“ ins Heft, dann heißt der Link oben „Wohnungen“. */
async function heftOeffnen(page: Page, id: string) {
  await page.goto('/#/wohnungen');
  await page.reload();
  await page.evaluate((h) => (window.location.hash = h), `#/heft/${id}`);
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

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(JETZT);
});

test('Termin eintragen, in den Kalender, ändern, Ergebnis und wieder hervorholen (Zeile 9)', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await hefteAnlegen(page, [
    heft('muster', 'Zwei Zimmer am Park', {
      beworben: { am: tag(-3), weg: 'mail', sicher: true },
    }),
  ]);
  await heftOeffnen(page, 'muster');
  // Der Link oben heißt wie die Seite, aus der man kam (Design 12.11.).
  await expect(page.locator('header.kopf').getByRole('link')).toHaveText('Wohnungen');

  await expect(page.getByRole('img', { name: 'Stand: Beworben' })).toBeVisible();
  await expect(page.getByText(/^Beworben am 5\.\sNov\., seit 3 Tagen$/)).toBeVisible();
  await expect(page.getByText(/Meldet sich jemand, trag den Termin ein\./)).toBeVisible();
  await page.getByRole('link', { name: 'Termin eintragen' }).click();

  // Termin: die nächsten vier Tage, Uhrzeit, Treffpunkt.
  await expect(page.getByRole('heading', { level: 1, name: 'Termin eintragen' })).toBeVisible();
  await expect(page.getByText('Mit dem Termin steht das Heft auf „Besichtigung“.')).toBeVisible();
  const tage = page.getByRole('group', { name: 'Tag' }).getByRole('button');
  await expect(tage).toHaveCount(5);
  await expect(tage.first()).toHaveText(/^Mo, 9\.\sNov\.$/);
  // Ohne Tag geht es nicht.
  await page.getByRole('button', { name: 'Termin speichern' }).click();
  await expect(page.getByRole('alert')).toHaveText('Erst einen Tag wählen.');
  await page.getByRole('button', { name: /^Di, 10\.\sNov\.$/ }).click();
  await page.getByLabel('Uhrzeit').fill('17:30');
  await page.getByLabel('Treffpunkt oder Notiz').fill('Klingeln bei Okafor');
  await ganzesBild(page, 'termin.png');
  await page.getByRole('button', { name: 'Termin speichern' }).click();

  // Zurück im Heft: Besichtigung mit Karte, Kalender, „Termin ändern“, „Stand selbst setzen“.
  await expect(page.getByRole('img', { name: 'Stand: Besichtigung' })).toBeVisible();
  await expect(page.getByRole('group')).toContainText('Klingeln bei Okafor');
  const laden = page.waitForEvent('download');
  await page.getByRole('button', { name: 'In den Kalender' }).click();
  const datei = await laden;
  expect(datei.suggestedFilename()).toBe('Besichtigung-Zwei-Zimmer-am-Park.ics');
  const ics = await (async () => {
    const pfad = await datei.path();
    const fs = await import('node:fs');
    return fs.readFileSync(pfad, 'utf8');
  })();
  expect(ics).toContain('DTSTART:20261110T173000');
  expect(ics).toContain('DURATION:PT30M');
  // E90: Vorabend 9.11., 18:00 bis 10.11., 17:30 und eine Stunde vorher.
  expect(ics).toContain('TRIGGER:-PT1410M');
  expect(ics).toContain('TRIGGER:-PT60M');
  expect(ics).toContain('SUMMARY:Besichtigung: Zwei Zimmer am Park');
  expect(ics).toContain(String.raw`LOCATION:Musterweg 5\, 20000 Hamburg`);
  expect(ics).toContain('DESCRIPTION:Klingeln bei Okafor');
  await expect(page.getByRole('status')).toContainText('Die Datei für den Kalender ist da.');
  await ganzesBild(page, 'heft-termin.png');

  // Ändern: Tag, Uhrzeit und Treffpunkt stehen schon da.
  await page.getByRole('link', { name: 'Termin ändern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Termin ändern' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Di, 10\.\sNov\.$/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('Uhrzeit')).toHaveValue('17:30');
  // Beim Ändern kein Satz zu „Besichtigung“ (Planung 12q).
  await expect(page.getByText('Mit dem Termin steht das Heft auf')).toHaveCount(0);
  await ganzesBild(page, 'termin-aendern.png');
  await page.getByRole('button', { name: 'Anderer Tag' }).click();
  await page.getByLabel('Datum').fill('2026-11-20');
  await page.getByRole('button', { name: 'Termin speichern' }).click();
  await expect(page.getByRole('group')).toContainText('Fr');
  await expect(page.getByRole('group')).toContainText('20');

  // Stand selbst setzen: Besichtigung ist gewählt; Ergebnis führt zur Frage.
  await page.getByRole('link', { name: 'Stand selbst setzen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Stand selbst setzen' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Besichtigung/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(page.getByText('„Keine Antwort“ setzt Hefta selbst')).toBeVisible();
  await ganzesBild(page, 'stand.png');
  await page.getByRole('button', { name: /^Ergebnis/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Wie ist es ausgegangen?' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ich will nicht mehr' })).toBeVisible();
  await page.getByRole('button', { name: 'Absage' }).click();

  // Zurück im Heft, abgelegt; „Zurück“ führt nicht mehr durch Stand und Ergebnis.
  await expect(page.getByRole('img', { name: 'Stand: Abgelegt' })).toBeVisible();
  await expect(page.getByText(/^Absage am 8\.\sNov\.$/)).toBeVisible();
  await page.getByRole('button', { name: 'Wieder hervorholen' }).click();
  await expect(page.getByRole('img', { name: 'Stand: Besichtigung' })).toBeVisible();

  // E91: Termin entfernen, mit Rückfrage im Blatt. Danach „Beworben“ mit dem ersten Datum, und eine
  // Absage lässt sich weiter eintragen (Bedingung des Auftraggebers).
  await page.getByRole('link', { name: 'Termin ändern' }).click();
  await page.getByRole('button', { name: 'Termin entfernen' }).click();
  const blatt = page.getByRole('dialog', { name: 'Termin entfernen?' });
  await expect(blatt).toContainText('Das Heft steht dann wieder auf „Beworben“.');
  await expect(blatt).toContainText('Einen Eintrag in deinem Kalender löschst du dort selbst.');
  await ganzesBild(page, 'termin-entfernen.png');
  await blatt.getByRole('button', { name: 'Termin entfernen' }).click();
  await expect(page.getByRole('img', { name: 'Stand: Beworben' })).toBeVisible();
  await expect(page.getByText(/^Beworben am 5\.\sNov\., seit 3 Tagen$/)).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/\/termin$/);
  await page.goForward();
  await page.getByRole('link', { name: 'Stand selbst setzen' }).click();
  await expect(page.getByRole('button', { name: /^Beworben/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await page.getByRole('button', { name: /^Ergebnis/ }).click();
  await page.getByRole('button', { name: 'Absage' }).click();
  await expect(page.getByRole('img', { name: 'Stand: Abgelegt' })).toBeVisible();

  // „Gemerkt“ nimmt Termin und Bewerbung zurück.
  await page.getByRole('link', { name: 'Stand selbst setzen' }).click();
  await page.getByRole('button', { name: /^Gemerkt/ }).click();
  await expect(page.getByRole('img', { name: 'Stand: Gemerkt' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Termin ändern' })).toHaveCount(0);
  await page.goBack();
  await expect(page).not.toHaveURL(/\/stand$/);
});

test('Besichtigung vorbei: Ergebnis direkt im Heft (Zeile 9)', async ({ page }) => {
  await haushaltMitMax(page);
  await hefteAnlegen(page, [
    heft('vorbei', 'Altbau am Kanal', {
      beworben: { am: tag(-9), weg: 'mail', sicher: true },
      termin: { am: tag(-2, 17), ort: '', treffpunkt: '' },
    }),
  ]);
  await heftOeffnen(page, 'vorbei');
  await expect(
    page.getByText(/^Besichtigt am Fr, 6\.\sNov\. Wie ist es ausgegangen\?$/),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'In den Kalender' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Zusage' }).click();
  await expect(page.getByRole('img', { name: 'Stand: Abgelegt' })).toBeVisible();
  await expect(page.getByText(/^Zusage am 8\.\sNov\.$/)).toBeVisible();
});
