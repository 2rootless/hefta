// Die Zusage im Heft (DP109, W37 mit Z2, PC175): Anfang aus dem Satzpool P9 mit den Rufnamen im Mietvertrag,
// dann fest der Tag aus „Zusage am“ und die Wohnung, leise darunter „Das Heft bleibt hier …“. Reine Rechnung; die
// Wörter stehen in de.json und im Satzpool.

import { namenListe } from './datenspur';

const NB = ' ';
const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

/**
 * {namen} im Anfang: bis drei Personen ihre Rufnamen („Selin und Jarne“), ab vier „ihr vier“ (DP109, Abschnitt
 * 2). `ihrZahl` setzt die Zahl als Wort ein (bis zwölf, danach Ziffern), etwa über `t('stand.zusage.ihrZahl')`.
 */
export function zusageNamen(
  rufnamen: readonly string[],
  ihrZahl: (anzahl: number) => string,
): string {
  const n = rufnamen.filter((x) => x.trim());
  return n.length >= 4 ? ihrZahl(n.length) : namenListe(n);
}

/** Kalendertag im Ortszeit des Geräts, als „JJJJ-MM-TT“. */
function ortsTag(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type ZusageTag =
  { art: 'heute' } | { art: 'gestern' } | { art: 'am'; text: string } | { art: 'ohne' };

/**
 * Der Tag nur aus „Zusage am“ (W10): heute, gestern, sonst „12. November“, im Vorjahr mit Jahr. Ohne Eintrag
 * kein Tag; dann heißt der Satz „Die Zusage ist eingetragen.“
 */
export function zusageTag(am: string | null | undefined, heute: Date): ZusageTag {
  if (!am) return { art: 'ohne' };
  const d = new Date(am);
  if (Number.isNaN(d.getTime())) return { art: 'ohne' };
  const gestern = new Date(heute);
  gestern.setDate(heute.getDate() - 1);
  if (ortsTag(d) === ortsTag(heute)) return { art: 'heute' };
  if (ortsTag(d) === ortsTag(gestern)) return { art: 'gestern' };
  const tag = `${d.getDate()}.${NB}${MONATE[d.getMonth()]}`;
  return {
    art: 'am',
    text: d.getFullYear() < heute.getFullYear() ? `${tag} ${d.getFullYear()}` : tag,
  };
}

/** Wofür die Zusage kam: mit Straße die Wohnung, sonst der eigene Name des Hefts, sonst nichts. */
export function zusageWofuer(
  strasse: string,
  eigenerName: string,
): { art: 'strasse'; text: string } | { art: 'name'; text: string } | null {
  const s = strasse.trim();
  if (s) return { art: 'strasse', text: s };
  const n = eigenerName.trim();
  return n ? { art: 'name', text: n } : null;
}
