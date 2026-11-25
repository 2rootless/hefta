import { expect, test, type Page } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';
import { stimmungMuster } from './stimmung-muster';

/** W37: „Alles da …“ wechselt täglich (P4); jede Fassung zählt. */
const startklar = stimmungMuster('P4', { teil: 'satz', an: 'ihr' });

// DP74, Teil 1 (PC109, F7): Ein Name ohne Nachnamen (C3). NN1 bis NN11 aus pruef74.py, die acht Gegenproben aus
// DP74, Abschnitt 6, und die beiden Fälle aus Abschnitt 4, in Chromium und WebKit (W12), hell und dunkel, 390 px
// und 320 px mit 130 %. Haushalt: der fertige Musterhaushalt (04-fertig), Max heißt hier Aylin, ohne Nachnamen.

/** Musterhaushalt „alles da“, aus Max wird Aylin ohne Nachnamen. */
async function aylin(page: Page) {
  await szenarioLaden(page, '04-fertig', '/');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, fehler) => {
      const r = indexedDB.open('hefta');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => fehler(r.error);
    });
    const tx = db.transaction('personen', 'readwrite');
    const ort = tx.objectStore('personen');
    const alle = await new Promise<{ id: string; vorname: string }[]>((ok) => {
      const r = ort.getAll();
      r.onsuccess = () => ok(r.result as { id: string; vorname: string }[]);
    });
    const max = alle.find((p) => p.vorname === 'Max')!;
    ort.put({ ...max, vorname: 'Aylin', nachname: '', rufname: '' });
    await new Promise((ok) => (tx.oncomplete = ok));
    db.close();
  });
  await page.goto('/#/');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

const punkt = (page: Page) => page.getByRole('link', { name: /^Nachname von Aylin/ });

/** W10, NN4: Am offenen Punkt steht kein „fehlt“. */
const ohneFehlt = (text: string) => !/fehlt/i.test(text);
/** NN5 (W14): kein doppeltes Leerzeichen, kein Leerzeichen vor Satzzeichen, kein „undefined“ oder „null“. */
const sauber = (text: string) => !/ {2}| [,.;:!?]|undefined|\bnull\b/.test(text);

