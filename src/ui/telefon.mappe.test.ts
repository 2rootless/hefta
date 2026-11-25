import 'fake-indexeddb/auto';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it, vi } from 'vitest';
import { lesen } from '../../pakete/hefta-json/src/index';
import type { ExportEinstellungen } from '../domain/export';
import { neueId } from '../domain/modell';
import { telefonOffen } from '../domain/telefon';
import { datenbankOeffnen, type HeftaDb } from '../storage/db';
import { sicherungEinspielen, sicherungErstellen } from '../storage/sicherung';
import {
  haushaltAnlegen,
  haushaltLaden,
  personAendern,
  telefoneUmsetzen,
} from '../storage/speicher';
import { pdfSchriften } from '../test/hilfen';
import { seitenText } from '../vermieter/papier';
import { mappeErstellen } from './mappeErstellen';

// E222, PC112 (DP77, Abschnitt 5; TL27, TL28): Gespeicherte Nummern aus der Zeit vor dem Land. Eine eindeutige wird
// still umgesetzt, eine andere bleibt, wie sie ist, wird ein offener Punkt und steht weder auf dem Deckblatt noch in
// der Lesehilfe. Nichts wird gelöscht; ein zweiter Lauf ändert nichts. Dazu ein Backup von vor der Änderung, danach
// eingespielt. Gegenprobe: Eine nicht umsetzbare Nummer auf dem Deckblatt macht den Test rot.

vi.mock('../pdf/schriften', async (original) => ({
  ...(await original<typeof import('../pdf/schriften')>()),
  pdfSchriftenLaden: async () => pdfSchriften(),
}));

const STAND: ExportEinstellungen = {
  modus: 'marktueblich',
  schritt: 'will_wohnung',
  ohne: [],
  auswahl: {},
  ausgabe: 'eine',
  deckblatt: true,
  inhaltsverzeichnis: true,
  fusszeile: true,
  hinweis: true,
  dateiname: '',
};

/** Ein Haushalt mit Lea, ihre Nummer gespeichert wie vor E222: ohne Land und ohne internationale Nummer. */
async function mitAlterNummer(telefon: string): Promise<{ db: HeftaDb; id: string }> {
  const db = await datenbankOeffnen(`telefon-${neueId()}`);
  await haushaltAnlegen(db, {
    kinder: 0,
    weitereErwachsene: 0,
    personen: [
      {
        vorname: 'Lea',
        nachname: 'Muster-Beispiel',
        bezeichnung: 'weiblich',
        rolle: 'vertrag',
        lebenssituation: 'angestellt',
      },
    ],
  });
  const lea = (await haushaltLaden(db))!.mitglieder[0]!.person;
  await personAendern(db, lea.id, {
    kontakt: { telefon, email: 'lea.muster-beispiel@example.com' },
  });
  return { db, id: lea.id };
}

async function deckblattUndLesehilfe(db: HeftaDb) {
  const ansicht = (await haushaltLaden(db))!;
  const erg = await mappeErstellen(
    db,
    ansicht,
    { adresse: 'Lindenring 8, 2. Obergeschoss\n20259 Hamburg', satz: '' },
    STAND,
    new Date(2026, 10, 18, 9, 0, 0),
  );
  const bytes = new Uint8Array(await erg.dateien[0]!.arrayBuffer());
  const aufgabe = pdfjs.getDocument({ data: bytes, verbosity: 0 });
  const dok = await aufgabe.promise;
  try {
    const anh = await dok.getAttachments();
    const t = [...anh!.entries()].find(([, a]) => a.filename === 'hefta.json')!;
    const lesehilfe = lesen((await dok.getAttachmentContent(t[0]))!);
    return { seite1: (await seitenText(dok, 1)).replace(/\s+/g, ' '), lesehilfe };
  } finally {
    await aufgabe.destroy();
  }
}

