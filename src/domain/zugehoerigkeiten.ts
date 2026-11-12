// Mehrere Haushalte, nur das Modell (E53). Die Oberfläche kennt in Schritt 1 einen Haushalt.
//
// Farbe (Mehrere Haushalte, § 10): Sie gehört sichtbar der Person und ist überall gleich.
// Gespeichert ist sie an der Zugehörigkeit (Nachricht 10d): Kommt eine Person in einen Haushalt,
// bringt sie ihre Farbe mit. Nie haben zwei Personen in einem Haushalt dieselbe.
//
// Bürgschaft: Eine Bürgschaftserklärung gehört zu einem Mietvertrag, also zur Zugehörigkeit.
// Erklärungen aus anderen Haushalten zählen nicht.

import type { Dokument, Id, Zugehoerigkeit } from './modell';
import { VERGABE } from './personenfarben';

type Zug = Pick<Zugehoerigkeit, 'id' | 'haushaltId' | 'personId' | 'farbe' | 'createdAt'> & {
  herausgenommenAm?: string | null;
};

const aktiv = (z: Zug) => !z.herausgenommenAm;

/** Die Farbe, die eine Person schon hat: aus ihrer ältesten Zugehörigkeit, die noch gilt. */
export function farbeDerPerson(personId: Id, alle: readonly Zug[]): number | null {
  const eigene = alle
    .filter((z) => z.personId === personId)
    .sort((a, b) => Number(aktiv(b)) - Number(aktiv(a)) || a.createdAt.localeCompare(b.createdAt));
  return eigene[0]?.farbe ?? null;
}

/**
 * Farbe für eine Person, die in einen Haushalt kommt (§ 10).
 *
 * 1. Hat sie schon eine Farbe und ist die im Haushalt frei: diese.
 * 2. Sonst die nächste Farbe der Reihe, die in keinem Haushalt vergeben ist.
 * 3. Sind alle vergeben: die erste, die in diesem Haushalt frei ist, also die einer Person, die mit
 *    ihr in keinem Haushalt zusammen ist. Hefta sagt das nicht.
 * 4. Mehr als zwölf in einem Haushalt: reihum.
 *
 * Mit einem Haushalt ist das dieselbe Regel wie bisher: die erste freie Farbe im Haushalt.
 * Herausgenommene Personen zählen nicht als belegt.
 */
export function farbeImHaushalt(personId: Id | null, haushaltId: Id, alle: readonly Zug[]): number {
  const hier = alle.filter(
    (z) => z.haushaltId === haushaltId && aktiv(z) && z.personId !== personId,
  );
  const belegtHier = new Set(hier.map((z) => z.farbe));
  const mitgebracht = personId ? farbeDerPerson(personId, alle) : null;
  if (mitgebracht !== null && !belegtHier.has(mitgebracht)) return mitgebracht;
  const belegtUeberall = new Set(alle.filter(aktiv).map((z) => z.farbe));
  for (const f of VERGABE) if (!belegtUeberall.has(f) && !belegtHier.has(f)) return f;
  for (const f of VERGABE) if (!belegtHier.has(f)) return f;
  return VERGABE[hier.length % VERGABE.length]!;
}

/**
 * Gilt die Unterlage im Haushalt? Unterlagen gehören der Person und gelten überall, wo sie ist;
 * Typen mit `jeHaushalt` nur in ihrem Haushalt.
 *
 * `zugehoerigkeitIdsHier`: die Zugehörigkeiten dieses Haushalts.
 * Ohne `zugehoerigkeitId` gilt die Erklärung: Dann ist die Person nur in einem Haushalt.
 */
export function giltImHaushalt(
  dok: Pick<Dokument, 'typ' | 'zugehoerigkeitId'>,
  zugehoerigkeitIdsHier: ReadonlySet<Id>,
  jeHaushalt: (typ: string) => boolean,
): boolean {
  if (!jeHaushalt(dok.typ) || !dok.zugehoerigkeitId) return true;
  return zugehoerigkeitIdsHier.has(dok.zugehoerigkeitId);
}

/**
 * Kommt eine Person in einen weiteren Haushalt, bekommen ihre Erklärungen ohne Zugehörigkeit die
 * des ersten Haushalts. Sonst würden sie auf einmal in beiden gelten. Gibt die zu ändernden zurück.
 */
export function erklaerungenFestlegen<D extends Pick<Dokument, 'typ' | 'zugehoerigkeitId'>>(
  dokumente: readonly D[],
  ersteZugehoerigkeit: Id,
  jeHaushalt: (typ: string) => boolean,
): D[] {
  return dokumente
    .filter((d) => jeHaushalt(d.typ) && !d.zugehoerigkeitId)
    .map((d) => ({ ...d, zugehoerigkeitId: ersteZugehoerigkeit }));
}
