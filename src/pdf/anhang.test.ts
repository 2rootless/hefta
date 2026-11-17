import { PDFDocument } from '@cantoo/pdf-lib';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import katalog from '../../data/regelkatalog.de.json';
import schema from '../../pakete/hefta-json/schema.json';
import { passt, TYPEN } from '../../pakete/hefta-json/src/index';
import { BITTE_MAX, BITTE_VORSCHLAG } from '../domain/export';
import { pdfSchriften, textJeSeite, testJpeg } from '../test/hilfen';
import {
  ANHANG_NAME,
  anhangBauen,
  anhangBytes,
  anhangLesen,
  anhangTexte,
  zeitpunktAus,
  type HeftaAnhang,
} from './anhang';
import { bewerbungBauen, type BewerbungAuftrag, type MappenPerson } from './bewerbung';

// Lesehilfe hefta.json, Fassung 4 (PC98 bis PC100, E205 bis E207), am echten PDF: Jede Lesehilfe, die Hefta baut,
// besteht das Schema, passt zur eigenen Mappe (passt() aus dem Paket hefta-json) und hält Regel 1 ein.

const schemaPruefen = new Ajv({ allErrors: true }).compile(schema);
const DATUM = new Date(2026, 10, 4, 18, 30, 15);

async function quelle(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bild = await doc.embedJpg(testJpeg(100, 140));
  doc.addPage([595, 842]).drawImage(bild, { x: 0, y: 0, width: 595, height: 842 });
  return doc.save();
}

const MAX: MappenPerson = {
  name: 'Max Mustermann',
  vorname: 'Max',
  nachname: 'Mustermann',
  rolle: 'Hauptmieter',
  farbe: '#e9a970',
  rolleId: 'hauptmieter',
};
const PETRA: MappenPerson = {
  name: 'Petra Mustermann',
  vorname: 'Petra',
  nachname: 'Mustermann',
  rolle: 'Bürgin',
  farbe: '#c8abff',
  buerge: true,
  rolleId: 'buerge',
};

async function auftrag(teil: Partial<BewerbungAuftrag> = {}): Promise<BewerbungAuftrag> {
  const q = await quelle();
  return {
    titel: 'Bewerbung Beispielstraße 1 – Max und Lea Mustermann',
    fussName: 'Max und Lea Mustermann',
    kurz: 'Beispielstraße 1',
    adresse: ['Beispielstraße 1, 3. OG links', '12345 Musterstadt'],
    satz: 'Wir sind ein ruhiges Paar.',
    inserat: 'Zu Ihrem Inserat auf ImmoScout24',
    einzug: 'Einzug möglich ab 1. Januar 2027',
    fassung: 'Fassung 2 vom 4. November 2026',
    lesehilfeWerte: { portal: 'ImmoScout24', einzug: '2027-01-01', fassung: 2 },
    mitziehende: [{ text: 'Ein Kind', anzahl: 1, art: 'kind' }],
    kontakt: ['Max Mustermann', '0171 3920001', 'max@example.com'],
    kontaktwege: { telefon: '0171 3920001', email: 'max@example.com' },
    bloecke: [
      {
        person: MAX,
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
        person: PETRA,
        teile: [
          {
            abschnitt: 'Bürgschaftserklärung',
            typ: 'buergschaftserklaerung',
            quellen: [{ daten: q }],
          },
        ],
      },
    ],
    deckblatt: true,
    inhaltsverzeichnis: true,
    fusszeile: true,
    hinweis: true,
    modus: 'marktueblich',
    bitte: BITTE_VORSCHLAG,
    schriften: pdfSchriften(),
    datum: DATUM,
    kennung: '3b7c2f1e-8d4a-4c6b-9e2f-1a5d7c9b0e42',
    ...teil,
  };
}

async function anhangAus(bytes: Uint8Array): Promise<HeftaAnhang | null> {
  const pdf = await PDFDocument.load(bytes);
  const eintrag = pdf.getAttachments().find((a) => a.name === ANHANG_NAME);
  return eintrag ? anhangLesen(eintrag.data) : null;
}

