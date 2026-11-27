import { devices, expect, test, type Browser, type Page } from '@playwright/test';
import { PERSONENFARBEN } from '../../src/domain/personenfarben';
import type { Szenario } from './szenarien';
import { szenarioLaden } from './szenario-laden';

// wunsch-W54 (PC199, DP128 mit DP129): Der Haushalt als vier Fächer, verschieben am Griff, Ziele per Tipp, eine
// Ansprechperson per Wahlpunkt, Vertrag nie leer, Zeile danach mit „Rückgängig“. Designs Prüfkatalog aus
// pruef128.py gegen die echte App: N1–N9 statisch (Zustände × 390 und 320 mit 130 % × hell und dunkel) und G1–G10 in
// der Bedienung, jede Prüfung mit ihrer Gegenprobe. Der Stand kommt aus der Datenbank, nicht aus der Anzeige.

type Person = Szenario['personen'][number];
const person = (vorname: string, rolle: Person['rolle']): Person => ({
  vorname,
  bezeichnung: 'neutral',
  rolle,
  lage: 'angestellt',
  unterlagen: {},
});
const HAUSHALTE: Record<string, Szenario> = {
  A: {
    id: 'dp128-a',
    kinder: 1,
    personen: [person('Jarne', 'vertrag'), person('Selin', 'vertrag'), person('Hiltrud', 'buerge')],
  },
  B: {
    id: 'dp128-b',
    kinder: 2,
    personen: [person('Mai Linh', 'vertrag'), person('Konstantin', 'vertrag')],
  },
  C: { id: 'dp128-c', personen: [person('Ronja', 'vertrag'), person('Detlef', 'buerge')] },
  C5: { id: 'dp128-c5', personen: [person('Ronja', 'vertrag')] },
};
/** Zugehörigkeit einer Person im Haushalt, wie die Testdaten sie anlegen. */
const zid = (h: string, i: number) => `z-p-${HAUSHALTE[h]!.id}-${i}`;
const ID = {
  jarne: zid('A', 0),
  selin: zid('A', 1),
  hiltrud: zid('A', 2),
  konstantin: zid('B', 1),
  ronja: zid('C', 0),
  ronja5: zid('C5', 0),
};

const GROESSEN = {
  '390': { width: 390, height: 844 },
  // 320 px mit 130 % Zoom wie bei Design: 320 / 1,3 = 246 CSS-Pixel
  '320-130': { width: 246, height: 532 },
} as const;
type Groesse = keyof typeof GROESSEN;

const SHY = String.fromCharCode(0xad);
const APP_FARBEN = PERSONENFARBEN.map((f) => {
  const h = f.app.replace('#', '');
  return `rgb(${[0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`;
});
const ohneShy = (s: string | null | undefined) => (s ?? '').split(SHY).join('');

async function neu(
  browser: Browser,
  h: string,
  o: { groesse?: Groesse; schema?: 'light' | 'dark'; ruhig?: boolean } = {},
) {
  const ctx = await browser.newContext({
    ...devices['iPhone 13'],
    baseURL: 'http://localhost:4173',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    // Die Gegenproben stören mit eingefügtem CSS; die App erlaubt sonst nur eigene Stile.
    bypassCSP: true,
    viewport: GROESSEN[o.groesse ?? '390'],
    colorScheme: o.schema ?? 'light',
    reducedMotion: o.ruhig ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  await szenarioLaden(page, HAUSHALTE[h]!, '/haushalt');
  await page.locator('.faecher').waitFor();
  return { ctx, page };
}

/** Der gespeicherte Stand: je Person Fach und Reihenfolge, dazu die Ansprechperson, aus IndexedDB. */
async function stand(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, f) => {
      const r = indexedDB.open('hefta');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => f(r.error);
    });
    const alle = <T>(ort: string) =>
      new Promise<T[]>((ok) => {
        const r = db.transaction(ort).objectStore(ort).getAll();
        r.onsuccess = () => ok(r.result as T[]);
      });
    type Z = {
      personId: string;
      rolle: string;
      herausgenommenAm: string | null;
      ziehtMitEin?: boolean;
      reihenfolge: number;
    };
    const zs = await alle<Z>('zugehoerigkeiten');
    const ps = await alle<{ id: string; vorname: string }>('personen');
    const hs = await alle<{ ansprechpersonId?: string | null; weitereErwachsene: number }>(
      'haushalte',
    );
    db.close();
    const name = (id: string) => ps.find((p) => p.id === id)?.vorname ?? id;
    const fach = (z: Z) =>
      z.herausgenommenAm
        ? z.ziehtMitEin
          ? 'nurmit'
          : 'weg'
        : z.rolle === 'buerge'
          ? 'buerge'
          : 'vertrag';
    return JSON.stringify({
      personen: [...zs]
        .sort((a, b) => a.reihenfolge - b.reihenfolge)
        .map((z) => `${name(z.personId)}:${fach(z)}`),
      // Ohne gespeicherte Wahl ist die erste Person im Vertrag Ansprechperson (E366).
      ansprech: hs[0]?.ansprechpersonId
        ? name(hs[0].ansprechpersonId)
        : (() => {
            const z = [...zs]
              .sort((a, b) => a.reihenfolge - b.reihenfolge)
              .find((z) => fach(z) === 'vertrag');
            return z ? name(z.personId) : null;
          })(),
      weitere: hs[0]?.weitereErwachsene ?? 0,
    });
  });
}
const imVertrag = async (page: Page) =>
  (JSON.parse(await stand(page)) as { personen: string[] }).personen
    .filter((p) => p.endsWith(':vertrag'))
    .map((p) => p.split(':')[0]);

/** Wo die Anzeige eine Person führt (nach dem Neuladen). */
const fachInAnzeige = (page: Page, id: string) =>
  page.evaluate(
    (id) =>
      document
        .querySelector(`.faecher [data-gruppe] [data-id="${id}"]`)
        ?.closest<HTMLElement>('[data-gruppe]')?.dataset.gruppe ?? null,
    id,
  );

