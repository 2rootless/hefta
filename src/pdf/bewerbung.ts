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
import {
  A4,
  AKZENTE,
  deckFarbe,
  druckTon,
  FARBE,
  FLAECHE_LINIE,
  flaechenTon,
  flaecheVon,
  type Schriften,
} from './mappe';
import {
  rundesRechteck,
  selbstauskunftZeichnen,
  umbrechen,
  zeichenErsetzer,
  type SelbstauskunftInhalt,
  type AuskunftSchriften,
} from './selbstauskunft';

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
}

export interface MappenQuelle {
  daten: Uint8Array;
  /** Ausgewählte Seiten (0-basiert), sonst alle. */
  seiten?: number[] | null;
  /** Text rechts in der Kopfzeile, wenn er von der Unterlage abweicht („Gehaltsnachweis August 2026“). */
  kopf?: string;
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
  /** Kurzform der Wohnung für die Fußzeile („Hauptstraße 12“). */
  kurz?: string;
  /** Adresse der Wohnung in Zeilen; leer: der Name steht als Titel. */
  adresse: string[];
  satz: string;
  /** B14, E39: „Zu Ihrem Inserat auf ImmoScout24“ und „Einzug möglich ab …“ im Kopf unter der Lage. */
  inserat?: string;
  einzug?: string;
  /** B14, E39: „Fassung 2 vom 8. November 2026“, leise unten in der Leiste. */
  fassung?: string;
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
  kontaktwege?: { telefon?: string; email?: string };
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
  /** Wie viele Seiten das Deckblatt hat, und ob „Kompakt“ es auf eine bekäme (AM5b). */
  deckSeiten?: number;
  kompaktHilft?: boolean;
}

const MM = 72 / 25.4;
// Maße aus design/mappe-pdf.md, „Unterlagenseite“.
const RAND_SEITE = 12 * MM;
const BAND_HOEHE = 14 * MM;
const QUADRAT = 2.8 * MM;
const BAND_LINIE = 9 * MM;
const INHALT_OBEN = 19 * MM;
const INHALT_UNTEN = 16 * MM;
const FUSS_TEXT = 9 * MM;
const FUSS_LINIE = 13 * MM;
/** Rahmen um fremde Seiten und Punktlinien, warm (B14, mappe14.py `.us .fremd`). */
const RAHMEN = rgb(0xd5 / 255, 0xce / 255, 0xc4 / 255);
const FUSS_FARBE = rgb(0xe4 / 255, 0xe6 / 255, 0xef / 255);
/** Nebentext, der auch im harten Schwarzweiß und beim Tonersparen lesbar bleibt (P17). */
/** Leise Schrift in warmer Tinte (B14, LEISE). */
const DRUCK = rgb(0x43 / 255, 0x3d / 255, 0x37 / 255);

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

