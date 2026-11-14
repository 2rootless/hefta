import type { HeftEreignisse } from './modell';
import { KEINE_ANTWORT_NACH_TAGEN, standFragen } from './heftStand';

// Die 13 Lagen des Stands im Heft (B28b, DP21 Abschnitt 1): Ort auf dem Weg, Titel, Frage und Antworten.
// Reine Rechnung aus den Ereignissen, ohne Oberfläche. Den Stand ändert im Heft nur noch die Frage im
// Stand; „Stand selbst setzen“ und die Seiten „Stand setzen“ und „Ergebnis“ entfallen.

export type LageArt =
  | 'gemerkt'
  | 'gemerktOhne'
  | 'vorschlag'
  | 'beworben'
  | 'keineAntwort'
  | 'nachgefragt'
  | 'termin'
  | 'besichtigt'
  | 'zusage'
  | 'absage'
  | 'nichtMehr'
  | 'ohneAntwort';

/** Ort auf dem Weg: Gemerkt, Beworben, Besichtigung, Ergebnis. */
export type Ort = 0 | 1 | 2 | 3;

export interface Lage {
  art: LageArt;
  ort: Ort;
  /** Beworben heute (Titel „Heute beworben“) statt „Beworben am …“. */
  heute?: boolean;
  /** Tage seit der Bewerbung, für „Seit 5 Tagen …“. */
  tage?: number;
  /** Bei Ergebnissen: Löschbitte geschickt. */
  bitte?: boolean;
  /** Das Heft liegt bei den abgelegten (Ergebnis). */
  abgelegt?: boolean;
}

const TAG_MS = 24 * 60 * 60 * 1000;

/** Kalendertage zwischen zwei Zeitpunkten, in der Zeitzone des Geräts. */
export function tageZwischen(von: string, bis: Date): number {
  const a = new Date(von);
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ende = Date.UTC(bis.getFullYear(), bis.getMonth(), bis.getDate());
  return Math.round((ende - start) / TAG_MS);
}

/** Wie lange ein Termin dauert, bis „Besichtigt“ gilt (DP21: „ab dem Ende des Termins“). */
export const TERMIN_DAUER_MS = 60 * 60 * 1000;

/** Ist der Termin vorbei? Ab seinem Ende fragt das Heft nach dem Ausgang, vorher nur „Kommt etwas dazwischen?“. */
export function terminVorbeiAb(e: HeftEreignisse, jetzt: Date): boolean {
  return !!e.termin && jetzt.getTime() >= new Date(e.termin.am).getTime() + TERMIN_DAUER_MS;
}

export function lage(e: HeftEreignisse, jetzt: Date, mitHaushalt: boolean): Lage {
  const bitte = !!e.loeschbitteAm;
  if (e.ergebnis?.art === 'zusage') return { art: 'zusage', ort: 3 };
  if (e.ergebnis?.art === 'absage') return { art: 'absage', ort: 3, bitte, abgelegt: true };
  if (e.ergebnis?.art === 'nicht_mehr') return { art: 'nichtMehr', ort: 3, bitte, abgelegt: true };
  // Abgelegt ohne Ergebnis: „Ablegen“ aus „Keine Antwort“ (und ältere Hefte, die so abgelegt wurden).
  if (e.abgelegtAm) return { art: 'ohneAntwort', ort: 3, bitte, abgelegt: true };
  if (e.termin) return { art: terminVorbeiAb(e, jetzt) ? 'besichtigt' : 'termin', ort: 2 };
  if (e.beworben?.sicher) {
    if (e.nachgefasstAm) return { art: 'nachgefragt', ort: 1 };
    const tage = tageZwischen(e.beworben.am, jetzt);
    if (tage >= KEINE_ANTWORT_NACH_TAGEN) return { art: 'keineAntwort', ort: 1, tage };
    return { art: 'beworben', ort: 1, heute: tage <= 0, tage };
  }
  if (standFragen(e)) return { art: 'vorschlag', ort: 0 };
  return { art: mitHaushalt ? 'gemerkt' : 'gemerktOhne', ort: 0 };
}

// ---------- Antworten im Stand: was sie an den Ereignissen ändern ----------

const iso = (d: Date) => d.toISOString();

/** „Wir haben uns schon beworben“: Die Bewerbung zählt sicher, ab heute. */
export function schonBeworben(e: HeftEreignisse, jetzt: Date): HeftEreignisse {
  return { ...e, beworben: { am: iso(jetzt), weg: 'sonst', sicher: true }, gefragtAm: iso(jetzt) };
}

/** Vorschlag „Ja, beworben“: Die Bewerbung von damals zählt jetzt sicher. */
export function vorschlagJa(e: HeftEreignisse, jetzt: Date): HeftEreignisse {
  if (!e.beworben) return schonBeworben(e, jetzt);
  return { ...e, beworben: { ...e.beworben, sicher: true }, gefragtAm: iso(jetzt) };
}

/** Vorschlag „Noch nicht“: Der Stand bleibt „Gemerkt“; Hefta fragt nicht noch einmal. */
export function vorschlagNein(e: HeftEreignisse, jetzt: Date): HeftEreignisse {
  return { ...e, gefragtAm: iso(jetzt) };
}

/** „‹ Doch noch nicht beworben“. Die Datenspur bleibt; was hinausging, ging hinaus. */
export function dochNichtBeworben(e: HeftEreignisse): HeftEreignisse {
  return { ...e, beworben: null, nachgefasstAm: null };
}

export function ergebnis(
  e: HeftEreignisse,
  art: 'zusage' | 'absage' | 'nicht_mehr',
  jetzt: Date,
): HeftEreignisse {
  // Eine Zusage legt das Heft nicht ab: Es bleibt, bis der Vertrag unterschrieben ist.
  return {
    ...e,
    ergebnis: { art, am: iso(jetzt) },
    abgelegtAm: art === 'zusage' ? null : iso(jetzt),
  };
}

/** „Ablegen“ aus „Keine Antwort“: eigenes Ergebnis „Ohne Antwort abgelegt“. */
export function ohneAntwortAblegen(e: HeftEreignisse, jetzt: Date): HeftEreignisse {
  return { ...e, ergebnis: null, abgelegtAm: iso(jetzt) };
}

/** „‹ Doch noch offen“: Ergebnis und Ablage weg, die Lage rechnet sich aus dem Rest. */
export function dochNochOffen(e: HeftEreignisse): HeftEreignisse {
  return { ...e, ergebnis: null, abgelegtAm: null };
}

/** „‹ Termin entfernen“: zurück auf „Beworben“ (mit Bewerbung) oder „Gemerkt“. */
export function terminWeg(e: HeftEreignisse): HeftEreignisse {
  return { ...e, termin: null };
}

/**
 * Geht der Wechsel vorwärts (Neues von rechts)? Weiter auf dem Weg ist vorwärts; am selben Ort ist
 * vorwärts, was nicht aus einem Ergebnis zurückkommt.
 */
export function vorwaerts(vorher: Lage, nachher: Lage): boolean {
  if (nachher.ort !== vorher.ort) return nachher.ort > vorher.ort;
  return !vorher.abgelegt || !!nachher.abgelegt;
}
