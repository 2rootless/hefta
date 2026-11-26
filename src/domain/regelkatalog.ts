import { APP_NAME } from '../app/name';
import katalogRoh from '../../data/regelkatalog.de.json';
import { bewerten, erwarteterMonat, type Bewertung, type Fristen } from './fristen';
import { vollstaendig, type HaushaltsAngaben } from './selbstauskunft';
import { wirksameLagen, type LageAngabe } from './lagen';
export { lagenVon, wirksameLagen, type LageAngabe } from './lagen';
import type {
  AusbildungArt,
  Bezeichnung,
  DateiVersion,
  Dokument,
  Lebenssituation,
  Person,
  BonitaetAngabe,
  Rolle,
  Tag,
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
  /** DP49 Punkt 6 (B3): Satz im Kopf des Rutschs, wenn die Person bürgt; `{buerge}` nach der Karte. */
  hilfeBuerge?: string;
  symbol: Symbol;
  etikett: Etikett;
  schritt?: string;
  rollen?: Rolle[];
  /** Gehört zur Zugehörigkeit, nicht zur Person: gilt nur im eigenen Haushalt (E53, Bürgschaft). */
  jeHaushalt?: boolean;
  /**
   * Gilt je Wohnung und ist freiwillig (DP49 Punkt 5, Bürgschaftserklärung): kein Schritt im Rutsch, zählt
   * nicht in „{x} von {y} da“, steht nicht auf der Haarlinie und fehlt nie. Welche Fassung zu welchem Heft
   * gehört, sagt `DateiVersion.heftId`.
   */
  jeWohnung?: boolean;
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
  /**
   * DP45 G3: Teil einer anderen Unterlage, keine eigene Zeile. Der Arbeitsvertrag gehört bei „Neu im Job“
   * zu den Gehaltsnachweisen; er steht als `zusatz` an deren Stand und geht mit in die Mappe.
   */
  teilVon?: string;
  /**
   * DP47 G5 (L4): abgeleiteter Typ für die zweite Reihe desselben Nachweises, etwa `gehaltsnachweis2` beim
   * zweiten Arbeitgeber. Hier steht der Grundtyp; Texte, Fristen und Etiketten kommen von ihm.
   */
  basis?: string;
  schwaerzenVorschlagen?: boolean;
  freierName?: boolean;
  /**
   * Nicht an der Person: `bewerbung` gehört zum Heft (Anschreiben), `haushalt` zum ganzen Haushalt und
   * kommt in jedes Heft, in dem es zählt (DP45 G1, W28).
   */
  ebene?: 'bewerbung' | 'haushalt';
  inAppErstellt?: boolean;
  spaeter?: boolean;
  reihenfolge: number;
  hinweis?: string;
  /**
   * PC207, 1 (E379, E380): Kommt nie in eine Mappe und wird nicht mehr angeboten (Ausweiskopie, SCHUFA-Datenkopie). Was
   * schon abgelegt ist, bleibt beim Nutzer; die Unterlage sagt mit `nieInMappeSatz`, warum.
   */
  nieInMappe?: boolean;
  nieInMappeSatz?: string;
  nieInMappeSatzDu?: string;
  /** Inhalt des „Warum?“-Blatts (design/unterlage-warum-haushalt.md, WB1 bis WB3). */
  warumErlaubt?: string;
  warumUeblich?: string;
  warumGutZuWissen?: string[];
  /** DP33, Fehler 4: dieselben Texte mit „ihr“; fehlt eine, gilt die Fassung oben (sie sagt kein „du“). */
  warumErlaubtIhr?: string;
  warumUeblichIhr?: string;
  warumGutZuWissenIhr?: string[];
  /**
   * PC81 B12 (QA14): je Satz unter „Gut zu wissen“ eine eigene Quelle, wo die Orientierungshilfe ihn nicht trägt
   * (gleiche Reihenfolge wie die Sätze; null: keine eigene).
   */
  warumGutZuWissenQuellen?: (string | null)[];
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

/**
 * Satz im Kopf einer Unterlage (W30). Bei Bürgen der eigene Satz, wenn der Katalog einen hat (DP49 Punkt 6):
 * „… so viel wert, wie die Bürgin zahlen kann.“ Neutral steht der Name.
 */
export function hilfeFuer(
  typ: Pick<Dokumenttyp, 'hilfe' | 'hilfeBuerge'>,
  rolle: Rolle,
  bezeichnung: Bezeichnung,
  name: string,
): string {
  if (rolle !== 'buerge' || !typ.hilfeBuerge) return typ.hilfe ?? '';
  // PC205 (E363): immer mit Namen, nie „die Bürgin“ oder „der Bürge“; die Form bleibt den Daten.
  void bezeichnung;
  return typ.hilfeBuerge.replace('{buerge}', name);
}

/**
 * PC208 (CP121, 2): Für Bürgen gibt es keine Wahl der Form mehr; alle Sätze nehmen den Namen wie bei „neutral“.
 * Die frühere Wahl bleibt in den Daten, wirkt aber nirgends mehr.
 */
export function formImText(rolle: Rolle, bezeichnung: Bezeichnung): Bezeichnung {
  return rolle === 'buerge' ? 'neutral' : bezeichnung;
}

/** Rollenbezeichnung in der gewünschten Form, z. B. „Mitmieterin“. */
/**
 * PC202 (H1, E363): Die Rolle, wie die App sie unter einem Namen zeigt: „Im Mietvertrag“ oder „Bürgt“, ohne Form
 * nach Geschlecht (W57, PC208).
 */
export function rollenAnzeige(rolle: Rolle): string {
  const r = katalog.rollen[rolle]!;
  const text = r.textNeutral ?? r.text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function rollenText(rolle: Rolle, gewaehlt: Bezeichnung): string {
  const r = katalog.rollen[rolle]!;
  const bezeichnung = formImText(rolle, gewaehlt);
  if (bezeichnung === 'weiblich') return r.textWeiblich ?? r.text;
  if (bezeichnung === 'neutral') return r.textNeutral ?? r.text;
  return r.text;
}

/** Alle Dokumenttypen des Katalogs, etwa für die Umstellung von „Datensparsam“ (E49). */
export const DOKUMENTTYPEN: readonly Dokumenttyp[] = katalog.dokumenttypen;

export function dokumenttyp(id: string): Dokumenttyp | undefined {
  const typ = katalog.dokumenttypen.find((d) => d.id === id);
  if (typ) return typ;
  // DP47 G5 (L4): „gehaltsnachweis2“ ist die zweite Reihe Gehaltsnachweise (zweiter Arbeitgeber).
  const m = /^([a-z_]+?)([2-9])$/.exec(id);
  const basis = m ? (katalog.dokumenttypen as Dokumenttyp[]).find((d) => d.id === m[1]) : undefined;
  return basis?.situationen ? { ...basis, id, basis: basis.id } : undefined;
}

/** Der Grundtyp: für abgeleitete Reihen (L4) der Typ aus dem Katalog, sonst die Kennung selbst. */
export function basisId(typ: Pick<Dokumenttyp, 'id' | 'basis'>): string {
  return typ.basis ?? typ.id;
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
    .filter((d) => !d.ebene && !d.spaeter && !d.teilVon)
    .filter((d) => d.rollen?.includes(rolle))
    .filter((d) => !d.situationen || (situation !== null && d.situationen.includes(situation)))
    .sort((a, b) => a.reihenfolge - b.reihenfolge)
    .map((d) => (art && d.jeArt?.[art] ? { ...d, ...d.jeArt[art] } : d));
}

/**
 * DP47 G5: Unterlagen aus allen Lagen, jede nur einmal. Reihenfolge: Bürgschaftserklärung (Bürgen),
 * Selbstauskunft, die Einkommensnachweise in der Reihenfolge der Lagen, Bonitätsnachweis, der Rest.
 */
export function unterlagenFuerPerson(
  rolle: Rolle,
  person: Pick<
    Person,
    'lebenssituation' | 'ausbildungArt' | 'weitereLagen' | 'einkommenTrotzdem' | 'arbeitgeber'
  >,
): { typ: Dokumenttyp; lage: LageAngabe | null }[] {
  const lagen = wirksameLagen(person);
  if (!lagen.length) return unterlagenFuer(rolle, null).map((typ) => ({ typ, lage: null }));
  const liste: { typ: Dokumenttyp; lage: LageAngabe | null; rang: number }[] = [];
  lagen.forEach((lage, i) => {
    for (const grund of unterlagenFuer(rolle, lage.situation, lage.art)) {
      let typ = grund;
      if (liste.some((x) => x.typ.id === typ.id)) {
        // L4: Zweimal angestellt gibt eine zweite Reihe Gehaltsnachweise, mit eigenen Dokumenten.
        if (lage.situation !== 'angestellt' || !grund.situationen) continue;
        const n = liste.filter((x) => basisId(x.typ) === grund.id).length + 1;
        typ = dokumenttyp(`${grund.id}${n}`) ?? grund;
        if (typ === grund) continue;
      }
      const einkommen = !!typ.situationen;
      liste.push({
        typ,
        lage: einkommen ? lage : null,
        // Einkommensnachweise stehen an ihrem Platz im Katalog, untereinander nach den Lagen.
        rang: einkommen ? typ.reihenfolge + i / 100 : typ.reihenfolge,
      });
    }
  });
  return liste.sort((a, b) => a.rang - b.rang).map(({ typ, lage }) => ({ typ, lage }));
}

export type Status = 'da' | 'bald' | 'fehlt' | 'optional';

export interface UnterlagenStand extends Bewertung {
  typ: Dokumenttyp;
  status: Status;
  /** Das gespeicherte Dokument dieser Person für diesen Typ, falls es eins gibt. */
  dokument: Dokument | null;
  /** Alle Versionen, neueste zuletzt. */
  versionen: DateiVersion[];
  /**
   * DP47 G5: die Lebenslage, zu der dieser Einkommensnachweis gehört. Nur gesetzt, wenn die Person mehr als
   * eine Lage hat; dann steht sie vorn in der kleinen Zeile.
   */
  lage?: LageAngabe;
  /** DP45 G3: Teil dieser Unterlage mit eigenem Dokument, etwa der Arbeitsvertrag bei „Neu im Job“. */
  zusatz?: UnterlagenStand | null;
  /** DP45 G3: „Neu im Job“ seit diesem Tag; Abrechnungen zählen erst ab diesem Monat. */
  neuSeit?: Tag | null;
  /**
   * DP45 G4: „Ich bekomme noch keinen“. Zählt weder als da noch als offen, steht nicht auf der Haarlinie
   * und als Zeile ohne Seitenzahl in der Mappe.
   */
  keinerMoeglich?: BonitaetAngabe | null;
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

/** Monate von `a` bis `b` („JJJJ-MM“), negativ, wenn `b` vor `a` liegt. */
function monateVon(a: string, b: string): number {
  const [ja, ma] = a.split('-').map(Number) as [number, number];
  const [jb, mb] = b.split('-').map(Number) as [number, number];
  return (jb - ja) * 12 + (mb - ma);
}

/**
 * DP45 G3: Gehaltsnachweise bei „Neu im Job“. Es zählen nur Monate ab dem Anfang, die heute schon
 * abgerechnet sein können; nach früheren fragt Hefta nicht. Dazu gehört der Arbeitsvertrag (oder eine
 * Bestätigung des Arbeitgebers) als Zusatz; fehlt er, sind die Gehaltsnachweise noch nicht vollständig.
 */
function neuImJobStand(
  stand: UnterlagenStand,
  person: Person,
  dokumente: Dokument[],
  versionen: DateiVersion[],
  heute: Date,
): UnterlagenStand {
  const seit = person.neuImJob?.seit ?? null;
  const typVertrag = dokumenttyp('arbeitsvertrag');
  const dokVertrag =
    dokumente.find((d) => d.personId === person.id && d.typ === 'arbeitsvertrag') ?? null;
  const zusatz = typVertrag
    ? unterlagenStand(
        typVertrag,
        dokVertrag,
        dokVertrag ? versionen.filter((v) => v.dokumentId === dokVertrag.id) : [],
        person,
        heute,
      )
    : null;
  let s = stand;
  const serie = stand.typ.serie;
  if (seit && serie) {
    const erwartet = erwarteterMonat(heute, person.abrechnungMeist);
    const anzahl = Math.min(serie.anzahl, Math.max(0, monateVon(seit.slice(0, 7), erwartet) + 1));
    if (anzahl === 0) s = { ...stand, status: 'da', grund: '', fehlend: [], veraltet: false };
    else if (anzahl < serie.anzahl)
      s = {
        ...unterlagenStand(
          { ...stand.typ, serie: { ...serie, anzahl } },
          stand.dokument,
          stand.versionen,
          person,
          heute,
        ),
        typ: stand.typ,
      };
  }
  // Ohne „Neu im Job“ ist der Vertrag freiwillig (etwa statt eines Bonitätsnachweises, G4): Er geht mit,
  // sobald er da ist, fehlt aber nie.
  if (!person.neuImJob) return { ...stand, zusatz };
  if (zusatz && !zusatz.versionen.length && s.status !== 'fehlt')
    s = { ...s, status: 'fehlt', grund: 'Fehlt noch' };
  return { ...s, zusatz, neuSeit: seit };
}

/**
 * Die Zeilen der Person: was auf dem Pfad liegt, dazu an seiner Stelle der Bonitätsnachweis mit „noch
 * keiner möglich“ (G4), der dort steht, aber nicht zählt.
 */
export function personZeilen(stand: PersonStand): UnterlagenStand[] {
  return stand.unterlagen.filter((u) => stand.pfad.includes(u) || u.keinerMoeglich);
}

/**
 * Die Zeile unter dem Namen auf dem Deckblatt nach der Rolle: Beruf oder Tätigkeit (DP47 G5).
 * - Bei mehreren Lagen der Beruf der ersten, sonst der einer weiteren (L5: kein „Im Studium“, wenn ein
 *   Beruf da ist).
 * - Danach „auch …“ mit jeder Lage, aus der der Beruf nicht stammt (PC62 K1): „Kellnerin, auch im
 *   Studium“, nie „Kellnerin, auch angestellt“.
 * - Steht nur das Amt im Bogen (K5), nennt sie keine andere Lage und keinen Beruf daraus.
 */
export function deckTaetigkeit(
  person: Pick<
    Person,
    | 'lebenssituation'
    | 'ausbildungArt'
    | 'weitereLagen'
    | 'einkommenTrotzdem'
    | 'arbeitgeber'
    | 'beruf'
  >,
): string {
  const lagen = wirksameLagen(person);
  const ersteWirkt = !lagen.length || lagen.some((l) => l.lageId === null);
  const berufVon = (l: { lageId: string | null }) =>
    (l.lageId
      ? (person.weitereLagen?.find((x) => x.id === l.lageId)?.beruf ?? '')
      : ersteWirkt
        ? person.beruf
        : ''
    ).trim();
  // Woher der Beruf kommt: die erste Lage mit Beruf; ohne Beruf die Tätigkeit der ersten (Studium).
  const quelle = lagen.find((l) => berufVon(l)) ?? null;
  const taetigkeit = quelle
    ? berufVon(quelle)
    : ersteWirkt && person.lebenssituation === 'studierend_azubi' && person.ausbildungArt
      ? situationText(person.lebenssituation, person.ausbildungArt)
      : '';
  // Hinter „auch“ nie die Lage, aus der der Beruf kommt; ohne Beruf nie die erste.
  const ohneQuelle = quelle ?? lagen.find((l) => l.lageId === null);
  const auch = lagen
    .filter((l) => l !== ohneQuelle)
    .map((l) => {
      const text = situationText(l.situation, l.art);
      return l.situation === 'leistungsbezug' ? text : text.charAt(0).toLowerCase() + text.slice(1);
    });
  return [taetigkeit, auch.length ? `auch ${auch.join(' und ')}` : ''].filter(Boolean).join(', ');
}

/** G3c: Liegt der Anfang mehr als drei Monate zurück? Dann schlägt Hefta „Länger als drei Monate“ vor. */
export function neuImJobLange(person: Pick<Person, 'neuImJob'>, heute: Date): boolean {
  const seit = person.neuImJob?.seit;
  if (!seit) return false;
  const [j, m, d] = seit.split('-').map(Number) as [number, number, number];
  return (
    new Date(j, m - 1 + 3, d) < new Date(heute.getFullYear(), heute.getMonth(), heute.getDate())
  );
}

/** Eine Unterlage der Person, auch als Zusatz (G3) oder „nicht mehr nötig“. */
export function standFinden(stand: PersonStand | null, typId: string): UnterlagenStand | null {
  if (!stand) return null;
  return (
    stand.unterlagen.find((u) => u.typ.id === typId) ??
    stand.unterlagen.map((u) => u.zusatz).find((z) => z?.typ.id === typId) ??
    stand.nichtMehrNoetig.find((u) => u.typ.id === typId) ??
    null
  );
}

export function personStand(
  person: Person,
  platz: Rolle | Pick<Zugehoerigkeit, 'rolle' | 'farbe' | 'bezeichnung'>,
  dokumente: Dokument[],
  versionen: DateiVersion[],
  heute: Date = new Date(),
  /** Haustiere und Ort des Haushalts (Selbstauskunft); ohne Angabe aus älteren Daten der Person. */
  hh?: HaushaltsAngaben,
): PersonStand {
  const {
    rolle,
    farbe,
    bezeichnung: gewaehlt,
  } = typeof platz === 'string'
    ? { rolle: platz, farbe: 1, bezeichnung: 'neutral' as const }
    : platz;
  const bezeichnung = formImText(rolle, gewaehlt);
  const mehrereLagen = wirksameLagen(person).length > 1;
  const liste = unterlagenFuerPerson(rolle, person);
  const unterlagen = liste
    .map(({ typ }) => {
      const dokument = dokumente.find((d) => d.personId === person.id && d.typ === typ.id) ?? null;
      const eigene = dokument ? versionen.filter((v) => v.dokumentId === dokument.id) : [];
      const stand: UnterlagenStand = unterlagenStand(typ, dokument, eigene, person, heute);
      // DP49 Punkt 5: Freiwillig und je Wohnung; fehlt nie, auch wenn das Etikett „Üblich“ sagt.
      if (typ.jeWohnung)
        return {
          ...stand,
          status: eigene.length ? ('da' as const) : ('optional' as const),
          grund: eigene.length ? stand.grund : '',
        };
      // In der App erstellt (Selbstauskunft): da, sobald alle Angaben beisammen sind.
      if (typ.inAppErstellt) {
        const fertig = vollstaendig(person, rolle, hh);
        return {
          ...stand,
          status: fertig ? ('da' as const) : ('fehlt' as const),
          grund: fertig ? '' : 'Fehlt noch',
        };
      }
      if (typ.id === 'gehaltsnachweis')
        return neuImJobStand(stand, person, dokumente, versionen, heute);
      // DP45 G4: „Ich bekomme noch keinen“: weder da noch offen.
      if (dokument?.bonitaet?.art === 'keiner')
        return {
          ...stand,
          status: 'optional' as const,
          grund: '',
          keinerMoeglich: dokument.bonitaet,
        };
      return stand;
    })
    .map((u, i) => {
      // Mehr als eine Lage: Der Einkommensnachweis sagt vorn, zu welcher Lage er gehört.
      const lage = liste[i]?.lage;
      return mehrereLagen && lage ? { ...u, lage } : u;
    });
  const pfad = unterlagen.filter(
    (u) =>
      !u.typ.jeWohnung &&
      !u.keinerMoeglich &&
      (u.typ.etikett === 'ueblich' || (u.typ.etikett === 'kann_helfen' && u.status === 'da')),
  );
  // Erst „fehlt“ vor „läuft bald ab“, dann Katalog-Reihenfolge (sort ist stabil).
  const offen = unterlagen
    .filter((u) => u.status === 'fehlt' || u.status === 'bald')
    .sort((a, b) => DRINGLICHKEIT[a.status] - DRINGLICHKEIT[b.status]);
  // Hefta löscht nie, was nicht mehr gebraucht wird (design/unterlage-warum-haushalt.md, Abschnitt 3).
  const nichtMehrNoetig = dokumente
    .filter(
      (d) =>
        d.personId === person.id &&
        !unterlagen.some((u) => u.typ.id === d.typ || u.zusatz?.typ.id === d.typ),
    )
    .flatMap((d) => {
      const typ = dokumenttyp(d.typ);
      const eigene = versionen.filter((v) => v.dokumentId === d.id);
      if (!typ || typ.ebene || !eigene.length) return [];
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
  /** Je Satz die eigene Quelle oder null (PC81 B12). */
  gutZuWissenQuellen: (string | null)[];
  /** Die drei Bewerbungsschritte; leer, wenn die Unterlage nie verlangt werden kann. */
  schritte: { id: string; text: string; erlaubt: boolean }[];
  quelle: { titel: string; url: string };
  stand: string;
}

const MONAT_JAHR = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });

/** Inhalt des Warum-Blatts; die Anrede folgt dem Haushalt (allein „du“, sonst „ihr“, DP33). */
export function warumInhalt(typ: Dokumenttyp, an: 'ihr' | 'du' = 'du'): WarumInhalt | null {
  if (!typ.warumErlaubt || !typ.warumUeblich) return null;
  const ab = katalog.schritte.findIndex((s) => s.id === typ.schritt);
  const g = katalog.grundlage[0]!;
  const [jahr, monat] = (g.stand ?? '').split('-').map(Number) as [number, number];
  return {
    titel: listenText(typ),
    etikett: etikettText(typ.etikett),
    erlaubt: (an === 'ihr' && typ.warumErlaubtIhr) || typ.warumErlaubt,
    ueblich: (an === 'ihr' && typ.warumUeblichIhr) || typ.warumUeblich,
    gutZuWissen: (an === 'ihr' && typ.warumGutZuWissenIhr) || typ.warumGutZuWissen || [],
    gutZuWissenQuellen: typ.warumGutZuWissenQuellen ?? [],
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
