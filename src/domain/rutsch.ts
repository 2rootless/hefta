import type { Id } from './modell';
import type { PersonStand, UnterlagenStand } from './regelkatalog';

// „Unterlagen in einem Rutsch“ (design/einrichtung-rutsch-navigation.md, Abschnitt 2):
// Person für Person in Haushaltsreihenfolge, je Person erst „fehlt“, dann „läuft bald ab“,
// jeweils in Regelkatalog-Reihenfolge. Die Liste wird beim Start festgelegt.

export interface RutschPosten {
  personId: Id;
  typ: string;
}

export type RutschErgebnis = 'hochgeladen' | 'uebersprungen' | 'nochNicht';

export interface RutschStand {
  liste: RutschPosten[];
  /** Index des aktuellen Postens; gleich liste.length, wenn alles durch ist. */
  index: number;
  ergebnisse: Record<string, RutschErgebnis>;
}

export function postenSchluessel(p: RutschPosten): string {
  return `${p.personId}:${p.typ}`;
}

/** Selbstauskunft (in der App erstellt) erst mitnehmen, wenn das Formular gebaut ist (M4). */
export function rutschListe(staende: PersonStand[], mitFormularen: boolean): RutschPosten[] {
  const reihenfolge = [
    ...staende.filter((s) => s.rolle === 'hauptmieter'),
    ...staende.filter((s) => s.rolle === 'mitmieter'),
    ...staende.filter((s) => s.rolle === 'buerge'),
  ];
  return reihenfolge.flatMap((s) => {
    const offen = (status: UnterlagenStand['status']) =>
      s.unterlagen.filter((u) => u.status === status && (mitFormularen || !u.typ.inAppErstellt));
    return [...offen('fehlt'), ...offen('bald')].map((u) => ({
      personId: s.person.id,
      typ: u.typ.id,
    }));
  });
}

export function neuerRutsch(staende: PersonStand[], mitFormularen: boolean): RutschStand {
  return { liste: rutschListe(staende, mitFormularen), index: 0, ergebnisse: {} };
}

/** Nach einem Ergebnis zum nächsten Posten. */
export function weiter(stand: RutschStand, ergebnis: RutschErgebnis): RutschStand {
  const posten = stand.liste[stand.index];
  if (!posten) return stand;
  return {
    ...stand,
    index: stand.index + 1,
    ergebnisse: { ...stand.ergebnisse, [postenSchluessel(posten)]: ergebnis },
  };
}

export function fertig(stand: RutschStand): boolean {
  return stand.index >= stand.liste.length;
}

export function zaehlen(stand: RutschStand) {
  const werte = Object.values(stand.ergebnisse);
  return {
    hochgeladen: werte.filter((e) => e === 'hochgeladen').length,
    uebersprungen: werte.filter((e) => e !== 'hochgeladen').length,
  };
}

/**
 * Was seit dem Start der Runde fällig geworden ist und nicht in ihrer Liste steht (Z4).
 * Die Liste selbst bleibt beim Start festgelegt.
 */
export function neuDazu(stand: RutschStand, staende: PersonStand[]): RutschPosten[] {
  const drin = new Set(stand.liste.map(postenSchluessel));
  return rutschListe(staende, true).filter((p) => !drin.has(postenSchluessel(p)));
}
