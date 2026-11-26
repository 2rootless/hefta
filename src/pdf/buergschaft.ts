import fontkit from '@cantoo/fontkit';
import { PDFDocument, rgb, type Color, type PDFFont, type PDFPage } from '@cantoo/pdf-lib';
import { APP_NAME } from '../app/name';
import { buergeWorte, betragText, type BuergschaftAngaben } from '../domain/buergschaft';
import { A4, type Schriften } from './mappe';
import { BOGEN_OBEN, BOGEN_SEITE, GRAU, LINIE_PUNKTE, abschnittKopf } from './bogen';
import { zeichenErsetzer } from './selbstauskunft';

// Bürgschaftserklärung als PDF (E112, DP41 Abschnitt 6), aus dem Briefbogen der Selbstauskunft (DP30): A4,
// Ränder 16/22/12 mm, Kopfzeile 8,5 pt mit Linie, Titel 15 pt, Etiketten in Versalien 8 pt mit Haarlinie,
// Felder zweispaltig. Blatt 1 geht unterschrieben an den Vermieter, Blatt 2 bleibt beim Bürgen und kommt nie
// in die Mappe. Ort, Datum und Unterschrift bleiben für die Hand frei; Hefta setzt kein Datum (W10). Kein
// „freiwillig und unaufgefordert“ auf Blatt 1 (W10). Läuft ohne Browser-APIs.

const MM = 72 / 25.4;
const INK = rgb(0x26 / 255, 0x22 / 255, 0x1e / 255);
const AUS = rgb(0x9a / 255, 0x90 / 255, 0x86 / 255);
const TABELLE_LINIE = rgb(0xd6 / 255, 0xce / 255, 0xc4 / 255);
const NB = ' ';

/** Fuß beider Blätter (PC47 §3). */
export const MUSTER_FUSS = `Muster von ${APP_NAME}, keine Rechtsberatung.`;

interface S {
  regular: PDFFont;
  bold: PDFFont;
  ersetzen: (text: string) => string;
}

/** Ein Stück Text, fett oder normal; daraus werden Zeilen mit gemischter Schrift. */
type Stueck = { text: string; fett?: boolean; farbe?: Color };
type Wort = { text: string; fett: boolean; farbe?: Color; breite: number; raum: number };

function zeilenAus(stuecke: Stueck[], s: S, groesse: number, breite: number): Wort[][] {
  const woerter: Wort[] = [];
  for (const st of stuecke) {
    const font = st.fett ? s.bold : s.regular;
    const teile = s.ersetzen(st.text).split(/( +)/);
    for (const teil of teile) {
      if (!teil) continue;
      if (/^ +$/.test(teil)) {
        const letzte = woerter.at(-1);
        if (letzte) letzte.raum = font.widthOfTextAtSize(' ', groesse);
        continue;
      }
      woerter.push({
        text: teil,
        fett: !!st.fett,
        ...(st.farbe ? { farbe: st.farbe } : {}),
        breite: font.widthOfTextAtSize(teil, groesse),
        raum: 0,
      });
    }
  }
  const zeilen: Wort[][] = [[]];
  let x = 0;
  for (const w of woerter) {
    const zeile = zeilen.at(-1)!;
    const vorher = zeile.at(-1);
    const start = vorher ? x + vorher.raum : 0;
    if (zeile.length && start + w.breite > breite) {
      zeilen.push([w]);
      x = w.breite;
    } else {
      zeile.push(w);
      x = start + w.breite;
    }
  }
  return zeilen;
}

