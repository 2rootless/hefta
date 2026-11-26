import katalogDaten from '../../data/regelkatalog.de.json' with { type: 'json' };
import { telefonFuerMappe } from './telefon';
import type { AusbildungArt, Haushalt, Lebenssituation, Person, Rolle } from './modell';
import { wirksameLagen, type LageAngabe } from './lagen';
import { nameImPdf, nameText } from './namen';
import { anschriftText } from '../formblatt/anschrift';
import { fehlendeFelder, teilStand, type FormFeld, type Formular } from '../formblatt/formblatt';

// Selbstauskunft (docs/04-regeln-und-hinweise.md, DSK-Muster; Meilenstein M4). Gefragt wird nur, was
// der Regelkatalog unter „selbstauskunftFelder“ führt; „nieAbfragen“ gibt es hier nicht.
// Name, Kontakt, Beruf, Arbeitgeber und Nettoeinkommen stehen an der Person, die Antworten auf die
// übrigen Fragen in `person.selbstauskunft`. Das PDF entsteht beim Export aus diesen Angaben.

export type JaNein = 'ja' | 'nein' | null;
export type Schritt = 'besichtigung' | 'will_wohnung' | 'zusage';

export interface Selbstauskunft {
  /** Nettoeinkommen als genauer Betrag oder als Bestätigung „mindestens“. */
  einkommenArt: 'betrag' | 'mindestens';
  haustiere: JaNein;
  haustiereText: string;
  insolvenz: JaNein;
  raeumungstitel: JaNein;
  /**
   * Bis 2.2 eine Frage für Musterbogen C.4 bis C.6 zusammen. Seit 2.3 (PC207, 2) stehen die drei getrennt darunter;
   * hier steht dann ihre Zusammenfassung (Ja, sobald eine Ja ist; Nein, wenn alle Nein sind; sonst offen), damit
   * ältere Leser und Stellen wie „Frage offen nach der Zusage“ weiter stimmen.
   */
  mietrueckstaende: JaNein;
  /** C.4: zwei aufeinanderfolgende Monate mehr als eine Monatsmiete. */
  rueckstandMonate?: JaNein;
  /** C.5: in mehr als zwei Monaten mindestens zwei Monatsmieten. */
  rueckstandMieten?: JaNein;
  /** C.6: letztes Mietverhältnis wegen erheblicher Pflichtverletzung gekündigt. */
  kuendigung?: JaNein;
  /** C.6, „Wenn ja, um welche Pflichtverletzung handelte es sich?“ */
  kuendigungWelche?: string;
  /**
   * PC65: „Nach der Zusage beantworten“ gewählt. Gleichrangig mit Ja und Nein, keine Wahl ist vorgegeben.
   * In der Mappe steht dann wie bei einer unbeantworteten Frage „Beantworte ich nach der Zusage“.
   */
  mietrueckstaendeSpaeter?: boolean;
  /** C.7: freiwillige Gründe, warum es nicht erneut zu erwarten ist, wenn eine Frage aus C.4 bis C.6 Ja ist. */
  stellungnahme: string;
  /** Dasselbe bei Insolvenz und Räumungstitel (Entwurf A3); fehlt in älteren Daten. */
  erklaerungInsolvenz?: string;
  erklaerungRaeumungstitel?: string;
  /** Ort für „Ort, Datum“ unten im PDF. */
  ort: string;
}

/**
 * Längste Erläuterung zu einem Ja (Nachricht 10.11. k): So passt jeder Abschnitt der Selbstauskunft auf
 * eine Seite, und keiner wird geteilt (B14). Ab `ERLAEUTERUNG_ZAEHLER_AB` steht ein ruhiger Zähler darunter.
 */
export const ERLAEUTERUNG_MAX = 600;
export const ERLAEUTERUNG_ZAEHLER_AB = 500;

/** Die zwei Ja/Nein-Fragen aus Teil B des Musterbogens und wo die Erklärung zu ihrem Ja steht. */
export const ERKLAERUNG = {
  insolvenz: 'erklaerungInsolvenz',
  raeumungstitel: 'erklaerungRaeumungstitel',
} as const;

/** Gespeichert fehlen die Felder aus PC207, 2 bei Daten bis 2.2; gelesen über selbstauskunftVon sind sie immer da. */
export type SelbstauskunftVoll = Selbstauskunft &
  Required<
    Pick<
      Selbstauskunft,
      'rueckstandMonate' | 'rueckstandMieten' | 'kuendigung' | 'kuendigungWelche'
    >
  >;

/** Die drei Fragen aus Teil C (C.4 bis C.6), erst kurz vor dem Vertrag (PC207, 2); C.7 ist `stellungnahme`. */
export const ZUSAGE_FRAGEN = ['rueckstandMonate', 'rueckstandMieten', 'kuendigung'] as const;
export type ZusageFrage = (typeof ZUSAGE_FRAGEN)[number];
/** Die Felder im Regelkatalog zu ZUSAGE_FRAGEN. */
export const ZUSAGE_KATALOG: Record<ZusageFrage, string> = {
  rueckstandMonate: 'rueckstand_monate',
  rueckstandMieten: 'rueckstand_mieten',
  kuendigung: 'kuendigung',
};

