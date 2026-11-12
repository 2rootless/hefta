import type { Heft, HeftEreignisse } from './modell';

// Stand eines Hefts (E43, B16 Abschnitt 2, `stand()` in build_b16.py): Er steht nirgends, er rechnet sich
// aus den Ereignissen. Von Hand gibt es nur das Ergebnis und „Stand selbst setzen“; „Keine Antwort“ setzt
// nur Hefta. Dazu die Gruppen der Übersicht (B16 Abschnitt 1). Reine Rechnung, ohne Oberfläche (B18).

export type Stand = 'gemerkt' | 'beworben' | 'besichtigung' | 'abgelegt' | 'keine_antwort';

/** Tage nach der Bewerbung ohne Termin, bis „Keine Antwort“ gilt (B16, `KEINE_NACH`). */
export const KEINE_ANTWORT_NACH_TAGEN = 21;

const TAG_MS = 24 * 60 * 60 * 1000;

function tageZwischen(von: string, bis: Date): number {
  const a = new Date(von);
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ende = Date.UTC(bis.getFullYear(), bis.getMonth(), bis.getDate());
  return Math.round((ende - start) / TAG_MS);
}

/** Zählt die Bewerbung? Nur, wenn Hefta sie sicher weiß oder jemand sie bestätigt hat. */
export function beworbenSicher(e: HeftEreignisse): boolean {
  return !!e.beworben?.sicher;
}

export function stand(e: HeftEreignisse, jetzt: Date): Stand {
  if (e.ergebnis || e.abgelegtAm) return 'abgelegt';
  if (e.termin) return 'besichtigung';
  if (beworbenSicher(e))
    return tageZwischen(e.beworben!.am, jetzt) >= KEINE_ANTWORT_NACH_TAGEN
      ? 'keine_antwort'
      : 'beworben';
  return 'gemerkt';
}

/** „Besichtigung · Stand 3 von 4“: die Leiste im Heft. „Keine Antwort“ steht nach der Bewerbung. */
export function standNummer(s: Stand): 1 | 2 | 3 | 4 {
  return ({ gemerkt: 1, beworben: 2, keine_antwort: 2, besichtigung: 3, abgelegt: 4 } as const)[s];
}

/**
 * „Stimmt der Stand?“ (B16, Antwort a): nur, wenn etwas hinausging, Hefta das Absenden aber nicht sicher
 * weiß, und nur einmal. Übergangen oder „Noch nicht“: Der Stand bleibt „Gemerkt“, Hefta fragt nie wieder.
 */
export function standFragen(e: HeftEreignisse): boolean {
  return !!e.beworben && !e.beworben.sicher && !e.gefragtAm && !e.termin && !e.ergebnis;
}

/** Der Termin ist vorbei, aber es gibt noch kein Ergebnis: „Wie ist es ausgegangen?“ */
export function terminVorbei(e: HeftEreignisse, jetzt: Date): boolean {
  return !!e.termin && !e.ergebnis && tageZwischen(e.termin.am, jetzt) > 0;
}

export interface Gruppen<H> {
  stehtAn: H[];
  wartet: H[];
  gemerkt: H[];
  keineAntwort: H[];
  abgelegt: H[];
}

/**
 * Gruppen der Übersicht (B16): „Steht an“ (Besichtigungen; vorbei und ohne Ergebnis oben, dann nach Datum),
 * „Warten auf Antwort“ (wer am längsten wartet, oben), „Gemerkt“ (neueste oben), zugeklappt
 * „Keine Antwort“ und „Abgelegt“.
 */