const ruhe = (page: Page) =>
  page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => 0))));

async function ziehe(page: Page, id: string, ziel: string, halt = false) {
  const g = (await page.locator(`[data-griff="${id}"]`).boundingBox())!;
  let zb = (await page.locator(`[data-gruppe="${ziel}"]`).boundingBox())!;
  const x0 = g.x + g.width / 2;
  const y0 = g.y + g.height / 2;
  const x1 = zb.x + zb.width * 0.6;
  // PC220: Unten über der Leiste scrollt die Seite beim Ziehen mit (72 px). Liegt das Ziel dort, hält der Zug am Rand,
  // bis das Fach hochgekommen ist, wie ein Mensch es täte; gehalten und losgelassen wird außerhalb der Zone.
  const leiste = await page.evaluate(() => {
    const l = document.querySelector<HTMLElement>('.leiste');
    return l ? l.getBoundingClientRect().top : window.innerHeight;
  });
  const frei = leiste - 80;
  const weg = async (x: number, y: number, xa: number, ya: number) => {
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(xa + ((x - xa) * i) / 12, ya + ((y - ya) * i) / 12);
      await page.waitForTimeout(15);
    }
  };
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  let y1 = Math.min(zb.y + zb.height - 10, frei);
  if (zb.y + 20 > frei) {
    await weg(x1, leiste - 16, x0, y0);
    for (let t = 0; t < 40; t++) {
      await page.waitForTimeout(100);
      zb = (await page.locator(`[data-gruppe="${ziel}"]`).boundingBox())!;
      if (zb.y + 20 < frei) break;
    }
    await page.mouse.move(x1, frei);
    await page.waitForTimeout(150);
    zb = (await page.locator(`[data-gruppe="${ziel}"]`).boundingBox())!;
    y1 = Math.min(zb.y + zb.height / 2, frei);
    await page.mouse.move(x1, y1);
    await page.waitForTimeout(150);
  } else await weg(x1, y1, x0, y0);
  if (halt) return;
  await page.mouse.up();
  await page.waitForTimeout(260);
  await ruhe(page);
}

async function zielTipp(page: Page, id: string, ziel: string) {
  await page.locator(`[data-griff="${id}"]`).click();
  await page.locator(`[data-ziele="${id}"] [data-z="${ziel}"]`).click();
  await page.waitForTimeout(260);
  await ruhe(page);
}

const folgeText = async (page: Page) =>
  ohneShy(await page.locator('.faecher .folge p').textContent({ timeout: 2000 }));

// ---------------------------------------------------------------- N1–N9 statisch

type Befund = Record<string, { ok: boolean; info: string[] }>;

