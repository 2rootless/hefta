// Export der Vermieterseite als CSV (PC99, PC100; E206, E207): „Für Ihre Software exportieren“. Läuft im Browser,
// ohne Server. Regel 1: Exportiert wird nur, was die Lesehilfe enthält, und nur Lesehilfen ab Fassung 4, die zu
// ihrer Mappe passen. Beschreibung: docs/hefta-json-4/export-entwurf.md (Hefta 2), Abschnitt 2.
import { typText } from '../../pakete/hefta-json/src/index';
import type { HeftaAnhang } from '../pdf/anhang';

export const SPALTEN = [
  'kennung',
  'fassung',
  'erstellt',
  'wohnung_strasse',
  'wohnung_rest',
  'strasse',
  'hausnummer',
  'plz',
  'ort',
  'lage',
  'land',
  'einzug',
  'portal',
  'person_nr',
  'rolle',
  'vorname',
  'nachname',
  'name',
  'kontakt',
  'telefon',
  'telefon_e164',
  'email',
  'kinder',
  'weitere_erwachsene',
  'unterlagen',
  'unterlagen_text',
  'modus',
  'schritt',
  'loeschwunsch',
] as const;

/** Byte Order Mark: Tabellenprogramme erkennen daran UTF-8 und zeigen Umlaute richtig. */
const BOM = String.fromCharCode(0xfeff);

/**
 * Ein Feld der CSV (RFC 4180, Semikolon). Beginnt ein Wert mit =, +, -, @, Tab oder Zeilenumbruch, steht ein
 * Apostroph davor: Sonst liefe ein präparierter Wert in einem Tabellenprogramm als Formel.
 */
export function zelle(wert: string | number | null | undefined): string {
  let s = wert === null || wert === undefined ? '' : String(wert);
  if (/^[=+\-@\t\r\n]/.test(s)) s = `'${s}`;
  if (/[;"\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Ab Fassung 4 mit getrennten Namen; ältere Fassungen fehlen im Export. */
export function exportierbar(a: HeftaAnhang | null): a is HeftaAnhang {
  return !!a && a.hefta >= 4 && a.haushalt.personen.every((p) => typeof p.vorname === 'string');
}

/** Die CSV-Datei für alle exportierbaren Lesehilfen: eine Zeile je Person. */
export function csvText(lesehilfen: HeftaAnhang[]): string {
  const zeilen: string[] = [SPALTEN.join(';')];
  for (const a of lesehilfen) {
    const w = a.bewerbung.wohnung;
    const t = w?.teile;
    const summe = (art: string) =>
      a.haushalt.mitziehende.filter((m) => m.art === art).reduce((s, m) => s + m.anzahl, 0);
    a.haushalt.personen.forEach((p, i) => {
      const typen = p.unterlagen.map((u) => u.typ);
      const werte: Record<(typeof SPALTEN)[number], string | number | undefined> = {
        kennung: a.bewerbung.kennung,
        fassung: a.fassung,
        erstellt: a.erstellt,
        wohnung_strasse: w?.strasse,
        wohnung_rest: w?.rest,
        strasse: t?.strasse,
        hausnummer: t?.hausnummer,
        plz: t?.plz,
        ort: t?.ort,
        lage: t?.lage,
        land: t?.land,
        einzug: a.bewerbung.einzug,
        portal: a.bewerbung.inserat?.portal,
        person_nr: i + 1,
        rolle: p.rolle,
        vorname: p.vorname,
        nachname: p.nachname,
        name: p.name,
        kontakt: p.kontakt ? 'ja' : '',
        telefon: p.telefon,
        telefon_e164: p.telefon_e164,
        email: p.email,
        kinder: summe('kind'),
        weitere_erwachsene: summe('erwachsen'),
        unterlagen: typen.join('|'),
        unterlagen_text: typen.map(typText).join(' | '),
        modus: a.modus,
        schritt: a.schritt,
        loeschwunsch: a.loeschwunsch,
      };
      zeilen.push(SPALTEN.map((s) => zelle(werte[s])).join(';'));
    });
  }
  return `${BOM}${zeilen.join('\r\n')}\r\n`;
}

/** „hefta-export-2026-11-18.csv“, nach dem Tag des Exports. */
export function dateiname(heute: Date): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `hefta-export-${heute.getFullYear()}-${z(heute.getMonth() + 1)}-${z(heute.getDate())}.csv`;
}
