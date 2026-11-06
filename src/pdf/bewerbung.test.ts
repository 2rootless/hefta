import { join } from 'node:path';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRef,
  StandardFonts,
  degrees,
} from '@cantoo/pdf-lib';
import { readFileSync } from 'node:fs';
import { APP_NAME, VERMIETER_ADRESSE, VERMIETER_DOMAIN } from '../app/name';
import { describe, expect, it } from 'vitest';
import { pdfSchriften, textJeSeite } from '../test/hilfen';
import type { MappenFlaeche, Rolle } from '../domain/modell';
import { bewerbungBauen, leistenTon, type BewerbungAuftrag, type MappenBlock } from './bewerbung';
import { flaechenTon, flaecheVon } from './mappe';

// Prüfungen P1 bis P16, P18 und P19 aus design/mappe-pdf.md; P17 (Schwarzweiß) misst tests/e2e/pdfmappe.spec.ts.

const MM = 72 / 25.4;

async function quelle(seiten: string[], groesse: [number, number] = [595.28, 841.89]) {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  for (const t of seiten) pdf.addPage(groesse).drawText(t, { x: 50, y: 300, size: 14, font: f });
  pdf.setProducer('Lohnportal 3000');
  return pdf.save();
}

const max = {
  name: 'Max Mustermann',
  rolle: 'Hauptmieter',
  beruf: 'Elektroniker',
  farbe: '#ff8466',
};
const lea = { name: 'Lea Mustermann', rolle: 'Mitmieterin', farbe: '#b8e07c' };
const petra = { name: 'Petra Mustermann', rolle: 'Bürgin', farbe: '#c8abff', buerge: true };
const auskunft = (name: string, rolle: string, farbe: string) => ({
  name,
  rolle,
  farbe,
  bloecke: [
    {
      id: 'person' as const,
      titel: 'Zur Person',
      zeilen: [{ id: 'kontakt', etikett: 'Kontakt', art: 'text' as const, wert: '0151 23456789' }],
    },
  ],
  ortDatum: 'Hamburg, 6. November 2026',
});

async function bloecke(): Promise<MappenBlock[]> {
  return [
    {
      person: max,
      teile: [
        {
          abschnitt: 'Selbstauskunft',
          quellen: [],
          auskunft: auskunft(max.name, max.rolle, max.farbe),
        },
        {
          abschnitt: 'Gehaltsnachweise',
          detail: 'Juli bis September',
          quellen: [
            { daten: await quelle(['G9']), kopf: 'Gehaltsnachweis September 2026' },
            { daten: await quelle(['G8a', 'G8b']), kopf: 'Gehaltsnachweis August 2026' },
          ],
        },
        {
          abschnitt: 'Bonitätsnachweis',
          detail: 'vom 20. Oktober 2026',
          kopf: 'Bonitätsnachweis vom 20. Oktober 2026',
          quellen: [{ daten: await quelle(['B1', 'B2']), seiten: [1] }],
        },
      ],
    },
    {
      person: lea,
      teile: [
        {
          abschnitt: 'Mietzahlungen',
          quellen: [{ daten: await quelle(['Konto'], [841.89, 595.28]) }],
        },
        {
          abschnitt: 'Bescheinigung',
          quellen: [{ daten: await quelle(['A5'], [419.53, 595.28]) }],
        },
        { abschnitt: 'Letter', quellen: [{ daten: await quelle(['US'], [612, 792]) }] },
      ],
    },
    {
      person: petra,
      teile: [
        {
          abschnitt: 'Bürgschaftserklärung',
          quellen: [{ daten: await quelle(['Unterschrieben']) }],
        },
      ],
    },
  ];
}

async function auftrag(teil: Partial<BewerbungAuftrag> = {}): Promise<BewerbungAuftrag> {
  return {
    titel: 'Bewerbung Hauptstraße 12 – Max und Lea Mustermann',
    autor: 'Max Mustermann',
    fussName: 'Max und Lea Mustermann',
    kurz: 'Hauptstraße 12',
    adresse: ['Hauptstraße 12, 3. OG links', '22767 Hamburg'],
    satz: 'Wir sind ein ruhiges Paar mit einem Kind.',
    mitziehende: [{ text: 'Ein Kind', anzahl: 1 }],
    kontakt: ['Max Mustermann', '0151 23456789'],
    bloecke: await bloecke(),
    deckblatt: true,
    inhaltsverzeichnis: true,
    fusszeile: true,
    schriften: pdfSchriften(),
    datum: new Date(2026, 10, 6),
    ...teil,
  };
}

/** Lesezeichen als Baum aus Titeln und Seitennummern. */
function lesezeichen(pdf: PDFDocument) {
  const seiten = pdf.getPages().map((p) => p.ref);
  const lesen = (d: PDFDict | undefined): unknown[] => {
    const liste: unknown[] = [];
    let punkt = d;
    while (punkt) {
      const dest = punkt.lookup(PDFName.of('Dest'), PDFArray);
      const titel = punkt.lookup(PDFName.of('Title'), PDFHexString).decodeText();
      const seite = seiten.indexOf(dest.get(0) as PDFRef) + 1;
      const kind = punkt.lookupMaybe(PDFName.of('First'), PDFDict);
      liste.push(kind ? [titel, seite, lesen(kind)] : [titel, seite]);
      punkt = punkt.lookupMaybe(PDFName.of('Next'), PDFDict);
    }
    return liste;
  };
  const wurzel = pdf.catalog.lookup(PDFName.of('Outlines'), PDFDict);
  return lesen(wurzel.lookupMaybe(PDFName.of('First'), PDFDict));
}