/** Designs statisch.js, auf die Fächer der App bezogen (M1 Überlauf auch für die ganze Seite). */
function pruefen(page: Page, ihr: boolean): Promise<Befund> {
  return page.evaluate(
    ({ ihr, farben, breite }) => {
      const wurzel = document.querySelector('.faecher')!;
      // Die eingestellte Breite: Mit der iPhone-Nachbildung wächst innerWidth mit überbreitem Inhalt mit.
      const vw = breite;
      const res: Record<string, { ok: boolean; info: string[] }> = {};
      const sicht = (e: Element) => {
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        for (let x: Element | null = e; x; x = x.parentElement) {
          const s = getComputedStyle(x);
          if (s.display === 'none' || s.visibility === 'hidden' || (x as HTMLElement).hidden)
            return false;
        }
        return true;
      };
      const els = [...wurzel.querySelectorAll('*')].filter(sicht);
      const rgb = (s: string) => {
        const m = s.match(/[\d.]+/g);
        return m ? m.slice(0, 4).map(Number) : null;
      };
      const lum = (c: number[]) => {
        const f = (v: number) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
      };
      const kr = (x: number[], y: number[]) => {
        const A = lum(x);
        const B = lum(y);
        return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
      };
      const grund = (e: Element) => {
        for (let x: Element | null = e; x; x = x.parentElement) {
          const c = rgb(getComputedStyle(x).backgroundColor);
          if (c && (c.length < 4 || c[3]! > 0.99)) return c;
        }
        return rgb(getComputedStyle(document.body).backgroundColor)!;
      };
      const textEls = els.filter((e) =>
        [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()),
      );
      // M1 Überlauf
      const ue: string[] = [];
      if (document.documentElement.scrollWidth > vw + 0.5) ue.push('Seite');
      for (const e of els) {
        const r = e.getBoundingClientRect();
        if (r.right > vw + 0.5 || r.left < -0.5) ue.push(e.className + ' ' + Math.round(r.right));
      }
      for (const e of textEls)
        if (getComputedStyle(e).display !== 'inline' && e.scrollWidth > e.clientWidth + 1)
          ue.push('Text ' + e.textContent!.trim().slice(0, 20));
      for (const b of wurzel.querySelectorAll('.text b')) {
        if (!sicht(b)) continue;
        const lh = parseFloat(getComputedStyle(b).lineHeight);
        if (b.getBoundingClientRect().height > lh * 1.5 && !/\s/.test(b.textContent!.trim()))
          ue.push('Name zerbrochen: ' + b.textContent);
        // Der Name bleibt in seiner Zeile.
        const zeile = b.closest('.zeile')!.getBoundingClientRect();
        if (b.getBoundingClientRect().right > zeile.right + 0.5)
          ue.push('Name ragt aus der Zeile: ' + b.textContent!.trim().slice(0, 20));
      }
      res.N1 = { ok: !ue.length, info: ue.slice(0, 4) };
      // M2 Kontrast
      const ko: string[] = [];
      for (const e of textEls) {
        let o = 1;
        for (let q: Element | null = e; q; q = q.parentElement)
          o *= parseFloat(getComputedStyle(q).opacity);
        if (o < 0.99) continue;
        const k = kr(rgb(getComputedStyle(e).color)!, grund(e));
        if (k < 4.5) ko.push(e.textContent!.trim().slice(0, 16) + ' ' + k.toFixed(2));
      }
      for (const s of wurzel.querySelectorAll('svg')) {
        if (!sicht(s)) continue;
        const k = kr(rgb(getComputedStyle(s).color)!, grund(s));
        if (k < 3) ko.push('Zeichen ' + k.toFixed(2));
      }
      for (const p of wurzel.querySelectorAll('.ap i, .zeichen.kind, .marke')) {
        if (!sicht(p)) continue;
        const k = kr(rgb(getComputedStyle(p).borderTopColor)!, grund(p.parentElement!));
        if (k < 3) ko.push(p.className + ' Rand ' + k.toFixed(2));
      }
      res.N2 = { ok: !ko.length, info: ko.slice(0, 4) };
      // M3 Rot (Siegellack) nicht in den Fächern
      const ROT = ['rgb(163, 39, 30)', 'rgb(242, 107, 91)', 'rgb(179, 38, 30)', 'rgb(138, 29, 23)'];
      const tok = getComputedStyle(document.documentElement);
      for (const t of ['--accent', '--accent-text', '--danger'])
        if (tok.getPropertyValue(t).trim()) {
          const p = document.createElement('i');
          p.style.color = `var(${t})`;
          document.documentElement.append(p);
          ROT.push(getComputedStyle(p).color);
          p.remove();
        }
      const ro: string[] = [];
      for (const e of els) {
        const s = getComputedStyle(e);
        const w = [
          s.color,
          s.backgroundColor,
          s.borderTopColor,
          s.borderBottomColor,
          s.boxShadow,
          s.outlineColor,
        ];
        if (w.some((v) => v && ROT.some((r) => v.includes(r))) && !e.closest('.flug'))
          ro.push(e.tagName + '.' + e.className);
      }
      res.N3 = { ok: !ro.length, info: ro.slice(0, 4) };
      // M4 Tippflächen
      const ti: string[] = [];
      for (const e of wurzel.querySelectorAll('a,button,input')) {
        if (!sicht(e)) continue;
        const r = e.getBoundingClientRect();
        if (r.width < 43.5 || r.height < 43.5)
          ti.push(
            (e.getAttribute('aria-label') || e.textContent!.trim()).slice(0, 18) +
              ' ' +
              Math.round(r.width) +
              'x' +
              Math.round(r.height),
          );
      }
      res.N4 = { ok: !ti.length, info: ti };
      // M5 Wortlaut
      const txt =
        (wurzel as HTMLElement).innerText +
        ' ' +
        [...wurzel.querySelectorAll('[aria-label]')]
          .map((e) => e.getAttribute('aria-label'))
          .join(' ');
      const vb =
        txt.match(
          /\b(Hauptmiet\w*|Mitmiet\w*|muss|müsst|Pflicht|Achtung|wir|uns|super|einfach|endlich|garantiert|gültig|ungültig)\b|!|vorn im Mietvertrag/gi,
        ) ?? [];
      res.N5 = { ok: !vb.length, info: vb };
      // M6 Anrede
      const sichtText = els
        .map((e) =>
          [...e.childNodes]
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent)
            .join(' '),
        )
        .join(' ');
      const fa = ihr
        ? /\b(du|dich|dir|dein\w*|holst|speicherst|brauchst)\b/gi
        : /\b(ihr|euch|eure?\w*|speichert)\b|holt ihr|braucht ihr/gi;
      const af = sichtText.match(fa) ?? [];
      res.N6 = { ok: !af.length, info: af };
      // M7 Raster
      const RA = new Set([0, 4, 8, 12, 16, 20, 24, 32, 48, 64]);
      const RD = new Set([0, 6, 16, 20, 22, 999]);
      const ra: string[] = [];
      for (const e of els) {
        const s = getComputedStyle(e) as unknown as Record<string, string>;
        for (const k of [
          'marginTop',
          'marginRight',
          'marginBottom',
          'marginLeft',
          'paddingTop',
          'paddingRight',
          'paddingBottom',
          'paddingLeft',
          'rowGap',
          'columnGap',
        ]) {
          const v = s[k];
          if (!v || v === 'normal' || v === 'auto') continue;
          const n = Math.abs(parseFloat(v));
          if (!RA.has(Math.round(n * 100) / 100)) ra.push(e.className + ' ' + k + ' ' + v);
        }
        for (const k of [
          'borderTopLeftRadius',
          'borderTopRightRadius',
          'borderBottomLeftRadius',
          'borderBottomRightRadius',
        ]) {
          const n = parseFloat(s[k]!);
          if (!RD.has(n)) ra.push(e.className + ' ' + k + ' ' + s[k]);
        }
      }
      res.N7 = { ok: !ra.length, info: ra.slice(0, 4) };
      // M8 genau eine Ansprechperson, die erste im Vertrag; die vier Fächer in dieser Reihenfolge
      const erste = wurzel.querySelector<HTMLElement>('[data-gruppe="vertrag"] [data-id]');
      const an = [...wurzel.querySelectorAll<HTMLElement>('.ap[aria-checked="true"]')];
      const m8 =
        an.length === 1 &&
        an[0]!.closest<HTMLElement>('[data-id]') === erste &&
        wurzel.querySelectorAll('.marke').length === 1;
      const gr = [...wurzel.querySelectorAll('.kopf h2')].map((e) => e.textContent).join('|');
      res.N9 = {
        ok: m8 && gr === 'Im Mietvertrag|Zieht mit ein|Bürgt|Nicht mehr dabei',
        info: [an.length + ' Wahlpunkte', gr],
      };
      // M12 Personenfarben: Pastell mit Tinte (Kontrast ab 4,5), Kind ohne eigene Farbe
      const pf: string[] = [];
      for (const z of wurzel.querySelectorAll('.zeichen')) {
        const s = getComputedStyle(z);
        if (z.classList.contains('kind') || z.classList.contains('leer-zeichen')) {
          const zeile = getComputedStyle(z.closest('.zeile')!).backgroundColor;
          if (s.backgroundColor !== zeile && s.backgroundColor !== 'rgba(0, 0, 0, 0)')
            pf.push('Kind mit Farbe');
          continue;
        }
        // Personenfarben aus den Tokens (B14), Buchstabe immer in dunkler Tinte, hell wie dunkel (DP128)
        const PASTELL = farben;
        const hg = rgb(s.backgroundColor)!;
        if (!PASTELL.includes(s.backgroundColor)) pf.push('Farbe ' + s.backgroundColor);
        if (s.color !== 'rgb(38, 34, 30)') pf.push('Buchstabe ' + s.color);
        if (kr(rgb(s.color)!, hg) < 4.5) pf.push('Kontrast ' + kr(rgb(s.color)!, hg).toFixed(2));
      }
      res.N8 = { ok: !pf.length, info: pf.slice(0, 4) };
      return res;
    },
    { ihr, farben: APP_FARBEN, breite: page.viewportSize()!.width },
  );
}

