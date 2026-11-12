// Die vier Fragen der Rückmeldung (E54, B19 Fassung 4 und 5): nur Schlüssel. Die Wortlaute stehen in
// src/i18n/de.json unter „rueckmeldung“. Dieselbe Liste prüft der Empfang (functions/api/rueckmeldung.ts):
// Was nicht hier steht, wird nicht gezählt.

export const FRAGEN = {
  geholfen: ['ja', 'teils', 'nein'],
  naechstes: ['geraete', 'android', 'karte', 'scannen', 'vergleich'],
  fehlt: ['wbs', 'englisch', 'anfordern', 'umzug'],
  woher: ['freunde', 'mappe', 'suche', 'beratung', 'anders'],
} as const;

export type Frage = keyof typeof FRAGEN;
export type Antwort<F extends Frage = Frage> = (typeof FRAGEN)[F][number];

export const FRAGE_REIHE: readonly Frage[] = ['geholfen', 'naechstes', 'fehlt', 'woher'];

/** Gehört die Antwort zur Frage? Nur dann zählt der Empfang sie. */
export function gueltig(f: unknown, a: unknown): f is Frage {
  if (typeof f !== 'string' || typeof a !== 'string') return false;
  if (!Object.hasOwn(FRAGEN, f)) return false;
  return (FRAGEN[f as Frage] as readonly string[]).includes(a);
}
