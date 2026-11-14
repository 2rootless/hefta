import { rgb, setCharacterSpacing, type Color, type PDFFont, type PDFPage } from '@cantoo/pdf-lib';

// Briefbogen der Mappe (DP30, Richtung B): Ränder, Farben, Briefkopf, Abschnitte und Personenzeichen, gemeinsam
// für Deckblatt und Selbstauskunft. Läuft ohne Browser-APIs.

const MM = 72 / 25.4;
const TINTE = rgb(0x26 / 255, 0x22 / 255, 0x1e / 255);

/** Bricht an Leerzeichen um, so dass jede Zeile in die Breite passt. */
function zeilen(text: string, schrift: PDFFont, groesse: number, breite: number): string[] {
  const aus: string[] = [];
  let zeile = '';
  for (const wort of text.split(/ +/).filter(Boolean)) {
    const probe = zeile ? `${zeile} ${wort}` : wort;
    if (zeile && schrift.widthOfTextAtSize(probe, groesse) > breite) {
      aus.push(zeile);
      zeile = wort;
    } else zeile = probe;
  }
  aus.push(zeile);
  return aus;
}

/** Ränder des Briefbogens: oben, Seiten, unten (DP30, Abschnitt 6). */
export const BOGEN_OBEN = 16 * MM;
export const BOGEN_SEITE = 22 * MM;
/** Grau der Etiketten und der Fußzeile, Linien (DP30, Liste für Code). */
export const GRAU = rgb(0x6b / 255, 0x62 / 255, 0x58 / 255);
export const LINIE_ABSCHNITT = rgb(0x8c / 255, 0x83 / 255, 0x78 / 255);
export const LINIE_PUNKTE = rgb(0xb9 / 255, 0xb0 / 255, 0xa5 / 255);
export const ZITAT = rgb(0x3d / 255, 0x38 / 255, 0x32 / 255);
/** Personenzeichen 7 pt, mit 5 pt Abstand zum Namen: Einzug 12 pt. */
export const ZEICHEN = 7;
export const EINZUG = 12;
/** Ab so vielen Zeilen im Verzeichnis (Unterlagen plus Namen) läuft es auf Seite 2 weiter. */
export const VERZEICHNIS_ZEILEN = 16;

/** Text mit Laufweite (Versalien-Etiketten): pdf-lib kennt keine, also über den Textzustand. */
export function gesperrt(
  seite: PDFPage,
  text: string,
  o: { x: number; y: number; size: number; font: PDFFont; color: Color },
  laufweite: number,
) {
  seite.pushOperators(setCharacterSpacing(laufweite * o.size));
  seite.drawText(text, o);
  seite.pushOperators(setCharacterSpacing(0));
}

/**
 * Laufweite der Versalien-Etiketten. DP30 nennt 0,12 em; ab etwa 0,1 em liest pdf.js (und damit Kopieren und
 * Screenreader) jeden Buchstaben als eigenes Wort („Z U R P E R S O N“). 0,09 em sieht fast gleich aus und
 * bleibt ein Wort.
 */
const LAUFWEITE = 0.09;

/** Abschnitt: Etikett in Versalien, 8 pt fett, Laufweite 0,12 em, grau; darunter eine feine Linie. */
export function abschnittKopf(
  seite: PDFPage | null,
  titel: string,
  x: number,
  breite: number,
  y: number,
  schrift: PDFFont,
): number {
  if (seite) {
    gesperrt(seite, titel.toUpperCase(), { x, y, size: 8, font: schrift, color: GRAU }, LAUFWEITE);
    seite.drawLine({
      start: { x, y: y - 3 - 2 },
      end: { x: x + breite, y: y - 3 - 2 },
      thickness: 0.4,
      color: LINIE_ABSCHNITT,
    });
  }
  return y - 3 - 2;
}

/** Personenzeichen: Fläche (Mietvertrag), Umriss (Bürgin), Ring (Kind). `y` ist die Grundlinie. */
export function personZeichen(
  seite: PDFPage | null,
  art: 'flaeche' | 'umriss' | 'ring',
  farbe: Color,
  x: number,
  y: number,
) {
  if (!seite) return;
  const unten = y - 0.2;
  if (art === 'ring')
    seite.drawEllipse({
      x: x + ZEICHEN / 2,
      y: unten + ZEICHEN / 2,
      xScale: ZEICHEN / 2 - 0.375,
      yScale: ZEICHEN / 2 - 0.375,
      borderColor: TINTE,
      borderWidth: 0.75,
    });
  else if (art === 'umriss')
    seite.drawRectangle({
      x: x + 0.375,
      y: unten + 0.375,
      width: ZEICHEN - 0.75,
      height: ZEICHEN - 0.75,
      borderColor: farbe,
      borderWidth: 0.75,
    });
  else seite.drawRectangle({ x, y: unten, width: ZEICHEN, height: ZEICHEN, color: farbe });
}

/**
 * Briefkopf der Folgeseiten (DP30, Abschnitt 4): links fett „Bewerbung um die Wohnung {Straße}“, dahinter
 * grau der Ort; rechts die Namen; darunter eine Linie in Tinte. Lange Adressen brechen um. Gibt die
 * Unterkante der Linie zurück (von oben gemessen nicht, sondern als y).
 */
export function briefkopf(
  seite: PDFPage,
  k: { strasse: string; rest: string; namen: string },
  s: { regular: PDFFont; bold: PDFFont; ersetzen: (t: string) => string },
): number {
  const B = seite.getSize().width;
  const H = seite.getSize().height;
  const x0 = BOGEN_SEITE;
  const x1 = B - BOGEN_SEITE;
  const g = 8.5;
  const namen = s.ersetzen(k.namen);
  const namenBreite = s.regular.widthOfTextAtSize(namen, g);
  const links = s.ersetzen(k.strasse ? `Bewerbung um die Wohnung ${k.strasse}` : 'Bewerbung');
  const rest = k.rest ? s.ersetzen(`, ${k.rest}`) : '';
  const platz = x1 - x0 - namenBreite - 6 * MM;
  let y = H - BOGEN_OBEN - g;
  const fett = zeilen(links, s.bold, g, platz);
  fett.forEach((z, i) => {
    seite.drawText(z, { x: x0, y, size: g, font: s.bold, color: TINTE });
    if (i < fett.length - 1) y -= g * 1.35;
  });
  // Der Ort steht hinter dem fetten Teil, wenn er dort noch Platz hat, sonst darunter.
  const nachFett = x0 + s.bold.widthOfTextAtSize(fett.at(-1) ?? '', g);
  if (rest) {
    if (nachFett + s.regular.widthOfTextAtSize(rest, g) <= x0 + platz)
      seite.drawText(rest, { x: nachFett, y, size: g, font: s.regular, color: GRAU });
    else {
      y -= g * 1.35;
      for (const z of zeilen(rest.replace(/^, /, ''), s.regular, g, platz)) {
        seite.drawText(z, { x: x0, y, size: g, font: s.regular, color: GRAU });
        y -= g * 1.35;
      }
      y += g * 1.35;
    }
  }
  seite.drawText(namen, {
    x: x1 - namenBreite,
    y: H - BOGEN_OBEN - g,
    size: g,
    font: s.regular,
    color: GRAU,
  });
  const linie = y - 4 * MM;
  seite.drawLine({
    start: { x: x0, y: linie },
    end: { x: x1, y: linie },
    thickness: 0.5,
    color: TINTE,
  });
  return linie;
}
