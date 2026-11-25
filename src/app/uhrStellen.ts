// PC209, DP140 (W10): Für Store-Bild 08 läuft die Uhr der App so, als wäre der 11. November. Der Simulator lässt
// sich nicht zurückstellen; die App rechnet an über 80 Stellen mit `new Date()`. Darum ersetzt diese Funktion im
// Bau für die Aufnahmen (VITE_AUFNAHMEN=1) das globale `Date` durch eines mit festem Versatz. In jedem anderen
// Bau ist sie nicht enthalten. Zeitgeber (setTimeout) laufen weiter in echter Zeit.

/** Stellt `Date` und `Date.now()` auf `ziel`; ab da läuft die Zeit normal weiter. Gibt das echte `Date` zurück. */
export function uhrStellen(
  ziel: Date,
  ort: { Date: DateConstructor } = globalThis,
): DateConstructor {
  const Echt = ort.Date;
  const versatz = ziel.getTime() - Echt.now();
  class Gestellt extends Echt {
    constructor(...werte: unknown[]) {
      if (werte.length === 0) super(Echt.now() + versatz);
      else super(...(werte as [string]));
    }
    static override now(): number {
      return Echt.now() + versatz;
    }
  }
  ort.Date = Gestellt as unknown as DateConstructor;
  return Echt;
}
