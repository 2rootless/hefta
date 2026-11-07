import { APP_NAME } from '../app/name';
import katalogRoh from '../../data/regelkatalog.de.json';
import { bewerten, type Bewertung, type Fristen } from './fristen';
import { vollstaendig, type HaushaltsAngaben } from './selbstauskunft';
import type {
  AusbildungArt,
  Bezeichnung,
  DateiVersion,
  Dokument,
  Lebenssituation,
  Person,
  Rolle,
  Zugehoerigkeit,
} from './modell';

// Auswertung des Regelkatalogs (data/regelkatalog.de.json). Welche Unterlage für wen, mit welchem
// Etikett und in welcher Reihenfolge, steht ausschließlich dort; hier wird nur gelesen und gerechnet.

export type Etikett = 'ueblich' | 'kann_helfen' | 'meist_unnoetig';
/** Symbol einer Unterlage (B11, Liste für Code, Teil 3). */
export type Symbol =
  | 'selbstauskunft'
  | 'einkommen'
  | 'bonitaet'
  | 'buergschaft'
  | 'mietzahlungen'
  | 'empfehlung'
  | 'wbs'
  | 'ausweis'
  | 'datenkopie'
  | 'anschreiben'
  | 'weiteres';

export interface Dokumenttyp {
  id: string;
  text: string;
  textEinzeln?: string;
  textKurz?: string;
  kurz?: string;
  /** Ein Satz Hilfe im Rutsch, passend zur Unterlage (Prüfkatalog T7). */
  hilfe?: string;
  /** Hilfesatz in der Liste an andere (Version 2.0, Entwurf L2), wo `hilfe` nicht passt. */
  hilfeAndere?: string;
  symbol: Symbol;
  etikett: Etikett;
  schritt?: string;
  rollen?: Rolle[];
  situationen?: Lebenssituation[];
  serie?: { anzahl: number; einheit: string };
  datum?: 'abrechnungsmonat' | 'ausstellungsdatum';
  fristen?: Fristen;
  varianten?: { id: string; text: string }[];
  /** Je Variante eine eigene Fassung in der Mappe (z. B. BAföG-Bescheid und Unterhaltsnachweis). */
  jeVariante?: boolean;
  /** Abweichende Texte je nach Studium oder Ausbildung der Person. */
  jeArt?: Partial<
    Record<
      AusbildungArt,
      Partial<
        Pick<Dokumenttyp, 'text' | 'hilfe' | 'varianten' | 'wechselBraucht' | 'wechselBleibt'>
      >
    >
  >;
  alternative?: string;
  schwaerzenVorschlagen?: boolean;
  freierName?: boolean;
  ebene?: 'bewerbung';
  inAppErstellt?: boolean;
  spaeter?: boolean;
  reihenfolge: number;
  hinweis?: string;
  /** Inhalt des „Warum?“-Blatts (design/unterlage-warum-haushalt.md, WB1 bis WB3). */
  warumErlaubt?: string;
  warumUeblich?: string;
  warumGutZuWissen?: string[];
  /** Kein Vermieter kann das verlangen: im Blatt keine Marken für die Schritte. */
  nieVerlangbar?: boolean;
  /** Geht bei „Marktüblich“ mit, sobald hochgeladen; das Etikett bleibt, darum gilt es nie als fehlend. */
  marktueblichWennHochgeladen?: boolean;
  /** Artikel für „Danach fehlt der … wieder“; ohne Angabe „der“. */
  artikel?: string;
  /** Wörter, die zeigen, dass vermutlich die falsche Unterlage hier liegt (PH-h). */
  erkennen?: {
    /** Steht eins davon da, hat die Auskunft einen Prüfcode (design/zeit-und-dateien.md). */
    pruefcode?: string[];
    /** Steht eins davon da, ist es die richtige Unterlage, auch wenn sie das andere Wort erwähnt. */
    passt?: string[];
    passtNicht: { woerter: string[]; anzeige: string; hinweis: string }[];
    /** Auf dem Dokument steht normalerweise der Name der Person. */
    nameErwartet?: boolean;
    /**
     * Mehrere Seiten: Vorgewählt ist nur, was ein Wort enthält, das manche Seiten haben und andere
     * nicht (die Wörter der Reihe nach). Bei der SCHUFA ist das das Zertifikat, nicht das Blatt für dich.
     */
    nurSeitenMit?: { woerter: string[]; hinweis: string };
    /** Welche Variante es ist, nach den Wörtern im Dokument; stehen mehrere da, `beide`. */
    varianten?: { wenn: Record<string, string[]>; beide?: string };
  };
  /** Der Name steht in der Mehrzahl („Mietzahlungen“): Die Sätze über sie auch. */
  mehrzahl?: boolean;

