import { PDFDocument } from '@cantoo/pdf-lib';
import type { Bewerbung, MappenAussehen } from '../domain/modell';
import type { ExportEinstellungen } from '../domain/export';
import { nameImPdf, nameText } from '../domain/namen';
import { bewerbungBauen, type BewerbungAuftrag } from '../pdf/bewerbung';
import { PERSONENFARBEN } from '../pdf/mappe';
import {
  pdfOeffnen,
  pdfSchliessen,
  seiteAusschnitt,
  seitenStuecke,
  type PdfDokument,
} from '../pdf/pdfjs';
import { pdfSchriftenLaden } from '../pdf/schriften';
import type { HeftaDb } from '../storage/db';
import type { HaushaltAnsicht } from '../storage/speicher';
import { mappeErstellen, mappeGebaut } from './mappeErstellen';
import { staendeAus } from './mappeDaten';

// Vorschau in „Mappe anpassen“ (design/mappe-pdf.md, AM1 bis AM3): zwei Ausschnitte aus demselben
// PDF-Bau wie die echte Mappe, nicht nachgebaut. Sie zeigt nur zwei Seiten: Alle anderen bleiben
// leer, keine Datei wird gelesen, damit ein Wechsel unter einer Sekunde bleibt.

export interface AussehenVorschau {
  /** Kopfzeile einer Unterlage. */
  kopf: string;
  /** Deckblatt ab der Kurzform „… im Mietvertrag“ bis zur dritten Unterlage der ersten Person. */
  deck: string;
  /** Wessen Kopfzeile es ist. */
  rufname: string;
  /** Ohne Unterlagen im Haushalt: Mustermann, als Beispiel benannt. */
  beispiel: boolean;
}

/** Etwa 56 % der Seite, damit die Schrift auch bei 320 px lesbar bleibt. */
const BREITE = 0.56;
const PIXEL = 720;

/** Kein Zeichen am Rand angeschnitten: Was hineinragt, weitet den Ausschnitt. */
async function rechterRand(
  dokument: PdfDokument,
  nummer: number,
  links: number,
  oben: number,
  unten: number,
): Promise<number> {
  let rand = links + BREITE;
  for (const st of await seitenStuecke(dokument, nummer)) {
    if (st.y + st.hoehe < oben || st.y > unten || st.x >= rand) continue;
    rand = Math.max(rand, st.x + st.breite + 0.01);
  }
  return Math.min(1, rand);
}

async function deckAusschnitt(dokument: PdfDokument): Promise<string> {
  const stuecke = await seitenStuecke(dokument, 1);
  // Seit E25 beginnt die Seitenleiste mit der Kurzform („Zwei im Mietvertrag, …“).
  const kopf = stuecke.find((st) => /im Mietvertrag/i.test(st.text));
  if (!kopf) return seiteAusschnitt(dokument, 1, { x: 0, y: 0, breite: BREITE, hoehe: 0.3 }, PIXEL);
  // Überschrift, Name und drei Unterlagen: fünf Zeilen. Name und Rolle sind verschieden groß und
  // stehen doch in einer Zeile: Was dicht beieinander liegt, zählt als eine.
  const zeilen: { von: number; bis: number }[] = [];
  for (const st of stuecke.filter((x) => x.y >= kopf.y - 0.001).sort((a, b) => a.y - b.y)) {
    const letzte = zeilen.at(-1);
    if (letzte && st.y - letzte.von < 0.01) letzte.bis = Math.max(letzte.bis, st.y + st.hoehe);
    else zeilen.push({ von: st.y, bis: st.y + st.hoehe });
  }
  const letzte = zeilen[Math.min(4, zeilen.length - 1)]!;
  const links = Math.max(0, kopf.x - 0.03);
  const oben = Math.max(0, kopf.y - 0.012);
  // Unterlängen brauchen Platz, die nächste Zeile bleibt draußen: Kein Zeichen wird angeschnitten.
  const unten = letzte.bis + 0.0055;
  const rechts = await rechterRand(dokument, 1, links, oben, unten);
  return seiteAusschnitt(
    dokument,
    1,
    { x: links, y: oben, breite: rechts - links, hoehe: unten - oben },
    PIXEL,
  );
}

async function kopfAusschnitt(dokument: PdfDokument, seite: number): Promise<string> {
  // Von der Kante bis knapp unter die Linie der Kopfzeile (14 mm von 297 mm).
  const unten = 22 / 297;
  const rechts = await rechterRand(dokument, seite, 0, 0, unten);
  return seiteAusschnitt(dokument, seite, { x: 0, y: 0, breite: rechts, hoehe: unten }, PIXEL);
}

