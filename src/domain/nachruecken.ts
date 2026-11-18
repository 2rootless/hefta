// Genau eine hauptmietende Person je Haushalt (PC102, E209, Frage 1).
//
// Fehlt sie, weil sie herausgenommen, gelöscht oder Bürge wurde, rückt die nächste Person im Mietvertrag nach
// (die erste nach der Reihenfolge). Kommt eine frühere hauptmietende Person zurück, während schon eine andere
// hauptmietet, steht sie wieder im Vertrag, aber als Mitmieter. Die Lesehilfe (FORMAT.md, Abschnitt 11, Punkt 6)
// verlangt darum genau eine.

import type { Id, Zugehoerigkeit } from './modell';

type Zug = Pick<Zugehoerigkeit, 'id' | 'haushaltId' | 'rolle' | 'reihenfolge'> & {
  herausgenommenAm?: string | null;
};

const nachReihenfolge = <Z extends Zug>(a: Z, b: Z) => a.reihenfolge - b.reihenfolge;

/**
 * Die Zugehörigkeiten, deren Rolle sich ändern muss, damit jeder Haushalt mit jemandem im Mietvertrag genau
 * eine hauptmietende Person hat. Gibt geänderte Kopien zurück; die übrigen bleiben, wie sie sind.
 *
 * - Keine: Die erste im Vertrag (nach der Reihenfolge) wird hauptmietend.
 * - Mehrere: Die erste bleibt, die anderen werden Mitmieter. Wer zurückkommt, steht hinten und gibt nach.
 * - Herausgenommene zählen nicht. Bürgen rücken nie nach.
 */
export function rollenNachruecken<Z extends Zug>(alle: readonly Z[]): Z[] {
  const haushalte = new Map<Id, Z[]>();
  for (const z of alle) {
    if (z.herausgenommenAm || z.rolle === 'buerge') continue;
    haushalte.set(z.haushaltId, [...(haushalte.get(z.haushaltId) ?? []), z]);
  }
  const aenderungen: Z[] = [];
  for (const vertrag of haushalte.values()) {
    const haupt = vertrag.filter((z) => z.rolle === 'hauptmieter').sort(nachReihenfolge);
    if (haupt.length === 0) {
      const erste = [...vertrag].sort(nachReihenfolge)[0]!;
      aenderungen.push({ ...erste, rolle: 'hauptmieter' });
    }
    for (const z of haupt.slice(1)) aenderungen.push({ ...z, rolle: 'mitmieter' });
  }
  return aenderungen;
}
