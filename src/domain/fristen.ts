import type { DateiVersion, Dokument, Monat, Person, Tag } from './modell';

// Aktualität und Erinnerungen (docs/04-regeln-und-hinweise.md, „Aktualität und Erinnerungen“).
// Kein Dokument hat eine gesetzliche Gültigkeit; Fristen sind einstellbare Standardwerte aus dem
// Regelkatalog. Grundsatz: Ein falsches „veraltet“ bei Leuten, die noch gar keine neue Abrechnung
// haben, ist schlimmer als gar kein Hinweis. Darum rechnen wir lieber spät als früh.

export interface Fristen {
  /** Gehalt: Hinweis, sobald die nächste Abrechnung da sein kann. */
  hinweis?: 'naechster_monat_faellig';
  hinweisTage?: number;
  /** „info“: Ab `hinweisTage` nur eine Information, keine Aufgabe; zählt nicht als offen. */
  hinweisArt?: 'info';
  /** Laufzeit des Prüfcodes, keine Gültigkeit der Unterlage. */
  pruefcodeTage?: number;
  warnungTage?: number;
}

export type AbrechnungMeist = Person['abrechnungMeist'];

/** Tag im Folgemonat, an dem die Abrechnung für einen Monat meist da ist. Ohne Angabe: spät. */
const ABRECHNUNG_TAG: Record<NonNullable<AbrechnungMeist>, number> = {
  anfang: 5,
  mitte: 15,
  ende: 28,
};
export const ABRECHNUNG_STANDARD: NonNullable<AbrechnungMeist> = 'ende';

// ---------- Monate und Tage ----------

export function monatAus(datum: Date): Monat {
  return `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}`;
}

export function monatPlus(monat: Monat, n: number): Monat {
  const [j, m] = monat.split('-').map(Number) as [number, number];
  return monatAus(new Date(j, m - 1 + n, 1));
}

export function tagAus(datum: Date): Tag {
  return `${monatAus(datum)}-${String(datum.getDate()).padStart(2, '0')}`;
}

export function datumAus(tag: Tag): Date {
  const [j, m, d] = tag.split('-').map(Number) as [number, number, number];
  return new Date(j, m - 1, d);
}

