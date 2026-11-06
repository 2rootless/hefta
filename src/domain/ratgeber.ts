import { APP_NAME } from '../app/name';
import daten from '../../data/ratgeber.de.json';

// Die Tabelle des Ratgebers (data/ratgeber.de.json). Sie trägt die beiden Seiten des Ratgebers und die drei
// Schritte der Vermieter-Seite: Dieselbe Aussage steht so nur einmal da und trägt überall dieselbe Fundstelle.

export const RATGEBER = daten;
export type Stimme = keyof typeof daten.seiten;

const quelle = (id: string) => daten.quellen.find((q) => q.id === id)!;

/** Fundstelle als Text und Ziel: „A.1“ meint Abschnitt A, Nummer 1 der Orientierungshilfe. */
export function fundstelle(f: string): { text: string; url: string } {
  const anlage = f.startsWith('Musterbogen');
  return {
    text: anlage || f.startsWith('Einleitung') ? f : `Abschnitt\u00a0${f}`,
    url: quelle(anlage ? 'anhang' : 'oh').url,
  };
}

export const mitName = (text: string) => text.replaceAll('{app}', APP_NAME);