export function gruppieren<H extends Pick<Heft, 'createdAt' | 'ereignisse'>>(
  hefte: H[],
  jetzt: Date,
): Gruppen<H> {
  const g: Gruppen<H> = { stehtAn: [], wartet: [], gemerkt: [], keineAntwort: [], abgelegt: [] };
  for (const h of hefte) {
    const s = stand(h.ereignisse, jetzt);
    if (s === 'besichtigung') g.stehtAn.push(h);
    else if (s === 'beworben') g.wartet.push(h);
    else if (s === 'gemerkt') g.gemerkt.push(h);
    else if (s === 'keine_antwort') g.keineAntwort.push(h);
    else g.abgelegt.push(h);
  }
  const termin = (h: H) => h.ereignisse.termin!.am;
  g.stehtAn.sort(
    (a, b) =>
      Number(terminVorbei(b.ereignisse, jetzt)) - Number(terminVorbei(a.ereignisse, jetzt)) ||
      termin(a).localeCompare(termin(b)),
  );
  g.wartet.sort((a, b) => a.ereignisse.beworben!.am.localeCompare(b.ereignisse.beworben!.am));
  g.gemerkt.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  g.keineAntwort.sort((a, b) => a.ereignisse.beworben!.am.localeCompare(b.ereignisse.beworben!.am));
  const abgelegtAm = (h: H) => h.ereignisse.abgelegtAm ?? h.ereignisse.ergebnis?.am ?? '';
  g.abgelegt.sort((a, b) => abgelegtAm(b).localeCompare(abgelegtAm(a)));
  return g;
}

/** „Alle ablegen“ bei „Keine Antwort“ erst ab drei Heften (Antwort a an das Design, Punkt 2). */
export const ALLE_ABLEGEN_AB = 3;

/** „An 14 davon ging keine Löschbitte.“ Wie viele Hefte noch keine Löschbitte bekamen. */
export function ohneLoeschbitte(hefte: Pick<Heft, 'ereignisse'>[]): number {
  return hefte.filter((h) => !h.ereignisse.loeschbitteAm).length;
}

// „Stand selbst setzen“, Termin und Ergebnis (Zeile 9, B21 und B23): Änderungen an den Ereignissen, aus
// denen sich der Stand rechnet. Die Bewerbung bleibt beim Zurücksetzen nicht stehen, sonst rechnete sich
// der alte Stand wieder heraus; das Datum der Bewerbung bleibt, wenn es eins gab.

/** „Gemerkt“ oder „Beworben“ von Hand. Besichtigung und Ergebnis gehen über Termin und Ergebnis. */
export function standSetzen(
  e: HeftEreignisse,
  ziel: 'gemerkt' | 'beworben',
  jetzt: Date,
): HeftEreignisse {
  const ohne = { ...e, termin: null, ergebnis: null, abgelegtAm: null };
  if (ziel === 'gemerkt') return { ...ohne, beworben: null };
  return {
    ...ohne,
    beworben: e.beworben
      ? { ...e.beworben, sicher: true }
      : { am: jetzt.toISOString(), weg: 'sonst', sicher: true },
  };
}

/** Termin eintragen oder ändern: Das Heft steht auf „Besichtigung“, auch wenn es abgelegt war. */
export function terminSetzen(e: HeftEreignisse, am: Date, treffpunkt: string): HeftEreignisse {
  return {
    ...e,
    termin: { am: am.toISOString(), ort: e.termin?.ort ?? '', treffpunkt: treffpunkt.trim() },
    ergebnis: null,
    abgelegtAm: null,
  };
}

/** Zusage, Absage oder „Wir wollen nicht mehr“: Hefta legt das Heft ab. Der Termin bleibt erhalten. */
export function ergebnisSetzen(
  e: HeftEreignisse,
  art: NonNullable<HeftEreignisse['ergebnis']>['art'],
  jetzt: Date,
): HeftEreignisse {
  const am = jetzt.toISOString();
  return { ...e, ergebnis: { art, am }, abgelegtAm: am };
}

/** „Wieder hervorholen“: Ergebnis und Ablage weg, der Stand rechnet sich aus dem Rest. */
export function hervorholen(e: HeftEreignisse): HeftEreignisse {
  return { ...e, ergebnis: null, abgelegtAm: null };
}
