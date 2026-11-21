// DP47 G5: Lebenslagen einer Person in Reihenfolge. Die erste steht in den Feldern der Person
// (lebenssituation, beruf, arbeitgeber, nettoeinkommen), weitere in `weitereLagen`. Eigenes Modul, damit
// Regelkatalog und Selbstauskunft es beide nutzen können, ohne sich gegenseitig zu laden.
import type { AusbildungArt, Lebenssituation, Person } from './modell';

/** DP47 G5: eine Lebenslage der Person in Reihenfolge; `lageId` null bei der ersten. */
export interface LageAngabe {
  situation: Lebenssituation;
  art: AusbildungArt | null;
  lageId: string | null;
  arbeitgeber: string;
  /** L4: Die Person ist mehr als einmal angestellt; dann nennt die Zeile den Arbeitgeber. */
  mitArbeitgeber?: boolean;
}

/** Alle Lebenslagen der Person in Reihenfolge; die erste steht in den Feldern der Person. */
export function lagenVon(
  person: Pick<Person, 'lebenssituation' | 'ausbildungArt' | 'weitereLagen' | 'arbeitgeber'>,
): LageAngabe[] {
  if (!person.lebenssituation) return [];
  const alle: LageAngabe[] = [
    {
      situation: person.lebenssituation,
      art: person.ausbildungArt ?? null,
      lageId: null,
      arbeitgeber: person.arbeitgeber?.trim() ?? '',
    },
    ...(person.weitereLagen ?? []).map((l) => ({
      situation: l.situation,
      art: l.ausbildungArt ?? null,
      lageId: l.id,
      arbeitgeber: l.arbeitgeber?.trim() ?? '',
    })),
  ];
  const angestellt = alle.filter((l) => l.situation === 'angestellt').length;
  return angestellt > 1
    ? alle.map((l) => (l.situation === 'angestellt' ? { ...l, mitArbeitgeber: true } : l))
    : alle;
}

/**
 * Die Lagen, nach denen sich Einkommen und Nachweise richten. DP47b K1: Ist eine Lage „Leistungen vom
 * Amt“ und der Schalter „Einkommen trotzdem angeben“ aus, gilt Version 1, nur diese Lage zählt.
 */
export function wirksameLagen(
  person: Pick<
    Person,
    'lebenssituation' | 'ausbildungArt' | 'weitereLagen' | 'einkommenTrotzdem' | 'arbeitgeber'
  >,
): LageAngabe[] {
  const alle = lagenVon(person);
  if (alle.some((l) => l.situation === 'leistungsbezug') && !person.einkommenTrotzdem)
    return alle.filter((l) => l.situation === 'leistungsbezug');
  return alle;
}
