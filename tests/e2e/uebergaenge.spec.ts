import { test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { hefteAnlegen } from './hefte-hilfen';
import { szenarioLaden } from './szenario-laden';

// PC130 K14 (W8, „Nichts springt, nichts blitzt“): Die Übergänge zwischen Mappe, Personenseite, Selbstauskunft,
// Unterlage und Heft und die Reiterwechsel, in WebKit Bild für Bild abgetastet (je requestAnimationFrame, 1,5 s lang).
// Kein Test im eigentlichen Sinn: läuft nur mit UEBERGAENGE=1 und schreibt UEBERGAENGE_TABELLE (Markdown) und
// UEBERGAENGE_ROH (JSON). Festgehalten je Bild: erste Überschrift in main (Text, Lage, Deckkraft), ob main sichtbaren
// Text hat, die Scrollstelle und die Lage des Kopfs. Nur Musterdaten (W7).

test.skip(!process.env.UEBERGAENGE, 'nur mit UEBERGAENGE=1');

interface Bild {
  t: number;
  h: string;
  top: number | null;
  deck: number | null;
  text: boolean;
  y: number;
  kopf: number | null;
}

async function abtasten(page: Page, tun: () => Promise<void>): Promise<Bild[]> {
  await page.evaluate(() => {
    const w = window as unknown as { __bilder: unknown[] };
    w.__bilder = [];
    const t0 = performance.now();
    const schritt = () => {
      const t = performance.now() - t0;
      const h = document.querySelector('main h1, main h2');
      const r = h?.getBoundingClientRect();
      const main = document.querySelector('main');
      const kopf = document.querySelector('header, .kopf, .kopfzeile');
      w.__bilder.push({
        t: Math.round(t),
        // Ohne weiches Trennzeichen, sonst fände „Selbstauskunft“ die Überschrift nicht.
        h: (h?.textContent ?? '').split(String.fromCharCode(173)).join('').trim().slice(0, 40),
        top: r ? Math.round(r.top * 10) / 10 : null,
        deck: h ? Number(getComputedStyle(h).opacity) : null,
        text: !!main && (main as HTMLElement).innerText.trim().length > 0,
        y: Math.round(window.scrollY),
        kopf: kopf ? Math.round(kopf.getBoundingClientRect().top * 10) / 10 : null,
      });
      if (t < 1500) requestAnimationFrame(schritt);
    };
    requestAnimationFrame(schritt);
  });
  await tun();
  await page.waitForTimeout(1700);
  return page.evaluate(() => (window as unknown as { __bilder: Bild[] }).__bilder);
}

/** Was in den Bildern auffällt: leere Bilder, Überschrift weg und wieder da, Sprünge nach dem Ankommen. */
function befund(bilder: Bild[], ziel: RegExp) {
  const leer = bilder.filter((b) => !b.text).length;
  const folge: string[] = [];
  for (const b of bilder) if (folge.at(-1) !== b.h) folge.push(b.h);
  const erstes = bilder.findIndex((b) => ziel.test(b.h));
  const danach = erstes >= 0 ? bilder.slice(erstes) : [];
  const tops = [...new Set(danach.map((b) => b.top))];
  const sprung = danach.length
    ? Math.max(...danach.map((b) => Math.abs((b.top ?? 0) - (danach.at(-1)!.top ?? 0))))
    : null;
  const ys = [...new Set(danach.map((b) => b.y))];
  const kopf = [...new Set(danach.map((b) => b.kopf))];
  const zurueck = folge.filter((h) => ziel.test(h)).length > 1;
  return {
    bilder: bilder.length,
    ankunftMs: erstes >= 0 ? bilder[erstes]!.t : null,
    leer,
    folge: folge.join(' → '),
    lagen: tops.length,
    sprungPx: sprung,
    scroll: ys.join('/'),
    kopf: kopf.join('/'),
    flackern: zurueck,
  };
}

test('K14: Übergänge in WebKit Bild für Bild', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'nur WebKit');
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await szenarioLaden(page, '04-fertig', '/');
  await hefteAnlegen(page, [
    {
      id: 'k14',
      createdAt: '2026-11-03T10:00:00.000Z',
      updatedAt: '2026-11-03T10:00:00.000Z',
      haushaltId: null,
      adresse: ['Musterweg 7', '00100 Musterstadt'].join(String.fromCharCode(10)),
      link: null,
      quelle: '',
      inseratText: null,
      kennung: 'k-k14',
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
      angaben: { titel: null, stadtteil: null, warm: null, zimmer: 2, flaeche: 60 },
    },
  ]);
  await page.reload();
  await page.locator('main h1').first().waitFor();
  const zeilen: { weg: string; b: ReturnType<typeof befund> }[] = [];
  const roh: Record<string, Bild[]> = {};
  const schritt = async (weg: string, ziel: RegExp, tun: () => Promise<void>) => {
    const bilder = await abtasten(page, tun);
    roh[weg] = bilder;
    zeilen.push({ weg, b: befund(bilder, ziel) });
  };
  const max = page.getByRole('link', { name: /^Max/ }).first();

  await schritt('Mappe → Wohnungen (Reiter)', /Wohnung|Guten|Hallo/, () =>
    page.getByRole('link', { name: 'Wohnungen', exact: true }).click(),
  );
  await schritt('Wohnungen → Heft', /^Musterweg 7/, () =>
    page
      .getByRole('link', { name: /^Musterweg 7/ })
      .first()
      .click(),
  );
  await schritt('Heft → Zurück (Wohnungen)', /Wohnung|Guten|Hallo/, () =>
    page.locator('a.zurueck').click(),
  );
  await schritt('Wohnungen → Mappe (Reiter)', /Mappe/, () =>
    page.getByRole('link', { name: 'Mappe', exact: true }).click(),
  );
  await schritt('Mappe → Personenseite', /^Max/, () => max.click());
  await schritt('Personenseite → Selbstauskunft', /^Selbstauskunft/, () =>
    page
      .getByRole('link', { name: /^Selbstauskunft/ })
      .first()
      .click(),
  );
  await schritt('Selbstauskunft → Zurück', /^Max/, () => page.locator('a.zurueck').click());
  await schritt('Personenseite → Unterlage', /Gehalts/, () =>
    page
      .getByRole('link', { name: /^Gehaltsnachweise/ })
      .first()
      .click(),
  );
  await schritt('Unterlage → Zurück', /^Max/, () => page.locator('a.zurueck').click());
  await schritt('Personenseite → Zurück (Mappe)', /Mappe/, () => page.locator('a.zurueck').click());
  await schritt('Mappe → Selbstauskunft', /^Selbstauskunft/, () =>
    page
      .getByRole('link', { name: /^Selbstauskunft/ })
      .first()
      .click(),
  );
  await schritt('Selbstauskunft → Fertig (Mappe)', /Mappe/, () =>
    page.locator('.leiste').getByRole('button', { name: 'Fertig', exact: true }).click(),
  );

  const kopfzeile =
    '| Übergang | Bilder | Ankunft ms | leere Bilder | Überschriften nacheinander | Lagen der Überschrift | größter Sprung px | Scroll | Kopf | Überschrift kam zweimal |';
  const tabelle = [
    kopfzeile,
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...zeilen.map(
      ({ weg, b }) =>
        `| ${weg} | ${b.bilder} | ${b.ankunftMs ?? '–'} | ${b.leer} | ${b.folge || '–'} | ${b.lagen} | ${b.sprungPx ?? '–'} | ${b.scroll} | ${b.kopf} | ${b.flackern ? 'ja' : 'nein'} |`,
    ),
  ].join('\n');
  if (process.env.UEBERGAENGE_TABELLE) writeFileSync(process.env.UEBERGAENGE_TABELLE, tabelle);
  if (process.env.UEBERGAENGE_ROH)
    writeFileSync(process.env.UEBERGAENGE_ROH, JSON.stringify(roh, null, 1));
  console.log(tabelle);
});
