import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { hefteAnlegen } from './hefte-hilfen';
import { stimmungsTexte } from './stimmung-muster';

// wunsch-W37 (E190, E193, PC94): Abwechslung in der Sprache.
// - Stimmungssätze wechseln einmal am Tag; am selben Tag steht überall derselbe Satz.
// - Knöpfe und feste Sätze wechseln nie.
// - Jede Fassung läuft bei 320 px mit 130 % (246 px Breite) nicht über und braucht höchstens eine Zeile mehr als
//   die Fassung von Release 2.0.
// - Das Anschreiben wechselt mit „Andere Fassung“; was jemand selbst geschrieben hat, bleibt.
// Gegenproben: Ein gewechselter Knopf, ein gewechselter fester Satz und ein Wechsel am selben Tag werden rot.

const tag = (d: number, h = 10) => new Date(2026, 10, 18 + d, h, 0);
const iso = (j: number, m: number, t: number) => new Date(j, m - 1, t, 10).toISOString();
const leer = {
  beworben: null,
  gefragtAm: null,
  termin: null,
  ergebnis: null,
  loeschbitteAm: null,
  nachgefasstAm: null,
  abgelegtAm: null,
};
const beworben = { am: iso(2026, 10, 20), weg: 'mail', sicher: true };

function heft(id: string, adresse: string, ereignisse: Record<string, unknown>) {
  return {
    id,
    createdAt: iso(2026, 11, 2),
    updatedAt: iso(2026, 11, 2),
    haushaltId: null,
    adresse: `${adresse}\n20259 Hamburg`,
    link: `https://www.example.org/wohnung/${id}`,
    quelle: '',
    inseratText: null,
    kennung: `k-${id}`,
    ereignisse: { ...leer, ...ereignisse },
    notiz: '',
    einzug: '2027-01-01',
    angaben: {
      titel: null,
      stadtteil: 'Eimsbüttel',
      warm: 1240,
      zimmer: 3,
      flaeche: 74,
      anbieter: 'Frau Hansen',
    },
  };
}

// Zustände, die an beiden Tagen gleich bleiben: gemerkt (P11), keine Antwort (P7), nachgefragt (P8), Zusage (P9).
const HEFTE = [
  heft('gemerkt', 'Lindenring 3', {}),
  heft('keine', 'Lindenring 8', { beworben }),
  heft('nachgefragt', 'Musterweg 7', { beworben, nachgefasstAm: iso(2026, 11, 12) }),
  heft('zusage', 'Beispielstraße 1', {
    beworben,
    ergebnis: { art: 'zusage', am: iso(2026, 11, 15) },
  }),
];
/** Die Straße im Kopf jedes Hefts: Erst wenn sie dasteht, gehört der Satz zu diesem Heft (WebKit ist langsamer). */
const STRASSE: Record<string, string> = {
  gemerkt: 'Lindenring 3',
  keine: 'Lindenring 8',
  nachgefragt: 'Musterweg 7',
  zusage: 'Beispielstraße 1',
};
const STAND: [string, string][] = [
  ['gemerkt', 'P11'],
  ['keine', 'P7'],
  ['nachgefragt', 'P8'],
  ['zusage', 'P9'],
];

/** Der Rufname im Muster-Haushalt: Er steht in jeder Fassung von P9 für {namen} (DP109). */
const NAME = 'Max';
const mitNamen = (p: string) => p.replace('{namen}', NAME);

/** Pool-Satz und fester Teil eines angezeigten Satzes; P9 steht vorn, alle anderen hinten. */
function zerlegen(stelle: string, text: string): { pool: string; fest: string } {
  const pool = stimmungsTexte(stelle, { teil: 'satz' })
    .map(mitNamen)
    .find((p) => (stelle === 'P9' ? text.startsWith(p) : text.endsWith(p)));
  if (!pool) return { pool: '', fest: text };
  return { pool, fest: stelle === 'P9' ? text.slice(pool.length) : text.slice(0, -pool.length) };
}

interface Blick {
  saetze: Record<string, string>;
  fest: Record<string, string>;
  knoepfe: string[];
}

