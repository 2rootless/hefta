import fontkit from '@cantoo/fontkit';
import { PDFDocument, rgb, type Color, type PDFFont, type PDFPage } from '@cantoo/pdf-lib';
import type { FormBlock, FormZeile } from '../domain/selbstauskunft';
import { APP_NAME } from '../app/name';
import { A4, fusszeile, titelAusDateiname, type Schriften } from './mappe';

// Selbstauskunft als festes Formular nach dem Musterbogen (design/mappe-feinschliff.md, § 1; Gestalt nach B14):
// Blatt mit Reiter, dann immer dieselben Blöcke und Zeilen. Fehlt eine Angabe, steht „keine Angabe“ an ihrer
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
// B14 (mappe14.py): warme Tinte, leise Schrift, Rand des Blatts, Grund und Linien des Fragenbereichs.
const INK = hex('#26221e');
const LEISE = hex('#433d37');
const RAND_BLATT = hex('#6b625a');
const FRAGEN_GRUND = hex('#f6f1e9');
const FRAGEN_LINIE = hex('#ddd3c5');
const WEISS = rgb(1, 1, 1);
const OHNE = 'keine Angabe';
const QUELLE = 'nach dem Musterbogen der Datenschutzkonferenz, Stand Januar 2026';
const FUSSNOTE =
  'Angaben der Person selbst. Fragen und Reihenfolge folgen dem Musterbogen der Datenschutzkonferenz';
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

/** Rechteck mit runden Ecken (oben links, oben rechts, unten rechts, unten links), als SVG-Pfad. */
export function rundesRechteck(
  seite: PDFPage,
  x: number,
  oben: number,
  breite: number,
  hoehe: number,
  [ol, or, ur, ul]: [number, number, number, number],
  stil: { color?: Color; borderColor?: Color; borderWidth?: number },
  ohneUnten = false,
) {
  const k = 0.5523;
  const p = [
    `M ${ol} 0 L ${breite - or} 0`,
    or ? `C ${breite - or + or * k} 0 ${breite} ${or - or * k} ${breite} ${or}` : '',
    `L ${breite} ${hoehe - ur}`,
    ur
      ? `C ${breite} ${hoehe - ur + ur * k} ${breite - ur + ur * k} ${hoehe} ${breite - ur} ${hoehe}`
      : '',
    ohneUnten ? `M ${ul} ${hoehe}` : `L ${ul} ${hoehe}`,
    ul ? `C ${ul - ul * k} ${hoehe} 0 ${hoehe - ul + ul * k} 0 ${hoehe - ul}` : '',
    `L 0 ${ol}`,
    ol ? `C 0 ${ol - ol * k} ${ol - ol * k} 0 ${ol} 0` : '',
    ohneUnten ? '' : 'Z',
  ]
    .filter(Boolean)
    .join(' ');
  seite.drawSvgPath(p, { x, y: oben, ...stil });
}

/** Ein gemessener Abschnitt: Höhe ohne und mit Abstand oben, und wie er gezeichnet wird. */
interface Teil {
  fragen: boolean;
  hoehe: (erster: boolean) => number;
  zeichnen: (seite: PDFPage, oben: number, erster: boolean) => void;
}

/**
 * Hängt die Seiten des Bogens an das Dokument an, ohne Kopf- und Fußzeile. B14, Fassung 2 und 3
 * (`mappe14.py`, `.sa2`): ein Blatt mit Reiter, Werte auf feinen Linien mit dem Etikett darüber, die Fragen
 * in einem eigenen Bereich mit gefüllten Kästchen. Umbruch nur zwischen Abschnitten; das Blatt schließt
 * unten und öffnet auf der nächsten Seite neu; „Ort, Datum“ steht nie allein.
 */
