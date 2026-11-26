import { expect, test, type Page } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// PC213/PC214 (E385, Weg A): Selbstauskunft und Bürgschaft im Browser sind die der App, für Personen ohne Haushalt,
// jederzeit verbindbar. Fehlerfälle je mit Gegenprobe. Namen aus der Namensliste (W40), Nummern wie im Muster.

const KOPF =
  'Gehört zu keinem Haushalt und bleibt nur in diesem Browser. Mit „In einen Haushalt übernehmen“ verbindest du sie jederzeit.';

async function oeffnen(page: Page, pfad = '/selbstauskunft') {
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  await page.goto(`/#${pfad}`);
  await page.locator('main h1').first().waitFor();
}

async function anlegen(page: Page, vor: string, nach: string) {
  await page.getByRole('textbox', { name: 'Vorname' }).last().fill(vor);
  await page.getByRole('textbox', { name: 'Nachname' }).last().fill(nach);
  await page
    .getByRole('button', { name: /^(Weiter|Weitere Person hinzufügen)$/ })
    .last()
    .click();
  await expect(page).toHaveURL(/#\/(selbstauskunft|buergschaft)\/[\w-]+/);
  await page.locator('main h1').first().waitFor();
}

/** Liest einen Ort der Datenbank. */
function lesen<T>(page: Page, ort: string): Promise<T[]> {
  return page.evaluate(
    (ort) =>
      new Promise<T[]>((fertig, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const q = r.result.transaction(ort).objectStore(ort).getAll();
          q.onsuccess = () => {
            r.result.close();
            fertig(q.result as T[]);
          };
          q.onerror = () => fehler(q.error);
        };
        r.onerror = () => fehler(r.error);
      }),
    ort,
  );
}

/** Haushalt A der Namensliste, aber ohne Haushalt: Der Datensatz wird zum Sammelplatz (fertige Angaben für PDF). */
async function haushaltAOhne(page: Page) {
  await szenarioLaden(page, 'A-namensliste', '/');
  await page.evaluate(
    () =>
      new Promise<void>((fertig) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const tx = r.result.transaction(['haushalte', 'einstellungen'], 'readwrite');
          tx.objectStore('haushalte').getAll().onsuccess = (e) => {
            for (const h of (e.target as IDBRequest<Record<string, unknown>[]>).result)
              tx.objectStore('haushalte').put({ ...h, ohneHaushalt: true, ansprechpersonId: null });
          };
          tx.oncomplete = () => {
            r.result.close();
            fertig();
          };
        };
      }),
  );
  await page.goto('/__leer');
  await page.goto('/#/selbstauskunft');
  await page.locator('main h1').first().waitFor();
}