const IHR: Record<string, boolean> = { A: true, B: true, C: false, C5: false };
const ZUSTAENDE: Record<string, [string, (p: Page) => Promise<void>]> = {
  'A-liste': ['A', async () => {}],
  'A-ziele-selin': ['A', (p) => p.locator(`[data-griff="${ID.selin}"]`).click()],
  'B-ziele-konstantin': ['B', (p) => p.locator(`[data-griff="${ID.konstantin}"]`).click()],
  'A-folge': ['A', (p) => zielTipp(p, ID.hiltrud, 'vertrag')],
  'C5-frage': ['C5', (p) => zielTipp(p, ID.ronja5, 'weg')],
  'C-frage': ['C', (p) => zielTipp(p, ID.ronja, 'buerge')],
};

for (const [name, [h, tun]] of Object.entries(ZUSTAENDE))
  for (const groesse of Object.keys(GROESSEN) as Groesse[])
    test(`wunsch-W54, N1–N9: ${name}, ${groesse}, hell und dunkel`, async ({ browser }, info) => {
      test.skip(
        info.project.name === 'webkit' && groesse !== '390',
        'Die schmale Größe genügt in Chromium; WebKit prüft 390 hell und dunkel',
      );
      const rot: string[] = [];
      for (const schema of ['light', 'dark'] as const) {
        const { ctx, page } = await neu(browser, h, { groesse, schema });
        await tun(page);
        await page.waitForTimeout(260);
        await ruhe(page);
        for (const [k, v] of Object.entries(await pruefen(page, IHR[h]!)))
          if (!v.ok) rot.push(`${k} ${schema}: ${v.info.join('; ')}`);
        await ctx.close();
      }
      expect(rot).toEqual([]);
    });

// Gegenproben zu N1–N9: jede Störung muss genau ihre Prüfung rot machen (320 mit 130 %, hell).
const GEGEN_N: [string, string, string | null, ((p: Page) => Promise<unknown>) | null][] = [
  [
    'N1',
    'Wahlpunkt bleibt neben dem Namen (Fassung DP127)',
    '@media (max-width:300px){.zeile{flex-wrap:nowrap!important}.ap{order:0!important;flex-basis:auto!important;width:44px!important;padding-left:0!important}.apt{display:none!important}.text b{overflow-wrap:anywhere!important}.zeile .text{flex-basis:0!important}.zeile .griff{order:0!important}.ap{flex:none!important}}',
    // Mit dem längsten Namen der Namensliste (W40): Auf Linux setzt die Schrift schmaler, und „Jarne“ passte dort
    // auch in die alte Fassung (GitHub, 2.2). „Konstantin“ zerbricht in ihr überall; die echte Fassung hält ihn (DP130).
    (p) =>
      p.evaluate(
        () => (document.querySelector('.faecher .text b')!.firstChild!.textContent = 'Konstantin'),
      ),
  ],
  [
    'N1',
    'langer Name ohne Umbruch',
    null,
    (p) =>
      p.evaluate(() =>
        document
          .querySelector('.faecher .text b')!
          .insertAdjacentHTML(
            'beforeend',
            '<span style="white-space:nowrap"> Konstantin Meyer-Ellerbrock Bürgschaftserklärung</span>',
          ),
      ),
  ],
  ['N2', 'leere Gruppe in --line-strong', '.leer{color:var(--line-strong)!important}', null],
  ['N3', 'Folgezeile in Siegellack', '.folge{background:var(--accent-text)!important}', null],
  [
    'N4',
    'Griff 32 px',
    '.griff{width:32px!important;height:32px!important;min-height:0!important;padding:0!important}',
    null,
  ],
  [
    'N5',
    '„Jarne wird Hauptmieter!“',
    null,
    (p) =>
      p.evaluate(
        () => (document.querySelector('.faecher .satz')!.textContent = 'Jarne wird Hauptmieter!'),
      ),
  ],
  [
    'N6',
    'du-Satz im ihr-Haushalt',
    null,
    (p) =>
      p.evaluate(
        () => (document.querySelector('.faecher .satz')!.textContent += ' Zieh, wen du willst.'),
      ),
  ],
  ['N7', 'Gruppe mit 18 px', '.gruppe{padding:18px!important}', null],
  [
    'N8',
    'Personenfarben wie in DP120',
    '.zeichen:not(.kind):not(.leer-zeichen){background:#956f4d!important;color:#fff!important}',
    null,
  ],
  [
    'N9',
    'Ansprechperson zweimal markiert',
    null,
    (p) =>
      p.evaluate(() =>
        document.querySelectorAll('.faecher .ap')[1]!.setAttribute('aria-checked', 'true'),
      ),
  ],
];

test('wunsch-W54, Gegenproben zu N1–N9: jede Störung macht ihre Prüfung rot', async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Gegenproben genügen in Chromium');
  const fehlt: string[] = [];
  for (const [k, text, css, js] of GEGEN_N) {
    const [h, tun] = ZUSTAENDE[k === 'N3' ? 'A-folge' : 'A-liste']!;
    const { ctx, page } = await neu(browser, h, { groesse: '320-130' });
    await tun(page);
    await page.waitForTimeout(260);
    if (css) await page.addStyleTag({ content: css });
    if (js) await js(page);
    const b = await pruefen(page, IHR[h]!);
    if (b[k]!.ok) fehlt.push(`${k} ${text}: NICHT rot`);
    await ctx.close();
  }
  expect(fehlt).toEqual([]);
});

