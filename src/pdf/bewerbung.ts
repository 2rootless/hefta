import {
  type Mitziehend,
  GRUPPE_BUERGT,
  GRUPPE_MIT,
  GRUPPE_VERTRAG,
  werIstDabeiSatz,
} from '../domain/mappeWoerter';
import fontkit from '@cantoo/fontkit';
import {
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFDict,
  PDFRef,
  PDFString,
  AFRelationship,
  degrees,
  rgb,
  type Color,
  type PDFFont,
  type PDFPage,
} from '@cantoo/pdf-lib';
import { APP_NAME, VERMIETER_ADRESSE, VERMIETER_DOMAIN } from '../app/name';
import { adresseTeile } from '../domain/adresse';
import { pdfLaden } from './laden';
import type { MappenAussehen } from '../domain/modell';
import { ANHANG_NAME, anhangBauen, anhangBytes } from './anhang';
import type { ExportModus } from '../domain/export';
import type { Schritt } from '../domain/selbstauskunft';
import type { Rolle, Tag } from '../domain/modell';
import { A4, deckFarbe, FARBE, type Schriften } from './mappe';
import {
  selbstauskunftZeichnen,
  umbrechen,
  zeichenErsetzer,
  type SelbstauskunftInhalt,
  type AuskunftSchriften,
} from './selbstauskunft';
import {
  BOGEN_OBEN,
  BOGEN_SEITE,
  EINZUG,
  GRAU,
  TINTE,
  LINIE_PUNKTE,
  VERZEICHNIS_ZEILEN,
  ZEICHEN,
  ZITAT,
  abschnittKopf,
  briefkopf,
  personZeichen,
} from './bogen';

// Die Bewerbungsmappe (design/mappe-pdf.md, seit 3.11. „Schlicht statt Kopfband“): Deckblatt mit Inhalt je
// Person, dann die Unterlagen. Jede Seite sagt, wem sie gehört und was sie ist. Fremde Seiten bleiben
// unverändert: eingepasst, nie vergrößert, nichts wird in sie hineingeschrieben. Läuft ohne Browser-APIs.

export interface MappenPerson {
  name: string;
  /** z. B. „Hauptmieter“, „Bürgin“. */
  rolle: string;
  /** Beruf oder Tätigkeit, falls angegeben. */
  beruf?: string;
  /** Personenfarbe als Hex. */
  farbe: string;
  buerge?: boolean;
  /** Rolle als Kennung, für die Lesehilfe. */
  rolleId?: Rolle;
  /** Vor- und Nachname wie auf dem Deckblatt, für die Lesehilfe (Fassung 1). */
  vorname?: string;
  nachname?: string;
  /**
   * DP45 G1: kein Mensch, sondern „Für den Haushalt“ (etwa der Wohnberechtigungsschein). Steht im
   * Verzeichnis vor den Personen, ohne Zeichen, nicht im Deckblatt bei den Personen und nicht in der
   * Lesehilfe.
   */
  haushalt?: boolean;
}

export interface MappenQuelle {
  daten: Uint8Array;
  /** Ausgewählte Seiten (0-basiert), sonst alle. */
  seiten?: number[] | null;
  /** Text rechts in der Kopfzeile, wenn er von der Unterlage abweicht („Gehaltsnachweis August 2026“). */
  kopf?: string;
  /** Kennung der Datei in Hefta, falls sie sich nicht öffnen lässt (PC126 K5). */
  datei?: string;
}

/** Eine Zeile im Inhalt; bei Serien mehrere Dateien (z. B. drei Monate). */
export interface MappenTeil {
  /** Falls die Datei nicht lesbar ist: wie „Mappe erstellen“ es sagt und wohin es führt. */
  meldung?: UnlesbareDatei;
  abschnitt: string;
  /** „Juli bis September“, „vom 20. Oktober 2026“. */
  detail?: string;
  /** Text rechts in der Kopfzeile, Standard: der Abschnitt. */
  kopf?: string;
  quellen: MappenQuelle[];
  /** Eigene Seite statt fremder: wird direkt gezeichnet, mit 20 mm Rand. */
  auskunft?: SelbstauskunftInhalt;
  /** Für die Lesehilfe (hefta.json): Typ aus dem Regelkatalog, Monate, Tag, Prüfweg. */
  typ?: string;
  monate?: string[];
  vom?: Tag;
  pruefweg?: 'pruefcode';
  /**
   * DP45 (G2 ohne Nachweis, G4): nur eine Zeile im Verzeichnis, wörtlich, ohne Seiten und ohne Seitenzahl.
   * Sie steht nicht in den Lesezeichen und nicht in der Lesehilfe.
   */
  nurZeile?: boolean;
}

export interface MappenBlock {
  person: MappenPerson;
  teile: MappenTeil[];
}

export interface BewerbungAuftrag {
  titel: string;
  autor?: string;
  /** „Max und Lea Mustermann“. */
  fussName: string;
  /** Kurzform der Wohnung für die Fußzeile („Beispielstraße 1“). */
  kurz?: string;
  /** Adresse der Wohnung in Zeilen; leer: der Name steht als Titel. */
  adresse: string[];
  satz: string;
  /** B14, E39: „Zu Ihrem Inserat auf ImmoScout24“ und „Einzug möglich ab …“ im Kopf unter der Lage. */
  inserat?: string;
  einzug?: string;
  /** B14, E39: „Fassung 2 vom 8. November 2026“, leise unten in der Leiste. */
  fassung?: string;
  /** Dieselben Angaben als Werte für die Lesehilfe (Fassung 1): Portal, Einzug `JJJJ-MM-TT`, Nummer. */
  lesehilfeWerte?: { portal?: string; einzug?: string; fassung?: number };
  /** Kinder und weitere Personen ohne Vertrag, je Art ein Eintrag: „Zwei Kinder“. */
  mitziehende: Mitziehend[];
  /** „Erstellt mit …“ klein auf dem Deckblatt, dazu die Lesehilfe als Anhang. */
  hinweis?: boolean;
  /** Für die Lesehilfe. */
  modus?: ExportModus;
  /** Kennung der Bewerbung für die Lesehilfe (E6). */
  kennung?: string;
  schritt?: Schritt;
  /** Bitte zum Löschen: der Satz, nur wenn sie an ist. Steht auf dem Deckblatt und in der Lesehilfe. */
  bitte?: string;
  kontakt: string[];
  /** Telefon und Mail aus `kontakt` einzeln, für die Lesehilfe (Fassung 3). */
  kontaktwege?: { telefon?: string; telefonE164?: string; email?: string };
  bloecke: MappenBlock[];
  deckblatt: boolean;
  /** Steht auf dem Deckblatt; ist es aus, gibt es keins. */
  inhaltsverzeichnis: boolean;
  /** Kopf- und Fußzeile. */
  fusszeile: boolean;
  /** Fehlt es, ist die Mappe schlicht. */
  aussehen?: MappenAussehen;
  schriften: Schriften;
  datum?: Date;
  /** Letzter Ausweg für eine Datei, die sich nicht übernehmen lässt: dieselben Seiten als Bilder. */
  alsBilder?: (daten: Uint8Array) => Promise<Uint8Array>;
  /**
   * B21, Mappe entsteht: echter Fortschritt, gezählt nach Quellen, die schon in der Mappe stecken, und
   * zuletzt dem Speichern. Dazwischen lässt der Bau den Bildschirm zeichnen.
   */
  fortschritt?: (fertig: number, gesamt: number) => void;
}

