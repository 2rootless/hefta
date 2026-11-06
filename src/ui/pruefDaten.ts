import { personStand, type PersonStand } from '../domain/regelkatalog';
import type { HaushaltAnsicht } from '../storage/speicher';
import { haushaltsAngabenAus } from './selbstauskunftEingabe';

/** Stand aller Personen im Haushalt: Prüfhinweise schauen über die einzelne Unterlage hinaus. */
export function haushaltStaende(ansicht: HaushaltAnsicht | null): PersonStand[] {
  if (!ansicht) return [];
  return ansicht.mitglieder.map((m) =>
    personStand(
      m.person,
      m.zugehoerigkeit,
      ansicht.dokumente,
      ansicht.versionen,
      undefined,
      haushaltsAngabenAus(ansicht),
    ),
  );
}