// ---------------------------------------------------------------- G1–G10 Bedienung

test('wunsch-W54, G1: jedes Fach ist per Ziehen erreichbar und wird gespeichert', async ({
  browser,
}) => {
  const fehl: string[] = [];
  for (const [id, ziele] of [
    [ID.hiltrud, ['vertrag', 'nurmit', 'weg']],
    [ID.selin, ['nurmit', 'buerge', 'weg']],
  ] as const)
    for (const z of ziele) {
      const { ctx, page } = await neu(browser, 'A');
      await ziehe(page, id, z);
      const g = await fachInAnzeige(page, id);
      await page.reload();
      await page.locator('.faecher').waitFor();
      const nachLaden = await fachInAnzeige(page, id);
      if (g !== z || nachLaden !== z) fehl.push(`${id} -> ${z}: ${g} / nach Neuladen ${nachLaden}`);
      await ctx.close();
    }
  expect(fehl).toEqual([]);
});

async function g2(browser: Browser, stoer?: string) {
  const { ctx, page } = await neu(browser, 'A');
  if (stoer) await page.addStyleTag({ content: stoer });
  const vor = await stand(page);
  await ziehe(page, ID.selin, 'buerge', true);
  await page.waitForTimeout(250);
  const platz = await page.evaluate((id) => {
    const e = document.querySelector(`[data-gruppe="buerge"] [data-id="${id}"].platz`);
    return !!e && e.getBoundingClientRect().height > 0;
  }, ID.selin);
  const unveraendert = (await stand(page)) === vor;
  await page.mouse.up();
  await ctx.close();
  return { platz, unveraendert };
}

test('wunsch-W54, G2: Platzhalter im Ziel vor dem Loslassen, gespeichert wird erst danach', async ({
  browser,
}) => {
  expect(await g2(browser)).toEqual({ platz: true, unveraendert: true });
  // Gegenprobe: ohne sichtbaren Platzhalter wird G2 rot.
  expect((await g2(browser, '.platz{display:none!important}')).platz).toBe(false);
});

test('wunsch-W54, G3: der Vertrag wird nie leer; die Frage holt eine neue oder eine andere Person hinein', async ({
  browser,
}) => {
  // Ronja allein: Ziehen nach „Nicht mehr dabei“ fragt, wer in den Vertrag kommt.
  const { ctx, page } = await neu(browser, 'C5');
  await ziehe(page, ID.ronja5, 'weg');
  expect(await imVertrag(page)).toEqual(['Ronja']);
  await expect(page.locator('.faecher .frage')).toBeVisible();
  await page.locator('.faecher .frage input').fill('Konstantin');
  await page.locator('.faecher .frage .ok').click();
  await page.waitForTimeout(260);
  expect(await imVertrag(page)).toEqual(['Konstantin']);
  expect(await folgeText(page)).toMatch(
    /^Konstantin kommt in den Mietvertrag und ist jetzt Ansprechperson\./,
  );
  await ctx.close();
  // Ronja mit Detlef: Detlef rückt aus „Bürgt“ in den Vertrag.
  const c = await neu(browser, 'C');
  await ziehe(c.page, ID.ronja, 'buerge');
  await c.page.locator('.faecher .frage .wahl button', { hasText: 'Detlef' }).click();
  await c.page.waitForTimeout(260);
  expect(await imVertrag(c.page)).toEqual(['Detlef']);
  // Gegenprobe: ein Stand ohne Person im Vertrag fällt der Prüfung auf.
  await c.page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok) => {
      const r = indexedDB.open('hefta');
      r.onsuccess = () => ok(r.result);
    });
    const tx = db.transaction('zugehoerigkeiten', 'readwrite');
    const ort = tx.objectStore('zugehoerigkeiten');
    const alle = await new Promise<{ rolle: string }[]>((ok) => {
      const r = ort.getAll();
      r.onsuccess = () => ok(r.result as { rolle: string }[]);
    });
    for (const z of alle) ort.put({ ...z, rolle: 'buerge' });
    await new Promise((ok) => (tx.oncomplete = ok));
    db.close();
  });
  expect(await imVertrag(c.page)).toEqual([]);
  await c.ctx.close();
});

async function g4(
  browser: Browser,
  browserName: string,
  o: { groesse: Groesse; schema: 'light' | 'dark'; stoer?: boolean },
) {
  const { ctx, page } = await neu(browser, 'A', o);
  if (o.stoer)
    await page.evaluate(() =>
      document.querySelectorAll<HTMLElement>('[data-griff]').forEach((g) => (g.tabIndex = -1)),
    );
  const vor = await stand(page);
  const fokussiert = (sel: string) =>
    page.evaluate((sel) => document.activeElement?.matches(sel) ?? false, sel);
  let erreicht = false;
  if (browserName === 'chromium') {
    for (let i = 0; i < 60 && !erreicht; i++) {
      await page.keyboard.press('Tab');
      erreicht = await fokussiert(`[data-griff="${ID.jarne}"]`);
    }
  } else {
    // WebKit springt mit Tab nicht auf Knöpfe; der Fokus wird gesetzt, bedient wird mit der Tastatur.
    await page.locator(`[data-griff="${ID.jarne}"]`).focus();
    erreicht = !o.stoer;
  }
  if (!erreicht) {
    await ctx.close();
    return { erreicht };
  }
  const fokus = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement!);
    return [s.outlineStyle, s.boxShadow];
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(50);
  for (let i = 0; i < 8; i++) {
    if (await fokussiert('[data-z="buerge"]')) break;
    if (browserName === 'chromium') await page.keyboard.press('Tab');
    else await page.locator(`[data-ziele="${ID.jarne}"] [data-z="buerge"]`).focus();
  }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(260);
  await ruhe(page);
  const fach = await fachInAnzeige(page, ID.jarne);
  // Die Zeile danach kommt nach dem Speichern; der Fokus springt dann auf „Rückgängig“ (bis 2 s warten).
  const aufRueck = await page
    .waitForFunction(() => document.activeElement?.matches('.rueck') ?? false, null, {
      timeout: 2000,
    })
    .then(() => true)
    .catch(() => false);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(260);
  await ruhe(page);
  const zurueck = (await stand(page)) === vor;
  await ctx.close();
  return {
    erreicht,
    fach,
    aufRueck,
    zurueck,
    fokus: fokus[0] === 'none' && /3px/.test(fokus[1]!),
  };
}

