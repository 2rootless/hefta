import tokens from '../../design/tokens.json' with { type: 'json' };

// Personenfarben (B14, Fassung 3): zwölf Farben aus einer Quelle, `design/tokens.json`, Gruppe „personen“.
// Die Nummer ist, was gespeichert wird (1 bis 6 aus Version 1 bleiben, 7 bis 12 neu). Die Reihenfolge sagt,
// welche Farbe eine neue Person bekommt. Fläche in App und Vermieterseite, Druckton für Zeichen auf Papier.

export interface Personenfarbe {
  nummer: number;
  reihenfolge: number;
  id: string;
  name: string;
  app: string;
  druckton: string;
}

export const PERSONENFARBEN: readonly Personenfarbe[] = (
  tokens as unknown as { personen: { farben: Personenfarbe[] } }
).personen.farben;

export const FARBEN_ANZAHL = PERSONENFARBEN.length;

/** Die Farbe zur gespeicherten Nummer; unbekannte Nummern fallen reihum auf eine gültige. */
export function personenfarbe(nummer: number): Personenfarbe {
  const n = ((((nummer - 1) % FARBEN_ANZAHL) + FARBEN_ANZAHL) % FARBEN_ANZAHL) + 1;
  return PERSONENFARBEN.find((f) => f.nummer === n)!;
}

/** Nummern in der Reihenfolge, in der Hefta sie neuen Personen gibt. */
export const VERGABE: readonly number[] = [...PERSONENFARBEN]
  .sort((a, b) => a.reihenfolge - b.reihenfolge)
  .map((f) => f.nummer);
