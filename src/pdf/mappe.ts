import type { MappenAkzent, MappenAussehen, MappenFlaeche } from '../domain/modell';
import fontkit from '@cantoo/fontkit';
import { LineCapStyle, PDFDocument, rgb, type PDFFont, type PDFPage } from '@cantoo/pdf-lib';
import { KLAMMER } from '../domain/logo';
import { pdfLaden } from './laden';

// Baut die PDF-Mappe: Deckblatt mit Inhaltsverzeichnis, dann alle Teile, jede Seite A4 hoch
// mit 20 mm Rand und Fußzeile. Läuft ohne Browser-APIs (auch in Tests unter Node).
// Geschwärzte Seiten kommen bereits gerastert als Bild an; dieser Baustein rastert nicht selbst.
// Stand M0: Grundgerüst für den Technik-Test. Der vollständige Aufbau nach 06-export.md folgt in M5.

export const A4 = { breite: 595.28, hoehe: 841.89 };
export const RAND = (20 / 25.4) * 72; // 20 mm in pt
const FUSS_Y = 28;

// Werte aus design/tokens.json (Gruppe „PDF-Mappe“), auf der A4-Seite 1 px = 1 pt wie im Deckblatt-Entwurf.
export const TYPO = {
  titel: { groesse: 26, zeile: 32 },
  ueberschrift: { groesse: 16, zeile: 22 },
  text: { groesse: 14, zeile: 20 },
  meta: { groesse: 11, zeile: 14 },
};
export const FARBE = {
  ink: rgb(0x19 / 255, 0x1a / 255, 0x2c / 255),
  muted: rgb(0x4c / 255, 0x4e / 255, 0x66 / 255),
  linie: rgb(0xdf / 255, 0xe1 / 255, 0xea / 255),
  weiss: rgb(1, 1, 1),
};

/** Personenfarben aus design/tokens.json (person-1 bis person-6), für den schmalen Balken. */
export const PERSONENFARBEN = ['#ff8466', '#b8e07c', '#c8abff', '#e3b25a', '#ffadc9', '#c9a189'];

/** Gedeckte Farben für „Eine Farbe“: dunkel genug, dass die Linie im harten Schwarzweiß bleibt. */
export const AKZENTE: Record<MappenAkzent, string> = {
  tanne: '#2f5e4f',
  schiefer: '#3d4f63',
  bordeaux: '#7d2e3a',
  graphit: '#3a3a40',
};

const INK = [0x19, 0x1a, 0x2c] as const;

/** Personenfarbe als Druckton: um 38 % zu `ink` hin abgedunkelt, damit sie klein auf Papier trägt. */
export function druckTon(farbe: string): string {
  const n = Number.parseInt(farbe.replace('#', ''), 16);
  const kanal = (wert: number, i: number) =>
    Math.round(wert * 0.62 + INK[i]! * 0.38)
      .toString(16)
      .padStart(2, '0');
  return `#${kanal((n >> 16) & 255, 0)}${kanal((n >> 8) & 255, 1)}${kanal(n & 255, 2)}`;
}

/** Feine Linie, wenn die Fläche „Keine“ ist. */
export const FLAECHE_LINIE = '#d5d7e0';
const HELLGRAU = '#f1f2f6';

function aufWeiss(farbe: string, anteil: number): string {
  const n = Number.parseInt(farbe.replace('#', ''), 16);
  const kanal = (wert: number) =>
    Math.round(255 - anteil * (255 - wert))
      .toString(16)
      .padStart(2, '0');
  return `#${kanal((n >> 16) & 255)}${kanal((n >> 8) & 255)}${kanal(n & 255)}`;
}

/** Ohne eigene Wahl folgt die Fläche der Art: So sieht „Schlicht“ weiter schlicht aus. */
export function flaecheVon(aussehen: Pick<MappenAussehen, 'art' | 'flaeche'>): MappenFlaeche {
  if (aussehen.flaeche) return aussehen.flaeche;
  if (aussehen.art === 'personen') return 'personen';
  return aussehen.art === 'einefarbe' ? 'akzent' : 'grau';
}