test('Die Seite ist die der App: Lebenslage, Telefon mit Prüfung, C.4 bis C.7, „Wer einzieht“ als Zähler, Satz im Kopf', async ({
  page,
}) => {
  await oeffnen(page);
  await expect(page.getByText(KOPF)).toBeVisible();
  // Gegenprobe zu „leer gibt es ihn nicht sichtbar“: ohne Person keine Liste, nur das Formular der App.
  await expect(page.getByRole('heading', { name: 'Je Person' })).toHaveCount(0);
  // Wie in der App gehört die Lebenslage zum Anlegen (PersonFormular).
  await expect(page.locator('main')).toContainText('Angestellt');
  await anlegen(page, 'Jarne', 'Ostendorp');
  await expect(page.getByText(KOPF)).toBeVisible();
  const main = page.locator('main');
  // Später ändert man Name und Lebenslage wie in der App, nur ohne Rolle (E-Rolle).
  await page.getByRole('link', { name: 'Name und Lebenslage ändern' }).click();
  await expect(main).toContainText('Angestellt');
  await expect(page.getByText(KOPF)).toBeVisible();
  await page.goBack();
  await page.locator('main h1').first().waitFor();
  await page
    .getByRole('button', { name: /^Kontakt/ })
    .first()
    .click();
  await page
    .getByRole('textbox', { name: /Telefon/ })
    .first()
    .fill('01713920011');
  await page
    .getByRole('textbox', { name: /E-Mail/ })
    .first()
    .click();
  await expect(page.getByRole('textbox', { name: /Telefon/ }).first()).toHaveValue('0171 3920011');
  await page
    .getByRole('button', { name: /^Einkommen/ })
    .first()
    .click();
  await expect(main.getByRole('textbox', { name: /^Netto im Monat/ })).toBeVisible();
  await page
    .getByRole('button', { name: /^Fragen aus dem Musterbogen/ })
    .first()
    .click();
  await expect(main).toContainText(/nacheinander mehr als eine Monatsmiete/);
  await expect(main.getByRole('radio', { name: 'Nach der Zusage' }).first()).toBeVisible();
  // Ohne Haushalt heißt der vierte Teil „Für alle hier“ (wie die Liste).
  await page
    .getByRole('button', { name: /^Für alle hier/ })
    .first()
    .click();
  await expect(main.getByRole('group', { name: 'Erwachsene' })).toBeVisible();
  await main.getByRole('button', { name: 'Mehr: Kinder' }).click();
  await expect(main.getByRole('group', { name: 'Kinder' }).locator('b')).toHaveText('1');
  // Gegenprobe: In einem Haushalt gibt es die Zähler hier nicht, dort kommt „Wer einzieht“ aus dem Haushalt.
  await szenarioLaden(page, '04-fertig', '/selbstauskunft/p-04-fertig-0');
  await page
    .getByRole('button', { name: /^Für euren ganzen Haushalt/ })
    .first()
    .click();
  await expect(page.locator('main').getByRole('group', { name: 'Erwachsene' })).toHaveCount(0);
  await expect(page.getByText(KOPF)).toHaveCount(0);
});

test('Mehrere Personen: Liste wie in der App, PDF als eine Datei oder je Person; „du“ bleibt', async ({
  page,
}) => {
  await haushaltAOhne(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Selbst.auskünfte/);
  await expect(page.getByText(KOPF)).toBeVisible();
  for (const n of ['Jarne', 'Selin', 'Hiltrud'])
    await expect(page.locator('main')).toContainText(n);
  await expect(page.locator('main')).not.toContainText('Im Mietvertrag');
  await expect(page.getByText('Für deinen ganzen Haushalt')).toHaveCount(0);
  const eine = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF erstellen' }).click();
  expect((await eine).suggestedFilename()).toMatch(/^Selbstauskuenfte_Ostendorp_Jarne_und_/);
  await page.getByRole('radio', { name: 'Je Person eine PDF' }).check();
  const namen: string[] = [];
  page.on('download', (d) => namen.push(d.suggestedFilename()));
  await page.getByRole('button', { name: 'PDF erstellen' }).click();
  await expect.poll(() => namen.length).toBe(3);
  expect(namen.every((n) => n.startsWith('Selbstauskunft_'))).toBe(true);
});