async function blick(page: Page, zeit: Date): Promise<Blick> {
  await page.clock.setFixedTime(zeit);
  const saetze: Record<string, string> = {};
  const fest: Record<string, string> = {};
  const knoepfe: string[] = [];
  const merken = async (wo: string) => {
    const namen = await page
      .locator('main')
      .getByRole('button')
      .evaluateAll((b) =>
        b.map((x) => (x.getAttribute('aria-label') ?? x.textContent ?? '').trim()),
      );
    knoepfe.push(...namen.map((n) => `${wo}: ${n}`));
  };
  await page.goto('/#/wohnungen');
  await page.reload();
  await expect(page.locator('p.sub').first()).toBeVisible();
  saetze.P1 = (await page.locator('p.sub').first().innerText()).trim();
  await merken('Wohnungen');
  for (const [id, stelle] of STAND) {
    await page.evaluate((h) => (window.location.hash = h), `#/heft/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(STRASSE[id]!);
    const satz = page.locator('p.satz').first();
    await expect(satz).toBeVisible();
    const text = (await satz.innerText()).trim();
    const teile = zerlegen(stelle, text);
    saetze[stelle] = teile.pool;
    fest[stelle] = teile.fest;
    await merken(id);
  }
  await page.evaluate(() => (window.location.hash = '#/'));
  await expect(page.locator('#aufgaben-titel')).toBeVisible();
  saetze.P2 = (await page.locator('#aufgaben-titel').innerText()).trim();
  await merken('Übersicht');
  return { saetze, fest, knoepfe };
}

/** Verstöße zwischen zwei Blicken; `gleicherTag`: Dann darf kein Satz wechseln. */
function vergleichen(a: Blick, b: Blick, gleicherTag: boolean): string[] {
  const f: string[] = [];
  const knopfA = new Set(a.knoepfe);
  for (const k of b.knoepfe) if (!knopfA.has(k)) f.push(`Knopf gewechselt: ${k}`);
  for (const [stelle, text] of Object.entries(a.fest))
    if (b.fest[stelle] !== text) f.push(`fester Satz gewechselt: ${stelle}`);
  for (const [stelle, text] of Object.entries(a.saetze)) {
    if (!text) f.push(`${stelle}: kein Satz aus dem Pool`);
    if (gleicherTag && b.saetze[stelle] !== text) f.push(`Wechsel am selben Tag: ${stelle}`);
  }
  return f;
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(tag(0));
  await page.setViewportSize({ width: 390, height: 844 });
  await haushaltMitMax(page);
  await hefteAnlegen(page, HEFTE);
});

test('wunsch-W37: am selben Tag derselbe Satz, am nächsten Tag ein anderer; Knöpfe und feste Sätze bleiben; Gegenproben', async ({
  page,
}) => {
  const frueh = await blick(page, tag(0, 7));
  const spaet = await blick(page, tag(0, 22));
  const morgen = await blick(page, tag(1, 9));
  expect(Object.keys(frueh.saetze).sort()).toEqual(['P1', 'P11', 'P2', 'P7', 'P8', 'P9']);
  expect(vergleichen(frueh, spaet, true)).toEqual([]);
  expect(vergleichen(frueh, morgen, false)).toEqual([]);
  // Am nächsten Tag steht an jeder Stelle die nächste Fassung, also ein anderer Satz.
  for (const stelle of Object.keys(frueh.saetze))
    expect(morgen.saetze[stelle], stelle).not.toBe(frueh.saetze[stelle]);
  // Die festen Teile sind wörtlich wie in Release 2.0.
  // Tag und Monat hält ein geschütztes Leerzeichen zusammen (C23).
  const nb = (x: string | undefined) => (x ?? '').replace(/\u00a0/g, ' ');
  expect(nb(frueh.fest.P7)).toBe('Beworben am 20. Okt. Seit drei Wochen meldet sich niemand. ');
  expect(nb(frueh.fest.P8)).toBe('Beworben am 20. Okt. ');
  // DP109: Tag aus „Zusage am“ und die Wohnung; „Das Heft bleibt hier …“ steht leise darunter.
  expect(nb(frueh.fest.P9)).toBe(
    ' Am 15. November kam die Zusage für die Wohnung Beispielstraße 1.',
  );
  expect(nb(frueh.fest.P11)).toBe('Seit 2. Nov. · ');

  // Gegenproben.
  const knopf = { ...morgen, knoepfe: morgen.knoepfe.map((k, i) => (i === 0 ? `${k}!` : k)) };
  expect(vergleichen(frueh, knopf, false)).toEqual([expect.stringMatching(/^Knopf gewechselt/)]);
  const festerSatz = {
    ...morgen,
    fest: { ...morgen.fest, P7: 'Beworben am 20. Okt. Seit Wochen still. ' },
  };
  expect(vergleichen(frueh, festerSatz, false)).toEqual(['fester Satz gewechselt: P7']);
  expect(
    vergleichen(frueh, morgen, true).filter((x) => x.startsWith('Wechsel am selben Tag')).length,
  ).toBe(6);
});

/** Setzt jeden Text in das Element und misst Überlauf und Zeilen; die erste Fassung ist die von Release 2.0. */
const messen = (page: Page, auswahl: string, texte: string[], vorne = '', hinten = '') =>
  page.evaluate(
    async ({ auswahl, texte, vorne, hinten }) => {
      const el = document.querySelector<HTMLElement>(auswahl)!;
      const zeilen = () => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return new Set(
          [...r.getClientRects()].filter((k) => k.width > 0).map((k) => Math.round(k.top)),
        ).size;
      };
      const breite = document.documentElement.clientWidth;
      const aus: { text: string; zeilen: number; ueber: boolean }[] = [];
      for (const text of texte) {
        el.textContent = `${vorne}${text}${hinten}`;
        await new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(fertig)));
        const k = el.getBoundingClientRect();
        aus.push({
          text,
          zeilen: zeilen(),
          ueber:
            el.scrollWidth > el.clientWidth + 1 ||
            k.right > breite + 1 ||
            document.documentElement.scrollWidth > breite + 1,
        });
      }
      return aus;
    },
    { auswahl, texte, vorne, hinten },
  );

function pruefen(
  name: string,
  ergebnis: { text: string; zeilen: number; ueber: boolean }[],
): string[] {
  const heute = ergebnis[0]!.zeilen;
  return ergebnis.flatMap((e) => [
    ...(e.ueber ? [`${name}: läuft über: ${e.text}`] : []),
    ...(e.zeilen > heute + 1
      ? [`${name}: ${e.zeilen} statt höchstens ${heute + 1} Zeilen: ${e.text}`]
      : []),
  ]);
}

test('wunsch-W37: jede Fassung bei 320 px mit 130 % ohne Überlauf, höchstens eine Zeile mehr als 2.0; Gegenprobe', async ({
  page,
}) => {
  await page.setViewportSize({ width: 246, height: 437 });
  const fehler: string[] = [];
  const alle = (stelle: string, o: { teil?: string; anzahl?: number } = {}) =>
    stimmungsTexte(stelle, o).map(mitNamen);

  await page.goto('/#/wohnungen');
  await page.reload();
  await expect(page.locator('p.sub').first()).toBeVisible();
  for (const anzahl of [0, 1, 3, 12])
    fehler.push(...pruefen(`P1 (${anzahl})`, await messen(page, 'p.sub', alle('P1', { anzahl }))));

  for (const [id, stelle] of STAND) {
    await page.evaluate((h) => (window.location.hash = h), `#/heft/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(STRASSE[id]!);
    await expect(page.locator('p.satz').first()).toBeVisible();
    const { fest } = zerlegen(stelle, (await page.locator('p.satz').first().innerText()).trim());
    const [vorne, hinten] = stelle === 'P9' ? ['', fest] : [fest, ''];
    fehler.push(
      ...pruefen(
        stelle,
        await messen(page, 'p.satz', alle(stelle, { teil: 'satz' }), vorne, hinten),
      ),
    );
  }

  await page.evaluate(() => (window.location.hash = '#/'));
  await expect(page.locator('#aufgaben-titel')).toBeVisible();
  for (const anzahl of [1, 3, 12])
    fehler.push(
      ...pruefen(`P2 (${anzahl})`, await messen(page, '#aufgaben-titel', alle('P2', { anzahl }))),
    );

  // P6 (heute beworben) und P5 (noch keine Wohnung): eigene Zustände.
  await hefteAnlegen(page, [
    heft('heute', 'Musterplatz 1', { beworben: { ...beworben, am: tag(0, 8).toISOString() } }),
  ]);
  await page.reload();
  await page.evaluate(() => (window.location.hash = '#/heft/heute'));
  await expect(page.locator('p.satz').first()).toBeVisible();
  fehler.push(...pruefen('P6', await messen(page, 'p.satz', alle('P6', { teil: 'satz' }))));

  // P4 steht im Kasten der Übersicht, wenn alles da ist; gemessen an derselben Stelle wie P2, in der Schrift von P4.
  await page.evaluate(() => (window.location.hash = '#/'));
  await expect(page.locator('#aufgaben-titel')).toBeVisible();
  fehler.push(
    ...pruefen(
      'P4 (an der Stelle von P2)',
      await messen(page, '#aufgaben-titel', alle('P4', { teil: 'satz' })),
    ),
  );

  // Gegenproben: Ein Satz mit zwei Zeilen mehr fällt auf; ohne Umbruch läuft ein Satz über.
  const lang = await messen(page, '#aufgaben-titel', [
    'Noch drei Dinge.',
    'Noch drei Dinge, dann seid ihr startklar und habt wirklich alles für die Mappe beisammen, ganz und gar.',
  ]);
  expect(pruefen('Gegenprobe', lang).some((f) => f.includes('Zeilen'))).toBe(true);
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('#aufgaben-titel')!.style.whiteSpace = 'nowrap';
  });
  const breit = await messen(page, '#aufgaben-titel', [
    'Noch drei Dinge.',
    'Noch drei Dinge, dann seid ihr startklar.',
  ]);
  expect(pruefen('Gegenprobe', breit).some((f) => f.includes('läuft über'))).toBe(true);

  expect(fehler).toEqual([]);
});

