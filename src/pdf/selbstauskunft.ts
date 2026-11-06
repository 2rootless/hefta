import fontkit from '@cantoo/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from '@cantoo/pdf-lib';
import type { FormBlock, FormZeile } from '../domain/selbstauskunft';
import { APP_NAME } from '../app/name';
import { A4, FARBE, fusszeile, titelAusDateiname, type Schriften } from './mappe';

// Selbstauskunft als festes Formular nach dem Musterbogen (design/mappe-feinschliff.md, § 1): Kopf mit Name
// und Balken, dann immer dieselben Blöcke und Zeilen. Fehlt eine Angabe, steht „keine Angabe“ an ihrer
// Stelle, nichts rückt auf. Unterschriftszeile nur, wenn sie in „Mappe anpassen“ an ist (X8b). Läuft ohne
// Browser-APIs.

/** Was im Bogen steht; in der Mappe wird es direkt auf deren Seiten gezeichnet (eine Schrift je Datei). */
export interface SelbstauskunftInhalt {
  name: string;
  /** z. B. „Hauptmieter“, „Bürgin“. */
  rolle: string;
  /** Farbe des Balkens als Hex; schlicht in `ink`. */
  farbe: string | null;
  /** Bürgen als Umriss, in allen Arten. */
  buerge?: boolean;
  bloecke: FormBlock[];
  /** z. B. „Hamburg, 6. November 2026“. */
  ortDatum: string;
  /** Beschriftung darunter; ohne Angabe „Ort, Datum“. */
  ortLabel?: string;
  /** Zeile für die Unterschrift neben „Ort, Datum“ (X8b, für Ausdrucke; Standard aus). */
  unterschrift?: boolean;
  /** Nennt die Fußnote den Dienst? Mit dem Schalter „Hinweis und Lesehilfe“ aus steht er nirgends. */
  mitHinweis?: boolean;
}

export interface SelbstauskunftAuftrag extends SelbstauskunftInhalt {
  dateiname: string;
  schriften: Schriften;
  datum?: Date;
}

export interface AuskunftSchriften {
  regular: PDFFont;
  bold: PDFFont;
  titel: PDFFont;
  ersetzen: (text: string) => string;
}

/**
 * Nie ein Kästchen (P12): Zeichen, die Archivo nicht hat, werden zum Grundbuchstaben, sonst zu „?“.
 * Still bleibt das nicht: Was ersetzt wurde, landet in `ersetzt` und „Mappe erstellen“ sagt es.
 * Namen kommen so weit gar nicht, dafür fragt das Formular der Person (K8).
 */
export function zeichenErsetzer(schrift: PDFFont, ersetzt?: Set<string>): (text: string) => string {
  const zeichen = new Set(schrift.getCharacterSet());
  return (text) => {
    let geaendert = false;
    const neu = [...text.normalize('NFC')]
      .map((z) => {
        if (z === '\n' || zeichen.has(z.codePointAt(0)!)) return z;
        if (z === '	' || /\p{Zs}/u.test(z)) return ' ';
        geaendert = true;
        const basis = z.normalize('NFD')[0]!;
        return zeichen.has(basis.codePointAt(0)!) ? basis : '?';
      })
      .join('');
    if (geaendert) ersetzt?.add(text);
    return neu;
  };
}

