// DP45 G1 (W28): Unterlagen des ganzen Haushalts. Sie liegen als Dokument mit `personId = haushalt.id`
// beim Haushalt, nicht bei einer Person und nicht bei einem Heft. Jedes Heft, in dem sie zählen, wählt sie
// nur aus; hochgeladen wird einmal.
import type { DateiVersion, Dokument, Tag } from './modell';

/** Die neueste Version einer Unterlage des Haushalts, etwa des Wohnberechtigungsscheins. */
export function haushaltSchein(
  dokumente: Dokument[] | undefined,
  versionen: DateiVersion[],
  typ: string,
): { dokument: Dokument; version: DateiVersion } | null {
  const dokument = dokumente?.find((d) => d.typ === typ);
  if (!dokument) return null;
  const version = versionen
    .filter((v) => v.dokumentId === dokument.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return version ? { dokument, version } : null;
}

/** Abgelaufen: „Gültig bis“ liegt vor heute. Ohne eingetragenes Datum gilt der Schein nicht als abgelaufen. */
export function wbsAbgelaufen(v: DateiVersion, heute: Tag): boolean {
  return !!v.wbs?.gueltigBis && v.wbs.gueltigBis < heute;
}

/** Tage bis zur Erinnerung: 30 Tage vor „Gültig bis“, einmal (DP45, Offene Frage 1). */
export const WBS_ERINNERUNG_TAGE = 30;

/** Läuft bald ab: „Gültig bis“ ist höchstens 30 Tage entfernt und noch nicht vorbei. */
export function wbsLaeuftBaldAb(v: DateiVersion, heute: Tag): boolean {
  const bis = v.wbs?.gueltigBis;
  if (!bis || bis < heute) return false;
  const tage = (Date.parse(bis) - Date.parse(heute)) / 86_400_000;
  return tage <= WBS_ERINNERUNG_TAGE;
}

/** Eine Mitgliedschaft (DP45 G2) mit ihrem neuesten Nachweis, falls einer da ist. */
export interface Mitgliedschaft {
  dokument: Dokument;
  name: string;
  nummer: string;
  nachweis: DateiVersion | null;
}

/** Alle Mitgliedschaften des Haushalts, in der Reihenfolge, in der sie angelegt wurden. */
export function mitgliedschaften(
  dokumente: Dokument[] | undefined,
  versionen: DateiVersion[],
): Mitgliedschaft[] {
  return (dokumente ?? [])
    .filter((d) => d.typ === 'mitgliedschaft' && d.genossenschaft)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((d) => ({
      dokument: d,
      name: d.genossenschaft!.name,
      nummer: d.genossenschaft!.nummer,
      nachweis:
        versionen
          .filter((v) => v.dokumentId === d.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
    }));
}

/** Was ein Heft vom Haushalt in seine Mappe nimmt (W28): nur Auswahl, nie eine eigene Kopie. */
export type HeftHaushaltTeil =
  | { typ: 'wbs'; version: DateiVersion; abgelaufen: boolean }
  | { typ: 'mitgliedschaft'; mitgliedschaft: Mitgliedschaft };

/** Was ein Heft dazu wissen muss. */
export interface HeftHaushaltWahl {
  sozialwohnung?: boolean;
  wbsAbgelaufenMit?: boolean;
  genossenschaft?: string | null;
}

/**
 * Unterlagen des Haushalts in der Mappe eines Hefts:
 * - der Wohnberechtigungsschein, wenn das Heft als Sozialwohnung markiert ist; abgelaufen nur, wenn es im
 *   Heft angeschaltet ist (K3);
 * - die Mitgliedschaft der Genossenschaft, die im Heft unter „Wer vermietet?“ gewählt ist (G2).
 */
export function haushaltFuerHeft(
  dokumente: Dokument[] | undefined,
  versionen: DateiVersion[],
  heft: HeftHaushaltWahl | null | undefined,
  heute: Tag,
): HeftHaushaltTeil[] {
  const teile: HeftHaushaltTeil[] = [];
  if (!heft) return teile;
  const schein = heft.sozialwohnung ? haushaltSchein(dokumente, versionen, 'wbs') : null;
  if (schein) {
    const abgelaufen = wbsAbgelaufen(schein.version, heute);
    if (!abgelaufen || heft.wbsAbgelaufenMit)
      teile.push({ typ: 'wbs', version: schein.version, abgelaufen });
  }
  const mitglied = heft.genossenschaft
    ? mitgliedschaften(dokumente, versionen).find((m) => m.dokument.id === heft.genossenschaft)
    : undefined;
  if (mitglied) teile.push({ typ: 'mitgliedschaft', mitgliedschaft: mitglied });
  return teile;
}
