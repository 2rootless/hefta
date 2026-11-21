// E310: Hefta urteilt nie über die Echtheit eines Dokuments. Diese Wörter stehen nirgends,
// weder in den Texten der App (de.json) noch auf der Vermieterseite, im Regelkatalog oder im Text der erzeugten PDFs.
// Geprüft werden alle Quelldateien außer Tests, denn auch die PDF-Texte stehen dort.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const VERBOTEN = ['fälschung', 'gefälscht', 'ungültig', 'stimmt nicht', 'unecht'];

/** Liefert die verbotenen Wörter, die im Text stehen (ohne Rücksicht auf Groß und Klein). */
export function verboteneWoerter(text: string): string[] {
  const klein = text.toLowerCase();
  return VERBOTEN.filter((w) => klein.includes(w));
}

function dateien(ordner: string): string[] {
  const aus: string[] = [];
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) aus.push(...dateien(pfad));
    else if (/\.(ts|svelte|json|html|mjs|js)$/.test(name) && !/\.(test|spec)\.ts$/.test(name))
      aus.push(pfad);
  }
  return aus;
}

describe('E310: kein Urteil über Echtheit', () => {
  it('kein verbotenes Wort in App, Vermieterseite, Regelkatalog und PDF-Texten', () => {
    const funde: string[] = [];
    for (const ordner of ['src', 'data', 'vermieter', 'scripts']) {
      for (const pfad of dateien(ordner)) {
        const w = verboteneWoerter(readFileSync(pfad, 'utf-8'));
        if (w.length) funde.push(`${pfad}: ${w.join(', ')}`);
      }
    }
    expect(funde).toEqual([]);
  });

  it('der neue Satz steht beim Bonitätsnachweis', () => {
    const regel = readFileSync('src/vermieter/regel.ts', 'utf-8');
    expect(regel).toContain(
      'Nach Ablauf der Frist lässt sich der Nachweis nur nicht mehr online prüfen.',
    );
  });

  it('Gegenprobe: der alte Satz und jedes Wort werden gefunden', () => {
    expect(verboteneWoerter('Endet die Frist, wird der Nachweis dadurch nicht ungültig.')).toEqual([
      'ungültig',
    ]);
    for (const w of VERBOTEN) expect(verboteneWoerter(`Das ist ${w.toUpperCase()}.`)).toEqual([w]);
  });
});
