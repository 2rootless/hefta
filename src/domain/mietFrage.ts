// PC65, Abschnitt 3: Die Frage nach Mietrückständen ist dran, sobald ein Vermieter zugesagt hat. Bis dahin
// darf sie offen bleiben („Nach der Zusage beantworten“). Danach zeigt Hefta sie überall dort als offen, wo
// offene Dinge stehen: im Heft, auf der Personenseite und im Reiter „Mappe“, nie in Rot (W5).
import type { Heft, Person } from './modell';
import { zusageOffen } from './selbstauskunft';

/** Hat ein Vermieter zugesagt? */
export function zusageDa(hefte: readonly Pick<Heft, 'ereignisse'>[]): boolean {
  return hefte.some((h) => h.ereignisse.ergebnis?.art === 'zusage');
}

/** Für eine Person im Mietvertrag: Nach einer Zusage ist ihre Antwort noch nicht da (auch „später“ gewählt). */
export function mietFrageOffen(
  person: Pick<Person, 'selbstauskunft'>,
  rolle: string,
  hefte: readonly Pick<Heft, 'ereignisse'>[],
): boolean {
  // PC207, 2: offen, solange eine der drei Fragen C.4 bis C.6 keine Antwort hat.
  return rolle !== 'buerge' && zusageDa(hefte) && zusageOffen(person);
}
