import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PERSONENFARBEN } from '../domain/personenfarben';

// Farbe nach B28a, Weg B (Nachricht 13f): Akzent Signalrot. Geprüft werden die Kontraste aus Abschnitt 1 des
// Berichts, der Abstand des Akzents zu den zwölf Personenfarben nach dem Maß aus B25 n1 und die Regel, dass Text
// in Akzentfarbe immer accent-text nimmt.

const css = readFileSync('design/tokens.css', 'utf8');
function token(thema: 'light' | 'dark', name: string): string {
  const block =
    thema === 'light' ? css.split('[data-theme="dark"]')[0]! : css.split('[data-theme="dark"]')[1]!;
  const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`).exec(block);
  if (!m) throw new Error(`Token --${name} (${thema}) fehlt`);
  return m[1]!;
}

const kanal = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (h: string) =>
  [1, 3, 5].map((i) => kanal(Number.parseInt(h.slice(i, i + 2), 16) / 255)) as [
    number,
    number,
    number,
  ];
function leuchte(h: string): number {
  const [r, g, b] = rgb(h);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function kontrast(a: string, b: string): number {
  const [x, y] = [leuchte(a), leuchte(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

function lab(h: string): [number, number, number] {
  const [r, g, b] = rgb(h);
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIEDE2000 (Sharma, Wu, Dalal 2005), wie im Werkzeug des Designs (skimage). */
function deltaE00(a: string, b: string): number {
  return deltaE00Lab(lab(a), lab(b));
}

function deltaE00Lab([L1, a1, b1]: number[], [L2, a2, b2]: number[]): number {
  const rad = Math.PI / 180;
  [L1, a1, b1, L2, a2, b2] = [L1!, a1!, b1!, L2!, a2!, b2!];
  const Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1 = Math.hypot(a1p, b1);
  const C2 = Math.hypot(a2p, b2);
  const h1 = (((Math.atan2(b1, a1p) / rad) % 360) + 360) % 360;
  const h2 = (((Math.atan2(b2, a2p) / rad) % 360) + 360) % 360;
  let dh = h2 - h1;
  if (C1 * C2 === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh / 2) * rad);
  const Lm = (L1 + L2) / 2;
  const Cmp = (C1 + C2) / 2;
  let hm = h1 + h2;
  if (C1 * C2 !== 0)
    hm = Math.abs(h1 - h2) <= 180 ? hm / 2 : hm < 360 ? (hm + 360) / 2 : (hm - 360) / 2;
  const T =
    1 -
    0.17 * Math.cos((hm - 30) * rad) +
    0.24 * Math.cos(2 * hm * rad) +
    0.32 * Math.cos((3 * hm + 6) * rad) -
    0.2 * Math.cos((4 * hm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const Sc = 1 + 0.045 * Cmp;
  const Sh = 1 + 0.015 * Cmp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  const dL = (L2 - L1) / Sl;
  const dC = (C2 - C1) / Sc;
  const dHs = dH / Sh;
  return Math.sqrt(dL ** 2 + dC ** 2 + dHs ** 2 + Rt * dC * dHs);
}

/** Maß aus B25 n1: zu nah, wenn ΔE00 unter 20 und der Unterschied in der Helligkeit unter 30 liegt. */
const zuNah = (a: string, b: string) => deltaE00(a, b) < 20 && Math.abs(lab(a)[0] - lab(b)[0]) < 30;

describe('Farbe nach B28a, Weg B', () => {
  it('ΔE00 stimmt mit den Referenzpaaren von Sharma, Wu und Dalal (2005) überein', () => {
    for (const [a, b, soll] of [
      [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
      [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
      [[50, 0, 0], [50, -1, 2], 2.3669],
      [[50, 2.5, 0], [73, 25, -18], 27.1492],
      [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
      [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
      [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381],
    ] as const)
      expect(deltaE00Lab([...a], [...b])).toBeCloseTo(soll, 4);
  });

  it('Tokens tragen die Werte aus dem Bericht', () => {
    expect(['accent', 'accent-text', 'accent-soft'].map((n) => token('light', n))).toEqual([
      '#d9402b',
      '#b8331c',
      '#f2e8e6',
    ]);
    expect(['accent', 'accent-text', 'accent-soft'].map((n) => token('dark', n))).toEqual([
      '#f2552e',
      '#f2552e',
      '#33170f',
    ]);
  });

  it('Kontraste aus Abschnitt 1 halten', () => {
    const hell = (n: string) => token('light', n);
    const dunkel = (n: string) => token('dark', n);
    // Text in Akzentfarbe, hell
    expect(kontrast(hell('accent-text'), hell('ground'))).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(hell('accent-text'), hell('surface'))).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(hell('accent-text'), hell('accent-soft'))).toBeGreaterThanOrEqual(4.5);
    // Weiße Schrift auf einem Knopf in accent-text
    expect(kontrast('#ffffff', hell('accent-text'))).toBeGreaterThanOrEqual(4.5);
    // Der Akzent selbst: für Linien und Flächen mindestens 3 : 1, für Text zu schwach
    expect(kontrast(hell('accent'), hell('ground'))).toBeGreaterThanOrEqual(3);
    expect(kontrast(hell('accent'), hell('ground'))).toBeLessThan(4.5);
    // Dunkel
    expect(kontrast(dunkel('accent-text'), dunkel('ground'))).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(dunkel('accent-text'), dunkel('surface'))).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(dunkel('accent-text'), dunkel('accent-soft'))).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(dunkel('ground'), dunkel('accent'))).toBeGreaterThanOrEqual(4.5);
  });

  it('Der Akzent steht weit genug von jeder Personenfarbe, in App und Druck (Maß B25 n1)', () => {
    const nah: string[] = [];
    for (const [thema, name] of [
      ['light', 'accent'],
      ['light', 'accent-text'],
      ['dark', 'accent'],
    ] as const) {
      const wert = token(thema, name);
      for (const p of PERSONENFARBEN)
        for (const satz of ['app', 'druckton'] as const)
          if (zuNah(wert, p[satz])) nah.push(`${name} ${thema} gegen ${p.name} ${satz}`);
    }
    // Seit B28a-n1 (#d9402b, Planung 13i) ohne Ausnahme; vorher lag der helle Akzent bei 19,97 gegen Apricot.
    expect(nah).toEqual([]);
  });

  it('„nah“ steht weit genug von jeder Personenfarbe und jedem anderen Token (B28a-n1/n2, P003)', () => {
    // Geprüft gegen alle Farb-Tokens desselben Themas und die zwölf Personenfarben (App und Druck).
    // Nicht mit: die Tokens von „nah“ selbst, die Personen-Tokens (über PERSONENFARBEN geprüft) und
    // --termin-soft als große, blasse Fläche (13j).
    // Bekannte Ausnahme (P003, C001 F1): --on-person-muted (#33354a) liegt bei ΔE00 19,9 gegen „nah“ hell. Diese
    // Schrift steht nur auf Flächen in Personenfarbe, nie neben dem Reiter „heute“ oder der Karte.
    // Kontrast: --nah-linie dunkel hat gegen den Grund nur 2 : 1. Sie ist Schmuck der Karte, keine Grenze, die
    // etwas bedeutet; den Zustand tragen Reiter (HEUTE, MORGEN) und Text (P003, C001 F2).
    const ohne = (n: string) =>
      n.startsWith('nah') || n.startsWith('person-') || n === 'termin-soft';
    const nah: string[] = [];
    for (const thema of ['light', 'dark'] as const) {
      const block =
        thema === 'light'
          ? css.split('[data-theme="dark"]')[0]!
          : css.split('[data-theme="dark"]')[1]!;
      const alle = [...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6});/g)].map(
        (m) => [m[1]!, m[2]!] as const,
      );
      for (const name of ['nah', 'nah-linie', ...(thema === 'light' ? ['nah-text'] : [])]) {
        const wert = token(thema, name);
        for (const [anderer, farbe] of alle)
          if (!ohne(anderer) && zuNah(wert, farbe)) nah.push(`${name} ${thema} gegen --${anderer}`);
        for (const p of PERSONENFARBEN)
          for (const satz of ['app', 'druckton'] as const)
            if (zuNah(wert, p[satz])) nah.push(`${name} ${thema} gegen ${p.name} ${satz}`);
      }
    }
    expect(nah).toEqual([
      'nah light gegen --on-person-muted',
      'nah-linie light gegen --on-person-muted',
      'nah-text light gegen --on-person-muted',
    ]);
  });

  it('Text in Akzentfarbe nimmt accent-text, nie accent', () => {
    const treffer: string[] = [];
    const durch = (ordner: string) => {
      for (const e of readdirSync(ordner, { withFileTypes: true })) {
        const pfad = join(ordner, e.name);
        if (e.isDirectory()) durch(pfad);
        else if (/\.(svelte|css|html)$/.test(e.name)) {
          const text = readFileSync(pfad, 'utf8');
          for (const m of text.matchAll(/(?<![-\w])color\s*:\s*var\(--accent\)/g))
            treffer.push(`${pfad}: ${m[0]}`);
          for (const m of text.matchAll(/<text[^>]*fill="var\(--accent\)"/g))
            treffer.push(`${pfad}: ${m[0]}`);
        }
      }
    };
    for (const ordner of ['src', 'vermieter']) durch(ordner);
    expect(treffer).toEqual([]);
  });

  it('Keiner der alten Werte steht mehr im Quelltext, auch keine Koralle (PC3)', () => {
    // Koralle (#ff8466) war Akzent dunkel, Personenfarbe aus B13 und das alte App-Symbol. Seit D002 nirgends mehr.
    // Nicht durchsucht: Archiv und Pakete des Designs unter design/ (die README des Logo-Kits nennt die Farbe
    // nur unter „Überholt“) und diese Datei.
    const alt = /#(?:e2603f|a8401f|ffb39d|ffe5db|4a2a20|a85c50|ff8466)(?![0-9a-f])/i;
    const treffer: string[] = [];
    const durch = (pfad: string) => {
      if (statSync(pfad).isDirectory()) {
        for (const e of readdirSync(pfad)) durch(join(pfad, e));
        return;
      }
      if (!/\.(svelte|css|ts|mjs|html|json|svg|xml|webmanifest)$/.test(pfad)) return;
      if (pfad.endsWith('farben.test.ts')) return;
      if (alt.test(readFileSync(pfad, 'utf8'))) treffer.push(pfad);
    };
    for (const pfad of [
      'src',
      'vermieter',
      'tests',
      'scripts',
      'design/tokens.css',
      'design/tokens.json',
      'public',
      'android/app/src/main/res',
      'index.html',
    ])
      durch(pfad);
    expect(treffer).toEqual([]);
  });

  it('App-Zeichen ist der Deckel des Icons, die Klammer Papier (D002, PC3)', () => {
    // Die Farben des Icons (Deckel, Grund, Seiten) prüft kein Maß gegen die Personenfarben: Das Icon steht nie
    // neben Personenzeichen, und die Kachel in der App zeigt nur die Klammer (D002 F1, Planung: ja).
    for (const thema of ['light', 'dark'] as const) {
      expect(token(thema, 'app-zeichen')).toBe('#661f14');
      expect(token(thema, 'app-zeichen-haus')).toBe('#fbf8f2');
    }
    expect(readFileSync('public/icons/favicon.svg', 'utf8')).toMatch(/#661f14/i);
    expect(
      readFileSync('android/app/src/main/res/values/ic_launcher_background.xml', 'utf8'),
    ).toMatch(/#3f130b/i);
  });
});
