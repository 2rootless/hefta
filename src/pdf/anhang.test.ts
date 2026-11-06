import { PDFDocument } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import { BITTE_MAX, BITTE_VORSCHLAG } from '../domain/export';
import { pdfSchriften, textJeSeite, testJpeg } from '../test/hilfen';
import {
  ANHANG_NAME,
  anhangBauen,
  anhangBytes,
  anhangLesen,
  anhangTexte,
  type HeftaAnhang,
} from './anhang';
import { bewerbungBauen, type BewerbungAuftrag } from './bewerbung';

async function quelle(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bild = await doc.embedJpg(testJpeg(100, 140));
  doc.addPage([595, 842]).drawImage(bild, { x: 0, y: 0, width: 595, height: 842 });
  return doc.save();
}

async function auftrag(teil: Partial<BewerbungAuftrag> = {}): Promise<BewerbungAuftrag> {
  const q = await quelle();
  return {
    titel: 'Bewerbung Hauptstraße 12 – Max und Lea Mustermann',
    fussName: 'Max und Lea Mustermann',
    kurz: 'Hauptstraße 12',
    adresse: ['Hauptstraße 12, 3. OG links', '22767 Hamburg'],
    satz: 'Wir sind ein ruhiges Paar.',
    mitziehende: [{ text: 'Ein Kind', anzahl: 1 }],
    kontakt: ['Max Mustermann', '0151 23456789'],
    bloecke: [
      {
        person: {
          name: 'Max Mustermann',
          rolle: 'Hauptmieter',
          farbe: '#ff8466',
          rolleId: 'hauptmieter',
        },
        teile: [
          { abschnitt: 'Selbstauskunft', typ: 'selbstauskunft', quellen: [{ daten: q }] },
          {
            abschnitt: 'Gehaltsnachweise',
            detail: 'Juli bis September',
            typ: 'gehaltsnachweis',
            monate: ['2026-07', '2026-08', '2026-09'],
            quellen: [{ daten: q }, { daten: q }, { daten: q }],
          },
          {
            abschnitt: 'Bonitätsnachweis',
            detail: 'vom 20. Oktober 2026',
            typ: 'bonitaet',
            vom: '2026-10-20',
            pruefweg: 'pruefcode',
            quellen: [{ daten: q }],
          },
        ],
      },
      {
        person: {
          name: 'Petra Mustermann',
          rolle: 'Bürgin',
          farbe: '#c8abff',
          buerge: true,
          rolleId: 'buerge',
        },
        teile: [{ abschnitt: 'Bürgschaftserklärung', typ: 'buergschaft', quellen: [{ daten: q }] }],
      },
    ],
    deckblatt: true,
    inhaltsverzeichnis: true,
    fusszeile: true,
    hinweis: true,
    modus: 'marktueblich',
    bitte: BITTE_VORSCHLAG,
    schriften: pdfSchriften(),
    datum: new Date(2026, 10, 4),
    ...teil,
  };
}

async function anhangAus(bytes: Uint8Array): Promise<HeftaAnhang | null> {
  const pdf = await PDFDocument.load(bytes);
  const liste = pdf.getAttachments();
  const eintrag = liste.find((a) => a.name === ANHANG_NAME);
  return eintrag ? anhangLesen(eintrag.data) : null;
}