describe('PDF-Mappe nach design/mappe-pdf.md', () => {
  it('P1, P5: Reihenfolge, Seitenzahl, Serie als eine Zeile mit Seitenbereich', async () => {
    const e = await bewerbungBauen(await auftrag());
    expect(e.seiten).toBe(1 + 1 + 3 + 1 + 3 + 1);
    expect(e.inhalt).toEqual([
      {
        person: 'Max Mustermann',
        seite: 2,
        teile: [
          { abschnitt: 'Selbstauskunft', seite: 2, bis: 2 },
          { abschnitt: 'Gehaltsnachweise', seite: 3, bis: 5 },
          { abschnitt: 'Bonitätsnachweis', seite: 6, bis: 6 },
        ],
      },
      {
        person: 'Lea Mustermann',
        seite: 7,
        teile: [
          { abschnitt: 'Mietzahlungen', seite: 7, bis: 7 },
          { abschnitt: 'Bescheinigung', seite: 8, bis: 8 },
          { abschnitt: 'Letter', seite: 9, bis: 9 },
        ],
      },
      {
        person: 'Petra Mustermann',
        seite: 10,
        teile: [{ abschnitt: 'Bürgschaftserklärung', seite: 10, bis: 10 }],
      },
    ]);
    const [deckblatt] = await textJeSeite(e.bytes);
    // Das geschützte Leerzeichen zwischen Postleitzahl und Ort darf kein Ersatzzeichen werden.
    expect(e.ersetzt).toEqual([]);
    for (const t of [
      'Bewerbung um die Wohnung',
      'Hauptstraße 12',
      '3. OG links · 22767 Hamburg',
      'Wir sind ein ruhiges Paar',
      'Wer einzieht',
      'Was beiliegt',
      'Max Mustermann',
      'Hauptmieter, Elektroniker',
      'Gehaltsnachweise, Juli bis September',
      '3–5',
      'Bonitätsnachweis, vom 20. Oktober 2026',
      'Ein Kind',
      'ohne Mietvertrag',
      'Bürgschaft',
      'Kontakt',
      'Seite 1 von 10',
    ])
      expect(deckblatt).toContain(t);
    // Es gibt keine eigene Inhaltsseite mehr: Seite 2 ist schon die Selbstauskunft.
    expect((await textJeSeite(e.bytes))[1]).toContain('Selbstauskunft');
  });

  it('P2, P14: Jede Seite A4 hochkant, auch Querformat (Rückmeldung vom 4.11.: beim Druck)', async () => {
    const pdf = await PDFDocument.load((await bewerbungBauen(await auftrag())).bytes);
    const groessen = pdf
      .getPages()
      .map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())]);
    for (const g of groessen) expect(g).toEqual([595, 842]);
  });

  it('P3, P4: Jede Seite nennt Person, Unterlage und „Seite x von y“', async () => {
    const texte = await textJeSeite((await bewerbungBauen(await auftrag())).bytes);
    const erwartet: [number, string, string][] = [
      [2, 'Max Mustermann', 'Selbstauskunft'],
      [3, 'Max Mustermann', 'Gehaltsnachweis September 2026'],
      [4, 'Max Mustermann', 'Gehaltsnachweis August 2026 · Seite 1 von 2'],
      [5, 'Max Mustermann', 'Gehaltsnachweis August 2026 · Seite 2 von 2'],
      [6, 'Max Mustermann', 'Bonitätsnachweis vom 20. Oktober 2026'],
      [7, 'Lea Mustermann', 'Mietzahlungen'],
      [10, 'Petra Mustermann', 'Bürgschaftserklärung'],
    ];
    for (const [nummer, name, kopf] of erwartet) {
      const t = texte[nummer - 1]!;
      expect(t).toContain(name);
      expect(t).toContain(kopf);
      expect(t).toContain(`Seite ${nummer} von 10`);
      expect(t).toContain('Bewerbung Hauptstraße 12 · Max und Lea Mustermann');
    }
    expect(texte[1]).toContain('· Hauptmieter');
    // Bürgen: „Bürgschaft“ statt der Rolle.
    expect(texte[9]).toContain('· Bürgschaft');
    expect(texte[5]).toContain('B2');
    expect(texte[5]).not.toContain('B1');
  });

  it('P6, P7: Fremde Seiten im Inhaltsbereich, nie vergrößert, hochkant mindestens 80 %', async () => {
    const e = await bewerbungBauen(await auftrag());
    const pdf = await PDFDocument.load(e.bytes);
    expect(e.fremde).toHaveLength(8);
    for (const { seite, skala, box } of e.fremde) {
      const p = pdf.getPage(seite - 1);
      expect(box.x0).toBeGreaterThanOrEqual(12 * MM - 0.5);
      expect(box.x1).toBeLessThanOrEqual(p.getWidth() - 12 * MM + 0.5);
      expect(box.y0).toBeGreaterThanOrEqual(16 * MM - 0.5);
      expect(box.y1).toBeLessThanOrEqual(p.getHeight() - 19 * MM + 0.5);
      expect(skala).toBeLessThanOrEqual(1);
      // Querformat passt nur kleiner auf A4 hochkant: etwa 62 %, zum Lesen lässt es sich vergrößern.
      expect(skala).toBeGreaterThanOrEqual(box.x1 - box.x0 > box.y1 - box.y0 ? 0.6 : 0.8);
    }
    // A5 bleibt in Originalgröße, oben mittig.
    const a5 = e.fremde.find((f) => f.seite === 8)!;
    expect(a5.skala).toBe(1);
    expect(a5.box.y1).toBeCloseTo(841.89 - 19 * MM, 1);
    expect((a5.box.x0 + a5.box.x1) / 2).toBeCloseTo(595.28 / 2, 1);
  });

  it('P8: Lesezeichen Person → Unterlage → Monat, Bürgen unter „Bürgschaft“', async () => {
    const pdf = await PDFDocument.load((await bewerbungBauen(await auftrag())).bytes);
    expect(pdf.catalog.lookup(PDFName.of('PageMode'))).toBe(PDFName.of('UseOutlines'));
    expect(lesezeichen(pdf)).toEqual([
      ['Deckblatt', 1],
      [
        'Max Mustermann (Hauptmieter)',
        2,
        [
          ['Selbstauskunft', 2],
          [
            'Gehaltsnachweise, Juli bis September',
            3,
            [
              ['Gehaltsnachweis September 2026', 3],
              ['Gehaltsnachweis August 2026', 4],
            ],
          ],
          ['Bonitätsnachweis, vom 20. Oktober 2026', 6],
        ],
      ],
      [
        'Lea Mustermann (Mitmieterin)',
        7,
        [
          ['Mietzahlungen', 7],
          ['Bescheinigung', 8],
          ['Letter', 9],
        ],
      ],
      ['Bürgschaft', 10, [['Petra Mustermann (Bürgin)', 10, [['Bürgschaftserklärung', 10]]]]],
    ]);
  });

  it('P9: Links auf dem Deckblatt zeigen auf das Seitenobjekt der Unterlage', async () => {
    const pdf = await PDFDocument.load((await bewerbungBauen(await auftrag())).bytes);
    const refs = pdf.getPages().map((p) => p.ref);
    const annots = pdf.getPage(0).node.Annots()!;
    const ziele = annots.asArray().map((a) => {
      const d = pdf.context.lookup(a, PDFDict);
      expect(d.lookup(PDFName.of('Subtype'))).toBe(PDFName.of('Link'));
      const dest = d.lookup(PDFName.of('Dest'), PDFArray);
      expect(dest.get(0)).toBeInstanceOf(PDFRef);
      return refs.indexOf(dest.get(0) as PDFRef) + 1;
    });
    expect(ziele).toEqual([2, 3, 6, 7, 8, 9, 10]);
  });

  it('P10: Schrift einmal je Datei, Titel, Autor und Sprache; kein Producer der Quellen', async () => {
    const zwei = await auftrag();
    const b = zwei.bloecke[1]!;
    b.teile.unshift({
      abschnitt: 'Selbstauskunft',
      quellen: [],
      auskunft: auskunft(lea.name, lea.rolle, lea.farbe),
    });
    const e = await bewerbungBauen(zwei);
    const pdf = await PDFDocument.load(e.bytes, { updateMetadata: false });
    expect(pdf.getTitle()).toBe('Bewerbung Hauptstraße 12 – Max und Lea Mustermann');
    expect(pdf.getAuthor()).toBe('Max Mustermann');
    expect(pdf.getProducer()).toBeUndefined();
    expect(pdf.getCreator()).toBeUndefined();
    expect(pdf.catalog.lookup(PDFName.of('Lang'))?.toString()).toContain('de-DE');
    expect(new TextDecoder('latin1').decode(e.bytes)).not.toContain('Lohnportal');
    const schriften = pdf.context
      .enumerateIndirectObjects()
      .filter(([, o]) => o instanceof PDFDict && o.has(PDFName.of('FontFile2')));
    expect(schriften).toHaveLength(3);
  });

  it('P11: Passt nicht alles auf das Deckblatt, stimmen die Seitenzahlen trotzdem', async () => {
    const person = (n: number) => ({ ...max, name: `Person Nummer ${n}` });
    const viele: MappenBlock[] = [];
    for (let n = 1; n <= 9; n++)
      viele.push({
        person: person(n),
        teile: await Promise.all(
          ['A', 'B', 'C', 'D', 'E', 'F'].map(async (t) => ({
            abschnitt: `Unterlage ${t}`,
            quellen: [{ daten: await quelle(['S']) }],
          })),
        ),
      });
    const e = await bewerbungBauen(await auftrag({ bloecke: viele }));
    expect(e.seiten).toBeGreaterThan(9 * 6 + 1);
    const vorne = e.seiten - 9 * 6;
    expect(e.inhalt[0]!.teile[0]!.seite).toBe(vorne + 1);
    const texte = await textJeSeite(e.bytes);
    expect(texte.slice(0, vorne).join(' ')).toContain('Person Nummer 9');
    expect(texte[vorne]).toContain('Person Nummer 1');
  });

  it('P12: Zeichen wie ś bleiben; was Archivo nicht hat, wird nie zum Kästchen', async () => {
    const name = 'Bartholomäus Wiśniewski-Kowalczyk';
    const e = await bewerbungBauen(
      await auftrag({
        bloecke: [
          {
            person: { ...lea, name },
            teile: [{ abschnitt: 'Unterlage', quellen: [{ daten: await quelle(['S']) }] }],
          },
          {
            person: { ...max, name: '王小明 Müller' },
            teile: [{ abschnitt: 'Unterlage', quellen: [{ daten: await quelle(['S']) }] }],
          },
        ],
      }),
    );
    const texte = await textJeSeite(e.bytes);
    expect(texte[1]).toContain(name);
    // Namen kommen so gar nicht hierher (K8); bei Freitext wird es gemeldet, nie still ersetzt.
    expect(texte[2]).toContain('??? Müller');
    expect(e.ersetzt).toContain('王小明 Müller');
  });

  it('P12: Polnisch, Tschechisch und Vietnamesisch bleiben genau, nichts wird gemeldet', async () => {
    const namen = ['Piotr Wiśniewski', 'Jiří Dvořák', 'Nguyễn Thị Ánh'];
    const e = await bewerbungBauen(
      await auftrag({
        bloecke: await Promise.all(
          namen.map(async (name) => ({
            person: { ...lea, name },
            teile: [{ abschnitt: 'Unterlage', quellen: [{ daten: await quelle(['S']) }] }],
          })),
        ),
      }),
    );
    const texte = await textJeSeite(e.bytes);
    namen.forEach((name, i) => expect(texte[i + 1]).toContain(name));
    expect(e.ersetzt).toEqual([]);
  });

  it('Freitext in der Selbstauskunft wird nie zum Kästchen und gemeldet', async () => {
    const e = await bewerbungBauen(
      await auftrag({
        bloecke: [
          {
            person: max,
            teile: [
              {
                abschnitt: 'Selbstauskunft',
                quellen: [],
                auskunft: {
                  ...auskunft(max.name, max.rolle, max.farbe),
                  bloecke: [
                    {
                      id: 'person' as const,
                      titel: 'Zur Person',
                      zeilen: [
                        {
                          id: 'arbeitgeber',
                          etikett: 'Arbeitgeber',
                          art: 'text' as const,
                          wert: 'ООО Ромашка',
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    );
    expect(e.ersetzt).toEqual(['ООО Ромашка']);
  });

  it('P18: Die Fußzeile nennt jeden Nachnamen ganz und bricht vor der Seitenzahl um', async () => {
    const lang =
      'Müller-Lüdenscheidt-Hohenzollern, Wiśniewski-Kowalczyk-Brzęczyszczykiewicz, von und zu Guttenberg-Sachsen-Coburg und Becker';
    const e = await bewerbungBauen(await auftrag({ fussName: lang }));
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const dok = await pdfjs.getDocument({ data: e.bytes.slice(), useSystemFonts: false }).promise;
    const { items } = await (await dok.getPage(2)).getTextContent();
    const fuss = (items as { str: string; transform: number[]; width: number }[]).filter(
      (i) => i.str && i.transform[5]! < 13 * MM,
    );
    const links = fuss.filter((i) => !i.str.startsWith('Seite '));
    const seite = fuss.find((i) => i.str.startsWith('Seite '))!;
    expect(links.map((i) => i.str).join(' ')).toContain(lang);
    expect(links.length).toBeGreaterThan(1);
    for (const zeile of links) {
      expect(zeile.transform[0]! + zeile.width).toBeLessThan(seite.transform[4]!);
      expect(zeile.transform[3]).toBeCloseTo(6.5, 1);
    }
  });

  describe('Deckblatt: Fortsetzung, Kompakt, Schriften (mappe-feinschliff.md)', () => {
    async function lang() {
      const q = await quelle(['S']);
      return ['Max', 'Lea', 'Tom', 'Anna', 'Ben'].map((vorname) => ({
        person: { ...lea, name: `${vorname} Mustermann` },
        teile: Array.from({ length: 6 }, (_, i) => ({
          abschnitt: `Unterlage ${i + 1}`,
          quellen: [{ daten: q }],
        })),
      }));
    }

    it('P28: „Weiter auf Seite 2“ steht genau dann da, wenn das Deckblatt zwei Seiten hat', async () => {
      const zwei = await bewerbungBauen(await auftrag({ bloecke: await lang() }));
      expect(zwei.deckSeiten).toBe(2);
      expect((await textJeSeite(zwei.bytes))[0]).toContain('Weiter auf Seite 2');
      const eine = await bewerbungBauen(await auftrag());
      expect(eine.deckSeiten).toBe(1);
      expect((await textJeSeite(eine.bytes)).join(' ')).not.toContain('Weiter auf Seite');
    });

    it('Kompakt bringt das Deckblatt auf eine Seite, nie unter 0,85; aus bleibt es bei zwei', async () => {
      const bloecke = await lang();
      const aus = await bewerbungBauen(await auftrag({ bloecke }));
      expect(aus.kompaktHilft).toBe(true);
      expect(aus.deckMassstab).toBe(1);
      const an = await bewerbungBauen(
        await auftrag({ bloecke, aussehen: { art: 'personen', kompakt: true } }),
      );
      expect(an.deckSeiten).toBe(1);
      expect(an.deckMassstab).toBeLessThan(1);
      expect(an.deckMassstab).toBeGreaterThanOrEqual(0.85);
      expect((await textJeSeite(an.bytes))[0]).not.toContain('Weiter auf Seite');
    });

    it('Kurze Mappe: Kompakt ändert nichts', async () => {
      const an = await bewerbungBauen(
        await auftrag({ aussehen: { art: 'personen', kompakt: true } }),
      );
      expect(an.kompaktHilft).toBe(false);
      expect(an.deckMassstab).toBeGreaterThanOrEqual(1);
    });

    it.each([
      ['Source Serif', 'SourceSerif4'],
      ['Plex Sans', 'IBMPlexSans'],
    ])('%s: eingebettet, lesbar, auch ś und ł (P12)', async (_, datei) => {
      const ordner = join(import.meta.dirname, 'fonts');
      const schriften = {
        regular: readFileSync(join(ordner, `${datei}-Regular.ttf`)),
        bold: readFileSync(join(ordner, `${datei}-Bold.ttf`)),
        titel: readFileSync(join(ordner, `${datei}-Bold.ttf`)),
      };
      const e = await bewerbungBauen(
        await auftrag({
          schriften,
          bloecke: [{ person: { ...lea, name: 'Wiśniewski Michał' }, teile: [] }],
        }),
      );
      const [deck] = await textJeSeite(e.bytes);
      expect(deck).toContain('Wiśniewski Michał');
      expect(e.ersetzt).toEqual([]);
    });
  });

  it('MP8: Langer Inhalt läuft mit Überschrift weiter, der Kontakt bleibt auf Seite 1', async () => {
    const q = await quelle(['S']);
    const bloeckeLang = ['Max', 'Lea', 'Tom', 'Anna', 'Ben'].map((vorname) => ({
      person: { ...lea, name: `${vorname} Mustermann` },
      teile: Array.from({ length: 6 }, (_, i) => ({
        abschnitt: `Unterlage ${i + 1}`,
        quellen: [{ daten: q }],
      })),
    }));
    const e = await bewerbungBauen(await auftrag({ bloecke: bloeckeLang }));
    const texte = await textJeSeite(e.bytes);
    expect(texte[0]).toContain('Wer einzieht');
    expect(texte[0]).not.toContain('(Fortsetzung)');
    expect(texte[0]).toContain('Kontakt');
    expect(texte[1]).toContain('Was beiliegt (Fortsetzung)');
    expect(texte[1]).not.toContain('Kontakt');
    // Die Seitenzahlen im Inhalt zählen die zweite Deckblattseite mit.
    expect(e.inhalt[0]!.seite).toBe(3);
    expect(e.seiten).toBe(32);
    const pdf = await PDFDocument.load(e.bytes);
    expect(pdf.getPage(0).node.Annots()?.size() ?? 0).toBeGreaterThan(0);
    expect(pdf.getPage(1).node.Annots()?.size() ?? 0).toBeGreaterThan(0);
  });

  describe('Portal-PDFs: verschlüsselt, aber ohne Passwort zu öffnen', () => {
    // Mit pypdf erzeugt: leeres Benutzerpasswort, gesetztes Besitzerpasswort, wie bei Lohnportalen.
    for (const art of ['rc4-40', 'rc4-128', 'aes-128', 'aes-256'])
      it(`${art}: Der Inhalt steht in der Mappe, nichts wird gemeldet`, async () => {
        const daten = new Uint8Array(readFileSync(`tests/fixtures/portal-${art}.pdf`));
        const e = await bewerbungBauen(
          await auftrag({
            deckblatt: false,
            bloecke: [{ person: max, teile: [{ abschnitt: 'Gehalt', quellen: [{ daten }] }] }],
          }),
        );
        expect(e.unlesbar).toEqual([]);
        expect((await textJeSeite(e.bytes))[0]).toContain(`Lohnzettel ${art}`);
        expect((await PDFDocument.load(e.bytes)).isEncrypted).toBe(false);
      });

    async function geschuetzt(mitFeld = false) {
      const q = await PDFDocument.create();
      const f = await q.embedFont(StandardFonts.Helvetica);
      const seite = q.addPage([595, 842]);
      seite.drawText('Lohnzettel Oktober', { x: 50, y: 700, size: 18, font: f });
      if (mitFeld) {
        const feld = q.getForm().createTextField('name');
        feld.setText('Ausgefuellt');
        feld.addToPage(seite, { x: 50, y: 600, width: 200, height: 20 });
      }
      q.encrypt({
        userPassword: '',
        ownerPassword: 'besitzer',
        permissions: { modifying: false, copying: false },
      });
      return q.save();
    }

    it('Auch mit ausgefülltem Formular', async () => {
      const e = await bewerbungBauen(
        await auftrag({
          deckblatt: false,
          bloecke: [
            {
              person: max,
              teile: [{ abschnitt: 'Formular', quellen: [{ daten: await geschuetzt(true) }] }],
            },
          ],
        }),
      );
      expect(e.unlesbar).toEqual([]);
      const text = (await textJeSeite(e.bytes))[0];
      expect(text).toContain('Lohnzettel Oktober');
      expect(text).toContain('Ausgefuellt');
    });
  });

  it('Eine leere Seite im Scan wird übernommen, der Text der anderen bleibt Text', async () => {
    const q = await PDFDocument.create();
    const f = await q.embedFont(StandardFonts.Helvetica);
    q.addPage([595, 842]).drawText('Vorderseite', { x: 50, y: 700, size: 18, font: f });
    q.addPage([595, 842]);
    const e = await bewerbungBauen(
      await auftrag({
        deckblatt: false,
        bloecke: [
          {
            person: max,
            teile: [{ abschnitt: 'Scan', quellen: [{ daten: await q.save() }] }],
          },
        ],
      }),
    );
    expect(e.seiten).toBe(2);
    expect(e.unlesbar).toEqual([]);
    expect((await textJeSeite(e.bytes))[0]).toContain('Vorderseite');
  });

  describe('Eine kaputte Datei verhindert nicht die ganze Mappe', () => {
    const kaputt = new TextEncoder().encode('%PDF-1.7 das ist keine PDF');

    it('Sie wird gemeldet, alle anderen Unterlagen kommen, Seitenzahlen stimmen', async () => {
      const e = await bewerbungBauen(
        await auftrag({
          bloecke: [
            {
              person: max,
              teile: [
                { abschnitt: 'Kaputt', quellen: [{ daten: kaputt }] },
                { abschnitt: 'Heil', quellen: [{ daten: await quelle(['Heil']) }] },
              ],
            },
          ],
        }),
      );
      expect(e.unlesbar.map((u) => u.name)).toEqual(['Kaputt, Max Mustermann']);
      const texte = await textJeSeite(e.bytes);
      expect(e.seiten).toBe(2);
      expect(texte[1]).toContain('Heil');
      expect(texte[0]).not.toContain('Kaputt');
    });

    it('Der Ausweg als Bilder springt ein und wird dann nicht gemeldet', async () => {
      const ersatz = await quelle(['Als Bild']);
      const e = await bewerbungBauen(
        await auftrag({
          deckblatt: false,
          alsBilder: async () => ersatz,
          bloecke: [
            { person: max, teile: [{ abschnitt: 'Kaputt', quellen: [{ daten: kaputt }] }] },
          ],
        }),
      );
      expect(e.unlesbar).toEqual([]);
      expect((await textJeSeite(e.bytes))[0]).toContain('Als Bild');
    });

    it('Scheitert auch der Ausweg, bleibt es bei der Meldung', async () => {
      const e = await bewerbungBauen(
        await auftrag({
          deckblatt: false,
          alsBilder: async () => kaputt,
          bloecke: [
            { person: max, teile: [{ abschnitt: 'Kaputt', quellen: [{ daten: kaputt }] }] },
          ],
        }),
      );
      expect(e.unlesbar.map((u) => u.name)).toEqual(['Kaputt, Max Mustermann']);
    });
  });

  it('Auch eine Person mit sehr vielen Unterlagen bleibt lesbar und im Bild', async () => {
    const q = await quelle(['S']);
    const e = await bewerbungBauen(
      await auftrag({
        bloecke: [
          {
            person: max,
            teile: Array.from({ length: 60 }, (_, i) => ({
              abschnitt: `Unterlage ${i + 1}`,
              quellen: [{ daten: q }],
            })),
          },
        ],
      }),
    );
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const dok = await pdfjs.getDocument({ data: e.bytes.slice(), useSystemFonts: false }).promise;
    const vorne = e.inhalt[0]!.seite - 1;
    expect(vorne).toBeGreaterThan(1);
    const gefunden: string[] = [];
    for (let n = 1; n <= vorne; n++) {
      const { items } = await (await dok.getPage(n)).getTextContent();
      for (const i of items as { str: string; transform: number[] }[]) {
        if (/^Unterlage \d+/.test(i.str)) {
          gefunden.push(i.str);
          // Über der Fußzeile: Nichts läuft in die Linie bei 13 mm.
          expect(i.transform[5]).toBeGreaterThan(13 * MM);
        }
      }
    }
    expect(gefunden).toHaveLength(60);
  });

  it('Lange Namen in der Kopfzeile werden nie gekürzt', async () => {
    const name = 'Maximilian-Alexander Bartholomäus Müller-Lüdenscheidt-von-Hohenstein';
    const e = await bewerbungBauen(
      await auftrag({
        bloecke: [
          {
            person: { ...max, name, rolle: 'Hauptmietpartei' },
            teile: [
              {
                abschnitt: 'Bonitätsnachweis',
                kopf: 'Bonitätsnachweis vom 20. Oktober 2026',
                quellen: [{ daten: await quelle(['S']) }],
              },
            ],
          },
        ],
      }),
    );
    const t = (await textJeSeite(e.bytes))[1]!;
    expect(t).toContain(name);
    expect(t).toContain('Bonitätsnachweis vom 20. Oktober 2026');
    expect(t).not.toContain('…');
  });

  it('P14: Eine Seite, die nur über /Rotate aufrecht steht, bleibt aufrecht', async () => {
    const q = await PDFDocument.create();
    const f = await q.embedFont(StandardFonts.Helvetica);
    // Im Querformat gespeichert, mit 90° gedreht liest man sie hochkant.
    const seite = q.addPage([841.89, 595.28]);
    seite.setRotation(degrees(90));
    seite.drawText('Aufrecht', { x: 100, y: 100, size: 14, font: f, rotate: degrees(90) });
    const e = await bewerbungBauen(
      await auftrag({
        deckblatt: false,
        bloecke: [
          { person: max, teile: [{ abschnitt: 'Scan', quellen: [{ daten: await q.save() }] }] },
        ],
      }),
    );
    const pdf = await PDFDocument.load(e.bytes);
    expect(pdf.getPage(0).getHeight()).toBeGreaterThan(pdf.getPage(0).getWidth());
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const dok = await pdfjs.getDocument({ data: e.bytes.slice(), useSystemFonts: false }).promise;
    const { items } = await (await dok.getPage(1)).getTextContent();
    const wort = items.find((i) => 'str' in i && i.str === 'Aufrecht') as { transform: number[] };
    expect(Math.abs(wort.transform[1]!)).toBeLessThan(0.01);
    expect(wort.transform[0]).toBeGreaterThan(0);
  });

  it('P15, P16: Ausgefüllte Felder stehen im Bild, fremde Anmerkungen gehen nicht mit', async () => {
    const q = await PDFDocument.create();
    const seite = q.addPage([595.28, 841.89]);
    const feld = q.getForm().createTextField('name');
    feld.setText('Ausgefuellt von Max');
    feld.addToPage(seite, { x: 100, y: 500, width: 300, height: 30 });
    const e = await bewerbungBauen(
      await auftrag({
        deckblatt: false,
        bloecke: [
          { person: max, teile: [{ abschnitt: 'Formular', quellen: [{ daten: await q.save() }] }] },
        ],
      }),
    );
    expect((await textJeSeite(e.bytes))[0]).toContain('Ausgefuellt von Max');
    const pdf = await PDFDocument.load(e.bytes);
    expect(pdf.getPage(0).node.Annots()?.size() ?? 0).toBe(0);
    expect(pdf.getForm().getFields()).toHaveLength(0);
  });

  it('MP5: Kopf- und Fußzeile aus: kein Band, keine Fußzeile, 12 mm Rand', async () => {
    const e = await bewerbungBauen(await auftrag({ fusszeile: false }));
    const texte = await textJeSeite(e.bytes);
    expect(texte[2]).not.toContain('Gehaltsnachweis September');
    expect(texte[2]).not.toContain('Seite 3 von');
    const pdf = await PDFDocument.load(e.bytes);
    for (const { seite, box } of e.fremde) {
      const p = pdf.getPage(seite - 1);
      expect(box.y1).toBeLessThanOrEqual(p.getHeight() - 12 * MM + 0.5);
      expect(box.y1).toBeGreaterThan(p.getHeight() - 13 * MM);
    }
  });

  describe('Deckblatt mit Seitenleiste (P21 bis P23)', () => {
    it('P21: Kontakt steht vollständig auf Seite 1, jeder Teil als Text', async () => {
      const mail = 'm.mueller-luedenscheidt-sehr-lang@beispiel-hausverwaltung.example.com';
      const e = await bewerbungBauen(
        await auftrag({
          kontakt: ['Maximilian-Alexander Müller-Lüdenscheidt', '0151 98765432', mail],
        }),
      );
      const [deck] = await textJeSeite(e.bytes);
      const ohneLuecken = deck!.replace(/\s+/g, '');
      expect(ohneLuecken).toContain('015198765432');
      expect(ohneLuecken).toContain(mail);
      expect(ohneLuecken).toContain('Müller-Lüdenscheidt');
    });

    it('P22: der Hinweis steht da, wenn er an ist, Text und Ziel des Links sind dieselbe Adresse, und er fehlt ganz, wenn er aus ist', async () => {
      const mit = await bewerbungBauen(await auftrag({ hinweis: true }));
      const [deckMit] = await textJeSeite(mit.bytes);
      expect(deckMit).toContain(`Erstellt mit ${APP_NAME}`);
      expect(deckMit).toContain(`Lesehilfe: ${VERMIETER_DOMAIN}`);
      const pdf = await PDFDocument.load(mit.bytes);
      const annots = pdf.getPage(0).node.Annots()!;
      const adressen = Array.from({ length: annots.size() }, (_, i) =>
        annots.lookup(i, PDFDict).lookupMaybe(PDFName.of('A'), PDFDict),
      ).filter(Boolean);
      expect(adressen).toHaveLength(1);
      expect(adressen[0]!.get(PDFName.of('URI'))?.toString()).toContain(VERMIETER_ADRESSE);

      const ohne = await bewerbungBauen(await auftrag({ hinweis: false }));
      const [deckOhne] = await textJeSeite(ohne.bytes);
      expect(deckOhne).not.toContain('Erstellt mit');
      expect(deckOhne).not.toContain(VERMIETER_DOMAIN);
    });

    describe('Fläche hinter „Wer einzieht“ (AM5c)', () => {
      const block = (farbe: string, rolleId: Rolle) => ({ person: { farbe, rolleId } });

      it('folgt ohne eigene Wahl der Art, die eigene Wahl geht vor', () => {
        expect(flaecheVon({ art: 'personen' })).toBe('personen');
        expect(flaecheVon({ art: 'einefarbe' })).toBe('akzent');
        expect(flaecheVon({ art: 'schlicht' })).toBe('grau');
        expect(flaecheVon({ art: 'schlicht', flaeche: 'personen' })).toBe('personen');
      });

      it('Personenfarbe ist die der Hauptperson, gibt es keine, die der ersten', () => {
        const aussehen = { art: 'personen' } as const;
        const koralle = flaechenTon('personen', undefined, '#ff8466');
        const gruen = flaechenTon('personen', undefined, '#b8e07c');
        expect(koralle).not.toBe(gruen);
        expect(
          leistenTon(aussehen, [block('#ff8466', 'mitmieter'), block('#b8e07c', 'hauptmieter')]),
        ).toBe(gruen);
        expect(
          leistenTon(aussehen, [block('#ff8466', 'mitmieter'), block('#b8e07c', 'mitmieter')]),
        ).toBe(koralle);
      });

      it('Akzentfarbe, Hellgrau und Keine', () => {
        expect(leistenTon({ art: 'einefarbe', akzent: 'bordeaux' }, [])).toBe('#f2eaeb');
        expect(leistenTon({ art: 'personen', flaeche: 'akzent' }, [])).toBe('#eaefed');
        expect(leistenTon({ art: 'personen', flaeche: 'grau' }, [])).toBe('#f1f2f6');
        expect(leistenTon({ art: 'personen', flaeche: 'keine' }, [])).toBeNull();
      });

      it.each(['personen', 'akzent', 'grau', 'keine'] satisfies MappenFlaeche[])(
        '%s: Das Deckblatt bleibt, wie es ist (P11)',
        async (flaeche) => {
          const standard = await bewerbungBauen(
            await auftrag({ hinweis: true, aussehen: { art: 'personen' } }),
          );
          const erg = await bewerbungBauen(
            await auftrag({ hinweis: true, aussehen: { art: 'personen', flaeche } }),
          );
          const [deck] = await textJeSeite(erg.bytes);
          expect(deck).toBe((await textJeSeite(standard.bytes))[0]);
          expect(erg.deckSeiten).toBe(standard.deckSeiten);
        },
      );
    });

    it('P23: Der Maßstab wächst bei kurzen Mappen bis 1,3 und bleibt bei langen bei 1', async () => {
      const q = await quelle(['S']);
      const kurz = await bewerbungBauen(
        await auftrag({
          bloecke: [
            { person: lea, teile: [{ abschnitt: 'Selbstauskunft', quellen: [{ daten: q }] }] },
          ],
          satz: '',
          kontakt: [],
          mitziehende: [],
        }),
      );
      expect(kurz.deckMassstab).toBe(1.3);
      const lang = await bewerbungBauen(
        await auftrag({
          bloecke: ['Max', 'Lea', 'Tom', 'Anna', 'Ben'].map((vorname) => ({
            person: { ...lea, name: `${vorname} Mustermann` },
            teile: Array.from({ length: 6 }, (_, i) => ({
              abschnitt: `Unterlage ${i + 1}`,
              quellen: [{ daten: q }],
            })),
          })),
        }),
      );
      expect(lang.deckMassstab).toBe(1);
    });

    const groessen = async (bytes: Uint8Array) => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const dok = await pdfjs.getDocument({ data: bytes.slice() }).promise;
      const inhalt = await (await dok.getPage(1)).getTextContent();
      return inhalt.items.flatMap((i) =>
        'str' in i && i.str.trim() ? [Math.hypot(i.transform[0], i.transform[1])] : [],
      );
    };
    const vieleImVertrag = async (anzahl: number) => {
      const q = await quelle(['S']);
      return auftrag({
        kontakt: ['Maximilian-Alexander Müller-Lüdenscheidt', '0151 98765432', 'max@example.com'],
        bloecke: [
          ...Array.from({ length: anzahl }, (_, n) => ({
            person: {
              ...lea,
              name: `Maximiliane-Alexandra Müller-Lüdenscheidt ${n + 1}`,
              beruf: 'Wirtschaftsinformatikerin im öffentlichen Dienst',
            },
            teile: [{ abschnitt: 'Selbstauskunft', quellen: [{ daten: q }] }],
          })),
          {
            person: petra,
            teile: [{ abschnitt: 'Bürgschaftserklärung', quellen: [{ daten: q }] }],
          },
        ],
      });
    };

    it('Volle Leiste: Stufen statt zu kleiner Schrift, nie unter 7 pt (P24)', async () => {
      const zuerst = await bewerbungBauen(await vieleImVertrag(3));
      const [deckZuerst] = await textJeSeite(zuerst.bytes);
      expect(deckZuerst).toContain('Wirtschaftsinformatikerin');
      expect(Math.min(...(await groessen(zuerst.bytes)))).toBeGreaterThanOrEqual(7);

      // Viele im Vertrag: erst kleiner, dann ohne Beruf. Rechts stehen die Namen weiter.
      const voll = await bewerbungBauen(await vieleImVertrag(14));
      expect(voll.deckMassstab).toBe(1);
      expect(Math.min(...(await groessen(voll.bytes)))).toBeGreaterThanOrEqual(7);
      const texteVoll = await textJeSeite(voll.bytes);
      const deckVoll = texteVoll[0];
      expect(deckVoll).not.toContain('Wirtschaftsinformatikerin');
      expect(deckVoll).toContain('Kontakt');
      // Fällt „Bürgschaft“ aus der Leiste, stehen die Bürgen rechts weiter unter dieser Überschrift.
      expect(texteVoll.slice(0, 2).join(' ')).toContain('Bürgschaft');
      expect(texteVoll.slice(0, 2).join(' ')).toContain('Petra Mustermann');
    });

    it('P25: Die Bitte steht unter der letzten Unterlage, auch unter „Bürgschaft“, und zählt beim Maßstab', async () => {
      const ohne = await bewerbungBauen(await auftrag());
      const bitte = 'Falls die Wohnung an jemand anderen geht, löschen Sie diese Unterlagen bitte.';
      const mit = await bewerbungBauen(await auftrag({ bitte }));
      const [deck] = await textJeSeite(mit.bytes);
      const glatt = deck!.replace(/\s+/g, ' ');
      expect(glatt).toContain(bitte);
      expect(glatt.indexOf(bitte)).toBeGreaterThan(glatt.indexOf('Bürgschaftserklärung'));
      expect(mit.deckMassstab!).toBeLessThanOrEqual(ohne.deckMassstab!);
      expect(mit.seiten).toBe(ohne.seiten);
    });

    it('P25: Geht „Was beiliegt“ weiter, steht die Bitte dort am Ende', async () => {
      const q = await quelle(['S']);
      const bitte = 'Falls die Wohnung an jemand anderen geht, löschen Sie diese Unterlagen bitte.';
      const e = await bewerbungBauen(
        await auftrag({
          bitte,
          bloecke: ['Max', 'Lea', 'Tom', 'Anna', 'Ben'].map((vorname) => ({
            person: { ...lea, name: `${vorname} Mustermann` },
            teile: Array.from({ length: 6 }, (_, i) => ({
              abschnitt: `Unterlage ${i + 1}`,
              quellen: [{ daten: q }],
            })),
          })),
        }),
      );
      const texte = await textJeSeite(e.bytes);
      expect(texte[0]!.replace(/\s+/g, ' ')).not.toContain(bitte);
      expect(texte[1]!.replace(/\s+/g, ' ')).toContain(bitte);
    });

    it('Kinder und weitere Personen sind eigene Einträge und zählen mit, Bürgen nicht', async () => {
      const ohneKinder = await bewerbungBauen(await auftrag({ mitziehende: [] }));
      const zahl = /(\d+) Personen?/.exec((await textJeSeite(ohneKinder.bytes))[0]!)![1];
      const e = await bewerbungBauen(
        await auftrag({
          mitziehende: [
            { text: 'Zwei Kinder', anzahl: 2 },
            { text: 'Eine weitere Person', anzahl: 1 },
          ],
        }),
      );
      const [deck] = await textJeSeite(e.bytes);
      expect(deck).toContain('Zwei Kinder');
      expect(deck).toContain('Eine weitere Person');
      expect(deck).toContain(`${Number(zahl) + 3} Personen`);
    });

    it('Ohne Adresse: nur „Bewerbung um eine Wohnung“; lange Straße wird kleiner, nie gekürzt', async () => {
      const ohne = await bewerbungBauen(await auftrag({ adresse: [] }));
      const [deckOhne] = await textJeSeite(ohne.bytes);
      expect(deckOhne).toContain('Bewerbung um eine Wohnung');
      expect(deckOhne).not.toContain('Bewerbung um die Wohnung');
      const strasse = 'Generalfeldmarschall-von-Hindenburg-Damm-Promenade 152';
      const lang = await bewerbungBauen(await auftrag({ adresse: [strasse, '22767 Hamburg'] }));
      const [deckLang] = await textJeSeite(lang.bytes);
      expect(deckLang!.replace(/\s+/g, ' ')).toContain(strasse);
    });
  });

  it('Ohne Deckblatt gibt es keinen Inhalt; ohne Inhalt heißt es nur „Wer einzieht“', async () => {
    const ohne = await bewerbungBauen(await auftrag({ deckblatt: false }));
    expect(ohne.seiten).toBe(9);
    expect((await textJeSeite(ohne.bytes))[0]).toContain('Selbstauskunft');
    const kurz = await bewerbungBauen(await auftrag({ inhaltsverzeichnis: false }));
    const [deckblatt] = await textJeSeite(kurz.bytes);
    expect(deckblatt).toContain('Wer einzieht');
    expect(deckblatt).not.toContain('Wer einzieht und was beiliegt');
    expect(deckblatt).not.toContain('Gehaltsnachweise');
    const pdf = await PDFDocument.load(kurz.bytes);
    expect(pdf.getPage(0).node.Annots()?.size() ?? 0).toBe(0);
  });

  it('Ohne Wohnung: „Bewerbung um eine Wohnung“ und der Name als Titel', async () => {
    const e = await bewerbungBauen(await auftrag({ adresse: [], kurz: undefined }));
    const texte = await textJeSeite(e.bytes);
    expect(texte[0]).toContain('Bewerbung um eine Wohnung');
    expect(texte[0]).toContain('Max und Lea Mustermann');
    expect(texte[2]).toContain('Bewerbung · Max und Lea Mustermann');
  });
});