test('In einen neuen Haushalt: alles geht mit, Farben bleiben, nichts doppelt; zweimal übernehmen ändert nichts', async ({
  page,
}) => {
  await haushaltAOhne(page);
  const vorher = (await lesen<{ personId: string; farbe: number }>(page, 'zugehoerigkeiten'))
    .map((z) => `${z.personId}:${z.farbe}`)
    .sort();
  await page.getByRole('button', { name: 'In einen Haushalt übernehmen' }).click();
  // Ohne bestehenden Haushalt gibt es keine Frage nach dem Haushalt; wer bürgt, bürgt.
  await expect(page.getByText('In welchen Haushalt?')).toHaveCount(0);
  await expect(page.getByText('Hiltrud bürgt.')).toBeVisible();
  await expect(page.locator('main')).toContainText('Es fehlt noch: Rolle von Jarne');
  for (const n of ['Jarne', 'Selin'])
    await page
      .getByRole('group', { name: `Welche Rolle hat ${n}?` })
      .getByRole('radio', { name: 'Im Mietvertrag' })
      .check();
  await page.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'gehören jetzt zu eurem Haushalt.' }),
  ).toContainText(
    'Jarne, Selin und Hiltrud gehören jetzt zu eurem Haushalt. Jarne ist jetzt Ansprechperson.',
  );
  // Nichts liegt doppelt: kein Sammelplatz mehr, dieselben drei Personen mit denselben Farben.
  const haushalte = await lesen<{ ohneHaushalt?: boolean }>(page, 'haushalte');
  expect(haushalte.filter((h) => h.ohneHaushalt)).toHaveLength(0);
  expect(haushalte).toHaveLength(1);
  expect((await lesen(page, 'personen')).length).toBe(3);
  const nachher = (await lesen<{ personId: string; farbe: number }>(page, 'zugehoerigkeiten'))
    .map((z) => `${z.personId}:${z.farbe}`)
    .sort();
  expect(nachher).toEqual(vorher);
  // Die Selbstauskunft ist wieder leer: Sie fragt, für wen sie ist.
  await expect(page.getByRole('textbox', { name: 'Vorname' })).toBeVisible();
  await page.getByRole('link', { name: 'Zum Haushalt' }).click();
  await expect(page.locator('main')).toContainText('Jarne');
});

