// Erinnerungen von Hefta (Zeile 9, B21 „Erinnerungen“ in den Einstellungen): lokale Mitteilungen auf dem
// Gerät, ohne Server. Diese Rechnung sagt nur, wann woran erinnert wird; Wortlaut und Planen beim System
// macht die App. Zwei Schalter wie in B21: „Besichtigungen und Nachfassen“ und „Neuer Monat beim
// Gehaltsnachweis“; beide stehen von Anfang an auf an.

import { erwarteterMonat, faelligAb, monatPlus, type AbrechnungMeist } from './fristen';
import { KEINE_ANTWORT_NACH_TAGEN, stand } from './heftStand';
import { WBS_ERINNERUNG_TAGE } from './haushaltUnterlagen';
import type { Heft, Id } from './modell';

export type ErinnerungsArt = 'vorabend' | 'bald' | 'keineAntwort' | 'gehalt' | 'wbs' | 'zuAlt';

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
  /** Bei „wbs“: „Gültig bis“ des Scheins, „JJJJ-MM-TT“. */
  gueltigBis?: string;
  /** Bei „zuAlt“ (W48): die Unterlagen dieser Person, die am selben Tag bald zu alt werden, die früheste zuerst. */
  unterlagen?: { typId: string; ab: Date; warnungTage: number }[];
}

/** W48: eine Unterlage mit Datum, die zu alt werden kann (Fristen aus dem Regelkatalog). */
export interface ZuAltUnterlage {
  personId: Id;
  typId: string;
  /** Ausstellungsdatum der neuesten Fassung, „JJJJ-MM-TT“. */
  datum: string;
  /** Ab hier zu alt. */
  warnungTage: number;
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

/**
 * W48: So viele Tage vor dem Tag, an dem eine Unterlage zu alt ist, kommt die Mitteilung. Der Regelkatalog hat
 * für Unterlagen mit Datum keinen eigenen Tag dafür: Beim Bonitätsnachweis ist „hinweisTage“ nur eine Information
 * zum Prüfcode, bei den Mietzahlungen fehlt er. Zwei Wochen lassen Zeit, eine neue Fassung zu holen (Frage an Design).
 */
export const ZU_ALT_VORLAUF_TAGE = 14;

export function erinnerungenPlanen(o: {
  hefte: Heft[];
  gehalt: GehaltsPerson[];
  besichtigungenAn: boolean;
  gehaltAn: boolean;
  jetzt: Date;
  /** DP45 G1: „Gültig bis“ des Wohnberechtigungsscheins, falls eingetragen. */
  wbsGueltigBis?: string | null;
  /** W48: dritter Schalter „Unterlagen, bevor sie zu alt werden“. */
  zuAltAn?: boolean;
  zuAlt?: ZuAltUnterlage[];
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

  // DP45 G1 (PC56): einmal, 30 Tage vor „Gültig bis“, morgens. Unter dem Schalter „Neue Monate und Ablauf
  // von Unterlagen“ (PC62).
  const bis = !o.gehaltAn ? null : o.wbsGueltigBis?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (bis) {
    const am = new Date(
      Number(bis[1]),
      Number(bis[2]) - 1,
      Number(bis[3]) - WBS_ERINNERUNG_TAGE,
      MORGENS_STUNDE,
    );
    if (kommt(am))
      liste.push({
        schluessel: `wbs:${o.wbsGueltigBis}`,
        art: 'wbs',
        am,
        ziel: '/haushalt-unterlage/wbs',
        gueltigBis: o.wbsGueltigBis!,
      });
  }

  // W48 (DP102 E299, Design zu W48): morgens, zwei Wochen bevor die Unterlage zu alt ist; dieselbe
  // Grenze wie `bewerten()`. Höchstens eine Mitteilung je Person und Tag; die Gehaltsabrechnung hat ihre eigene
  // Erinnerung an den neuen Monat und kommt hier nicht vor (sie ist eine Serie und steht nicht in `zuAlt`).
  if (o.zuAltAn !== false) {
    const gruppen = new Map<string, Erinnerung>();
    for (const u of o.zuAlt ?? []) {
      const m = u.datum.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) continue;
      const [j, mo, ta] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
      const am = new Date(j, mo, ta + u.warnungTage + 1 - ZU_ALT_VORLAUF_TAGE, MORGENS_STUNDE);
      const ab = new Date(j, mo, ta + u.warnungTage + 1);
      if (!kommt(am)) continue;
      const tag = `${am.getFullYear()}-${am.getMonth() + 1}-${am.getDate()}`;
      const schluessel = `zuAlt:${u.personId}:${tag}`;
      const e = gruppen.get(schluessel) ?? {
        schluessel,
        art: 'zuAlt' as const,
        am,
        ziel: '',
        personId: u.personId,
        unterlagen: [],
      };
      e.unterlagen!.push({ typId: u.typId, ab, warnungTage: u.warnungTage });
      gruppen.set(schluessel, e);
    }
    for (const e of gruppen.values()) {
      e.unterlagen!.sort((a, b) => a.ab.getTime() - b.ab.getTime());
      // Eine Unterlage: der Tipp öffnet sie. Mehrere: die Personenseite, dort stehen alle offenen zusammen.
      e.ziel =
        e.unterlagen!.length === 1
          ? `/unterlage/${e.personId}/${e.unterlagen![0]!.typId}`
          : `/person/${e.personId}`;
      liste.push(e);
    }
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
