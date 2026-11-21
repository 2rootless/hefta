import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PERSONENFARBEN } from '../domain/personenfarben';

// Farbe nach DP63b (A1 Siegellack warm) und DP63c (Akzent ohne Flächen), 2.1 (PC176). Geprüft werden die Werte
// der Tokens, die Kontraste (AK3), der Abstand von Akzent und Fehler zu den Personenfarben (Maß B25 n1, AK5), dass
// der Akzent nur an Zurück, am gewählten Reiter und am Zähler über der Grenze steht (AK9), dass Fehler in Bernstein
// stehen (AK4) und dass das App-Symbol A1 ist (AK1, AK2). Davor B28a, Weg B.

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

describe('Farbe nach DP63b und DP63c (A1 Siegellack warm)', () => {
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

  it('Tokens tragen die Werte aus DP63b und DP63c; --accent und --accent-soft gibt es nicht mehr', () => {
    const werte = (thema: 'light' | 'dark') =>
      ['accent-text', 'fehler', 'fehler-soft', 'app-zeichen'].map((n) => token(thema, n));
    expect(werte('light')).toEqual(['#a3271e', '#a85a00', '#fdf5e8', '#b3261e']);
    expect(werte('dark')).toEqual(['#f26b5b', '#f5a524', '#3a2a10', '#b3261e']);
    expect(css).not.toMatch(/--accent:|--accent-soft:/);
  });

  it('AK3: Kontraste halten, hell und dunkel', () => {
    for (const thema of ['light', 'dark'] as const) {
      const k = (n: string) => token(thema, n);
      // Akzent nur als Schrift (Zurück, Reiter, Zähler): mindestens 4,5 : 1 auf Grund und Karte.
      expect(kontrast(k('accent-text'), k('ground')), thema).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(k('accent-text'), k('surface')), thema).toBeGreaterThanOrEqual(4.5);
      // Fehler in Bernstein: Schrift auf Grund, Karte und Fehler-Fläche; das „!“ in --surface auf Bernstein.
      expect(kontrast(k('fehler'), k('ground')), thema).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(k('fehler'), k('surface')), thema).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(k('fehler'), k('fehler-soft')), thema).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(k('surface'), k('fehler')), thema).toBeGreaterThanOrEqual(4.5);
      // DP112 (E334): „knapp“ in Oliv, jede Schrift mindestens 4,5 : 1 auf jeder Fläche, auf der sie steht.
      // --weich ist die Karte (--surface); --weich-karte steht in global.css: hell #f1ebe1, dunkel wie --ground.
      const weichKarte = thema === 'light' ? '#f1ebe1' : k('ground');
      for (const [name, grund] of [
        ['knapp', k('knapp')],
        ['surface', k('surface')],
        ['ground', k('ground')],
        ['weich-karte', weichKarte],
      ] as const)
        expect(
          kontrast(k('knapp-text'), grund),
          `${thema} knapp-text auf ${name}`,
        ).toBeGreaterThanOrEqual(4.5);
    }
    // DP112: die Werte von Oliv, und weiter weg vom Bernstein als das Ocker von 2.0.
    expect([token('light', 'knapp-text'), token('dark', 'knapp-text')]).toEqual([
      '#6f640c',
      '#c7bf48',
    ]);
    expect([token('light', 'knapp'), token('dark', 'knapp')]).toEqual(['#f4ebcc', '#3b381f']);
    for (const thema of ['light', 'dark'] as const)
      expect(deltaE00(token(thema, 'knapp-text'), token(thema, 'fehler')), thema).toBeGreaterThan(
        19,
      );
    // Gegenprobe: das Ocker von 2.0 lag hell bei ΔE00 12,1 zum Bernstein.
    expect(deltaE00('#7a5200', token('light', 'fehler'))).toBeLessThan(19);
  });

  it('AK5 (DP112, E334): Bernstein nur als Warnzeichen mit „!“ und Satz, Personenfarben nie mit „!“; ΔE00 notiert', () => {
    // DP112, Abschnitt 4: Die Grenze aus DP63b (CIE76) hielt als Messung nicht; in ΔE00 liegen im Dunkeln sechs Paare
    // unter 22. Was Fehler und Personen trennt, ist die Form: Bernstein nur im Warnzeichen (Kreis 16 px mit „!“, Satz
    // daneben), Personenfarben nur mit Buchstaben oder Namen. Der Abstand wird notiert, ohne Grenze.
    const regeln = (dateien: [string, string][]) => {
      const aus: string[] = [];
      for (const [pfad, text] of dateien) {
        // 1. Eine Fläche in Bernstein gibt es nur als Warnzeichen.
        for (const m of text.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
          const kopf = m[1]!.trim().split('\n').pop()!.trim();
          if (
            /(background(-color)?|fill)\s*:\s*var\(--fehler\)/.test(m[2]!) &&
            !/\.warnzeichen\b/.test(kopf)
          )
            aus.push(`${pfad}: Fläche in Bernstein ohne Warnzeichen (${kopf})`);
        }
        if (/fill="var\(--fehler\)"/.test(text)) aus.push(`${pfad}: Fläche in Bernstein im Bild`);
        const markup = text.split('<style')[0]!;
        // 2. Jedes Warnzeichen trägt „!“.
        for (const m of markup.matchAll(/<span class="warnzeichen"[^>]*>([^<]*)<\/span>/g))
          if (m[1]!.trim() !== '!') aus.push(`${pfad}: Warnzeichen ohne „!“`);
        // 3. Ein Satz in Bernstein hat sein Warnzeichen. Bernstein heißt: Die Klasse setzt in dieser Datei
        //    `color: var(--fehler)`; geprüft wird der ganze Klassenname (nicht „datei-fehler“).
        const bernstein = new Set<string>();
        for (const m of text.matchAll(/([^{}]*)\{([^{}]*)\}/g))
          if (/(^|[\s;])color\s*:\s*var\(--fehler\)/.test(m[2]!))
            for (const k of m[1]!.matchAll(/\.([\w-]+)/g)) bernstein.add(k[1]!);
        for (const m of markup.matchAll(/<(p|div|span)\s+class="([^"]*)"[^>]*>([\s\S]*?)<\/\1>/g))
          if (
            m[2]!.split(/\s+/).some((k) => bernstein.has(k) && k !== 'warnzeichen') &&
            !/warnzeichen|<Warnzeichen/.test(m[3]!)
          )
            aus.push(`${pfad}: Satz in Bernstein ohne Warnzeichen`);
        // 4. Ein Personenzeichen trägt nie „!“.
        for (const zeile of markup.split('\n'))
          if (/person-ton|tonStil\(/.test(zeile) && />\s*!\s*</.test(zeile))
            aus.push(`${pfad}: Personenzeichen mit „!“`);
      }
      return aus;
    };
    expect(regeln(appDateien())).toEqual([]);
    // Das Warnzeichen hat keine Farbe von außen: kein Prop, nur Bernstein.
    expect(readFileSync('src/ui/Warnzeichen.svelte', 'utf8')).not.toMatch(/\$props/);
    // Notiert, ohne Grenze (DP112): ΔE00 von Fehler und Akzent zu jeder Personenfarbe.
    const notiz = (['light', 'dark'] as const).flatMap((thema) =>
      ['fehler', 'accent-text'].flatMap((name) =>
        PERSONENFARBEN.map((p) => deltaE00(token(thema, name), p.app)),
      ),
    );
    expect(notiz.every((d) => Number.isFinite(d) && d > 0)).toBe(true);
    // Gegenproben: eine Fläche in Bernstein ohne „!“, ein Personenzeichen mit „!“, ein Fehlersatz ohne Zeichen (DP112 B1).
    expect(regeln([['probe.svelte', '.kasten {\n  background: var(--fehler);\n}']])).toHaveLength(
      1,
    );
    expect(
      regeln([['probe.svelte', '<i class="zeichen-p person-ton" style={tonStil(1)}>!</i>']]),
    ).toHaveLength(1);
    // So stand es bis DP112 B1 auf der Bürgschaftsseite: Satz in Bernstein ohne Zeichen.
    const b1 = [
      '<p class="fehler-bau" role="alert">{t(\'x\')}</p>',
      '<style>',
      '  .fehler-bau {',
      '    color: var(--fehler);',
      '  }',
      '</style>',
    ].join('\n');
    expect(regeln([['probe.svelte', b1]])).toHaveLength(1);
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

  /** Akzent außerhalb der drei erlaubten Stellen (DP63c, Abschnitt 4), je Datei. Vermieterseite und Websites
   * haben eigene Tokens und eigene Zweige. */
  function akzentFalsch(dateien: [string, string][]): string[] {
    const aus: string[] = [];
    for (const [pfad, text] of dateien) {
      if (/var\(--accent(-soft)?[),]/.test(text)) aus.push(`${pfad}: --accent`);
      for (const m of text.matchAll(/([^{}]*)\{([^{}]*var\(--accent-text\)[^{}]*)\}/g)) {
        const kopf = m[1]!.trim().split('\n').pop()!.trim();
        const erlaubt =
          /--on-zurueck\s*:/.test(m[2]!) || /\.zurueck\b|aria-current|\.zu-lang\b/.test(kopf);
        if (!erlaubt) aus.push(`${pfad}: ${kopf}`);
      }
    }
    return aus;
  }
  const appDateien = (): [string, string][] => {
    const aus: [string, string][] = [];
    const durch = (ordner: string) => {
      for (const e of readdirSync(ordner, { withFileTypes: true })) {
        const pfad = join(ordner, e.name);
        if (e.isDirectory()) {
          if (!pfad.includes('vermieter')) durch(pfad);
        } else if (/\.(svelte|css|svg)$/.test(e.name)) aus.push([pfad, readFileSync(pfad, 'utf8')]);
      }
    };
    durch('src');
    return aus;
  };

  it('AK9: Akzent nur an Zurück, am gewählten Reiter und am Zähler über der Grenze; Gegenproben', () => {
    expect(akzentFalsch(appDateien())).toEqual([]);
    // Gegenproben: eine Fläche in --accent-soft, eine Linie in --accent, Akzent-Schrift an einer Überschrift.
    expect(
      akzentFalsch([['probe.svelte', '.kopf {\n  background: var(--accent-soft);\n}']]),
    ).toHaveLength(1);
    expect(akzentFalsch([['probe.svg', '<path stroke="var(--accent)"/>']])).toHaveLength(1);
    expect(akzentFalsch([['probe.svelte', 'h2 {\n  color: var(--accent-text);\n}']])).toEqual([
      'probe.svelte: h2',
    ]);
  });

  it('AK4: Warnzeichen und Fehler stehen in Bernstein; Gegenprobe', () => {
    const falsch = (dateien: [string, string][]) => {
      const aus: string[] = [];
      for (const [pfad, text] of dateien)
        for (const m of text.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
          const kopf = m[1]!.trim().split('\n').pop()!.trim();
          if (!/\.warnzeichen\b|\.fehler\b|\.fehler-bau\b|\.unlesbar\b/.test(kopf)) continue;
          const farben = [...m[2]!.matchAll(/var\(--([a-z-]+)\)/g)].map((x) => x[1]!);
          if (farben.some((f) => f.startsWith('accent'))) aus.push(`${pfad}: ${kopf}`);
        }
      return aus;
    };
    const dateien = appDateien();
    expect(falsch(dateien)).toEqual([]);
    // Jedes Warnzeichen hat Bernstein als Grund.
    const zeichen = dateien.filter(([, t]) => /\.warnzeichen\s*\{/.test(t));
    expect(zeichen.length).toBeGreaterThan(4);
    for (const [pfad, t] of zeichen)
      expect(/\.warnzeichen\s*\{[^}]*background:\s*var\(--fehler\)/.test(t), pfad).toBe(true);
    // Gegenprobe: ein Warnzeichen im Akzent wird rot.
    expect(
      falsch([['probe.svelte', '.warnzeichen {\n  background: var(--accent-text);\n}']]),
    ).toHaveLength(1);
  });

  it('Keiner der alten Werte steht mehr im Quelltext, auch keine Koralle (PC3)', () => {
    // Koralle (#ff8466) war Akzent dunkel, Personenfarbe aus B13 und das alte App-Symbol. Seit D002 nirgends mehr.
    // Seit DP63b auch nicht mehr Lederbraun (#661f14, #3f130b) und die Akzente aus B28a. Das stillgelegte
    // scripts/app-symbole.mjs (B11) bleibt außen vor.
    // Nicht durchsucht: Archiv und Pakete des Designs unter design/ (die README des Logo-Kits nennt die Farbe
    // nur unter „Überholt“) und diese Datei.
    const alt =
      /#(?:e2603f|a8401f|ffb39d|ffe5db|4a2a20|a85c50|ff8466|661f14|3f130b|d9402b|b8331c|f2552e|f2e8e6|33170f)(?![0-9a-f])/i;
    const treffer: string[] = [];
    const durch = (pfad: string) => {
      if (statSync(pfad).isDirectory()) {
        for (const e of readdirSync(pfad)) durch(join(pfad, e));
        return;
      }
      if (!/\.(svelte|css|ts|mjs|html|json|svg|xml|webmanifest)$/.test(pfad)) return;
      if (pfad.endsWith('farben.test.ts') || pfad.endsWith('app-symbole.mjs')) return;
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

  it('AK1, AK2: App-Symbol A1b nach DP111 (Farben von A1, DP63b) in iOS, Web und Android; Favicon bleibt F1 (W34)', () => {
    for (const thema of ['light', 'dark'] as const)
      expect(token(thema, 'app-zeichen')).toBe('#b3261e');
    type Fuellung = { appearance?: string; value: { solid: string } };
    const icon = JSON.parse(readFileSync('ios/App/App/AppIcon.icon/icon.json', 'utf8')) as {
      'fill-specializations': Fuellung[];
      groups: {
        name: string;
        shadow: { kind: string };
        layers: {
          'image-name': string;
          'fill-specializations': Fuellung[];
          'opacity-specializations'?: { appearance?: string; value: number }[];
        }[];
      }[];
    };
    const hex = (solid: string) =>
      '#' +
      solid
        .split(':')[1]!
        .split(',')
        .slice(0, 3)
        .map((x) =>
          Math.round(Number(x) * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
    // DP111, TEST.md: Farben je Darstellung (Standard, Dunkel), Deckkraft der Seiten wie 2.0, Schatten des Deckels
    // „Chromatic“ (in icon.json „layer-color“).
    const je = (fs: Fuellung[]) =>
      fs.map((f) => `${f.appearance ?? 'standard'} ${hex(f.value.solid)}`);
    expect(je(icon['fill-specializations'])).toEqual(['standard #8a1d17', 'dark #4d110c']);
    const ebene = Object.fromEntries(
      icon.groups
        .flatMap((g) => g.layers)
        .map((l) => [l['image-name'], je(l['fill-specializations']).join(', ')]),
    );
    const hell = 'standard #fdf8f1, dark #f3ede4';
    expect(ebene).toEqual({
      '1-klammer.svg': hell,
      '2-deckel.svg': 'standard #b3261e, dark #8a1d17',
      '3-seite-1.svg': hell,
      '3-seite-2.svg': hell,
      '3-seite-3.svg': hell,
    });
    const deckkraft = icon.groups
      .flatMap((g) => g.layers)
      .filter((l) => l['opacity-specializations'])
      .map((l) => l['opacity-specializations']!.map((o) => o.value));
    expect(deckkraft).toEqual([
      [0.9, 0.42],
      [0.81, 0.36],
      [0.72, 0.3],
    ]);
    expect(icon.groups.find((g) => g.name === 'Deckel')!.shadow.kind).toBe('layer-color');
    // Die Ebenen selbst unverändert aus DP111
    for (const d of ['1-klammer', '2-deckel', '3-seite-1', '3-seite-2', '3-seite-3'])
      expect(readFileSync(`ios/App/App/AppIcon.icon/Assets/${d}.svg`, 'utf8'), d).toBe(
        readFileSync(`design/dp111/icon-composer/${d}.svg`, 'utf8'),
      );
    // Die Dateien des Designs, unverändert: App Store 1024 (quadratisch, AK2), Web-App und Home-Bildschirm.
    const gleich = (a: string, b: string) =>
      expect(readFileSync(a).equals(readFileSync(b)), a).toBe(true);
    const A1B = 'design/dp111/app-symbol';
    gleich(
      'ios/App/App/Assets.xcassets/AppIcon.appiconset/hefta-hell.png',
      `${A1B}/app-symbol-A1b-1024.png`,
    );
    gleich('public/icons/apple-touch-icon.png', `${A1B}/apple-touch-icon-A1b-180.png`);
    gleich('public/icons/icon-192.png', `${A1B}/icon-A1b-192.png`);
    gleich('public/icons/icon-512.png', `${A1B}/icon-A1b-512.png`);
    gleich('public/icons/icon-maskable-512.png', `${A1B}/icon-maskable-A1b-512.png`);
    expect(
      readFileSync('android/app/src/main/res/values/ic_launcher_background.xml', 'utf8'),
    ).toMatch(/#8a1d17/i);
    // PC85 (W34): Das Favicon ist nicht das App-Symbol, sondern F1 aus DP63a.
    expect(readFileSync('public/icons/favicon.svg', 'utf8')).not.toMatch(/#b3261e/i);
    expect(readFileSync('public/icons/favicon.svg', 'utf8')).toBe(
      readFileSync('design/logo/favicon-dp63a-f1/favicon.svg', 'utf8'),
    );
  });
});
