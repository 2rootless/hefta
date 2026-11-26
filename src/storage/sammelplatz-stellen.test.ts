import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// PC214, Abschnitt 1 (Weg A): Der Sammelplatz für Personen ohne Haushalt ist nie ein Haushalt. Die App liest Haushalte
// nur an wenigen Stellen direkt aus der Datenbank; alles andere (Startseite, Mappe, Deckblatt, Lesehilfe,
// Vermieter-Link, Mitteilungen, Fehlerbericht, Anrede) geht über den geladenen Haushalt aus `haushaltLaden`, der den
// Sammelplatz nie liefert (ohneHaushalt.test.ts). Dieser Test findet jede direkte Abfrage aller Haushalte und verlangt,
// dass sie den Sammelplatz ausdrücklich behandelt. Kommt eine neue dazu, wird er rot.

const ABFRAGE =
  /getAll\(\s*'haushalte'|objectStore\(\s*'haushalte'\s*\)\s*\.getAll\(\)|daten\.haushalte\b/;

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const pfad = join(ordner, n);
    if (statSync(pfad).isDirectory()) return dateien(pfad);
    return /\.(ts|svelte)$/.test(n) && !/\.test\.ts$/.test(n) ? [pfad.replaceAll('\\', '/')] : [];
  });
}

/** Stellen, die alle Haushalte lesen, und ob sie den Sammelplatz ausdrücklich behandeln. */
function stellen(quellen: { pfad: string; text: string }[]) {
  return quellen
    .filter((q) => ABFRAGE.test(q.text))
    .map((q) => ({ pfad: q.pfad, behandelt: /ohneHaushalt|sammel/i.test(q.text) }));
}

describe('PC214: Der Sammelplatz taucht nirgends als Haushalt auf', () => {
  const quellen = dateien('src').map((pfad) => ({ pfad, text: readFileSync(pfad, 'utf8') }));

  it('jede direkte Abfrage aller Haushalte behandelt den Sammelplatz', () => {
    const gefunden = stellen(quellen);
    expect(gefunden.map((s) => s.pfad).sort()).toEqual([
      // Migration auf Schema 4: setzt nur die Ansprechperson, die der Sammelplatz nicht braucht (er kommt später).
      'src/storage/db.ts',
      'src/storage/haushalte.ts',
      'src/storage/ohneHaushalt.ts',
      'src/storage/sicherung.ts',
      'src/storage/speicher.ts',
    ]);
    expect(gefunden.filter((s) => !s.behandelt && s.pfad !== 'src/storage/db.ts')).toEqual([]);
  });

  it('Gegenprobe: eine neue Liste aller Haushalte ohne Ausnahme würde gefunden', () => {
    const neu = stellen([
      ...quellen,
      { pfad: 'src/screens/Neu.svelte', text: "const alle = await db.getAll('haushalte');" },
    ]);
    expect(neu.filter((s) => !s.behandelt).map((s) => s.pfad)).toContain('src/screens/Neu.svelte');
  });
});
