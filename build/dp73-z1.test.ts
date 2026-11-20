import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// DP73 Z1 (PC106): Kein Text von App und Vermieterseite enthält ein unsichtbares Leerzeichen (U+200B). Umbrüche nach
// „@“ oder „_“ macht <wbr> (src/ui/MitUmbruch.svelte, src/vermieter/MitUmbruch.svelte). Gesucht wird das Zeichen
// selbst, seine Schreibweise mit Backslash und die mit fromCharCode.
const ZEICHEN = String.fromCharCode(0x200b);
const SCHREIBWEISEN = [ZEICHEN, String.fromCharCode(92) + 'u200b', '0x200b'];

export function nullbreite(text: string): boolean {
  const klein = text.toLowerCase();
  return SCHREIBWEISEN.some((s) => klein.includes(s));
}

const dateien = execFileSync('git', ['ls-files', 'src', 'data'], { encoding: 'utf8' })
  .split(String.fromCharCode(10))
  .filter((d) => /\.(ts|svelte|json)$/.test(d) && !/\.test\.ts$/.test(d));

describe('DP73 Z1: kein U+200B im Text', () => {
  it('keine Quelle von App und Vermieterseite enthält U+200B', () => {
    expect(dateien.length).toBeGreaterThan(100);
    expect(dateien.filter((d) => nullbreite(readFileSync(d, 'utf8')))).toEqual([]);
  });

  it('Gegenprobe: jede Schreibweise wird gefunden', () => {
    expect(nullbreite(`hallo@${ZEICHEN}hefta.de`)).toBe(true);
    expect(nullbreite(`replace('@', '@${String.fromCharCode(92)}u200b')`)).toBe(true);
    expect(nullbreite('String.fromCharCode(0x200B)')).toBe(true);
    expect(nullbreite('hallo@<wbr />hefta.de')).toBe(false);
  });
});