describe('Lesehilfe für Vermieter (hefta.json)', () => {
  it('Regel 1, P26: Zeichen, die die Schrift nicht kennt, sind in der Lesehilfe ersetzt wie auf dem Papier', async () => {
    const satz = 'Bitte löschen 张 Sie die Unterlagen.';
    const basis = await auftrag({ bitte: satz, mitziehende: [{ text: 'Ein 张 Kind', anzahl: 1 }] });
    const e = await bewerbungBauen(basis);
    const a = await anhangAus(e.bytes);
    expect(a!.loeschwunsch).toBe('Bitte löschen ? Sie die Unterlagen.');
    expect(a!.haushalt.mitziehende[0]!.text).toBe('Ein ? Kind');
    const seite = (await textJeSeite(e.bytes))[0]!.replace(/\s+/g, ' ');
    expect(seite).toContain(a!.loeschwunsch);
    expect(seite).not.toContain('张');
  });

  it('hängt in der Mappe und beschreibt, was drin ist, mit den Seiten aus dem echten Plan', async () => {
    const kennung = '3b7c2f1e-8d4a-4c6b-9e2f-1a5d7c9b0e42';
    const e = await bewerbungBauen(await auftrag({ kennung }));
    const a = await anhangAus(e.bytes);
    expect(a).not.toBeNull();
    // Fassung 2 (E6): Kennung der Bewerbung und die Adresse auch in Teilen.
    expect(a!.hefta).toBe(2);
    expect(a!.erstellt).toBe('2026-11-04');
    expect(a!.bewerbung.kennung).toBe(kennung);
    expect(a!.bewerbung.wohnung).toEqual({
      strasse: 'Hauptstraße 12',
      rest: '3. OG links · 22767 Hamburg',
      teile: {
        strasse: 'Hauptstraße',
        hausnummer: '12',
        lage: '3. OG links',
        plz: '22767',
        ort: 'Hamburg',
      },
    });
    expect(a!.haushalt.personen).toEqual([
      { name: 'Max Mustermann', rolle: 'hauptmieter', kontakt: true },
      { name: 'Petra Mustermann', rolle: 'buerge' },
    ]);
    expect(a!.haushalt.mitziehende).toEqual([{ text: 'Ein Kind', anzahl: 1 }]);
    expect(a!.unterlagen).toEqual([
      { person: 0, typ: 'selbstauskunft', seiten: [2, 2] },
      {
        person: 0,
        typ: 'gehaltsnachweis',
        seiten: [3, 5],
        monate: ['2026-07', '2026-08', '2026-09'],
      },
      { person: 0, typ: 'bonitaet', seiten: [6, 6], vom: '2026-10-20', pruefweg: 'pruefcode' },
      { person: 1, typ: 'buergschaft', seiten: [7, 7] },
    ]);
    expect(a!.modus).toBe('marktueblich');
    expect(a!.loeschwunsch).toBe(BITTE_VORSCHLAG);
    // Die Seitenzahlen stimmen mit dem Inhalt überein.
    expect(e.inhalt[0]!.teile.map((t) => [t.seite, t.bis])).toEqual([
      [2, 2],
      [3, 5],
      [6, 6],
    ]);
  });

  it('Regel 1: Jeder Text des Anhangs steht auch auf dem Deckblatt', async () => {
    const e = await bewerbungBauen(await auftrag());
    const a = (await anhangAus(e.bytes))!;
    const [deckblatt] = await textJeSeite(e.bytes);
    const glatt = deckblatt!.replace(/\s+/g, ' ');
    for (const text of anhangTexte(a)) expect(glatt).toContain(text);
    // Telefonnummer und Mail stehen nicht im Anhang, nur „kontakt: true“.
    expect(JSON.stringify(a)).not.toContain('0151');
  });

  it('P25, P26: Die Bitte steht zeichengleich auf dem Deckblatt und im Anhang, aus nirgends', async () => {
    const eigen =
      'Falls die Wohnung an jemand anderen geht, löschen Sie unsere Unterlagen bitte. Danke!';
    const an = await bewerbungBauen(await auftrag({ bitte: eigen }));
    const [deck] = await textJeSeite(an.bytes);
    expect(deck!.replace(/\s+/g, ' ')).toContain(eigen);
    expect((await anhangAus(an.bytes))!.loeschwunsch).toBe(eigen);

    const aus = await bewerbungBauen(await auftrag({ bitte: undefined }));
    const alles = (await textJeSeite(aus.bytes)).join(' ').replace(/\s+/g, ' ');
    expect(alles).not.toContain('löschen Sie');
    expect('loeschwunsch' in (await anhangAus(aus.bytes))!).toBe(false);
  });

  it('T9: Der Vorschlag siezt den Vermieter und passt in die Grenze', () => {
    expect(BITTE_VORSCHLAG).toMatch(/\bSie\b/);
    expect(BITTE_VORSCHLAG).not.toMatch(/\b(du|dein|lösch)\b/i);
    expect(BITTE_VORSCHLAG.length).toBeLessThanOrEqual(BITTE_MAX);
  });

  it('kein Anhang ohne Hinweis und ohne Deckblatt', async () => {
    const ohneHinweis = await bewerbungBauen(await auftrag({ hinweis: false }));
    expect(await anhangAus(ohneHinweis.bytes)).toBeNull();
    const ohneDeckblatt = await bewerbungBauen(await auftrag({ deckblatt: false }));
    expect(await anhangAus(ohneDeckblatt.bytes)).toBeNull();
  });

  it('Datensparsam nennt den Schritt; ohne Löschwunsch fehlt das Feld', async () => {
    const e = await bewerbungBauen(
      await auftrag({ modus: 'datensparsam', schritt: 'besichtigung', bitte: undefined }),
    );
    const a = (await anhangAus(e.bytes))!;
    expect(a.schritt).toBe('besichtigung');
    expect('loeschwunsch' in a).toBe(false);
  });

  it('liest neuere Fassungen und lehnt ab, was kein Anhang ist', () => {
    const a = anhangBauen({
      datum: new Date(2026, 10, 4),
      adresse: [],
      personen: [{ name: 'Max Mustermann' }],
      kontakt: false,
      mitziehende: [],
      unterlagen: [{ person: 0, typ: 'selbstauskunft', von: 2, bis: 2 }],
    });
    expect(a.bewerbung.wohnung).toBeNull();
    expect(a.haushalt.personen[0]!.rolle).toBe('hauptmieter');
    const neuer = anhangLesen(anhangBytes({ ...a, hefta: 7, zusatz: 'x' } as HeftaAnhang));
    expect(neuer?.hefta).toBe(7);
    expect(anhangLesen(new TextEncoder().encode('{"hefta":0}'))).toBeNull();
    expect(anhangLesen(new TextEncoder().encode('kein json'))).toBeNull();
    expect(anhangLesen(new TextEncoder().encode('{"foo":1}'))).toBeNull();
  });
});