/** Zeichnet Stücke umbrochen ab `y` (Grundlinie der ersten Zeile); gibt die Grundlinie der letzten zurück. */
function absatz(
  seite: PDFPage | null,
  stuecke: Stueck[],
  s: S,
  o: { x: number; y: number; breite: number; groesse: number; zeile: number; farbe?: Color },
): { y: number; zeilen: number } {
  const zeilen = zeilenAus(stuecke, s, o.groesse, o.breite);
  zeilen.forEach((z, i) => {
    let x = o.x;
    const y = o.y - i * o.zeile;
    for (const w of z) {
      seite?.drawText(w.text, {
        x,
        y,
        size: o.groesse,
        font: w.fett ? s.bold : s.regular,
        color: w.farbe ?? o.farbe ?? INK,
      });
      x += w.breite + w.raum;
    }
  });
  return { y: o.y - (zeilen.length - 1) * o.zeile, zeilen: zeilen.length };
}

const TAG = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

/** „1. Januar 2027“ aus „JJJJ-MM-TT“. */
export function tagLang(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso.trim();
  return TAG.format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** „Lindenring 3“ und „Erdgeschoss, 20259 Hamburg“ aus der Zeile der Wohnung. */
function wohnungTeile(wohnung: string): { strasse: string; rest: string } {
  const [strasse = '', ...rest] = wohnung
    .split(/\s*[,\n]\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  return { strasse, rest: rest.join(', ') };
}

/**
 * Kopfzeile (DP30, Abschnitt 4): links fett „Mietverhältnis {Straße}“ mit dem Ort in Grau, rechts der Name;
 * beide Seiten brechen um, wenn sie lang sind (Prüffall E7). Gibt die Lage der Linie zurück.
 */
function kopf(seite: PDFPage, wohnung: string, rechts: string, rechtsFett: boolean, s: S): number {
  const B = A4.breite;
  const H = A4.hoehe;
  const x0 = BOGEN_SEITE;
  const x1 = B - BOGEN_SEITE;
  const g = 8.5;
  const zl = g * 1.35;
  const { strasse, rest } = wohnungTeile(wohnung);
  const rechtsFont = rechtsFett ? s.bold : s.regular;
  const rechtsText = s.ersetzen(rechts);
  const voll = rechtsFont.widthOfTextAtSize(rechtsText, g);
  const halb = (x1 - x0 - 6 * MM) / 2;
  const rechtsBreite = Math.min(voll, halb);
  const linksBreite = x1 - x0 - rechtsBreite - 6 * MM;
  const oben = H - BOGEN_OBEN - g;
  const links = absatz(
    seite,
    [
      { text: strasse ? `Mietverhältnis ${strasse}` : 'Mietverhältnis', fett: true },
      ...(rest ? [{ text: `, ${rest}`, farbe: GRAU }] : []),
    ],
    s,
    { x: x0, y: oben, breite: linksBreite, groesse: g, zeile: zl },
  );
  const rechtsZeilen = absatz(seite, [{ text: rechts, fett: rechtsFett }], s, {
    x: voll <= halb ? x1 - voll : x1 - halb,
    y: oben,
    breite: halb,
    groesse: g,
    zeile: zl,
    farbe: rechtsFett ? INK : GRAU,
  });
  const unten = Math.min(links.y, rechtsZeilen.y);
  const linie = unten - 4 * MM;
  seite.drawLine({
    start: { x: x0, y: linie },
    end: { x: x1, y: linie },
    thickness: 0.5,
    color: INK,
  });
  return linie;
}

/** Linie für die Hand, wo eine Angabe fehlt. */
function handLinie(seite: PDFPage, x: number, y: number, breite: number) {
  seite.drawLine({
    start: { x, y: y - 2 },
    end: { x: x + breite, y: y - 2 },
    thickness: 0.4,
    color: LINIE_PUNKTE,
  });
}

function fuss(seite: PDFPage, s: S) {
  seite.drawText(s.ersetzen(MUSTER_FUSS), {
    x: BOGEN_SEITE,
    y: 12 * MM + 2 * MM,
    size: 7.5,
    font: s.regular,
    color: GRAU,
  });
}

const ART_TEXT = {
  // PC209/PC210: Der Name nach § 771 BGB ist „gewöhnliche Bürgschaft“; der frühere Name meint im Recht eine andere
  // Form. Der interne Wert `ausfall` bleibt, damit keine Daten umgeschrieben werden.
  ausfall: {
    name: 'Gewöhnliche Bürgschaft',
    satz: `Der Vermieter kann mich erst in Anspruch nehmen, wenn eine Zwangsvollstreckung gegen die Mieter erfolglos war (§${NB}771 BGB).`,
  },
  selbstschuldnerisch: {
    name: 'Selbstschuldnerische Bürgschaft',
    satz: `Ich verzichte auf die Einrede der Vorausklage (§${NB}773 Abs.${NB}1 Nr.${NB}1 BGB). Der Vermieter kann sich sofort an mich wenden.`,
  },
} as const;

/** Unterste genutzte Grundlinie je Blatt, für den Prüffall „bleibt einseitig“ (E7). */
export interface BlattMass {
  unten: number;
  grenze: number;
}

/** Blatt 1: die Erklärung für den Vermieter. */
function blattEins(pdf: PDFDocument, a: BuergschaftAngaben, s: S): BlattMass {
  const seite = pdf.addPage([A4.breite, A4.hoehe]);
  const x0 = BOGEN_SEITE;
  const x1 = A4.breite - BOGEN_SEITE;
  const breite = x1 - x0;
  const spalte = (breite - 10 * MM) / 2;
  const worte = buergeWorte();
  const name = a.buerge.name.trim();
  const rechts = [name, worte.kopf].filter(Boolean).join(', ');
  let y = kopf(seite, a.wohnung, rechts, false, s);

  y -= 10 * MM + 15;
  absatz(seite, [{ text: 'Bürgschaftserklärung für ein Mietverhältnis', fett: true }], s, {
    x: x0,
    y,
    breite,
    groesse: 15,
    zeile: 15 * 1.15,
  });

  // Beteiligte: zwei Reihen mit je zwei Feldern.
  const linie = abschnittKopf(seite, s.ersetzen('Beteiligte'), x0, breite, y - 8 * MM - 8, s.bold);
  const tag = a.vertragTag.trim() ? tagLang(a.vertragTag) : '';
  const vertragZeile =
    a.vertrag === 'unterschrieben'
      ? `Mietvertrag vom ${tag}`
      : `Mietvertrag abzuschließen zum ${tag}`;
  const mieter = a.mieter
    .map((m) => m.trim())
    .filter(Boolean)
    .join(', ');
  const felder: { etikett: string; zeilen: string[]; hand?: boolean[] }[] = [
    { etikett: worte.etikett, zeilen: [name, a.buerge.anschrift.trim()] },
    { etikett: 'Mieter', zeilen: [mieter] },
    { etikett: 'Vermieter', zeilen: [a.vermieter.name.trim(), a.vermieter.anschrift.trim()] },
    { etikett: 'Wohnung', zeilen: [a.wohnung.trim(), vertragZeile], hand: [false, !tag] },
  ];
  let o = linie - 4 * MM;
  for (const reihe of [felder.slice(0, 2), felder.slice(2)]) {
    let tiefste = o;
    reihe.forEach((f, k) => {
      const x = x0 + k * (spalte + 10 * MM);
      seite.drawText(s.ersetzen(f.etikett), { x, y: o - 8, size: 8, font: s.regular, color: GRAU });
      let z = o - 8 * 1.3 - 10.5;
      f.zeilen.forEach((wert, i) => {
        if (!wert) {
          handLinie(seite, x, z, spalte * 0.8);
          z -= 10.5 * 1.3;
          return;
        }
        const r = absatz(seite, [{ text: wert }], s, {
          x,
          y: z,
          breite: spalte,
          groesse: 10.5,
          zeile: 10.5 * 1.3,
        });
        if (f.hand?.[i]) {
          const ende = x + s.regular.widthOfTextAtSize(s.ersetzen(wert), 10.5) + 3;
          handLinie(seite, ende, r.y, 30 * MM);
        }
        z = r.y - 10.5 * 1.3;
      });
      tiefste = Math.min(tiefste, z + 10.5 * 1.3 - 10.5 * 0.3);
    });
    o = tiefste - 5 * MM;
  }

  // Erklärung: der Satz aus dem Entwurf, der Betrag fett.
  const erkl = abschnittKopf(seite, s.ersetzen('Erklärung'), x0, breite, o - 3 * MM - 8, s.bold);
  const betrag = a.hoechstbetrag ? `${betragText(a.hoechstbetrag)}${NB}Euro` : '';
  const satz = absatz(
    seite,
    [
      {
        text: 'Ich übernehme gegenüber dem Vermieter die Bürgschaft für die Forderungen aus dem oben genannten Mietverhältnis gegen die Mieter, höchstens bis zu einem Betrag von ',
      },
      { text: betrag, fett: true },
      { text: '.' },
    ],
    s,
    {
      x: x0,
      y: erkl - 4 * MM - 10.5,
      breite: Math.min(breite, 150 * MM),
      groesse: 10.5,
      zeile: 10.5 * 1.4,
    },
  );

  // Art der Bürgschaft: die gewählte angekreuzt und in Tinte, die andere leer und grau (DP30, Ja/Nein).
  const art = abschnittKopf(
    seite,
    s.ersetzen('Art der Bürgschaft'),
    x0,
    breite,
    satz.y - 8 * MM - 8,
    s.bold,
  );
  let ay = art - 4 * MM - 10;
  (['ausfall', 'selbstschuldnerisch'] as const).forEach((id, i) => {
    const gewaehlt = a.art === id;
    const farbe = gewaehlt ? INK : AUS;
    if (i > 0) {
      seite.drawLine({
        start: { x: x0 + 16, y: ay + 10 + (3 * MM) / 2 },
        end: { x: x1, y: ay + 10 + (3 * MM) / 2 },
        thickness: 0.4,
        color: TABELLE_LINIE,
      });
    }
    const k = 7;
    seite.drawRectangle({
      x: x0 + 0.375,
      y: ay - 0.2 + 0.375,
      width: k - 0.75,
      height: k - 0.75,
      borderColor: farbe,
      borderWidth: 0.75,
    });
    if (gewaehlt) {
      seite.drawLine({
        start: { x: x0 + 1.6, y: ay + 1.4 },
        end: { x: x0 + k - 1.6, y: ay + k - 1.8 },
        thickness: 0.75,
        color: INK,
      });
      seite.drawLine({
        start: { x: x0 + 1.6, y: ay + k - 1.8 },
        end: { x: x0 + k - 1.6, y: ay + 1.4 },
        thickness: 0.75,
        color: INK,
      });
    }
    const r = absatz(
      seite,
      [{ text: `${ART_TEXT[id].name}:`, fett: true }, { text: ` ${ART_TEXT[id].satz}` }],
      s,
      { x: x0 + 16, y: ay, breite: breite - 16, groesse: 9.5, zeile: 9.5 * 1.45, farbe },
    );
    ay = r.y - 9.5 * 1.45 - 3 * MM;
  });

  // Unterschrift: 24 mm unter der Art, zwei Linien; beides bleibt leer für die Hand (W10).
  const unterschrift = ay + 9.5 * 1.45 + 3 * MM - 24 * MM;
  const rechtsX = x0 + 80 * MM;
  for (const [x, ende, text] of [
    [x0, x0 + 70 * MM, 'Ort, Datum'],
    [rechtsX, x1, worte.unterschrift],
  ] as const) {
    seite.drawLine({
      start: { x, y: unterschrift },
      end: { x: ende, y: unterschrift },
      thickness: 0.5,
      color: INK,
    });
    seite.drawText(s.ersetzen(text), {
      x,
      y: unterschrift - 2 - 8,
      size: 7.5,
      font: s.regular,
      color: GRAU,
    });
  }
  fuss(seite, s);
  return { unten: unterschrift - 2 - 8, grenze: 12 * MM + 2 * MM + 7.5 + 4 * MM };
}

/**
 * Blatt 2: nur für die Person, die bürgt, nie in der Mappe. Text nach Planung, PC209 (an Gesetz und Urteil
 * geprüft, E356, E377), die Sätze zu den zwei Arten nach PC210, Abschnitt 3 mit den Worten von Blatt 1.
 */
function blattZwei(pdf: PDFDocument, a: BuergschaftAngaben, s: S): BlattMass {
  const seite = pdf.addPage([A4.breite, A4.hoehe]);
  const x0 = BOGEN_SEITE;
  const x1 = A4.breite - BOGEN_SEITE;
  const breite = x1 - x0;
  const name = a.buerge.name.trim();
  let y = kopf(seite, a.wohnung, name ? `Nur für ${name}` : 'Nur für Sie', true, s);
  const G = 9.5;
  const ZL = G * 1.4;
  const text = (stuecke: Stueck[], oben: number, b = breite, farbe?: Color) =>
    absatz(seite, stuecke, s, {
      x: x0,
      y: oben,
      breite: b,
      groesse: G,
      zeile: ZL,
      ...(farbe ? { farbe } : {}),
    });

  y -= 8 * MM + 15;
  seite.drawText(s.ersetzen('Bevor Sie unterschreiben'), {
    x: x0,
    y,
    size: 15,
    font: s.bold,
    color: INK,
  });
  y = absatz(
    seite,
    [
      {
        text: 'Was die Bürgschaftserklärung auf Blatt 1 bedeutet. Dieses Blatt geht nicht an den Vermieter.',
      },
    ],
    s,
    { x: x0, y: y - 9 * 1.35 - 1, breite, groesse: 8.5, zeile: 8.5 * 1.35, farbe: GRAU },
  ).y;

  const abschnitt = (titel: string, oben: number) =>
    abschnittKopf(seite, s.ersetzen(titel), x0, breite, oben - 6 * MM - 8, s.bold) - 3 * MM - G;

  y = abschnitt('Was Sie versprechen', y);
  y = text(
    [
      {
        text: `Wer bürgt, steht gegenüber dem Vermieter dafür ein, dass die Mieter ihre Pflichten aus dem Mietvertrag erfüllen (§${NB}765 BGB). Es zählt, was die Mieter jeweils schulden, auch wenn es durch Verzug mehr wird (§${NB}767 Abs.${NB}1 BGB). Dazu kommen die Kosten der Kündigung und der Rechtsverfolgung, etwa für Gericht und Anwalt, wenn die Mieter sie dem Vermieter ersetzen müssen (§${NB}767 Abs.${NB}2 BGB). Vorher frei werden Sie nur, wenn der Vermieter zustimmt (§${NB}397 BGB).`,
      },
    ],
    y,
  ).y;
  y = text(
    [
      { text: 'Auf Blatt 1 steht als Höchstbetrag ' },
      { text: a.hoechstbetrag ? `${betragText(a.hoechstbetrag)}${NB}Euro` : '', fett: true },
      { text: '. Er begrenzt, wofür Sie höchstens einstehen.' },
    ],
    y - ZL - 1 * MM,
  ).y;

  // Die zwei Arten nebeneinander; die gewählte trägt „auf Blatt 1 gewählt“ (E6).
  y = abschnitt('Die zwei Arten', y);
  const spalte = (breite - 10 * MM) / 2;
  const arten = [
    {
      id: 'ausfall' as const,
      name: 'Gewöhnliche Bürgschaft',
      satz: `So gilt sie, wenn nichts anderes vereinbart ist. Der Vermieter kann sich erst an Sie wenden, wenn eine Zwangsvollstreckung gegen die Mieter erfolglos war (Einrede der Vorausklage, §${NB}771 BGB).`,
    },
    {
      id: 'selbstschuldnerisch' as const,
      name: 'Selbstschuldnerische Bürgschaft',
      satz: `Sie muss eigens vereinbart werden. Dann fällt diese Einrede weg, und der Vermieter kann sich sofort an Sie wenden (§${NB}773 Abs.${NB}1 Nr.${NB}1 BGB).`,
    },
  ];
  let tief = y;
  arten.forEach((art, k) => {
    const x = x0 + k * (spalte + 10 * MM);
    seite.drawText(s.ersetzen(art.name), { x, y, size: G, font: s.bold, color: INK });
    if (a.art === art.id) {
      const nb = s.bold.widthOfTextAtSize(s.ersetzen(art.name), G);
      seite.drawText(s.ersetzen('auf Blatt 1 gewählt'), {
        x: x + nb + 6,
        y,
        size: 7.5,
        font: s.regular,
        color: GRAU,
      });
    }
    const r = absatz(seite, [{ text: art.satz }], s, {
      x,
      y: y - ZL,
      breite: spalte,
      groesse: G,
      zeile: ZL,
    });
    tief = Math.min(tief, r.y);
  });
  y = tief;

  y = abschnitt('Form', y);
  y = text(
    [
      {
        text: `Eine Bürgschaft gilt nur, wenn Sie die Erklärung schriftlich erteilen; in elektronischer Form ist sie ausgeschlossen (§${NB}766 BGB). Schriftlich heißt: mit eigenhändiger Unterschrift (§${NB}126 BGB). Eine Mail, ein PDF ohne Unterschrift oder ein Haken in einem Formular reichen nicht. Darum unterschreiben Sie Blatt 1 von Hand und geben es dem Vermieter.`,
      },
    ],
    y,
  ).y;

  y = abschnitt('Wie hoch', y);
  y = text(
    [
      {
        text: `Eine Mietsicherheit darf höchstens drei Monatsmieten ohne Nebenkosten betragen (§${NB}551 Abs.${NB}1 BGB). Für Bürgschaften hat der Bundesgerichtshof entschieden:`,
      },
    ],
    y,
  ).y;

  // Tabelle: Fall, Was gilt, Grundlage (grau). Feine Linien zwischen den Zeilen.
  const T = 8.5;
  const TZ = T * 1.4;
  const sp = [breite * 0.34, breite * 0.31, breite * 0.35];
  const xs = [x0, x0 + sp[0]!, x0 + sp[0]! + sp[1]!];
  y -= 6 * MM;
  ['Fall', 'Was gilt', 'Grundlage'].forEach((k, i) =>
    seite.drawText(s.ersetzen(k), { x: xs[i]!, y, size: 7.5, font: s.regular, color: GRAU }),
  );
  y -= 2 * MM;
  const reihen: Stueck[][][] = [
    [
      [
        { text: 'Vermieter verlangt Kaution ' },
        { text: 'und', fett: true },
        { text: ' Bürgschaft' },
      ],
      [{ text: 'Über drei Monatsmieten hinaus müssen Sie nicht zahlen' }],
      [{ text: `BGH, 20.04.1989, IX${NB}ZR${NB}212/88, BGHZ${NB}107, 210` }],
    ],
    [
      [{ text: 'Volle Kaution, Bürgschaft zusätzlich verlangt' }],
      [{ text: 'Die Pflicht zur Bürgschaft ist unwirksam, die Kaution bleibt' }],
      [{ text: `BGH, 30.06.2004, VIII${NB}ZR${NB}243/03, Rn.${NB}25 bis 28` }],
    ],
    [
      [{ text: 'Bürgschaft von sich aus angeboten, damit der Mietvertrag zustande kommt' }],
      [{ text: 'Die Grenze von drei Monatsmieten gilt nicht' }],
      [
        {
          text: `BGH, 07.06.1990, IX${NB}ZR${NB}16/90, BGHZ${NB}111, 361; bestätigt 2004, Rn.${NB}25`,
        },
      ],
    ],
    [
      [{ text: 'Bürgschaft, damit der Vermieter wegen Mietrückständen nicht kündigt' }],
      [{ text: 'Die Grenze von drei Monatsmieten gilt nicht' }],
      [{ text: `BGH, 10.04.2013, VIII${NB}ZR${NB}379/12, Rn.${NB}13 bis 15` }],
    ],
  ];
  for (const reihe of reihen) {
    seite.drawLine({
      start: { x: x0, y },
      end: { x: x1, y },
      thickness: 0.4,
      color: TABELLE_LINIE,
    });
    let unten = y;
    reihe.forEach((zelle, i) => {
      const r = absatz(seite, zelle, s, {
        x: xs[i]!,
        y: y - 2 * MM - T,
        breite: sp[i]! - 4 * MM,
        groesse: T,
        zeile: TZ,
        farbe: i === 2 ? GRAU : INK,
      });
      unten = Math.min(unten, r.y);
    });
    y = unten - 2.5 * MM;
  }
  seite.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness: 0.4, color: TABELLE_LINIE });
  y = text(
    [
      { text: 'Beratung:', fett: true },
      {
        text: ' Was das für Ihren Fall heißt, klären Sie im Zweifel mit einem Mieterverein. Die Urteile betreffen jeweils einen Einzelfall.',
      },
    ],
    y - 4 * MM - G,
  ).y;

  // Unten: Linie in Tinte, der Satz fett, Quellen klein.
  y -= 8 * MM;
  seite.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness: 0.5, color: INK });
  y = absatz(
    seite,
    [
      {
        text: 'Dieses Blatt bleibt bei Ihnen. Es geht nicht an den Vermieter und nicht in die Mappe.',
        fett: true,
      },
    ],
    s,
    { x: x0, y: y - 4 * MM - 9, breite, groesse: 9, zeile: 9 * 1.35 },
  ).y;
  y = absatz(
    seite,
    [
      {
        text: `Quellen: §§${NB}126, 397, 551, 765, 766, 767, 771, 773 BGB; Bundesgerichtshof, Urteile vom 20.04.1989 (IX${NB}ZR${NB}212/88), 07.06.1990 (IX${NB}ZR${NB}16/90), 30.06.2004 (VIII${NB}ZR${NB}243/03) und 10.04.2013 (VIII${NB}ZR${NB}379/12). Zusammengefasst von ${APP_NAME} im November 2026.`,
      },
    ],
    s,
    { x: x0, y: y - 7 * 1.35 - 1, breite, groesse: 7, zeile: 7 * 1.35, farbe: GRAU },
  ).y;
  fuss(seite, s);
  return { unten: y, grenze: 12 * MM + 2 * MM + 7.5 + 4 * MM };
}

export interface BuergschaftErgebnis {
  bytes: Uint8Array;
  seiten: number;
  /** Je Blatt: wie tief es reicht und wo der Fuß beginnt (Prüffall E7). */
  mass: BlattMass[];
}

/** Beide Blätter in einer Datei (DP41: „Zwei Blätter, beide zum Ausdrucken“). */
export async function buergschaftBauen(
  a: BuergschaftAngaben,
  schriften: Schriften,
  datum = new Date(),
): Promise<BuergschaftErgebnis> {
  // updateMetadata: false verhindert Producer/Creator mit Softwarenamen.
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(schriften.regular, { subset: true });
  const s: S = {
    regular,
    bold: await pdf.embedFont(schriften.bold, { subset: true }),
    ersetzen: zeichenErsetzer(regular),
  };
  const mass = [blattEins(pdf, a, s), blattZwei(pdf, a, s)];
  pdf.setTitle('Bürgschaftserklärung');
  pdf.setLanguage('de-DE');
  pdf.setCreationDate(datum);
  pdf.setModificationDate(datum);
  return { bytes: await pdf.save(), seiten: pdf.getPageCount(), mass };
}
