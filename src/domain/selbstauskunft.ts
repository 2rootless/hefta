import katalogDaten from '../../data/regelkatalog.de.json' with { type: 'json' };
import { telefonFuerMappe } from './telefon';
import type { AusbildungArt, Haushalt, Lebenssituation, Person, Rolle } from './modell';
import { lagenVon, wirksameLagen, type LageAngabe } from './lagen';
import { nameImPdf, nameText } from './namen';

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
  mietrueckstaende: JaNein;
  /**
   * PC65: „Nach der Zusage beantworten“ gewählt. Gleichrangig mit Ja und Nein, keine Wahl ist vorgegeben.
   * In der Mappe steht dann wie bei einer unbeantworteten Frage „Beantworte ich nach der Zusage“.
   */
  mietrueckstaendeSpaeter?: boolean;
  /** Freiwillige Erklärung zu einem Ja bei den Mietrückständen. */
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

/** Die drei Ja/Nein-Fragen und wo die Erklärung zu ihrem Ja steht. */
export const ERKLAERUNG = {
  insolvenz: 'erklaerungInsolvenz',
  raeumungstitel: 'erklaerungRaeumungstitel',
  mietrueckstaende: 'stellungnahme',
} as const;

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

export function leereSelbstauskunft(): Selbstauskunft {
  return {
    einkommenArt: 'betrag',
    haustiere: null,
    haustiereText: '',
    insolvenz: null,
    raeumungstitel: null,
    mietrueckstaende: null,
    stellungnahme: '',
    erklaerungInsolvenz: '',
    erklaerungRaeumungstitel: '',
    ort: '',
  };
}

export function selbstauskunftVon(person: Pick<Person, 'selbstauskunft'>): Selbstauskunft {
  return { ...leereSelbstauskunft(), ...person.selbstauskunft };
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
}

/**
 * Angaben des Haushalts. Ältere Daten hatten sie je Person; dann gilt die erste Person,
 * die sie beantwortet hat (gelesen, nicht verschoben: nichts geht verloren).
 */
export function haushaltsAngaben(
  haushalt: Partial<Pick<Haushalt, 'haustiere' | 'haustiereText' | 'ort'>> | null,
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

export function teile(person: PersonFuerAuskunft, rolle: Rolle, hh: HaushaltsAngaben): Teil[] {
  const fehlt = fehlendeAngaben(person, rolle, hh);
  const fragen = ['insolvenz', 'raeumungstitel'].filter((f) => fehlt.includes(f)).length;
  const liste: Teil[] = [
    { id: 'kontakt', fertig: !fehlt.includes('kontakt'), offen: 0 },
    { id: 'einkommen', fertig: !fehlt.includes('nettoeinkommen'), offen: 0 },
    { id: 'fragen', fertig: fragen === 0, offen: fragen },
  ];
  if (rolle !== 'buerge')
    liste.push({
      id: 'haushalt',
      fertig: !fehlt.includes('haustiere') && !fehlt.includes('ort'),
      offen: 0,
    });
  return liste;
}

/**
 * IDs der Angaben, die noch fehlen. Beruf und Arbeitgeber sind freiwillig. Haustiere und Ort sind
 * Sache des Haushalts und werden bei Bürgen nicht gefragt (sie ziehen nicht ein).
 */
export function fehlendeAngaben(
  person: PersonFuerAuskunft,
  rolle: Rolle,
  hh: HaushaltsAngaben = haushaltsAngaben(null, [person]),
): string[] {
  const sa = selbstauskunftVon(person);
  const fehlt: string[] = [];
  for (const f of felderFuer(rolle, person.lebenssituation)) {
    // E222 (DP77, Abschnitt 5): „Eine Angabe reicht“. Eine Nummer, die sich nicht umsetzen lässt, zählt dabei nicht;
    // sie ist ein eigener offener Punkt im Überblick, und nur sie fehlt in der Mappe, nicht die Selbstauskunft.
    if (f.id === 'kontakt' && !telefonFuerMappe(person.kontakt) && !person.kontakt.email.trim())
      fehlt.push(f.id);
    if (f.id === 'nettoeinkommen' && nettoFehlt(person)) fehlt.push(f.id);
    if (f.id === 'haustiere' && hh.haustiere === null) fehlt.push(f.id);
    if (f.id === 'insolvenz' && sa.insolvenz === null) fehlt.push(f.id);
    if (f.id === 'raeumungstitel' && sa.raeumungstitel === null) fehlt.push(f.id);
    // Mietrückstände fehlen nie: Die Frage kommt erst, wenn der Vermieter sich entschieden hat.
  }
  if (!fehlt.includes('nettoeinkommen') && person.weitereLagen?.length && nettoFehlt(person))
    fehlt.push('nettoeinkommen');
  if (rolle !== 'buerge' && !hh.ort.trim()) fehlt.push('ort');
  return fehlt;
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

  const namen = berufBezeichnungen(person);
  const art = artVon(person);
  const taetigkeit = art ? katalogDaten.lebenssituationen.studierend_azubi.arten[art].text : '';
  // DP47b K1/K5: Ist eine Lage „Leistungen vom Amt“ und der Schalter aus, steht nur das Amt im Bogen. Beruf
  // und Arbeitgeber einer anderen ersten Lage folgen dem Schalter und bleiben dann weg.
  const alleLagen = lagenVon(person);
  const lagen = wirksameLagen(person);
  const ersteWirkt = lagen.some((l) => l.lageId === null);
  const beruf = ersteWirkt ? person.beruf.trim() : '';
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
        text(
          'kontakt',
          feld('kontakt').pdfText,
          [telefonFuerMappe(person.kontakt)?.anzeige ?? '', person.kontakt.email.trim()]
            .filter(Boolean)
            .join(' · '),
        ),
        beruf || !taetigkeit
          ? text('beruf', namen.beruf, beruf)
          : text('beruf', 'Tätigkeit', taetigkeit),
        text('arbeitgeber', namen.arbeitgeber, ersteWirkt ? person.arbeitgeber.trim() : ''),
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
    const tiere =
      hh.haustiere === 'ja'
        ? (() => {
            const t = hh.haustiereText.trim();
            return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Ja';
          })()
        : hh.haustiere === 'nein'
          ? 'Keine'
          : '';
    bloecke.push({
      id: 'haushalt',
      titel: 'Haushalt',
      zeilen: [
        text('personenzahl', feld('personenzahl').pdfText, einziehendText(wer)),
        text('haustiere', feld('haustiere').pdfText, tiere),
      ],
    });
  }

  bloecke.push({
    id: 'einkommen',
    titel: 'Einkommen',
    zeilen: einkommenZeilen(person, lagen, alleLagen, text, feld('nettoeinkommen').pdfText),
  });
  bloecke.push({
    id: 'fragen',
    titel: 'Fragen nach dem Musterbogen',
    zeilen: [frage('insolvenz'), frage('raeumungstitel'), frage('mietrueckstaende')],
  });
  return bloecke;
}

