import { expect, test } from '@playwright/test';
import { ersterStart, haushaltDesAuftraggebers, haushaltMitMax } from './einrichtung';
import { hefteAnlegen } from './hefte-hilfen';
import { szenarioLaden } from './szenario-laden';

// DP70 (E199, 2.0.1): Barrierefreiheit der Mappe. Hier U2 und U3, je mit Gegenprobe.

test('DP70 U3: „Weiter“ ohne Vornamen setzt den Fokus in das leere Feld', async ({ page }) => {
  await page.goto('/');
  await ersterStart(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Wer bist du?' })).toBeVisible();
  const vorname = page.locator('main input[autocomplete="given-name"]');
  const weiter = page.getByRole('button', { name: 'Weiter', exact: true });
  await weiter.focus();
  await expect(weiter).toHaveAttribute('aria-disabled', 'true');
  // Playwright hält aria-disabled für gesperrt; ein Mensch kann den Knopf trotzdem antippen.
  await weiter.click({ force: true });
  await expect(vorname).toBeFocused();
  // Gegenprobe: Mit Vornamen (es fehlt nur noch die Bezeichnung) springt der Fokus nicht ins Vornamen-Feld.
  await vorname.fill('Max');
  await weiter.focus();
  await weiter.click({ force: true });
  await expect(vorname).not.toBeFocused();
});

test('DP70 U2: Die versteckten Dateifelder im Heft sind für Vorlesen und Tab unsichtbar; Gegenprobe', async ({
  page,
}) => {
  await haushaltMitMax(page);
  const jetzt = new Date().toISOString();
  await hefteAnlegen(page, [
    {
      id: 'linden',
      createdAt: jetzt,
      updatedAt: jetzt,
      haushaltId: null,
      adresse: 'Lindenring 3\n20259 Hamburg',
      link: '',
      quelle: '',
      inseratText: null,
      kennung: 'k-linden',
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
      angaben: null,
    },
  ]);
  await page.goto('/#/wohnungen');
  await page.reload();
  await page.evaluate(() => (window.location.hash = '#/heft/linden'));
  await expect(page.locator('main h1')).toBeVisible();
  const offen = () =>
    page
      .locator('main input[type="file"]')
      .evaluateAll(
        (felder) =>
          felder.filter(
            (f) => f.getAttribute('aria-hidden') !== 'true' || f.getAttribute('tabindex') !== '-1',
          ).length,
      );
  expect(await page.locator('main input[type="file"]').count()).toBeGreaterThan(0);
  expect(await offen()).toBe(0);
  // Gegenprobe: ein Dateifeld ohne beides fällt auf.
  await page.evaluate(() => {
    const f = document.createElement('input');
    f.type = 'file';
    document.querySelector('main')!.append(f);
  });
  expect(await offen()).toBe(1);
});

/** Tab bis ans Ende; gemeldet wird jedes fokussierte Element, das unter einer festen Leiste unten liegt. */
async function verdeckteFokusse(page: import('@playwright/test').Page, schritte: number) {
  const verdeckt: string[] = [];
  for (let i = 0; i < schritte; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const k = el.getBoundingClientRect();
      // Oberkante der festen Leisten unten: die höchste fixe oder klebende Leiste am unteren Rand.
      let oben = window.innerHeight;
      for (const l of document.querySelectorAll<HTMLElement>(
        'nav, .aktionsleiste, [class*="leiste"]',
      )) {
        const s = getComputedStyle(l);
        const b = l.getBoundingClientRect();
        if (
          (s.position === 'fixed' || s.position === 'sticky') &&
          b.bottom >= window.innerHeight - 2 &&
          b.height > 0
        )
          oben = Math.min(oben, b.top);
      }
      if (el.closest('nav, .aktionsleiste, [class*="leiste"]')) return null;
      return k.bottom > oben + 1
        ? `${el.tagName.toLowerCase()}: ${(el.textContent ?? '').trim().slice(0, 30)}`
        : null;
    });
    if (r) verdeckt.push(r);
  }
  return verdeckt;
}