/**
 * Ton der Fläche hinter „Wer einzieht“ (mappe-feinschliff.md, § 4b), `null` bei „Keine“. Ganz hell: Im harten
 * Schwarzweiß fällt die Fläche weg, alles darauf bleibt.
 */
export function flaechenTon(
  flaeche: MappenFlaeche,
  akzent: MappenAkzent | undefined,
  personFarbe: string | undefined,
): string | null {
  if (flaeche === 'keine') return null;
  if (flaeche === 'akzent') return aufWeiss(AKZENTE[akzent ?? 'tanne'], 0.1);
  if (flaeche === 'personen' && personFarbe) return aufWeiss(personFarbe, 0.11);
  return HELLGRAU;
}

/**
 * Balken und Quadrate auf Deckblatt und Selbstauskunft. Schlicht heißt ohne Farbe, nicht ohne Ordnung:
 * dann in `ink` (design/mappe-pdf.md, entschieden 5.11.).
 */
export function deckFarbe(aussehen: MappenAussehen, personFarbe: string): string {
  if (aussehen.art === 'schlicht') return '#191a2c';
  if (aussehen.art === 'einefarbe') return AKZENTE[aussehen.akzent ?? 'tanne'];
  return druckTon(personFarbe);
}

export interface Schriften {
  regular: Uint8Array;
  bold: Uint8Array;
  titel: Uint8Array;
}

export type Teil =
  | { art: 'bild'; jpeg: Uint8Array; abschnitt: string }
  | { art: 'pdf'; daten: Uint8Array; abschnitt: string; seiten?: number[] };

export interface MappeAuftrag {
  dateiname: string;
  fussName: string;
  deckblatt?: { kopf: string; titel: string[]; satz: string };
  teile: Teil[];
  schriften: Schriften;
  /** Erstell- und Änderungsdatum; Standard ist jetzt. */
  datum?: Date;
}

export interface MappeErgebnis {
  bytes: Uint8Array;
  seiten: number;
  inhalt: { abschnitt: string; seite: number }[];
}

/** Titel für die PDF-Metadaten: der Dateiname ohne Endung. */
export function titelAusDateiname(dateiname: string): string {
  return dateiname.replace(/\.pdf$/i, '');
}

function einpassen(breite: number, hoehe: number) {
  const box = { breite: A4.breite - 2 * RAND, hoehe: A4.hoehe - 2 * RAND };
  const faktor = Math.min(box.breite / breite, box.hoehe / hoehe);
  const b = breite * faktor;
  const h = hoehe * faktor;
  return { x: RAND + (box.breite - b) / 2, y: RAND + (box.hoehe - h) / 2, breite: b, hoehe: h };
}

function marke(seite: PDFPage, x: number, y: number, groesse: number): void {
  // Das Zeichen aus design/logo/mappe-marke.svg: immer einfarbig, im Raster ab y = 1,5.
  const skala = groesse / 32;
  seite.drawSvgPath(KLAMMER, {
    x,
    y: y + groesse + 1.5 * skala,
    scale: skala,
    borderColor: FARBE.ink,
    borderWidth: 3.2,
    borderLineCap: LineCapStyle.Round,
  });
}

export function fusszeile(
  seite: PDFPage,
  nummer: number,
  gesamt: number,
  name: string,
  schrift: PDFFont,
) {
  const { groesse } = TYPO.meta;
  marke(seite, RAND, FUSS_Y - 3, 12);
  seite.drawText(name, {
    x: RAND + 18,
    y: FUSS_Y,
    size: groesse,
    font: schrift,
    color: FARBE.muted,
  });
  const text = `Seite ${nummer} von ${gesamt}`;
  const breite = schrift.widthOfTextAtSize(text, groesse);
  seite.drawText(text, {
    x: A4.breite - RAND - breite,
    y: FUSS_Y,
    size: groesse,
    font: schrift,
    color: FARBE.muted,
  });
}

