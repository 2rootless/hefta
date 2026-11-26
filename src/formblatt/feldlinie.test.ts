import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// H3 (DP135 U3, PC202 Abschnitt 2): Die Linie unter einem Feld auf dem Formblatt grenzt es mit mindestens 3 : 1 ab
// (WCAG 1.4.11), hell und dunkel, gegen die Fläche des Felds und gegen die Karte darum.
const TOKENS = readFileSync('design/tokens.css', 'utf-8');
const GLOBAL = readFileSync('src/app/global.css', 'utf-8');

function token(name: string, thema: 'hell' | 'dunkel'): string {
  const start = thema === 'hell' ? TOKENS.indexOf(':root') : TOKENS.indexOf('[data-theme="dark"]');
  const block = TOKENS.slice(start, TOKENS.indexOf('}', start));
  const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`).exec(block);
  if (!m) throw new Error(`Token --${name} (${thema}) fehlt`);
  return m[1]!;
}
const kanal = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function leuchte(h: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => kanal(Number.parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function kontrast(a: string, b: string): number {
  const [x, y] = [leuchte(a), leuchte(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
/** Die Fläche eines Felds in einer Karte: hell `--weich-karte` (#f1ebe1), dunkel der Grund (global.css). */
const FELD = { hell: '#f1ebe1', dunkel: token('ground', 'dunkel') };

describe('H3: Feldlinie auf dem Formblatt', () => {
  it('steht in global.css für Felder und Telefon, auch im Fokus', () => {
    const regel =
      /\.formblatt \.eingabe input,[\s\S]*?\{\s*box-shadow: inset 0 -1px 0 var\(--ink-quiet\);/;
    expect(GLOBAL).toMatch(regel);
    expect(GLOBAL).toMatch(/\.formblatt \.eingabe input:focus-visible/);
    expect(GLOBAL).toMatch(/\.formblatt \.telefon input\[type='tel'\]/);
  });

  for (const thema of ['hell', 'dunkel'] as const)
    it(`mindestens 3 : 1 (${thema})`, () => {
      const linie = token('ink-quiet', thema);
      expect(kontrast(linie, FELD[thema])).toBeGreaterThanOrEqual(3);
      expect(kontrast(linie, token('surface', thema))).toBeGreaterThanOrEqual(3);
    });

  it('Gegenprobe: die Fläche allein und eine Linie in --line reichen nicht', () => {
    expect(kontrast(FELD.hell, token('surface', 'hell'))).toBeLessThan(3);
    expect(kontrast(token('line', 'hell'), FELD.hell)).toBeLessThan(3);
  });
});
