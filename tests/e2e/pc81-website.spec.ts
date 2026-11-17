// PC81 B10, B11, U2 und PC83/PC84 auf der Website (dist-web), je mit Gegenprobe.
import { expect, test, type Page } from '@playwright/test';

const WEB = 'http://localhost:4175';

/** Kontrast nach WCAG zwischen zwei Farben „rgb(r, g, b)“. */
function kontrast(a: string, b: string): number {
  const l = (s: string) => {
    const [r, g, bl] = s
      .match(/\d+(\.\d+)?/g)!
      .slice(0, 3)
      .map(Number);
    const k = (c: number) => {
      const x = c / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * k(r!) + 0.7152 * k(g!) + 0.0722 * k(bl!);
  };
  const [h, d] = [l(a), l(b)].sort((x, y) => y - x);
  return (h! + 0.05) / (d! + 0.05);
}

/** Wie weit ragt jede Überschrift über ihren Kasten hinaus (in px)? */
const ueberstand = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('h1, h2, h3')].map((h) => {
      const r = document.createRange();
      r.selectNodeContents(h);
      const breite = Math.max(...[...r.getClientRects()].map((x) => x.right));
      return {
        text: h.textContent!.replaceAll('­', '').trim(),
        ueber: Math.round(breite - h.getBoundingClientRect().right),
        seite: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }),
  );

for (const schema of ['light', 'dark'] as const) {
  test(`B11 (QA13): /datenschutz/ bei 320 px mit 130 %: keine Überschrift ragt hinaus, ${schema}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: schema });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`${WEB}/datenschutz/`);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.documentElement.style.setProperty('zoom', '1.3'));
    await page.waitForTimeout(100);
    const jetzt = await ueberstand(page);
    expect(jetzt.find((h) => h.text === 'Datenschutzerklärung')).toBeTruthy();
    // Der Wortlaut bleibt: Nur ein weiches Trennzeichen kam hinzu.
    expect(await page.locator('h1').first().innerHTML()).toBe('Datenschutz\u00aderklärung');
    expect(jetzt.filter((h) => h.ueber > 0)).toEqual([]);
    expect(jetzt[0]!.seite).toBeLessThanOrEqual(0);
    // Gegenprobe: ohne Trennung ragt „Datenschutzerklärung“ hinaus.
    await page.evaluate(() => {
      const h = document.querySelector('h1')!;
      h.textContent = h.textContent!.replaceAll('\u00ad', '');
      const s = document.styleSheets[document.styleSheets.length - 1]!;
      s.insertRule(
        '.rg-text h1{hyphens:manual!important;-webkit-hyphens:manual!important}',
        s.cssRules.length,
      );
    });
    const frueher = await ueberstand(page);
    expect(frueher.find((h) => h.text === 'Datenschutzerklärung')!.ueber).toBeGreaterThan(0);
  });

  test(`B10 (QA12): Fundstellen auf den Karten „Noch nicht“ mit mindestens 4,5 : 1, ${schema}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: schema });
    await page.goto(`${WEB}/ratgeber/was-darf-der-vermieter-verlangen/`);
    const farben = () =>
      page.locator('.rg-artikel .noch .rg-f').evaluateAll((fs) =>
        fs.map((f) => {
          let b: Element | null = f;
          let grund = 'rgba(0, 0, 0, 0)';
          while (b && /rgba\(0, 0, 0, 0\)|transparent/.test(grund)) {
            grund = getComputedStyle(b).backgroundColor;
            b = b.parentElement;
          }
          return { text: getComputedStyle(f).color, grund };
        }),
      );
    const jetzt = await farben();
    expect(jetzt.length).toBeGreaterThan(0);
    for (const f of jetzt) expect(kontrast(f.text, f.grund)).toBeGreaterThanOrEqual(4.5);
    // Gegenprobe im dunklen Thema: die frühere Farbe --tinte3 bleibt darunter.
    if (schema === 'dark') {
      await page.evaluate(() => {
        const s = document.styleSheets[document.styleSheets.length - 1]!;
        s.insertRule('.rg-artikel .noch .rg-f{color:var(--tinte3)!important}', s.cssRules.length);
      });
      const frueher = await farben();
      expect(Math.min(...frueher.map((f) => kontrast(f.text, f.grund)))).toBeLessThan(4.5);
    }
  });
}

// PC84 (mit PC83): die Texte von „/“ auf einmal. Die Gegenprobe ist die alte Fassung des Kopfs und der Karte „Vorher“.
const ALT = [
  'Für eure nächste Wohnung',
  'Wohnung gefunden',
  'Bewerbung fertig',
  'in einer Minute',
  'Nichts Unzulässiges',
  'nicht verlangen darf',
];
const ALTE_FASSUNG =
  '<p class="kicker">Für eure nächste Wohnung</p><h1 id="titel">Wohnung gefunden? <em>Bewerbung fertig.</em></h1>' +
  '<p class="sub">Eure Mappe liegt bereit, das Anschreiben steht in einer Minute. Für jede Wohnung ein Heft, vom ' +
  'Inserat bis zur Antwort.</p><h3>Nichts Unzu\u00adlässiges</h3><p>Selbstauskunft nach dem Muster der ' +
  'Daten\u00adschutz\u00adkonferenz, Einkommen, Bonität: ein PDF mit Deckblatt. Was ein Vermieter nicht verlangen ' +
  'darf, fehlt. Wann ihr was schickt, entscheidet ihr.</p>';
const alteStellen = (text: string) => ALT.filter((a) => text.replaceAll('\u00ad', '').includes(a));