test('wunsch-W54, G4: nur mit der Tastatur verschieben und rückgängig machen', async ({
  browser,
  browserName,
}) => {
  const soll = { erreicht: true, fach: 'buerge', aufRueck: true, zurueck: true, fokus: true };
  expect(await g4(browser, browserName, { groesse: '320-130', schema: 'light' })).toEqual(soll);
  expect(await g4(browser, browserName, { groesse: '390', schema: 'dark' })).toEqual(soll);
  // Gegenprobe: Griffe ohne Tastaturfokus sind nicht erreichbar.
  if (browserName === 'chromium')
    expect(
      (await g4(browser, browserName, { groesse: '390', schema: 'light', stoer: true })).erreicht,
    ).toBe(false);
});

async function g5(browser: Browser, stoer = false) {
  const { ctx, page } = await neu(browser, 'A');
  if (stoer)
    await page.evaluate(() =>
      document.addEventListener(
        'click',
        (e) => {
          if ((e.target as Element).closest('.rueck')) e.stopImmediatePropagation();
        },
        true,
      ),
    );
  const vor = await stand(page);
  await ziehe(page, ID.jarne, 'weg');
  const mitte = await stand(page);
  await page.locator('.faecher .rueck').click();
  await page.waitForTimeout(260);
  await ruhe(page);
  const nach = await stand(page);
  await ctx.close();
  return { veraendert: mitte !== vor, gleich: nach === vor };
}

test('wunsch-W54, G5: „Rückgängig“ stellt den gespeicherten Stand genau wieder her', async ({
  browser,
}) => {
  expect(await g5(browser)).toEqual({ veraendert: true, gleich: true });
  // Gegenprobe: ein „Rückgängig“ ohne Wirkung wird rot.
  expect((await g5(browser, true)).gleich).toBe(false);
});

test('wunsch-W54, G6: Ansprechperson per Tipp und per Tastatur, mit Zeile danach', async ({
  browser,
}) => {
  for (const weg of ['tipp', 'taste'] as const) {
    const { ctx, page } = await neu(browser, 'A');
    const ap = page.locator(`[data-id="${ID.selin}"] .ap`);
    if (weg === 'tipp') await ap.click();
    else {
      await ap.focus();
      await page.keyboard.press('Space');
    }
    await page.waitForTimeout(260);
    await ruhe(page);
    expect(JSON.parse(await stand(page)).ansprech, weg).toBe('Selin');
    expect(
      await page.evaluate(
        () =>
          document.querySelector<HTMLElement>('.faecher [data-gruppe="vertrag"] [data-id] .text b')
            ?.textContent,
      ),
      weg,
    ).toBe('Selin');
    expect(await folgeText(page), weg).toBe('Selin ist jetzt Ansprechperson.');
    await ctx.close();
  }
});

test('wunsch-W54, G7 (E366): geht die Ansprechperson, wird es die Nächste im Vertrag', async ({
  browser,
}) => {
  const { ctx, page } = await neu(browser, 'A');
  await ziehe(page, ID.jarne, 'buerge');
  expect(JSON.parse(await stand(page)).ansprech).toBe('Selin');
  expect(await folgeText(page)).toBe(
    'Jarne bürgt jetzt. Die Bürgschaftserklärung fehlt noch. Selin ist jetzt Ansprechperson.',
  );
  await ctx.close();
});

async function g8(browser: Browser, ruhig: boolean, stoer?: string) {
  const { ctx, page } = await neu(browser, 'A', { ruhig });
  if (stoer) await page.addStyleTag({ content: stoer });
  await page.evaluate(() => {
    (window as unknown as { __dauern: number[] }).__dauern = [];
    const alt = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...a: Parameters<Element['animate']>) {
      const t = a[1];
      (window as unknown as { __dauern: number[] }).__dauern.push(
        typeof t === 'number' ? t : Number(t?.duration ?? 0),
      );
      return alt.apply(this, a);
    };
  });
  await zielTipp(page, ID.hiltrud, 'vertrag');
  const d = await page.evaluate(() => (window as unknown as { __dauern: number[] }).__dauern);
  await ctx.close();
  return d;
}

test('wunsch-W54, G8: Bewegung 120–280 ms, bei „Bewegung reduzieren“ keine', async ({
  browser,
}) => {
  const normal = await g8(browser, false);
  expect(normal.length).toBeGreaterThan(0);
  expect(normal.filter((d) => d < 120 || d > 280)).toEqual([]);
  expect(await g8(browser, true)).toEqual([]);
  // Gegenprobe: 600 ms aus dem Token fallen auf.
  const lang = await g8(browser, false, ':root{--bw-mittel:600ms!important}');
  expect(lang.some((d) => d > 280)).toBe(true);
});