/** Zusammenfassung von C.4 bis C.6: Ja, sobald eine Ja ist; Nein, wenn alle Nein sind; sonst offen. */
export function zusageZusammen(sa: Pick<SelbstauskunftVoll, ZusageFrage>): JaNein {
  const werte = ZUSAGE_FRAGEN.map((f) => sa[f]);
  if (werte.includes('ja')) return 'ja';
  return werte.every((w) => w === 'nein') ? 'nein' : null;
}

/** Ist eine der Fragen aus Teil C noch offen? (Auch „Nach der Zusage beantworten“.) */
export function zusageOffen(person: Pick<Person, 'selbstauskunft'>): boolean {
  const sa = selbstauskunftVon(person);
  return ZUSAGE_FRAGEN.some((f) => sa[f] === null);
}

export interface SelbstauskunftFeld {
  id: string;
  text: string;
  pdfText: string;
  schritt: Schritt;
  bedingung?: string;
  entfaelltBei?: Lebenssituation[];
  nichtFuer?: Rolle[];
}

const katalog = katalogDaten as unknown as {
  selbstauskunftFelder: SelbstauskunftFeld[];
  nieAbfragen: string[];
};

export const SELBSTAUSKUNFT_FELDER = katalog.selbstauskunftFelder;
export const NIE_ABFRAGEN = katalog.nieAbfragen;
const SCHRITTE: Schritt[] = ['besichtigung', 'will_wohnung', 'zusage'];

export function leereSelbstauskunft(): SelbstauskunftVoll {
  return {
    einkommenArt: 'betrag',
    haustiere: null,
    haustiereText: '',
    insolvenz: null,
    raeumungstitel: null,
    mietrueckstaende: null,
    rueckstandMonate: null,
    rueckstandMieten: null,
    kuendigung: null,
    kuendigungWelche: '',
    stellungnahme: '',
    erklaerungInsolvenz: '',
    erklaerungRaeumungstitel: '',
    ort: '',
  };
}

/**
 * Die Selbstauskunft einer Person, mit allen Feldern. PC207, 2: Daten bis 2.2 haben C.4 bis C.6 nur als eine Antwort
 * (`mietrueckstaende`). Ein Nein dort galt für alle drei; es wird hier gelesen, nicht verschoben. Ein Ja lässt sich nicht
 * aufteilen: Dann sind die drei offen, und die Person beantwortet sie neu. Ihre Erklärung (`stellungnahme`) bleibt als
 * Gründe (C.7) stehen. Gelöscht wird nichts.
 */
export function selbstauskunftVon(person: Pick<Person, 'selbstauskunft'>): SelbstauskunftVoll {
  const gespeichert: Partial<Selbstauskunft> = person.selbstauskunft ?? {};
  const alt = gespeichert.rueckstandMonate === undefined && gespeichert.mietrueckstaende === 'nein';
  const sa = { ...leereSelbstauskunft(), ...gespeichert };
  for (const f of ZUSAGE_FRAGEN) if (gespeichert[f] === undefined) sa[f] = alt ? 'nein' : null;
  return sa;
}

/** Nur Daten bis 2.2 mit Ja in der früheren einen Frage: Die drei Fragen sind neu zu beantworten. */
export function zusageNeuFragen(person: Pick<Person, 'selbstauskunft'>): boolean {
  const g: Partial<Selbstauskunft> = person.selbstauskunft ?? {};
  return g.rueckstandMonate === undefined && g.mietrueckstaende === 'ja';
}

/**
 * Felder, die für diese Person gefragt werden (bis zum Schritt „Zusage“). Felder mit Bedingung
 * (WBS bei Sozialwohnungen) hängen an der Wohnung und kommen erst beim Export dazu.
 */
export function felderFuer(
  rolle: Rolle,
  situation: Lebenssituation | null,
  bis: Schritt = 'zusage',
): SelbstauskunftFeld[] {
  const grenze = SCHRITTE.indexOf(bis);
  return SELBSTAUSKUNFT_FELDER.filter(
    (f) =>
      SCHRITTE.indexOf(f.schritt) <= grenze &&
      !f.bedingung &&
      !f.nichtFuer?.includes(rolle) &&
      !(situation && f.entfaelltBei?.includes(situation)),
  );
}

/** Was für den ganzen Haushalt gilt: Haustiere und Ort, in jedem Bogen gleich. */
export interface HaushaltsAngaben {
  haustiere: JaNein;
  haustiereText: string;
  ort: string;
  /** W28, E376: Wohnberechtigungsschein, freiwillig. Fehlt das Feld, gibt es keine Antwort. */
  wbs?: JaNein;
}

/**
 * Angaben des Haushalts. Ältere Daten hatten sie je Person; dann gilt die erste Person,
 * die sie beantwortet hat (gelesen, nicht verschoben: nichts geht verloren).
 */