test('Zweimal übernehmen (zweites Fenster) und Abbrechen: nichts doppelt, nichts geändert', async ({
  page,
  context,
}) => {
  await haushaltAOhne(page);
  // Abbrechen: der Kasten geht zu, alles bleibt.
  await page.getByRole('button', { name: 'In einen Haushalt übernehmen' }).click();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  expect(
    (await lesen<{ ohneHaushalt?: boolean }>(page, 'haushalte')).filter((h) => h.ohneHaushalt),
  ).toHaveLength(1);
  // Zwei Fenster öffnen den Kasten; das zweite übernimmt zuerst.
  const zweites = await context.newPage();
  await zweites.goto('/#/selbstauskunft');
  await zweites.locator('main h1').first().waitFor();
  for (const p of [page, zweites]) {
    await p.getByRole('button', { name: 'In einen Haushalt übernehmen' }).click();
    for (const n of ['Jarne', 'Selin'])
      await p
        .getByRole('group', { name: `Welche Rolle hat ${n}?` })
        .getByRole('radio', { name: 'Im Mietvertrag' })
        .check();
  }
  await zweites.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await expect(
    zweites.getByRole('status').filter({ hasText: 'jetzt zu eurem Haushalt' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await page.waitForTimeout(500);
  expect(await lesen(page, 'haushalte')).toHaveLength(1);
  expect((await lesen(page, 'personen')).length).toBe(3);
});

test('In einen bestehenden Haushalt: Wahl des Haushalts, gleicher Name, Rolle; Ansprechperson bleibt', async ({
  page,
}) => {
  await szenarioLaden(page, 'A-namensliste', '/');
  await page.goto('/#/selbstauskunft');
  await page.locator('main h1').first().waitFor();
  await anlegen(page, 'Jarne', 'Ostendorp');
  await page.goto('/#/selbstauskunft');
  await page.locator('main h1').first().waitFor();
  await page.getByRole('button', { name: 'In einen Haushalt übernehmen' }).click();
  await expect(page.locator('main')).toContainText('Es fehlt noch: Haushalt');
  // [E-Neu] (CP130): Ohne Wechseln zwischen Haushalten gibt es keinen zweiten aus dem Übernehmen.
  await expect(page.getByRole('radio', { name: 'Neuer Haushalt' })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Jarne, Selin und Hiltrud' }).check();
  await expect(
    page.getByText('In diesem Haushalt gibt es schon Jarne. Ist das dieselbe Person?'),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Ja, Angaben übernehmen' }).check();
  // Mit „Ja“ fragt der Kasten nicht nach der Rolle: Jarne hat seine schon.
  await expect(page.getByRole('group', { name: 'Welche Rolle hat Jarne?' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'zu eurem Haushalt' })).toContainText(
    'Jarne gehört jetzt zu eurem Haushalt.',
  );
  // Jarne war schon Ansprechperson: kein Satz dazu, und es gibt ihn nur einmal.
  await expect(page.getByRole('status').filter({ hasText: 'Ansprechperson' })).toHaveCount(0);
  const personen = await lesen<{ vorname: string }>(page, 'personen');
  expect(personen.filter((p) => p.vorname === 'Jarne')).toHaveLength(1);
});

test('Gegenprobe gleicher Name: „Nein, neue Person“ legt eine zweite an, mit Rolle „Zieht mit ein“', async ({
  page,
}) => {
  await szenarioLaden(page, 'A-namensliste', '/');
  await page.goto('/#/selbstauskunft');
  await page.locator('main h1').first().waitFor();
  await anlegen(page, 'Jarne', 'Ostendorp');
  await page.goto('/#/selbstauskunft');
  await page.locator('main h1').first().waitFor();
  await page.getByRole('button', { name: 'In einen Haushalt übernehmen' }).click();
  await page.getByRole('radio', { name: 'Jarne, Selin und Hiltrud' }).check();
  await page.getByRole('radio', { name: 'Nein, neue Person' }).check();
  await page
    .getByRole('group', { name: 'Welche Rolle hat Jarne?' })
    .getByRole('radio', { name: 'Zieht mit ein' })
    .check();
  await page.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'zu eurem Haushalt' })).toBeVisible();
  const personen = await lesen<{ vorname: string }>(page, 'personen');
  expect(personen.filter((p) => p.vorname === 'Jarne')).toHaveLength(2);
  const zugs = await lesen<{ ziehtMitEin?: boolean }>(page, 'zugehoerigkeiten');
  expect(zugs.filter((z) => z.ziehtMitEin)).toHaveLength(1);
});

test('Löschen, Neu laden mitten im Ausfüllen, kein Speicher frei', async ({ page }) => {
  await oeffnen(page);
  // Kein Speicher frei: nichts angelegt, die Seite sagt es.
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    (window as unknown as { altesPut: typeof put }).altesPut = put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...a: Parameters<typeof put>) {
      if (this.name === 'personen') throw new DOMException('voll', 'QuotaExceededError');
      return put.apply(this, a);
    } as typeof put;
  });
  await page.getByRole('textbox', { name: 'Vorname' }).fill('Selin');
  await page.getByRole('textbox', { name: 'Nachname' }).fill('Akgül');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Auf dem Gerät ist kaum noch Platz. Die Person ist noch nicht angelegt.',
  );
  expect(await lesen(page, 'personen')).toHaveLength(0);
  // Gegenprobe: mit Platz geht es.
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = (
      window as unknown as { altesPut: typeof IDBObjectStore.prototype.put }
    ).altesPut;
  });
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page).toHaveURL(/#\/selbstauskunft\/[\w-]+/);
  // Neu laden mitten im Ausfüllen: Was schon stand, bleibt (sofort gespeichert).
  await page
    .getByRole('button', { name: /^Kontakt/ })
    .first()
    .click();
  await page
    .getByRole('textbox', { name: /E-Mail/ })
    .first()
    .fill('selin.akguel@example.com');
  await page.waitForTimeout(700);
  await page.reload();
  await page.locator('main h1').first().waitFor();
  await page
    .getByRole('button', { name: /^Kontakt/ })
    .first()
    .click();
  await expect(page.getByRole('textbox', { name: /E-Mail/ }).first()).toHaveValue(
    'selin.akguel@example.com',
  );
  // Löschen: nach der Frage ist sie weg, und die Liste gibt es nicht mehr.
  await page.getByRole('button', { name: 'Selin löschen' }).click();
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect(page).toHaveURL(/#\/selbstauskunft$/);
  await expect(page.getByRole('textbox', { name: 'Vorname' })).toBeVisible();
  expect(await lesen(page, 'personen')).toHaveLength(0);
});

