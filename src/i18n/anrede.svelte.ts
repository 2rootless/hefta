// Ansprache der App (E74, E83, B28b): „ihr“ ohne Haushalt oder bei mehreren Personen, „du“ bei einer
// Person. App.svelte setzt sie aus dem Haushalt; `t()` wählt damit die Fassung eines Paars
// `{ "ihr": …, "du": … }` in de.json. Als Zustand von Svelte, damit Texte mitwechseln.

export type Anrede = 'ihr' | 'du';

export const anrede = $state<{ wert: Anrede }>({ wert: 'ihr' });

/** Die Regel an einer Stelle: ohne Haushalt „ihr“, sonst ab zwei Personen ohne Bürgen. */
export function anredeFuer(personenOhneBuergen: number | null): Anrede {
  return personenOhneBuergen === null || personenOhneBuergen > 1 ? 'ihr' : 'du';
}