export function haushaltsAngaben(
  haushalt: Partial<Pick<Haushalt, 'haustiere' | 'haustiereText' | 'ort' | 'wbsAngabe'>> | null,
  personen: Pick<Person, 'selbstauskunft'>[] = [],
): HaushaltsAngaben {
  const alt = personen.map((p) => p.selbstauskunft).filter((x) => !!x);
  const mitTieren = alt.find((x) => x!.haustiere != null);
  const mitOrt = alt.find((x) => x!.ort?.trim());
  return {
    haustiere: haushalt?.haustiere ?? mitTieren?.haustiere ?? null,
    haustiereText:
      haushalt?.haustiere != null
        ? (haushalt.haustiereText ?? '')
        : (mitTieren?.haustiereText ?? ''),
    ort: haushalt?.ort ?? mitOrt?.ort ?? '',
    // Ohne Antwort fehlt das Feld, wie in älteren Daten.
    ...(haushalt?.wbsAngabe != null ? { wbs: haushalt.wbsAngabe } : {}),
  };
}

/** Wer einzieht: Vertragsparteien und weitere Erwachsene, dazu Kinder. */
export interface Einziehend {
  erwachsene: number;
  kinder: number;
}

export function einziehend(
  vertragsparteien: number,
  haushalt: Pick<Haushalt, 'kinder' | 'weitereErwachsene'>,
): Einziehend {
  return { erwachsene: vertragsparteien + haushalt.weitereErwachsene, kinder: haushalt.kinder };
}

/** „3 (2 Erwachsene, 1 Kind)“, ohne Kinder nur die Zahl. */
export function einziehendText(e: Einziehend): string {
  const gesamt = e.erwachsene + e.kinder;
  if (!e.kinder) return String(gesamt);
  const erw = e.erwachsene === 1 ? '1 Erwachsener' : `${e.erwachsene} Erwachsene`;
  const kind = e.kinder === 1 ? '1 Kind' : `${e.kinder} Kinder`;
  return `${gesamt} (${erw}, ${kind})`;
}

type PersonFuerAuskunft = Pick<
  Person,
  'kontakt' | 'nettoeinkommen' | 'lebenssituation' | 'selbstauskunft'
> &
  Partial<Pick<Person, 'ausbildungArt' | 'weitereLagen' | 'einkommenTrotzdem' | 'arbeitgeber'>>;

/** DP47 G5: Netto einer Lage; die erste steht an der Person. */
function nettoVon(
  person: Pick<Person, 'nettoeinkommen'> & Partial<Pick<Person, 'weitereLagen'>>,
  lage: LageAngabe,
): number | null {
  if (!lage.lageId) return person.nettoeinkommen;
  return person.weitereLagen?.find((l) => l.id === lage.lageId)?.nettoeinkommen ?? null;
}

/**
 * DP47 G5: Fehlt ein Netto? Jede wirksame Lage außer „Leistungen vom Amt“ braucht einen Betrag. Ohne
 * Lebenslage gilt wie bisher das Netto der Person.
 */
function nettoFehlt(person: PersonFuerAuskunft): boolean {
  const lagen = wirksameLagen({ ...person, arbeitgeber: person.arbeitgeber ?? '' });
  if (!lagen.length) return !(person.nettoeinkommen && person.nettoeinkommen > 0);
  return lagen.some((l) => {
    if (l.situation === 'leistungsbezug') return false;
    const netto = nettoVon(person, l);
    return !(netto && netto > 0);
  });
}

/** Die vier Teile im Akkordeon (Kontakt, Einkommen, Fragen, Haushalt), Bürgen ohne Haushalt. */
export type TeilId = 'kontakt' | 'einkommen' | 'fragen' | 'haushalt';

/** Hauptknopf unten auf der Seite der Selbstauskunft (K9, DP96 Weg B). */
export type Hauptknopf = { art: 'weiter'; ziel: TeilId } | { art: 'blass' } | { art: 'fertig' };

/**
 * K9 (DP96, Weg B): Der Hauptknopf heißt „Weiter“, bis alles ausgefüllt ist. Ziel ist der nächste offene Teil, zuerst
 * nach dem geöffneten gesucht, dann wieder von vorn. Ist nur noch der geöffnete Teil offen (DP96 Fall 5: Einkommen),
 * steht ein blasses „Fertig“, und darüber der Satz, was fehlt. Ist alles ausgefüllt, „Fertig“ wie bisher.
 */
export function hauptknopf(stand: Pick<Teil, 'id' | 'fertig'>[], offen: TeilId | null): Hauptknopf {
  const offene = stand.filter((s) => !s.fertig);
  if (!offene.length) return { art: 'fertig' };
  if (offene.length === 1 && offene[0]!.id === offen) return { art: 'blass' };
  const i = offen ? stand.findIndex((s) => s.id === offen) : -1;
  const reihe = i < 0 ? stand : [...stand.slice(i + 1), ...stand.slice(0, i)];
  return { art: 'weiter', ziel: reihe.find((s) => !s.fertig)!.id };
}
export interface Teil {
  id: TeilId;
  fertig: boolean;
  /** Bei „fragen“: wie viele noch offen sind. */
  offen: number;
}

