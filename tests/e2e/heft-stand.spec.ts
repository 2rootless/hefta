import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { ganzesBild } from './hefte-hilfen';

// Zeile 9: Termin eintragen und ändern, „In den Kalender“ (im Browser eine .ics-Datei), die Antworten im
// Stand (DP21) und „Doch noch offen“. Die Hefte legt der Test direkt in die Datenbank.

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

test('Termin eintragen, in den Kalender, ändern, Absage und doch noch offen (Zeile 9, DP21)', async ({
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
  await expect(page.locator('header.bar').getByRole('link')).toContainText('Wohnungen');

  const stand = (name: RegExp) => page.getByRole('region', { name });
  await expect(stand(/^Stand: Beworben\. Beworben am 5\.\sNov\.$/)).toBeVisible();
  await expect(
    page.getByText(/^Seit 3 Tagen\. Meldet sich drei Wochen lang niemand/),
  ).toBeVisible();
  await expect(page.getByText('Hat sich jemand gemeldet?')).toBeVisible();
  await page.getByRole('link', { name: /^Einladung zur Besichtigung/ }).click();

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

  // Zurück im Heft: Besichtigung mit der Termin-Karte im Stand (DP21).
  const termin = stand(/^Stand: Besichtigung\. Besichtigung/);
  await expect(termin).toBeVisible();
  await expect(termin.locator('.karte')).toContainText('Klingeln bei Okafor');
  await expect(termin.locator('.karte')).toContainText('17:30');
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
  await expect(
    stand(/^Stand: Besichtigung\. Besichtigung am Fr\., 20\.\sNov\., 17:30\sUhr$/),
  ).toBeVisible();

  // Absage aus dem Stand: abgelegt; „Doch noch offen“ holt den Termin zurück (DP21 statt „Stand
  // selbst setzen“ und der Seite Ergebnis).
  await expect(page.getByText('Kommt etwas dazwischen?')).toBeVisible();
  await page.getByRole('button', { name: /^Absage/ }).click();
  await expect(stand(/^Stand: Ergebnis\. Absage$/)).toBeVisible();
  await expect(page.getByText(/^Das Heft liegt jetzt bei den abgelegten\./)).toBeVisible();
  await page.getByRole('button', { name: '‹ Doch noch offen' }).click();
  await expect(termin).toBeVisible();

  // E91: Termin entfernen, mit Rückfrage im Blatt. Danach „Beworben“ mit dem ersten Datum, und eine
  // Absage lässt sich weiter eintragen (Bedingung des Auftraggebers).
  await page.getByRole('link', { name: 'Termin ändern' }).click();
  await page.getByRole('button', { name: 'Termin entfernen' }).click();
  const blatt = page.getByRole('dialog', { name: 'Termin entfernen?' });
  await expect(blatt).toContainText('Das Heft steht dann wieder auf „Beworben“.');
  await expect(blatt).toContainText('Einen Eintrag in deinem Kalender löschst du dort selbst.');
  await ganzesBild(page, 'termin-entfernen.png');
  await blatt.getByRole('button', { name: 'Termin entfernen' }).click();
  await expect(stand(/^Stand: Beworben\. Beworben am 5\.\sNov\.$/)).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/\/termin$/);
  await page.goForward();
  await page.getByRole('button', { name: /^Absage/ }).click();
  await expect(stand(/^Stand: Ergebnis\. Absage$/)).toBeVisible();

  // Zurück bis „Gemerkt“: Termin und Bewerbung sind weg.
  await page.getByRole('button', { name: '‹ Doch noch offen' }).click();
  await expect(stand(/^Stand: Beworben\. Beworben am 5\.\sNov\.$/)).toBeVisible();
  await page.getByRole('button', { name: '‹ Doch noch nicht beworben' }).click();
  await expect(stand(/^Stand: Gemerkt\. Gemerkt$/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Termin ändern' })).toHaveCount(0);
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
    page.getByRole('region', { name: /^Stand: Besichtigung\. Besichtigt am 6\.\sNov\.$/ }),
  ).toBeVisible();
  await expect(page.getByText('Wie ist es ausgegangen?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'In den Kalender' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Zusage/ }).click();
  await expect(page.getByRole('region', { name: /^Stand: Ergebnis\. Zusage$/ })).toBeVisible();
  await expect(page.getByText(/^Glückwunsch!/)).toBeVisible();
});

test('Termin entfernen ohne Kalender: kein Satz zum Kalender (Planung 12t)', async ({ page }) => {
  await haushaltMitMax(page);
  await hefteAnlegen(page, [
    heft('ohnekal', 'Altbau am Kanal', {
      beworben: { am: tag(-9), weg: 'mail', sicher: true },
      termin: { am: tag(2, 17), ort: '', treffpunkt: '' },
    }),
  ]);
  await heftOeffnen(page, 'ohnekal');
  await page.getByRole('link', { name: 'Termin ändern' }).click();
  await page.getByRole('button', { name: 'Termin entfernen' }).click();
  const blatt = page.getByRole('dialog', { name: 'Termin entfernen?' });
  await expect(blatt.locator('p')).toHaveText('Das Heft steht dann wieder auf „Beworben“.');
});

test('Fragen für die Besichtigung: weglassen, abhaken, Antwort, eigene Frage (E52)', async ({
  page,
}) => {
  await haushaltMitMax(page);
  const mitTermin = { termin: { am: tag(2, 17), ort: '', treffpunkt: '' } };
  const eins = heft('fragen1', 'Zwei Zimmer am Park', mitTermin);
  eins.angaben = { ...eins.angaben, warm: 1000, kaution: 2400 } as typeof eins.angaben;
  await hefteAnlegen(page, [eins, heft('fragen2', 'Altbau am Kanal', mitTermin)]);
  await heftOeffnen(page, 'fragen1');

  const fragen = page.getByRole('region', { name: /Fragen für die Besichtigung/ });
  await expect(fragen).toContainText('0 von 9');
  await expect(fragen).toContainText(
    'Nicht in der Liste, weil das Inserat es schon sagt: Heizung, Kaution.',
  );
  // Allein: „von mir“; die Frage an den Vermieter siezt.
  await expect(fragen).toContainText(
    'Bis wann entscheiden Sie, und was brauchen Sie noch von mir?',
  );
  await fragen.getByRole('checkbox', { name: /Keller, Fahrradraum/ }).click();
  await expect(fragen).toContainText('1 von 9');

  // Antwort notieren: gilt dann als abgehakt.
  await fragen.getByRole('button', { name: 'Antwort notieren' }).first().click();
  const antwort = fragen.getByRole('textbox', { name: /Antwort zu: Gibt es Mängel/ });
  await antwort.fill('Bad alt, kein Schimmel');
  await antwort.blur();
  await expect(
    fragen.getByRole('button', { name: 'Antwort ändern: Bad alt, kein Schimmel' }),
  ).toBeVisible();
  await expect(fragen).toContainText('2 von 9');

  // Eigene Frage: am Ende, mit Etikett, und im nächsten Heft wieder da.
  await fragen.getByRole('button', { name: 'Eigene Frage' }).click();
  await fragen.getByRole('textbox', { name: 'Eigene Frage' }).fill('Wo stehen die Mülltonnen');
  await fragen.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(fragen.getByRole('checkbox', { name: 'Wo stehen die Mülltonnen?' })).toBeVisible();
  await expect(fragen).toContainText('eigene Frage');
  await expect(fragen).toContainText('2 von 10');
  await ganzesBild(page, 'fragen.png');

  await page.reload();
  await expect(fragen).toContainText('2 von 10');
  await heftOeffnen(page, 'fragen2');
  // Das zweite Heft nennt eine Warmmiete, aber keine Kaution: zehn plus die eigene Frage.
  await expect(fragen).toContainText('0 von 11');
  await expect(fragen.getByRole('checkbox', { name: 'Wo stehen die Mülltonnen?' })).toBeVisible();
});

test('Terminkarte nach B25 n1: 15 Fälle, Reiter, Satz, Band, immer gleich hoch (E92)', async ({
  page,
}) => {
  // Do, 12. Nov. 2026, 9 Uhr: die 15 Fälle aus build_b25_n1.py, dazu Sonntag auf Sonntag (Planung 12w).
  await page.clock.setFixedTime(new Date(2026, 10, 12, 9, 0));
  await haushaltMitMax(page);
  const am = (tag: number, monat = 10, jahr = 2026, stunde = 17, minute = 30) =>
    new Date(jahr, monat, tag, stunde, minute).toISOString();
  const LANG = {
    adresse: 'Hinterhaus, Seitenflügel links, 4. OG rechts\n20251 Hoheluft-Ost, nahe Isebekkanal',
    treff:
      'Herr Wojciechowski von der Hausverwaltung wartet am Hintereingang zum Hof; bitte klingeln bei Hausmeister.',
  };
  type Fall = [string, string, string, string, { adresse?: string; treff?: string }?];
  const faelle: Fall[] = [
    ['heute', am(12), 'heute', 'heute, 17:30'],
    ['heute-vorbei', am(12, 10, 2026, 8, 0), 'vorbei', 'war heute, 08:00'],
    ['morgen', am(13), 'morgen', 'morgen, 17:30'],
    ['sonntag', am(15), 'diese Woche', 'Sonntag, 17:30'],
    ['montag', am(16), 'nächste Woche', 'Montag nächster Woche, 17:30'],
    ['dienstag', am(17), 'nächste Woche', 'Dienstag nächster Woche, 17:30'],
    ['drei', am(3, 11), 'in 3 Wochen', 'Do, 3. Dez., 17:30'],
    ['sechs', am(24, 11), 'im Dezember', 'Do, 24. Dez., 17:30'],
    ['zehn', am(23, 8, 2027), 'im September', 'Do, 23. Sept., 17:30'],
    ['dreizehn', am(9, 11, 2027), 'im Dezember 2027', 'Do, 9. Dez. 2027, 17:30'],
    ['lang', am(17), 'nächste Woche', 'Dienstag nächster Woche, 17:30', LANG],
    ['ohne', am(13), 'morgen', 'morgen, 17:30', { treff: '' }],
  ];
  // Seit DP21 steht die Karte nur noch oben in „Wohnungen“, für den nächsten Termin; im Heft zeigt der
  // Stand den Termin. Darum liegt je Fall genau ein Heft in der Datenbank. Vergangene Termine zeigt die
  // Liste nicht als Karte.
  const nurDieses = async (h: unknown) => {
    await page.evaluate(
      () =>
        new Promise<void>((fertig, fehler) => {
          const r = indexedDB.open('hefta');
          r.onsuccess = () => {
            const tx = r.result.transaction('hefte', 'readwrite');
            tx.objectStore('hefte').clear();
            tx.oncomplete = () => {
              r.result.close();
              fertig();
            };
            tx.onerror = () => fehler(tx.error);
          };
          r.onerror = () => fehler(r.error);
        }),
    );
    await hefteAnlegen(page, [h]);
  };
  const fall = (id: string, wann: string, extra?: { adresse?: string; treff?: string }) => ({
    ...heft(id, `Fall ${id}`, {
      termin: { am: wann, ort: '', treffpunkt: extra?.treff ?? 'Klingeln' },
    }),
    // Die Adresse gehört ans Heft, nicht zu den Ereignissen.
    ...(extra?.adresse ? { adresse: extra.adresse } : {}),
  });
  const hoehen = new Set<number>();
  const pruefen = async (id: string, reiter: string, satz: string, luecke: boolean) => {
    await page.goto('/#/wohnungen');
    await page.reload();
    // Der Name als Satz nach wortlaute-B25.md; das Datum trägt ein geschütztes Leerzeichen.
    const karte = page.getByRole('link', {
      name: `Besichtigung ${satz}, Fall ${id}`,
      exact: true,
    });
    await expect(karte).toBeVisible();
    await expect(karte.locator('.reiter')).toHaveText(reiter);
    // K6: genau ein Termintag und ein heute im Band, Lücke nur bei Abstand.
    await expect(karte.locator('.tg.termin')).toHaveCount(1);
    await expect(karte.locator('.tg.heute')).toHaveCount(1);
    await expect(karte.locator('.za.nach-luecke')).toHaveCount(luecke ? 1 : 0);
    // K3: die Uhrzeit in einer Zeile; K2: nichts ragt aus der Karte.
    const zeit = (await karte.locator('.rel').boundingBox())!;
    expect(zeit.height).toBeLessThan(40);
    const box = (await karte.boundingBox())!;
    for (const teil of ['.ti', '.ad', '.tr', '.ba'])
      expect((await karte.locator(teil).boundingBox())!.x + 1).toBeGreaterThan(box.x);
    hoehen.add(Math.round(box.height));
    return karte;
  };
  for (const [id, wann, reiter, satz, extra] of faelle) {
    await nurDieses(fall(id, wann, extra));
    await pruefen(id, reiter, satz, ['drei', 'sechs', 'zehn', 'dreizehn'].includes(id));
    if (id === 'heute') await ganzesBild(page, 'karte-heute.png');
    if (id === 'morgen') await ganzesBild(page, 'karte-morgen.png');
    if (id === 'lang') await ganzesBild(page, 'karte-lang.png');
  }
  // Heute Sonntag: Montag ist „morgen“, der Sonntag darauf „nächste Woche“.
  await page.clock.setFixedTime(new Date(2026, 10, 15, 9, 0));
  await nurDieses(fall('so-mo', am(16)));
  await pruefen('so-mo', 'morgen', 'morgen, 17:30', false);
  await nurDieses(fall('so-so', am(22)));
  await pruefen('so-so', 'nächste Woche', 'Sonntag nächster Woche, 17:30', false);
  // K1: alle Karten gleich hoch, auch mit langen Angaben und ohne Treffpunkt.
  expect([...hoehen]).toHaveLength(1);
});

test('Fragen ausblenden: nur hier, auch in neuen Heften, Rückgängig, wieder zeigen (E92)', async ({
  page,
}) => {
  await haushaltMitMax(page);
  const mitTermin = { termin: { am: tag(2, 17), ort: '', treffpunkt: '' } };
  await hefteAnlegen(page, [heft('aus1', 'Zwei Zimmer am Park', mitTermin)]);
  await heftOeffnen(page, 'aus1');
  const fragen = page.getByRole('region', { name: /Fragen für die Besichtigung/ });
  const zeile = (text: RegExp) =>
    fragen.locator('.zeile').filter({ has: page.getByRole('checkbox', { name: text }) });
  const menue = async (text: RegExp) =>
    zeile(text).getByRole('button', { name: 'Mehr zu dieser Frage' }).click();
  await expect(fragen).toContainText('0 von 10');

  // Nur in diesem Heft, mit Rückgängig.
  await menue(/Keller, Fahrradraum/);
  await page.getByRole('menuitem', { name: 'Nur in diesem Heft ausblenden' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'In diesem Heft ausgeblendet' }),
  ).toBeVisible();
  await expect(fragen).toContainText('0 von 9');
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(fragen).toContainText('0 von 10');
  await menue(/Keller, Fahrradraum/);
  await page.getByRole('menuitem', { name: 'Nur in diesem Heft ausblenden' }).click();

  // Auch in neuen Heften.
  await menue(/Internetanschluss/);
  await page.getByRole('menuitem', { name: 'Ausblenden, auch in neuen Heften' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Ausgeblendet, auch in neuen Heften' }),
  ).toBeVisible();
  await expect(fragen).toContainText('0 von 8');

  // Beantwortet: bleibt hier stehen, „nur hier“ gibt es dann nicht.
  await fragen.getByRole('checkbox', { name: /Mängel, Feuchtigkeit/ }).click();
  await menue(/Mängel, Feuchtigkeit/);
  await expect(page.getByRole('menuitem', { name: 'Nur in diesem Heft ausblenden' })).toHaveCount(
    0,
  );
  // Design (nach B25 n1): Der Eintrag sagt genau, was passiert.
  await page.getByRole('menuitem', { name: 'Für neue Hefte ausblenden' }).click();
  await expect(fragen.getByRole('checkbox', { name: /Mängel, Feuchtigkeit/ })).toBeVisible();
  await expect(fragen).toContainText('1 von 8');

  // Die Meldung geht nach etwa 6 Sekunden von selbst (B25 n1), nicht früher.
  const meldung = page.getByRole('status').filter({ hasText: 'Für neue Hefte ausgeblendet' });
  await page.waitForTimeout(4000);
  await expect(meldung).toBeVisible();
  await expect(meldung).toBeHidden({ timeout: 4000 });

  // Am Ende der Liste: wieder zeigen.
  await fragen.getByRole('button', { name: '2 ausgeblendete Fragen wieder zeigen' }).click();
  await expect(
    fragen.locator('.versteckt li').filter({ hasText: 'Internetanschluss' }),
  ).toContainText('Auch in neuen Heften ausgeblendet');
  await ganzesBild(page, 'fragen-ausgeblendet.png');
  await fragen.getByRole('button', { name: /Wieder zeigen: Gibt es Keller/ }).click();
  await expect(fragen).toContainText('1 von 9');
  await expect(
    fragen.getByRole('button', { name: 'Eine ausgeblendete Frage wieder zeigen' }),
  ).toBeVisible();

  // Ein neues Heft danach: Internet und Mängel fehlen, Keller ist da. Ein älteres bleibt unverändert.
  await hefteAnlegen(page, [
    { ...heft('aus2', 'Altbau am Kanal', mitTermin), createdAt: tag(1), updatedAt: tag(1) },
    heft('aus3', 'Dachgeschoss', mitTermin),
  ]);
  await heftOeffnen(page, 'aus2');
  await expect(fragen.getByRole('checkbox', { name: /Internetanschluss/ })).toHaveCount(0);
  await expect(fragen.getByRole('checkbox', { name: /Mängel, Feuchtigkeit/ })).toHaveCount(0);
  await expect(fragen.getByRole('checkbox', { name: /Keller, Fahrradraum/ })).toBeVisible();
  await expect(fragen).toContainText('0 von 8');
  await heftOeffnen(page, 'aus3');
  await expect(fragen).toContainText('0 von 10');

  // Eigene Frage: bearbeiten und entfernen, mit Rückgängig.
  await fragen.getByRole('button', { name: 'Eigene Frage' }).click();
  await fragen.getByRole('textbox', { name: 'Eigene Frage' }).fill('Wo stehen die Mülltonnen');
  await fragen.getByRole('button', { name: 'Hinzufügen' }).click();
  await menue(/Mülltonnen/);
  await page.getByRole('menuitem', { name: 'Bearbeiten' }).click();
  await fragen.getByRole('textbox', { name: 'Frage bearbeiten' }).fill('Wo stehen die Fahrräder');
  await fragen.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(fragen.getByRole('checkbox', { name: 'Wo stehen die Fahrräder?' })).toBeVisible();
  await menue(/Fahrräder/);
  await page.getByRole('menuitem', { name: 'Frage entfernen' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Frage entfernt' })).toBeVisible();
  await expect(fragen.getByRole('checkbox', { name: /Fahrräder/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(fragen.getByRole('checkbox', { name: 'Wo stehen die Fahrräder?' })).toBeVisible();
  await menue(/Fahrräder/);
  await page.getByRole('menuitem', { name: 'Frage entfernen' }).click();
  await expect(fragen.getByRole('checkbox', { name: /Fahrräder/ })).toHaveCount(0);
  // Auch in den anderen Heften weg.
  await heftOeffnen(page, 'aus1');
  await expect(fragen.getByRole('checkbox', { name: /Fahrräder/ })).toHaveCount(0);
});