test('DP70 QA21 (K1-1): Tab durch die Mappe-Übersicht, kein Fokus unter der Reiterleiste; Gegenprobe', async ({
  page,
  browserName,
}) => {
  // WebKit springt mit Tab nicht auf Links (wie Safari ohne „Mit Tab jedes Objekt hervorheben“).
  test.skip(browserName !== 'chromium', 'Tab-Reihenfolge mit Links nur in Chromium');
  await page.setViewportSize({ width: 390, height: 844 });
  // Wie DP70: Max, Lea und Petra, die Übersicht ist länger als ein Bildschirm.
  await haushaltDesAuftraggebers(page);
  await page.getByRole('button', { name: 'Später', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await verdeckteFokusse(page, 60)).toEqual([]);
  // Gegenprobe: ohne scroll-padding liegt ein fokussiertes Element unter der Leiste.
  await page.evaluate(() => {
    const s = document.styleSheets[0]!;
    s.insertRule('html{scroll-padding-bottom:0 !important}', s.cssRules.length);
    window.scrollTo(0, 0);
    (document.activeElement as HTMLElement | null)?.blur();
  });
  expect((await verdeckteFokusse(page, 60)).length).toBeGreaterThan(0);
});

test('DP70 QA22 (K1-2): 200 % Zoom (195 × 422), Übersicht und Anlegen: nicht breiter als das Fenster, feste Leisten höchstens ein Drittel', async ({
  page,
}) => {
  const messen = () =>
    page.evaluate(() => {
      const h = window.innerHeight;
      let fest = 0;
      for (const el of document.querySelectorAll<HTMLElement>('body *')) {
        const s = getComputedStyle(el);
        if (s.position !== 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.bottom >= h - 2 && r.top < h) fest = Math.max(fest, h - r.top);
      }
      return {
        breiter: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        anteil: fest / h,
      };
    });
  await page.setViewportSize({ width: 390, height: 844 });
  await haushaltDesAuftraggebers(page);
  await page.setViewportSize({ width: 195, height: 422 });
  await page.waitForTimeout(300);
  // „Jetzt die Unterlagen.“: die Runde mit „Speichern und weiter“ und „Später“.
  const runde = await messen();
  expect(runde.breiter).toBeLessThanOrEqual(1);
  expect(runde.anteil, 'Runde').toBeLessThanOrEqual(1 / 3);
  await page.getByRole('button', { name: 'Später', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible();
  await page.waitForTimeout(300);
  const uebersicht = await messen();
  expect(uebersicht.breiter).toBeLessThanOrEqual(1);
  expect(uebersicht.anteil, 'Übersicht').toBeLessThanOrEqual(1 / 3);
  // Gegenprobe: Eine feste Leiste mit halber Höhe fällt auf.
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:50vh';
    document.body.append(d);
  });
  expect((await messen()).anteil).toBeGreaterThan(1 / 3);
});

/** Laufende Animationen und Übergänge, die etwas anderes als die Deckkraft bewegen. */
const bewegteEigenschaften = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const verboten =
      /^(transform|translate|scale|rotate|width|height|left|right|top|bottom|max-height|margin)/;
    const aus: string[] = [];
    for (const a of document.getAnimations()) {
      const dauer = Number(a.effect?.getComputedTiming().duration ?? 0);
      if (!dauer) continue;
      const namen =
        a instanceof CSSTransition
          ? [a.transitionProperty]
          : ((a.effect as KeyframeEffect | null)
              ?.getKeyframes()
              .flatMap((k) =>
                Object.keys(k).filter(
                  (x) => !['offset', 'easing', 'composite', 'computedOffset'].includes(x),
                ),
              ) ?? []);
      for (const n of namen)
        if (verboten.test(n.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)))
          aus.push(`${n} (${dauer} ms)`);
    }
    return aus;
  });

test('DP70 QA23: Mit „Bewegung reduzieren“ wird nur die Deckkraft animiert; Gegenprobe', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await haushaltMitMax(page);
  const funde: string[] = [];
  for (const hash of ['#/wohnungen', '#/', '#/einstellungen', '#/']) {
    await page.evaluate((h) => (window.location.hash = h), hash);
    for (let i = 0; i < 4; i++) {
      funde.push(...(await bewegteEigenschaften(page)));
      await page.waitForTimeout(40);
    }
  }
  expect(funde).toEqual([]);
  // Gegenprobe: eine Animation mit transform fällt auf.
  await page.evaluate(() =>
    document
      .querySelector('main')!
      .animate([{ transform: 'translateY(0)' }, { transform: 'translateY(8px)' }], 400),
  );
  expect((await bewegteEigenschaften(page)).length).toBeGreaterThan(0);
});

