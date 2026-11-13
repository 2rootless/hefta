// Datenspur (E31, B21 „Was hinausging“): Einträge anlegen und den Empfänger so benennen, wie Hefta ihn
// kennt. Reine Rechnung; gespeichert wird am Heft.
import type { SpurEintrag } from './modell';

/**
 * Wer es bekam: aus dem Namen im Inserat „Herrn Kraus“ oder „Frau Peters“ (wie in „Mail an …“), sonst die
 * Mail-Adresse, beim Portal sein Name. Leer, wenn Hefta nichts weiß.
 */
export function spurAn(o: {
  anbieter: string | null | undefined;
  mail: string | null | undefined;
  portal: string | null | undefined;
  weg: SpurEintrag['weg'];
}): string {
  const name = (o.anbieter ?? '').trim().replace(/\s+/g, ' ');
  const m =
    /^(Frau|Herr|Herrn)\s+((?:Dr\.\s+)?[A-ZÄÖÜ][\p{L}'-]+(?:\s+[A-ZÄÖÜ][\p{L}'-]+)?)$/u.exec(name);
  if (o.weg === 'portal') return (o.portal ?? '').trim();
  if (m) return `${m[1] === 'Frau' ? 'Frau' : 'Herrn'} ${m[2]}`;
  return (o.mail ?? '').trim();
}

/** Ein neuer Eintrag ans Ende; bei der Mappe zählt die Fassung die Sendungen an diese Wohnung. */
export function spurEintragen(
  spur: readonly SpurEintrag[] | undefined,
  neu: Omit<SpurEintrag, 'fassung'>,
): SpurEintrag[] {
  const bisher = [...(spur ?? [])];
  if (neu.art !== 'mappe') return [...bisher, neu];
  const fassung = bisher.filter((e) => e.art === 'mappe').length + 1;
  return [...bisher, { ...neu, fassung }];
}

/** „Max, Lea und Paul“. */
export function namenListe(namen: readonly string[]): string {
  const n = namen.filter(Boolean);
  return n.length < 2 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} und ${n.at(-1)}`;
}
