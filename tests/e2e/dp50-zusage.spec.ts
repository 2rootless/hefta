import { stimmungsTexte } from './stimmung-muster';
import { expect, test, type Page } from '@playwright/test';
import { hefteAnlegen } from './hefte-hilfen';
import { szenarioLaden } from './szenario-laden';

// DP50 Punkt 13 (Z2), mit DP109: Die Zusage im Heft nimmt den Ton von „passt“ an. „Zusage“ (DP109), der Glückwunsch mit
// Namen, Datum und Wohnung, grau „Das Heft bleibt hier …“. „Jetzt dran“ zeigt nur, was offen ist:
// Mietrückstände, solange eine Person im Vertrag sie nicht beantwortet hat, und andere Hefte im Spiel.
// „Ausweis bereitlegen“ gibt es nicht.

const ALT = '2026-11-01T10:00:00.000Z';
const leer = {
  beworben: null,
  gefragtAm: null,
  termin: null,
  ergebnis: null,
  loeschbitteAm: null,
  nachgefasstAm: null,
  abgelegtAm: null,
};
const heft = (id: string, adresse: string, ereignisse: Record<string, unknown> = {}) => ({
  id,
  createdAt: ALT,
  updatedAt: ALT,
  haushaltId: null,
  adresse,
  link: null,
  quelle: '',
  inseratText: null,
  kennung: `k-${id}`,
  ereignisse: { ...leer, ...ereignisse },
  notiz: '',
  angaben: { titel: 'Altbau mit Balkon', stadtteil: null, warm: 1240 },
});
const ZUSAGE = {
  beworben: { am: '2026-11-03T10:00:00.000Z', weg: 'mail', sicher: true },
  ergebnis: { art: 'zusage', am: '2026-11-16T10:00:00.000Z' },
};

async function laden(page: Page, szenario: string, hefte: unknown[]) {
  await szenarioLaden(page, szenario, '/wohnungen');
  await hefteAnlegen(page, hefte);
  await page.goto('/__leer');
  await page.goto('/#/heft/z');
  await page.locator('main h1').first().waitFor();
}

/** Farbe eines Tokens, wie der Browser sie ausrechnet. */
const token = (page: Page, name: string, eigenschaft: 'color' | 'backgroundColor') =>
  page.evaluate(
    ({ name, eigenschaft }) => {
      const p = document.createElement('p');
      p.style.setProperty(eigenschaft === 'color' ? 'color' : 'background-color', `var(${name})`);
      document.querySelector('.stand')!.append(p);
      const wert = getComputedStyle(p)[eigenschaft];
      p.remove();
      return wert;
    },
    { name, eigenschaft },
  );

test('Z1: Zugesagt im Ton von „passt“, Glückwunsch, „Jetzt dran“ mit Mietrückständen und anderen Heften', async ({
  page,
}) => {
  await laden(page, '02-neustart', [
    heft('z', 'Lindenring 3\n20259 Hamburg', ZUSAGE),
    heft('a', 'Lindenring 8\n20259 Hamburg'),
    heft('b', 'Musterweg 7\n20259 Hamburg'),
  ]);
  const stand = page.locator('section.stand');
  await expect(stand.getByRole('heading', { name: 'Zusage' })).toBeVisible();
  // DP109: Anfang aus P9 mit den Rufnamen im Vertrag, fest der Tag aus „Zusage am“ und die Wohnung.
  const satz = (await stand.locator('p.satz').first().innerText()).trim().replace(/\u00a0/g, ' ');
  expect(
    stimmungsTexte('P9', { teil: 'satz' }).map(
      (p) =>
        `${p.replace('{namen}', 'Max und Lea')} Am 16. November kam die Zusage für die Wohnung Lindenring 3.`,
    ),
  ).toContain(satz);
  await expect(
    stand.getByText('Das Heft bleibt hier, bis der Vertrag unterschrieben ist.'),
  ).toBeVisible();
  await expect(stand.getByText('Jetzt dran', { exact: true })).toBeVisible();
  await expect(stand.getByRole('link', { name: /^Mietrückstände beantworten/ })).toHaveAttribute(
    'href',
    /#\/selbstauskunft\//,
  );
  const andere = stand.getByRole('link', { name: /^Andere Hefte ablegen/ });
  await expect(andere).toContainText('Zwei Wohnungen sind noch im Spiel.');
  await expect(andere).toHaveAttribute('href', '#/wohnungen');
  await expect(page.getByText(/Ausweis/)).toHaveCount(0);
  await expect(stand.getByRole('button', { name: '‹ Doch noch offen' })).toBeVisible();

  // Ton: Fläche und Titel in „passt“.
  expect(await stand.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
    await token(page, '--passt', 'backgroundColor'),
  );
  expect(
    await stand.getByRole('heading', { name: 'Zusage' }).evaluate((e) => getComputedStyle(e).color),
  ).toBe(await token(page, '--passt-text', 'color'));

  // Gegenprobe: Ein Heft ohne Zusage bleibt auf der Fläche der Karten.
  await page.goto('/#/heft/a');
  await page.locator('section.stand').waitFor();
  expect(
    await page.locator('section.stand').evaluate((e) => getComputedStyle(e).backgroundColor),
  ).not.toBe(await token(page, '--passt', 'backgroundColor'));
});

test('Z3: Nichts mehr offen: kein „Jetzt dran“; 320 px mit 130 %: unter der Linie nur „Ergebnis“', async ({
  page,
}) => {
  // 04-fertig: Alle im Vertrag haben die Frage beantwortet; kein anderes Heft.
  await laden(page, '04-fertig', [heft('z', 'Lindenring 3\n20259 Hamburg', ZUSAGE)]);
  const stand = page.locator('section.stand');
  await expect(stand.getByRole('heading', { name: 'Zusage' })).toBeVisible();
  await expect(stand.getByText('Jetzt dran', { exact: true })).toHaveCount(0);
  await expect(stand.getByRole('link')).toHaveCount(0);

  await page.setViewportSize({ width: 246, height: 437 });
  const sichtbar = await stand
    .locator('.ort small')
    .evaluateAll((s) =>
      s.filter((e) => getComputedStyle(e).visibility !== 'hidden').map((e) => e.textContent),
    );
  expect(sichtbar).toEqual(['Ergebnis']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});
