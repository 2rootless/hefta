// Passt eine Lesehilfe zu ihrer Mappe? (Abschnitt 11 der Beschreibung.) Eine Lesehilfe ist eine Angabe der
// Bewerber und kein Echtheitsnachweis: Jeder kann sie ändern. Ein Leser zeigt sie darum nur, wenn alles passt,
// und sonst gar nicht, auch nicht zum Teil.
import { telefonE164 } from './telefon.js';
import type { Lesehilfe, Person, Unterlage } from './typen.js';

/** Kennung einer offenen Liste (U1): Neue Kennungen kommen ohne neue Fassung dazu. */
const KENNUNG_LISTE = /^[a-z][a-z0-9_]*$/;
const listenKennung = (v: unknown): v is string => typeof v === 'string' && KENNUNG_LISTE.test(v);
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const ZEITPUNKT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/;
const MONAT = /^\d{4}-\d{2}$/;
const KENNUNG = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LAND = /^[A-Z]{2}$/;
const MAX_TEXT = 200;
const MAX_BITTE = 500;
const MAX_KONTAKT = 254;

const text = (v: unknown, max = MAX_TEXT): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const ganz = (v: unknown, von: number, bis: number): v is number =>
  Number.isInteger(v) && (v as number) >= von && (v as number) <= bis;

/** Text vergleichbar machen: Das PDF trennt Zeilen und Wörter anders als die Lesehilfe. */
export function vergleichbar(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[\s\u00a0\u00ad\u2060]/g, '')
    .toLowerCase();
}

export interface Mappe {
  /** Zahl der Seiten der PDF. */
  seiten: number;
  /** Der Text von Seite 1, so wie ein PDF-Leser ihn liefert. */
  textSeite1: string;
}

export function passt(l: Lesehilfe, mappe: Mappe): boolean {
  const ab4 = l.hefta >= 4;
  const personen = l.haushalt?.personen;
  const mitziehende = l.haushalt?.mitziehende;
  if (!Array.isArray(personen) || !personen.length || !Array.isArray(mitziehende)) return false;
  if (!text(l.erstellt) || !(ab4 ? ZEITPUNKT : TAG).test(l.erstellt)) return false;
  const kennung = l.bewerbung?.kennung;
  if (typeof kennung !== 'string' || !KENNUNG.test(kennung)) return false;
  // Punkt 1: die Seitenzahl.
  if (
    ab4
      ? l.seitenzahl !== mappe.seiten
      : l.seitenzahl !== undefined && l.seitenzahl !== mappe.seiten
  )
    return false;
  if (ab4 && !ganz(l.fassung, 1, 9999)) return false;
  if (l.modus !== undefined && !listenKennung(l.modus)) return false;
  // `schritt` nur bei `datensparsam` (Regel aus Abschnitt 11, nicht im Schema).
  if (l.schritt !== undefined && (!listenKennung(l.schritt) || l.modus !== 'datensparsam'))
    return false;
  if (l.loeschwunsch !== undefined && !text(l.loeschwunsch, MAX_BITTE)) return false;
  if (
    l.bewerbung.einzug !== undefined &&
    !(text(l.bewerbung.einzug) && TAG.test(l.bewerbung.einzug))
  )
    return false;
  if (l.bewerbung.inserat !== undefined && !text(l.bewerbung.inserat?.portal)) return false;
  if (!personen.some((p) => p && p.rolle !== 'buerge')) return false;

  // Punkte 3 und 4: Namen, Straße und Kontaktdaten stehen auf Seite 1.
  const seite = vergleichbar(mappe.textSeite1);
  const steht = (s: string) =>
    s
      .trim()
      .split(/\s+/)
      .every((w) => seite.includes(vergleichbar(w)));
  // Punkt 6: höchstens eine Kontaktperson; höchstens ein Hauptmieter, und der steht zuerst; Bürgen nach allen
  // im Mietvertrag. Genau einen Hauptmieter garantiert Hefta nicht (CP65).
  if (personen.filter((p) => p?.kontakt).length > 1) return false;
  const haupt = personen.filter((p) => p?.rolle === 'hauptmieter').length;
  if (haupt > 1 || (haupt === 1 && personen[0]?.rolle !== 'hauptmieter')) return false;
  const ersterBuerge = personen.findIndex((p) => p?.rolle === 'buerge');
  if (ersterBuerge >= 0 && personen.slice(ersterBuerge).some((p) => p?.rolle !== 'buerge'))
    return false;
  const bereiche: [number, number][] = [];
  for (const p of personen) {
    if (!personPasst(p, ab4, steht, seite)) return false;
    for (const u of p.unterlagen) {
      if (!unterlagePasst(u, mappe.seiten)) return false;
      bereiche.push([u.seiten_mappe.von, u.seiten_mappe.bis]);
    }
  }
  // Punkt 2: Die Bereiche überschneiden sich nicht.
  bereiche.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < bereiche.length; i++)
    if (bereiche[i]![0] <= bereiche[i - 1]![1]) return false;

  for (const m of mitziehende) {
    if (!m || !text(m.text) || !ganz(m.anzahl, 1, 50)) return false;
    if (!listenKennung(m.art)) return false;
  }
  const w = l.bewerbung?.wohnung;
  if (w) {
    if (
      !text(w.strasse) ||
      typeof w.rest !== 'string' ||
      w.rest.length > MAX_TEXT ||
      !steht(w.strasse)
    )
      return false;
    if (w.teile?.land !== undefined && !LAND.test(w.teile.land)) return false;
  }
  return true;
}