function hex(farbe: string) {
  const n = Number.parseInt(farbe.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Bricht Text an Leerzeichen um, so dass jede Zeile in die Breite passt. */
export function umbrechen(
  text: string,
  schrift: PDFFont,
  groesse: number,
  breite: number,
): string[] {
  const zeilen: string[] = [];
  for (const absatz of text.split('\n')) {
    let zeile = '';
    for (const wort of absatz.split(/ +/).filter(Boolean)) {
      const probe = zeile ? `${zeile} ${wort}` : wort;
      if (zeile && schrift.widthOfTextAtSize(probe, groesse) > breite) {
        zeilen.push(zeile);
        zeile = wort;
      } else zeile = probe;
    }
    zeilen.push(zeile);
  }
  return zeilen;
}

const MM = 72 / 25.4;
const DRUCK = rgb(0x3d / 255, 0x3f / 255, 0x55 / 255);
const OHNE = 'keine Angabe';
const QUELLE = 'nach dem Musterbogen der Datenschutzkonferenz, Stand Januar 2026';
const FUSSNOTE =
  'Angaben der Person selbst. Fragen und Reihenfolge folgen dem Musterbogen der Datenschutzkonferenz';

/** Wie `umbrechen`, aber ein einzelnes zu breites Wort (Mailadresse) läuft nie über den Rand. */
function inSpalte(text: string, schrift: PDFFont, groesse: number, breite: number): string[] {
  return umbrechen(text, schrift, groesse, breite).flatMap((zeile) => {
    if (schrift.widthOfTextAtSize(zeile, groesse) <= breite) return [zeile];
    const stuecke: string[] = [];
    let stueck = '';
    for (const zeichen of zeile) {
      if (stueck && schrift.widthOfTextAtSize(stueck + zeichen, groesse) > breite) {
        stuecke.push(stueck);
        stueck = zeichen;
      } else stueck += zeichen;
    }
    if (stueck) stuecke.push(stueck);
    return stuecke;
  });
}

/** Hängt die Seiten des Bogens an das Dokument an, ohne Kopf- und Fußzeile. Maße aus selbstauskunft_neu.py. */
export function selbstauskunftZeichnen(
  pdf: PDFDocument,
  s: AuskunftSchriften,
  a: SelbstauskunftInhalt,
): PDFPage[] {
  const seiten: PDFPage[] = [];
  const fussnote = a.mitHinweis
    ? `${FUSSNOTE}; was dort nicht steht, fragt ${APP_NAME} nicht.`
    : `${FUSSNOTE}.`;
  const neueSeite = () => {
    const neu = pdf.addPage([A4.breite, A4.hoehe]);
    neu.drawText(s.ersetzen(fussnote), {
      x: x0,
      y: 22 * MM,
      size: 7.5,
      font: s.regular,
      color: DRUCK,
    });
    seiten.push(neu);
    return neu;
  };
  const x0 = 20 * MM;
  const x1 = A4.breite - 20 * MM;
  const breite = x1 - x0;
  const spalte = 52 * MM;
  const wertBreite = breite - spalte;
  const oben = A4.hoehe - 30 * MM;
  const unten = 30 * MM;
  let seite = neueSeite();
  let y = oben;
  const schreiben = (
    text: string,
    x: number,
    yy: number,
    size: number,
    font: PDFFont,
    color = FARBE.ink,
  ) => seite.drawText(text, { x, y: yy, size, font, color });

  // Kopf: Titel, rechts die Grundlage, darunter der Name mit Balken wie auf dem Deckblatt.
  schreiben('Selbstauskunft', x0, y, 20, s.titel);
  schreiben(QUELLE, x1 - s.regular.widthOfTextAtSize(QUELLE, 9), y, 9, s.regular, DRUCK);
  y -= 10 * MM;
  const farbe = a.farbe ? hex(a.farbe) : FARBE.ink;
  seite.drawRectangle(
    a.buerge
      ? {
          x: x0 + 0.4,
          y: y - 2.2 * MM,
          width: 1.8,
          height: 10 * MM,
          borderColor: farbe,
          borderWidth: 0.8,
        }
      : { x: x0, y: y - 2.2 * MM, width: 2.4, height: 10 * MM, color: farbe },
  );
  const name = s.ersetzen(a.name);
  let nameGroesse = 14;
  while (nameGroesse > 9 && s.bold.widthOfTextAtSize(name, nameGroesse) > breite - 10 * MM)
    nameGroesse -= 0.5;
  schreiben(name, x0 + 4 * MM, y + 2.6 * MM, nameGroesse, s.bold);
  // Neutral heißt die Rolle von Bürgen schon „bürgt“: nicht doppelt sagen.
  const rolle = a.buerge
    ? a.rolle === 'bürgt'
      ? 'bürgt, zieht nicht ein'
      : `${a.rolle} · bürgt, zieht nicht ein`
    : `${a.rolle} · im Mietvertrag`;
  schreiben(s.ersetzen(rolle), x0 + 4 * MM, y - 2 * MM, 10, s.regular, DRUCK);
  y -= 14 * MM;

  const kasten = (x: number, yy: number, text: string, an: boolean) => {
    const q = 3.4 * MM;
    seite.drawRectangle({
      x,
      y: yy - 0.6 * MM,
      width: q,
      height: q,
      borderColor: FARBE.ink,
      borderWidth: 0.8,
    });
    if (an) {
      // Kreuz statt Füllung: hält im harten Schwarzweiß und beim Tonersparen.
      const r = 0.7 * MM;
      const u = yy - 0.6 * MM;
      for (const [von, bis] of [
        [
          { x: x + r, y: u + r },
          { x: x + q - r, y: u + q - r },
        ],
        [
          { x: x + r, y: u + q - r },
          { x: x + q - r, y: u + r },
        ],
      ] as const) {
        seite.drawLine({ start: von, end: bis, thickness: 1, color: FARBE.ink });
      }
    }
    schreiben(text, x + q + 1.8 * MM, yy, 9.5, an ? s.bold : s.regular);
  };

  const zeileZeichnen = (z: FormZeile) => {
    const etikett = inSpalte(s.ersetzen(z.etikett), s.regular, 9, spalte - 4 * MM);
    let hoehe = etikett.length * 4.2 * MM;
    let werte: string[];
    let zeilenAbstand = 4.8 * MM;
    let groesse = 10.5;
    let wertFarbe = FARBE.ink;
    if (z.art === 'janein') {
      zeilenAbstand = 4.6 * MM;
      groesse = 9.5;
      werte = z.erklaerung ? inSpalte(s.ersetzen(z.erklaerung), s.regular, 9.5, wertBreite) : [];
      hoehe = Math.max(hoehe, (1 + werte.length) * zeilenAbstand);
    } else if (z.art === 'hinweis') {
      zeilenAbstand = 4.2 * MM;
      groesse = 9;
      wertFarbe = DRUCK;
      werte = inSpalte(s.ersetzen(z.wert), s.regular, 9, wertBreite);
      hoehe = Math.max(hoehe, werte.length * zeilenAbstand);
    } else {
      const leer = !z.wert.trim();
      groesse = leer ? 9.5 : 10.5;
      wertFarbe = leer ? DRUCK : FARBE.ink;
      werte = inSpalte(s.ersetzen(leer ? OHNE : z.wert), s.regular, groesse, wertBreite);
      hoehe = Math.max(hoehe, werte.length * zeilenAbstand);
    }
    hoehe += 3.4 * MM;
    if (y - hoehe < unten) {
      seite = neueSeite();
      y = A4.hoehe - 24 * MM;
    }
    etikett.forEach((t, i) => schreiben(t, x0, y - i * 4.2 * MM, 9, s.regular, DRUCK));
    if (z.art === 'janein') {
      kasten(x0 + spalte, y, 'Ja', z.antwort === 'ja');
      kasten(x0 + spalte + 16 * MM, y, 'Nein', z.antwort === 'nein');
      if (z.antwort === null) schreiben(OHNE, x0 + spalte + 34 * MM, y, 9, s.regular, DRUCK);
      werte.forEach((t, i) =>
        schreiben(t, x0 + spalte, y - (i + 1) * zeilenAbstand, groesse, s.regular),
      );
    } else {
      werte.forEach((t, i) =>
        schreiben(t, x0 + spalte, y - i * zeilenAbstand, groesse, s.regular, wertFarbe),
      );
    }
    y -= hoehe;
    seite.drawLine({
      start: { x: x0, y: y + 2.4 * MM },
      end: { x: x1, y: y + 2.4 * MM },
      thickness: 0.4,
      color: FARBE.linie,
    });
  };

  for (const block of a.bloecke) {
    if (y - 18 * MM < unten) {
      seite = neueSeite();
      y = A4.hoehe - 24 * MM;
    }
    schreiben(s.ersetzen(block.titel), x0, y, 10.5, s.bold);
    seite.drawLine({
      start: { x: x0, y: y - 2.2 * MM },
      end: { x: x1, y: y - 2.2 * MM },
      thickness: 0.6,
      color: FARBE.ink,
    });
    y -= 8.5 * MM;
    block.zeilen.forEach(zeileZeichnen);
    y -= 5 * MM;
  }

  // Ort und Datum, auf Wunsch die Unterschrift.
  if (y - 12 * MM < unten) {
    seite = neueSeite();
    y = A4.hoehe - 24 * MM;
  }
  y -= 2 * MM;
  schreiben(s.ersetzen(a.ortDatum), x0, y, 10.5, s.regular);
  seite.drawLine({
    start: { x: x0, y: y - 1.6 * MM },
    end: { x: x0 + 70 * MM, y: y - 1.6 * MM },
    thickness: 0.5,
    color: FARBE.ink,
  });
  schreiben(a.ortLabel ?? 'Ort, Datum', x0, y - 5.4 * MM, 8, s.regular, DRUCK);
  if (a.unterschrift) {
    seite.drawLine({
      start: { x: x1 - 70 * MM, y: y - 1.6 * MM },
      end: { x: x1, y: y - 1.6 * MM },
      thickness: 0.5,
      color: FARBE.ink,
    });
    schreiben('Unterschrift', x1 - 70 * MM, y - 5.4 * MM, 8, s.regular, DRUCK);
  }

  return seiten;
}

/** Der Bogen als eigene Datei, mit Fußzeile („Als PDF ansehen“). */
export async function selbstauskunftBauen(
  a: SelbstauskunftAuftrag,
): Promise<{ bytes: Uint8Array; seiten: number }> {
  // updateMetadata: false verhindert Producer/Creator mit Softwarenamen.
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(a.schriften.regular, { subset: true });
  const s = {
    regular,
    bold: await pdf.embedFont(a.schriften.bold, { subset: true }),
    titel: await pdf.embedFont(a.schriften.titel, { subset: true }),
    ersetzen: zeichenErsetzer(regular),
  };
  selbstauskunftZeichnen(pdf, s, a);
  const gesamt = pdf.getPageCount();
  pdf.getPages().forEach((p, i) => fusszeile(p, i + 1, gesamt, s.ersetzen(a.name), s.regular));

  const datum = a.datum ?? new Date();
  pdf.setTitle(titelAusDateiname(a.dateiname));
  pdf.setLanguage('de-DE');
  pdf.setCreationDate(datum);
  pdf.setModificationDate(datum);
  return { bytes: await pdf.save(), seiten: gesamt };
}
