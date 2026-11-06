// „Rückgängig“ statt Rückfrage (design/nachtraeglich-ordnen.md, OR7b): Die Zeile steht über der
// Hauptaktion, bis man die Seite verlässt oder etwas anderes tut. Keine Zeitgrenze.

interface Eintrag {
  text: string;
  /** Auf dieser Seite bleibt sie stehen. */
  seite: string;
  ausfuehren: () => Promise<void>;
}

export const rueck = $state<{ eintrag: Eintrag | null; leisten: number }>({
  eintrag: null,
  leisten: 0,
});

export function rueckgaengigAnbieten(eintrag: Eintrag): void {
  rueck.eintrag = eintrag;
}

export function rueckgaengigVergessen(): void {
  rueck.eintrag = null;
}
