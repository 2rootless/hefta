import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from '@cantoo/pdf-lib';
import { cspMelden } from './hilfen';
import { szenarioLaden } from './szenario-laden';
import { HEUTE, SZENARIEN, datensaetze, type Szenario } from './szenarien';

// PC178, Abschnitt 3 (Befund des Auftraggebers am iPhone): Auf „Mappe“ stand oben „Noch 18 Dinge, dann seid ihr
// startklar.“ und auf dem Knopf „Weitermachen 12 von 19“. Bei 12 von 19 blieben 7. Der Knopf zeigte die Stelle in der
// Liste des Rutschs, die beim Start festgelegt wird; Übersprungenes und später Dazugekommenes bleibt dabei offen.
// Regel dieses Tests: Jede Zahl auf der Übersicht, die sagt, wie viel noch fehlt, stimmt mit dem Satz oben überein.

const ZAHLWORT: Record<string, number> = {
  ein: 1,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
};

/** Die Zahl im Satz oben (P2): als Ziffer oder als Wort. */
function zahlImSatz(satz: string): number | null {
  const ziffer = /\d+/.exec(satz);
  if (ziffer) return Number(ziffer[0]);
  for (const w of satz.toLowerCase().split(/[\s,.]+/)) if (w in ZAHLWORT) return ZAHLWORT[w]!;
  return null;
}

/**
 * Passt der Zusatz am Knopf zum Satz oben? „{n} offen“ muss gleich sein; „{x} von {y}“ heißt für Leser „x geschafft
 * von y“, also bleiben y − x, und das muss gleich sein. Ein Zusatz ohne Zahl widerspricht nicht.
 */
export function stimmig(offenOben: number, zusatz: string): boolean {
  const offen = /(\d+) offen/.exec(zusatz);
  if (offen) return Number(offen[1]) === offenOben;
  const von = /(\d+) von (\d+)/.exec(zusatz);
  if (von) return Number(von[2]) - Number(von[1]) === offenOben;
  return true;
}

async function laden(page: Page, szenario: string | Szenario) {
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
          daten: new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
        });
      await new Promise((ok) => (tx.oncomplete = ok));
    },
    {
      daten: datensaetze(
        typeof szenario === 'string' ? SZENARIEN.find((s) => s.id === szenario)! : szenario,
      ),
      pdf,
    },
  );
  await page.goto('about:blank');
  await page.goto('/#/');
  await page.locator('main h1').first().waitFor();
}

/** Satz oben und Zusatz am Hauptknopf der Übersicht. */
async function zahlen(page: Page) {
  const satz = (await page.locator('#aufgaben-titel').textContent())!.replace(/\s+/g, ' ').trim();
  const knopf = page.getByRole('link', { name: /^(Weitermachen|Unterlagen hinzufügen)/ }).first();
  const zusatz = (await knopf.textContent())!.replace(/\s+/g, ' ').trim();
  return { satz, offen: zahlImSatz(satz), zusatz };
}

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
  await page.clock.setFixedTime(HEUTE);
});

test('PC178: Nach Überspringen im Rutsch passt die Zahl am Knopf zum Satz oben', async ({
  page,
}) => {
  await laden(page, '02-neustart');
  const vorher = await zahlen(page);
  expect(vorher.offen, vorher.satz).not.toBeNull();
  expect(stimmig(vorher.offen!, vorher.zusatz), `${vorher.satz} | ${vorher.zusatz}`).toBe(true);

  // Wie am iPhone: in den Rutsch, drei Unterlagen überspringen, Pause.
  await page
    .getByRole('link', { name: /^Unterlagen hinzufügen/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Überspringen' }).click();
  await page.getByRole('link', { name: 'Pause' }).click();
  await expect(page.getByRole('link', { name: /^Weitermachen/ })).toBeVisible();

  const nachher = await zahlen(page);
  // Übersprungen heißt nicht erledigt: oben steht dieselbe Zahl.
  expect(nachher.offen).toBe(vorher.offen);
  expect(stimmig(nachher.offen!, nachher.zusatz), `${nachher.satz} | ${nachher.zusatz}`).toBe(true);
});

test('PC178 Gegenprobe: abweichende Zahlen ohne erkennbaren Grund werden rot', () => {
  // Der Befund vom iPhone
  expect(stimmig(18, 'Weitermachen 12 von 19')).toBe(false);
  expect(stimmig(18, 'Weitermachen 17 offen')).toBe(false);
  // Was passt
  expect(stimmig(18, 'Weitermachen 18 offen')).toBe(true);
  expect(stimmig(7, 'Weitermachen 12 von 19')).toBe(true);
  expect(zahlImSatz('Noch 18 Dinge, dann seid ihr startklar.')).toBe(18);
  expect(zahlImSatz('Ein Ding fehlt noch, dann seid ihr startklar.')).toBe(1);
  expect(zahlImSatz('Zwölf Dinge fehlen noch, dann seid ihr startklar.')).toBe(12);
});

test('DP114: nach Pause mit zwei übersprungenen Unterlagen „Weitermachen · {n} offen“, vorgelesen mit der Zahl in Worten', async ({
  page,
}) => {
  await laden(page, '02-neustart');
  const vorher = await zahlen(page);
  await page
    .getByRole('link', { name: /^Unterlagen hinzufügen/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Überspringen' }).click();
  await page.getByRole('link', { name: 'Pause' }).click();
  const knopf = page.getByRole('link', { name: /^Weitermachen/ });
  await expect(knopf).toBeVisible();
  const nachher = await zahlen(page);
  expect(nachher.offen).toBe(vorher.offen);
  expect(stimmig(nachher.offen!, nachher.zusatz)).toBe(true);
  // Sichtbar „{n} offen“, nie die Stelle im Rutsch.
  await expect(knopf.locator('small')).toHaveText(`${nachher.offen} offen`);
  expect(nachher.zusatz).not.toMatch(/\d+ von \d+/);
  // Vorgelesen „Weitermachen, neun offen“: die Zahl in Worten, wie im Satz oben.
  const wort = Object.entries(ZAHLWORT).find(([, z]) => z === nachher.offen)?.[0];
  await expect(knopf).toHaveAccessibleName(`Weitermachen, ${wort} offen`);
});

test('DP114 Regel 4: bei 0 offen gibt es kein „Weitermachen“, auch wenn ein Rutsch pausiert ist', async ({
  page,
}) => {
  // Alles ist da, aber ein Rutsch aus früherer Zeit steht noch pausiert bei Stelle 2 von 3.
  const fertig = SZENARIEN.find((s) => s.id === '04-fertig')!;
  await szenarioLaden(
    page,
    {
      ...fertig,
      rutsch: {
        posten: [
          [0, 'gehaltsnachweis'],
          [0, 'bonitaet'],
          [1, 'bonitaet'],
        ],
        index: 1,
        erledigt: 1,
      },
    },
    '/',
  );
  await expect(page.locator('#aufgaben-titel')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Weitermachen/ })).toHaveCount(0);
});