const AMT_SATZ =
  'Die Miete übernimmt vollständig eine öffentliche Stelle. Nach dem Musterbogen (B.5) entfallen Fragen zum Einkommen dann.';

/** Name einer Lage im Bogen; nach „dazu“ klein, außer was mit einem Hauptwort beginnt (wie in der App). */
function lageName(l: LageAngabe, klein = false): string {
  const t =
    l.situation === 'studierend_azubi' && l.art
      ? katalogDaten.lebenssituationen.studierend_azubi.arten[l.art].text
      : katalogDaten.lebenssituationen[l.situation].text;
  return klein && l.situation !== 'leistungsbezug' ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

/**
 * Teil „Einkommen“ im Bogen.
 * - Eine Lage: wie bisher.
 * - Nur „Leistungen vom Amt“ wirkt (Schalter aus, K5): „Lebenslage“ nennt nur das Amt, kein Wort zur
 *   zweiten Lage, dazu der Satz aus Version 1.
 * - Mehrere Lagen (DP47 G5): „Lebenslage: Angestellt, dazu …“, die Summe nur, wenn jede Quelle einen
 *   Betrag hat (DP47b, L14), darunter je Quelle eine Zeile mit Beruf und Arbeitgeber.
 */
function einkommenZeilen(
  person: Person,
  lagen: LageAngabe[],
  alleLagen: LageAngabe[],
  text: (id: string, etikett: string, wert: string) => FormZeile,
  nettoEtikett: string,
): FormZeile[] {
  const euro0 = (n: number) => `${euro.format(n)} €`;
  if (lagen.length <= 1) {
    const einzige = lagen[0] ?? alleLagen[0] ?? null;
    const name = einzige ? lageName(einzige) : '';
    if (einzige?.situation === 'leistungsbezug')
      return [
        text('nettoeinkommen', 'Lebenslage', name),
        { id: 'nettoeinkommen', etikett: 'Einkommen', art: 'hinweis', wert: AMT_SATZ },
      ];
    const netto = einzige ? nettoVon(person, einzige) : person.nettoeinkommen;
    return [
      text('nettoeinkommen', 'Lebenslage', name),
      text(
        'nettoeinkommen',
        einzige?.situation === 'rente' ? 'Rente im Monat, netto' : nettoEtikett,
        einzige?.lageId ? (netto ? euro0(netto) : '') : betragText(person),
      ),
    ];
  }
  const [erste, ...weitere] = lagen;
  const zeilen: FormZeile[] = [
    text(
      'nettoeinkommen',
      'Lebenslage',
      `${lageName(erste!)}, dazu ${weitere.map((l) => lageName(l, true)).join(' und ')}`,
    ),
  ];
  const betraege = lagen.map((l) =>
    l.situation === 'leistungsbezug' ? null : nettoVon(person, l),
  );
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
    const etikett = [
      lageName(l),
      [berufTeil, arbeitgeberTeil ? `bei ${arbeitgeberTeil}` : ''].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join(', ');
    zeilen.push(
      l.situation === 'leistungsbezug'
        ? { id: `quelle-${i}`, etikett, art: 'hinweis', wert: 'Die Miete übernimmt das Amt.' }
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
