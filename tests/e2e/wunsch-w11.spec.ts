import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { expect, test, type Page } from '@playwright/test';
import { anfragenSammeln, verboteneAnfragen } from './dienst-pruefen';
import { HEUTE, SZENARIEN, datensaetze } from './szenarien';

// wunsch-W11 (Wunschliste Fassung 16, E145, „Daten auf Hefta-Art“): Keine Anfrage an einen Dienst enthält
// Name, Mail, Telefon, Adresse oder Unterlagen. In der App ist der einzige Dienst bisher die Rückmeldung
// (E54, E57); später kommen der Dienst für Besichtigungszeiten (DP51) und andere dazu. Der Test geht mit
// einem Haushalt voller Musterdaten durch die App, schickt eine Rückmeldung und durchsucht jede Anfrage.
// Den Teil „ohne Zustimmung kein Speicher“ prüft wunsch-W11 auf der Vermieterseite.

// Ohne Service Worker, damit page.route die Rückmeldung auch in WebKit sieht (wie rueckmeldung-fragen).
test.use({ serviceWorkers: 'block' });

const MERKWORT = 'Unterlagentext-W11-4711';
const KONTAKT = { telefon: '0171 3920042', email: 'max.mustermann@example.com' };
/** Was nie hinausgehen darf: Name, Mail, Telefon, Adresse und ein Wort aus einer Unterlage (W7: Musterdaten). */
const VERBOTEN = [
  'Mustermann',
  KONTAKT.email,
  KONTAKT.telefon,
  '3920042',
  'Lindenring',
  '20259',
  MERKWORT,
];
const HEFT = {
  id: 'w11',
  createdAt: HEUTE.toISOString(),
  updatedAt: HEUTE.toISOString(),
  haushaltId: 'h-01-standard',
  adresse: 'Lindenring 3\n20259 Hamburg',
  link: 'https://www.example.org/wohnung/3',
  quelle: '',
  inseratText: null,
  kennung: 'k-w11',
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
  einzug: '2027-01-01',
  angaben: { titel: 'Altbau mit Garten', stadtteil: 'Eimsbüttel', warm: 1240, zimmer: 3 },
};

/** Musterhaushalt 01 mit Kontakt bei Max, einem Heft und einer Unterlage, die das Merkwort trägt. */
async function laden(page: Page) {
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText(MERKWORT, { x: 60, y: 700, size: 18, font: schrift });
  const pdf = [...(await doc.save())];
  const daten = datensaetze(SZENARIEN.find((s) => s.id === '01-standard')!) as unknown as Record<
    string,
    object[]
  >;
  daten.personen = daten.personen!.map((p, i) => (i === 0 ? { ...p, kontakt: KONTAKT } : p));
  daten.hefte = [HEFT];
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
        for (const d of liste) tx.objectStore(ort).put(d);
      for (const v of (daten as unknown as { versionen: { original: string }[] }).versionen)
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
    { daten, pdf },
  );
  await page.goto('about:blank');
}

/** Stellt den Empfang der Rückmeldung nach und zählt, was ankommt. */
async function empfang(page: Page) {
  const angekommen: string[] = [];
  await page.route('**/api/rueckmeldung', async (route) => {
    angekommen.push(route.request().postData() ?? '');
    await route.fulfill({ status: 204 });
  });
  return angekommen;
}

test.beforeEach(async ({ page }) => {
  // PC23 A3: Ohne deployten Empfang zeigt Hefta die Fragen nicht; der Test schaltet ihn an.
  await page.addInitScript(() => {
    (globalThis as { __heftaEmpfangTest?: boolean }).__heftaEmpfangTest = true;
  });
  await page.clock.setFixedTime(HEUTE);
});

test('wunsch-W11: Keine Anfrage an einen Dienst trägt Name, Mail, Telefon, Adresse oder Unterlagen', async ({
  page,
}) => {
  const anfragen = anfragenSammeln(page);
  const angekommen = await empfang(page);
  await laden(page);
  // Durch die Flächen, auf denen die Daten stehen.
  for (const pfad of [
    '/haushalt',
    '/person/p-01-standard-0',
    '/wohnungen',
    '/heft/w11',
    '/mappe-start',
  ]) {
    await page.goto(`/#${pfad}`);
    await page.locator('main h1').first().waitFor();
  }
  await page.goto('/#/person/p-01-standard-0');
  await expect(page.locator('main')).toContainText('Max');
  // Rückmeldung schicken: der eine Dienst, den die App heute kennt.
  await page.goto('/#/einstellungen');
  await page.getByRole('tab', { name: 'App', exact: true }).click();
  await page.getByRole('button', { name: /^Rückmeldung geben/ }).click();
  await page
    .getByRole('group', { name: 'Hat euch Hefta bei der Bewerbung geholfen?' })
    .getByRole('button', { name: 'Teils' })
    .click();
  await page
    .getByRole('dialog', { name: 'Anonym an hefta.de schicken?' })
    .getByRole('button', { name: 'Abschicken' })
    .click();
  await expect.poll(() => angekommen.length).toBe(1);
  // Der Test hat wirklich einen Dienst erreicht, und nichts davon trägt Daten aus Hefta.
  expect(anfragen.some((a) => a.methode === 'POST' && a.url.endsWith('/api/rueckmeldung'))).toBe(
    true,
  );
  expect(verboteneAnfragen(anfragen, VERBOTEN)).toEqual([]);
});

test('wunsch-W11 Gegenprobe: Eine Anfrage mit Namen wird rot', async ({ page }) => {
  const anfragen = anfragenSammeln(page);
  await empfang(page);
  await laden(page);
  await page.goto('/#/haushalt');
  await page.locator('main h1').first().waitFor();
  // Absichtlich falsche Fassung: Eine Rückmeldung trägt den Namen mit.
  await page.evaluate(() =>
    fetch('/api/rueckmeldung', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ f: 'geholfen', a: 'teils', von: 'Max Mustermann' }),
    }),
  );
  expect(verboteneAnfragen(anfragen, VERBOTEN)).toEqual([
    `POST ${new URL('/api/rueckmeldung', page.url()).href}: Mustermann`,
  ]);
  // Auch URL-kodiert in der Adresse fällt es auf: die Mail und der Name darin.
  await page.evaluate(() => fetch('/api/rueckmeldung?mail=max.mustermann%40example.com'));
  const get = new URL('/api/rueckmeldung?mail=max.mustermann%40example.com', page.url()).href;
  expect(verboteneAnfragen(anfragen, VERBOTEN).slice(1)).toEqual([
    `GET ${get}: Mustermann`,
    `GET ${get}: ${KONTAKT.email}`,
  ]);
});
