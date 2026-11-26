import fontkit from '@cantoo/fontkit';
import { PDFDocument, rgb, type Color, type PDFFont, type PDFPage } from '@cantoo/pdf-lib';
import type { FormBlock, FormZeile } from '../domain/selbstauskunft';
import { APP_NAME } from '../app/name';
import { A4, fusszeile, titelAusDateiname, type Schriften } from './mappe';
import { BOGEN_OBEN, BOGEN_SEITE, EINZUG, GRAU, ZEICHEN, abschnittKopf, briefkopf } from './bogen';

// Selbstauskunft als festes Formular nach dem Musterbogen (design/mappe-feinschliff.md, § 1; Gestalt nach DP30,
// Briefbogen): Briefkopf, Titel, dann immer dieselben Blöcke und Zeilen. Fehlt eine Angabe, steht „keine Angabe“ an ihrer
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
  /** E111 (DP134, Abschnitt 4): Der lose Bogen im Browser kennt keine Rolle; unter dem Titel nur der Musterbogen. */
  ohneRolle?: boolean;
  bloecke: FormBlock[];
  /** z. B. „Hamburg, 6. November 2026“. */
  ortDatum: string;
  /** Beschriftung darunter; ohne Angabe „Ort, Datum“. */
  ortLabel?: string;
  /** Zeile für die Unterschrift neben „Ort, Datum“ (X8b, für Ausdrucke; Standard aus). */
  unterschrift?: boolean;
  /** Nennt die Fußnote den Dienst? Mit dem Schalter „Hinweis und Lesehilfe“ aus steht er nirgends. */
  mitHinweis?: boolean;
  /** DP30: Briefkopf der Mappe (Straße, Ort, Namen); fehlt er (eigene Datei), beginnt die Seite mit dem Titel. */
  briefkopf?: { strasse: string; rest: string; namen: string };
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
// DP30 (Liste für Code): Tinte, Linie zwischen den Fragen, die nicht gegebene Antwort.
const INK = hex('#26221e');
const FRAGEN_LINIE = hex('#d6cec4');
const AUS = hex('#9a9086');
const OHNE = 'keine Angabe';
/**
 * Gilt nur, solange die Zeilen dem Musterbogen folgen (MUSTERBOGEN_REIHENFOLGE in domain/selbstauskunft.ts; PC207, 2).
 */
const FUSSNOTE =
  'Angaben der Person selbst. Fragen und Reihenfolge folgen dem Musterbogen der Datenschutzkonferenz';
/** PC207, 2: Der Musterbogen kennt keine Bürgen; für sie nur dieser Satz. */
export const FUSSNOTE_BUERGE = 'Angaben der Person, die bürgt.';
/** Felder, die immer die ganze Breite nehmen (B14: Kontakt, die Sätze zur Bürgschaft). */
const WEIT = new Set(['kontakt', 'einzug', 'erklaerung']);

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

/**
 * Hängt die Seiten des Bogens an das Dokument an (DP30, Abschnitt 4: Briefbogen). Oben der Briefkopf der
 * Mappe, dann „Selbstauskunft von ■ {Name}“, Abschnitte mit Versalien-Etikett und feiner Linie, Felder
 * zweispaltig, die Fragen nach dem Musterbogen mit „Ja“ und „Nein“ als Wort. „Ort, Datum“ steht an festem
 * Platz über der Fußzeile. Umbruch nur zwischen Abschnitten; „Ort, Datum“ steht nie allein.
 */