async function g9(browser: Browser, sprung = false) {
  const { ctx, page } = await neu(browser, 'A');
  await page.evaluate((id) => {
    const w = window as unknown as { __spur: number[] };
    w.__spur = [];
    new MutationObserver(() => {
      const e = document.querySelector(`.faecher [data-id="${id}"]`);
      // In Seitenkoordinaten: Nach dem Ablegen rollt die Seite die Zeile danach ins Bild (G11).
      if (e) w.__spur.push(Math.round(e.getBoundingClientRect().top + window.scrollY));
    }).observe(document.querySelector('.faecher')!, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }, ID.jarne);
  if (sprung)
    // Gegenprobe: der alte Weg, bei dem die Liste nach dem Loslassen kurz den alten Stand zeigt.
    await page.evaluate((id) => {
      window.addEventListener(
        'pointerup',
        () => {
          const e = document.querySelector<HTMLElement>(`.faecher [data-id="${id}"]`)!;
          e.style.marginTop = '40px';
          setTimeout(() => (e.style.marginTop = ''), 120);
        },
        { capture: true, once: true },
      );
    }, ID.jarne);
  await ziehe(page, ID.jarne, 'buerge', true);
  await page.waitForTimeout(250);
  const platz = await page.evaluate(
    (id) =>
      Math.round(
        document.querySelector(`.faecher [data-id="${id}"].platz`)!.getBoundingClientRect().top +
          window.scrollY,
      ),
    ID.jarne,
  );
  await page.evaluate(() => ((window as unknown as { __spur: number[] }).__spur = []));
  await page.mouse.up();
  await page.waitForTimeout(400);
  await ruhe(page);
  const spur = await page.evaluate(() => (window as unknown as { __spur: number[] }).__spur);
  const ende = await page.evaluate(
    (id) =>
      Math.round(
        document.querySelector(`.faecher [data-id="${id}"]`)!.getBoundingClientRect().top +
          window.scrollY,
      ),
    ID.jarne,
  );
  await ctx.close();
  const spruenge = spur.filter((y) => Math.abs(y - platz) > 2);
  return { ruhig: !spruenge.length && Math.abs(ende - platz) <= 2, platz, ende, spruenge };
}

test('wunsch-W54, G9: kein Rücksprung, die Person bleibt beim Loslassen am Platzhalter', async ({
  browser,
}) => {
  const r = await g9(browser);
  expect(r.ruhig, JSON.stringify(r)).toBe(true);
  expect((await g9(browser, true)).ruhig).toBe(false);
});

test('wunsch-W54, G10: Kinder sind eigene Zeilen „Kind“ mit „Zieht immer mit ein“ (DP130, B2), ohne Griff', async ({
  browser,
}) => {
  const { ctx, page } = await neu(browser, 'B');
  const z = await page.evaluate(() =>
    [...document.querySelectorAll('.faecher [data-gruppe="nurmit"] [data-kind]')].map((e) => [
      e.querySelector('b')!.textContent,
      e.querySelector('.text span')!.textContent,
      !!e.querySelector('.griff'),
    ]),
  );
  await ctx.close();
  expect(z).toEqual([
    ['Kind', 'Zieht immer mit ein', false],
    ['Kind', 'Zieht immer mit ein', false],
  ]);
});

// ---------------------------------------------------------------- G11 (DP130, B1)

/** Liegt „Rückgängig“ nach dem Verschieben frei im Bild, über der festen Leiste, und ist der Knopf obenauf? */
async function g11(browser: Browser, groesse: Groesse, weg: 'ziehen' | 'tipp', stoer = false) {
  const { ctx, page } = await neu(browser, 'A', { groesse, ruhig: true });
  if (stoer) await page.evaluate(() => (window.scrollBy = () => undefined));
  if (weg === 'ziehen') await ziehe(page, ID.selin, 'buerge');
  else await zielTipp(page, ID.selin, 'buerge');
  await page.locator('.faecher .folge').waitFor();
  await page.waitForTimeout(100);
  const m = await page.evaluate(() => {
    const z = document.querySelector('.faecher .folge')!.getBoundingClientRect();
    const k = document.querySelector<HTMLElement>('.faecher .rueck')!;
    const kr = k.getBoundingClientRect();
    const leiste = document.querySelector('.leiste')?.getBoundingClientRect();
    const grenze = Math.min(window.innerHeight, leiste?.height ? leiste.top : Infinity);
    const oben = document.elementFromPoint(kr.x + kr.width / 2, kr.y + kr.height / 2);
    return {
      zeile: [Math.round(z.top), Math.round(z.bottom)],
      grenze: Math.round(grenze),
      leiste: !!leiste?.height,
      frei: z.top >= 0 && z.bottom <= grenze - 15,
      obenauf: !!oben && k.contains(oben),
      fokus: document.activeElement === k,
    };
  });
  await ctx.close();
  return m;
}

test('wunsch-W54, G11 (DP130, B1): „Rückgängig“ steht nach dem Verschieben über der Leiste im Bild', async ({
  browser,
}) => {
  // Wie Designs Messung: 390 mit und ohne Ziehen, 320 mit 130 % ohne Ziehen (dort liegt das Ziel außer Sicht).
  const faelle = [
    ['390', 'ziehen'],
    ['390', 'tipp'],
    ['320-130', 'tipp'],
  ] as const;
  for (const [groesse, weg] of faelle) {
    const m = await g11(browser, groesse, weg);
    expect(m, `${groesse} ${weg} ${JSON.stringify(m)}`).toMatchObject({
      frei: true,
      obenauf: true,
      fokus: true,
    });
  }
  // Gegenprobe: ohne das Rollen liegt die Zeile unter der Leiste und G11 wird rot.
  for (const groesse of ['390', '320-130'] as const) {
    const ohne = await g11(browser, groesse, 'tipp', true);
    expect(ohne.frei && ohne.obenauf, `${groesse} ${JSON.stringify(ohne)}`).toBe(false);
  }
});

// ---------------------------------------------------------------- PC220: Flugkarte und Mitscrollen

/** Mitten im Zug: steht die Flugkarte sichtbar unter dem Zeiger, mit dem Namen der Person, obenauf? */
async function g12(browser: Browser, stoer?: string) {
  const { ctx, page } = await neu(browser, 'A');
  if (stoer) await page.addStyleTag({ content: stoer });
  const g = (await page.locator(`[data-griff="${ID.selin}"]`).boundingBox())!;
  const x = g.x + g.width / 2;
  const y0 = g.y + g.height / 2;
  await page.mouse.move(x, y0);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(x, y0 + i * 12);
    await page.waitForTimeout(15);
  }
  const zeiger = { x, y: y0 + 96 };
  const m = await page.evaluate((p) => {
    const f = document.querySelector<HTMLElement>('.flug');
    if (!f) return { da: false };
    const r = f.getBoundingClientRect();
    const s = getComputedStyle(f);
    const imBild = r.bottom > 0 && r.top < window.innerHeight && r.height > 0;
    const unterZeiger = p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
    // Obenauf: an der Stelle des Zeigers liegt nichts über der Karte (die Karte selbst lässt Zeiger durch).
    f.style.pointerEvents = 'auto';
    const oben = document.elementFromPoint(p.x, p.y);
    f.style.pointerEvents = '';
    return {
      da: true,
      imBild,
      unterZeiger,
      obenauf: !!oben && f.contains(oben),
      deckend: Number(s.opacity) === 1 && s.backgroundColor !== 'rgba(0, 0, 0, 0)',
      name: f.textContent?.includes('Selin') ?? false,
    };
  }, zeiger);
  await page.mouse.up();
  await ctx.close();
  return m;
}