/** Eine h1; jedes sichtbare Bedienelement mit Namen und mindestens 44 × 44 px (Tippfläche, auch über ein Label). */
const bedienFehler = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const aus: string[] = [];
    const h1 = [...document.querySelectorAll('h1')].filter(
      (h) => h.getBoundingClientRect().height > 0,
    );
    if (h1.length !== 1) aus.push(`${h1.length} h1`);
    const ziele = document.querySelectorAll<HTMLElement>(
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="radio"], [role="switch"], [role="tab"]',
    );
    for (const el of ziele) {
      if (el.closest('[aria-hidden="true"], [inert]')) continue;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width < 2 || r.height < 2 || s.visibility === 'hidden') continue;
      const name =
        el.getAttribute('aria-label') ||
        (el.getAttribute('aria-labelledby') &&
          document.getElementById(el.getAttribute('aria-labelledby')!.split(' ')[0]!)
            ?.textContent) ||
        (el as HTMLInputElement).labels?.[0]?.textContent ||
        el.getAttribute('title') ||
        el.textContent;
      const kurz = `${el.tagName.toLowerCase()} „${(name ?? '').trim().slice(0, 24)}“`;
      if (!name?.trim()) aus.push(`ohne Namen: ${el.outerHTML.slice(0, 60)}`);
      // Tippfläche: das Element selbst oder sein Label.
      const label = (el as HTMLInputElement).labels?.[0]?.getBoundingClientRect();
      const b = Math.max(r.width, label?.width ?? 0);
      const h = Math.max(r.height, label?.height ?? 0);
      if (b < 43.5 || h < 43.5) aus.push(`${kurz} ${Math.round(b)} × ${Math.round(h)}`);
    }
    return aus.slice(0, 12);
  });

test('DP70 QA24: eine h1, jedes Bedienelement mit Namen und 44 × 44 px; Gegenprobe', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await haushaltMitMax(page);
  const funde: string[] = [];
  for (const hash of ['#/', '#/wohnungen', '#/einstellungen']) {
    await page.evaluate((h) => (window.location.hash = h), hash);
    await page.waitForTimeout(400);
    funde.push(...(await bedienFehler(page)).map((f) => `${hash}: ${f}`));
  }
  expect(funde).toEqual([]);
  // Gegenprobe: ein kleiner Knopf ohne Namen fällt zweimal auf.
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.style.cssText = 'width:20px;height:20px';
    document.querySelector('main')!.append(b);
  });
  expect((await bedienFehler(page)).length).toBeGreaterThanOrEqual(2);
});

// DP70 U1 in 2.1: Das Register aus DP49 bricht nicht mehr um, es rollt in einer Reihe (A17). Was U1 verlangt, gilt
// weiter: Bild und Vorlesen in derselben Reihenfolge, Max zuerst. Die hinteren Reiter stehen 8 px tiefer (DP49).
test('DP70 U1: Reiter der Runde stehen bei 200 % Zoom in einer Reihe in der Reihenfolge des Haushalts, Max zuerst; Gegenprobe', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await szenarioLaden(page, '01-standard', '/rutsch');
  await page.getByRole('button', { name: /^Los geht/ }).click();
  await expect(page.locator('.register-rahmen .karte')).toBeVisible();
  await page.setViewportSize({ width: 195, height: 422 });
  await page.waitForTimeout(300);
  const lage = () =>
    page.locator('nav.register .reiter').evaluateAll((rs) =>
      rs.map((r) => {
        const k = r.getBoundingClientRect();
        return {
          name: (r.querySelector('.reiter-name')?.textContent ?? '').trim(),
          oben: Math.round(k.top),
          links: Math.round(k.left),
        };
      }),
    );
  const reiter = await lage();
  expect(reiter.length).toBeGreaterThanOrEqual(2);
  // Eine Reihe: höchstens die 8 px, um die die hinteren Reiter tiefer stehen.
  const oben = reiter.map((r) => r.oben);
  expect(Math.max(...oben) - Math.min(...oben), JSON.stringify(reiter)).toBeLessThanOrEqual(8);
  expect(reiter[0]!.name).toBe('Max');
  // In Lesereihenfolge: jeder Reiter steht rechts von seinem Vorgänger.
  const geordnet = (l: { links: number }[]) =>
    l.every((r, i) => i === 0 || r.links > l[i - 1]!.links);
  expect(geordnet(reiter), JSON.stringify(reiter)).toBe(true);
  // Gegenprobe: der aktive Reiter ans Ende (wie die frühere Regel) bricht die Reihenfolge.
  await page.evaluate(() => {
    const s = document.styleSheets[0]!;
    s.insertRule(
      'nav.register .reiter[aria-current], nav.register .reiter.an{order:1 !important}',
      s.cssRules.length,
    );
  });
  await page.waitForTimeout(100);
  const nachher = await lage();
  expect(geordnet(nachher), JSON.stringify(nachher)).toBe(false);
});

