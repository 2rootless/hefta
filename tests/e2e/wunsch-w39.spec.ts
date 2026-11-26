import { expect, test, type Page } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// wunsch-W39 (Fassung 26, PC130 K8): Wer eine Seite fertig macht oder schließt, landet dort, wo er sie geöffnet hat.
// Für die Selbstauskunft je Einstieg: Mappe, Personenseite und Heft, mit „Fertig“ und mit „Zurück“. Gegenprobe: Eine
// feste Zielseite (bis 2.0 immer die Personenseite) macht den Test rot. Nur Musterdaten (W7).

const MAX = 'p-04-fertig-0';

/** Ein Heft mit Zusage; die Frage zu Mietrückständen ist offen und führt in die Selbstauskunft (wie miet-frage.spec). */
async function zusageAnlegen(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((fertig, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const tx = r.result.transaction(['hefte', 'personen'], 'readwrite');
          // Max beantwortet die Frage zu Mietrückständen erst nach der Zusage: Sie ist offen.
          const personen = tx.objectStore('personen');
          const max = personen.get('p-04-fertig-0');
          max.onsuccess = () => {
            const p = max.result as { selbstauskunft: Record<string, unknown> };
            personen.put({ ...p, selbstauskunft: { ...p.selbstauskunft, mietrueckstaende: null } });
          };
          tx.objectStore('hefte').put({
            id: 'zusage',
            createdAt: '2026-11-01T10:00:00.000Z',
            updatedAt: '2026-11-10T10:00:00.000Z',
            haushaltId: null,
            adresse: 'Musterweg 7\n00100 Musterstadt',
            link: null,
            quelle: '',
            inseratText: null,
            kennung: 'k-zusage',
            ereignisse: {
              beworben: { am: '2026-11-02T10:00:00.000Z', weg: 'mail', sicher: true },
              gefragtAm: '2026-11-02T10:00:00.000Z',
              termin: null,
              ergebnis: { art: 'zusage', am: '2026-11-10T10:00:00.000Z' },
              loeschbitteAm: null,
              nachgefasstAm: null,
              abgelegtAm: null,
            },
            notiz: '',
            angaben: { titel: null, stadtteil: null, warm: null, zimmer: null, flaeche: null },
          });
          tx.oncomplete = () => {
            r.result.close();
            fertig();
          };
          tx.onerror = () => fehler(tx.error);
        };
      }),
  );
}

const fertigKnopf = (page: Page) =>
  page.locator('.leiste').getByRole('button', { name: 'Fertig', exact: true });

interface Einstieg {
  name: string;
  pfad: string;
  /** Name, der auf „Zurück“ steht. */
  zurueck: string;
  /** Öffnet von dort aus die Selbstauskunft. */
  oeffnen: (page: Page) => Promise<void>;
  /** Woran man den Einstieg erkennt. */
  da: (page: Page) => Promise<void>;
}

const EINSTIEGE: Einstieg[] = [
  {
    name: 'Mappe',
    pfad: '/',
    zurueck: 'Mappe',
    oeffnen: (page) =>
      page
        .getByRole('link', { name: /^Selbstauskunft/ })
        .first()
        .click(),
    da: (page) => expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible(),
  },
  {
    name: 'Personenseite',
    pfad: `/person/${MAX}`,
    zurueck: 'Max',
    oeffnen: (page) =>
      page
        .getByRole('link', { name: /^Selbstauskunft/ })
        .first()
        .click(),
    da: (page) => expect(page).toHaveURL(new RegExp(`#/person/${MAX}$`)),
  },
  {
    name: 'Heft',
    pfad: '/heft/zusage',
    // DP135, U11: Aus dem Heft heißt der Weg zurück „Heft“.
    zurueck: 'Heft',
    oeffnen: async (page) => {
      // Nach der Zusage fragt Hefta zuerst, ob es geholfen hat; danach steht die offene Frage da.
      const nein = page.getByRole('button', { name: 'Nein danke' });
      if (await nein.isVisible().catch(() => false)) await nein.click();
      // DP50 (Z2): Im Heft heißt der Eintrag „Mietrückstände beantworten“.
      await page.getByRole('link', { name: /^Mietrückstände beantworten/ }).click();
    },
    da: (page) => expect(page).toHaveURL(/#\/heft\/zusage$/),
  },
];

for (const e of EINSTIEGE) {
  test(`wunsch-W39: Selbstauskunft von „${e.name}“, „Fertig“ und „Zurück“ führen dorthin zurück`, async ({
    page,
  }) => {
    await szenarioLaden(page, '04-fertig', '/wohnungen');
    await zusageAnlegen(page);
    await page.goto(`/#${e.pfad}`);
    await page.reload();
    await e.da(page);

    // „Fertig“
    await e.oeffnen(page);
    await expect(page).toHaveURL(/#\/selbstauskunft\//);
    await fertigKnopf(page).click();
    await e.da(page);

    // „Zurück“, mit dem Namen des Einstiegs
    await e.oeffnen(page);
    await expect(page).toHaveURL(/#\/selbstauskunft\//);
    const zurueck = page.locator('a.zurueck');
    await expect(zurueck).toHaveText(e.zurueck);
    await zurueck.click();
    await e.da(page);
  });
}

test('wunsch-W39: direkt geöffnet (ohne Einstieg im Verlauf) führt „Fertig“ wie bisher zur Personenseite', async ({
  page,
}) => {
  await szenarioLaden(page, '04-fertig', `/selbstauskunft/${MAX}`);
  await fertigKnopf(page).click();
  await expect(page).toHaveURL(new RegExp(`#/person/${MAX}$`));
});

// Dasselbe für eine Unterlage (Gehaltsnachweise von Max): von „Mappe“ und von der Personenseite aus.
const UNTERLAGE_EINSTIEGE: [name: string, pfad: string, zurueck: string, da: RegExp][] = [
  ['Mappe', '/', 'Mappe', /#\/$/],
  ['Personenseite', `/person/${MAX}`, 'Max', new RegExp(`#/person/${MAX}$`)],
];

for (const [name, pfad, zurueck, da] of UNTERLAGE_EINSTIEGE) {
  test(`wunsch-W39: Unterlage von „${name}“, „Fertig“ und „Zurück“ führen dorthin zurück`, async ({
    page,
  }) => {
    await szenarioLaden(page, '04-fertig', pfad);
    const oeffnen = async () => {
      await page
        .getByRole('link', { name: /^Gehaltsnachweise/ })
        .first()
        .click();
      await expect(page).toHaveURL(new RegExp(`#/unterlage/${MAX}/gehaltsnachweis$`));
    };
    await oeffnen();
    await fertigKnopf(page).click();
    await expect(page).toHaveURL(da);
    await oeffnen();
    const knopf = page.locator('a.zurueck');
    await expect(knopf).toHaveText(zurueck);
    await knopf.click();
    await expect(page).toHaveURL(da);
  });
}