/** Werte, mit denen das Formular der Selbstauskunft rechnet. */
export interface SelbstauskunftWerte {
  person: PersonFuerAuskunft;
  rolle: Rolle;
  hh: HaushaltsAngaben;
}

/** In welchem Teil ein Feld des Regelkatalogs steht; „name“ kommt aus dem Haushalt und steht in keinem Teil. */
const TEIL_VON: Record<string, TeilId> = {
  kontakt: 'kontakt',
  anschrift: 'kontakt',
  beruf: 'einkommen',
  arbeitgeber: 'einkommen',
  nettoeinkommen: 'einkommen',
  insolvenz: 'fragen',
  raeumungstitel: 'fragen',
  rueckstand_monate: 'fragen',
  rueckstand_mieten: 'fragen',
  kuendigung: 'fragen',
  personenzahl: 'haushalt',
  haustiere: 'haushalt',
  ort: 'haushalt',
};

const TEILE: readonly TeilId[] = ['kontakt', 'einkommen', 'fragen', 'haushalt'];

/** Wann ein Feld des Regelkatalogs nötig ist und als ausgefüllt gilt. Nicht genannte sind freiwillig. */
const PRUEFUNG: Record<string, Pick<FormFeld<SelbstauskunftWerte>, 'noetig' | 'gefuellt'>> = {
  // E222 (DP77, Abschnitt 5): „Eine Angabe reicht“. Eine Nummer, die sich nicht umsetzen lässt, zählt dabei nicht;
  // sie ist ein eigener offener Punkt im Überblick, und nur sie fehlt in der Mappe, nicht die Selbstauskunft.
  kontakt: {
    noetig: true,
    gefuellt: ({ person }) => !!telefonFuerMappe(person.kontakt) || !!person.kontakt.email.trim(),
  },
  nettoeinkommen: { noetig: true, gefuellt: ({ person }) => !nettoFehlt(person) },
  haustiere: { noetig: true, gefuellt: ({ hh }) => hh.haustiere !== null },
  insolvenz: {
    noetig: true,
    gefuellt: ({ person }) => selbstauskunftVon(person).insolvenz !== null,
  },
  raeumungstitel: {
    noetig: true,
    gefuellt: ({ person }) => selbstauskunftVon(person).raeumungstitel !== null,
  },
  // C.4 bis C.6 fehlen nie: Die Fragen kommen erst, wenn der Vermieter sich entschieden hat.
};
const FREIWILLIG: Pick<FormFeld<SelbstauskunftWerte>, 'noetig' | 'gefuellt'> = {
  noetig: false,
  gefuellt: () => true,
};

/**
 * Das Formular der Selbstauskunft auf dem Formblatt (PC208, Schritt 1). Welche Felder gefragt werden, sagt wie bisher
 * der Regelkatalog (`felderFuer`); dazu kommen die freiwillige Anschrift (W60, DP135 U6) und der Ort, die nur Hefta
 * kennt. Haustiere und Ort sind Sache des Haushalts und werden bei Bürgen nicht gefragt (sie ziehen nicht ein).
 */
export function selbstauskunftFormular(
  rolle: Rolle,
  person: Pick<Person, 'lebenssituation'> & Partial<Pick<Person, 'weitereLagen'>>,
): Formular<SelbstauskunftWerte> {
  const ausKatalog = felderFuer(rolle, person.lebenssituation).filter((f) => f.id in TEIL_VON);
  const felder: FormFeld<SelbstauskunftWerte>[] = [];
  for (const f of ausKatalog) {
    felder.push({
      id: f.id,
      teil: TEIL_VON[f.id]!,
      art: f.id === 'kontakt' ? 'telefon' : JA_NEIN_FELD.has(f.id) ? 'janein' : 'text',
      ...(PRUEFUNG[f.id] ?? FREIWILLIG),
    });
    if (f.id === 'kontakt')
      felder.push({ id: 'anschrift', teil: 'kontakt', art: 'anschrift', ...FREIWILLIG });
  }
  // DP47 G5: Entfällt das Netto mit der ersten Lage (Leistungen vom Amt), braucht eine weitere Lage trotzdem eins.
  if (!ausKatalog.some((f) => f.id === 'nettoeinkommen') && person.weitereLagen?.length)
    felder.push({
      id: 'nettoeinkommen',
      teil: 'einkommen',
      art: 'betrag',
      ...PRUEFUNG.nettoeinkommen!,
    });
  if (rolle !== 'buerge')
    felder.push({
      id: 'ort',
      teil: 'haushalt',
      art: 'text',
      noetig: true,
      gefuellt: ({ hh }) => !!hh.ort.trim(),
    });
  return { id: 'selbstauskunft', teile: TEILE, felder };
}