/** Kopfzeile (design/mappe-pdf.md): Schrift und eine Linie über den Satzspiegel, Farbe nur als Zusatz. */
function kopfzeile(
  seite: PDFPage,
  p: MappenPerson,
  rechts: string,
  s: S,
  aussehen: MappenAussehen,
) {
  const { width: B, height: H } = seite.getSize();
  const eineFarbe = aussehen.art === 'einefarbe';
  seite.drawLine({
    start: { x: RAND_SEITE, y: H - BAND_HOEHE },
    end: { x: B - RAND_SEITE, y: H - BAND_HOEHE },
    thickness: eineFarbe ? 1 : 0.6,
    color: eineFarbe ? hex(AKZENTE[aussehen.akzent ?? 'tanne']) : FARBE.ink,
  });
  // Farben der Personen: ein Quadrat vor dem Namen, bei Bürgen als Umriss.
  const vorName = aussehen.art === 'personen' ? QUADRAT + 1.6 * MM : 0;
  const platz = B - 2 * RAND_SEITE - 14 - vorName;
  let rolle = p.buerge ? ' · Bürgschaft' : ` · ${p.rolle}`;
  const passt = (g: number) =>
    breiteVon(p.name, s.bold, g, s) +
      breiteVon(rolle, s.regular, g, s) +
      breiteVon(rechts, s.regular, g, s) <=
    platz;
  // Namen nie kürzen: erst kleiner, bis 7,5 pt, dann ohne Rolle.
  let groesse = 9.5;
  while (groesse > 7.5 && !passt(groesse)) groesse -= 0.5;
  if (!passt(groesse)) {
    rolle = '';
    while (groesse > 6.5 && !passt(groesse)) groesse -= 0.25;
  }
  const y = H - BAND_LINIE;
  if (vorName) {
    const unten = y + groesse * 0.35 - QUADRAT / 2;
    const farbe = hex(druckTon(p.farbe));
    seite.drawRectangle({
      x: RAND_SEITE,
      y: unten,
      width: QUADRAT,
      height: QUADRAT,
      ...(p.buerge ? { borderColor: farbe, borderWidth: 0.9 } : { color: farbe }),
    });
  }
  schreiben(seite, p.name, s, {
    x: RAND_SEITE + vorName,
    y,
    size: groesse,
    font: s.bold,
    color: FARBE.ink,
  });
  if (rolle)
    schreiben(seite, rolle, s, {
      x: RAND_SEITE + vorName + breiteVon(p.name, s.bold, groesse, s),
      y,
      size: groesse,
      font: s.regular,
      color: FARBE.ink,
    });
  schreiben(seite, rechts, s, {
    x: B - RAND_SEITE - breiteVon(rechts, s.regular, groesse, s),
    y,
    size: groesse,
    font: s.regular,
    color: FARBE.ink,
  });
}

