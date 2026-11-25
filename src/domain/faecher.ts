// W57/W54, Bedienung R1 „Fächer“ (PC199, E372; DP127, DP128, DP129): der Haushalt als vier Fächer. Reine Logik, nach
// der Probe von Design (`r.html`): Eine Liste in fester Reihenfolge, die Ansprechperson ist die erste im Vertrag.
// Die Oberfläche zeigt beim Ziehen das Ergebnis dieser Funktionen als Vorschau und speichert beim Loslassen genau
// diesen Stand (DP128, Punkt 1: kein Rücksprung). „Rückgängig“ speichert den Stand davor.

import type { Id } from './modell';

export type Fach = 'vertrag' | 'nurmit' | 'buerge' | 'weg';

/** Reihenfolge der Fächer auf dem Bildschirm (N9). */
export const FAECHER: readonly Fach[] = ['vertrag', 'nurmit', 'buerge', 'weg'];

export interface Eintrag {
  /** Zugehörigkeit; bei einer neuen Person aus der Frage (W42) eine vorläufige Kennung. */
  id: Id;
  personId: Id;
  name: string;
  farbe: number;
  fach: Fach;
  /** Nur für die Frage: eine neue Person, die erst beim Speichern angelegt wird. */
  neu?: boolean;
}

/** Was nach einer Änderung in der Zeile steht (DP127): Schlüssel und Namen, der Text kommt aus de.json. */
export type Folge =
  | { art: 'fach'; fach: Fach; name: string }
  | { art: 'ansprech'; name: string }
  | { art: 'kommt'; name: string };

export interface Ergebnis {
  liste: Eintrag[];
  folgen: Folge[];
}

/** W42 (Fälle 4 und 5): Würde der Vertrag leer, bleibt die Person, und die Liste fragt, wer hineinkommt. */
export interface Frage {
  id: Id;
  fach: Fach;
}

const kopie = (l: readonly Eintrag[]) => l.map((e) => ({ ...e }));
export const imFach = (l: readonly Eintrag[], f: Fach) => l.filter((e) => e.fach === f);
/** Die Ansprechperson: die erste im Vertrag (E366). */
export const ansprech = (l: readonly Eintrag[]): Eintrag | null => imFach(l, 'vertrag')[0] ?? null;

/** Ordnet die Liste in die feste Folge der Fächer; innerhalb eines Fachs bleibt die Reihenfolge. */
export function geordnet(l: readonly Eintrag[]): Eintrag[] {
  return FAECHER.flatMap((f) => imFach(l, f));
}

/**
 * Verschiebt eine Person in ein Fach, vor die Person an Stelle `stelle` (ohne: ans Ende). Würde der Vertrag leer,
 * kommt eine Frage zurück und nichts ändert sich (W42). Verlässt die Ansprechperson den Vertrag, wird die nächste im
 * Vertrag Ansprechperson, und die Folge sagt es (E366).
 */
export function verschieben(
  l: readonly Eintrag[],
  id: Id,
  fach: Fach,
  stelle?: number,
): Ergebnis | { frage: Frage } {
  const neu = kopie(l);
  const p = neu.find((e) => e.id === id);
  if (!p) return { liste: geordnet(neu), folgen: [] };
  const alt = p.fach;
  const altAn = ansprech(l);
  const rest = neu.filter((e) => e !== p);
  const ziel = rest.filter((e) => e.fach === fach);
  p.fach = fach;
  const vor = ziel[Math.min(stelle ?? ziel.length, ziel.length)];
  rest.splice(vor ? rest.indexOf(vor) : rest.length, 0, p);
  const liste = geordnet(rest);
  if (!imFach(liste, 'vertrag').length) return { frage: { id, fach } };
  const folgen: Folge[] = [];
  if (alt !== fach) folgen.push({ art: 'fach', fach, name: p.name });
  const neuAn = ansprech(liste);
  if (neuAn && altAn && neuAn.id !== altAn.id) folgen.push({ art: 'ansprech', name: neuAn.name });
  return { liste, folgen };
}

/**
 * Die Vorschau beim Ziehen (G2): derselbe Stand wie `verschieben`, aber ohne Sperre; ob der Vertrag leer würde,
 * entscheidet erst das Loslassen. `ansprech` als Fach legt die Person zuerst in den Vertrag.
 */
export function vorschau(
  l: readonly Eintrag[],
  id: Id,
  fach: Fach | 'ansprech',
  stelle?: number,
): Eintrag[] {
  if (fach === 'ansprech') return zurAnsprech(l, id).liste;
  const neu = kopie(l);
  const p = neu.find((e) => e.id === id);
  if (!p) return geordnet(neu);
  const rest = neu.filter((e) => e !== p);
  const ziel = rest.filter((e) => e.fach === fach);
  p.fach = fach;
  const vor = ziel[Math.min(stelle ?? ziel.length, ziel.length)];
  rest.splice(vor ? rest.indexOf(vor) : rest.length, 0, p);
  return geordnet(rest);
}

/** Macht eine Person zur Ansprechperson: Sie steht danach im Vertrag, zuerst (G6). */
export function zurAnsprech(l: readonly Eintrag[], id: Id): Ergebnis {
  const neu = kopie(l);
  const p = neu.find((e) => e.id === id);
  if (!p) return { liste: geordnet(neu), folgen: [] };
  const rest = neu.filter((e) => e !== p);
  p.fach = 'vertrag';
  rest.unshift(p);
  return { liste: geordnet(rest), folgen: [{ art: 'ansprech', name: p.name }] };
}

/**
 * Beantwortet die Frage (W42): Eine Person (Bürge oder wer nur mit einzieht) oder eine neue mit Vornamen kommt in den
 * Vertrag, zuerst, und ist Ansprechperson; dann geht die gefragte Person in ihr Ziel.
 */
export function frageLoesen(
  l: readonly Eintrag[],
  frage: Frage,
  wer: Id | { neu: string },
): Ergebnis {
  const neu = kopie(l);
  let n: Eintrag;
  if (typeof wer === 'string') {
    n = neu.find((e) => e.id === wer)!;
    neu.splice(neu.indexOf(n), 1);
    n.fach = 'vertrag';
  } else {
    const farbe = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((f) => !neu.some((e) => e.farbe === f)) ?? 1;
    n = {
      id: `neu-${neu.length + 1}`,
      personId: '',
      name: wer.neu,
      farbe,
      fach: 'vertrag',
      neu: true,
    };
  }
  neu.unshift(n);
  const p = neu.find((e) => e.id === frage.id)!;
  p.fach = frage.fach;
  return {
    liste: geordnet(neu),
    folgen: [
      { art: 'kommt', name: n.name },
      { art: 'fach', fach: frage.fach, name: p.name },
    ],
  };
}

/** Wer die Frage beantworten kann: Bürgen und wer nur mit einzieht (DP127). */
export function kandidaten(l: readonly Eintrag[]): Eintrag[] {
  return l.filter((e) => e.fach === 'buerge' || e.fach === 'nurmit');
}

/** Ziele in der Zeile ohne Ziehen (G4): „Ansprechperson“ (wenn sie es nicht schon ist), dann die anderen Fächer. */
export function ziele(l: readonly Eintrag[], id: Id): ('ansprech' | Fach)[] {
  const p = l.find((e) => e.id === id);
  if (!p) return [];
  const z: ('ansprech' | Fach)[] = FAECHER.filter((f) => f !== p.fach);
  if (ansprech(l)?.id !== id && p.fach !== 'weg') z.unshift('ansprech');
  return z;
}