const JA_NEIN_FELD = new Set<string>([
  ...Object.keys(ERKLAERUNG),
  ...Object.values(ZUSAGE_KATALOG),
]);

export function teile(person: PersonFuerAuskunft, rolle: Rolle, hh: HaushaltsAngaben): Teil[] {
  const form = selbstauskunftFormular(rolle, person);
  // Die Zahl der offenen Angaben zeigt nur der Teil „Fragen“ („2 offen“).
  return teilStand(form, { person, rolle, hh }).map((s) => ({
    id: s.id as TeilId,
    fertig: s.fertig,
    offen: s.id === 'fragen' ? s.offen : 0,
  }));
}

/**
 * IDs der Angaben, die noch fehlen, aus dem Formular der Selbstauskunft. Beruf, Arbeitgeber und Anschrift sind
 * freiwillig.
 */
export function fehlendeAngaben(
  person: PersonFuerAuskunft,
  rolle: Rolle,
  hh: HaushaltsAngaben = haushaltsAngaben(null, [person]),
): string[] {
  return fehlendeFelder(selbstauskunftFormular(rolle, person), { person, rolle, hh }).map(
    (f) => f.id,
  );
}

export function vollstaendig(
  person: PersonFuerAuskunft,
  rolle: Rolle,
  hh?: HaushaltsAngaben,
): boolean {
  return fehlendeAngaben(person, rolle, hh).length === 0;
}

const euro = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

export function betragText(person: Pick<Person, 'nettoeinkommen' | 'selbstauskunft'>): string {
  if (!person.nettoeinkommen) return '';
  const sa = selbstauskunftVon(person);
  return `${sa.einkommenArt === 'mindestens' ? 'mindestens ' : ''}${euro.format(person.nettoeinkommen)} €`;
}

/**
 * Eine Zeile im festen Formular (design/mappe-feinschliff.md, § 1). Fehlt eine Angabe, bleibt die Zeile
 * und das Formular sagt „keine Angabe“: Nichts rückt auf, jede Selbstauskunft sieht gleich aus (P27).
 */
export type FormZeile =
  | { id: string; etikett: string; art: 'text' | 'hinweis'; wert: string }
  | { id: string; etikett: string; art: 'janein'; antwort: JaNein; erklaerung: string };

export interface FormBlock {
  id: 'person' | 'haushalt' | 'buergschaft' | 'einkommen' | 'fragen';
  titel: string;
  zeilen: FormZeile[];
}

/** Was erst zu einem späteren Schritt gehört, steht als Satz in derselben Zeile. */
const SPAETER: Record<Schritt, string> = {
  besichtigung: '',
  will_wohnung: 'Wird erst ab dem Mietwunsch gefragt und dann ergänzt',
  zusage: 'Wird erst bei der Zusage gefragt und dann ergänzt',
};

function artVon(person: Pick<Person, 'lebenssituation' | 'ausbildungArt'>): AusbildungArt | null {
  return person.lebenssituation === 'studierend_azubi' ? (person.ausbildungArt ?? null) : null;
}

/** Wie Beruf und Arbeitgeber bei dieser Person heißen (Studiengang und Hochschule, …). */
export function berufBezeichnungen(person: Pick<Person, 'lebenssituation' | 'ausbildungArt'>): {
  beruf: string;
  arbeitgeber: string;
} {
  const art = artVon(person);
  if (!art) return { beruf: 'Beruf', arbeitgeber: 'Arbeitgeber' };
  const { beruf, arbeitgeber } = katalogDaten.lebenssituationen.studierend_azubi.arten[art];
  return { beruf, arbeitgeber };
}

/** „Ort, Datum“ im Bogen. Der Ort gehört dem Haushalt: Bürgen haben nur das Datum (P19). */
export function ortUndDatum(
  rolle: Rolle,
  ort: string,
  datum: string,
): { ortDatum: string; ortLabel: string } {
  if (rolle === 'buerge') return { ortDatum: datum, ortLabel: 'Datum' };
  return { ortDatum: [ort.trim(), datum].filter(Boolean).join(', '), ortLabel: 'Ort, Datum' };
}

/** E49 (B17a): Satz in der Selbstauskunft, wenn die Frage nach Mietrückständen auf die Zusage wartet. */
export function nachZusageSatz(allein: boolean): string {
  return allein ? 'Beantworte ich nach der Zusage' : 'Beantworten wir nach der Zusage';
}