async function musterBlatt(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.addPage([595.28, 841.89]);
  return pdf.save();
}

/** Ohne Unterlagen im Haushalt: dieselben Seiten mit Mustermann-Daten. */
async function beispielAuftrag(aussehen: MappenAussehen): Promise<BewerbungAuftrag> {
  const daten = await musterBlatt();
  const teile = (paare: [string, string?][]) =>
    paare.map(([abschnitt, detail]) => ({ abschnitt, detail, quellen: [{ daten }] }));
  return {
    titel: 'Beispiel',
    fussName: 'Max und Lea Mustermann',
    kurz: 'Hauptstraße 12',
    adresse: ['Hauptstraße 12, 3. OG links', '22767 Hamburg'],
    satz: '',
    mitziehende: [],
    kontakt: [],
    bloecke: [
      {
        person: {
          name: 'Max Mustermann',
          rolle: 'Hauptmieter',
          beruf: 'Elektroniker',
          farbe: PERSONENFARBEN[0]!,
        },
        teile: teile([
          ['Selbstauskunft'],
          ['Gehaltsnachweise', 'Juli bis September'],
          ['Bonitätsnachweis', 'vom 20. Oktober 2026'],
        ]),
      },
      {
        person: {
          name: 'Lea Mustermann',
          rolle: 'Mitmieterin',
          beruf: 'Lehrerin',
          farbe: PERSONENFARBEN[1]!,
        },
        teile: teile([['Selbstauskunft'], ['Gehaltsnachweise', 'Juli bis September']]),
      },
    ],
    deckblatt: true,
    inhaltsverzeichnis: true,
    fusszeile: true,
    aussehen,
    schriften: await pdfSchriftenLaden(aussehen.schrift),
  };
}

export async function vorschauBauen(
  db: HeftaDb,
  ansicht: HaushaltAnsicht,
  bewerbung: Pick<Bewerbung, 'adresse' | 'satz'> | null,
  e: ExportEinstellungen,
  aussehen: MappenAussehen,
): Promise<AussehenVorschau> {
  const beispiel = ansicht.versionen.length === 0;
  let bytes: Uint8Array;
  let inhalt: { person: string; seite: number }[];
  if (beispiel) {
    const erg = await bewerbungBauen(await beispielAuftrag(aussehen));
    bytes = erg.bytes;
    inhalt = erg.inhalt;
  } else {
    // Kopfzeile und Deckblatt sollen zu sehen sein, auch wenn sie gerade abgewählt sind: Die
    // Bildunterschrift sagt es dann.
    const erg = await mappeErstellen(
      db,
      ansicht,
      bewerbung,
      { ...e, ausgabe: 'eine', deckblatt: true, inhaltsverzeichnis: true, fusszeile: true },
      new Date(),
      aussehen,
      await musterBlatt(),
    );
    bytes = new Uint8Array(await erg.dateien[0]!.arrayBuffer());
    inhalt = erg.inhalt;
  }
  // Möglichst jemand, der nicht als erster im Haushalt steht: Man sieht, dass jede Seite ihren Namen trägt.
  const block = inhalt[1] ?? inhalt[0];
  const stand = staendeAus(ansicht).find((s) => nameText(nameImPdf(s.person)) === block?.person);
  const rufname =
    stand?.person.rufname || stand?.person.vorname || block?.person.split(' ')[0] || '';
  const dokument = await pdfOeffnen(bytes.slice());
  try {
    return {
      kopf: await kopfAusschnitt(dokument, block?.seite ?? Math.min(2, dokument.numPages)),
      deck: await deckAusschnitt(dokument),
      rufname,
      beispiel,
    };
  } finally {
    await pdfSchliessen(dokument);
  }
}

/** Tipp auf die Vorschau: die ganze Mappe, wie sie mit diesen Einstellungen käme. */
export async function ganzeMappe(
  db: HeftaDb,
  ansicht: HaushaltAnsicht,
  bewerbung: Pick<Bewerbung, 'adresse' | 'satz'> | null,
  e: ExportEinstellungen,
  aussehen: MappenAussehen,
): Promise<Uint8Array> {
  if (ansicht.versionen.length === 0) {
    const auftrag = await beispielAuftrag(aussehen);
    const { deckblatt, inhaltsverzeichnis, fusszeile } = e;
    return (await bewerbungBauen({ ...auftrag, deckblatt, inhaltsverzeichnis, fusszeile })).bytes;
  }
  const erg = await mappeGebaut(db, ansicht, bewerbung, { ...e, ausgabe: 'eine' }, aussehen);
  return new Uint8Array(await erg.dateien[0]!.arrayBuffer());
}
