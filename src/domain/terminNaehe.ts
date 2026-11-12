// Wie nah ein Termin ist (B25, E92, `naehe()`, `satz()` und `band()` in build_b25.py): Art und Wort für
// den Reiter der Terminkarte, der Satz für Vorlesehilfen und Zeilen außerhalb der Karte, und das Band aus
// immer zwei Wochenzeilen (Montag bis Sonntag), damit die Karte nie höher wird. Die Woche beginnt am
// Montag; „morgen“ geht vor „nächste Woche“. Reine Rechnung; Wortlaute kommen aus i18n.
import { tageBis } from './tageslinie';

/** Bis zu so vielen Wochen heißt es „in n Wochen“, danach der Monat (B25). */
export const WOCHEN_BIS = 4;

/** Art der Karte (Farbe): heute, morgen, nah oder weiter (Terminfarbe), vorbei. */
export type NaeheArt = 'heute' | 'morgen' | 'woche' | 'spaeter' | 'vorbei';

export type Naehe =
  | { art: 'vorbei'; wort: 'vorbei'; heute: boolean }
  | { art: 'heute'; wort: 'heute' }
  | { art: 'morgen'; wort: 'morgen' }
  | { art: 'woche'; wort: 'dieseWoche' | 'naechsteWoche' }
  | { art: 'spaeter'; wort: 'inWochen'; wochen: number }
  | { art: 'spaeter'; wort: 'monat'; monat: number; jahr: number | null };

export interface BandTag {
  tag: number;
  heute: boolean;
  termin: boolean;
  vorbei: boolean;
  /** Samstag oder Sonntag. */
  wochenende: boolean;
}

export interface Band {
  wochen: [BandTag[], BandTag[]];
  /** Die zwei Wochen grenzen nicht aneinander: gestrichelte Lücke dazwischen. */
  luecke: boolean;
}

const TAG_MS = 24 * 60 * 60 * 1000;

function tagBeginn(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function montag(d: Date): Date {
  const m = tagBeginn(d);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

/** Ganze Wochen zwischen der Woche von heute und der Woche des Termins. */
export function wochenAbstand(am: Date, jetzt: Date): number {
  return Math.round((montag(am).getTime() - montag(jetzt).getTime()) / (7 * TAG_MS));
}

export function terminNaehe(amText: string, jetzt: Date): Naehe {
  const am = new Date(amText);
  const tage = tageBis(am, jetzt);
  if (am < jetzt) return { art: 'vorbei', wort: 'vorbei', heute: tage === 0 };
  if (tage === 0) return { art: 'heute', wort: 'heute' };
  if (tage === 1) return { art: 'morgen', wort: 'morgen' };
  const w = wochenAbstand(am, jetzt);
  if (w === 0) return { art: 'woche', wort: 'dieseWoche' };
  if (w === 1) return { art: 'woche', wort: 'naechsteWoche' };
  if (w <= WOCHEN_BIS) return { art: 'spaeter', wort: 'inWochen', wochen: w };
  // Mehr als elf Monate entfernt, wie build_b25_n1.py mehr als 334 Tage: auch das Jahr (Planung 12w).
  return {
    art: 'spaeter',
    wort: 'monat',
    monat: am.getMonth(),
    jahr: tage > 334 ? am.getFullYear() : null,
  };
}

/**
 * Immer zwei Zeilen Mo–So. Nah: diese und nächste Woche. Weiter weg oder vorbei: die Woche von heute und
 * die des Termins, in zeitlicher Reihenfolge, mit Lücke, wenn sie nicht aneinander grenzen.
 */
export function terminBand(amText: string, jetzt: Date): Band {
  const am = tagBeginn(new Date(amText));
  const heute = tagBeginn(jetzt);
  const mh = montag(heute);
  const mt = montag(am);
  const plus = (d: Date, tage: number) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + tage);
  const abstand = Math.round((mt.getTime() - mh.getTime()) / (7 * TAG_MS));
  let starts: [Date, Date];
  let luecke = false;
  if (abstand === 0 || abstand === 1) starts = [mh, plus(mh, 7)];
  else if (abstand > 1) [starts, luecke] = [[mh, mt], true];
  else if (abstand === -1) starts = [mt, mh];
  else [starts, luecke] = [[mt, mh], true];
  const gleich = (a: Date, b: Date) => a.getTime() === b.getTime();
  const woche = (m: Date) =>
    Array.from({ length: 7 }, (_, i) => {
      const d = plus(m, i);
      return {
        tag: d.getDate(),
        heute: gleich(d, heute),
        termin: gleich(d, am),
        vorbei: d < heute,
        wochenende: i >= 5,
      };
    });
  return { wochen: [woche(starts[0]), woche(starts[1])], luecke };
}