/** Das feste Formular nach dem Musterbogen, immer dieselben Blöcke in derselben Reihenfolge (fürs PDF). */
export function selbstauskunftBloecke(
  person: Person,
  rolle: Rolle,
  wer: Einziehend,
  hh: HaushaltsAngaben,
  schritt: Schritt,
  {
    antwortenImmer = false,
    buergschaftDabei = false,
    zusageText,
    wbsZeile = false,
  }: {
    /**
     * Beantwortete Fragen drucken, auch wenn sie erst später dran wären (mappe-feinschliff.md, § 1). Nicht bei
     * „Datensparsam“: Dort gilt der gewählte Schritt, und eine Antwort bleibt draußen, bis er erreicht ist.
     */
    antwortenImmer?: boolean;
    /** Liegt die Bürgschaftserklärung dieser Mappe wirklich bei? Sonst sagt das Formular das nicht. */
    buergschaftDabei?: boolean;
    /**
     * E49 (B17a): Satz für eine Frage, die erst bei der Zusage beantwortet wird, wenn der Schalter für
     * Mietrückstände an ist: „Beantworten wir nach der Zusage“ bzw. „Beantworte ich nach der Zusage“.
     */
    zusageText?: string;
    /**
     * W28 (DP134, Abschnitt 1): Mappe für eine Sozialwohnung. Dann steht unter HAUSHALT der Wohnberechtigungsschein,
     * nur mit Antwort; sonst nie.
     */
    wbsZeile?: boolean;
  },
): FormBlock[] {
  const sa = selbstauskunftVon(person);
  const feld = (id: string) => SELBSTAUSKUNFT_FELDER.find((f) => f.id === id)!;
  const spaeter = (id: string) => {
    const f = feld(id);
    if (SCHRITTE.indexOf(f.schritt) <= SCHRITTE.indexOf(schritt)) return '';
    return f.schritt === 'zusage' && zusageText ? zusageText : SPAETER[f.schritt];
  };
  const text = (id: string, etikett: string, wert: string): FormZeile =>
    spaeter(id)
      ? { id, etikett, art: 'hinweis', wert: spaeter(id) }
      : { id, etikett, art: 'text', wert };
  const frage = (id: keyof typeof ERKLAERUNG): FormZeile => {
    const etikett = feld(id).pdfText;
    const gedruckt = antwortenImmer && sa[id] !== null;
    if (spaeter(id) && !gedruckt) return { id, etikett, art: 'hinweis', wert: spaeter(id) };
    const erklaerung = sa[id] === 'ja' ? (sa[ERKLAERUNG[id]] ?? '').trim() : '';
    return { id, etikett, art: 'janein', antwort: sa[id], erklaerung };
  };

  // PC207, 2: Musterbogen C.4 bis C.6 je eine Zeile, die Pflichtverletzung zu C.6 als Erklärung. C.7 (Gründe) nur,
  // wenn eine gedruckte Antwort Ja ist; der Musterbogen fragt sie nur dann.
  const zusageZeilen = (): FormZeile[] => {
    const zeilen = ZUSAGE_FRAGEN.map((f): FormZeile => {
      const id = ZUSAGE_KATALOG[f];
      const etikett = feld(id).pdfText;
      const gedruckt = antwortenImmer && sa[f] !== null;
      if (spaeter(id) && !gedruckt) return { id, etikett, art: 'hinweis', wert: spaeter(id) };
      const erklaerung =
        f === 'kuendigung' && sa.kuendigung === 'ja' ? sa.kuendigungWelche.trim() : '';
      return { id, etikett, art: 'janein', antwort: sa[f], erklaerung };
    });
    const ja = zeilen.some((z) => z.art === 'janein' && z.antwort === 'ja');
    if (ja)
      zeilen.push({
        id: 'gruende',
        etikett: 'Gründe, warum das nicht erneut zu erwarten ist',
        art: 'text',
        wert: sa.stellungnahme.trim(),
      });
    return zeilen;
  };

  const namen = berufBezeichnungen(person);
  // DP47b K1/K5: Ist eine Lage „Leistungen vom Amt“ und der Schalter aus, steht nur das Amt im Bogen. Beruf
  // und Arbeitgeber einer anderen ersten Lage folgen dem Schalter und bleiben dann weg.
  const lagen = wirksameLagen(person);
  // Ohne Lebenslage (etwa aus dem Bogen im Browser, E111) gilt, was in Beruf und Arbeitgeber steht, wie im Regelkatalog.
  const ersteWirkt = !lagen.length || lagen.some((l) => l.lageId === null);
  const beruf = ersteWirkt ? person.beruf.trim() : '';
  // PC207, 2: Reihenfolge wie im Musterbogen (MUSTERBOGEN_REIHENFOLGE, Test in selbstauskunft-musterbogen.test.ts):
  // A Name und Kontakt; B.1 Personen, B.3 Arbeitgeber, B.4 Beruf, B.5 Einkommen, B.6 Haustiere, B.7 Insolvenz,
  // B.8 Räumungstitel; C.4 bis C.7. Die Lebenslage steht nicht im Bogen; sie bleibt nur Eingabe in der App.
  const bloecke: FormBlock[] = [
    {
      id: 'person',
      titel: 'Zur Person',
      zeilen: [
        { id: 'name', etikett: 'Name', art: 'text', wert: nameText(nameImPdf(person)) },
        // DP130, Antwort 4: Für alle im Mietvertrag fällt die Zeile weg (Normalfall, das Deckblatt sagt es). Wer
        // bürgt, steht als „Rolle: Bürgt“ da: Eine Selbstauskunft wird auch einzeln gelesen.
        ...(rolle === 'buerge'
          ? [{ id: 'rolle', etikett: 'Rolle', art: 'text' as const, wert: 'Bürgt' }]
          : []),
        // W60 (DP135 U6): Anschrift freiwillig; fehlt sie, „keine Angabe“ an ihrem Platz (P27). Ältere Daten haben sie
        // nur als Zeile.
        {
          id: 'anschrift',
          etikett: 'Anschrift',
          art: 'text',
          wert: person.kontakt.anschriftTeile
            ? anschriftText(person.kontakt.anschriftTeile)
            : (person.kontakt.anschrift ?? '').trim(),
        },
        text(
          'kontakt',
          feld('kontakt').pdfText,
          [telefonFuerMappe(person.kontakt)?.anzeige ?? '', person.kontakt.email.trim()]
            .filter(Boolean)
            .join(' · '),
        ),
      ],
    },
  ];

  if (rolle === 'buerge') {
    bloecke.push({
      id: 'buergschaft',
      titel: 'Bürgschaft',
      zeilen: [
        {
          id: 'einzug',
          etikett: 'Einzug',
          art: 'hinweis',
          wert: 'Bürgt für den Mietvertrag, zieht selbst nicht ein',
        },
        {
          id: 'erklaerung',
          etikett: 'Erklärung',
          art: 'hinweis',
          wert: buergschaftDabei
            ? 'Bürgschaftserklärung liegt der Mappe bei, Original auf Papier'
            : 'Bürgschaftserklärung folgt, Original auf Papier',
        },
      ],
    });
  } else {
    bloecke.push({
      id: 'haushalt',
      titel: 'Haushalt',
      zeilen: [
        text('personenzahl', feld('personenzahl').pdfText, einziehendText(wer)),
        ...(wbsZeile && hh.wbs
          ? [
              {
                id: 'wbs',
                etikett: 'Wohnberechtigungsschein',
                art: 'text' as const,
                wert: hh.wbs === 'ja' ? 'Ja' : 'Nein',
              },
            ]
          : []),
      ],
    });
  }

  bloecke.push({
    id: 'einkommen',
    titel: 'Einkommen',
    zeilen: [
      text('arbeitgeber', namen.arbeitgeber, ersteWirkt ? person.arbeitgeber.trim() : ''),
      text('beruf', namen.beruf, beruf),
      ...einkommenZeilen(person, lagen, text, feld('nettoeinkommen').pdfText),
    ],
  });

  // B.6 Haustiere als Frage mit Ja oder Nein, die Tiere als Erläuterung; nur für Personen, die einziehen.
  const haustiere = (): FormZeile[] => {
    if (rolle === 'buerge') return [];
    const id = 'haustiere';
    const etikett = feld(id).pdfText;
    if (spaeter(id)) return [{ id, etikett, art: 'hinweis', wert: spaeter(id) }];
    const tiere = hh.haustiere === 'ja' ? hh.haustiereText.trim() : '';
    return [
      {
        id,
        etikett,
        art: 'janein',
        antwort: hh.haustiere,
        erklaerung: tiere ? tiere.charAt(0).toUpperCase() + tiere.slice(1) : '',
      },
    ];
  };
  bloecke.push({
    id: 'fragen',
    titel: 'Fragen nach dem Musterbogen',
    zeilen: [...haustiere(), frage('insolvenz'), frage('raeumungstitel'), ...zusageZeilen()],
  });
  return bloecke;
}