test('Bürgschaft ohne Haushalt und ohne Heft: dieselben vier Teile, Namen von Hand; übernommen erscheint sie im Heft', async ({
  page,
}) => {
  await oeffnen(page, '/buergschaft');
  await expect(page.getByText(KOPF)).toBeVisible();
  await anlegen(page, 'Hiltrud', 'Ostendorp');
  await expect(page).toHaveURL(/#\/buergschaft\/[\w-]+$/);
  await expect(page.getByText(KOPF)).toBeVisible();
  await page
    .getByRole('button', { name: /^Höchstbetrag/ })
    .first()
    .click();
  await page.locator('[data-feld="hoechstbetrag"]').fill('2400');
  await page.getByRole('radio', { name: /^Gewöhnliche/ }).click();
  await page
    .getByRole('button', { name: /^Für wen/ })
    .first()
    .click();
  await page.getByRole('textbox', { name: 'Im Mietvertrag: Person 1' }).fill('Jarne Ostendorp');
  await page.waitForTimeout(700);
  await expect(
    page.getByRole('button', { name: 'Als PDF ansehen' }).or(page.getByText('Als PDF ansehen')),
  ).toBeVisible();
  // Übernehmen: wer bürgt, bürgt; keine Frage nach der Rolle.
  await page.getByRole('button', { name: 'In einen Haushalt übernehmen' }).click();
  await expect(page.getByText('Hiltrud bürgt.')).toBeVisible();
  await page.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'zu eurem Haushalt' })).toContainText(
    'Hiltrud gehört jetzt zu eurem Haushalt.',
  );
  // Ein Heft kommt dazu: Die Bürgschaft dort zeigt den Entwurf mit Höchstbetrag.
  const personId = (await lesen<{ id: string; vorname: string }>(page, 'personen')).find(
    (p) => p.vorname === 'Hiltrud',
  )!.id;
  const haushaltId = (await lesen<{ id: string }>(page, 'haushalte'))[0]!.id;
  await page.evaluate(
    ({ haushaltId }) =>
      new Promise<void>((fertig) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const tx = r.result.transaction('hefte', 'readwrite');
          const zeit = new Date().toISOString();
          tx.objectStore('hefte').put({
            id: 'h8',
            createdAt: zeit,
            updatedAt: zeit,
            haushaltId,
            adresse: 'Lindenring 8\n00259 Musterstadt',
            link: null,
            quelle: '',
            inseratText: null,
            kennung: 'k-h8',
            ereignisse: {
              beworben: null,
              gefragtAm: null,
              termin: null,
              ergebnis: null,
              loeschbitteAm: null,
              nachgefasstAm: null,
              abgelegtAm: null,
            },
            notiz: '',
            angaben: { titel: null, stadtteil: null, warm: null },
          });
          tx.oncomplete = () => {
            r.result.close();
            fertig();
          };
        };
      }),
    { haushaltId },
  );
  await page.goto('/__leer');
  await page.goto(`/#/buergschaft/${personId}/h8`);
  await page.locator('main h1').first().waitFor();
  await page
    .getByRole('button', { name: /^Höchstbetrag/ })
    .first()
    .click();
  await expect(page.locator('[data-feld="hoechstbetrag"]')).toHaveValue('2.400');
  await expect(page.getByText(KOPF)).toHaveCount(0);
});

test('Der Sammelplatz ist nie ein Haushalt: Startseite ohne Haushalt, Backup nennt „Ohne Haushalt“', async ({
  page,
}) => {
  await oeffnen(page);
  await anlegen(page, 'Selin', 'Akgül');
  await page.goto('/#/');
  await page.locator('main h1, main h2').first().waitFor();
  await expect(page.locator('main')).not.toContainText('Selin');
  await page.goto('/#/einstellungen/backup');
  await page.locator('main h1').first().waitFor();
  await expect(page.locator('main')).toContainText('Ohne Haushalt');
  await expect(page.locator('main')).toContainText('Selin Akgül');
});
