import type { Haushalt, Person, Zugehoerigkeit } from './modell';

// Netto des Haushalts (E50, B23 `#s=netto`): die Summe der Nettoeinkommen aus den Selbstauskünften der
// Personen, die einziehen (ohne Bürgen). Der Haushalt kann sie überschreiben, etwa für Kindergeld oder
// Unterhalt; diese Zahl bleibt in Hefta und kommt nicht in die Mappe.

interface MitgliedLike {
  zugehoerigkeit: Pick<Zugehoerigkeit, 'rolle' | 'farbe'>;
  person: Pick<Person, 'id' | 'rufname' | 'vorname' | 'nettoeinkommen'>;
}

export interface NettoTeil {
  id: string;
  name: string;
  farbe: number;
  betrag: number;
}

/** Die Beträge aus den Selbstauskünften und ihre Summe; null, wenn niemand einen eingetragen hat. */
export function nettoAusSelbstauskuenften(mitglieder: readonly MitgliedLike[]): {
  teile: NettoTeil[];
  summe: number | null;
} {
  const teile = mitglieder
    .filter((m) => m.zugehoerigkeit.rolle !== 'buerge' && (m.person.nettoeinkommen ?? 0) > 0)
    .map((m) => ({
      id: m.person.id,
      name: m.person.rufname || m.person.vorname,
      farbe: m.zugehoerigkeit.farbe,
      betrag: m.person.nettoeinkommen!,
    }));
  return { teile, summe: teile.length ? teile.reduce((s, t) => s + t.betrag, 0) : null };
}

/** Das Netto, mit dem Hefta rechnet: selbst eingetragen, sonst die Summe aus den Selbstauskünften. */
export function haushaltsNetto(
  hh: Pick<Haushalt, 'netto'>,
  mitglieder: readonly MitgliedLike[],
): number | null {
  return hh.netto ?? nettoAusSelbstauskuenften(mitglieder).summe;
}