/**
 * PC207, 2: Die Angaben im Bogen in der Reihenfolge des Musterbogens (Anlage der Orientierungshilfe, Januar 2026).
 * Steht etwas anderes im Bogen oder in anderer Reihenfolge, stimmt der Satz „Fragen und Reihenfolge folgen dem
 * Musterbogen“ nicht mehr; der Test dazu schlägt dann an.
 */
export const MUSTERBOGEN_REIHENFOLGE = [
  'name', // A
  'anschrift', // A
  'kontakt', // A
  'personenzahl', // B.1
  'arbeitgeber', // B.3
  'beruf', // B.4
  'nettoeinkommen', // B.5
  'haustiere', // B.6
  'insolvenz', // B.7
  'raeumungstitel', // B.8
  'rueckstand_monate', // C.4
  'rueckstand_mieten', // C.5
  'kuendigung', // C.6
  'gruende', // C.7
] as const;

const AMT_SATZ =
  'Die Miete übernimmt vollständig eine öffentliche Stelle. Nach dem Musterbogen (B.5) entfallen Fragen zum Einkommen dann.';

/**
 * Teil „Einkommen“ im Bogen, ohne Lebenslage (PC207, 2).
 * - Eine Quelle: das Netto im Monat (bei Rente „Rente im Monat, netto“).
 * - Nur „Leistungen vom Amt“ wirkt (Schalter aus, K5): der Satz aus Version 1 statt eines Betrags.
 * - Mehrere Quellen (DP47 G5): die Summe, wenn jede Quelle einen Betrag hat (DP47b, L14), darunter je Quelle eine
 *   Zeile mit Beruf und Arbeitgeber. Hat eine Quelle beides nicht, heißt sie „Weitere Einkünfte“.
 */