export function tageZwischen(von: Date, bis: Date): number {
  const a = Date.UTC(von.getFullYear(), von.getMonth(), von.getDate());
  const b = Date.UTC(bis.getFullYear(), bis.getMonth(), bis.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** Ab wann die Abrechnung für `monat` meist da ist. */
export function faelligAb(monat: Monat, meist: AbrechnungMeist): Date {
  const [j, m] = monat.split('-').map(Number) as [number, number];
  return new Date(j, m, ABRECHNUNG_TAG[meist ?? ABRECHNUNG_STANDARD]);
}

/** Der neueste Monat, dessen Abrechnung heute schon da sein kann. */
export function erwarteterMonat(heute: Date, meist: AbrechnungMeist): Monat {
  let monat = monatAus(heute);
  while (faelligAb(monat, meist) > heute) monat = monatPlus(monat, -1);
  return monat;
}

/** Auswahl beim Hochladen: Vormonat, wahrscheinlichster Monat (vorbelegt), Folgemonat. */
export function monatsAuswahl(
  heute: Date,
  meist: AbrechnungMeist,
): { monate: Monat[]; vorbelegt: Monat } {
  const vorbelegt = erwarteterMonat(heute, meist);
  return { monate: [monatPlus(vorbelegt, -1), vorbelegt, monatPlus(vorbelegt, 1)], vorbelegt };
}

// ---------- Bewertung ----------

export type FristStatus = 'da' | 'bald' | 'fehlt' | 'optional';

export interface Bewertung {
  status: FristStatus;
  /** Grund fürs Eintragen-Feld, höchstens zwei Wörter. */
  grund: string;
  /** Bei Serien: Monate, die zur aktuellen Serie zählen (neueste zuletzt). */
  monate: Monat[];
  /** Neuestes Ausstellungsdatum (Typen mit Datum). */
  neuestesDatum: Tag | null;
  /** Bei Serien: der Monat, der als Nächstes dran ist: der neueste fehlende, sonst der kommende. */
  naechsterMonat: Monat | null;
  /** Bei Serien: die Monate, die heute in der Serie fehlen, der neueste zuerst. */
  fehlend: Monat[];
  /** Eine freiwillige Unterlage ist älter als üblich. */
  veraltet: boolean;
}

export interface BewertungsTyp {
  etikett: 'ueblich' | 'kann_helfen' | 'meist_unnoetig';
  serie?: { anzahl: number };
  fristen?: Fristen;
}

export interface Kontext {
  heute: Date;
  abrechnungMeist: AbrechnungMeist;
  /** „Noch nicht“ gewählt: bis zu diesem Tag schweigt der Hinweis „läuft bald ab“. */
  stummBis: Tag | null;
}

function ohne(typ: BewertungsTyp): Bewertung {
  return {
    status: typ.etikett === 'ueblich' ? 'fehlt' : 'optional',
    grund: typ.etikett === 'ueblich' ? 'Fehlt noch' : '',
    monate: [],
    neuestesDatum: null,
    naechsterMonat: null,
    fehlend: [],
    veraltet: false,
  };
}

function stumm(k: Kontext): boolean {
  return (
    !!k.stummBis &&
    datumAus(k.stummBis) >= new Date(k.heute.getFullYear(), k.heute.getMonth(), k.heute.getDate())
  );
}

/** Die Monate der aktuellen Serie: neuester Monat und die davor, soweit vorhanden. */
export function serienMonate(versionen: DateiVersion[], anzahl: number): Monat[] {
  const alle = [
    ...new Set(versionen.map((v) => v.abrechnungsmonat).filter((m): m is Monat => !!m)),
  ].sort();
  const neuester = alle.at(-1);
  if (!neuester) return [];
  const fenster = Array.from({ length: anzahl }, (_, i) => monatPlus(neuester, i - anzahl + 1));
  return fenster.filter((m) => alle.includes(m));
}

/** Die Monate einer vollständigen Serie heute: bis zum erwarteten neuesten Monat, oder weiter, wenn schon ein neuerer da ist. */
export function serienFenster(
  neuester: Monat,
  anzahl: number,
  heute: Date,
  meist: AbrechnungMeist,
): Monat[] {
  const erwartet = erwarteterMonat(heute, meist);
  const ende = neuester > erwartet ? neuester : erwartet;
  return Array.from({ length: anzahl }, (_, i) => monatPlus(ende, i - anzahl + 1));
}

/** Zum Vergleichen: Das Datum ist freiwillig; ohne Datum zählt der Tag des Hochladens. */
export function vergleichsTag(v: Pick<DateiVersion, 'ausstellungsdatum' | 'createdAt'>): Tag {
  return v.ausstellungsdatum ?? v.createdAt.slice(0, 10);
}

/** Die Versionen, die in die Mappe gehen: bei Serien je Monat der Serie die neueste, sonst die neueste. */
export function aktuelleVersionen(
  versionen: DateiVersion[],
  serie?: { anzahl: number },
  /** Je Variante die neueste, z. B. BAföG-Bescheid und Unterhaltsnachweis nebeneinander. */
  jeVariante = false,
): DateiVersion[] {
  const neueste = (liste: DateiVersion[]) =>
    [...liste].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
  if (serie) {
    return serienMonate(versionen, serie.anzahl)
      .map((m) => neueste(versionen.filter((v) => v.abrechnungsmonat === m))!)
      .filter(Boolean);
  }
  const sortiert = [...versionen].sort(
    (a, b) =>
      vergleichsTag(a).localeCompare(vergleichsTag(b)) || a.createdAt.localeCompare(b.createdAt),
  );
  if (jeVariante) {
    const je = new Map(sortiert.map((v) => [v.variante, v]));
    return [...je.values()];
  }
  return sortiert.length ? [sortiert.at(-1)!] : [];
}

const kurz = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });

/** „28. Aug.“, „12. Juli“: kurz genug für das Eintragen-Feld (design/zeit-und-dateien.md, Z1). */
export function kurzDatum(tag: Tag): string {
  // Tag und Monat stehen zusammen: geschütztes Leerzeichen statt „12. / Juli“ (C23).
  return kurz.format(datumAus(tag)).replace(/(\d{1,2}\.) /, '$1\u00a0');
}