  /** Wenn sich die Lebenslage ändert (HA2): „… braucht Lea dann …“ und was mit dem Alten geschieht. */
  wechselBraucht?: string;
  wechselBleibt?: string;
}

interface RollenText {
  text: string;
  textWeiblich?: string;
  textNeutral?: string;
}

const katalogDaten = JSON.parse(
  JSON.stringify(katalogRoh).replaceAll('{app}', APP_NAME),
) as typeof katalogRoh;

const katalog = katalogDaten as unknown as {
  stand: string;
  rollen: Record<string, RollenText>;
  lebenssituationen: Record<Lebenssituation, { text: string }>;
  etiketten: Record<Etikett, { text: string; beschreibung: string }>;
  dokumenttypen: Dokumenttyp[];
  schritte: { id: string; text: string; kurz?: string }[];
  grundlage: { titel: string; version?: string; stand?: string; url: string }[];
};

export const KATALOG_STAND = katalog.stand;
export const LEBENSSITUATIONEN = Object.keys(katalog.lebenssituationen) as Lebenssituation[];

export function situationText(situation: Lebenssituation, art?: AusbildungArt | null): string {
  if (situation === 'studierend_azubi' && art)
    return katalogDaten.lebenssituationen.studierend_azubi.arten[art].text;
  return katalog.lebenssituationen[situation].text;
}

/** Auswahl im Formular: Studium und Ausbildung als eigene Einträge. */
export interface SituationOption {
  situation: Lebenssituation;
  art: AusbildungArt | null;
  wert: string;
  text: string;
}

export function situationOptionen(): SituationOption[] {
  return LEBENSSITUATIONEN.flatMap((situation): SituationOption[] =>
    situation === 'studierend_azubi'
      ? (['studium', 'ausbildung'] as const).map((art) => ({
          situation,
          art,
          wert: `${situation}:${art}`,
          text: situationText(situation, art),
        }))
      : [{ situation, art: null, wert: situation, text: situationText(situation) }],
  );
}

export function etikettText(etikett: Etikett): string {
  return katalog.etiketten[etikett].text;
}

export function etikettBeschreibung(etikett: Etikett): string {
  return katalog.etiketten[etikett].beschreibung;
}

/** Rollenbezeichnung in der gewünschten Form, z. B. „Mitmieterin“. */
export function rollenText(rolle: Rolle, bezeichnung: Bezeichnung): string {
  const r = katalog.rollen[rolle]!;
  if (bezeichnung === 'weiblich') return r.textWeiblich ?? r.text;
  if (bezeichnung === 'neutral') return r.textNeutral ?? r.text;
  return r.text;
}

export function dokumenttyp(id: string): Dokumenttyp | undefined {
  return katalog.dokumenttypen.find((d) => d.id === id);
}

/**
 * Unterlagen, die zu einer Person mit dieser Rolle und Lebenssituation passen, nach Katalog-Reihenfolge.
 * Ohne Lebenssituation fehlen die Einkommensnachweise, weil unklar ist, welcher passt.
 * Unterlagen der Bewerbung (Anschreiben, WBS) und spätere Funktionen gehören nicht zur Person.
 */
export function unterlagenFuer(
  rolle: Rolle,
  situation: Lebenssituation | null,
  art?: AusbildungArt | null,
): Dokumenttyp[] {
  return (katalog.dokumenttypen as Dokumenttyp[])
    .filter((d) => d.ebene !== 'bewerbung' && !d.spaeter)
    .filter((d) => d.rollen?.includes(rolle))
    .filter((d) => !d.situationen || (situation !== null && d.situationen.includes(situation)))
    .sort((a, b) => a.reihenfolge - b.reihenfolge)
    .map((d) => (art && d.jeArt?.[art] ? { ...d, ...d.jeArt[art] } : d));
}