test('PC220, G12: beim Ziehen steht die Karte unter dem Finger (DP124), deckend und obenauf', async ({
  browser,
}) => {
  const soll = {
    da: true,
    imBild: true,
    unterZeiger: true,
    obenauf: true,
    deckend: true,
    name: true,
  };
  expect(await g12(browser)).toEqual(soll);
  // Gegenprobe: so, wie es in Bau 195 war (die Karte nur relativ am Ende der Seite), wird G12 rot.
  const alt = await g12(browser, '.zeile.flug { position: relative !important; }');
  expect(alt.imBild && alt.unterZeiger, JSON.stringify(alt)).toBe(false);
});

/** In 320 mit 130 % liegt „Nicht mehr dabei“ außer Sicht: Zug an den unteren Rand, halten, dann dort loslassen. */
async function g13(browser: Browser, ohneScroll = false) {
  const { ctx, page } = await neu(browser, 'A', { groesse: '320-130' });
  if (ohneScroll) await page.evaluate(() => (window.scrollBy = () => undefined));
  // Selins Griff oben ins Bild (er liegt in dieser Größe zuerst unter der Leiste); „Nicht mehr dabei“ bleibt außer Sicht.
  await page.evaluate((id) => {
    const r = document.querySelector(`[data-griff="${id}"]`)!.getBoundingClientRect();
    window.scrollTo(0, window.scrollY + r.top - 120);
  }, ID.selin);
  await page.waitForTimeout(100);
  const g = (await page.locator(`[data-griff="${ID.selin}"]`).boundingBox())!;
  const x = g.x + g.width / 2;
  const unten = await page.evaluate(() => {
    const l = document.querySelector<HTMLElement>('.leiste');
    return l ? l.getBoundingClientRect().top : window.innerHeight;
  });
  const y0 = g.y + g.height / 2;
  const zuerstAusserSicht = await page.evaluate(
    (y) => document.querySelector('[data-gruppe="weg"]')!.getBoundingClientRect().top > y,
    unten,
  );
  await page.mouse.move(x, y0);
  await page.mouse.down();
  // Erst ein Stück nach oben, damit der Zug sicher beginnt (die Zeile kann schon nah am Rand liegen).
  for (let i = 1; i <= 4; i++) {
    await page.mouse.move(x, y0 - i * 8);
    await page.waitForTimeout(15);
  }
  const yRand = unten - 12;
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(x, y0 - 32 + ((yRand - y0 + 32) * i) / 10);
    await page.waitForTimeout(15);
  }
  const vorher = await page.evaluate(() => window.scrollY);
  // Halten, bis „Nicht mehr dabei“ über dem Finger steht (höchstens 4 s).
  let erreicht = false;
  for (let t = 0; t < 40 && !erreicht; t++) {
    await page.waitForTimeout(100);
    erreicht = await page.evaluate((y) => {
      const b = document.querySelector('[data-gruppe="weg"]')?.getBoundingClientRect();
      return !!b && b.top < y - 30;
    }, yRand);
  }
  const gescrollt = (await page.evaluate(() => window.scrollY)) - vorher;
  // Weiter halten: am Seitenende hört das Scrollen auf und bleibt dort stehen.
  await page.waitForTimeout(2500);
  const s1 = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(400);
  const amEnde = await page.evaluate(
    (s1) =>
      window.scrollY === s1 &&
      window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 1,
    s1,
  );
  // Ins Fach „Nicht mehr dabei“ führen und loslassen.
  const zb = (await page.locator('[data-gruppe="weg"]').boundingBox())!;
  await page.mouse.move(x, Math.min(zb.y + 24, yRand));
  await page.waitForTimeout(300);
  // Die Vorschau verschiebt die Fächer; noch einmal messen und mitten ins Fach.
  const zb2 = (await page.locator('[data-gruppe="weg"]').boundingBox())!;
  await page.mouse.move(x, Math.min(zb2.y + zb2.height / 2, unten - 4));
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await ruhe(page);
  const fach = await fachInAnzeige(page, ID.selin);
  const gespeichert = JSON.parse(await stand(page)).personen.includes('Selin:weg');
  await ctx.close();
  return { zuerstAusserSicht, gescrollt: gescrollt > 40, erreicht, amEnde, fach, gespeichert };
}

test('PC220, G13: nahe am Rand scrollt die Seite mit, bis „Nicht mehr dabei“ erreichbar ist (320 mit 130 %)', async ({
  browser,
}) => {
  expect(await g13(browser)).toEqual({
    zuerstAusserSicht: true,
    gescrollt: true,
    erreicht: true,
    amEnde: true,
    fach: 'weg',
    gespeichert: true,
  });
  // Gegenprobe: ohne Mitscrollen (wie in Bau 195) bleibt die Seite stehen und erreicht ihr Ende nicht.
  const ohne = await g13(browser, true);
  expect(ohne.gescrollt || ohne.amEnde, JSON.stringify(ohne)).toBe(false);
});
