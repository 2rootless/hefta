// PC65, Abschnitt 3: Die Frage nach Mietrückständen ist dran, sobald ein Vermieter zugesagt hat. Bis dahin
// darf sie offen bleiben („Nach der Zusage beantworten“). Danach zeigt Hefta sie überall dort als offen, wo
// offene Dinge stehen: im Heft, auf der Personenseite und im Reiter „Mappe“, nie in Rot (W5).
import type { Heft } from './modell';

/** Hat ein Vermieter zugesagt? */
export function zusageDa(hefte: readonly Pick<Heft, 'ereignisse'>[]): boolean {
  return hefte.some((h) => h.ereignisse.ergebnis?.art === 'zusage');
}

/** Für eine Person im Mietvertrag: Nach einer Zusage ist ihre Antwort noch nicht da (auch „später“ gewählt). */
export function mietFrageOffen(
  person: { selbstauskunft?: { mietrueckstaende: 'ja' | 'nein' | null } | null },
  rolle: string,
  hefte: readonly Pick<Heft, 'ereignisse'>[],
): boolean {
  return (
    rolle !== 'buerge' &&
    zusageDa(hefte) &&
    (person.selbstauskunft?.mietrueckstaende ?? null) === null
  );
}