export function selbstauskunftZeichnen(
  pdf: PDFDocument,
  s: AuskunftSchriften,
  a: SelbstauskunftInhalt,
): PDFPage[] {
  const B = A4.breite;
  const H = A4.hoehe;
  const x0 = BOGEN_SEITE;
  const x1 = B - BOGEN_SEITE;
  const breite = x1 - x0;
  const spalte = (breite - 10 * MM) / 2;
  const farbe = a.farbe ? hex(a.farbe) : INK;
  // Unten: Fußzeile der Mappe (Linie bei 13 mm), darüber „Ort, Datum“ mit der Fußnote.
  const fussOben = 13 * MM + 8 * MM;

  const zeichnen = (
    seite: PDFPage,
    t: string,
    x: number,
    y: number,
    size: number,
    font: PDFFont,
    color: Color = INK,
  ) => seite.drawText(t, { x, y, size, font, color });

  // ---------- Abschnitte messen (Höhen in pt, von oben nach unten) ----------
  interface Abschnitt {
    hoehe: number;
    zeichnen: (seite: PDFPage, oben: number) => void;
  }
  const KOPF = 8 * MM + 8 + 5; // Abstand oben, Etikett, Linie
  const abschnitte: Abschnitt[] = a.bloecke.map((block): Abschnitt => {
    if (block.id === 'fragen') return fragenAbschnitt(block.zeilen, block.titel);
    interface Feld {
      etikett: string;
      werte: string[];
      leise: boolean;
      breit: boolean;
    }
    const felder: Feld[] = block.zeilen.map((z) => {
      const roh = z.art === 'janein' ? '' : z.wert;
      const leer = !roh.trim();
      // DP30: Komma statt Mittelpunkt, etwa bei „Telefon oder E-Mail“.
      const wert = s.ersetzen(leer ? OHNE : roh.replaceAll(' · ', ', '));
      const halb = inSpalte(wert, s.regular, 10.5, spalte);
      const breit = WEIT.has(z.id) || halb.length > 1;
      return {
        etikett: s.ersetzen(z.etikett),
        werte: breit ? inSpalte(wert, s.regular, 10.5, breite) : halb,
        leise: leer || z.art === 'hinweis',
        breit,
      };
    });
    const reihen: Feld[][] = [];
    for (const f of felder) {
      const letzte = reihen[reihen.length - 1];
      if (!f.breit && letzte && letzte.length === 1 && !letzte[0]!.breit) letzte.push(f);
      else reihen.push([f]);
    }
    const feldHoehe = (f: Feld) => 8 * 1.3 + f.werte.length * 10.5 * 1.3;
    const reihenHoehe = reihen.map((r) => Math.max(...r.map(feldHoehe)));
    const summe = reihenHoehe.reduce((x, h) => x + h, 0) + reihen.length * 5 * MM - 5 * MM;
    return {
      hoehe: KOPF + 4 * MM + summe,
      zeichnen: (seite, oben) => {
        const linie = abschnittKopf(
          seite,
          s.ersetzen(block.titel),
          x0,
          breite,
          oben - 8 * MM - 8,
          s.bold,
        );
        let o = linie - 4 * MM;
        reihen.forEach((reihe, i) => {
          reihe.forEach((f, k) => {
            const x = f.breit ? x0 : x0 + k * (spalte + 10 * MM);
            zeichnen(seite, f.etikett, x, o - 8, 8, s.regular, INK);
            f.werte.forEach((t, j) =>
              zeichnen(seite, t, x, o - 8 * 1.3 - 10.5 - j * 10.5 * 1.3, 10.5, s.regular, INK),
            );
          });
          o -= reihenHoehe[i]! + 5 * MM;
        });
      },
    };
  });

  function fragenAbschnitt(zeilen: FormZeile[], titel: string): Abschnitt {
    const antBreite = 20 * MM;
    const textBreite = breite - antBreite - 8 * MM;
    const reihen = zeilen.map((z, i) => {
      const frage = inSpalte(s.ersetzen(`${i + 1}. ${z.etikett}`), s.regular, 10.5, textBreite);
      const spaeter =
        z.art === 'hinweis' ? inSpalte(s.ersetzen(z.wert), s.regular, 8.5, antBreite) : [];
      // PC207, 2: Eine Textzeile (C.7, „Gründe“) hat keine Antwort Ja oder Nein; ihr Text steht darunter wie eine
      // Erläuterung, ohne das Wort davor. Leer steht „keine Angabe“ (P27).
      const erkl =
        z.art === 'janein' && z.erklaerung.trim()
          ? inSpalte(s.ersetzen(z.erklaerung.trim()), s.regular, 9.5, textBreite)
          : z.art === 'text'
            ? inSpalte(s.ersetzen(z.wert.trim() || OHNE), s.regular, 9.5, textBreite)
            : [];
      const kern = Math.max(frage.length * 10.5 * 1.3, spaeter.length * 8.5 * 1.3);
      const erklH = erkl.length
        ? 2 * MM + (z.art === 'text' ? 0 : 8 * 1.3) + erkl.length * 9.5 * 1.35
        : 0;
      return { z, frage, spaeter, erkl, kern, hoehe: 4 + kern + erklH + 4 };
    });
    return {
      hoehe: KOPF + 1 * MM + reihen.reduce((x, r) => x + r.hoehe, 0),
      zeichnen: (seite, oben) => {
        let o =
          abschnittKopf(seite, s.ersetzen(titel), x0, breite, oben - 8 * MM - 8, s.bold) - 1 * MM;
        reihen.forEach((r, i) => {
          if (i > 0)
            seite.drawLine({
              start: { x: x0, y: o },
              end: { x: x1, y: o },
              thickness: 0.4,
              color: FRAGEN_LINIE,
            });
          const grund = o - 4 - 10.5;
          r.frage.forEach((t, j) =>
            zeichnen(seite, t, x0, grund - j * 10.5 * 1.3, 10.5, s.regular),
          );
          if (r.z.art === 'hinweis') {
            r.spaeter.forEach((t, j) =>
              zeichnen(
                seite,
                t,
                x1 - s.regular.widthOfTextAtSize(t, 8.5),
                grund - j * 8.5 * 1.3,
                8.5,
                s.regular,
                INK,
              ),
            );
          } else if (r.z.art === 'janein') {
            // DP30: Die gegebene Antwort fett in Tinte, die andere grau; keine Kästchen.
            const ja = r.z.antwort === 'ja';
            const nein = r.z.antwort === 'nein';
            const neinB = (nein ? s.bold : s.regular).widthOfTextAtSize('Nein', 10.5);
            const jaB = (ja ? s.bold : s.regular).widthOfTextAtSize('Ja', 10.5);
            const neinX = x1 - neinB;
            const jaX = neinX - 10 - jaB;
            zeichnen(seite, 'Ja', jaX, grund, 10.5, ja ? s.bold : s.regular, ja ? INK : AUS);
            zeichnen(
              seite,
              'Nein',
              neinX,
              grund,
              10.5,
              nein ? s.bold : s.regular,
              nein ? INK : AUS,
            );
            if (!ja && !nein)
              zeichnen(
                seite,
                OHNE,
                x1 - s.regular.widthOfTextAtSize(OHNE, 8),
                grund - 10.5 * 1.3,
                8,
                s.regular,
                INK,
              );
          }
          if (r.erkl.length) {
            const mitWort = r.z.art !== 'text';
            const eo = grund - (r.frage.length - 1) * 10.5 * 1.3 - 2 * MM - (mitWort ? 8 : 0);
            if (mitWort) zeichnen(seite, 'Erläuterung', x0 + EINZUG, eo, 8, s.regular, INK);
            const erste = mitWort ? eo - 8 * 0.3 - 9.5 : eo - 9.5;
            r.erkl.forEach((t, j) =>
              zeichnen(seite, t, x0 + EINZUG, erste - j * 9.5 * 1.35, 9.5, s.regular),
            );
          }
          o -= r.hoehe;
        });
      },
    };
  }

  // ---------- Titel ----------
  const titelGroesse = 15;
  const name = s.ersetzen(a.name);
  const vorTitel = 'Selbstauskunft von';
  const rolle = a.buerge
    ? // PC205 (E363): wie „Rolle: Bürgt“, ohne die Form nach Geschlecht.
      'Bürgt, zieht nicht ein.'
    : 'Im Mietvertrag.';
  // PC207, 2: Der Musterbogen kennt keine Bürgen. Bei ihnen steht er darum weder hier noch in der Fußnote.
  const musterbogen = 'Nach dem Musterbogen der Datenschutzkonferenz, Stand Januar 2026.';
  const unter = s.ersetzen(
    a.buerge ? rolle : a.ohneRolle ? musterbogen : `${rolle} ${musterbogen}`,
  );
  const titelZeichnen = (seite: PDFPage, oben: number): number => {
    let y = oben - 10 * MM - titelGroesse;
    const vorB = s.bold.widthOfTextAtSize(`${vorTitel} `, titelGroesse);
    const nameX = x0 + vorB + ZEICHEN + 5;
    const nameZeilen = inSpalte(name, s.bold, titelGroesse, x1 - nameX);
    zeichnen(seite, vorTitel, x0, y, titelGroesse, s.bold);
    seite.drawRectangle(
      a.buerge
        ? {
            x: x0 + vorB + 0.375,
            y: y + 0.375,
            width: ZEICHEN - 0.75,
            height: ZEICHEN - 0.75,
            borderColor: farbe,
            borderWidth: 0.75,
          }
        : { x: x0 + vorB, y, width: ZEICHEN, height: ZEICHEN, color: farbe },
    );
    nameZeilen.forEach((t, j) => {
      zeichnen(seite, t, nameX, y, titelGroesse, s.bold);
      if (j < nameZeilen.length - 1) y -= titelGroesse * 1.15;
    });
    for (const t of inSpalte(unter, s.regular, 9, breite)) {
      y -= 9 * 1.35 + 1;
      zeichnen(seite, t, x0, y, 9, s.regular, INK);
    }
    return y - 2;
  };

  // ---------- Ort, Datum (fester Platz unten) ----------
  const fussnote = a.buerge
    ? FUSSNOTE_BUERGE
    : a.mitHinweis
      ? `${FUSSNOTE}; was dort nicht steht, fragt ${APP_NAME} nicht.`
      : `${FUSSNOTE}.`;
  const fussZeilen = inSpalte(s.ersetzen(fussnote), s.regular, 8, Math.min(breite, 150 * MM));
  const untHoehe = 10.5 * 1.35 + 2 + 2 + 8 * 1.3 + 8 + fussZeilen.length * 8 * 1.35;
  const untZeichnen = (seite: PDFPage) => {
    let y = fussOben + untHoehe;
    const feld = (x: number, wert: string, etikett: string) => {
      const wertY = y - 10.5;
      if (wert) zeichnen(seite, s.ersetzen(wert), x, wertY, 10.5, s.regular);
      const linie = wertY - 2 - 2;
      seite.drawLine({
        start: { x, y: linie },
        end: { x: x + 70 * MM, y: linie },
        thickness: 0.5,
        color: INK,
      });
      zeichnen(seite, etikett, x, linie - 2 - 8, 8, s.regular, INK);
      return linie - 2 - 8 * 1.3;
    };
    const nachFeld = feld(x0, a.ortDatum, a.ortLabel ?? 'Ort, Datum');
    if (a.unterschrift) feld(x0 + 70 * MM + 12 * MM, '', 'Unterschrift');
    y = nachFeld - 8;
    for (const t of fussZeilen) {
      y -= 8;
      zeichnen(seite, t, x0, y, 8, s.regular, GRAU);
      y -= 8 * 0.35;
    }
  };

  // ---------- Seiten ----------
  const seiten: PDFPage[] = [];
  const neueSeite = (weiter: boolean): number => {
    const seite = pdf.addPage([B, H]);
    seiten.push(seite);
    const linie = a.briefkopf ? briefkopf(seite, a.briefkopf, s) : H - BOGEN_OBEN + 10 * MM;
    if (!weiter) return titelZeichnen(seite, linie);
    // Folgeseite: der Name klein, kein „Fortsetzung“.
    const y = linie - 8 * MM - 9;
    zeichnen(seite, s.ersetzen(`Selbstauskunft von ${a.name}`), x0, y, 9, s.regular, INK);
    return y - 2;
  };
  let oben = neueSeite(false);
  let frisch = true;
  abschnitte.forEach((ab, i) => {
    // Der letzte Abschnitt braucht Platz über „Ort, Datum“, die anderen nur über der Fußzeile.
    const grenze = fussOben + 4 * MM + (i === abschnitte.length - 1 ? untHoehe : 0);
    if (!frisch && oben - ab.hoehe < grenze) oben = neueSeite(true);
    ab.zeichnen(seiten.at(-1)!, oben);
    oben -= ab.hoehe;
    frisch = false;
  });
  // „Ort, Datum“ steht an festem Platz unten. Reicht der Platz unter dem letzten Abschnitt nicht (sehr
  // lange Erläuterung), kommt er auf eine eigene Seite, mit Briefkopf und Namen.
  if (oben < fussOben + untHoehe + 4 * MM) neueSeite(true);
  untZeichnen(seiten.at(-1)!);
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

/**
 * PC213 (DP134, Abschnitt 4): mehrere Selbstauskünfte in einer Datei, wie die App sie einzeln baut. „Seite 1 von 2“
 * zählt über die ganze Datei; im Fuß steht der Name der Person dieser Seite.
 */
export async function selbstauskuenfteBauen(
  inhalte: SelbstauskunftInhalt[],
  a: { dateiname: string; schriften: Schriften; datum?: Date },
): Promise<{ bytes: Uint8Array; seiten: string[] }> {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(a.schriften.regular, { subset: true });
  const s = {
    regular,
    bold: await pdf.embedFont(a.schriften.bold, { subset: true }),
    titel: await pdf.embedFont(a.schriften.titel, { subset: true }),
    ersetzen: zeichenErsetzer(regular),
  };
  const namen: string[] = [];
  for (const inhalt of inhalte) {
    const vorher = pdf.getPageCount();
    selbstauskunftZeichnen(pdf, s, inhalt);
    for (let i = vorher; i < pdf.getPageCount(); i++) namen.push(inhalt.name);
  }
  const gesamt = pdf.getPageCount();
  pdf
    .getPages()
    .forEach((p, i) => fusszeile(p, i + 1, gesamt, s.ersetzen(namen[i] ?? ''), s.regular));
  const datum = a.datum ?? new Date();
  pdf.setTitle(titelAusDateiname(a.dateiname));
  pdf.setLanguage('de-DE');
  pdf.setCreationDate(datum);
  pdf.setModificationDate(datum);
  return { bytes: await pdf.save(), seiten: namen };
}
