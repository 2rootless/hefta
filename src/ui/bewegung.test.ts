import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// E58: Bewegung nur über die Tokens, „Bewegung reduzieren“ an genau einer Stelle.

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((d) => {
    const pfad = join(ordner, d);
    return statSync(pfad).isDirectory() ? dateien(pfad) : [pfad];
  });
}

// Das alte Band (Einrichtung) mit seinen SVG-Animationen geht mit dem neuen Entwurf der Einrichtung.
const ALT = ['Band.svelte', 'Ziel.svelte', 'TechnikTest.svelte'];
const stile = dateien('src')
  .filter((d) => /\.(svelte|css)$/.test(d) && !ALT.some((a) => d.endsWith(a)))
  .map((d) => ({ d, text: readFileSync(d, 'utf8') }));

describe('Bewegung aus Tokens (E58)', () => {
  it('keine feste Dauer in transition oder animation', () => {
    const treffer = stile.flatMap(({ d, text }) =>
      [
        ...text.matchAll(/(?:transition|animation)(?:-duration)?\s*:[^;{}]*?\b\d+(?:\.\d+)?m?s\b/g),
      ].map((m) => `${d}: ${m[0].replace(/\s+/g, ' ')}`),
    );
    expect(treffer).toEqual([]);
  });

  it('jede CSS-Bewegung endet im Ruhezustand: `backwards`, nie `both` oder `forwards` (Nachricht 11.11. b)', () => {
    // Auch das alte Band: Hier gilt die Regel ohne Ausnahme.
    const alle = dateien('src')
      .filter((d) => /\.(svelte|css)$/.test(d))
      .map((d) => ({ d, text: readFileSync(d, 'utf8') }));
    const treffer = alle.flatMap(({ d, text }) =>
      [
        ...text.matchAll(
          /animation(?:-fill-mode)?\s*:[^;{}]*\b(?:both|forwards)\b[^;{}]*|fill-mode\s*:\s*(?:both|forwards)/g,
        ),
      ].map((m) => `${d}: ${m[0].replace(/\s+/g, ' ')}`),
    );
    expect(treffer).toEqual([]);
  });

  it('„Bewegung reduzieren“ nur in design/tokens.css und dem Not-Aus in global.css', () => {
    const treffer = stile
      .filter(({ text }) => text.includes('prefers-reduced-motion'))
      .map(({ d }) => d.replaceAll('\\', '/'));
    expect(treffer).toEqual(['src/app/global.css']);
    const tokens = readFileSync('design/tokens.css', 'utf8');
    expect(tokens).toMatch(/prefers-reduced-motion: reduce[\s\S]*--bw-lang: 0ms/);
    expect(tokens).toMatch(/--bw-blende: 120ms/);
  });

  it('Dauern bleiben unter 300 ms (B18 Abschnitt 5)', () => {
    const tokens = readFileSync('design/tokens.css', 'utf8');
    for (const m of tokens.matchAll(/--bw-[a-z]+: (\d+)ms/g))
      expect(Number(m[1])).toBeLessThanOrEqual(300);
  });

  it('derselbe Satz wie im Design (B21 bewegung-tokens.md, Nachricht 11.11. a)', () => {
    const tokens = readFileSync('design/tokens.css', 'utf8');
    const kopf = tokens.slice(0, tokens.indexOf('prefers-reduced-motion'));
    const satz = Object.fromEntries(
      [...kopf.matchAll(/--bw-([a-z-]+): ([^;]+);/g)].map((m) => [m[1], m[2]]),
    );
    expect(satz).toEqual({
      knapp: '120ms',
      kurz: '160ms',
      mittel: '200ms',
      lang: '240ms',
      aufschlagen: '280ms',
      takt: '40ms',
      blende: 'var(--bw-knapp)',
      'nur-reduziert': '0ms',
      ziel: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
      weich: 'ease-out',
      setzen: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      gleich: 'linear',
    });
  });
});