describe('E222: alte Nummern (TL27, TL28)', () => {
  it('TL28: „+49 (0)171 3920001“ wird still umgesetzt und steht in Mappe und Lesehilfe', async () => {
    const { db, id } = await mitAlterNummer('+49 (0)171 3920001');
    expect(await telefoneUmsetzen(db)).toBe(1);
    const k = (await db.get('personen', id))!.kontakt;
    expect(k).toMatchObject({
      telefon: '0171 3920001',
      telefonLand: 'DE',
      telefonE164: '+491713920001',
      email: 'lea.muster-beispiel@example.com',
    });
    expect(telefonOffen(k)).toBe(false);
    // Ein zweiter Lauf ändert nichts.
    expect(await telefoneUmsetzen(db)).toBe(0);
    const m = await deckblattUndLesehilfe(db);
    expect(m.seite1).toContain('0171 3920001');
    expect(m.lesehilfe!.haushalt.personen[0]).toMatchObject({
      telefon: '0171 3920001',
      telefon_e164: '+491713920001',
    });
  }, 60_000);

  it('TL27: „0171 3920001-12“ bleibt, wie es ist, wird ein offener Punkt und steht nicht in der Mappe', async () => {
    const { db, id } = await mitAlterNummer('0171 3920001-12');
    expect(await telefoneUmsetzen(db)).toBe(0);
    const k = (await db.get('personen', id))!.kontakt;
    expect(k.telefon).toBe('0171 3920001-12');
    expect(k.telefonE164).toBeUndefined();
    expect(telefonOffen(k)).toBe(true);
    const m = await deckblattUndLesehilfe(db);
    expect(m.seite1).not.toContain('3920001');
    // Die Mail bricht auf dem Deckblatt um; ohne Leerzeichen verglichen.
    expect(m.seite1.replaceAll(' ', '')).toContain('lea.muster-beispiel@example.com');
    const lea = m.lesehilfe!.haushalt.personen[0]!;
    expect('telefon' in lea).toBe(false);
    expect('telefon_e164' in lea).toBe(false);
  }, 60_000);

  it('ein Backup von vor der Änderung, danach eingespielt, wird beim Laden umgesetzt; nichts geht verloren', async () => {
    const alt = await mitAlterNummer('0171/3920007');
    const datei = await sicherungErstellen(alt.db);
    const ziel = await datenbankOeffnen(`telefon-ziel-${neueId()}`);
    // Das Einspielen setzt die Nummer gleich um; ein Lauf beim Start danach findet nichts mehr.
    await sicherungEinspielen(ziel, datei);
    expect(await telefoneUmsetzen(ziel)).toBe(0);
    expect((await ziel.get('personen', alt.id))!.kontakt).toMatchObject({
      telefon: '0171 3920007',
      telefonE164: '+491713920007',
      email: 'lea.muster-beispiel@example.com',
    });
    // Rückweg: Ein Backup danach trägt Land und internationale Nummer mit.
    const zurueck = await datenbankOeffnen(`telefon-zurueck-${neueId()}`);
    await sicherungEinspielen(zurueck, await sicherungErstellen(ziel));
    expect((await zurueck.get('personen', alt.id))!.kontakt).toMatchObject({
      telefonLand: 'DE',
      telefonE164: '+491713920007',
    });
  }, 60_000);

  it('Gegenprobe: Mit einer umsetzbaren Nummer stünde sie auf dem Deckblatt; die nicht umsetzbare nie', async () => {
    const gut = await mitAlterNummer('0171 3920001');
    await telefoneUmsetzen(gut.db);
    expect((await deckblattUndLesehilfe(gut.db)).seite1).toContain('0171 3920001');
    const schlecht = await mitAlterNummer('3920001');
    await telefoneUmsetzen(schlecht.db);
    expect((await deckblattUndLesehilfe(schlecht.db)).seite1).not.toContain('3920001');
  }, 60_000);
});
