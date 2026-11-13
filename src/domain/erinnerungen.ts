// Erinnerungen von Hefta (Zeile 9, B21 „Erinnerungen“ in den Einstellungen): lokale Mitteilungen auf dem
// Gerät, ohne Server. Diese Rechnung sagt nur, wann woran erinnert wird; Wortlaut und Planen beim System
// macht die App. Zwei Schalter wie in B21: „Besichtigungen und Nachfassen“ und „Neuer Monat beim
// Gehaltsnachweis“; beide stehen von Anfang an auf an.

import { erwarteterMonat, faelligAb, monatPlus, type AbrechnungMeist } from './fristen';
import { KEINE_ANTWORT_NACH_TAGEN, stand } from './heftStand';
import type { Heft, Id } from './modell';

export type ErinnerungsArt = 'vorabend' | 'bald' | 'keineAntwort' | 'gehalt';

export interface Erinnerung {
  /** Fest je Anlass, damit ein neuer Plan denselben Eintrag ersetzt und nicht verdoppelt. */
  schluessel: string;
  art: ErinnerungsArt;
  am: Date;
  /** Wohin ein Tipp auf die Mitteilung führt (Pfad im Router). */
  ziel: string;
  heftId?: Id;
  personId?: Id;
  /** Bei „gehalt“: Monat der erwarteten Abrechnung, „JJJJ-MM“. */
  monat?: string;
}

export interface GehaltsPerson {
  personId: Id;
  meist: AbrechnungMeist;
}

/** iOS hält höchstens 64 geplante Mitteilungen je App; Hefta bleibt deutlich darunter. */
export const ERINNERUNGEN_HOECHSTENS = 40;

const VORABEND_STUNDE = 18;
const VORHER_MIN = 60;
const MORGENS_STUNDE = 10;

export function erinnerungenPlanen(o: {
  hefte: Heft[];
  gehalt: GehaltsPerson[];
  besichtigungenAn: boolean;
  gehaltAn: boolean;
  jetzt: Date;
}): Erinnerung[] {
  const liste: Erinnerung[] = [];
  const kommt = (d: Date) => d.getTime() > o.jetzt.getTime();

  if (o.besichtigungenAn)
    for (const h of o.hefte) {
      const s = stand(h.ereignisse, o.jetzt);
      const termin = h.ereignisse.termin;
      if (s === 'besichtigung' && termin) {
        const am = new Date(termin.am);
        const vorabend = new Date(
          am.getFullYear(),
          am.getMonth(),
          am.getDate() - 1,
          VORABEND_STUNDE,
        );
        const bald = new Date(am.getTime() - VORHER_MIN * 60_000);
        if (kommt(vorabend))
          liste.push({
            schluessel: `vorabend:${h.id}:${termin.am}`,
            art: 'vorabend',
            am: vorabend,
            ziel: `/heft/${h.id}`,
            heftId: h.id,
          });
        if (kommt(bald))
          liste.push({
            schluessel: `bald:${h.id}:${termin.am}`,
            art: 'bald',
            am: bald,
            ziel: `/heft/${h.id}`,
            heftId: h.id,
          });
      }
      // „Nach drei Wochen ohne Antwort sagt Hefta leise Bescheid“ (B21, E90.2): einmal, morgens.
      const b = h.ereignisse.beworben;
      if (s === 'beworben' && b && !h.ereignisse.nachgefasstAm) {
        const von = new Date(b.am);
        const tag = new Date(
          von.getFullYear(),
          von.getMonth(),
          von.getDate() + KEINE_ANTWORT_NACH_TAGEN,
          MORGENS_STUNDE,
        );
        if (kommt(tag))
          liste.push({
            schluessel: `keineAntwort:${h.id}:${b.am}`,
            art: 'keineAntwort',
            am: tag,
            ziel: `/heft/${h.id}`,
            heftId: h.id,
          });
      }
    }

  if (o.gehaltAn)
    for (const p of o.gehalt) {
      // Die nächste Abrechnung nach der, die heute schon da sein kann.
      const monat = monatPlus(erwarteterMonat(o.jetzt, p.meist), 1);
      const ab = faelligAb(monat, p.meist);
      const am = new Date(ab.getFullYear(), ab.getMonth(), ab.getDate(), MORGENS_STUNDE);
      if (kommt(am))
        liste.push({
          schluessel: `gehalt:${p.personId}:${monat}`,
          art: 'gehalt',
          am,
          ziel: `/unterlage/${p.personId}/gehaltsnachweis`,
          personId: p.personId,
          monat,
        });
    }

  return liste.sort((a, b) => a.am.getTime() - b.am.getTime()).slice(0, ERINNERUNGEN_HOECHSTENS);
}

/** Feste Zahl aus dem Schlüssel (Android braucht Zahlen, iOS nimmt sie als Kennung). */
export function erinnerungsNummer(schluessel: string): number {
  let h = 2166136261;
  for (let i = 0; i < schluessel.length; i++) {
    h ^= schluessel.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2_000_000_000;
}
