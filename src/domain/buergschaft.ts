import type { Bezeichnung, DateiVersion, Dokument, Id } from './modell';
import { dokumenttyp } from './regelkatalog';

// Bürgschaftserklärung (E112, DP41 Abschnitt 6; DP49 Punkt 5): Angaben des Formulars, was davon offen ist, und
// welche Fassung zu welchem Heft gehört. Läuft ohne Browser-APIs.

export type BuergschaftsArt = 'ausfall' | 'selbstschuldnerisch';

export interface BuergschaftAngaben {
  buerge: { name: string; anschrift: string };
  /** Alle, die in den Mietvertrag gehen; aus dem Heft fest, ohne Heft zum Eintippen. */
  mieter: string[];
  vermieter: { name: string; anschrift: string };
  /** Anschrift und Lage der Wohnung in einer Zeile. */
  wohnung: string;
  vertrag: 'unterschrieben' | 'nochNicht';
  /** „JJJJ-MM-TT“: „Mietvertrag vom“ oder „Einzug zum“, je nach `vertrag`. */
  vertragTag: string;
  /** Pflicht (PC47 §3): ohne Höchstbetrag kein PDF. Ganze Euro. */
  hoechstbetrag: number | null;
  /** Pflicht, ohne Vorwahl (DP41 Schnellmodus). */
  art: BuergschaftsArt | null;
  /** „So steht es auf der Karte“; ohne Heft neutral (PC51: „Bürgschaft von“). */
  bezeichnung: Bezeichnung;
}

export function leereAngaben(): BuergschaftAngaben {
  return {
    buerge: { name: '', anschrift: '' },
    mieter: [''],
    vermieter: { name: '', anschrift: '' },
    wohnung: '',
    vertrag: 'nochNicht',
    vertragTag: '',
    hoechstbetrag: null,
    art: null,
    bezeichnung: 'neutral',
  };
}

const voll = (...werte: string[]) => werte.every((w) => w.trim() !== '');

/**
 * Wie viele Teile noch offen sind (DP41: leer „6 offen“, aus dem Heft „2 offen“): wer bürgt, für wen,
 * Vermieter, Wohnung, Höchstbetrag, Art. Nur die letzten zwei halten das PDF auf; der Rest bleibt auf dem
 * Blatt frei für die Hand.
 */
export function offenZahl(a: BuergschaftAngaben): number {
  return [
    voll(a.buerge.name, a.buerge.anschrift),
    a.mieter.some((m) => m.trim()),
    voll(a.vermieter.name, a.vermieter.anschrift),
    voll(a.wohnung, a.vertragTag),
    !!a.hoechstbetrag && a.hoechstbetrag > 0,
    !!a.art,
  ].filter((da) => !da).length;
}

/** Was „PDF erstellen“ aufhält (E3): je ein Fehler für Höchstbetrag und Art. */
export function pflichtFehlt(a: BuergschaftAngaben): { betrag: boolean; art: boolean } {
  return { betrag: !a.hoechstbetrag || a.hoechstbetrag <= 0, art: !a.art };
}

/** „3.600“ aus 3600; die Eingabe nimmt nur Ziffern (ganze Euro). */
export function betragText(betrag: number | null): string {
  return betrag ? new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(betrag) : '';
}

export function betragAus(text: string): number | null {
  const ziffern = text.replace(/\D/g, '').slice(0, 9);
  return ziffern ? Number(ziffern) : null;
}

/** Etikett auf Blatt 1 und Unterschriftszeile nach der Karte (PC51: neutral „Bürgschaft von“). */
export function buergeWorte(b: Bezeichnung): {
  etikett: string;
  unterschrift: string;
  kopf: string;
} {
  if (b === 'weiblich')
    return {
      etikett: 'Bürgin',
      unterschrift: 'Unterschrift der Bürgin (eigenhändig)',
      kopf: 'Bürgin',
    };
  if (b === 'maennlich')
    return {
      etikett: 'Bürge',
      unterschrift: 'Unterschrift des Bürgen (eigenhändig)',
      kopf: 'Bürge',
    };
  return { etikett: 'Bürgschaft von', unterschrift: 'Unterschrift (eigenhändig)', kopf: '' };
}

// ---------- Welche Fassung gilt für welches Heft (DP49 Punkt 5) ----------

const istJeWohnung = (typ: string) => dokumenttyp(typ)?.jeWohnung === true;

/**
 * Die Versionen, die für dieses Heft zählen. Bei Typen „je Wohnung“: die des Hefts; gibt es keine, die ohne
 * bestimmte Wohnung (älter als DP49 oder ohne Heft hochgeladen), damit nichts still aus einer Mappe fällt.
 * `heftId` null (Mappe ohne Heft): nur die ohne bestimmte Wohnung. Andere Typen bleiben unverändert.
 */
export function versionenFuerHeft(
  dokumente: Pick<Dokument, 'id' | 'typ'>[],
  versionen: DateiVersion[],
  heftId: Id | null,
): DateiVersion[] {
  const je = new Set(dokumente.filter((d) => istJeWohnung(d.typ)).map((d) => d.id));
  if (!je.size) return versionen;
  const eigene = new Set(
    versionen
      .filter((v) => je.has(v.dokumentId) && heftId && v.heftId === heftId)
      .map((v) => v.dokumentId),
  );
  return versionen.filter((v) => {
    if (!je.has(v.dokumentId)) return true;
    if (eigene.has(v.dokumentId)) return v.heftId === heftId;
    return !v.heftId;
  });
}

/** Die Ansicht des Haushalts, wie die Mappe dieses Hefts sie sieht (nur Versionen gefiltert). */
export function ansichtFuerHeft<A extends { dokumente: Dokument[]; versionen: DateiVersion[] }>(
  ansicht: A,
  heftId: Id | null,
): A {
  const versionen = versionenFuerHeft(ansicht.dokumente, ansicht.versionen, heftId);
  return versionen.length === ansicht.versionen.length ? ansicht : { ...ansicht, versionen };
}

export interface ErklaerungStand {
  /** Die Fassung genau für dieses Heft. */
  eigene: DateiVersion | null;
  /** Sonst eine ohne bestimmte Wohnung, die in die Mappe käme. */
  ohneWohnung: DateiVersion | null;
}

const neueste = (liste: DateiVersion[]) =>
  [...liste].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1) ?? null;

/** Stand der Erklärung einer Person für ein Heft. */
export function erklaerungFuer(
  personId: Id,
  dokumente: Dokument[],
  versionen: DateiVersion[],
  heftId: Id,
): ErklaerungStand {
  const ids = new Set(
    dokumente.filter((d) => d.personId === personId && istJeWohnung(d.typ)).map((d) => d.id),
  );
  const alle = versionen.filter((v) => ids.has(v.dokumentId));
  return {
    eigene: neueste(alle.filter((v) => v.heftId === heftId)),
    ohneWohnung: neueste(alle.filter((v) => !v.heftId)),
  };
}

/** Tag der Erklärung: das eingetragene Datum, sonst der Tag des Hochladens. */
export function erklaerungTag(v: DateiVersion): string {
  return v.ausstellungsdatum ?? v.createdAt.slice(0, 10);
}