function personPasst(
  p: Person,
  ab4: boolean,
  steht: (s: string) => boolean,
  seite: string,
): boolean {
  if (!p || !text(p.name) || !listenKennung(p.rolle) || !steht(p.name)) return false;
  if (!Array.isArray(p.unterlagen)) return false;
  // Punkt 5 (U2): `name` ist `vorname`, ein Leerzeichen, `nachname`; ist `nachname` leer, gleich `vorname`.
  // Verglichen wird nach NFC (U10).
  if (ab4) {
    if (!text(p.vorname) || typeof p.nachname !== 'string') return false;
    const soll = p.nachname === '' ? p.vorname : `${p.vorname} ${p.nachname}`;
    if (p.name.normalize('NFC') !== soll.normalize('NFC')) return false;
  }
  if (!p.kontakt && (p.telefon !== undefined || p.email !== undefined)) return false;
  for (const wert of [p.telefon, p.email])
    if (wert !== undefined && (!text(wert, MAX_KONTAKT) || !seite.includes(vergleichbar(wert))))
      return false;
  if (p.telefon_e164 !== undefined) {
    if (p.telefon === undefined || p.telefon_e164 !== telefonE164(p.telefon)) return false;
  }
  return true;
}

function unterlagePasst(u: Unterlage, seiten: number): boolean {
  if (!u || !text(u.typ)) return false;
  const s = u.seiten_mappe;
  // Punkt 2 (U3): 2 ≤ von ≤ bis ≤ seitenzahl; Seite 1 ist das Deckblatt.
  if (!s || !ganz(s.von, 2, seiten) || !ganz(s.bis, s.von, seiten)) return false;
  if (u.vom !== undefined && !(text(u.vom) && TAG.test(u.vom))) return false;
  if (u.monate !== undefined) {
    if (!Array.isArray(u.monate) || !u.monate.length) return false;
    if (!u.monate.every((m) => typeof m === 'string' && MONAT.test(m))) return false;
  }
  if (u.pruefweg !== undefined && !text(u.pruefweg)) return false;
  if (u.vermerke !== undefined) {
    if (!Array.isArray(u.vermerke) || !u.vermerke.length) return false;
    for (const v of u.vermerke) {
      if (!v || !text(v.art)) return false;
      if (v.seiten_original !== undefined) {
        if (!Array.isArray(v.seiten_original) || !v.seiten_original.length) return false;
        if (!v.seiten_original.every((n) => ganz(n, 1, 100_000))) return false;
      }
      if (v.art === 'seiten_weggelassen' && v.seiten_original === undefined) return false;
      if (v.datei !== undefined && !ganz(v.datei, 1, 1000)) return false;
      if (v.monat !== undefined && !(text(v.monat) && MONAT.test(v.monat))) return false;
    }
  }
  return true;
}