export type Status = 'da' | 'bald' | 'fehlt' | 'optional';

export interface UnterlagenStand extends Bewertung {
  typ: Dokumenttyp;
  status: Status;
  /** Das gespeicherte Dokument dieser Person für diesen Typ, falls es eins gibt. */
  dokument: Dokument | null;
  /** Alle Versionen, neueste zuletzt. */
  versionen: DateiVersion[];
}

/** Stand einer Unterlage aus ihren Versionen und den Fristen des Katalogs. */
export function unterlagenStand(
  typ: Dokumenttyp,
  dokument: Dokument | null,
  versionen: DateiVersion[],
  person: Pick<Person, 'abrechnungMeist'>,
  heute: Date = new Date(),
): UnterlagenStand {
  const sortiert = [...versionen].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const bewertung = bewerten(typ, sortiert, {
    heute,
    abrechnungMeist: person.abrechnungMeist,
    stummBis: dokument?.stummBis ?? null,
  });
  return { ...bewertung, typ, dokument, versionen: sortiert };
}

export interface PersonStand {
  person: Person;
  rolle: Rolle;
  /** Aus der Zugehörigkeit: gilt nur in diesem Haushalt. */
  farbe: number;
  bezeichnung: Bezeichnung;
  unterlagen: UnterlagenStand[];
  /** Was auf dem Pfad liegt: übliche Unterlagen und vorhandene freiwillige. */
  pfad: UnterlagenStand[];
  /** Die dringendste Unterlage oder null, wenn alles da ist. */
  naechster: UnterlagenStand | null;
  /** Gespeichert, aber zu Rolle oder Lebenslage nicht mehr passend: bleibt, kommt nicht in die Mappe. */
  nichtMehrNoetig: UnterlagenStand[];
}

const DRINGLICHKEIT: Record<Status, number> = { fehlt: 0, bald: 1, da: 2, optional: 3 };

export function personStand(
  person: Person,
  platz: Rolle | Pick<Zugehoerigkeit, 'rolle' | 'farbe' | 'bezeichnung'>,
  dokumente: Dokument[],
  versionen: DateiVersion[],
  heute: Date = new Date(),
  /** Haustiere und Ort des Haushalts (Selbstauskunft); ohne Angabe aus älteren Daten der Person. */
  hh?: HaushaltsAngaben,
): PersonStand {
  const { rolle, farbe, bezeichnung } =
    typeof platz === 'string' ? { rolle: platz, farbe: 1, bezeichnung: 'neutral' as const } : platz;
  const unterlagen = unterlagenFuer(rolle, person.lebenssituation, person.ausbildungArt).map(
    (typ) => {
      const dokument = dokumente.find((d) => d.personId === person.id && d.typ === typ.id) ?? null;
      const eigene = dokument ? versionen.filter((v) => v.dokumentId === dokument.id) : [];
      const stand: UnterlagenStand = unterlagenStand(typ, dokument, eigene, person, heute);
      // In der App erstellt (Selbstauskunft): da, sobald alle Angaben beisammen sind.
      if (typ.inAppErstellt) {
        const fertig = vollstaendig(person, rolle, hh);
        return {
          ...stand,
          status: fertig ? ('da' as const) : ('fehlt' as const),
          grund: fertig ? '' : 'Fehlt noch',
        };
      }
      return stand;
    },
  );
  const pfad = unterlagen.filter(
    (u) => u.typ.etikett === 'ueblich' || (u.typ.etikett === 'kann_helfen' && u.status === 'da'),
  );
  // Erst „fehlt“ vor „läuft bald ab“, dann Katalog-Reihenfolge (sort ist stabil).
  const offen = unterlagen
    .filter((u) => u.status === 'fehlt' || u.status === 'bald')
    .sort((a, b) => DRINGLICHKEIT[a.status] - DRINGLICHKEIT[b.status]);
  // Hefta löscht nie, was nicht mehr gebraucht wird (design/unterlage-warum-haushalt.md, Abschnitt 3).
  const nichtMehrNoetig = dokumente
    .filter((d) => d.personId === person.id && !unterlagen.some((u) => u.typ.id === d.typ))
    .flatMap((d) => {
      const typ = dokumenttyp(d.typ);
      const eigene = versionen.filter((v) => v.dokumentId === d.id);
      if (!typ || typ.ebene === 'bewerbung' || !eigene.length) return [];
      return [unterlagenStand(typ, d, eigene, person, heute)];
    })
    .sort((a, b) => a.typ.reihenfolge - b.typ.reihenfolge);
  return {
    person,
    rolle,
    farbe,
    bezeichnung,
    unterlagen,
    pfad,
    naechster: offen[0] ?? null,
    nichtMehrNoetig,
  };
}

