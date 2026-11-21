import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// DP49 Punkt 8 (W30, W32): Jede Angabe der Selbstauskunft hat einen Satz, der erklärt und empfiehlt, nie
// vorschreibt (kein „muss“, keine „Pflicht“) und Hefta nicht lobt. Jeder Satz steht auch in der Oberfläche.

const de = JSON.parse(readFileSync('src/i18n/de.json', 'utf8')) as {
  selbstauskunft: { kontaktSatz: string };
  angabeSatz: Record<string, string | Record<string, string>>;
};

/** Die Angaben aus DP49, Abschnitt „Sätze zu den Angaben“ (ohne den WBS, der mit den Grundlücken kommt). */
export const ANGABEN = [
  'name',
  'kontakt',
  'rolle',
  'beruf',
  'lebenslage',
  'einkommen',
  'einziehen',
  'haustiere',
  'insolvenz',
  'raeumungstitel',
  'mietrueckstaende',
] as const;

function saetze(texte: typeof de): Record<string, string[]> {
  const aus: Record<string, string[]> = {};
  for (const a of ANGABEN) {
    const wert = a === 'kontakt' ? texte.selbstauskunft.kontaktSatz : texte.angabeSatz[a];
    aus[a] = wert === undefined ? [] : typeof wert === 'string' ? [wert] : Object.values(wert);
  }
  return aus;
}

/** Angaben ohne Satz oder mit einem Satz, der W32 verletzt. */
export function befunde(texte: typeof de): string[] {
  const aus: string[] = [];
  for (const [angabe, liste] of Object.entries(saetze(texte))) {
    if (!liste.length || liste.some((s) => !s.trim())) aus.push(`${angabe}: kein Satz`);
    for (const s of liste) {
      if (/\b(muss|müsst|musst|Pflicht)/i.test(s)) aus.push(`${angabe}: schreibt vor`);
      if (/Hefta|\{app\}/.test(s)) aus.push(`${angabe}: nennt Hefta`);
    }
  }
  return aus;
}

function svelteDateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? svelteDateien(join(ordner, e.name))
      : e.name.endsWith('.svelte')
        ? [join(ordner, e.name)]
        : [],
  );
}

describe('W30: jede Angabe hat einen Satz', () => {
  it('jede Angabe aus DP49 hat einen Satz ohne Vorschrift und ohne Lob', () => {
    expect(befunde(de)).toEqual([]);
  });

  it('jeder Satz steht in der Oberfläche', () => {
    const code = svelteDateien('src')
      .map((d) => readFileSync(d, 'utf8'))
      .join('\n');
    expect(code).toContain("t('selbstauskunft.kontaktSatz')");
    // Die drei Fragen aus dem Musterbogen holen ihren Satz über den Namen der Frage.
    expect(code).toContain('angabeSatz.${f}');
    for (const a of ANGABEN.filter(
      (x) => !['kontakt', 'insolvenz', 'raeumungstitel', 'mietrueckstaende'].includes(x),
    ))
      expect(code, a).toContain(`t('angabeSatz.${a}')`);
  });

  it('Gegenprobe: fehlt ein Satz oder schreibt einer vor, wird es rot', () => {
    const kaputt = structuredClone(de);
    delete kaputt.angabeSatz.beruf;
    kaputt.angabeSatz.name = 'Der Name ist Pflicht.';
    expect(befunde(kaputt)).toEqual(['name: schreibt vor', 'beruf: kein Satz']);
  });
});
