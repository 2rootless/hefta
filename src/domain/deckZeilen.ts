// Zeilen fürs Deckblatt aus dem Heft (B14, E39): Inserat und Einzug im Kopf, die Fassung unten in der
// Leiste. Die Mappe ist immer Deutsch; darum stehen die Wortlaute hier und nicht in der Übersetzung.
import type { Heft } from './modell';

const DATUM = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

function tag(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? DATUM.format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}

export function deckZeilen(
  heft: Pick<Heft, 'angaben' | 'quelle' | 'einzug' | 'spur'>,
  heute: Date,
): { deckInserat?: string; deckEinzug?: string; deckFassung?: string } {
  const portal = (heft.angaben?.portal ?? heft.quelle ?? '').trim();
  const einzug = heft.einzug ? tag(heft.einzug) : null;
  // Die wievielte Mappe an diese Wohnung: die nächste nach denen in der Datenspur.
  const fassung = (heft.spur ?? []).filter((e) => e.art === 'mappe').length + 1;
  return {
    ...(portal ? { deckInserat: `Zu Ihrem Inserat auf ${portal}` } : {}),
    ...(einzug ? { deckEinzug: `Einzug möglich ab ${einzug}` } : {}),
    deckFassung: `Fassung ${fassung} vom ${DATUM.format(heute)}`,
  };
}