/** Zustand des Kästchens unter „Aylin ändern“, mit Maßen und Farben. */
function messen(page: Page) {
  return page.evaluate(() => {
    const kanal = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const rgb = (farbe: string) => {
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(farbe);
      return m ? { r: +m[1]!, g: +m[2]!, b: +m[3]!, a: m[4] === undefined ? 1 : +m[4] } : null;
    };
    const hell = (farbe: string) => {
      const c = rgb(farbe)!;
      return 0.2126 * kanal(c.r) + 0.7152 * kanal(c.g) + 0.0722 * kanal(c.b);
    };
    const kontrast = (a: string, b: string) => {
      const [x, y] = [hell(a), hell(b)].sort((p, q) => q - p);
      return Math.round(((x! + 0.05) / (y! + 0.05)) * 100) / 100;
    };
    const grund = (e: Element | null): string => {
      for (let el = e; el; el = el.parentElement) {
        const c = rgb(getComputedStyle(el).backgroundColor);
        if (c && c.a > 0.5) return getComputedStyle(el).backgroundColor;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    // Bei 130 % (zoom) liefert der Browser vergrößerte Maße; gemessen wird in CSS-Pixeln wie in DP74.
    const zoom = parseFloat(document.documentElement.style.getPropertyValue('zoom') || '1') || 1;
    const kasten = (e: Element) => {
      const r = e.getBoundingClientRect();
      return {
        top: r.top / zoom,
        bottom: r.bottom / zoom,
        left: r.left / zoom,
        right: r.right / zoom,
        width: r.width / zoom,
        height: r.height / zoom,
      };
    };
    const feld = document.querySelector<HTMLInputElement>('input[autocomplete="family-name"]')!;
    const zeile = document.querySelector<HTMLElement>('label.ohne-nachname')!;
    const box = zeile.querySelector<HTMLElement>('.kaestchen')!;
    const text = zeile.querySelector<HTMLElement>('.ohne-text')!;
    const haken = zeile.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    const satz = document.querySelector<HTMLElement>('.ohne-satz')!;
    const danach = document.querySelector<HTMLElement>('p.rufname')!;
    const leiste = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Speichern',
    )!;
    const s = (e: Element, p?: string) => getComputedStyle(e, p);
    const g = grund(zeile);
    return {
      gesetzt: haken.checked,
      text: text.textContent?.trim() ?? '',
      beschreibung:
        document.getElementById(haken.getAttribute('aria-describedby') ?? '')?.textContent ?? '',
      feldWert: feld.value,
      feldNurLesen: feld.readOnly,
      platzhalter: feld.placeholder,
      zeileHoehe: Math.round(kasten(zeile).height),
      box: [Math.round(kasten(box).width), Math.round(kasten(box).height)],
      luecke: Math.round(kasten(text).left - kasten(box).right),
      feldZeile: Math.round(kasten(zeile).top - kasten(feld).bottom),
      zeileSatz: Math.round(kasten(satz).top - kasten(zeile).bottom),
      satzDanach: Math.round(kasten(danach).top - kasten(satz).bottom),
      satzEinzug: Math.round(kasten(satz).left - kasten(zeile).left),
      kontrastText: kontrast(s(text).color, g),
      kontrastSatz: kontrast(s(satz).color, g),
      kontrastRand: kontrast(s(box).borderTopColor, g),
      kontrastGesetzt: kontrast(s(box).backgroundColor, g),
      kontrastPlatzhalter: kontrast(s(feld, '::placeholder').color, grund(feld)),
      farben: [s(box).borderTopColor, s(box).backgroundColor, s(text).color, s(satz).color],
      fokusRing: s(box).outlineStyle !== 'none' && parseFloat(s(box).outlineWidth) >= 3,
      fokusInnen: /inset/.test(s(box).boxShadow),
      ueberLeiste: kasten(satz).bottom <= kasten(leiste).top,
      // NN2 nach der W30-Regel: Der Satz steht mindestens 8 px über dem Beginn des Verlaufs, nicht nur über dem Knopf.
      ueberVerlauf: Math.round(kasten(leiste.closest('.leiste')!).top - kasten(satz).bottom),
      ueberlauf:
        zeile.scrollWidth > zeile.clientWidth + 1 ||
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      rot: getComputedStyle(document.documentElement).getPropertyValue('--accent-text').trim(),
    };
  });
}
type Mass = Awaited<ReturnType<typeof messen>>;

const rotWert = (hex: string) => {
  const h = hex.replace('#', '');
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
};

/** Verstöße gegen NN6 bis NN11 an einer Messung. */
function verstoesse(m: Mass): string[] {
  const f: string[] = [];
  if (m.text !== 'Aylin hat keinen Nachnamen') f.push(`NN6 Text: ${m.text}`);
  if (m.beschreibung !== 'Dann fragt Hefta nicht mehr danach.') f.push('NN6 Beschreibung');
  if (m.kontrastText < 4.5 || m.kontrastSatz < 4.5) f.push('NN7 Text');
  if (m.kontrastRand < 3) f.push('NN7 Rand');
  if (m.gesetzt && m.kontrastGesetzt < 3) f.push('NN7 gesetzt');
  if (m.gesetzt && m.kontrastPlatzhalter < 4.5) f.push('NN7 kein Nachname');
  if (m.zeileHoehe < 44) f.push(`NN8 Zeile ${m.zeileHoehe}`);
  if (m.box[0] !== 24 || m.box[1] !== 24) f.push(`NN9 Kästchen ${m.box}`);
  if (m.luecke !== 12) f.push(`NN9 Lücke ${m.luecke}`);
  if (m.feldZeile !== 8 || m.zeileSatz !== 4 || m.satzDanach !== 8)
    f.push(`NN9 Abstände ${m.feldZeile}, ${m.zeileSatz}, ${m.satzDanach}`);
  if (m.satzEinzug !== 36) f.push(`NN9 Einzug ${m.satzEinzug}`);
  if (m.farben.includes(rotWert(m.rot))) f.push('NN10 Rot');
  if (m.ueberlauf) f.push('NN11 Überlauf');
  return f;
}

async function oeffnenVomPunkt(page: Page) {
  await expect(punkt(page)).toBeVisible();
  await punkt(page).click();
  await expect(page).toHaveURL(/#\/person-aendern\/[\w-]+\/nachname$/);
  await expect(page.locator('label.ohne-nachname')).toBeVisible();
}

for (const [breite, zoom, schema] of [
  [390, 1, 'light'],
  [390, 1, 'dark'],
  [320, 1.3, 'light'],
  [320, 1.3, 'dark'],
] as const) {
  const art = `${breite} px${zoom !== 1 ? ' mit 130 %' : ''}, ${schema === 'light' ? 'hell' : 'dunkel'}`;

  test(`NN2, NN4, NN6 bis NN11: vergessen, vom Punkt zum Kästchen, Haken aus und an, ${art}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: schema });
    // Bei 320 px die Höhe des kleinsten iPhones (568 px), wie der Prüfkatalog in 320-text130 (NN2 mit Verlauf).
    await page.setViewportSize({ width: breite, height: breite === 320 ? 568 : 844 });
    await aylin(page);
    if (zoom !== 1)
      await page.evaluate(
        (z) => document.documentElement.style.setProperty('zoom', String(z)),
        zoom,
      );
    // NN2, NN4: Der offene Punkt bleibt, nennt den Haken und sagt nicht „fehlt“.
    const text = (await punkt(page).innerText()).replace(/\s+/g, ' ').trim();
    expect(text).toBe(
      'Nachname von Aylin Für Deckblatt und Selbstauskunft. Hat Aylin keinen, reicht ein Haken.',
    );
    expect(ohneFehlt(text) && sauber(text)).toBe(true);
    await oeffnenVomPunkt(page);
    if (zoom !== 1)
      await page.evaluate(
        (z) => document.documentElement.style.setProperty('zoom', String(z)),
        zoom,
      );
    // Den Fokus hat die Überschrift „Über Aylin“, nicht das Feld.
    await expect(page.getByRole('heading', { level: 2, name: 'Über Aylin' })).toBeFocused();
    const aus = await messen(page);
    expect(aus.ueberLeiste, 'Feld, Haken und Satz über der Leiste').toBe(true);
    expect(aus.ueberVerlauf, 'Satz mindestens 8 px über dem Verlauf').toBeGreaterThanOrEqual(8);
    expect(verstoesse(aus)).toEqual([]);
    expect(aus.feldNurLesen).toBe(false);
    // NN3: mit Haken leer, nicht beschreibbar, „kein Nachname“.
    await page.getByRole('checkbox', { name: 'Aylin hat keinen Nachnamen' }).check();
    const an = await messen(page);
    expect(verstoesse(an)).toEqual([]);
    expect([an.gesetzt, an.feldWert, an.feldNurLesen, an.platzhalter]).toEqual([
      true,
      '',
      true,
      'kein Nachname',
    ]);
  });
}

test('NN1, NN3: Haken setzen und speichern, danach kein offener Punkt, „Alles da“; bleibt nach dem Neuladen', async ({
  page,
}) => {
  await aylin(page);
  await expect(page.getByText(startklar)).toHaveCount(0);
  await oeffnenVomPunkt(page);
  await page.getByRole('checkbox', { name: 'Aylin hat keinen Nachnamen' }).check();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible();
  await expect(punkt(page)).toHaveCount(0);
  await expect(page.getByText(startklar)).toBeVisible();
  await page.reload();
  await expect(page.getByText(startklar)).toBeVisible();
  await expect(punkt(page)).toHaveCount(0);
  // Unter „Aylin ändern“ steht der Haken; die Personenseite bleibt, wie sie ist.
  const person = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok) => {
      const r = indexedDB.open('hefta');
      r.onsuccess = () => ok(r.result);
    });
    const r = db.transaction('personen').objectStore('personen').getAll();
    const alle = await new Promise<{ vorname: string; nachname: string; ohneNachname?: boolean }[]>(
      (ok) => (r.onsuccess = () => ok(r.result as never)),
    );
    db.close();
    return alle.find((p) => p.vorname === 'Aylin')!;
  });
  expect([person.nachname, person.ohneNachname]).toEqual(['', true]);
});

test('Fall „Haken aus Versehen“: Haken weg, dann fragt Hefta wieder; ein getippter Nachname kommt zurück', async ({
  page,
}) => {
  await aylin(page);
  await oeffnenVomPunkt(page);
  const feld = page.getByLabel('Nachname', { exact: true });
  await feld.fill('Muster');
  const haken = page.getByRole('checkbox', { name: 'Aylin hat keinen Nachnamen' });
  await haken.check();
  await expect(feld).toHaveValue('');
  await haken.uncheck();
  await expect(feld).toHaveValue('Muster');
  await feld.fill('');
  await haken.check();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible();
  await expect(punkt(page)).toHaveCount(0);
  // Haken wieder weg: Der offene Punkt kommt zurück.
  await page.goto('/#/haushalt');
  await expect(page.getByRole('heading', { level: 1, name: 'Euer Haushalt' })).toBeVisible();
  // W54: Der Name in den Fächern führt zur Personenseite.
  await page.locator('.faecher a.text', { hasText: 'Aylin' }).click();
  await expect(page.locator('label.ohne-nachname')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Aylin hat keinen Nachnamen' }).uncheck();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Euer Haushalt' })).toBeVisible();
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible();
  await expect(punkt(page)).toBeVisible();
});

test('Fall „Nachname vergessen“: Nachnamen eintragen, danach startklar', async ({ page }) => {
  await aylin(page);
  await oeffnenVomPunkt(page);
  await page.getByLabel('Nachname', { exact: true }).fill('Muster');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(punkt(page)).toHaveCount(0);
  await expect(page.getByText(startklar)).toBeVisible();
});

test('NN8: Fokus als Ring am Kästchen, kein Tintenrand innen (W33)', async ({ page }) => {
  await aylin(page);
  await oeffnenVomPunkt(page);
  // Erst nimmt die Seite den Fokus auf die Überschrift (wie oben); unter Last kam das nach dem Fokus aufs Feld,
  // und der Tab begann an der Überschrift (NN8 in WebKit, 18.11.).
  await expect(page.getByRole('heading', { level: 2, name: 'Über Aylin' })).toBeFocused();
  await page.getByLabel('Nachname', { exact: true }).focus();
  await expect(page.getByLabel('Nachname', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('checkbox', { name: 'Aylin hat keinen Nachnamen' })).toBeFocused();
  const m = await messen(page);
  expect([m.fokusRing, m.fokusInnen]).toEqual([true, false]);
});

test('Gegenproben aus DP74, Abschnitt 6: jede wird rot', async ({ page }) => {
  await aylin(page);
  await oeffnenVomPunkt(page);
  // Die CSP der App sperrt eingefügte <style>; Regeln gehen über das CSSOM (wie im Test zu W36).
  const regel = (css: string) =>
    page.evaluate((c) => {
      const blatt = document.styleSheets[0]!;
      blatt.insertRule(c, blatt.cssRules.length);
      (window as unknown as { gegenproben?: number }).gegenproben =
        ((window as unknown as { gegenproben?: number }).gegenproben ?? 0) + 1;
    }, css);
  const weg = () =>
    page.evaluate(() => {
      const blatt = document.styleSheets[0]!;
      const w = window as unknown as { gegenproben?: number };
      for (; w.gegenproben; w.gegenproben--) blatt.deleteRule(blatt.cssRules.length - 1);
    });
  const haken = page.getByRole('checkbox', { name: 'Aylin hat keinen Nachnamen' });
  expect(verstoesse(await messen(page))).toEqual([]);

  await regel('.kaestchen{border-color:#d9cfc2 !important}');
  expect(verstoesse(await messen(page))).toContain('NN7 Rand');
  await weg();

  await haken.check();
  await regel(
    '.ohne-nachname input:checked + .kaestchen{background:var(--accent-text) !important}',
  );
  expect(verstoesse(await messen(page))).toContain('NN10 Rot');
  await weg();

  await regel('.ohne-nachname{min-height:36px !important;height:36px}');
  expect(verstoesse(await messen(page)).some((x) => x.startsWith('NN8'))).toBe(true);
  await weg();

  await regel('.ohne-nachname{gap:14px !important}');
  expect(verstoesse(await messen(page))).toContain('NN9 Lücke 14');
  await weg();

  await page.getByLabel('Nachname', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await regel(
    '.ohne-nachname input:focus-visible + .kaestchen{outline:none !important;box-shadow:inset 0 0 0 1.5px var(--ink) !important}',
  );
  const fokus = await messen(page);
  expect([fokus.fokusRing, fokus.fokusInnen]).toEqual([false, true]);
  await weg();

  // Die Texte: alter Wortlaut, zwei Leerzeichen, Leerzeichen vor dem Komma.
  expect(ohneFehlt('Nachname von Aylin fehlt')).toBe(false);
  expect(sauber('Max und Aylin  und Lea')).toBe(false);
  expect(sauber('Aylin , Lea und Max')).toBe(false);
});
