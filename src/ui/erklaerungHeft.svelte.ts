// E112, DP49 Punkt 5: Für welches Heft der nächste Scan der Bürgschaftserklärung gilt. „Unterschriebenes Blatt
// hinzufügen“ setzt es und öffnet die Seite der Unterlage; die liest es einmal beim Öffnen und leert es.
// Ohne diesen Weg (etwa über die Personenseite) gilt ein Scan für keine bestimmte Wohnung.

export const erklaerungHeft = $state<{ personId: string | null; heftId: string | null }>({
  personId: null,
  heftId: null,
});

/** Liest das Ziel für diese Person und vergisst es; ein anderer Weg auf die Seite trägt es nicht weiter. */
export function erklaerungHeftNehmen(personId: string): string | null {
  const heftId = erklaerungHeft.personId === personId ? erklaerungHeft.heftId : null;
  erklaerungHeft.personId = null;
  erklaerungHeft.heftId = null;
  return heftId;
}