export function selbstauskunftZeichnen(
  pdf: PDFDocument,
  s: AuskunftSchriften,
  a: SelbstauskunftInhalt,
): PDFPage[] {
  const x0 = 20 * MM;
  const x1 = A4.breite - 20 * MM;
  const inhaltOben = 30 * MM; // Abstand vom oberen Rand
  const inhaltUnten = A4.hoehe - 30 * MM;
  const reserve = 11 * MM; // Platz für die Fußnote
  const grenze = inhaltUnten - reserve;
  const bx0 = x0 + 6 * MM; // Innenkante des Blatts
  const bx1 = x1 - 6 * MM;
  const b = bx1 - bx0;
  const spalte = (b - 8 * MM) / 2;
  const y = (vonOben: number) => A4.hoehe - vonOben;
  const farbe = a.farbe ? hex(a.farbe) : INK;

  const text = (
    seite: PDFPage,
    t: string,
    x: number,
    oben: number,
    groesse: number,
    zeilenhoehe: number,
    font: PDFFont,
    color: Color = INK,
  ) =>
    seite.drawText(t, {
      x,
      y: y(oben + zeilenhoehe / 2 + groesse * 0.34),
      size: groesse,
      font,
      color,
    });

  // ---------- Abschnitte messen ----------
  const h2Hoehe = 9.5 * 1.25;
  const teile: Teil[] = a.bloecke.map((block): Teil => {
    if (block.id === 'fragen') return fragenTeil(block.zeilen, block.titel);
    // Felder in zwei Spalten; was nicht in eine halbe Spalte passt oder immer breit ist, nimmt die ganze Breite.
    interface Feld {
      etikett: string;
      werte: string[];
      leise: boolean;
      breit: boolean;
    }
    const felder: Feld[] = block.zeilen.map((z) => {
      const roh = z.art === 'janein' ? '' : z.wert;
      const leer = !roh.trim();
      const wert = s.ersetzen(leer ? OHNE : roh);
      const halb = inSpalte(wert, s.regular, 10.5, spalte);
      const breit = WEIT.has(z.id) || halb.length > 1;
      return {
        etikett: s.ersetzen(z.etikett),
        werte: breit ? inSpalte(wert, s.regular, 10.5, b) : halb,
        leise: leer || z.art === 'hinweis',
        breit,
      };
    });
    const zeilen: Feld[][] = [];
    for (const f of felder) {
      const letzte = zeilen[zeilen.length - 1];
      if (!f.breit && letzte && letzte.length === 1 && !letzte[0]!.breit) letzte.push(f);
      else zeilen.push([f]);
    }
    const feldHoehe = (f: Feld) =>
      2 * MM + 8 * 1.25 + 0.5 * MM + f.werte.length * 10.5 * 1.3 + 1.1 * MM;
    const zeilenHoehe = zeilen.map((z) => Math.max(...z.map(feldHoehe)));
    const summe = zeilenHoehe.reduce((x, h) => x + h, 0);
    const abstand = (erster: boolean) => (erster ? 0 : 5.2 * MM);
    return {
      fragen: false,
      hoehe: (erster) => abstand(erster) + h2Hoehe + 0.4 * MM + summe,
      zeichnen: (seite, oben, erster) => {
        let o = oben + abstand(erster);
        text(seite, s.ersetzen(block.titel), bx0, o, 9.5, h2Hoehe, s.bold);
        o += h2Hoehe + 0.4 * MM;
        zeilen.forEach((reihe, i) => {
          const h = zeilenHoehe[i]!;
          reihe.forEach((f, k) => {
            const x = f.breit ? bx0 : bx0 + k * (spalte + 8 * MM);
            const w = f.breit ? b : spalte;
            text(seite, f.etikett, x, o + 2 * MM, 8, 8 * 1.25, s.regular, LEISE);
            f.werte.forEach((t, j) =>
              text(
                seite,
                t,
                x,
                o + 2 * MM + 8 * 1.25 + 0.5 * MM + j * 10.5 * 1.3,
                10.5,
                10.5 * 1.3,
                s.regular,
                f.leise ? LEISE : INK,
              ),
            );
            seite.drawLine({
              start: { x, y: y(o + h) },
              end: { x: x + w, y: y(o + h) },
              thickness: 0.4,
              color: RAND_BLATT,
            });
          });
          o += h;
        });
      },
    };
  });

  function fragenTeil(zeilen: FormZeile[], titel: string): Teil {
    const pad = 4 * MM;
    const w = b; // der Bereich liegt im Blatt
    const nr = 5 * MM;
    const lueck = 3 * MM;
    const ant = 36 * MM;
    const textBreite = w - 2 * pad - nr - 2 * lueck - ant;
    const erklBreite = w - 2 * pad - nr - lueck - 6 * MM - 2;
    const reihen = zeilen.map((z) => {
      const frage = inSpalte(s.ersetzen(z.etikett), s.regular, 9.5, textBreite);
      const spaeter = z.art === 'hinweis' ? inSpalte(s.ersetzen(z.wert), s.regular, 8.5, ant) : [];
      const antwort = z.art === 'janein' ? z.antwort : null;
      const ohne = z.art === 'janein' && antwort === null;
      const erkl =
        z.art === 'janein' && z.erklaerung.trim()
          ? inSpalte(s.ersetzen(z.erklaerung.trim()), s.regular, 9.5, erklBreite)
          : [];
      const antH =
        z.art === 'hinweis'
          ? spaeter.length * 8.5 * 1.3
          : 4 * MM + (ohne ? 0.6 * MM + 8 * 1.25 : 0);
      const kern = Math.max(frage.length * 9.5 * 1.32, antH);
      const erklH = erkl.length
        ? 1.8 * MM + 2 * MM + 8 * 1.25 + 0.4 * MM + erkl.length * 9.5 * 1.38 + 2 * MM
        : 0;
      return {
        z,
        frage,
        spaeter,
        antwort,
        ohne,
        erkl,
        kern,
        hoehe: 2.3 * MM + kern + erklH + 2.3 * MM,
      };
    });
    const innen =
      3.2 * MM + h2Hoehe + 0.8 * MM + reihen.reduce((x, r) => x + r.hoehe, 0) + 2.6 * MM;
    const abstand = (erster: boolean) => (erster ? 0 : 6 * MM);
    return {
      fragen: true,
      hoehe: (erster) => abstand(erster) + innen,
      zeichnen: (seite, oben, erster) => {
        const top = oben + abstand(erster);
        rundesRechteck(seite, bx0, y(top), w, innen, [2.4 * MM, 2.4 * MM, 2.4 * MM, 2.4 * MM], {
          color: FRAGEN_GRUND,
        });
        let o = top + 3.2 * MM;
        text(seite, s.ersetzen(titel), bx0 + pad, o, 9.5, h2Hoehe, s.bold);
        o += h2Hoehe + 0.8 * MM;
        reihen.forEach((r, i) => {
          if (i > 0)
            seite.drawLine({
              start: { x: bx0 + pad, y: y(o) },
              end: { x: bx0 + w - pad, y: y(o) },
              thickness: 0.4,
              color: FRAGEN_LINIE,
            });
          const zo = o + 2.3 * MM;
          text(seite, `${i + 1}.`, bx0 + pad, zo, 10, 9.5 * 1.32, s.bold);
          r.frage.forEach((t, j) =>
            text(seite, t, bx0 + pad + nr + lueck, zo + j * 9.5 * 1.32, 9.5, 9.5 * 1.32, s.regular),
          );
          const rechts = bx0 + w - pad;
          if (r.z.art === 'hinweis') {
            r.spaeter.forEach((t, j) =>
              text(
                seite,
                t,
                rechts - s.regular.widthOfTextAtSize(t, 8.5),
                zo + j * 8.5 * 1.3,
                8.5,
                8.5 * 1.3,
                s.regular,
                LEISE,
              ),
            );
          } else {
            // „Ja“ und „Nein“ rechtsbündig; das gewählte Kästchen in Tinte gefüllt, das Wort fett (B14, Option 3).
            const kb = 4 * MM;
            const wort = (t: string, an: boolean) =>
              (an ? s.bold : s.regular).widthOfTextAtSize(t, 10.5);
            const nein = r.antwort === 'nein';
            const ja = r.antwort === 'ja';
            const neinX = rechts - wort('Nein', nein) - 1.8 * MM - kb;
            const jaX = neinX - 6 * MM - wort('Ja', ja) - 1.8 * MM - kb;
            for (const [x, t, an] of [
              [jaX, 'Ja', ja],
              [neinX, 'Nein', nein],
            ] as const) {
              rundesRechteck(seite, x, y(zo), kb, kb, [0.9 * MM, 0.9 * MM, 0.9 * MM, 0.9 * MM], {
                ...(an ? { color: INK } : { color: WEISS }),
                borderColor: INK,
                borderWidth: 0.8,
              });
              text(seite, t, x + kb + 1.8 * MM, zo, 10.5, kb, an ? s.bold : s.regular);
            }
            if (r.ohne)
              text(
                seite,
                OHNE,
                rechts - s.regular.widthOfTextAtSize(OHNE, 8),
                zo + kb + 0.6 * MM,
                8,
                8 * 1.25,
                s.regular,
                LEISE,
              );
          }
          if (r.erkl.length) {
            // Erläuterung zu einem Ja: weißes Feld mit Strich links, „Erläuterung“ klein darüber (B14, Fassung 3).
            const ex = bx0 + pad + nr + lueck;
            const eo = zo + r.kern + 1.8 * MM;
            const eh = 2 * MM + 8 * 1.25 + 0.4 * MM + r.erkl.length * 9.5 * 1.38 + 2 * MM;
            const ew = rechts - ex;
            rundesRechteck(seite, ex, y(eo), ew, eh, [1.6 * MM, 1.6 * MM, 1.6 * MM, 1.6 * MM], {
              color: WEISS,
            });
            seite.drawRectangle({ x: ex, y: y(eo + eh), width: 2, height: eh, color: INK });
            text(seite, 'Erläuterung', ex + 2 + 3 * MM, eo + 2 * MM, 8, 8 * 1.25, s.regular, LEISE);
            r.erkl.forEach((t, j) =>
              text(
                seite,
                t,
                ex + 2 + 3 * MM,
                eo + 2 * MM + 8 * 1.25 + 0.4 * MM + j * 9.5 * 1.38,
                9.5,
                9.5 * 1.38,
                s.regular,
              ),
            );
          }
          o += r.hoehe;
        });
      },
    };
  }

  // ---------- Ort, Datum ----------
  const untHoehe = 8 * MM + 6 * MM + 1.1 * MM + 8 * 1.25;
  const untZeichnen = (seite: PDFPage, oben: number) => {
    const linie = oben + 8 * MM + 6 * MM;
    const feld = (x: number, wert: string, etikett: string) => {
      if (wert)
        text(
          seite,
          s.ersetzen(wert),
          x,
          linie - 1.2 * MM - 10.5 * 1.3,
          10.5,
          10.5 * 1.3,
          s.regular,
        );
      seite.drawLine({
        start: { x, y: y(linie) },
        end: { x: x + 76 * MM, y: y(linie) },
        thickness: 0.6,
        color: INK,
      });
      text(seite, etikett, x, linie + 1.1 * MM, 8, 8 * 1.25, s.regular, LEISE);
    };
    feld(x0, a.ortDatum, a.ortLabel ?? 'Ort, Datum');
    if (a.unterschrift) feld(x0 + 76 * MM + 12 * MM, '', 'Unterschrift');
  };

  // ---------- Reiter ----------
  const rolle = a.buerge
    ? a.rolle === 'bürgt'
      ? 'bürgt, zieht nicht ein'
      : `${a.rolle} · bürgt, zieht nicht ein`
    : `${a.rolle} · im Mietvertrag`;
  const reiterMax = x1 - x0;
  const nameZeilen = inSpalte(
    s.ersetzen(a.name),
    s.bold,
    12.5,
    reiterMax - 3.8 * MM - 2.8 * MM - 2.4 * MM - 4.6 * MM,
  );
  const rz = s.ersetzen(rolle);
  const rzBreite = s.regular.widthOfTextAtSize(rz, 9);
  const letzteBreite = s.bold.widthOfTextAtSize(nameZeilen[nameZeilen.length - 1] ?? '', 12.5);
  const textX = 3.8 * MM + 2.8 * MM + 2.4 * MM;
  const rzNeben = textX + letzteBreite + 2.2 * MM + rzBreite + 4.6 * MM <= reiterMax;
  const reiterZeilen = nameZeilen.length + (rzNeben ? 0 : 1);
  const reiterH = Math.max(8.8 * MM, 1.6 * MM + reiterZeilen * 12.5 * 1.25 + 1.4 * MM);
  const reiterB = Math.min(
    reiterMax,
    textX +
      Math.max(
        ...nameZeilen.map((z) => s.bold.widthOfTextAtSize(z, 12.5)),
        rzNeben ? letzteBreite + 2.2 * MM + rzBreite : rzBreite,
      ) +
      4.6 * MM,
  );
  const reiterZeichnen = (seite: PDFPage, blattOben: number) => {
    const oben = blattOben - reiterH;
    rundesRechteck(
      seite,
      x0,
      y(oben),
      reiterB,
      reiterH,
      [2.6 * MM, 2.6 * MM, 0, 0],
      {
        color: WEISS,
        borderColor: RAND_BLATT,
        borderWidth: 0.6,
      },
      true,
    );
    // Der Reiter geht ins Blatt über: die Kante darunter wird weiß.
    seite.drawRectangle({
      x: x0 + 0.3,
      y: y(blattOben) - 0.7,
      width: reiterB - 0.6,
      height: 1.4,
      color: WEISS,
    });
    const q = 2.8 * MM;
    const qOben = oben + 1.6 * MM + 1.5 * MM;
    seite.drawRectangle(
      a.buerge
        ? {
            x: x0 + 3.8 * MM + 0.7,
            y: y(qOben + q) + 0.7,
            width: q - 1.4,
            height: q - 1.4,
            borderColor: farbe,
            borderWidth: 1.4,
          }
        : { x: x0 + 3.8 * MM, y: y(qOben + q), width: q, height: q, color: farbe },
    );
    nameZeilen.forEach((t, j) =>
      text(seite, t, x0 + textX, oben + 1.6 * MM + j * 12.5 * 1.25, 12.5, 12.5 * 1.25, s.bold),
    );
    const rzOben =
      oben + 1.6 * MM + (rzNeben ? nameZeilen.length - 1 : nameZeilen.length) * 12.5 * 1.25;
    const rzX = rzNeben ? x0 + textX + letzteBreite + 2.2 * MM : x0 + textX;
    text(seite, rz, rzX, rzOben, 9, 12.5 * 1.25, s.regular, LEISE);
  };

  // ---------- Verteilen auf Seiten ----------
  interface SeitenPlan {
    weiter: boolean;
    blattOben: number;
    teile: Teil[];
  }
  const kopfHoehe = 22 * 1.05 + 1.4 * MM + 8.5 * 1.3; // Titel und Zeile zum Musterbogen
  const blattObenErste = inhaltOben + kopfHoehe + 15 * MM;
  const blattObenWeiter = inhaltOben + 9 * 1.3 + 4 * MM;
  const unterkante = (p: SeitenPlan) =>
    p.blattOben + 4.6 * MM + p.teile.reduce((h, t, i) => h + t.hoehe(i === 0), 0) + 5 * MM;
  const plaene: SeitenPlan[] = [{ weiter: false, blattOben: blattObenErste, teile: [] }];
  for (const t of teile) {
    const p = plaene[plaene.length - 1]!;
    p.teile.push(t);
    if (unterkante(p) > grenze && p.teile.length > 1) {
      p.teile.pop();
      plaene.push({ weiter: true, blattOben: blattObenWeiter, teile: [t] });
    }
  }
  // „Ort, Datum“ steht nie allein: Passt die Zeile nicht mehr, geht der letzte Abschnitt mit.
  let letzte = plaene[plaene.length - 1]!;
  if (unterkante(letzte) + untHoehe > grenze) {
    const neu: SeitenPlan = { weiter: true, blattOben: blattObenWeiter, teile: [] };
    if (letzte.teile.length > 1) neu.teile.push(letzte.teile.pop()!);
    plaene.push(neu);
    letzte = neu;
  }

  // ---------- Zeichnen ----------
  const fussnote = a.mitHinweis
    ? `${FUSSNOTE}; was dort nicht steht, fragt ${APP_NAME} nicht.`
    : `${FUSSNOTE}.`;
  const fussZeilen = inSpalte(s.ersetzen(fussnote), s.regular, 8, x1 - x0);
  const seiten: PDFPage[] = [];
  for (const p of plaene) {
    const seite = pdf.addPage([A4.breite, A4.hoehe]);
    seiten.push(seite);
    if (!p.weiter) {
      text(seite, 'Selbstauskunft', x0, inhaltOben, 22, 22 * 1.05, s.titel);
      text(seite, QUELLE, x0, inhaltOben + 22 * 1.05 + 1.4 * MM, 8.5, 8.5 * 1.3, s.regular, LEISE);
    } else
      text(seite, 'Selbstauskunft (Fortsetzung)', x0, inhaltOben, 9, 9 * 1.3, s.regular, LEISE);
    if (p.teile.length) {
      const unten = unterkante(p);
      rundesRechteck(
        seite,
        x0,
        y(p.blattOben),
        x1 - x0,
        unten - p.blattOben,
        [p.weiter ? 3 * MM : 0, 3 * MM, 3 * MM, 3 * MM],
        { borderColor: RAND_BLATT, borderWidth: 0.6 },
      );
      if (!p.weiter) reiterZeichnen(seite, p.blattOben);
      let o = p.blattOben + 4.6 * MM;
      p.teile.forEach((t, i) => {
        t.zeichnen(seite, o, i === 0);
        o += t.hoehe(i === 0);
      });
    }
    fussZeilen.forEach((t, j) =>
      text(
        seite,
        t,
        x0,
        inhaltUnten - (fussZeilen.length - j) * 8 * 1.4,
        8,
        8 * 1.4,
        s.regular,
        LEISE,
      ),
    );
  }
  // Ort, Datum: Passt alles auf die Seite, steht die Zeile unten fest, sonst direkt nach dem Blatt.
  const seite = seiten[seiten.length - 1]!;
  const nachBlatt = letzte.teile.length ? unterkante(letzte) : letzte.blattOben;
  const frei = grenze - nachBlatt;
  untZeichnen(seite, frei > untHoehe + 3.2 * MM ? inhaltUnten - 12 * MM - untHoehe : nachBlatt);
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