function fussleiste(seite: PDFPage, links: string, nummer: number, gesamt: number, s: S) {
  const { width: B } = seite.getSize();
  seite.drawLine({
    start: { x: RAND_SEITE, y: FUSS_LINIE },
    end: { x: B - RAND_SEITE, y: FUSS_LINIE },
    thickness: 0.5,
    color: FUSS_FARBE,
  });
  const rechts = `Seite ${nummer} von ${gesamt}`;
  const rechtsBreite = s.regular.widthOfTextAtSize(rechts, 8);
  // Passt die Zeile nicht in die linke Hälfte, wird sie kleiner bis 6,5 pt, dann bricht sie vor der
  // Seitenzahl um. Nachnamen werden nie gekürzt.
  const groesse = passendeGroesse(links, s.regular, 8, 6.5, (B - 2 * RAND_SEITE) / 2, s);
  const zeilen = umbrechen(
    zeichenbar(links, s),
    s.regular,
    groesse,
    B - 2 * RAND_SEITE - rechtsBreite - 12,
  );
  zeilen.forEach((zeile, i) =>
    seite.drawText(zeile, {
      x: RAND_SEITE,
      y: FUSS_TEXT + (zeilen.length - 1) * 3.5 - i * 7.5,
      size: groesse,
      font: s.regular,
      color: DRUCK,
    }),
  );
  seite.drawText(rechts, {
    x: B - RAND_SEITE - rechtsBreite,
    y: FUSS_TEXT,
    size: 8,
    font: s.regular,
    color: FARBE.ink,
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

const ziffern = (e: Pick<Eintrag, 'von' | 'bis'>) =>
  e.von === e.bis ? String(e.von) : `${e.von}–${e.bis}`;

const beschriftung = (t: MappenTeil) => (t.detail ? `${t.abschnitt}, ${t.detail}` : t.abschnitt);

interface DeckLink {
  seite: number;
  rect: number[];
  /** Seite der Mappe, auf die der Eintrag führt. */
  ziel?: number;
  /** Oder eine Adresse: die Zeile zur Lesehilfe. Text und Ziel sind dieselbe Adresse. */
  uri?: string;
}

/** Ton der Seitenleiste; Personenfarbe heißt die der Hauptperson, gibt es keine, die der ersten. */
export function leistenTon(
  aussehen: MappenAussehen,
  bloecke: { person: Pick<MappenPerson, 'farbe' | 'rolleId'> }[],
): string | null {
  const person = bloecke.find((b) => b.person.rolleId === 'hauptmieter') ?? bloecke[0];
  return flaechenTon(flaecheVon(aussehen), aussehen.akzent, person?.person.farbe);
}

function rundesFeld(
  seite: PDFPage,
  x: number,
  unten: number,
  breite: number,
  hoehe: number,
  r: number,
  farbe: { color: Color } | { borderColor: Color; borderWidth: number },
) {
  const k = r * 0.5523;
  const pfad = [
    `M ${r} 0 L ${breite - r} 0`,
    `C ${breite - r + k} 0 ${breite} ${r - k} ${breite} ${r}`,
    `L ${breite} ${hoehe - r}`,
    `C ${breite} ${hoehe - r + k} ${breite - r + k} ${hoehe} ${breite - r} ${hoehe}`,
    `L ${r} ${hoehe}`,
    `C ${r - k} ${hoehe} 0 ${hoehe - r + k} 0 ${hoehe - r}`,
    `L 0 ${r}`,
    `C 0 ${r - k} ${r - k} 0 ${r} 0 Z`,
  ].join(' ');
  seite.drawSvgPath(pfad, { x, y: unten + hoehe, ...farbe });
}

const DECK_MASSSTAEBE = [1.3, 1.25, 1.2, 1.15, 1.1, 1.05];
const DECK_KOMPAKT = [0.95, 0.9, 0.85];
/** So tief darf der Inhalt höchstens reichen, bevor der Maßstab nicht weiter wächst. */
const DECK_LUFT = 40 * MM;
/** Volle Leiste (mappe-pdf.md): erst bis 85 % kleiner, dann ohne Beruf, zuletzt ohne „Bürgschaft“. Nie unter 7 pt. */
const LEISTE_STUFEN: { kl: number; ohneBeruf: boolean; ohneBuergen: boolean }[] = [
  { kl: 1, ohneBeruf: false, ohneBuergen: false },
  { kl: 0.95, ohneBeruf: false, ohneBuergen: false },
  { kl: 0.9, ohneBeruf: false, ohneBuergen: false },
  { kl: 0.85, ohneBeruf: false, ohneBuergen: false },
  { kl: 0.85, ohneBeruf: true, ohneBuergen: false },
  { kl: 0.85, ohneBeruf: true, ohneBuergen: true },
];

/**
 * Deckblatt mit Seitenleiste (design/mappe-pdf.md, „Deckblatt neu“, MP1 bis MP9). Schrift und senkrechte
 * Abstände wachsen gemeinsam, damit auch eine kurze Mappe nicht leer wirkt. Passt der Inhalt schon im
 * kleinsten Maßstab nicht, geht „Was beiliegt“ auf der nächsten Seite weiter. Ohne `seite` wird nur gemessen.
 */
function deckblatt(
  a: BewerbungAuftrag,
  eintraege: Eintrag[],
  s: S,
  seite: (n: number) => PDFPage | null,
): { seiten: number; links: DeckLink[]; massstab: number; kompaktHilft: boolean } {
  for (const k of DECK_MASSSTAEBE) {
    const probe = deckblattSetzen(a, eintraege, s, () => null, k);
    if (probe.seiten === 1 && probe.tiefste >= DECK_LUFT) {
      return { ...deckblattSetzen(a, eintraege, s, seite, k), massstab: k, kompaktHilft: false };
    }
  }
  // Kompakt (mappe-feinschliff.md, § 4): Passt es bei 1,0 nicht, in Schritten bis 0,85; sonst bleibt es bei 1,0.
  let kompaktHilft = false;
  if (deckblattSetzen(a, eintraege, s, () => null, 1).seiten > 1) {
    for (const k of DECK_KOMPAKT) {
      if (deckblattSetzen(a, eintraege, s, () => null, k).seiten !== 1) continue;
      kompaktHilft = true;
      if (a.aussehen?.kompakt) {
        return { ...deckblattSetzen(a, eintraege, s, seite, k), massstab: k, kompaktHilft };
      }
      break;
    }
  }
  return { ...deckblattSetzen(a, eintraege, s, seite, 1), massstab: 1, kompaktHilft };
}

function deckblattSetzen(
  a: BewerbungAuftrag,
  eintraege: Eintrag[],
  s: S,
  seite: (n: number) => PDFPage | null,
  K: number,
): { seiten: number; links: DeckLink[]; tiefste: number } {
  const B = A4.breite;
  const H = A4.hoehe;
  const aussehen: MappenAussehen = a.aussehen ?? { art: 'schlicht' };
  const V = (mm: number) => mm * MM * K;
  const F = (pt: number) => pt * K;
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
  ) => {
    if (p) schreiben(p, t, s, { x, y, size, font, color });
  };

  // Kopf über die ganze Breite: die Wohnung. Er wächst nicht mit dem Maßstab.
  const kopfX = 20 * MM;
  const kopfBreite = B - 40 * MM;
  let kopfY = H - 22 * MM;
  if (a.adresse.length) {
    const { strasse, rest } = adresseTeile(a.adresse);
    text('Bewerbung um die Wohnung', kopfX, kopfY, 9.5, s.regular, DRUCK);
    kopfY -= 9.5 * MM;
    const g = passendeGroesse(strasse, s.titel, 26, 16, kopfBreite, s);
    const zeilen = umbrechen(zeichenbar(strasse, s), s.titel, g, kopfBreite);
    zeilen.forEach((zeile, i) => {
      text(zeile, kopfX, kopfY, g, s.titel);
      kopfY -= i < zeilen.length - 1 ? g * 1.15 : 7 * MM;
    });
    if (rest) {
      for (const zeile of umbrechen(zeichenbar(rest, s), s.regular, 12, kopfBreite)) {
        text(zeile, kopfX, kopfY, 12, s.regular);
        kopfY -= 5.6 * MM;
      }
    }
  } else {
    kopfY -= 4 * MM;
    text('Bewerbung um eine Wohnung', kopfX, kopfY, 21, s.titel);
    kopfY -= 6 * MM;
  }
  // E39: Inserat und Einzug, das Erste, was ein Vermieter abgleicht. Fehlt eine, fällt ihre Zeile weg;
  // lange Portalnamen brechen um, gekürzt wird nie.
  for (const zeile of [a.inserat, a.einzug].filter((z): z is string => !!z?.trim()))
    for (const teil of umbrechen(zeichenbar(zeile, s), s.regular, 10, kopfBreite)) {
      text(teil, kopfX, kopfY, 10, s.regular, DRUCK);
      kopfY -= 4.8 * MM;
    }

  // Seitenleiste: mit wem man es zu tun hat und wie man sie erreicht.
  const leisteX = 14 * MM;
  const leisteBreite = 62 * MM;
  const leisteUnten = 20 * MM;
  const leisteOben = kopfY - 3 * MM;
  const px = leisteX + 6 * MM;
  const pw = leisteBreite - 12 * MM;
  const vertrag = a.bloecke.filter((b) => !b.person.buerge);
  const buergen = a.bloecke.filter((b) => b.person.buerge);
  const kontakt = a.kontakt.filter(Boolean);

  const leiste = (
    kl: number,
    zeichnen: boolean,
    ohneBeruf = false,
    ohneBuergen = false,
  ): number => {
    const v = (mm: number) => mm * MM * kl;
    const f = (pt: number) => pt * kl;
    const schrift = (
      t: string,
      x: number,
      yy: number,
      size: number,
      font: PDFFont,
      color: Color = FARBE.ink,
    ) => {
      if (zeichnen) text(t, x, yy, size, font, color);
    };
    let y = leisteOben - v(9);
    // Wer ist dabei (E25): oben die Kurzform als Satz, darunter die drei Gruppen. Keine Summe.
    const kurz = werIstDabeiSatz(vertrag.length, a.mitziehende, buergen.length);
    for (const zeile of umbrechen(zeichenbar(kurz, s), s.regular, f(9), pw)) {
      schrift(zeile, px, y, f(9), s.regular, DRUCK);
      y -= v(4.2);
    }
    y -= v(2.4);
    const gruppe = (titel: string) => {
      schrift(titel, px, y, f(9.5), s.bold);
      y -= v(6.2);
    };

    const eintrag = (marke: (q: number, yy: number) => void, name: string, unter: string) => {
      const q = v(2.6);
      const x2 = px + q + v(2.4);
      const w2 = pw - q - v(2.4);
      if (zeichnen && p) marke(q, y);
      // Namen brechen an Leerzeichen um und werden nie gekürzt; ein einzelnes zu breites Wort wird kleiner.
      for (const zeile of umbrechen(zeichenbar(name, s), s.bold, f(9.5), w2)) {
        schrift(zeile, x2, y, passendeGroesse(zeile, s.bold, f(9.5), 7, w2, s), s.bold);
        y -= v(4.4);
      }
      if (unter) {
        for (const zeile of umbrechen(zeichenbar(unter, s), s.regular, f(8.3), w2)) {
          schrift(zeile, x2, y, f(8.3), s.regular, DRUCK);
          y -= v(3.9);
        }
      }
      y -= v(2.6);
    };
    const quadrat = (person: MappenPerson) => (q: number, yy: number) => {
      const farbe = hex(deckFarbe(aussehen, person.farbe));
      p!.drawRectangle(
        person.buerge
          ? {
              x: px + 0.5,
              y: yy - v(0.2) + 0.5,
              width: q - 1,
              height: q - 1,
              borderColor: farbe,
              borderWidth: 1,
            }
          : { x: px, y: yy - v(0.2), width: q, height: q, color: farbe },
      );
    };
    // Wie in der App: Kinder und weitere Personen mit Ring, ohne eigene Farbe.
    const ring = (q: number, yy: number) => {
      p!.drawEllipse({
        x: px + q / 2,
        y: yy - v(0.2) + q / 2,
        xScale: q / 2 - 0.5,
        yScale: q / 2 - 0.5,
        borderColor: FARBE.ink,
        borderWidth: 1,
      });
    };
    if (vertrag.length) gruppe(GRUPPE_VERTRAG);
    for (const b of vertrag) {
      const rolle = ohneBeruf
        ? b.person.rolle
        : [b.person.rolle, b.person.beruf].filter(Boolean).join(', ');
      eintrag(quadrat(b.person), b.person.name, rolle);
    }
    if (a.mitziehende.length) {
      y -= v(1.5);
      gruppe(GRUPPE_MIT);
    }
    for (const m of a.mitziehende) eintrag(ring, m.text, '');
    if (buergen.length && !ohneBuergen) {
      y -= v(1.5);
      gruppe(GRUPPE_BUERGT);
      for (const b of buergen) eintrag(quadrat(b.person), b.person.name, b.person.rolle);
    }
    if (kontakt.length) {
      y -= v(5);
      schrift('Kontakt', px, y, f(9.5), s.bold);
      y -= v(5);
      for (const k of kontakt) {
        // Erst etwas kleiner, dann umbrechen: Namen an Leerzeichen, Mailadressen vor dem @.
        const teile =
          breiteVon(k, s.regular, f(9), s) * 0.78 <= pw
            ? [k]
            : k.includes('@')
              ? k.replace('@', '\n@').split('\n')
              : umbrechen(zeichenbar(k, s), s.regular, f(9), pw);
        for (const zeile of teile) {
          schrift(zeile, px, y, passendeGroesse(zeile, s.regular, f(9), 7.5, pw, s), s.regular);
          y -= v(4.6);
        }
      }
    }
    // Die Grundlinie der letzten Zeile, nicht die Stelle darunter.
    return y + v(4.6);
  };

  if (p) {
    const ton = leistenTon(aussehen, a.bloecke);
    rundesFeld(
      p,
      leisteX,
      leisteUnten,
      leisteBreite,
      leisteOben - leisteUnten,
      3 * MM,
      ton ? { color: hex(ton) } : { borderColor: hex(FLAECHE_LINIE), borderWidth: 0.6 },
    );
  }
  // Passt die Leiste im Maßstab 1,0 nicht, greifen die Stufen; nur für die Leiste, Kopf und rechte Spalte
  // bleiben. Die gilt als voll, wenn sie bis unter 11 mm über ihren unteren Rand reicht (P11, P24).
  const leisteTief = leiste(K, false);
  const stufe =
    K <= 1
      ? (LEISTE_STUFEN.filter((st) => st.kl <= K).find(
          (st) =>
            leiste(st.kl, false, st.ohneBeruf, st.ohneBuergen) >=
            leisteUnten + (a.fassung ? 15 : 11) * MM,
        ) ?? LEISTE_STUFEN.at(-1)!)
      : { kl: K, ohneBeruf: false, ohneBuergen: false };
  leiste(stufe.kl, true, stufe.ohneBeruf, stufe.ohneBuergen);
  if (a.hinweis) {
    // Zwei Zeilen, unter der 11-mm-Grenze der Leiste. Was man liest, ist das, wohin der Link führt; auch
    // ausgedruckt steht die Adresse da. Mit „für Vermieter“ wäre die Zeile in zwei Schriften zu breit.
    const lesehilfe = `Lesehilfe: ${VERMIETER_DOMAIN}`;
    const lesehilfeY = leisteUnten + 4.8 * MM;
    text(`Erstellt mit ${APP_NAME}`, px, leisteUnten + 8.2 * MM, 7.5, s.regular, DRUCK);
    if (a.fassung)
      text(zeichenbar(a.fassung, s), px, leisteUnten + 11.6 * MM, 7.5, s.regular, DRUCK);
    text(lesehilfe, px, lesehilfeY, 7.5, s.regular, DRUCK);
    links.push({
      seite: 0,
      rect: [px, lesehilfeY - 2, px + breiteVon(lesehilfe, s.regular, 7.5, s), lesehilfeY + 8],
      uri: VERMIETER_ADRESSE,
    });
  }

  // Rechte Spalte: der eigene Satz und was beiliegt.
  let rx = leisteX + leisteBreite + 8 * MM;
  let rw = B - 20 * MM - rx;
  let y = leisteOben - V(9);
  if (a.satz.trim()) {
    for (const zeile of umbrechen(zeichenbar(a.satz.trim(), s), s.regular, F(12), rw)) {
      text(zeile, rx, y, F(12), s.regular);
      y -= V(6.4);
    }
    y -= V(7);
  }

  const RECHTS_UNTEN = 24 * MM;
  const weiter = () => {
    n += 1;
    p = seite(n);
    rx = 20 * MM;
    rw = B - 40 * MM;
    y = H - 24 * MM;
    text('Was beiliegt (Fortsetzung)', rx, y, F(11.5), s.bold);
    y -= V(9);
  };
  const zeile = (e: Eintrag) => {
    const x = rx + V(4);
    const w = rw - V(4);
    const nummer = ziffern(e);
    const beschrieben = beschriftung(e.teil);
    const nummerGross = s.regular.widthOfTextAtSize(nummer, F(9.5));
    // Zu lange Bezeichnungen werden kleiner, nie gekürzt; erst ganz zuletzt brechen sie um.
    const g = passendeGroesse(beschrieben, s.regular, F(9.5), 7.5, w - nummerGross - 14, s);
    const teile = umbrechen(zeichenbar(beschrieben, s), s.regular, g, w - nummerGross - 14);
    const yErste = y;
    teile.forEach((t, i) => {
      text(t, x, y, g, s.regular);
      if (i < teile.length - 1) y -= g * 1.2;
    });
    const nummerBreite = s.regular.widthOfTextAtSize(nummer, g);
    text(nummer, x + w - nummerBreite, y, g, s.regular);
    const ende = x + s.regular.widthOfTextAtSize(teile.at(-1) ?? '', g) + 6;
    if (ende < x + w - nummerBreite - 6) {
      p?.drawLine({
        start: { x: ende, y: y + 1 },
        end: { x: x + w - nummerBreite - 6, y: y + 1 },
        thickness: 0.8,
        color: RAHMEN,
        dashArray: [0.6, 2.2],
      });
    }
    links.push({ seite: n, rect: [x, y - 2, x + w, yErste + F(8)], ziel: e.von });
    y -= V(5.4);
  };
  const block = (b: MappenBlock) => {
    const zeilen = eintraege.filter((e) => e.block === b);
    if (!zeilen.length) return;
    const noetig = V(11) + zeilen.length * V(5.4);
    // Ein Block bleibt zusammen, außer er ist länger als eine ganze Seite.
    if (y - noetig < RECHTS_UNTEN && noetig <= H - 2 * RECHTS_UNTEN) weiter();
    // B14: Jede Person beginnt mit einem Reiter (Quadrat, Name), der auf einer Linie über die ganze Breite sitzt,
    // wie im Tab „Mappe“ und auf der Vermieterseite. Bürgen haben den Umriss (mappe14.py, `.db .pers`).
    const em = F(9.5);
    const padL = 0.9 * em;
    const padR = 1.1 * em;
    const q = V(2.6);
    const luecke = V(2.6);
    const nameBreite = rw - padL - q - luecke - padR;
    const g = passendeGroesse(b.person.name, s.bold, F(11), 8.5, nameBreite, s);
    const namen = umbrechen(zeichenbar(b.person.name, s), s.bold, g, nameBreite);
    const zeilenHoehe = g * 1.25;
    const reiterHoehe = 0.48 * em + namen.length * zeilenHoehe + 0.4 * em;
    const reiterBreite =
      padL + q + luecke + Math.max(...namen.map((t) => breiteVon(t, s.bold, g, s))) + padR;
    const reiterOben = y + g;
    const reiterUnten = reiterOben - reiterHoehe;
    if (p) {
      const farbe = hex(deckFarbe(aussehen, b.person.farbe));
      p.drawLine({
        start: { x: rx, y: reiterUnten },
        end: { x: rx + rw, y: reiterUnten },
        thickness: 0.6,
        color: FARBE.ink,
      });
      rundesRechteck(
        p,
        rx,
        reiterOben,
        reiterBreite,
        reiterHoehe,
        [V(2.2), V(2.2), 0, 0],
        { color: FARBE.weiss, borderColor: FARBE.ink, borderWidth: 0.6 },
        true,
      );
      p.drawRectangle({
        x: rx + 0.3,
        y: reiterUnten - 0.6,
        width: reiterBreite - 0.6,
        height: 1.2,
        color: FARBE.weiss,
      });
      const qOben = reiterOben - 0.48 * em - 0.42 * em;
      p.drawRectangle(
        b.person.buerge
          ? {
              x: rx + padL + 0.7,
              y: qOben - q + 0.7,
              width: q - 1.4,
              height: q - 1.4,
              borderColor: farbe,
              borderWidth: 1.4,
            }
          : { x: rx + padL, y: qOben - q, width: q, height: q, color: farbe },
      );
    }
    namen.forEach((name, i) => {
      text(
        name,
        rx + padL + q + luecke,
        reiterOben - 0.48 * em - (i + 0.8) * zeilenHoehe,
        g,
        s.bold,
      );
    });
    y = reiterUnten - V(5);
    for (const e of zeilen) {
      if (y - V(5.4) < RECHTS_UNTEN) weiter();
      zeile(e);
    }
    y -= V(4);
  };
  if (a.inhaltsverzeichnis) {
    text('Was beiliegt', rx, y, F(11.5), s.bold);
    y -= V(9);
    vertrag.forEach(block);
    if (buergen.some((b) => eintraege.some((e) => e.block === b))) {
      y -= V(2);
      if (y - V(20) < RECHTS_UNTEN) weiter();
      text('Bürgschaft', rx, y, F(11.5), s.bold);
      y -= V(9);
      buergen.forEach(block);
    }
  }
  // Die Bitte der Bewerber: unter der letzten Unterlage, ohne Überschrift, im Druckton (bitte-zum-loeschen.md).
  const bitte = a.bitte?.trim();
  if (bitte) {
    const setzen = () => umbrechen(zeichenbar(bitte, s), s.regular, F(9.5), rw - V(4));
    let zeilen = setzen();
    if (y - (V(3) + zeilen.length * V(4.8)) < RECHTS_UNTEN) {
      // Passt sie nicht mehr darunter, rutscht sie allein auf die Folgeseite.
      n += 1;
      p = seite(n);
      rx = 20 * MM;
      rw = B - 40 * MM;
      y = H - 24 * MM;
      zeilen = setzen();
    }
    y -= V(3);
    for (const zeile of zeilen) {
      text(zeile, rx + V(4), y, F(9.5), s.regular, DRUCK);
      y -= V(4.8);
    }
  }
  // P28: Geht es auf der nächsten Seite weiter, steht das unten auf dem Deckblatt, subtil, aber da.
  const erste = seite(0);
  if (n > 0 && erste) {
    const weiterText = 'Weiter auf Seite 2';
    schreiben(erste, weiterText, s, {
      x: B - 20 * MM - breiteVon(weiterText, s.regular, 8, s),
      y: 18 * MM,
      size: 8,
      font: s.regular,
      color: DRUCK,
    });
  }
  return { seiten: n + 1, links, tiefste: Math.min(leisteTief, y) };
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

export async function bewerbungBauen(a: BewerbungAuftrag): Promise<BewerbungErgebnis> {
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
        const seiten = selbstauskunftZeichnen(pdf, auskunftSchriften, {
          ...teil.auskunft,
          farbe: teil.auskunft.farbe && deckFarbe(aussehen, teil.auskunft.farbe),
          buerge: block.person.buerge,
          mitHinweis: a.hinweis,
        });
        seiten.forEach((seite, k) =>
          baender.push({
            seite,
            person: block.person,
            rechts:
              seiten.length > 1 ? `${standard} · Seite ${k + 1} von ${seiten.length}` : standard,
          }),
        );
      }
      for (const q of teil.quellen) {
        const kopf = q.kopf ?? standard;
        const uebernommen = await quelleUebernehmen(pdf, q, a.alsBilder);
        await weiter();
        if (!uebernommen) {
          const meldung = teil.meldung ?? { name: `${kopf}, ${block.person.name}` };
          unlesbar.set(meldung.name, meldung);
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
          const x0 = RAND_SEITE;
          const x1 = B - RAND_SEITE;
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
            borderWidth: 0.5,
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
              eingebettet.length > 1 ? `${kopf} · Seite ${k + 1} von ${eingebettet.length}` : kopf,
          });
        }
      }
      eintrag.bis = pdf.getPageCount();
      if (eintrag.bis >= eintrag.von) eintraege.push(eintrag);
    }
  }

  const seiten = pdf.getPages();
  const gesamt = seiten.length;
  let deckMassstab: number | undefined;
  let deckSeiten: number | undefined;
  let kompaktHilft: boolean | undefined;
  if (a.deckblatt) {
    const {
      links,
      massstab,
      seiten: deckAnzahl,
      kompaktHilft: hilft,
    } = deckblatt(a, eintraege, s, (n) => deckblaetter[n] ?? null);
    deckMassstab = massstab;
    deckSeiten = deckAnzahl;
    kompaktHilft = hilft;
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
  if (a.fusszeile) {
    for (const b of baender) kopfzeile(b.seite, b.person, b.rechts, s, aussehen);
    const links = a.kurz ? `Bewerbung ${a.kurz} · ${a.fussName}` : `Bewerbung · ${a.fussName}`;
    seiten.forEach((seite, i) => fussleiste(seite, links, i + 1, gesamt, s));
  }

  // Lesezeichen: Person, darunter ihre Unterlagen, bei Serien die Monate; Bürgen unter „Bürgschaft“.
  const personPunkt = (block: MappenBlock): Punkt | null => {
    const eigene = eintraege.filter((e) => e.block === block);
    if (!eigene.length) return null;
    return {
      titel: `${block.person.name} (${block.person.rolle})`,
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

  const datum = a.datum ?? new Date();
  // Die Lesehilfe für Vermieter, nur mit Deckblatt und Hinweis (docs/format-hefta-json.md).
  if (a.deckblatt && a.hinweis) {
    // Dieselben Ersetzungen wie auf dem Papier: Regel 1 des Formats, P26.
    const anhang = anhangBauen({
      datum,
      kennung: a.kennung,
      adresse: a.adresse.map(s.ersetzen),
      personen: a.bloecke.map((b) => ({
        name: s.ersetzen(b.person.name),
        rolle: b.person.rolleId,
        buerge: b.person.buerge,
      })),
      kontakt: a.kontakt.some(Boolean),
      kontaktwege: a.kontaktwege && {
        telefon: a.kontaktwege.telefon && s.ersetzen(a.kontaktwege.telefon),
        email: a.kontaktwege.email && s.ersetzen(a.kontaktwege.email),
      },
      mitziehende: a.mitziehende.map((m) => ({ ...m, text: s.ersetzen(m.text) })),
      unterlagen: eintraege.map((e) => ({
        person: a.bloecke.indexOf(e.block),
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
    const eigene = eintraege.filter((e) => e.block === block);
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
    kompaktHilft,
  };
}
