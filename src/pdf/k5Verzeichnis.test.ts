import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { BITTE_VORSCHLAG } from '../domain/export';
import { monatsSpanne } from '../domain/mappeWoerter';
import { pdfSchriften } from '../test/hilfen';
import { lesen } from '../../pakete/hefta-json/src/index';
import { bewerbungBauen, type BewerbungAuftrag, type MappenTeil } from './bewerbung';

// PC132 (DP84, W10): Fehlt eine Datei, darf die Mappe keinen Monat nennen, dessen Seite fehlt. Mit dem Blatt aus DP83
// geht nur eine Mappe hinaus, in der die Datei ausgetauscht ist oder die ganze Unterlage fehlt. Geprüft wird, was
// hinausginge: Jeder Monat, den Lesehilfe und Verzeichnis nennen, hat in der Mappe sein Lesezeichen. Gegenprobe: die
// Mappe, die früher trotz der kaputten Datei hinausging, nennt einen Monat ohne Seite und wird rot.

const MONATE = ['2026-09', '2026-10', '2026-11'];

async function seite(text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText(text, { x: 60, y: 700, size: 18, font: schrift });
  return doc.save();
}

async function auftrag(gehalt: 'alle' | 'eine-kaputt' | 'weggelassen'): Promise<BewerbungAuftrag> {
  const sa = await seite('Selbstauskunft');
  const teile: MappenTeil[] = [
    { abschnitt: 'Selbstauskunft', typ: 'selbstauskunft', quellen: [{ daten: sa }] },
  ];
  if (gehalt !== 'weggelassen')
    teile.push({
      abschnitt: 'Gehaltsnachweise',
      detail: monatsSpanne(MONATE, false),
      typ: 'gehaltsnachweis',
      monate: MONATE,
      quellen: await Promise.all(
        MONATE.map(async (m) => ({
          daten:
            gehalt === 'eine-kaputt' && m === '2026-10'
              ? new TextEncoder().encode('%PDF-1.7 kaputt')
              : await seite(`Gehalt ${m}`),
          kopf: `Gehaltsnachweis ${monatsSpanne([m], true)}`,
        })),
      ),
    });
  return {
    titel: 'Bewerbung Musterweg 7 – Lea Muster',
    fussName: 'Lea Muster',
    kurz: 'Musterweg 7',
    adresse: ['Musterweg 7, 2. OG', '00100 Musterstadt'],
    satz: '',
    fassung: 'Fassung 1 vom 19. November 2026',
    lesehilfeWerte: { fassung: 1 },
    mitziehende: [],
    kennung: '0b7c5e1a-3d2f-4a6b-8c9d-1e2f3a4b5c6d',
    hinweis: true,
    modus: 'marktueblich',
    bitte: BITTE_VORSCHLAG,
    kontakt: ['Lea Muster', 'lea.muster@example.com'],
    kontaktwege: { email: 'lea.muster@example.com' },
    bloecke: [
      {
        person: {
          name: 'Lea Muster',
          vorname: 'Lea',
          nachname: 'Muster',
          rolle: 'Hauptmieterin',
          rolleId: 'hauptmieter',
          farbe: '#e9a970',
        },
        teile,
      },
    ],
    deckblatt: true,
    inhaltsverzeichnis: true,
    fusszeile: true,
    schriften: pdfSchriften(),
    datum: new Date(2026, 10, 19, 9, 0),
  };
}

/** Monate, die Lesehilfe und Verzeichnis nennen, ohne Lesezeichen für ihre Seite in der Mappe. */
async function monateOhneSeite(bytes: Uint8Array): Promise<string[]> {
  const dok = await PDFDocument.load(bytes, { updateMetadata: false });
  const anhang = dok.getAttachments().find((a) => a.name === 'hefta.json');
  const lesehilfe = lesen(anhang!.data)!;
  const aufgabe = pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 });
  const pdf = await aufgabe.promise;
  const titel: string[] = [];
  const sammeln = (liste: { title: string; items?: unknown[] }[] | null) => {
    for (const e of liste ?? []) {
      titel.push(e.title);
      sammeln((e.items ?? []) as { title: string; items?: unknown[] }[]);
    }
  };
  sammeln((await pdf.getOutline()) as { title: string; items?: unknown[] }[] | null);
  await aufgabe.destroy();
  const fehlen: string[] = [];
  for (const u of lesehilfe.haushalt.personen.flatMap((p) => p.unterlagen))
    for (const m of u.monate ?? []) {
      const name = monatsSpanne([m], true);
      if (!titel.some((t) => t.includes(name))) fehlen.push(`${u.typ} ${m}`);
    }
  return fehlen;
}

describe('PC132: kein Monat ohne Seite in der Mappe, die hinausgeht', () => {
  it('alle Dateien da: jeder Monat hat seine Seite, kein Blatt', async () => {
    const e = await bewerbungBauen(await auftrag('alle'));
    expect(e.unlesbar).toEqual([]);
    expect(await monateOhneSeite(e.bytes)).toEqual([]);
  });

  it('„Diesmal weglassen“: ohne die ganze Unterlage nennt die Mappe keinen Monat ohne Seite', async () => {
    const e = await bewerbungBauen(await auftrag('weggelassen'));
    expect(e.unlesbar).toEqual([]);
    expect(await monateOhneSeite(e.bytes)).toEqual([]);
    const lh = lesen(
      (await PDFDocument.load(e.bytes)).getAttachments().find((a) => a.name === 'hefta.json')!.data,
    )!;
    expect(lh.haushalt.personen.flatMap((p) => p.unterlagen).map((u) => u.typ)).not.toContain(
      'gehaltsnachweis',
    );
  });

  it('Gegenprobe: die Mappe mit der kaputten Datei nennt Oktober ohne Seite; darum hält das Blatt sie an', async () => {
    const e = await bewerbungBauen(await auftrag('eine-kaputt'));
    // Das löst in der App das Blatt aus (unlesbar-mappe.spec): Diese Mappe geht so nicht hinaus.
    expect(e.unlesbar).toHaveLength(1);
    expect(await monateOhneSeite(e.bytes)).toEqual(['gehaltsnachweis 2026-10']);
  });
});