export function bewerten(typ: BewertungsTyp, versionen: DateiVersion[], k: Kontext): Bewertung {
  if (versionen.length === 0) return ohne(typ);
  const f = typ.fristen ?? {};

  if (typ.serie) {
    const monate = serienMonate(versionen, typ.serie.anzahl);
    const neuester = monate.at(-1);
    if (!neuester) return ohne(typ);
    const vorhanden = new Set(versionen.map((v) => v.abrechnungsmonat));
    const fehlend = serienFenster(neuester, typ.serie.anzahl, k.heute, k.abrechnungMeist)
      .filter((m) => !vorhanden.has(m))
      .reverse();
    const basis = {
      monate,
      neuestesDatum: null,
      naechsterMonat: monatPlus(neuester, 1),
      fehlend,
      veraltet: false,
    };
    const alter = tageZwischen(faelligAb(neuester, k.abrechnungMeist), k.heute);
    if (f.warnungTage !== undefined && alter > f.warnungTage) {
      return {
        ...basis,
        status: typ.etikett === 'ueblich' ? 'fehlt' : 'optional',
        grund: 'Neuer Monat',
        veraltet: true,
      };
    }
    if (monate.length < typ.serie.anzahl) {
      // Es fehlt ein Monat, nicht der kommende: Am 4. November ist der November noch nicht dran.
      const naechsterMonat = fehlend[0] ?? basis.naechsterMonat;
      return { ...basis, naechsterMonat, status: 'fehlt', grund: 'Fehlt noch' };
    }
    if (
      f.hinweis === 'naechster_monat_faellig' &&
      faelligAb(basis.naechsterMonat, k.abrechnungMeist) <= k.heute &&
      !stumm(k)
    ) {
      return { ...basis, status: 'bald', grund: 'Neuer Monat' };
    }
    return { ...basis, status: 'da', grund: '' };
  }

  // Es zählt die neueste Fassung. Ohne Datum gibt es nichts, woran Hefta ihr Alter messen kann.
  const neuestesDatum = aktuelleVersionen(versionen)[0]?.ausstellungsdatum ?? null;
  const basis = { monate: [], neuestesDatum, naechsterMonat: null, fehlend: [], veraltet: false };
  if (!neuestesDatum) return { ...basis, status: 'da', grund: '' };
  const alter = tageZwischen(datumAus(neuestesDatum), k.heute);
  if (f.warnungTage !== undefined && alter > f.warnungTage) {
    return typ.etikett === 'ueblich'
      ? {
          ...basis,
          status: 'fehlt',
          grund: `Zu alt, vom ${kurzDatum(neuestesDatum)}`,
          veraltet: true,
        }
      : { ...basis, status: 'optional', grund: '', veraltet: true };
  }
  if (
    f.hinweisTage !== undefined &&
    f.hinweisArt !== 'info' &&
    alter > f.hinweisTage &&
    !stumm(k)
  ) {
    return { ...basis, status: 'bald', grund: `Bald zu alt, vom ${kurzDatum(neuestesDatum)}` };
  }
  return { ...basis, status: 'da', grund: '' };
}

/**
 * „Noch nicht“: eine Woche Ruhe. Höchstens zweimal pro Monat fragen: Wer im selben Monat
 * schon einmal „Noch nicht“ gesagt hat, wird erst im nächsten Monat wieder gefragt.
 */
export function nochNicht(
  dokument: Pick<Dokument, 'stummMonat' | 'stummAnzahl'>,
  heute: Date,
  ruheTage = 7,
): Pick<Dokument, 'stummBis' | 'stummMonat' | 'stummAnzahl'> {
  const monat = monatAus(heute);
  const anzahl = dokument.stummMonat === monat ? (dokument.stummAnzahl ?? 0) + 1 : 1;
  const bis =
    anzahl >= 2
      ? new Date(heute.getFullYear(), heute.getMonth() + 1, 0)
      : new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() + ruheTage);
  return { stummBis: tagAus(bis), stummMonat: monat, stummAnzahl: anzahl };
}
