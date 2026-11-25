// W57 (PC198, E363, E366): die Ansprechperson des Haushalts.
//
// Sie steht im Mietvertrag, zuerst. Verlässt sie den Vertrag (herausgenommen, gelöscht, Bürge), wird ohne Frage
// die nächste Person im Vertrag nach der Reihenfolge Ansprechperson. Kommt sie zurück, bleibt die neue. Ersetzt
// `rollenNachruecken` (PC102, E209): Es gibt keine hauptmietende Person mehr, die nachrücken müsste.

import type { Haushalt, Id, Rolle, RolleAlt, Zugehoerigkeit } from './modell';

type Zug = Pick<Zugehoerigkeit, 'personId' | 'rolle' | 'reihenfolge'> & {
  herausgenommenAm?: string | null;
};

/** Rolle aus Schema 1 bis 3: Hauptmieter und Mitmieter stehen beide im Vertrag. */
export function rolleNeu(rolle: Rolle | RolleAlt | string): Rolle {
  return rolle === 'buerge' ? 'buerge' : 'vertrag';
}

/** Im Vertrag und nicht herausgenommen, nach der Reihenfolge. */
export function imVertrag<Z extends Zug>(alle: readonly Z[]): Z[] {
  return alle
    .filter((z) => !z.herausgenommenAm && rolleNeu(z.rolle) === 'vertrag')
    .sort((a, b) => a.reihenfolge - b.reihenfolge);
}

/**
 * Die Person-ID der Ansprechperson: die gespeicherte, wenn sie noch im Vertrag steht, sonst die erste im Vertrag.
 * Null nur, wenn niemand im Vertrag steht.
 */
export function ansprechperson(
  haushalt: Pick<Haushalt, 'ansprechpersonId'> | null | undefined,
  alle: readonly Zug[],
): Id | null {
  const vertrag = imVertrag(alle);
  const gespeichert = haushalt?.ansprechpersonId;
  if (gespeichert && vertrag.some((z) => z.personId === gespeichert)) return gespeichert;
  return vertrag[0]?.personId ?? null;
}

/** Die Ansprechperson zuerst, dann der Vertrag nach der Reihenfolge, dann die Bürgen (E366). */
export function geordnet<Z extends Zug>(
  haushalt: Pick<Haushalt, 'ansprechpersonId'> | null | undefined,
  alle: readonly Z[],
): Z[] {
  const an = ansprechperson(haushalt, alle);
  const rang = (z: Z) => (z.personId === an ? 0 : rolleNeu(z.rolle) === 'vertrag' ? 1 : 2);
  return [...alle].sort((a, b) => rang(a) - rang(b) || a.reihenfolge - b.reihenfolge);
}

/**
 * Nach einer Änderung an Rollen oder Plätzen: die neue Ansprechperson, wenn sie sich ändern muss, sonst `undefined`.
 * So bleibt die Wahl bestehen, auch wenn die frühere Ansprechperson zurückkommt (E366).
 */
export function ansprechNachruecken(
  haushalt: Pick<Haushalt, 'ansprechpersonId'>,
  alle: readonly Zug[],
): Id | null | undefined {
  const neu = ansprechperson(haushalt, alle);
  return neu === (haushalt.ansprechpersonId ?? null) ? undefined : neu;
}