/** Was über den rechten Rand des Fensters ragt (K1-3): nur sichtbare Elemente mit Inhalt. */
const ueberRand = (page: import('@playwright/test').Page, auswahl: string) =>
  page.evaluate((sel) => {
    const breite = document.documentElement.clientWidth;
    const aus: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && (r.right > breite + 1 || el.scrollWidth > el.clientWidth + 1))
        aus.push(
          `${(el.textContent ?? '').trim().slice(0, 30)} (${Math.round(r.right)} von ${breite})`,
        );
    }
    return aus;
  }, auswahl);

test('DP70 K1-3: 200 % Zoom (195 × 422), Wahl „Gehaltsabrechnung / Kontoauszug“ passt ins Fenster; Gegenprobe', async ({
  page,
}) => {
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  const pdf = Buffer.from(await doc.save());
  await page.setViewportSize({ width: 390, height: 844 });
  await haushaltMitMax(page);
  await page.getByRole('link', { name: /^Max Im Mietvertrag$/ }).click();
  await page.getByRole('link', { name: /^Gehalts.?nachweise/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Max');
  const plus = page.locator('button.zeile.plus', { hasNotText: 'Notiz' });
  if (await plus.count()) await plus.first().click();
  else await page.locator('.leiste .haupt').click();
  const blatt = page.getByRole('dialog');
  await blatt
    .locator('[data-feld="pdf"]')
    .setInputFiles({ name: 'gehalt.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(blatt.getByRole('radio', { name: 'Kontoauszug' })).toBeVisible();
  await page.setViewportSize({ width: 195, height: 422 });
  await page.waitForTimeout(300);
  // Alle Chips im Blatt, darunter die Wahl der Art (Monate und Art stehen beide als Chips da).
  await expect(page.locator('dialog .chip', { hasText: /^Gehaltsabrechnung$/ })).toHaveCount(1);
  await expect(page.locator('dialog .chip', { hasText: /^Kontoauszug$/ })).toHaveCount(1);
  expect(await ueberRand(page, 'dialog .chip')).toEqual([]);
  // Gegenprobe: ohne Umbruch und mit breiter Schrift ragt die Wahl über den Rand (DP70: 12 px).
  await page.evaluate(() => {
    const s = document.styleSheets[0]!;
    s.insertRule(
      'dialog .chip{max-width:none !important;white-space:nowrap !important;min-width:260px !important}',
      s.cssRules.length,
    );
  });
  expect((await ueberRand(page, 'dialog .chip')).length).toBeGreaterThan(0);
});

test('DP70 K1-3: 200 % Zoom (195 × 422), Liste bei „Bewerben“ bricht an den Trennstellen um; Gegenprobe', async ({
  page,
}) => {
  await page.setViewportSize({ width: 195, height: 422 });
  await szenarioLaden(page, '01-standard', '/');
  await hefteAnlegen(page, [
    {
      id: 'k13',
      createdAt: new Date(2026, 10, 9, 12).toISOString(),
      updatedAt: new Date(2026, 10, 9, 12).toISOString(),
      haushaltId: null,
      adresse: 'Lindenring 3\n20259 Hamburg',
      link: null,
      quelle: '',
      inseratText: null,
      kennung: 'k-k13',
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
      einzug: '',
      angaben: null,
    },
  ]);
  await page.goto('/#/heft/k13/bewerben');
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Bewerben mit wenigen Tipps' }),
  ).toBeVisible();
  // Die Liste trägt die langen Namen mit weicher Trennstelle.
  await page.getByRole('button', { name: 'Alles mitschicken' }).click();
  const namen = await page.locator('.mp span').allTextContents();
  expect(
    namen.some((n) => n.includes('­')),
    JSON.stringify(namen),
  ).toBe(true);
  expect(await ueberRand(page, '.mp span')).toEqual([]);
  // Gegenprobe: ohne Trennstellen und ohne Notumbruch ragt ein langer Name über den Rand.
  await page.evaluate(() => {
    const s = document.styleSheets[0]!;
    s.insertRule('.mp span{white-space:nowrap !important}', s.cssRules.length);
    for (const el of document.querySelectorAll('.mp span'))
      el.textContent = (el.textContent ?? '').replaceAll('­', '');
  });
  expect((await ueberRand(page, '.mp span')).length).toBeGreaterThan(0);
});
