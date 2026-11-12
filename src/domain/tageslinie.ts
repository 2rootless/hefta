import { KEINE_ANTWORT_NACH_TAGEN, stand, terminVorbei } from './heftStand';
import type { HeftEreignisse } from './modell';

// Tageslinie (B18 Abschnitt 1, `x()` und `tl()` in build_b18.py): eine Achse für jede Zeile der
// Übersicht. Heute steht in allen Zeilen an derselben Stelle; links vier Wochen zurück, rechts zwei
// Wochen voraus, nahe Tage breiter (Wurzelmaßstab). Die Linie ergänzt das Wort, sie ersetzt es nicht:
// Für Vorlesehilfen ist sie ausgeblendet, das Wort steht immer daneben. Reine Rechnung.

/** Lage von „heute“ in Prozent der Breite. */
export const HEUTE_LAGE = 56;
const ZURUECK_TAGE = 28;
const VORAUS_TAGE = 14;

/** Lage eines Tags in Prozent: `tage` < 0 ist vergangen, > 0 kommt. Was weiter weg ist, steht am Rand. */
export function lage(tage: number): number {
  if (tage <= 0)
    return HEUTE_LAGE - HEUTE_LAGE * Math.sqrt(Math.min(-tage, ZURUECK_TAGE) / ZURUECK_TAGE);
  return HEUTE_LAGE + (100 - HEUTE_LAGE) * Math.sqrt(Math.min(tage, VORAUS_TAGE) / VORAUS_TAGE);
}

/** Art der Zeile, und damit ihre Marke (B18, Tabelle im Abschnitt 1). */
export type ZeilenArt = 'termin' | 'tun' | 'wartet' | 'gemerkt' | 'keine' | 'abgelegt';

export function zeilenArt(e: HeftEreignisse, jetzt: Date): ZeilenArt {
  const s = stand(e, jetzt);
  if (s === 'besichtigung') return terminVorbei(e, jetzt) ? 'tun' : 'termin';
  if (s === 'beworben') return 'wartet';
  if (s === 'keine_antwort') return 'keine';
  return s;
}

/** Ganze Kalendertage von `jetzt` bis `tag` (positiv: kommt). */
export function tageBis(tag: string | Date, jetzt: Date): number {
  const a = new Date(tag);
  const start = Date.UTC(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
  const ende = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round((ende - start) / 86_400_000);
}

/** Zeit in Worten als Schlüssel und Werte für i18n (`zeit.…`), wie `bis18`, `seit18`, `vor18`. */
export interface ZeitWort {
  schluessel: string;
  werte?: Record<string, number>;
}

/** Kommt: heute, morgen, übermorgen, in 3 bis 6 Tagen, in 1 Woche, in 2 Wochen. */
export function bisWort(tage: number): ZeitWort {
  if (tage <= 0) return { schluessel: 'zeit.heute' };
  if (tage === 1) return { schluessel: 'zeit.morgen' };
  if (tage === 2) return { schluessel: 'zeit.uebermorgen' };
  if (tage < 7) return { schluessel: 'zeit.inTagen', werte: { anzahl: tage } };
  if (tage < 14) return { schluessel: 'zeit.inEinerWoche' };
  return { schluessel: 'zeit.inWochen', werte: { anzahl: Math.floor(tage / 7) } };
}

/** Läuft seit: seit heute, seit gestern, seit 2 bis 13 Tagen, seit 2 Wochen und mehr. */
export function seitWort(tage: number): ZeitWort {
  if (tage <= 0) return { schluessel: 'zeit.seitHeute' };
  if (tage === 1) return { schluessel: 'zeit.seitGestern' };
  if (tage < 14) return { schluessel: 'zeit.seitTagen', werte: { anzahl: tage } };
  return { schluessel: 'zeit.seitWochen', werte: { anzahl: Math.floor(tage / 7) } };
}

/** War (Besichtigung): gestern, vor 2 bis 13 Tagen, vor 2 Wochen und mehr. */
export function vorWort(tage: number): ZeitWort {
  if (tage <= 1) return { schluessel: 'zeit.gestern' };
  if (tage < 14) return { schluessel: 'zeit.vorTagen', werte: { anzahl: tage } };
  return { schluessel: 'zeit.vorWochen', werte: { anzahl: Math.floor(tage / 7) } };
}

/** Was die Linie einer Zeile zeichnet, in Prozent der Breite. */
export type Marke =
  | { art: 'termin'; punkt: number }
  | { art: 'tun'; raute: number }
  | { art: 'wartet' | 'keine'; von: number; dreiWochen: number }
  | { art: 'gemerkt'; ring: number }
  | { art: 'abgelegt' };

/**
 * Marke und Wort einer Zeile. `n` ist wie in build_b18.py immer der Abstand zu heute in Tagen: bis zum
 * Termin, seit dem Termin, seit der Bewerbung oder seit dem Merken.
 */
export function zeile(
  e: HeftEreignisse,
  gemerktAm: string,
  jetzt: Date,
): { art: ZeilenArt; wort: ZeitWort; marke: Marke } {
  const art = zeilenArt(e, jetzt);
  const dreiWochen = lage(-KEINE_ANTWORT_NACH_TAGEN);
  switch (art) {
    case 'termin': {
      const n = tageBis(e.termin!.am, jetzt);
      return { art, wort: bisWort(n), marke: { art, punkt: lage(n) } };
    }
    case 'tun': {
      const n = -tageBis(e.termin!.am, jetzt);
      return { art, wort: vorWort(n), marke: { art, raute: lage(-n) } };
    }
    case 'wartet':
    case 'keine': {
      const n = -tageBis(e.beworben!.am, jetzt);
      return { art, wort: seitWort(n), marke: { art, von: lage(-n), dreiWochen } };
    }
    case 'gemerkt': {
      const n = -tageBis(gemerktAm, jetzt);
      return { art, wort: seitWort(n), marke: { art, ring: lage(-n) } };
    }
    default:
      return { art, wort: seitWort(-tageBis(gemerktAm, jetzt)), marke: { art: 'abgelegt' } };
  }
}