function einkommenZeilen(
  person: Person,
  lagen: LageAngabe[],
  text: (id: string, etikett: string, wert: string) => FormZeile,
  nettoEtikett: string,
): FormZeile[] {
  const euro0 = (n: number) => `${euro.format(n)} €`;
  if (lagen.length <= 1) {
    const einzige = lagen[0] ?? null;
    if (einzige?.situation === 'leistungsbezug')
      return [{ id: 'nettoeinkommen', etikett: 'Einkommen', art: 'hinweis', wert: AMT_SATZ }];
    const netto = einzige ? nettoVon(person, einzige) : person.nettoeinkommen;
    return [
      text(
        'nettoeinkommen',
        einzige?.situation === 'rente' ? 'Rente im Monat, netto' : nettoEtikett,
        einzige?.lageId ? (netto ? euro0(netto) : '') : betragText(person),
      ),
    ];
  }
  const betraege = lagen.map((l) =>
    l.situation === 'leistungsbezug' ? null : nettoVon(person, l),
  );
  const zeilen: FormZeile[] = [];
  if (betraege.every((b) => b && b > 0))
    zeilen.push(
      text(
        'nettoeinkommen',
        nettoEtikett,
        euro0(betraege.reduce<number>((s, b) => s + (b ?? 0), 0)),
      ),
    );
  lagen.forEach((l, i) => {
    const angaben = l.lageId ? person.weitereLagen?.find((x) => x.id === l.lageId) : person;
    const berufTeil = (angaben?.beruf ?? '').trim();
    const arbeitgeberTeil = (angaben?.arbeitgeber ?? '').trim();
    const etikett =
      [berufTeil, arbeitgeberTeil ? `bei ${arbeitgeberTeil}` : ''].filter(Boolean).join(' ') ||
      'Weitere Einkünfte';
    zeilen.push(
      l.situation === 'leistungsbezug'
        ? {
            id: `quelle-${i}`,
            etikett: 'Miete',
            art: 'hinweis',
            wert: 'Die Miete übernimmt das Amt.',
          }
        : // Gleiche Regel wie das Netto (wann es dran ist), eigene Kennung je Quelle.
          {
            ...text('nettoeinkommen', etikett, betraege[i] ? euro0(betraege[i]!) : ''),
            id: `quelle-${i}`,
          },
    );
  });
  return zeilen;
}

/** Alle Angaben einzeln zum Kopieren (A6), für Portale mit eigenem Formular. Leere fehlen. */
export function angabenZumUebertragen(
  person: Person,
  rolle: Rolle,
  wer: Einziehend,
  hh: HaushaltsAngaben,
): { etikett: string; wert: string }[] {
  const sa = selbstauskunftVon(person);
  const namen = berufBezeichnungen(person);
  const jaNein = (w: JaNein) => (w === 'ja' ? 'Ja' : w === 'nein' ? 'Nein' : '');
  const tiere =
    hh.haustiere === 'ja'
      ? hh.haustiereText.trim() || 'Ja'
      : hh.haustiere === 'nein'
        ? 'Keine'
        : '';
  const zeilen = [
    { etikett: 'Name', wert: nameText(nameImPdf(person)) },
    { etikett: 'Telefon', wert: telefonFuerMappe(person.kontakt)?.anzeige ?? '' },
    { etikett: 'E-Mail', wert: person.kontakt.email.trim() },
    { etikett: namen.beruf, wert: person.beruf.trim() },
    { etikett: namen.arbeitgeber, wert: person.arbeitgeber.trim() },
    {
      etikett:
        person.lebenssituation === 'rente' ? 'Rente im Monat, netto' : 'Einkommen im Monat, netto',
      wert: person.lebenssituation === 'leistungsbezug' ? '' : betragText(person),
    },
    ...(rolle === 'buerge'
      ? []
      : [
          { etikett: 'Personen, die einziehen', wert: einziehendText(wer) },
          { etikett: 'Haustiere', wert: tiere },
        ]),
    { etikett: 'Laufendes Insolvenzverfahren', wert: jaNein(sa.insolvenz) },
    { etikett: 'Räumungstitel in den letzten fünf Jahren', wert: jaNein(sa.raeumungstitel) },
  ];
  return zeilen.filter((z) => z.wert);
}

/** Sieht wie eine E-Mail-Adresse aus? Nur für einen Hinweis: Gespeichert wird, was dasteht. */
export function emailSiehtGutAus(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text.trim());
}

/** Sieht wie eine Telefonnummer aus? Ziffern, dazu + am Anfang und die üblichen Trennzeichen. */
export function telefonSiehtGutAus(text: string): boolean {
  const wert = text.trim();
  if (!/^\+?[\d\s()/.-]+$/.test(wert)) return false;
  const ziffern = wert.replace(/\D/g, '').length;
  return ziffern >= 6 && ziffern <= 15;
}