/** Inhalt des „Warum?“-Blatts; null, wenn der Katalog für diese Unterlage keinen hat. */
export interface WarumInhalt {
  titel: string;
  etikett: string;
  erlaubt: string;
  ueblich: string;
  gutZuWissen: string[];
  /** Die drei Bewerbungsschritte; leer, wenn die Unterlage nie verlangt werden kann. */
  schritte: { id: string; text: string; erlaubt: boolean }[];
  quelle: { titel: string; url: string };
  stand: string;
}

const MONAT_JAHR = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });

export function warumInhalt(typ: Dokumenttyp): WarumInhalt | null {
  if (!typ.warumErlaubt || !typ.warumUeblich) return null;
  const ab = katalog.schritte.findIndex((s) => s.id === typ.schritt);
  const g = katalog.grundlage[0]!;
  const [jahr, monat] = (g.stand ?? '').split('-').map(Number) as [number, number];
  return {
    titel: listenText(typ),
    etikett: etikettText(typ.etikett),
    erlaubt: typ.warumErlaubt,
    ueblich: typ.warumUeblich,
    gutZuWissen: typ.warumGutZuWissen ?? [],
    schritte:
      ab < 0 || typ.nieVerlangbar
        ? []
        : katalog.schritte.map((s, i) => ({
            id: s.id,
            text: s.kurz ?? s.text,
            erlaubt: i >= ab,
          })),
    quelle: {
      titel: `${g.titel}, Version ${g.version}, ${MONAT_JAHR.format(new Date(jahr, monat - 1, 1))}`,
      url: g.url,
    },
    stand: katalog.stand,
  };
}

/** HA2: Was sich an den Unterlagen ändert, wenn sich die Lebenslage ändert. Null, wenn nichts. */
export function einkommenWechsel(
  rolle: Rolle,
  alt: { lebenssituation: Lebenssituation | null; ausbildungArt?: AusbildungArt | null },
  neu: { lebenssituation: Lebenssituation | null; ausbildungArt?: AusbildungArt | null },
  gespeicherteTypen: string[],
): { statt: string; braucht: string; bleibt: string | null } | null {
  const einkommen = (l: typeof alt) =>
    unterlagenFuer(rolle, l.lebenssituation, l.ausbildungArt).find((d) => d.situationen);
  const vorher = einkommen(alt);
  const danach = einkommen(neu);
  if (!vorher || !danach || vorher.id === danach.id || !danach.wechselBraucht) return null;
  return {
    statt: listenText(vorher),
    braucht: danach.wechselBraucht,
    bleibt: gespeicherteTypen.includes(vorher.id) ? (vorher.wechselBleibt ?? null) : null,
  };
}

/** Wie viele Dinge im ganzen Haushalt noch offen sind (fehlt oder läuft bald ab). */
export function offeneDinge(staende: PersonStand[]): number {
  return staende.reduce(
    (summe, s) =>
      summe + s.unterlagen.filter((u) => u.status === 'fehlt' || u.status === 'bald').length,
    0,
  );
}

/** Name der Unterlage für das Eintragen-Feld: Einzahl oder Kurzform, wo es eine gibt. */
export function eintragenText(typ: Dokumenttyp): string {
  return typ.textEinzeln ?? typ.textKurz ?? typ.text;
}

/** Name der Unterlage in Listen: Kurzform, wo es eine gibt. */
export function listenText(typ: Dokumenttyp): string {
  return typ.textKurz ?? typ.text;
}

/**
 * Text ohne weiche Trennstellen, z. B. für Vorlesen, Suchen und das PDF.
 * Die Trennstellen (U+00AD) stehen im Regelkatalog (design/uebersicht-kompakt.md).
 */
export function ohneTrennstellen(text: string): string {
  return text.replaceAll('­', '');
}
