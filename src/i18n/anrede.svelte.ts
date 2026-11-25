// Ansprache der App (E74, E83, B28b, E369): „ihr“ bei mehreren Personen ohne Bürgen, „du“ bei einer und ohne
// Haushalt (E369 hebt E74.4 auf). App.svelte setzt sie aus dem Haushalt; `t()` wählt damit die Fassung eines Paars
// `{ "ihr": …, "du": … }` in de.json. Als Zustand von Svelte, damit Texte mitwechseln.

export type Anrede = 'ihr' | 'du';

export const anrede = $state<{ wert: Anrede }>({ wert: 'ihr' });

/** Die Regel an einer Stelle: ohne Haushalt „du“ (E369), sonst „ihr“ ab zwei Personen ohne Bürgen. */
export function anredeFuer(personenOhneBuergen: number | null): Anrede {
  return personenOhneBuergen !== null && personenOhneBuergen > 1 ? 'ihr' : 'du';
}
