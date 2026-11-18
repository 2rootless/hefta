// Passt eine Lesehilfe zu ihrer Mappe? (Abschnitt 11 der Beschreibung, Punkte 1 bis 7.) Eine Lesehilfe ist eine
// Angabe der Bewerber und kein Echtheitsnachweis: Jeder kann sie ändern. Ein Leser zeigt sie darum nur, wenn alles
// passt, und sonst gar nicht, auch nicht zum Teil. Dieselben Regeln wie Designs fremder Leser `leser78.py`.
import { papierGruende, type Papier } from './papier.js';
import type { Lesehilfe } from './typen.js';

/** Was ein Leser über die Mappe weiß: Seitenzahl und Text vor der ersten Unterlage (Punkt 7). */
export interface Mappe extends Papier {
  /** Zahl der Seiten der PDF. */
  seiten: number;
}

const ZAHLWORT = [
  '',
  '',
  'zwei',
  'drei',
  'vier',
  'fünf',
  'sechs',
  'sieben',
  'acht',
  'neun',
  'zehn',
  'elf',
  'zwölf',
];

/** V22: die feste Form der Mitziehenden; unbekannte Art: keine feste Form (L78-1). */
export function mitziehendText(anzahl: number, art: string): string | null {
  if (art !== 'kind' && art !== 'erwachsen') return null;
  const [eins, viele] =
    art === 'kind' ? ['Ein Kind', 'Kinder'] : ['Eine weitere Person', 'weitere Personen'];
  if (anzahl === 1) return eins;
  const w = `${anzahl < ZAHLWORT.length ? ZAHLWORT[anzahl] : anzahl} ${viele}`;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** Gründe, warum die Lesehilfe nicht zur Mappe passt; leer heißt: passt. */
export function pruefen(l: Lesehilfe, mappe: Mappe): string[] {
  // Punkt 7: Bindung an das Papier.
  return [...punkteOhnePapier(l, mappe.seiten), ...papierGruende(l, mappe)];
}

/**
 * Punkte 1 bis 6, ohne das Papier. Nur für Vergleiche mit Lesern, die keinen Text der PDF lesen (Tests); ein Leser
 * zeigt eine Lesehilfe nie ohne Punkt 7.
 */
export function punkteOhnePapier(l: Lesehilfe, seiten: number): string[] {
  const g: string[] = [];
  const personen = l.haushalt.personen;
  // Punkt 1: die Seitenzahl.
  if (l.seitenzahl !== seiten) g.push(`Punkt 1: seitenzahl ${l.seitenzahl}, PDF hat ${seiten}`);
  // Punkt 2: Bereiche in der Mappe, ohne Überschneidung; E220 Regel 4: Monate streng aufsteigend.
  const bereiche: [number, number, string][] = [];
  for (const p of personen)
    for (const u of p.unterlagen) {
      const { von, bis } = u.seiten_mappe;
      if (!(von >= 2 && von <= bis && bis <= l.seitenzahl))
        g.push(`Punkt 2: ${p.name}, ${u.typ} auf Seite ${von} bis ${bis} liegt nicht in der Mappe`);
      bereiche.push([von, bis, `${p.name}, ${u.typ}`]);
      const m = u.monate ?? [];
      if (m.some((x, i) => i > 0 && x <= m[i - 1]!))
        g.push(`Monate bei ${p.name}, ${u.typ}: nicht aufsteigend oder doppelt`);
    }
  bereiche.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (let i = 1; i < bereiche.length; i++)
    if (bereiche[i]![0] <= bereiche[i - 1]![1])
      g.push(`Punkt 2: ${bereiche[i - 1]![2]} überschneidet ${bereiche[i]![2]}`);
  // Punkt 5: `name` ist `vorname`, ein Leerzeichen, `nachname`; ohne Nachnamen gleich `vorname`.
  for (const p of personen) {
    const v = p.vorname ?? '';
    const n = p.nachname ?? '';
    const soll = n === '' ? v : `${v} ${n}`;
    if (v === '' || p.name.normalize('NFC') !== soll.normalize('NFC'))
      g.push(`Punkt 5: name „${p.name}“ ist nicht vorname + nachname`);
  }
  // Punkt 6: höchstens eine Kontaktperson; genau ein Hauptmieter, und er steht zuerst (E216); Bürgen nach allen im
  // Mietvertrag. Unbekannte Rollen zählen weder als im Vertrag noch als Bürge (E220, Regel 6).
  if (personen.filter((p) => p.kontakt === true).length > 1)
    g.push('Punkt 6: mehr als eine Kontaktperson');
  const haupt = personen.flatMap((p, i) => (p.rolle === 'hauptmieter' ? [i] : []));
  if (haupt.length !== 1 || haupt[0] !== 0)
    g.push('Punkt 6: nicht genau ein Hauptmieter an erster Stelle');
  const buerge = personen.map((p) => p.rolle === 'buerge');
  const erster = buerge.indexOf(true);
  if (erster >= 0 && buerge.slice(erster).includes(false))
    g.push('Punkt 6: Bürgin vor jemandem im Mietvertrag');
  // V22: Mitziehende in fester Form, jede bekannte Art höchstens einmal.
  const arten = l.haushalt.mitziehende
    .map((m) => m.art)
    .filter((a) => a === 'kind' || a === 'erwachsen');
  if (new Set(arten).size !== arten.length)
    g.push('Punkt 6: Mitziehende derselben Art zweimal (V22)');
  for (const m of l.haushalt.mitziehende) {
    const soll = mitziehendText(m.anzahl, m.art);
    if (soll !== null && m.text.normalize('NFC') !== soll)
      g.push(`Punkt 6: Mitziehende „${m.text}“ ist nicht „${soll}“ (V22)`);
  }
  return g;
}

/** Passt die Lesehilfe zur Mappe? Gleich `pruefen(l, mappe).length === 0`. */
export function passt(l: Lesehilfe, mappe: Mappe): boolean {
  try {
    return pruefen(l, mappe).length === 0;
  } catch {
    return false;
  }
}