test('wunsch-W37: P5 ohne Wohnung, jede Fassung bei 320 px mit 130 %', async ({ browser }) => {
  // Der Kasten steht beim ersten Start: ohne Haushalt und ohne Hefte, darum ein eigener, leerer Kontext.
  const kontext = await browser.newContext({ viewport: { width: 246, height: 437 } });
  const page = await kontext.newPage();
  await page.clock.setFixedTime(tag(0));
  await page.goto('/#/wohnungen');
  await expect(page.locator('p.kasten')).toBeVisible();
  expect(
    pruefen('P5', await messen(page, 'p.kasten', stimmungsTexte('P5', { teil: 'satz' }))),
  ).toEqual([]);
  await kontext.close();
});

test('wunsch-W37: „Andere Fassung“ wechselt den Rahmen, der Kern bleibt; Eigenes wird nie überschrieben', async ({
  page,
}) => {
  await page.setViewportSize({ width: 246, height: 437 });
  await page.goto('/#/heft/gemerkt/bewerben');
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Bewerben mit wenigen Tipps' }),
  ).toBeVisible();
  const brief = page.locator('.mailblatt .mt');
  const knoepfe = async () =>
    page
      .locator('main')
      .getByRole('button')
      .evaluateAll((b) =>
        b.map((x) => (x.getAttribute('aria-label') ?? x.textContent ?? '').trim()),
      );
  const vorher = await knoepfe();
  const gesehen = new Set<string>();
  let letzter = '';
  for (let i = 0; i < 8; i++) {
    const text = await brief.evaluate((e) => e.textContent ?? '');
    expect(text, `Fassung ${i + 1}`).not.toBe(letzter);
    gesehen.add(text);
    letzter = text;
    // Kern wörtlich, Absätze als Leerzeile (W14), kein HTML, nichts läuft über.
    expect(text).toContain('Meine Mappe mit den üblichen Unterlagen');
    expect(text).toContain(
      '\n\nEinzug: 1. Januar 2027.\nWer einzieht: Eine Person im Mietvertrag.',
    );
    expect(text).toMatch(/\n\n/);
    expect(text).not.toMatch(/<\/?[a-z]+[^>]*>|&[a-z]+;/i);
    expect(await brief.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Andere Fassung' }).click();
  }
  expect(gesehen.size).toBe(8);
  // Die Knöpfe bleiben dieselben.
  expect(await knoepfe()).toEqual(vorher);

  // Eigener Text: „Andere Fassung“ verschwindet, der Text bleibt.
  await page.getByRole('button', { name: 'Ändern' }).click();
  await page.getByRole('textbox', { name: 'Anschreiben' }).fill('Guten Tag,\n\nmein eigener Text.');
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(brief).toHaveText(/mein eigener Text\./);
  await expect(page.getByRole('button', { name: 'Andere Fassung' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mail', exact: true }).click();
  await page.getByRole('button', { name: 'Portal', exact: true }).click();
  await expect(brief).toHaveText(/mein eigener Text\./);
});

// DP109 (PC175): die Zusage. Fassungen ohne Ausrufezeichen, Tag nur aus „Zusage am“, und alle 160 Verbindungen aus
// Anfang, Namen und festem Teil passen bei 320 px mit 130 % (wie `p9laenge.js` von Design). Namen aus der
// Namensliste (W40).
const P9_NAMEN = [
  'Selin',
  'Konstantin',
  'Mai Linh',
  'Johanna',
  'Selin und Jarne',
  'Mai Linh und Konstantin',
  'Johanna, Konstantin und Mai Linh',
  'ihr vier',
];
const P9_FEST = [
  'Am 28. September kam die Zusage für die Wohnung Beispielstraße 1.',
  'Am 12. November kam die Zusage für „Dachgeschoss mit Balkon“.',
  'Heute kam die Zusage für die Wohnung Lindenring 3.',
  'Gestern kam die Zusage.',
];
/** Verstöße gegen DP109 im Text einer Zusage: Ausrufezeichen; ein Tag, obwohl keiner eingetragen ist. */
function zusageFalsch(text: string, mitTag: boolean): string[] {
  const f: string[] = [];
  if (text.includes('!')) f.push(`Ausrufezeichen: ${text}`);
  if (!mitTag && /\b(Heute|Gestern|Am \d{1,2}\.)/.test(text)) f.push(`Tag ohne Eintrag: ${text}`);
  return f;
}

test('wunsch-W37 (DP109): Zusage ohne Ausrufezeichen, Tag nur aus „Zusage am“; Gegenproben', async ({
  page,
}) => {
  // Jede Fassung von P9 ohne Ausrufezeichen. Gegenprobe: eine Fassung mit Ausrufezeichen wird rot.
  const p9 = stimmungsTexte('P9', { teil: 'satz' });
  expect(p9).toHaveLength(5);
  expect(p9.flatMap((p) => zusageFalsch(p, true))).toEqual([]);
  expect(zusageFalsch('Glückwunsch, {namen}!', true)).toHaveLength(1);

  // Zusage ohne „Zusage am“: kein Tag, sondern „Die Zusage ist eingetragen.“
  await hefteAnlegen(page, [
    heft('ohneTag', 'Lindenring 3', { beworben, ergebnis: { art: 'zusage' } }),
  ]);
  await page.goto('/#/heft/ohneTag');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Lindenring 3');
  const satz = (await page.locator('p.satz').first().innerText()).trim();
  expect(satz).toMatch(/ Die Zusage ist eingetragen\.$/);
  expect(zusageFalsch(satz, false)).toEqual([]);
  // Gegenprobe: ein Tag ohne Eintrag (etwa aus dem Datum der letzten Änderung) wird rot.
  expect(zusageFalsch('Glückwunsch, Max. Am 2. November kam die Zusage.', false)).toHaveLength(1);
});

test('wunsch-W37 (DP109): alle 160 Fassungen der Zusage bei 320 px mit 130 % ohne Überlauf; Gegenprobe', async ({
  page,
}) => {
  await page.setViewportSize({ width: 246, height: 437 });
  await page.goto('/#/heft/zusage');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Beispielstraße 1');
  await expect(page.locator('p.satz.trennen')).toBeVisible();
  const texte = stimmungsTexte('P9', { teil: 'satz' }).flatMap((a) =>
    P9_NAMEN.flatMap((n) => P9_FEST.map((f) => `${a.replace('{namen}', n)} ${f}`)),
  );
  expect(texte).toHaveLength(160);
  const ergebnis = await messen(page, 'p.satz.trennen', texte);
  expect(ergebnis.filter((e) => e.ueber).map((e) => e.text)).toEqual([]);
  // Gegenprobe: ein langer Name ohne Leerzeichen und ohne Trennung läuft über.
  await page.evaluate(() => {
    const s = document.styleSheets[document.styleSheets.length - 1]!;
    s.insertRule(
      'p.satz.trennen{hyphens:manual !important;overflow-wrap:normal !important}',
      s.cssRules.length,
    );
  });
  const lang = await messen(page, 'p.satz.trennen', [
    'Glückwunsch, Max. Heute kam die Zusage für „Dachgeschosswohnungmitbalkonundgarten“.',
  ]);
  expect(lang[0]!.ueber).toBe(true);
});
