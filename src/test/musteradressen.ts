// W7 (PC52, PC53): Die Muster nutzen nur Adressen aus der Liste der Planung. Die Design-Pakete bleiben
// unverändert und nennen noch die alten; Tests, die mit ihrem Wortlaut vergleichen, setzen die neuen ein.

/** Alte Musteradresse im Design → neue aus der geprüften Liste (längere zuerst). */
export const ADRESSEN_ALT_NEU: readonly (readonly [string, string])[] = [
  ['Große Bergstraße 152', 'Große Beispielstraße 1'],
  ['22767 Hamburg-Altona', '12345 Musterstadt-Nord'],
  ['Hauptstraße 12', 'Beispielstraße 1'],
  ['22767 Hamburg', '12345 Musterstadt'],
  ['in der Lindenallee 3', 'im Lindenring 3'],
  ['Lindenallee 3', 'Lindenring 3'],
];

/** Ein Text aus dem Design mit den Adressen der Muster von heute. */
export function aufMusteradressen(text: string): string {
  return ADRESSEN_ALT_NEU.reduce((t, [alt, neu]) => t.replaceAll(alt, neu), text);
}