function deckblatt(
  seite: PDFPage,
  daten: NonNullable<MappeAuftrag['deckblatt']>,
  inhalt: MappeErgebnis['inhalt'],
  s: { regular: PDFFont; bold: PDFFont; titel: PDFFont },
): void {
  let y = A4.hoehe - 72 - TYPO.meta.zeile;
  seite.drawText(daten.kopf, { x: RAND, y, size: 12, font: s.regular, color: FARBE.muted });
  y -= 6 + TYPO.titel.zeile;
  for (const zeile of daten.titel) {
    seite.drawText(zeile, {
      x: RAND,
      y,
      size: TYPO.titel.groesse,
      font: s.titel,
      color: FARBE.ink,
    });
    y -= TYPO.titel.zeile;
  }
  y -= 18 - TYPO.titel.zeile + TYPO.text.zeile;
  seite.drawText(daten.satz, {
    x: RAND,
    y,
    size: TYPO.text.groesse,
    lineHeight: TYPO.text.zeile,
    maxWidth: 400,
    font: s.regular,
    color: FARBE.ink,
  });

  const links = 310;
  const rechts = A4.breite - RAND;
  let ty = A4.hoehe - 300 - 12;
  seite.drawText('Inhalt', { x: links, y: ty, size: 12, font: s.bold, color: FARBE.ink });
  ty -= 6;
  for (const eintrag of inhalt) {
    ty -= 26;
    seite.drawText(eintrag.abschnitt, {
      x: links,
      y: ty + 8,
      size: 13,
      font: s.regular,
      color: FARBE.ink,
    });
    const nummer = String(eintrag.seite);
    seite.drawText(nummer, {
      x: rechts - s.regular.widthOfTextAtSize(nummer, 13),
      y: ty + 8,
      size: 13,
      font: s.regular,
      color: FARBE.ink,
    });
    seite.drawLine({
      start: { x: links, y: ty },
      end: { x: rechts, y: ty },
      thickness: 1,
      color: FARBE.linie,
    });
  }
}

export async function mappeBauen(auftrag: MappeAuftrag): Promise<MappeErgebnis> {
  // updateMetadata: false verhindert Producer/Creator mit Softwarenamen.
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.registerFontkit(fontkit);
  const schriften = {
    regular: await pdf.embedFont(auftrag.schriften.regular, { subset: true }),
    bold: await pdf.embedFont(auftrag.schriften.bold, { subset: true }),
    titel: await pdf.embedFont(auftrag.schriften.titel, { subset: true }),
  };

  const inhalt: MappeErgebnis['inhalt'] = [];
  const deckblattSeite = auftrag.deckblatt ? pdf.addPage([A4.breite, A4.hoehe]) : undefined;

  for (const teil of auftrag.teile) {
    inhalt.push({ abschnitt: teil.abschnitt, seite: pdf.getPageCount() + 1 });
    if (teil.art === 'bild') {
      const bild = await pdf.embedJpg(teil.jpeg);
      const platz = einpassen(bild.width, bild.height);
      pdf.addPage([A4.breite, A4.hoehe]).drawImage(bild, {
        x: platz.x,
        y: platz.y,
        width: platz.breite,
        height: platz.hoehe,
      });
    } else {
      const quelle = await pdfLaden(teil.daten);
      const nummern = teil.seiten ?? quelle.getPageIndices();
      const seiten = await pdf.embedPdf(quelle, nummern);
      for (const eingebettet of seiten) {
        const platz = einpassen(eingebettet.width, eingebettet.height);
        pdf.addPage([A4.breite, A4.hoehe]).drawPage(eingebettet, {
          x: platz.x,
          y: platz.y,
          width: platz.breite,
          height: platz.hoehe,
        });
      }
    }
  }

  if (deckblattSeite && auftrag.deckblatt) {
    deckblatt(deckblattSeite, auftrag.deckblatt, inhalt, schriften);
  }

  const gesamt = pdf.getPageCount();
  pdf
    .getPages()
    .forEach((seite, i) => fusszeile(seite, i + 1, gesamt, auftrag.fussName, schriften.regular));

  const datum = auftrag.datum ?? new Date();
  pdf.setTitle(titelAusDateiname(auftrag.dateiname));
  pdf.setLanguage('de-DE');
  pdf.setCreationDate(datum);
  pdf.setModificationDate(datum);

  return { bytes: await pdf.save(), seiten: gesamt, inhalt };
}