export interface UnlesbareDatei {
  /** „Bonitätsnachweis von Max“. */
  name: string;
  /** Seite der Unterlage. */
  href?: string;
  /** PC126 K5 (DP83 a): wessen Unterlage, für „Diesmal weglassen“ und den Satz im Blatt. */
  personId?: string;
  typ?: string;
  /** Rufname oder Vorname, „… von Aylin“. */
  person?: string;
  /** Die Unterlage, wie sie im Verzeichnis steht (W6): „Gehaltsnachweise, September bis November“. */
  unterlage?: string;
  /** Kennung der Datei, die sich nicht öffnen ließ; die Unterlage markiert sie. */
  datei?: string;
}

export interface BewerbungErgebnis {
  bytes: Uint8Array;
  seiten: number;
  inhalt: {
    person: string;
    seite: number;
    teile: { abschnitt: string; seite: number; bis: number }[];
  }[];
  /** Lage der fremden Seiten, für die Prüfungen P6 und P7. */
  fremde: {
    seite: number;
    skala: number;
    box: { x0: number; y0: number; x1: number; y1: number };
  }[];
  /** Angaben mit Zeichen, die die Schrift nicht kennt; „Mappe erstellen“ sagt es (nie still). */
  ersetzt: string[];
  /** Unterlagen, deren Datei sich auch als Bilder nicht übernehmen ließ. Sie fehlen in der Mappe. */
  unlesbar: UnlesbareDatei[];
  /** Maßstab des Deckblatts, für die Prüfung P23; ohne Deckblatt keiner. */
  deckMassstab?: number;
  /** Wie viele Seiten das Deckblatt hat. */
  deckSeiten?: number;
}

const MM = 72 / 25.4;
// Maße aus design/mappe-pdf.md, „Unterlagenseite“.
const RAND_SEITE = 12 * MM;
/**
 * Seiten mit Unterlagen (DP31): Ränder 9 mm oben, 18 mm seitlich, 8 mm unten. Die Kopfzeile ist eine Zeile
 * mit 9,5 pt, 2,5 mm darunter eine Linie, 3 mm darunter die Unterlage über die ganze Satzbreite (174 mm).
 * Auf üblichen Druckern (nicht druckbarer Rand bis etwa 6 mm) drucken Kopf- und Fußzeile ganz: Die Schrift
 * oben beginnt bei 9 mm, die Unterlängen unten enden über 8 mm.
 */
const UNTERLAGE_SEITE = 18 * MM;
const KOPF_GRUND = 9 * MM + 9.5 * 0.75;
const KOPF_LINIE = KOPF_GRUND + 2.5 * MM;
const INHALT_OBEN = KOPF_LINIE + 3 * MM;
const INHALT_UNTEN = 16 * MM;
const FUSS_TEXT = 9 * MM;
const FUSS_LINIE = 13 * MM;
/** Rahmen um fremde Seiten und Punktlinien, warm (B14, mappe14.py `.us .fremd`). */
const RAHMEN = rgb(0xd6 / 255, 0xce / 255, 0xc4 / 255);