/** Baut die Mappe und gibt Lesehilfe, Seitenzahl und Text von Seite 1 zurück. */
async function gebaut(teil: Partial<BewerbungAuftrag> = {}) {
  const e = await bewerbungBauen(await auftrag(teil));
  const a = (await anhangAus(e.bytes))!;
  const pdf = await PDFDocument.load(e.bytes, { updateMetadata: false });
  const [seite1] = await textJeSeite(e.bytes);
  return { e, a, seiten: pdf.getPageCount(), seite1: seite1!, erstellt: pdf.getCreationDate() };
}

describe('Lesehilfe hefta.json, Fassung 4', () => {
  it('beschreibt die Mappe: Personen mit ihren Unterlagen, Kontakt bei der Person, Fassung, Einzug, Portal', async () => {
    const { a, e, seiten, erstellt } = await gebaut();
    expect(a.hefta).toBe(4);
    expect(a.erstellt).toBe(zeitpunktAus(DATUM));
    // Der Zeitpunkt ist das Erstelldatum in den Eigenschaften der PDF (Regel 1, E207).
    expect(new Date(a.erstellt).getTime()).toBe(erstellt!.getTime());
    expect(a.fassung).toBe(2);
    expect(a.seitenzahl).toBe(seiten);
    expect(a.bewerbung).toEqual({
      kennung: '3b7c2f1e-8d4a-4c6b-9e2f-1a5d7c9b0e42',
      wohnung: {
        strasse: 'Beispielstraße 1',
        rest: '3. OG links, 12345 Musterstadt',
        teile: {
          strasse: 'Beispielstraße',
          hausnummer: '1',
          lage: '3. OG links',
          plz: '12345',
          ort: 'Musterstadt',
          land: 'DE',
        },
      },
      inserat: { portal: 'ImmoScout24' },
      einzug: '2027-01-01',
    });
    expect(a.haushalt.personen).toEqual([
      {
        name: 'Max Mustermann',
        vorname: 'Max',
        nachname: 'Mustermann',
        rolle: 'hauptmieter',
        kontakt: true,
        telefon: '0171 3920001',
        telefon_e164: '+491713920001',
        email: 'max@example.com',
        unterlagen: [
          { typ: 'selbstauskunft', seiten_mappe: { von: 2, bis: 2 } },
          {
            typ: 'gehaltsnachweis',
            seiten_mappe: { von: 3, bis: 5 },
            monate: ['2026-07', '2026-08', '2026-09'],
          },
          {
            typ: 'bonitaet',
            seiten_mappe: { von: 6, bis: 6 },
            vom: '2026-10-20',
            pruefweg: 'pruefcode',
          },
        ],
      },
      {
        name: 'Petra Mustermann',
        vorname: 'Petra',
        nachname: 'Mustermann',
        rolle: 'buerge',
        unterlagen: [{ typ: 'buergschaftserklaerung', seiten_mappe: { von: 7, bis: 7 } }],
      },
    ]);
    expect(a.haushalt.mitziehende).toEqual([{ text: 'Ein Kind', anzahl: 1, art: 'kind' }]);
    expect('kontakt' in a.haushalt).toBe(false);
    expect('unterlagen' in a).toBe(false);
    expect(a.modus).toBe('marktueblich');
    expect(a.loeschwunsch).toBe(BITTE_VORSCHLAG);
    // Die Seiten stimmen mit dem Inhalt überein.
    expect(e.inhalt[0]!.teile.map((t) => [t.seite, t.bis])).toEqual([
      [2, 2],
      [3, 5],
      [6, 6],
    ]);
  });

  it('besteht das Schema und passt zur eigenen Mappe (passt() aus dem Paket)', async () => {
    const { a, seiten, seite1 } = await gebaut();
    expect(schemaPruefen(a), JSON.stringify(schemaPruefen.errors)).toBe(true);
    expect(passt(a, { seiten, textSeite1: seite1 })).toBe(true);
    // Gegenprobe: dieselbe Lesehilfe passt nicht zu einer Mappe mit einer Seite mehr.
    expect(passt(a, { seiten: seiten + 1, textSeite1: seite1 })).toBe(false);
  });

  it('Regel 1: Jeder Text der Lesehilfe steht auf dem Deckblatt, auch Vor- und Nachname und das Portal', async () => {
    const { a, seite1 } = await gebaut();
    const glatt = seite1.replace(/\s+/g, ' ');
    const texte = anhangTexte(a);
    for (const text of texte) expect(glatt, text).toContain(text);
    expect(texte).toEqual(
      expect.arrayContaining([
        'Max',
        'Mustermann',
        'ImmoScout24',
        '0171 3920001',
        'max@example.com',
      ]),
    );
    // Gegenprobe: Ein Text, der nicht auf dem Deckblatt steht, fällt auf.
    expect(glatt).not.toContain('Erika Fremd');
  });

  it('Regel 1, P26: Zeichen, die die Schrift nicht kennt, sind ersetzt wie auf dem Papier', async () => {
    const { a, seite1 } = await gebaut({
      bitte: 'Bitte löschen 张 Sie die Unterlagen.',
      mitziehende: [{ text: 'Ein 张 Kind', anzahl: 1, art: 'kind' }],
    });
    expect(a.loeschwunsch).toBe('Bitte löschen ? Sie die Unterlagen.');
    expect(a.haushalt.mitziehende[0]!.text).toBe('Ein ? Kind');
    expect(seite1.replace(/\s+/g, ' ')).toContain(a.loeschwunsch);
    expect(seite1).not.toContain('张');
  });

  it('Kontakt: nur, was auf dem Deckblatt steht; E.164 nur, wenn eindeutig', async () => {
    const nurTelefon = (
      await gebaut({
        kontakt: ['Max Mustermann', '0171 3920005'],
        kontaktwege: { telefon: '0171 3920005' },
      })
    ).a.haushalt.personen[0]!;
    expect(nurTelefon).toMatchObject({
      kontakt: true,
      telefon: '0171 3920005',
      telefon_e164: '+491713920005',
    });
    expect('email' in nurTelefon).toBe(false);
    const ohneVorwahl = (
      await gebaut({ kontakt: ['Max Mustermann', '3920001'], kontaktwege: { telefon: '3920001' } })
    ).a.haushalt.personen[0]!;
    expect(ohneVorwahl.telefon).toBe('3920001');
    expect('telefon_e164' in ohneVorwahl).toBe(false);
    const ohne = (await gebaut({ kontakt: ['Max Mustermann'], kontaktwege: undefined })).a;
    expect(ohne.haushalt.personen[0]!.kontakt).toBe(true);
    expect('telefon' in ohne.haushalt.personen[0]!).toBe(false);
    const keinKontakt = (await gebaut({ kontakt: [], kontaktwege: undefined })).a;
    expect(keinKontakt.haushalt.personen[0]!.kontakt).toBeUndefined();
  });

  it('Namen (F1): wie eingetragen, nie von Hefta geteilt; Grenzfälle vom Eintrag bis in die Datei', async () => {
    const q = (await auftrag()).bloecke[0]!.teile[0]!;
    const faelle: [string, string][] = [
      ['Anna Maria', 'von Muster-Beispiel'],
      ['Aylin', ''],
      ['Thị Mai', 'Nguyễn'],
      ['Dr. Maximiliane-Charlotte Henriette', 'Beispielsdorf-Mustermann'],
    ];
    const bloecke = faelle.map(([vorname, nachname], i) => ({
      person: {
        name: `${vorname} ${nachname}`.trim(),
        vorname,
        nachname,
        rolle: i === 0 ? 'Hauptmieterin' : 'Mitmieterin',
        farbe: '#e9a970',
        rolleId: (i === 0 ? 'hauptmieter' : 'mitmieter') as MappenPerson['rolleId'],
      },
      teile: [{ ...q }],
    }));
    const { a, seiten, seite1 } = await gebaut({ bloecke, kontakt: [], kontaktwege: undefined });
    expect(a.haushalt.personen.map((p) => [p.vorname, p.nachname, p.name])).toEqual(
      faelle.map(([v, n]) => [v, n, `${v} ${n}`.trim()]),
    );
    expect(schemaPruefen(a), JSON.stringify(schemaPruefen.errors)).toBe(true);
    expect(passt(a, { seiten, textSeite1: seite1 })).toBe(true);
  });

  it('Datensparsam nennt den Schritt; ohne Bitte und ohne Wohnung fehlen die Felder', async () => {
    const { a } = await gebaut({
      modus: 'datensparsam',
      schritt: 'besichtigung',
      bitte: undefined,
      adresse: [],
      lesehilfeWerte: { fassung: 1 },
    });
    expect(a.schritt).toBe('besichtigung');
    expect('loeschwunsch' in a).toBe(false);
    expect(a.bewerbung.wohnung).toBeNull();
    expect('inserat' in a.bewerbung).toBe(false);
    expect('einzug' in a.bewerbung).toBe(false);
    expect(schemaPruefen(a), JSON.stringify(schemaPruefen.errors)).toBe(true);
  });

  it('kein Anhang ohne Hinweis und ohne Deckblatt', async () => {
    const ohneHinweis = await bewerbungBauen(await auftrag({ hinweis: false }));
    expect(await anhangAus(ohneHinweis.bytes)).toBeNull();
    const ohneDeckblatt = await bewerbungBauen(await auftrag({ deckblatt: false }));
    expect(await anhangAus(ohneDeckblatt.bytes)).toBeNull();
  });

  it('P25: Die Bitte steht zeichengleich auf dem Deckblatt und in der Lesehilfe, aus nirgends', async () => {
    const eigen =
      'Falls die Wohnung an jemand anderen geht, löschen Sie unsere Unterlagen bitte. Danke!';
    const an = await gebaut({ bitte: eigen });
    expect(an.seite1.replace(/\s+/g, ' ')).toContain(eigen);
    expect(an.a.loeschwunsch).toBe(eigen);
    const aus = await bewerbungBauen(await auftrag({ bitte: undefined }));
    expect((await textJeSeite(aus.bytes)).join(' ').replace(/\s+/g, ' ')).not.toContain(
      'löschen Sie',
    );
    expect('loeschwunsch' in (await anhangAus(aus.bytes))!).toBe(false);
  });

  it('T9: Der Vorschlag siezt den Vermieter und passt in die Grenze', () => {
    expect(BITTE_VORSCHLAG).toMatch(/\bSie\b/);
    expect(BITTE_VORSCHLAG).not.toMatch(/\b(du|dein|lösch)\b/i);
    expect(BITTE_VORSCHLAG.length).toBeLessThanOrEqual(BITTE_MAX);
  });

  it('jede Art aus dem Regelkatalog steht in der öffentlichen Liste (F3)', () => {
    for (const t of katalog.dokumenttypen) expect(TYPEN[t.id], t.id).toBeTruthy();
  });

  it('liest neuere Fassungen und lehnt ab, was keine Lesehilfe ist', () => {
    const a = anhangBauen({
      datum: DATUM,
      adresse: [],
      personen: [{ name: 'Max Mustermann', vorname: 'Max', nachname: 'Mustermann' }],
      kontakt: false,
      mitziehende: [],
      unterlagen: [{ person: 0, typ: 'selbstauskunft', von: 2, bis: 2 }],
      seitenzahl: 2,
    });
    expect(a.bewerbung.wohnung).toBeNull();
    expect(a.haushalt.personen[0]!.rolle).toBe('hauptmieter');
    const neuer = anhangLesen(anhangBytes({ ...a, hefta: 7, x_fremd: 'x' } as HeftaAnhang));
    expect(neuer?.hefta).toBe(7);
    expect(anhangLesen(new TextEncoder().encode('{"hefta":0}'))).toBeNull();
    expect(anhangLesen(new TextEncoder().encode('kein json'))).toBeNull();
    expect(anhangLesen(new TextEncoder().encode('{"foo":1}'))).toBeNull();
  });
});
