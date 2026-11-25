// Testhilfe: Seite 1 einer Mappe so, wie Heftas Schreiber sie setzt (FORMAT.md, Abschnitt 11, Punkt 7; V5 bis V9,
// E227). Pakettests und Tests der App binden gegen dieselben Zeilen. Gehört nicht zum gebauten Paket.
import {
  SCHRITT_SATZ,
  datumText,
  imVertrag,
  kontaktPerson,
  seitenText,
  vermerkText,
  verzeichnisZeile,
  type Lesehilfe,
  type Mappe,
} from '../src/index.js';

/** Nur Fassung 1 (V9): das Rollenwort hinter dem Namen. Fassung 2 schreibt keins (W57, DP124 Abschnitt 3). */
const ROLLENWORT: Record<string, string> = {
  hauptmieter: 'Hauptmieter',
  mitmieter: 'Mitmieter',
  buerge: 'Bürge',
};

/**
 * Seite 1 so, wie Heftas Schreiber sie setzt (V5 bis V9, E227): Wohnung, Satz zum Schritt, feste Überschriften,
 * Namen (in Fassung 1 mit Rollenwort, in Fassung 2 unter „Im Mietvertrag“ mit der Tätigkeit, unter „Bürgt“ nur der
 * Name), Kontakt, „Was beiliegt“ mit „– Seite n“, „Fassung n vom …“, Löschbitte, Fuß.
 */
export function deckblattZeilen(l: Lesehilfe): string[] {
  const z: string[] = ['Bewerbung um die Wohnung'];
  const w = l.bewerbung.wohnung;
  if (w) z.push(w.strasse, ...(w.rest ? [w.rest] : []));
  if (l.bewerbung.inserat) z.push(`Zu Ihrem Inserat auf ${l.bewerbung.inserat.portal}`);
  if (l.bewerbung.einzug) z.push(`Einzug möglich ab ${datumText(l.bewerbung.einzug)}`);
  z.push('Ein Haushalt bewirbt sich.');
  if (l.schritt && SCHRITT_SATZ[l.schritt]) z.push(SCHRITT_SATZ[l.schritt]!);
  const vertrag = l.haushalt.personen.filter((p) => p.rolle !== 'buerge');
  const buergen = l.haushalt.personen.filter((p) => p.rolle === 'buerge');
  const zwei = l.hefta >= 2;
  z.push('Im Mietvertrag');
  for (const p of vertrag)
    z.push(
      p.name,
      zwei ? (imVertrag(p.rolle) ? 'Angestellt' : 'Person') : (ROLLENWORT[p.rolle] ?? 'Person'),
    );
  if (l.haushalt.mitziehende.length)
    z.push('Ziehen mit ein', ...l.haushalt.mitziehende.map((m) => m.text));
  if (buergen.length) {
    z.push('Bürgt');
    for (const p of buergen) z.push(...(zwei ? [p.name] : [p.name, 'Bürge']));
  }
  const k = l.haushalt.personen.find((p) => kontaktPerson(p, l.hefta));
  if (k)
    z.push('Kontakt', k.name, ...(k.telefon ? [k.telefon] : []), ...(k.email ? [k.email] : []));
  z.push('Was beiliegt');
  for (const p of l.haushalt.personen) {
    if (!p.unterlagen.length) continue;
    z.push(p.name);
    for (const u of p.unterlagen) {
      z.push(`${verzeichnisZeile(u) ?? 'Unterlage'} – ${seitenText(u)}`);
      // Vermerke (DP64) stehen unter ihrer Unterlage. Heftas Schreiber druckt sie noch nicht und schreibt sie darum
      // auch nicht in die Lesehilfe; die Beispiele 2 und 3 zeigen sie.
      for (const v of u.vermerke ?? []) z.push(vermerkText(v));
    }
  }
  z.push(`Fassung ${l.fassung} vom ${datumText(l.erstellt.slice(0, 10))}`);
  if (l.loeschwunsch) z.push(l.loeschwunsch);
  z.push('Erstellt mit Hefta', `Bewerbung Seite 1 von ${l.seitenzahl}`);
  return z;
}

/** Die Mappe zu einer Lesehilfe: Seitenzahl, Deckblatt als Seite 1, keine leeren Seiten, Erstelldatum aus `erstellt`. */
export function musterMappe(l: Lesehilfe, zeilen = deckblattZeilen(l)): Mappe {
  const text = zeilen.join(String.fromCharCode(10));
  return {
    seiten: l.seitenzahl,
    seite1: text,
    text,
    leereSeiten: [],
    erstellt: new Date(l.erstellt),
  };
}