function hex(farbe: string) {
  const n = Number.parseInt(farbe.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

interface S {
  regular: PDFFont;
  bold: PDFFont;
  titel: PDFFont;
  ersetzen: (text: string) => string;
}

function zeichenbar(text: string, s: S): string {
  return s.ersetzen(text);
}

function schreiben(
  seite: PDFPage,
  text: string,
  s: S,
  o: { x: number; y: number; size: number; font: PDFFont; color: Color },
) {
  seite.drawText(zeichenbar(text, s), o);
}

function breiteVon(text: string, font: PDFFont, groesse: number, s: S): number {
  return font.widthOfTextAtSize(zeichenbar(text, s), groesse);
}

/** Größte Schrift zwischen `von` und `bis`, in der der Text passt. */
function passendeGroesse(
  text: string,
  font: PDFFont,
  von: number,
  bis: number,
  breite: number,
  s: S,
): number {
  let g = von;
  while (g > bis && breiteVon(text, font, g, s) > breite) g -= 0.25;
  return g;
}

/**
 * Kopfzeile der Seiten mit Unterlagen (DP31): eine Zeile, links „■ Max Mustermann, Hauptmieter“, rechts der
 * Name der Unterlage mit Datum, darunter eine Linie in Tinte. Farbe nur am Zeichen. Der Name rechts steht
 * als eigener Text: Die Vermieterseite liest ihn als „Name aus dem Seitenkopf“.
 */
function kopfzeile(
  seite: PDFPage,
  p: MappenPerson,
  rechts: string,
  s: S,
  aussehen: MappenAussehen,
) {
  const { width: B, height: H } = seite.getSize();
  const x0 = UNTERLAGE_SEITE;
  const x1 = B - UNTERLAGE_SEITE;
  seite.drawLine({
    start: { x: x0, y: H - KOPF_LINIE },
    end: { x: x1, y: H - KOPF_LINIE },
    thickness: 0.5,
    color: FARBE.ink,
  });
  const vorName = ZEICHEN + 5;
  const rolle = `, ${p.rolle}`;
  const platz = x1 - x0 - vorName - 6 * MM;
  const passt = (g: number, mitRolle: boolean) =>
    breiteVon(p.name, s.bold, g, s) +
      (mitRolle ? breiteVon(rolle, s.regular, g, s) : 0) +
      breiteVon(rechts, s.regular, g, s) <=
    platz;
  // Namen nie kürzen: erst ohne Rolle, dann kleiner, nie unter 8 pt.
  let groesse = 9.5;
  const mitRolle = passt(groesse, true);
  if (!mitRolle) while (groesse > 8 && !passt(groesse, false)) groesse -= 0.25;
  const y = H - KOPF_GRUND;
  const farbe = hex(deckFarbe(aussehen, p.farbe));
  if (!p.haushalt) personZeichen(seite, p.buerge ? 'umriss' : 'flaeche', farbe, x0, y);
  schreiben(seite, p.name, s, {
    x: x0 + vorName,
    y,
    size: groesse,
    font: s.bold,
    color: FARBE.ink,
  });
  if (mitRolle)
    schreiben(seite, rolle, s, {
      x: x0 + vorName + breiteVon(p.name, s.bold, groesse, s),
      y,
      size: groesse,
      font: s.regular,
      color: FARBE.ink,
    });
  schreiben(seite, rechts, s, {
    x: x1 - breiteVon(rechts, s.regular, groesse, s),
    y,
    size: groesse,
    font: s.regular,
    color: FARBE.ink,
  });
}

/**
 * Fußzeile (DP30): links „Bewerbung {Straße}, {Namen}“, rechts „Seite {n} von {N}“, 8 pt in Tinte (DP71), darüber eine
 * feine Linie. Auf dem Briefbogen (Deckblatt, Selbstauskunft) mit dessen Rändern, sonst wie bisher.
 */
function fussleiste(
  seite: PDFPage,
  links: string,
  nummer: number,
  gesamt: number,
  s: S,
  rand = RAND_SEITE,
) {
  const { width: B } = seite.getSize();
  seite.drawLine({
    start: { x: rand, y: FUSS_LINIE },
    end: { x: B - rand, y: FUSS_LINIE },
    thickness: 0.4,
    color: LINIE_PUNKTE,
  });
  const rechts = `Seite ${nummer} von ${gesamt}`;
  const rechtsBreite = s.regular.widthOfTextAtSize(rechts, 8);
  // DP30: nie unter 8 pt. Passt die Zeile nicht, bricht sie vor der Seitenzahl um; Nachnamen werden nie
  // gekürzt.
  const groesse = 8;
  const zeilen = umbrechen(
    zeichenbar(links, s),
    s.regular,
    groesse,
    B - 2 * rand - rechtsBreite - 12,
  );
  zeilen.forEach((zeile, i) =>
    seite.drawText(zeile, {
      x: rand,
      y: FUSS_TEXT + (zeilen.length - 1) * 3.5 - i * 7.5,
      size: groesse,
      font: s.regular,
      color: TINTE,
    }),
  );
  seite.drawText(rechts, {
    x: B - rand - rechtsBreite,
    y: FUSS_TEXT,
    size: 8,
    font: s.regular,
    color: TINTE,
  });
}

/** Fremde Seite, wie man sie im Original sieht: ausgefüllte Felder gehören ins Bild (P16). */
async function vorbereiten(daten: Uint8Array): Promise<PDFDocument> {
  const quelle = await pdfLaden(daten);
  const form = quelle.getForm();
  if (!form.getFields().length) return quelle;
  try {
    form.flatten();
  } catch {
    // Felder mit Zeichen außerhalb der Standardschrift: die vorhandenen Bilder der Felder nehmen.
    form.flatten({ updateFieldAppearances: false });
  }
  // In eine neue Datei schreiben und neu lesen, damit die Bilder der Felder als eigene Objekte
  // mitkommen. Direkt speichern ginge nicht: Eine entschlüsselte Quelle bliebe als verschlüsselt markiert.
  const sauber = await PDFDocument.create({ updateMetadata: false });
  for (const seite of await sauber.copyPages(quelle, quelle.getPageIndices()))
    sauber.addPage(seite);
  return PDFDocument.load(await sauber.save(), { updateMetadata: false });
}

/**
 * Übernimmt die Seiten einer Quelle in die Mappe. Eine einzelne Datei, an der pdf-lib scheitert, darf
 * nicht die ganze Mappe verhindern: Sie kommt dann als Bilder, und geht auch das nicht, wird es gemeldet.
 */
async function quelleUebernehmen(
  pdf: PDFDocument,
  q: MappenQuelle,
  alsBilder: BewerbungAuftrag['alsBilder'],
) {
  const versuchen = async (daten: Uint8Array) => {
    const quelle = await vorbereiten(daten);
    const nummern = q.seiten?.length ? q.seiten : quelle.getPageIndices();
    const seiten = nummern.map((i) => quelle.getPage(i));
    // Eine ganz leere Seite (Rückseite im Scan) hat keinen Inhalt, das Übernehmen scheitert sonst daran.
    for (const seite of seiten) if (!seite.node.Contents()) seite.pushOperators();
    const eingebettet = await pdf.embedPages(
      seiten,
      seiten.map((seite) => {
        const c = seite.getCropBox();
        return { left: c.x, bottom: c.y, right: c.x + c.width, top: c.y + c.height };
      }),
    );
    // Gleich einbetten: Sonst zeigt sich ein Fehler erst beim Speichern der ganzen Mappe.
    for (const e of eingebettet) await e.embed();
    return { seiten, eingebettet };
  };
  try {
    return await versuchen(q.daten);
  } catch {
    if (!alsBilder) return null;
  }
  try {
    return await versuchen(await alsBilder(q.daten));
  } catch {
    return null;
  }
}

interface Eintrag {
  block: MappenBlock;
  teil: MappenTeil;
  von: number;
  bis: number;
  /** Seiten je Quelle, für Lesezeichen bei Serien. */
  monate: { titel: string; seite: number }[];
}

/** V6 (E223): „– Seite 6“ oder „– Seiten 3 bis 5“ hinter dem Wortlaut; so liest auch ein fremder Leser die Zeile. */
const ziffern = (e: Pick<Eintrag, 'von' | 'bis'>) =>
  // DP45 G1: eine Zeile ohne Seiten (nurZeile) steht ohne Seitenangabe.
  !e.von ? '' : e.von === e.bis ? `– Seite ${e.von}` : `– Seiten ${e.von} bis ${e.bis}`;

const DECK_DATUM = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** „Gehaltsnachweise, August bis Oktober“, aber „Bonitätsnachweis vom 28. Oktober 2026“ (PC28: ohne Komma). */
const beschriftung = (t: MappenTeil) =>
  !t.detail
    ? t.abschnitt
    : t.detail.startsWith('vom ')
      ? `${t.abschnitt} ${t.detail}`
      : `${t.abschnitt}, ${t.detail}`;

interface DeckLink {
  seite: number;
  rect: number[];
  /** Seite der Mappe, auf die der Eintrag führt. */
  ziel?: number;
  /** Oder eine Adresse: die Zeile zur Lesehilfe. Text und Ziel sind dieselbe Adresse. */
  uri?: string;
}

// ---------- Briefbogen (DP30, Richtung B): Deckblatt und Selbstauskunft in einem Satz ----------

/**
 * Wie viele Verzeichniszeilen auf Seite 1 passen (DP30, Abschnitt 3). Jede Zeile der Löschbitte unten links
 * zählt wie eine Verzeichniszeile (PC32, DP32 F1).
 */
function verzeichnisPlatz(a: BewerbungAuftrag, bitteZeilen: number): number {
  const oben = a.bloecke.filter((b) => !b.person.haushalt).length + a.mitziehende.length;
  return VERZEICHNIS_ZEILEN - 2 * Math.max(0, oben - 5) - bitteZeilen;
}

/**
 * Deckblatt als Briefbogen (DP30, Abschnitt 2 und 3). Ohne `seite` wird nur gemessen. Hat das Verzeichnis
 * mehr Zeilen, als auf Seite 1 passen, läuft es auf Seite 2 weiter; eine Person wird nie geteilt.
 */
function deckblatt(
  a: BewerbungAuftrag,
  eintraege: Eintrag[],
  s: S,
  seite: (n: number) => PDFPage | null,
): { seiten: number; links: DeckLink[]; massstab: number } {
  return { ...deckblattSetzen(a, eintraege, s, seite), massstab: 1 };
}

function deckblattSetzen(
  a: BewerbungAuftrag,
  eintraege: Eintrag[],
  s: S,
  seite: (n: number) => PDFPage | null,
): { seiten: number; links: DeckLink[] } {
  const B = A4.breite;
  const H = A4.hoehe;
  const aussehen: MappenAussehen = a.aussehen ?? { art: 'schlicht' };
  const x0 = BOGEN_SEITE;
  const breite = B - 2 * BOGEN_SEITE;
  const links: DeckLink[] = [];
  let n = 0;
  let p = seite(n);
  const text = (
    t: string,
    x: number,
    y: number,
    size: number,
    font: PDFFont,
    color: Color = FARBE.ink,
    schraeg = false,
  ) => {
    if (p)
      p.drawText(zeichenbar(t, s), {
        x,
        y,
        size,
        font,
        color,
        ...(schraeg ? { ySkew: degrees(11) } : {}),
      });
  };
  const { strasse, rest: restRoh } = a.adresse.length
    ? adresseTeile(a.adresse)
    : { strasse: '', rest: '' };
  const rest = restRoh.replaceAll(' · ', ', ');

  // 1. Kopf: „Bewerbung um die Wohnung“, die Straße, darunter Geschoss und Ort.
  let y = H - BOGEN_OBEN - 12 * MM;
  if (strasse) {
    text('Bewerbung um die Wohnung', x0, y - 9, 9, s.regular, TINTE);
    y -= 9 * 1.35 + 2;
    const g = passendeGroesse(strasse, s.bold, 22, 15, breite, s);
    const zeilen = umbrechen(zeichenbar(strasse, s), s.bold, g, breite);
    zeilen.forEach((zeile) => {
      y -= g * 1.1;
      text(zeile, x0, y + g * 0.1, g, s.bold);
    });
    if (rest)
      for (const zeile of umbrechen(zeichenbar(rest, s), s.regular, 10.5, breite)) {
        y -= 10.5 * 1.35;
        text(zeile, x0, y, 10.5, s.regular);
      }
  } else {
    y -= 22 * 1.1;
    text('Bewerbung um eine Wohnung', x0, y, 22, s.bold);
  }
  // E39: Inserat und Einzug, leise unter dem Ort.
  for (const zeile of [a.inserat, a.einzug].filter((z): z is string => !!z?.trim()))
    for (const teil of umbrechen(zeichenbar(zeile, s), s.regular, 9, breite)) {
      y -= 9 * 1.35;
      text(teil, x0, y, 9, s.regular, TINTE);
    }

  // 2. und 3. Leitsatz und Satz der Bewerber.
  const vertrag = a.bloecke.filter((b) => !b.person.buerge && !b.person.haushalt);
  const buergen = a.bloecke.filter((b) => b.person.buerge);
  const fuerHaushalt = a.bloecke.filter((b) => b.person.haushalt);
  const leit = werIstDabeiSatz(vertrag.length, a.mitziehende, buergen.length);
  y -= 9 * MM;
  for (const zeile of umbrechen(zeichenbar(leit, s), s.bold, 12.5, breite)) {
    y -= 12.5 * 1.1;
    text(zeile, x0, y, 12.5, s.bold);
  }
  if (a.satz.trim()) {
    y -= 3;
    for (const zeile of umbrechen(zeichenbar(`„${a.satz.trim()}“`, s), s.regular, 10.5, breite)) {
      y -= 10.5 * 1.35;
      text(zeile, x0, y, 10.5, s.regular, ZITAT, true);
    }
  }

  // 4. Personen in drei gleichen Spalten.
  y -= 8 * MM + 4 * MM;
  const spalte = (breite - 2 * 8 * MM) / 3;
  const spalteX = (i: number) => x0 + i * (spalte + 8 * MM);
  const farbeVon = (person: MappenPerson) => hex(deckFarbe(aussehen, person.farbe));
  const spaltenUnten: number[] = [];
  const etikett = (t: string, x: number, yy: number) => {
    text(t, x, yy - 8.5, 8.5, s.regular, TINTE);
    return yy - 8.5 * 1.35 - 2 * MM;
  };
  const person = (
    x: number,
    yy: number,
    name: string,
    unter: string,
    art: 'flaeche' | 'umriss' | 'ring',
    farbe: Color,
  ) => {
    const w = spalte - EINZUG;
    let zy = yy;
    umbrechen(zeichenbar(name, s), s.bold, 10, w).forEach((zeile, i) => {
      zy -= 10 * 1.35;
      if (i === 0) personZeichen(p, art, farbe, x, zy);
      text(zeile, x + EINZUG, zy, passendeGroesse(zeile, s.bold, 10, 8, w, s), s.bold);
    });
    if (unter)
      for (const zeile of umbrechen(zeichenbar(unter, s), s.regular, 8.5, w)) {
        zy -= 8.5 * 1.35;
        text(zeile, x + EINZUG, zy, 8.5, s.regular, TINTE);
      }
    return zy - 3 * MM;
  };
  // Spalte 1: Im Mietvertrag
  {
    let yy = y;
    if (vertrag.length) {
      yy = etikett(GRUPPE_VERTRAG, spalteX(0), yy);
      for (const b of vertrag)
        yy = person(
          spalteX(0),
          yy,
          b.person.name,
          // Ab sechs im Mietvertrag ohne Beruf, damit „Was beiliegt“ auf Seite 1 Platz behält.
          [b.person.rolle, vertrag.length > 5 ? '' : b.person.beruf].filter(Boolean).join(', '),
          'flaeche',
          farbeVon(b.person),
        );
    }
    spaltenUnten.push(yy);
  }
  // Spalte 2: Ziehen mit ein, darunter Bürgt
  {
    let yy = y;
    if (a.mitziehende.length) {
      yy = etikett(GRUPPE_MIT, spalteX(1), yy);
      for (const m of a.mitziehende) yy = person(spalteX(1), yy, m.text, '', 'ring', FARBE.ink);
    }
    if (buergen.length) {
      if (a.mitziehende.length) yy -= 1 * MM;
      yy = etikett(GRUPPE_BUERGT, spalteX(1), yy);
      for (const b of buergen)
        yy = person(spalteX(1), yy, b.person.name, b.person.rolle, 'umriss', farbeVon(b.person));
    }
    spaltenUnten.push(yy);
  }
  // Spalte 3: Kontakt
  {
    let yy = y;
    const kontakt = a.kontakt.filter(Boolean);
    if (kontakt.length) {
      yy = etikett('Kontakt', spalteX(2), yy);
      for (const k of kontakt) {
        // Mailadressen brechen vor dem @ um, Namen an Leerzeichen; gekürzt wird nie.
        const teile =
          breiteVon(k, s.regular, 9.5, s) <= spalte
            ? [k]
            : k.includes('@')
              ? k.replace('@', '\n@').split('\n')
              : umbrechen(zeichenbar(k, s), s.regular, 9.5, spalte);
        for (const zeile of teile) {
          yy -= 9.5 * 1.5;
          text(
            zeile,
            spalteX(2),
            yy,
            passendeGroesse(zeile, s.regular, 9.5, 8, spalte, s),
            s.regular,
          );
        }
      }
    }
    spaltenUnten.push(yy);
  }
  y = Math.min(...spaltenUnten);

  // Die Löschbitte (PC32, DP32 F1): unten links direkt über „Erstellt mit Hefta“, 8 pt grau, ohne Etikett,
  // nur auf Seite 1.
  const bitte = a.bitte?.trim();
  const bitteZeilen = bitte ? umbrechen(zeichenbar(bitte, s), s.regular, 8, breite) : [];
  const fussZeilen = a.hinweis ? 4 : 0;
  // 5. „Was beiliegt“: je Person der Name mit Zeichen, darunter eine Zeile je Unterlage.
  // Untere Grenze des Verzeichnisses: über „Erstellt mit Hefta“ und der Bitte (Seite 1) oder über der Fußzeile.
  const grenze = () =>
    FUSS_LINIE +
    6 * MM +
    (n === 0 && fussZeilen + bitteZeilen.length
      ? (fussZeilen + bitteZeilen.length) * 8 * 1.35 + 4 * MM
      : 0);
  let blockJetzt: MappenBlock | null = null;
  const zeile = (e: Eintrag) => {
    // Nur wenn eine einzelne Person mehr Unterlagen hat, als auf eine Seite passen, wird sie geteilt;
    // auf der neuen Seite steht ihr Name wieder.
    if (y - 10 * 1.35 - 3 < grenze()) {
      zweiteSeite();
      if (blockJetzt) nameZeile(blockJetzt);
    }
    const x = x0 + EINZUG;
    const nummer = ziffern(e);
    const nummerBreite = Math.max(s.regular.widthOfTextAtSize(nummer, 10), 9 * MM);
    const w = x0 + breite - x - nummerBreite - 3 * MM;
    const beschrieben = beschriftung(e.teil);
    // Zu lange Bezeichnungen werden kleiner, nie gekürzt; erst zuletzt brechen sie um.
    const g = passendeGroesse(beschrieben, s.regular, 10, 8, w, s);
    const teile = umbrechen(zeichenbar(beschrieben, s), s.regular, g, w);
    const yErste = y - 1.5 - g;
    teile.forEach((t, i) => {
      y -= (i === 0 ? 1.5 : 0) + g * 1.35;
      text(t, x, y, g, s.regular);
    });
    const zahlBreite = s.regular.widthOfTextAtSize(nummer, g);
    text(nummer, x0 + breite - zahlBreite, y, g, s.regular);
    const ende = x + s.regular.widthOfTextAtSize(teile.at(-1) ?? '', g) + 3 * MM;
    const bis = x0 + breite - nummerBreite - 3 * MM;
    // Zeile ohne Seiten (DP45): keine Punkte, keine Zahl, kein Sprung.
    if (!e.von) {
      y -= 1.5;
      return;
    }
    if (p && ende < bis)
      p.drawLine({
        start: { x: ende, y: y + 1 },
        end: { x: bis, y: y + 1 },
        thickness: 0.5,
        color: LINIE_PUNKTE,
        dashArray: [0.5, 1.5],
      });
    links.push({ seite: n, rect: [x, y - 3, x0 + breite, yErste + g + 2], ziel: e.von });
    y -= 1.5;
  };
  const nameZeile = (b: MappenBlock) => {
    y -= 4 * MM;
    const w = breite - EINZUG;
    umbrechen(zeichenbar(b.person.name, s), s.bold, 10, w).forEach((t, i) => {
      y -= 10 * 1.35;
      if (i === 0 && !b.person.haushalt)
        personZeichen(p, b.person.buerge ? 'umriss' : 'flaeche', farbeVon(b.person), x0, y);
      text(t, x0 + EINZUG, y, 10, s.bold);
    });
    y -= 2;
  };
  const block = (b: MappenBlock) => {
    const zeilen = eintraege.filter((e) => e.block === b);
    if (!zeilen.length) return;
    blockJetzt = b;
    nameZeile(b);
    for (const e of zeilen) zeile(e);
    blockJetzt = null;
  };
  // Seite 2: Briefkopf wie in der Selbstauskunft, dann wieder „Was beiliegt“ im selben Satz.
  const zweiteSeite = () => {
    n += 1;
    p = seite(n);
    const linie = p
      ? briefkopf(p, { strasse, rest, namen: a.fussName }, s)
      : H - BOGEN_OBEN - 8.5 - 4 * MM;
    y = linie - 10 * MM;
    abschnittKopf(p, 'Was beiliegt', x0, breite, y - 8, s.bold);
    y -= 8 + 5;
  };

  const leer = !eintraege.length;
  if (a.inhaltsverzeichnis && (!leer || a.schritt === 'besichtigung')) {
    y -= 8 * MM;
    abschnittKopf(p, 'Was beiliegt', x0, breite, y - 8, s.bold);
    y -= 8 + 5;
  }
  if (a.inhaltsverzeichnis && leer && a.schritt === 'besichtigung') {
    // DP27, PC19 B9: Sparsam zur Besichtigung liegt nichts bei; statt einer leeren Liste ein Satz.
    y -= 4 * MM;
    for (const z of umbrechen(
      'Zur Besichtigung nur dieses Deckblatt. Die Unterlagen folgen auf Wunsch.',
      s.regular,
      10.5,
      breite,
    )) {
      y -= 10.5 * 1.35;
      text(z, x0, y, 10.5, s.regular);
    }
  } else if (a.inhaltsverzeichnis && !leer) {
    // Zeilen je Person (Name plus Unterlagen); eine Person wird nie geteilt (DP30, Abschnitt 3).
    // DP45 G1: „Für den Haushalt“ vor den Personen.
    const reihe = [...fuerHaushalt, ...vertrag, ...buergen].filter((b) =>
      eintraege.some((e) => e.block === b),
    );
    const zeilenVon = (b: MappenBlock) => 1 + eintraege.filter((e) => e.block === b).length;
    let platz = verzeichnisPlatz(a, bitteZeilen.length);
    let belegt = 0;
    for (const b of reihe) {
      const erste = b === buergen.find((x) => reihe.includes(x));
      // Ist oben kein Platz (sehr viele Personen), beginnt das Verzeichnis gleich auf Seite 2.
      if ((belegt > 0 || platz <= 0) && belegt + zeilenVon(b) > platz) {
        zweiteSeite();
        // Jede weitere Seite hat oben nur den Briefkopf (Fall sehr vieler Unterlagen).
        platz = 2 * VERZEICHNIS_ZEILEN + 2;
        belegt = 0;
      }
      if (erste) {
        y -= 5 * MM;
        text('Bürgschaft', x0, y - 8.5, 8.5, s.regular, TINTE);
        y -= 8.5 * 1.35;
      }
      block(b);
      belegt += zeilenVon(b);
    }
  }
  // 7. Unten links, nur auf Seite 1: Fassung, die Bitte, „Erstellt mit Hefta“ und die Lesehilfe als Text.
  const erste = seite(0);
  if (!a.hinweis && erste && bitteZeilen.length) {
    const unten = FUSS_LINIE + 6 * MM;
    bitteZeilen.forEach((t, i) => {
      const yy = unten + (bitteZeilen.length - 1 - i) * 8 * 1.35;
      schreiben(erste, t, s, { x: x0, y: yy, size: 8, font: s.regular, color: TINTE });
    });
  }
  if (a.hinweis && erste) {
    const unten = FUSS_LINIE + 6 * MM;
    const lesehilfe = `Lesehilfe: ${VERMIETER_DOMAIN}`;
    const zeilen = [
      // V7 (E223): „Fassung n vom …“ steht immer da, auch ohne Heft, mit demselben Zeitpunkt wie `erstellt`.
      `Fassung ${a.lesehilfeWerte?.fassung ?? 1} vom ${DECK_DATUM.format(a.datum ?? new Date())}`,
      ...bitteZeilen,
      `Erstellt mit ${APP_NAME}`,
      lesehilfe,
    ];
    zeilen.forEach((t, i) => {
      const yy = unten + (zeilen.length - 1 - i) * 8 * 1.35;
      // DP71: Fassung und Bitte in Tinte; „Erstellt mit …“ und die Lesehilfe dürfen grau bleiben.
      const leise = t === `Erstellt mit ${APP_NAME}` || t === lesehilfe;
      schreiben(erste, t, s, {
        x: x0,
        y: yy,
        size: 8,
        font: s.regular,
        color: leise ? GRAU : TINTE,
      });
    });
    links.push({
      seite: 0,
      rect: [x0, unten - 2, x0 + breiteVon(lesehilfe, s.regular, 8, s), unten + 8],
      uri: VERMIETER_ADRESSE,
    });
  }
  return { seiten: n + 1, links };
}

interface Punkt {
  titel: string;
  seite: PDFPage;
  kinder?: Punkt[];
}

/** Lesezeichen über die Low-Level-Objekte von pdf-lib; Ziel ist ein Verweis auf das Seitenobjekt. */
function lesezeichenSetzen(pdf: PDFDocument, punkte: Punkt[], s: S) {
  if (!punkte.length) return;
  const ctx = pdf.context;
  const wurzel = ctx.nextRef();
  const bauen = (liste: Punkt[], eltern: PDFRef) => {
    const refs = liste.map(() => ctx.nextRef());
    let anzahl = liste.length;
    liste.forEach((punkt, i) => {
      const d = ctx.obj({}) as PDFDict;
      d.set(PDFName.of('Title'), PDFHexString.fromText(zeichenbar(punkt.titel, s)));
      d.set(PDFName.of('Parent'), eltern);
      d.set(PDFName.of('Dest'), ctx.obj([punkt.seite.ref, PDFName.of('Fit')]));
      if (refs[i - 1]) d.set(PDFName.of('Prev'), refs[i - 1]!);
      if (refs[i + 1]) d.set(PDFName.of('Next'), refs[i + 1]!);
      if (punkt.kinder?.length) {
        const k = bauen(punkt.kinder, refs[i]!);
        d.set(PDFName.of('First'), k.erstes);
        d.set(PDFName.of('Last'), k.letztes);
        d.set(PDFName.of('Count'), PDFNumber.of(k.anzahl));
        anzahl += k.anzahl;
      }
      ctx.assign(refs[i]!, d);
    });
    return { erstes: refs[0]!, letztes: refs.at(-1)!, anzahl };
  };
  const { erstes, letztes, anzahl } = bauen(punkte, wurzel);
  const d = ctx.obj({}) as PDFDict;
  d.set(PDFName.of('Type'), PDFName.of('Outlines'));
  d.set(PDFName.of('First'), erstes);
  d.set(PDFName.of('Last'), letztes);
  d.set(PDFName.of('Count'), PDFNumber.of(anzahl));
  ctx.assign(wurzel, d);
  pdf.catalog.set(PDFName.of('Outlines'), wurzel);
  pdf.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
}

export async function bewerbungBauen(auftrag: BewerbungAuftrag): Promise<BewerbungErgebnis> {
  // Ein Zeitpunkt für alles: Fassungszeile, Erstelldatum der PDF und `erstellt` der Lesehilfe (V7, V11).
  const a: BewerbungAuftrag = { ...auftrag, datum: auftrag.datum ?? new Date() };
  // updateMetadata: false verhindert Producer/Creator mit Softwarenamen.
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(a.schriften.regular, { subset: true });
  const bold = await pdf.embedFont(a.schriften.bold, { subset: true });
  const titel = await pdf.embedFont(a.schriften.titel, { subset: true });
  const ersetzt = new Set<string>();
  const unlesbar = new Map<string, UnlesbareDatei>();
  const s: S = { regular, bold, titel, ersetzen: zeichenErsetzer(regular, ersetzt) };

  // Zuerst messen, wie viele Seiten das Deckblatt braucht: Davon hängen alle Seitenzahlen ab.
  const leer: Eintrag[] = a.bloecke.flatMap((block) =>
    // Breite Seitenzahlen: Ein Deckblatt, das so passt, passt auch mit den echten.
    block.teile.map((teil) => ({ block, teil, von: 888, bis: 889, monate: [] })),
  );
  const vorne = a.deckblatt ? deckblatt(a, leer, s, () => null).seiten : 0;
  const deckblaetter = Array.from({ length: vorne }, () => pdf.addPage([A4.breite, A4.hoehe]));

  const eintraege: Eintrag[] = [];
  const fremde: BewerbungErgebnis['fremde'] = [];
  // Kopfzeile je Seite, gezeichnet zum Schluss, wenn die Gesamtzahl feststeht.
  const baender: { seite: PDFPage; person: MappenPerson; rechts: string }[] = [];
  const aussehen: MappenAussehen = a.aussehen ?? { art: 'schlicht' };
  const auskunftSchriften: AuskunftSchriften = { regular, bold, titel, ersetzen: s.ersetzen };
  // Seiten im Briefbogen (Deckblatt, Selbstauskunft): Fußzeile mit dessen Rändern (DP30).
  const bogen = new Set<PDFPage>(deckblaetter);
  const kopfTeile = a.adresse.length ? adresseTeile(a.adresse) : { strasse: '', rest: '' };
  const bogenKopf = {
    strasse: kopfTeile.strasse,
    rest: kopfTeile.rest.replaceAll(' · ', ', '),
    namen: a.fussName,
  };

  const schritte = a.bloecke.reduce(
    (n, b) => n + b.teile.reduce((m, teil) => m + teil.quellen.length, 0),
    1,
  );
  let erledigt = 0;
  let zuletztGezeichnet = performance.now();
  async function weiter() {
    if (!a.fortschritt) return;
    a.fortschritt(++erledigt, schritte);
    // Höchstens alle 50 ms eine Pause, damit Linie und Zahl auf den Bildschirm kommen.
    if (performance.now() - zuletztGezeichnet > 50) {
      await new Promise((fertig) => setTimeout(fertig, 0));
      zuletztGezeichnet = performance.now();
    }
  }
  a.fortschritt?.(0, schritte);

  for (const block of a.bloecke) {
    for (const teil of block.teile) {
      const eintrag: Eintrag = {
        block,
        teil,
        von: pdf.getPageCount() + 1,
        bis: 0,
        monate: [],
      };
      const standard = teil.kopf ?? teil.abschnitt;
      if (teil.auskunft) {
        // DP30: Die Selbstauskunft trägt den Briefkopf der Mappe statt der Kopfzeile mit dem Namen.
        const seiten = selbstauskunftZeichnen(pdf, auskunftSchriften, {
          ...teil.auskunft,
          farbe: teil.auskunft.farbe && deckFarbe(aussehen, teil.auskunft.farbe),
          buerge: block.person.buerge,
          mitHinweis: a.hinweis,
          briefkopf: bogenKopf,
        });
        for (const seite of seiten) bogen.add(seite);
      }
      for (const q of teil.quellen) {
        const kopf = q.kopf ?? standard;
        const uebernommen = await quelleUebernehmen(pdf, q, a.alsBilder);
        await weiter();
        if (!uebernommen) {
          const meldung = teil.meldung ?? { name: `${kopf}, ${block.person.name}` };
          // PC126 K5: die Unterlage, wie sie im Verzeichnis stünde, und die Datei, die nicht aufging.
          unlesbar.set(meldung.name, {
            ...meldung,
            unterlage: beschriftung(teil),
            datei: q.datei ?? unlesbar.get(meldung.name)?.datei,
          });
          continue;
        }
        if (q.kopf) eintrag.monate.push({ titel: q.kopf, seite: pdf.getPageCount() + 1 });
        const { seiten: seitenQuelle, eingebettet } = uebernommen;
        for (const [k, e] of eingebettet.entries()) {
          // Eine Seite, die nur über /Rotate aufrecht steht, bleibt so, wie man sie sieht (P14).
          const drehung = ((seitenQuelle[k]!.getRotation().angle % 360) + 360) % 360;
          const breite = drehung % 180 ? e.height : e.width;
          const hoehe = drehung % 180 ? e.width : e.height;
          // Immer A4 hochkant, auch bei Querformat: So steht beim Drucken jede Kopfzeile oben.
          const B = A4.breite;
          const H = A4.hoehe;
          const seite = pdf.addPage([B, H]);
          const x0 = a.fusszeile ? UNTERLAGE_SEITE : RAND_SEITE;
          const x1 = B - x0;
          const y0 = a.fusszeile ? INHALT_UNTEN : RAND_SEITE;
          const y1 = H - (a.fusszeile ? INHALT_OBEN : RAND_SEITE);
          // Eingepasst, nie vergrößert, nie verzerrt; oben angelegt, waagerecht mittig.
          const skala = Math.min((x1 - x0) / breite, (y1 - y0) / hoehe, 1);
          const w = breite * skala;
          const h = hoehe * skala;
          const tx = x0 + (x1 - x0 - w) / 2;
          const ty = y1 - h;
          const lage =
            drehung === 90
              ? { x: tx, y: ty + h, rotate: degrees(-90) }
              : drehung === 180
                ? { x: tx + w, y: ty + h, rotate: degrees(180) }
                : drehung === 270
                  ? { x: tx + w, y: ty, rotate: degrees(90) }
                  : { x: tx, y: ty };
          seite.drawPage(e, { ...lage, xScale: skala, yScale: skala });
          seite.drawRectangle({
            x: tx,
            y: ty,
            width: w,
            height: h,
            borderColor: RAHMEN,
            borderWidth: 0.4,
          });
          fremde.push({
            seite: pdf.getPageCount(),
            skala,
            box: { x0: tx, y0: ty, x1: tx + w, y1: ty + h },
          });
          baender.push({
            seite,
            person: block.person,
            rechts:
              eingebettet.length > 1 ? `${kopf}, Seite ${k + 1} von ${eingebettet.length}` : kopf,
          });
        }
      }
      eintrag.bis = pdf.getPageCount();
      if (eintrag.bis >= eintrag.von) eintraege.push(eintrag);
      else if (teil.nurZeile) eintraege.push({ ...eintrag, von: 0, bis: 0 });
    }
  }

  const seiten = pdf.getPages();
  const gesamt = seiten.length;
  let deckMassstab: number | undefined;
  let deckSeiten: number | undefined;
  if (a.deckblatt) {
    const {
      links,
      massstab,
      seiten: deckAnzahl,
    } = deckblatt(a, eintraege, s, (n) => deckblaetter[n] ?? null);
    deckMassstab = massstab;
    deckSeiten = deckAnzahl;
    for (const l of links) {
      const ziel = l.ziel ? seiten[l.ziel - 1] : undefined;
      if (!ziel && !l.uri) continue;
      seiten[l.seite]!.node.addAnnot(
        pdf.context.register(
          pdf.context.obj({
            Type: 'Annot',
            Subtype: 'Link',
            Rect: l.rect,
            Border: [0, 0, 0],
            ...(ziel
              ? { Dest: [ziel.ref, PDFName.of('Fit')] }
              : { A: { Type: 'Action', S: 'URI', URI: PDFString.of(l.uri!) } }),
          }),
        ),
      );
    }
  }
  const fussLinks = a.kurz ? `Bewerbung ${a.kurz}, ${a.fussName}` : `Bewerbung, ${a.fussName}`;
  if (a.fusszeile) {
    for (const b of baender) kopfzeile(b.seite, b.person, b.rechts, s, aussehen);
    seiten.forEach((seite, i) =>
      fussleiste(
        seite,
        fussLinks,
        i + 1,
        gesamt,
        s,
        bogen.has(seite) ? BOGEN_SEITE : UNTERLAGE_SEITE,
      ),
    );
  } else if (a.deckblatt && a.hinweis && a.kennung) {
    // V8 (E223): „Seite 1 von N“ steht immer im Fuß des Deckblatts, sobald eine Lesehilfe beiliegt, auch ohne
    // Kopf- und Fußzeile. Die übrigen Seiten bleiben ohne.
    for (const seite of deckblaetter)
      fussleiste(seite, fussLinks, seiten.indexOf(seite) + 1, gesamt, s, BOGEN_SEITE);
  }

  // Lesezeichen: Person, darunter ihre Unterlagen, bei Serien die Monate; Bürgen unter „Bürgschaft“.
  const personPunkt = (block: MappenBlock): Punkt | null => {
    const eigene = eintraege.filter((e) => e.block === block && e.von > 0);
    if (!eigene.length) return null;
    return {
      titel: block.person.rolle
        ? `${block.person.name} (${block.person.rolle})`
        : block.person.name,
      seite: seiten[eigene[0]!.von - 1]!,
      kinder: eigene.map((e) => ({
        titel: beschriftung(e.teil),
        seite: seiten[e.von - 1]!,
        kinder:
          e.monate.length > 1
            ? e.monate.map((m) => ({ titel: m.titel, seite: seiten[m.seite - 1]! }))
            : undefined,
      })),
    };
  };
  const punkte: Punkt[] = [];
  if (a.deckblatt && deckblaetter[0]) punkte.push({ titel: 'Deckblatt', seite: deckblaetter[0] });
  for (const b of a.bloecke.filter((x) => !x.person.buerge)) {
    const p = personPunkt(b);
    if (p) punkte.push(p);
  }
  const buergen = a.bloecke.filter((x) => x.person.buerge).flatMap((b) => personPunkt(b) ?? []);
  if (buergen.length && a.bloecke.length > 1)
    punkte.push({ titel: 'Bürgschaft', seite: buergen[0]!.seite, kinder: buergen });
  else punkte.push(...buergen);
  lesezeichenSetzen(pdf, punkte, s);

  const datum = a.datum!;
  // Die Lesehilfe für Vermieter, nur mit Deckblatt und Hinweis (docs/format-hefta-json.md).
  // Fassung 1: ohne Kennung der Bewerbung keine Lesehilfe (E21, Schema).
  if (a.deckblatt && a.hinweis && a.kennung) {
    // DP45 G1: Unterlagen für den Haushalt stehen (noch) nicht in der Lesehilfe; sie kennt nur Personen.
    const menschen = a.bloecke.filter((b) => !b.person.haushalt);
    // Dieselben Ersetzungen wie auf dem Papier: Regel 1 des Formats, P26.
    const anhang = anhangBauen({
      datum,
      kennung: a.kennung,
      adresse: a.adresse.map(s.ersetzen),
      fassung: a.lesehilfeWerte?.fassung,
      portal: a.lesehilfeWerte?.portal && s.ersetzen(a.lesehilfeWerte.portal),
      einzug: a.lesehilfeWerte?.einzug,
      personen: menschen.map((b) => ({
        name: s.ersetzen(b.person.name),
        ...(b.person.vorname !== undefined
          ? {
              vorname: s.ersetzen(b.person.vorname),
              nachname: s.ersetzen(b.person.nachname ?? ''),
            }
          : {}),
        rolle: b.person.rolleId,
        buerge: b.person.buerge,
      })),
      kontakt: a.kontakt.some(Boolean),
      kontaktwege: a.kontaktwege && {
        telefon: a.kontaktwege.telefon && s.ersetzen(a.kontaktwege.telefon),
        telefonE164: a.kontaktwege.telefonE164,
        email: a.kontaktwege.email && s.ersetzen(a.kontaktwege.email),
      },
      mitziehende: a.mitziehende.map((m) => ({ ...m, text: s.ersetzen(m.text) })),
      unterlagen: eintraege
        .filter((e) => !e.block.person.haushalt && e.von > 0)
        .map((e) => ({
          person: menschen.indexOf(e.block),
          typ: e.teil.typ,
          von: e.von,
          bis: e.bis,
          monate: e.teil.monate,
          vom: e.teil.vom,
          pruefweg: e.teil.pruefweg,
        })),
      seitenzahl: pdf.getPageCount(),
      modus: a.modus,
      schritt: a.schritt,
      loeschwunsch: a.bitte === undefined ? undefined : s.ersetzen(a.bitte),
    });
    await pdf.attach(anhangBytes(anhang), ANHANG_NAME, {
      mimeType: 'application/json',
      description: 'Lesehilfe für Vermieter',
      creationDate: datum,
      modificationDate: datum,
      afRelationship: AFRelationship.Data,
    });
  }
  pdf.setTitle(a.titel);
  if (a.autor) pdf.setAuthor(a.autor);
  pdf.setLanguage('de-DE');
  pdf.setCreationDate(datum);
  pdf.setModificationDate(datum);

  const inhalt: BewerbungErgebnis['inhalt'] = a.bloecke.flatMap((block) => {
    const eigene = eintraege.filter((e) => e.block === block && e.von > 0);
    return eigene.length
      ? [
          {
            person: block.person.name,
            seite: eigene[0]!.von,
            teile: eigene.map((e) => ({
              abschnitt: e.teil.abschnitt,
              seite: e.von,
              bis: e.bis,
            })),
          },
        ]
      : [];
  });
  const bytes = await pdf.save();
  a.fortschritt?.(schritte, schritte);
  return {
    bytes,
    seiten: gesamt,
    inhalt,
    fremde,
    ersetzt: [...ersetzt],
    unlesbar: [...unlesbar.values()],
    deckMassstab,
    deckSeiten,
  };
}
