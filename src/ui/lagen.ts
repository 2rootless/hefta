// DP47 G5: weitere Lebenslagen aus dem Personenformular übernehmen, mit Einrichtung und Personenseite gleich.
import type { Lebenslage, Person } from '../domain/modell';
import type { PersonEingabe } from './PersonFormular.svelte';

/**
 * Weitere Lebenslagen mit ihren bisherigen Angaben (Beruf, Arbeitgeber, Netto). Wurde die erste entfernt
 * (L8), übernimmt die Person die Angaben der nachgerückten Lage; war sie neu, sind diese Felder leer.
 */
export function lagenAngaben(
  werte: Pick<PersonEingabe, 'weitereLagen' | 'ersteAus'>,
  bisher: Lebenslage[] = [],
): Pick<Person, 'weitereLagen'> &
  Partial<Pick<Person, 'beruf' | 'arbeitgeber' | 'nettoeinkommen'>> {
  const weitereLagen = (werte.weitereLagen ?? []).map((l) => ({
    ...(bisher.find((b) => b.id === l.id) ?? {}),
    id: l.id,
    situation: l.situation,
    ausbildungArt: l.ausbildungArt ?? null,
  }));
  if (!werte.ersteAus) return { weitereLagen };
  const nach = bisher.find((b) => b.id === werte.ersteAus);
  return {
    weitereLagen,
    beruf: nach?.beruf ?? '',
    arbeitgeber: nach?.arbeitgeber ?? '',
    nettoeinkommen: nach?.nettoeinkommen ?? null,
  };
}

/** Für das Formular: die weiteren Lagen einer gespeicherten Person. */
export function lagenEingabe(person: Pick<Person, 'weitereLagen'>): PersonEingabe['weitereLagen'] {
  return (person.weitereLagen ?? []).map((l) => ({
    id: l.id,
    situation: l.situation,
    ausbildungArt: l.ausbildungArt ?? null,
  }));
}