test('PC84: Startseite „/“ mit den neuen Texten; die alten stehen nirgends (Gegenprobe: alte Fassung)', async ({
  page,
}) => {
  await page.goto(`${WEB}/`);
  const mieter = page.locator('#mieter');
  const text = ((await mieter.textContent()) ?? '').replaceAll('\u00ad', '');
  expect(alteStellen(text)).toEqual([]);
  expect(alteStellen(ALTE_FASSUNG)).toEqual(ALT);
  const ohneTrenner = async (sel: string) =>
    ((await mieter.locator(sel).first().textContent()) ?? '').replaceAll('\u00ad', '').trim();
  expect(await ohneTrenner('.kopf .kicker')).toBe('Kostenlos und ohne Konto');
  expect(await ohneTrenner('.kopf h1')).toBe('Die Mappe für die Wohnungssuche.');
  await expect(
    page.getByRole('heading', { level: 1, name: /^Die Mappe für die Wohnungs.?suche\.$/ }),
  ).toBeVisible();
  expect(await ohneTrenner('.kopf .sub')).toBe(
    'Selbstauskunft, Unterlagen und Anschreiben für den ganzen Haushalt, als ein PDF. Für jede Wohnung ein Heft, vom Inserat bis zur Antwort.',
  );
  expect(await ohneTrenner('.kopf .klein-zeile')).toBe(
    'Eure Daten bleiben bei euch. Was hinausgeht, schickt ihr selbst.',
  );
  expect(await ohneTrenner('.im-browser .nicht-android.nicht-iphone')).toBe(
    'Ohne Installation. Eure Daten bleiben in diesem Browser. Unter Android legt ihr Hefta von hier auf den Startbildschirm.',
  );
  expect(await ohneTrenner('.wege-fuss')).toBe('Dieselbe Mappe, zwei Wege.');
  expect(await mieter.locator('.nicht li').allTextContents()).toEqual([
    'Keine Werbung, kein Tracking',
    'Verschickt nichts von selbst',
  ]);
  expect(await ohneTrenner('#tut-t')).toBe('Jede Wohnung ein Heft.');
  expect(await ohneTrenner('.tut-unter')).toBe('Mappe, Termine, Antworten: alles an einem Ort.');
  const vorher = mieter.locator('.tut li').nth(0);
  expect(((await vorher.locator('h3').textContent()) ?? '').replaceAll('\u00ad', '')).toBe(
    'Nur, was Vermieter fragen dürfen',
  );
  expect(((await vorher.locator('p').textContent()) ?? '').replaceAll('\u00ad', '')).toContain(
    'Was nach diesem Muster nicht dazugehört, fehlt.',
  );
  expect(((await mieter.locator('.tut li').nth(1).locator('p').textContent()) ?? '').trim()).toBe(
    'Ein Inserat an Hefta geben: in der App teilen, im Browser den Text einfügen. Hefta liest die Eckdaten, soweit sie im Inserat stehen, und zeigt, was zu euren Wünschen passt.',
  );
  // PC83, 2: Titel und Beschreibung nutzen den alten Kopf nicht; ein og:title gibt es nicht.
  expect(alteStellen(await page.title())).toEqual([]);
  expect(
    alteStellen((await page.locator('meta[name="description"]').getAttribute('content')) ?? ''),
  ).toEqual([]);
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(0);
});

for (const schema of ['light', 'dark'] as const) {
  test(`PC81 U2: Auf „/“ sind Punkt bei „Vorher“, Rand an „Im Browser“ und Ratgeber-Karte Tinte, ${schema}`, async ({
    browser,
  }) => {
    // Am Rechner ist „Im Browser“ der vorgewählte Weg („dran“).
    const kontext = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      viewport: { width: 1280, height: 860 },
      colorScheme: schema,
    });
    const page = await kontext.newPage();
    await page.goto(`${WEB}/`);
    await expect(page.locator('#mieter section.im-browser.dran')).toBeVisible();
    const farben = () =>
      page.evaluate(() => {
        const farbe = (v: string) => {
          const p = document.createElement('p');
          p.style.color = `var(${v})`;
          document.body.append(p);
          const c = getComputedStyle(p).color;
          p.remove();
          return c;
        };
        const s = (sel: string) => getComputedStyle(document.querySelector(sel)!);
        return {
          tinte: farbe('--tinte'),
          akzent: farbe('--akzent'),
          punkt: s('#mieter .weg .m.voll-akzent').backgroundColor,
          rand: s('#mieter .wege>.weg.dran').borderTopColor,
          reiterRand: s('#mieter .wege>.weg.dran .weg-reiter').borderTopColor,
          schatten: s('#mieter .wege>.weg.dran').boxShadow,
          karte: s('#mieter .rat-beitrag').borderLeftColor,
        };
      });
    const f = await farben();
    for (const wert of [f.punkt, f.rand, f.reiterRand, f.karte]) expect(wert).toBe(f.tinte);
    expect(f.schatten).toContain(f.tinte);
    expect([f.punkt, f.rand, f.reiterRand, f.karte]).not.toContain(f.akzent);
    expect(f.schatten).not.toContain(f.akzent);
    // Gegenprobe: die frühere Fassung in Akzent wird rot.
    await page.evaluate(() => {
      const s = document.styleSheets[0]!;
      for (const r of [
        '.weg .m.voll-akzent{background:var(--akzent)!important}',
        '.wege>.weg.dran{border-color:var(--akzent)!important}',
        '.rat-beitrag{border-left-color:var(--akzent)!important}',
      ])
        s.insertRule(r, s.cssRules.length);
    });
    const frueher = await farben();
    expect([frueher.punkt, frueher.rand, frueher.karte]).toEqual([
      frueher.akzent,
      frueher.akzent,
      frueher.akzent,
    ]);
    await kontext.close();
  });
}
