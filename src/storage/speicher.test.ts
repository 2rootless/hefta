import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { wohnungsSchluessel } from '../domain/adresse';
import { KEINE_EREIGNISSE, neueId } from '../domain/modell';
import { BackupFehler } from './backup';
import { ALLE_ORTE, SCHEMA_VERSION, datenMigrieren, datenbankOeffnen, type HeftaDb } from './db';
import {
  bestandAusDb,
  neuSeitBackup,
  sicherungEinspielen,
  sicherungErstellen,
  sicherungVorschau,
} from './sicherung';
import {
  allesLoeschen,
  bewerbungAendern,
  bewerbungAnlegen,
  bewerbungLaden,
  bewerbungsKennung,
  bewerbungLoeschen,
  bewerbungSpeichern,
  bewerbungenLaden,
  dateiLesen,
  dateiSpeichern,
  dokumentAendern,
  einstellungenAendern,
  einstellungenLaden,
  farbeSetzen,
  haushaltAnlegen,
  haushaltLaden,
  haushaltLoeschen,
  haushaltZaehlen,
  ansprechpersonSetzen,
  hefteAusVersion1EinordnenEinmal,
  mitgliedEntfernen,
  mitgliedHerausnehmen,
  mitgliedHinzufuegen,
  mitgliedZurueckholen,
  personAendern,
  personAufnehmen,
  personGanzLoeschen,
  rolleWechseln,
  speicherBelegt,
  unterlageSpeichern,
  versionLoeschen,
  versionenZurueck,
  verwaisteDateienLoeschen,
} from './speicher';

const RUNDEN_TEST = 1000;

async function neueDb(): Promise<HeftaDb> {
  return datenbankOeffnen(`test-${neueId()}`);
}

async function haushaltDesAuftraggebers(db: HeftaDb) {
  return haushaltAnlegen(db, {
    kinder: 1,
    weitereErwachsene: 0,
    personen: [
      {
        vorname: 'Max',
        nachname: 'Mustermann',
        bezeichnung: 'maennlich',
        rolle: 'vertrag',
        lebenssituation: 'angestellt',
      },
      {
        vorname: 'Lea',
        nachname: 'Mustermann',
        bezeichnung: 'weiblich',
        rolle: 'vertrag',
        lebenssituation: 'angestellt',
      },
      {
        vorname: 'Petra',
        nachname: 'Mustermann',
        bezeichnung: 'weiblich',
        rolle: 'buerge',
        lebenssituation: 'rente',
      },
    ],
  });
}

/** Alles aus allen Speicherorten, Dateien als Bytes, für Vergleiche. */
async function bestand(db: HeftaDb) {
  const ergebnis: Record<string, unknown[]> = {};
  for (const ort of ALLE_ORTE) {
    const daten = await db.getAll(ort);
    ergebnis[ort] = await Promise.all(
      daten.map(async (d) =>
        ort === 'dateien'
          ? {
              ...d,
              daten: [
                ...new Uint8Array(await new Blob([(d as { daten: Blob }).daten]).arrayBuffer()),
              ],
            }
          : d,
      ),
    );
    ergebnis[ort]!.sort((a, b) =>
      String((a as { id: string }).id).localeCompare(String((b as { id: string }).id)),
    );
  }
  return ergebnis;
}

describe('Datenbank', () => {
  it('legt beim ersten Öffnen alle Speicherorte an (Schema-Version 1)', async () => {
    const db = await neueDb();
    expect(db.version).toBe(SCHEMA_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual([...ALLE_ORTE].sort());
  });

  it('Datenmigration von der aktuellen Version ändert nichts', () => {
    const daten = { personen: [{ id: 'a' }] };
    expect(datenMigrieren(daten, SCHEMA_VERSION)).toEqual(daten);
  });
  it('Schema 2: Beim Öffnen wird jede Bewerbung mit Adresse ein Heft, mit derselben Kennung', async () => {
    const name = `schema2-${neueId()}`;
    const alt = await datenbankOeffnen(name, 1);
    const zeit = '2026-11-01T10:00:00.000Z';
    const basis = {
      createdAt: zeit,
      updatedAt: zeit,
      haushaltId: 'h1',
      quelle: 'Kleinanzeigen',
      inseratText: 'Schöne Wohnung',
      anrede: '',
      ansprechpartner: '',
      personen: [],
      exportprofilId: null,
      verwendeteVersionen: [],
      bestandteile: {
        deckblatt: true,
        inhaltsverzeichnis: true,
        anschreiben: false,
        fusszeile: true,
      },
      dateiname: null,
      kontakt: null,
      status: null,
      anschreiben: null,
    };
    await alt.put('bewerbungen', {
      ...basis,
      id: 'b1',
      adresse: 'Beispielstraße 1, 3. OG links\n12345 Musterstadt',
      satz: 'Wir suchen ab Februar.',
      kennungen: {
        [wohnungsSchluessel('Beispielstraße 1, 3. OG links\n12345 Musterstadt')]: 'k-1',
      },
    });
    await alt.put('bewerbungen', { ...basis, id: 'b2', adresse: '  ' });
    alt.close();

    const db = await datenbankOeffnen(name);
    expect(db.version).toBe(4);
    const hefte = await db.getAll('hefte');
    expect(hefte).toHaveLength(1);
    expect(hefte[0]).toMatchObject({
      haushaltId: 'h1',
      adresse: 'Beispielstraße 1, 3. OG links\n12345 Musterstadt',
      kennung: 'k-1',
      quelle: 'Kleinanzeigen',
      inseratText: 'Schöne Wohnung',
      satz: 'Wir suchen ab Februar.',
      ausVersion1: true,
      // Nachricht 10.11. l: Mit Kennung gab es eine Mappe, gesendet ist nicht sicher.
      ereignisse: { beworben: { am: zeit, weg: 'sonst', sicher: false }, gefragtAm: null },
    });
    // Nichts gelöscht: Die Bewerbungen bleiben, wie sie waren.
    expect((await db.getAll('bewerbungen')).map((b) => b.id).sort()).toEqual(['b1', 'b2']);
    expect(await db.getAllFromIndex('hefte', 'haushaltId', 'h1')).toHaveLength(1);
  });

  it('Hefta 2 ordnet Hefte aus Version 1 einmal ein, nur ohne eigene Ereignisse', async () => {
    const db = await neueDb();
    const zeit = '2026-10-01T10:00:00.000Z';
    const adresse = 'Lindenring 8\n20259 Hamburg';
    await db.put('bewerbungen', {
      ...(await bewerbungAnlegen(db, 'h1')),
      adresse,
      updatedAt: zeit,
      kennungen: { [wohnungsSchluessel(adresse)]: 'k-7' },
    });
    const heft = {
      id: 'heft-1',
      createdAt: zeit,
      updatedAt: zeit,
      haushaltId: 'h1',
      adresse,
      link: null,
      quelle: '',
      inseratText: null,
      kennung: 'k-7',
      ereignisse: { ...KEINE_EREIGNISSE },
      notiz: '',
      ausVersion1: true as const,
    };
    await db.put('hefte', heft);
    await db.put('hefte', {
      ...heft,
      id: 'heft-2',
      ereignisse: { ...KEINE_EREIGNISSE, gefragtAm: zeit },
    });
    await hefteAusVersion1EinordnenEinmal(db);
    expect((await db.get('hefte', 'heft-1'))?.ereignisse.beworben).toEqual({
      am: zeit,
      weg: 'sonst',
      sicher: false,
    });
    // Schon gefragt: bleibt, wie es ist.
    expect((await db.get('hefte', 'heft-2'))?.ereignisse.beworben).toBeNull();
    expect((await einstellungenLaden(db)).version1Eingeordnet).toBeTruthy();
    // Einmal: Ein zweiter Lauf ändert nichts mehr.
    await db.put('hefte', heft);
    await hefteAusVersion1EinordnenEinmal(db);
    expect((await db.get('hefte', 'heft-1'))?.ereignisse.beworben).toBeNull();
    db.close();
  });

  it('Schema 2: dieselbe Regel für Backups aus Schema 1', () => {
    const daten = datenMigrieren(
      {
        bewerbungen: [
          { id: 'b1', haushaltId: 'h1', adresse: 'Lindenring 3', createdAt: '', updatedAt: '' },
          { id: 'b2', haushaltId: 'h1', adresse: '', createdAt: '', updatedAt: '' },
        ],
      },
      1,
    );
    expect(daten.hefte).toHaveLength(1);
    expect(daten.hefte![0]).toMatchObject({ adresse: 'Lindenring 3', haushaltId: 'h1' });
    expect(daten.bewerbungen).toHaveLength(2);
  });

  it('ein Heft ohne Haushalt (E45) lässt sich speichern und steht nicht im Index', async () => {
    const db = await neueDb();
    await db.put('hefte', {
      id: 'x',
      createdAt: '',
      updatedAt: '',
      haushaltId: null,
      adresse: 'Lindenring 3',
      link: null,
      quelle: '',
      inseratText: null,
      kennung: 'k',
      ereignisse: { ...KEINE_EREIGNISSE },
      notiz: '',
    });
    expect(await db.count('hefte')).toBe(1);
    expect(await db.getAllFromIndex('hefte', 'haushaltId', 'x')).toHaveLength(0);
  });
});

describe('Haushalt', () => {
  it('legt Haushalt mit Personen, Rollen, Reihenfolge und Personenfarben an', async () => {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    const ansicht = (await haushaltLaden(db))!;
    expect(ansicht.haushalt.kinder).toBe(1);
    expect(
      ansicht.mitglieder.map((m) => [
        m.person.vorname,
        m.zugehoerigkeit.rolle,
        m.zugehoerigkeit.farbe,
      ]),
    ).toEqual([
      // B14: Vergabe in der Reihenfolge der Palette, nicht nach Nummer: Apricot 1, Lavendel 7, Minze 8.
      ['Max', 'vertrag', 1],
      ['Lea', 'vertrag', 7],
      ['Petra', 'buerge', 8],
    ]);
    for (const m of ansicht.mitglieder) {
      expect(m.person.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(m.person.updatedAt).toBeTruthy();
    }
  });

  it('zählt Kinder auch bei zwei schnellen Tipps richtig und nie unter null', async () => {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    const id = (await haushaltLaden(db))!.haushalt.id;
    await Promise.all([haushaltZaehlen(db, id, 'kinder', 1), haushaltZaehlen(db, id, 'kinder', 1)]);
    expect((await haushaltLaden(db))!.haushalt.kinder).toBe(3);
    await Promise.all([
      haushaltZaehlen(db, id, 'weitereErwachsene', -1),
      haushaltZaehlen(db, id, 'weitereErwachsene', -1),
    ]);
    expect((await haushaltLaden(db))!.haushalt.weitereErwachsene).toBe(0);
  });

  it('Farbe wählen: Hat sie schon jemand, tauscht ihr; sonst ändert sich nur die eigene', async () => {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    const farben = async () =>
      Object.fromEntries(
        (await haushaltLaden(db))!.mitglieder.map((m) => [
          m.person.vorname,
          m.zugehoerigkeit.farbe,
        ]),
      );
    const lea = (await haushaltLaden(db))!.mitglieder[1]!.zugehoerigkeit.id;
    await farbeSetzen(db, lea, 1);
    expect(await farben()).toEqual({ Max: 7, Lea: 1, Petra: 8 });
    await farbeSetzen(db, lea, 5);
    expect(await farben()).toEqual({ Max: 7, Lea: 5, Petra: 8 });
    await farbeSetzen(db, lea, 5);
    expect(await farben()).toEqual({ Max: 7, Lea: 5, Petra: 8 });
  });

  it('gibt null zurück, wenn es noch keinen Haushalt gibt', async () => {
    expect(await haushaltLaden(await neueDb())).toBeNull();
  });

  it('ändert Personen und setzt den Änderungszeitpunkt', async () => {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    const max = (await haushaltLaden(db))!.mitglieder[0]!.person;
    await new Promise((r) => setTimeout(r, 2));
    await personAendern(db, max.id, { lebenssituation: 'selbststaendig' });
    const neu = (await haushaltLaden(db))!.mitglieder[0]!.person;
    expect(neu.lebenssituation).toBe('selbststaendig');
    expect(neu.updatedAt > max.updatedAt).toBe(true);
  });

  it('fügt Personen hinten an und entfernt sie mit ihren Unterlagen und Dateien', async () => {
    const db = await neueDb();
    const haushalt = await haushaltDesAuftraggebers(db);
    const tom = await mitgliedHinzufuegen(db, haushalt.id, {
      vorname: 'Tom',
      nachname: 'Beispiel',
      bezeichnung: 'neutral',
      rolle: 'vertrag',
      lebenssituation: null,
    });
    let ansicht = (await haushaltLaden(db))!;
    // W57: Tom steht im Vertrag und damit vor der Bürgin; seine Reihenfolge ist die letzte.
    const zug = ansicht.mitglieder[2]!.zugehoerigkeit;
    expect(zug.reihenfolge).toBe(3);
    expect(tom.id).toBe(ansicht.mitglieder[2]!.person.id);
    expect(zug.farbe).toBe(9);

    const dateiId = await dateiSpeichern(db, new Blob(['pdf'], { type: 'application/pdf' }));
    const dokId = neueId();
    const zeit = new Date().toISOString();
    await db.put('dokumente', {
      id: dokId,
      createdAt: zeit,
      updatedAt: zeit,
      personId: tom.id,
      typ: 'bonitaet',
      notiz: '',
      serie: null,
      stummBis: null,
    });
    await db.put('versionen', {
      id: neueId(),
      createdAt: zeit,
      updatedAt: zeit,
      dokumentId: dokId,
      ausstellungsdatum: '2026-10-01',
      abrechnungsmonat: null,
      variante: null,
      original: dateiId,
      aufbereitet: null,
      seiten: null,
      schwaerzungen: {},
      gerastert: false,
      erkannteWerte: null,
      vomNutzerBestaetigt: null,
    });

    await mitgliedEntfernen(db, zug.id);
    ansicht = (await haushaltLaden(db))!;
    expect(ansicht.mitglieder).toHaveLength(3);
    expect(await db.get('personen', tom.id)).toBeUndefined();
    expect(await db.getAll('dokumente')).toEqual([]);
    expect(await db.getAll('versionen')).toEqual([]);
    expect(await dateiLesen(db, dateiId)).toBeNull();
  });

  it('zählt den belegten Speicher selbst', async () => {
    const db = await neueDb();
    await dateiSpeichern(db, new Blob([new Uint8Array(1000)]));
    await dateiSpeichern(db, new Blob([new Uint8Array(500)]));
    expect(await speicherBelegt(db)).toBe(1500);
  });

  it('„Alles löschen“ leert jeden Speicherort', async () => {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    await dateiSpeichern(db, new Blob(['x']));
    await einstellungenAendern(db, { letztesBackup: '2026-10-31T10:00:00.000Z' });
    await allesLoeschen(db);
    for (const ort of ALLE_ORTE) expect(await db.count(ort)).toBe(0);
    expect((await einstellungenLaden(db)).letztesBackup).toBeNull();
  });
});

describe('Backup des ganzen Bestands', () => {
  async function befuellt() {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    await dateiSpeichern(
      db,
      new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'application/pdf' }),
    );
    await dateiSpeichern(db, new Blob(['zweite Datei'], { type: 'application/pdf' }));
    await einstellungenAendern(db, { speicherAngefragt: true });
    return db;
  }

  for (const passwort of [undefined, 'Sommer in Hamburg']) {
    it(`Backup → alles löschen → einspielen ist identisch (${passwort ? 'mit' : 'ohne'} Passwort)`, async () => {
      const db = await befuellt();
      const vorher = await bestand(db);
      const datei = await sicherungErstellen(db, passwort, '0.1.0', RUNDEN_TEST);
      await allesLoeschen(db);
      const inhalt = await sicherungEinspielen(db, datei, passwort);
      expect(inhalt).toMatchObject({ personen: 3, dateien: 2 });
      expect(await bestand(db)).toEqual(vorher);
    });
  }

  it('ersetzt beim Einspielen den bisherigen Bestand vollständig', async () => {
    const quelle = await befuellt();
    const datei = await sicherungErstellen(quelle, undefined, '', RUNDEN_TEST);
    const ziel = await neueDb();
    await haushaltAnlegen(ziel, {
      kinder: 0,
      weitereErwachsene: 0,
      personen: [
        {
          vorname: 'Alt',
          nachname: 'Bestand',
          bezeichnung: 'neutral',
          rolle: 'vertrag',
          lebenssituation: null,
        },
      ],
    });
    await dateiSpeichern(ziel, new Blob(['alt']));
    await sicherungEinspielen(ziel, datei);
    expect(await bestand(ziel)).toEqual(await bestand(quelle));
  });

  it('falsches Passwort: klare Meldung, bisheriger Bestand bleibt unverändert', async () => {
    const db = await befuellt();
    const datei = await sicherungErstellen(db, 'richtig', '', RUNDEN_TEST);
    const vorher = await bestand(db);
    await expect(sicherungEinspielen(db, datei, 'falsch')).rejects.toMatchObject({
      grund: 'passwort_falsch',
    });
    expect(await bestand(db)).toEqual(vorher);
  });

  it('lehnt Backups aus einer neueren Version ab', async () => {
    const db = await befuellt();
    const { backupErstellen } = await import('./backup');
    const manifest = {
      format: 'hefta-backup',
      formatVersion: 1,
      schemaVersion: SCHEMA_VERSION + 1,
      appVersion: '',
      erstellt: '',
      daten: {},
      dateien: [],
    };
    const datei = await backupErstellen([
      { pfad: 'manifest.json', daten: new Blob([JSON.stringify(manifest)]) },
    ]);
    const fehler = await sicherungEinspielen(db, datei).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(BackupFehler);
    expect((fehler as BackupFehler).grund).toBe('version_neu');
  });

  it('erkennt ein Backup, dem eine Datei fehlt, und lässt den Bestand unverändert', async () => {
    const db = await befuellt();
    const { backupErstellen } = await import('./backup');
    const manifest = {
      format: 'hefta-backup',
      formatVersion: 1,
      schemaVersion: SCHEMA_VERSION,
      appVersion: '',
      erstellt: '',
      daten: {},
      dateien: [{ id: 'fehlt', createdAt: '', typ: '', groesse: 1 }],
    };
    const datei = await backupErstellen([
      { pfad: 'manifest.json', daten: new Blob([JSON.stringify(manifest)]) },
    ]);
    const vorher = await bestand(db);
    await expect(sicherungEinspielen(db, datei)).rejects.toMatchObject({ grund: 'beschaedigt' });
    expect(await bestand(db)).toEqual(vorher);
  });
});

describe('Unterlagen und Versionen', () => {
  async function mitPerson() {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    const max = (await haushaltLaden(db))!.mitglieder[0]!.person;
    return { db, max };
  }

  function gehalt(personId: string, abrechnungsmonat: string) {
    return {
      personId,
      typ: 'gehaltsnachweis',
      serie: 3,
      original: new Blob(['PDF ' + abrechnungsmonat], { type: 'application/pdf' }),
      aufbereitet: null,
      ausstellungsdatum: null,
      abrechnungsmonat,
      variante: 'gehaltsabrechnung',
      seiten: null,
      gerastert: false,
    };
  }

  it('drei Abrechnungen ergeben eine Serie in einem Dokument; eine vierte kommt dazu', async () => {
    const { db, max } = await mitPerson();
    for (const m of ['2026-07', '2026-08', '2026-09'])
      await unterlageSpeichern(db, gehalt(max.id, m));
    let ansicht = (await haushaltLaden(db))!;
    expect(ansicht.dokumente).toHaveLength(1);
    expect(ansicht.dokumente[0]).toMatchObject({
      typ: 'gehaltsnachweis',
      serie: 3,
      personId: max.id,
    });
    expect(ansicht.versionen).toHaveLength(3);

    await unterlageSpeichern(db, gehalt(max.id, '2026-10'));
    ansicht = (await haushaltLaden(db))!;
    expect(ansicht.dokumente).toHaveLength(1);
    expect(ansicht.versionen.map((v) => v.abrechnungsmonat).sort()).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    const neu = ansicht.versionen.find((v) => v.abrechnungsmonat === '2026-10')!;
    expect(await (await dateiLesen(db, neu.original))!.text()).toBe('PDF 2026-10');
  });

  it('speichert die aufbereitete Fassung getrennt und löscht beim Entfernen beide Dateien', async () => {
    const { db, max } = await mitPerson();
    const v = await unterlageSpeichern(db, {
      ...gehalt(max.id, '2026-09'),
      typ: 'bonitaet',
      serie: null,
      abrechnungsmonat: null,
      ausstellungsdatum: '2026-10-20',
      aufbereitet: new Blob(['gerastert'], { type: 'application/pdf' }),
      gerastert: true,
    });
    expect(v.aufbereitet).not.toBeNull();
    expect(await db.count('dateien')).toBe(2);
    await versionLoeschen(db, v.id);
    // Bleibt für „Rückgängig“, bis es aufgeräumt wird.
    expect(await db.count('dateien')).toBe(2);
    await verwaisteDateienLoeschen(db, -1000);
    expect(await db.count('dateien')).toBe(0);
    expect(await db.count('versionen')).toBe(0);
  });

  it('„Noch nicht“ wird am Dokument gespeichert und von einer neuen Version zurückgesetzt', async () => {
    const { db, max } = await mitPerson();
    await dokumentAendern(db, max.id, 'gehaltsnachweis', 3, {
      stummBis: '2026-11-10',
      stummMonat: '2026-11',
      stummAnzahl: 1,
    });
    expect((await haushaltLaden(db))!.dokumente[0]!.stummBis).toBe('2026-11-10');
    await unterlageSpeichern(db, gehalt(max.id, '2026-10'));
    const dok = (await haushaltLaden(db))!.dokumente[0]!;
    expect(dok.stummBis).toBeNull();
    expect(dok.stummAnzahl).toBe(1);
  });

  it('Backup enthält Unterlagen und Dateien', async () => {
    const { db, max } = await mitPerson();
    await unterlageSpeichern(db, gehalt(max.id, '2026-09'));
    const vorher = await bestand(db);
    const datei = await sicherungErstellen(db, 'pw', '', RUNDEN_TEST);
    await allesLoeschen(db);
    await sicherungEinspielen(db, datei, 'pw');
    expect(await bestand(db)).toEqual(vorher);
  });
});

describe('Kennung der Bewerbung (E6)', () => {
  it('bleibt für dieselbe Wohnung gleich, ist neu für eine andere und steht im Backup', async () => {
    const db = await neueDb();
    const haushalt = await haushaltAnlegen(db, {
      kinder: 0,
      weitereErwachsene: 0,
      personen: [
        {
          vorname: 'Max',
          nachname: 'Muster',
          bezeichnung: 'maennlich',
          rolle: 'vertrag',
          lebenssituation: 'angestellt',
        },
      ],
    });
    const a = await bewerbungsKennung(
      db,
      haushalt.id,
      'Beispielstraße 1, 3. OG links\n12345 Musterstadt',
    );
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(
      await bewerbungsKennung(db, haushalt.id, 'Beispielstr. 1, 3. OG links\n12345 Musterstadt'),
    ).toBe(a);
    const b = await bewerbungsKennung(db, haushalt.id, 'Am Musterplatz 1\n12345 Musterstadt');
    expect(b).not.toBe(a);
    // Zurück zur ersten Wohnung: wieder ihre Kennung.
    expect(
      await bewerbungsKennung(db, haushalt.id, 'Beispielstraße 1, 3. OG links\n12345 Musterstadt'),
    ).toBe(a);
    const bewerbung = await bewerbungLaden(db, haushalt.id);
    expect(Object.values(bewerbung!.kennungen!)).toEqual([a, b]);
  });
});

// W57 (E363, E366): die Ansprechperson rückt nach, ohne Frage; ersetzt „Hauptmieter rückt nach“ (PC102).
describe('Ansprechperson (W57, E366)', () => {
  const stand = async (db: HeftaDb) => {
    const a = (await haushaltLaden(db))!;
    const an = a.mitglieder.find((m) => m.person.id === a.haushalt.ansprechpersonId);
    return {
      an: an?.person.vorname ?? null,
      gespeichert: (await db.get('haushalte', a.haushalt.id))!.ansprechpersonId ?? null,
      reihe: a.mitglieder.map((m) => [m.person.vorname, m.zugehoerigkeit.rolle]),
    };
  };

  it('ein neuer Haushalt: die erste im Vertrag ist Ansprechperson, gespeichert und zuerst', async () => {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    const s1 = await stand(db);
    expect(s1.an).toBe('Max');
    expect(s1.gespeichert).not.toBeNull();
    expect(s1.reihe).toEqual([
      ['Max', 'vertrag'],
      ['Lea', 'vertrag'],
      ['Petra', 'buerge'],
    ]);
  });

  it('Herausnehmen: Lea wird Ansprechperson; kommt Max zurück, bleibt sie es und er steht hinten', async () => {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    const max = (await haushaltLaden(db))!.mitglieder[0]!;
    await mitgliedHerausnehmen(db, max.zugehoerigkeit.id);
    expect((await stand(db)).an).toBe('Lea');
    await mitgliedZurueckholen(db, max.zugehoerigkeit.id);
    const s2 = await stand(db);
    expect(s2.an).toBe('Lea');
    expect(s2.reihe).toEqual([
      ['Lea', 'vertrag'],
      ['Max', 'vertrag'],
      ['Petra', 'buerge'],
    ]);
    // Gegenprobe: Die frühere Ansprechperson ist nicht mehr gespeichert.
    expect(s2.gespeichert).not.toBe(max.person.id);
  });

  it('Bürge werden, Entfernen und ganz Löschen: Lea wird Ansprechperson', async () => {
    for (const weg of ['buerge', 'entfernen', 'loeschen'] as const) {
      const db = await neueDb();
      await haushaltDesAuftraggebers(db);
      const max = (await haushaltLaden(db))!.mitglieder[0]!;
      if (weg === 'buerge') await rolleWechseln(db, max.zugehoerigkeit.id, 'buerge');
      if (weg === 'entfernen') await mitgliedEntfernen(db, max.zugehoerigkeit.id);
      if (weg === 'loeschen') await personGanzLoeschen(db, max.person.id);
      expect((await stand(db)).an, weg).toBe('Lea');
    }
  });

  it('niemand mehr im Vertrag: keine Ansprechperson, die Bürgin bleibt Bürgin', async () => {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    const [max, lea] = (await haushaltLaden(db))!.mitglieder;
    await mitgliedHerausnehmen(db, lea!.zugehoerigkeit.id);
    await mitgliedHerausnehmen(db, max!.zugehoerigkeit.id);
    const s3 = await stand(db);
    expect(s3.an).toBeNull();
    expect(s3.reihe).toEqual([['Petra', 'buerge']]);
  });

  it('ansprechpersonSetzen: Lea wird Ansprechperson und steht zuerst; die Bürgin kommt dabei in den Vertrag', async () => {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    const [, lea, petra] = (await haushaltLaden(db))!.mitglieder;
    await ansprechpersonSetzen(db, lea!.zugehoerigkeit.id);
    expect((await stand(db)).reihe[0]).toEqual(['Lea', 'vertrag']);
    await ansprechpersonSetzen(db, petra!.zugehoerigkeit.id);
    const s4 = await stand(db);
    expect(s4.an).toBe('Petra');
    expect(s4.reihe).toEqual([
      ['Petra', 'vertrag'],
      ['Lea', 'vertrag'],
      ['Max', 'vertrag'],
    ]);
  });

  it('Daten ohne Ansprechperson (aus 2.1, ohne Übernahme): die erste im Vertrag', async () => {
    const db = await neueDb();
    const h = await haushaltDesAuftraggebers(db);
    await db.put('haushalte', { ...(await db.get('haushalte', h.id))!, ansprechpersonId: null });
    // So schrieb 2.1: Rollen „hauptmieter“ und „mitmieter“.
    for (const z of await db.getAll('zugehoerigkeiten'))
      if (z.rolle === 'vertrag')
        await db.put('zugehoerigkeiten', {
          ...z,
          rolle: (z.reihenfolge === 0 ? 'hauptmieter' : 'mitmieter') as never,
        });
    const s5 = await stand(db);
    expect(s5.an).toBe('Max');
    expect(s5.reihe).toEqual([
      ['Max', 'vertrag'],
      ['Lea', 'vertrag'],
      ['Petra', 'buerge'],
    ]);
  });
});

describe('Herausnehmen', () => {
  it('nimmt eine Person aus dem Haushalt, behält aber Person und Unterlagen', async () => {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    const lea = (await haushaltLaden(db))!.mitglieder[1]!;
    const dateiId = await dateiSpeichern(db, new Blob(['pdf']));
    const zeit = new Date().toISOString();
    await db.put('dokumente', {
      id: 'd1',
      createdAt: zeit,
      updatedAt: zeit,
      personId: lea.person.id,
      typ: 'bonitaet',
      notiz: '',
      serie: null,
      stummBis: null,
    });
    await mitgliedHerausnehmen(db, lea.zugehoerigkeit.id);
    expect((await haushaltLaden(db))!.mitglieder.map((m) => m.person.vorname)).toEqual([
      'Max',
      'Petra',
    ]);
    expect(await db.get('personen', lea.person.id)).toBeDefined();
    expect(await db.get('dokumente', 'd1')).toBeDefined();
    expect(await dateiLesen(db, dateiId)).not.toBeNull();
    expect((await haushaltLaden(db))!.herausgenommen.map((m) => m.person.vorname)).toEqual(['Lea']);
  });

  it('holt eine Person zurück, hinten an, mit freier Farbe, wenn ihre vergeben ist', async () => {
    const db = await neueDb();
    const haushalt = await haushaltDesAuftraggebers(db);
    const lea = (await haushaltLaden(db))!.mitglieder[1]!;
    await mitgliedHerausnehmen(db, lea.zugehoerigkeit.id);
    // Leas Farbe 7 wird frei und geht an die nächste neue Person.
    await mitgliedHinzufuegen(db, haushalt.id, {
      vorname: 'Tom',
      nachname: 'Beispiel',
      bezeichnung: 'neutral',
      rolle: 'vertrag',
      lebenssituation: null,
    });
    // W57: Max, Tom (im Vertrag), dann Petra (bürgt).
    expect((await haushaltLaden(db))!.mitglieder.map((m) => m.zugehoerigkeit.farbe)).toEqual([
      1, 7, 8,
    ]);
    await mitgliedZurueckholen(db, lea.zugehoerigkeit.id);
    const ansicht = (await haushaltLaden(db))!;
    expect(ansicht.herausgenommen).toEqual([]);
    expect(ansicht.mitglieder.map((m) => [m.person.vorname, m.zugehoerigkeit.farbe])).toEqual([
      ['Max', 1],
      ['Tom', 7],
      ['Lea', 9],
      ['Petra', 8],
    ]);
  });
  it('holt als Bürgin zurück, wenn sie diesmal bürgt (Rolle gilt nur hier)', async () => {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    const lea = (await haushaltLaden(db))!.mitglieder[1]!;
    await mitgliedHerausnehmen(db, lea.zugehoerigkeit.id);
    await mitgliedZurueckholen(db, lea.zugehoerigkeit.id, {
      rolle: 'buerge',
      bezeichnung: 'weiblich',
    });
    const zurueck = (await haushaltLaden(db))!.mitglieder.find(
      (m) => m.person.id === lea.person.id,
    )!;
    expect(zurueck.zugehoerigkeit.rolle).toBe('buerge');
  });

  it('löscht eine Person ganz, mit Unterlagen, Dateien und allen Plätzen', async () => {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    const lea = (await haushaltLaden(db))!.mitglieder[1]!;
    const dateiId = await dateiSpeichern(db, new Blob(['pdf']));
    const zeit = new Date().toISOString();
    await db.put('dokumente', {
      id: 'd1',
      createdAt: zeit,
      updatedAt: zeit,
      personId: lea.person.id,
      typ: 'bonitaet',
      notiz: '',
      serie: null,
      stummBis: null,
    });
    await db.put('versionen', {
      id: 'v1',
      createdAt: zeit,
      updatedAt: zeit,
      dokumentId: 'd1',
      ausstellungsdatum: '2026-10-01',
      abrechnungsmonat: null,
      variante: null,
      original: dateiId,
      aufbereitet: null,
      seiten: null,
      schwaerzungen: {},
      gerastert: false,
      erkannteWerte: null,
      vomNutzerBestaetigt: null,
    } as never);
    await mitgliedHerausnehmen(db, lea.zugehoerigkeit.id);
    await personGanzLoeschen(db, lea.person.id);
    const ansicht = (await haushaltLaden(db))!;
    expect(ansicht.herausgenommen).toEqual([]);
    expect(ansicht.mitglieder.map((m) => m.person.vorname)).toEqual(['Max', 'Petra']);
    expect(await db.get('personen', lea.person.id)).toBeUndefined();
    expect(await db.get('dokumente', 'd1')).toBeUndefined();
    expect(await db.get('versionen', 'v1')).toBeUndefined();
    expect(await dateiLesen(db, dateiId)).toBeNull();
  });
});

describe('Mehrere Monate in einer Datei (Serie, RS2)', () => {
  it('legt je Monat eine Version an, die Datei nur einmal; löscht sie erst mit dem letzten Monat', async () => {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    const max = (await haushaltLaden(db))!.mitglieder[0]!.person;
    const v = await unterlageSpeichern(db, {
      personId: max.id,
      typ: 'gehaltsnachweis',
      serie: 3,
      original: new Blob(['pdf']),
      aufbereitet: null,
      ausstellungsdatum: null,
      abrechnungsmonat: '2026-09',
      aufteilung: [
        { monat: '2026-09', seiten: [0] },
        { monat: '2026-08', seiten: [1] },
        { monat: '2026-07', seiten: [2] },
      ],
      variante: null,
      seiten: null,
      gerastert: false,
    });
    const alle = await db.getAllFromIndex('versionen', 'dokumentId', v.dokumentId);
    expect(alle.map((x) => x.abrechnungsmonat).sort()).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(new Set(alle.map((x) => x.original)).size).toBe(1);
    expect(await db.count('dateien')).toBe(1);

    await versionLoeschen(db, alle[0]!.id);
    await versionLoeschen(db, alle[1]!.id);
    expect(await dateiLesen(db, v.original)).not.toBeNull();
    await versionLoeschen(db, alle[2]!.id);
    await verwaisteDateienLoeschen(db, -1000);
    expect(await dateiLesen(db, v.original)).toBeNull();
  });
});

describe('Backup-Vorschau und Zahlen (S6–S9, U15)', () => {
  it('zeigt vor dem Einspielen, was drin ist, und prüft das Passwort', async () => {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    const datei = await sicherungErstellen(db, 'geheim', '1.0', RUNDEN_TEST);
    const vorschau = await sicherungVorschau(datei, 'geheim');
    expect(vorschau.bestand).toEqual({
      personen: 3,
      kinder: 1,
      weitere: 0,
      unterlagen: 0,
      hefte: 0,
      bewerbungen: 0,
      vertragNamen: ['Max Mustermann', 'Lea Mustermann'],
      buergenNamen: ['Petra Mustermann'],
    });
    await expect(sicherungVorschau(datei, 'falsch')).rejects.toMatchObject({
      grund: 'passwort_falsch',
    });
    await expect(sicherungVorschau(datei)).rejects.toMatchObject({ grund: 'passwort_noetig' });
    expect(await bestandAusDb(db)).toEqual(vorschau.bestand);
  });

  it('zählt Unterlagen, die seit dem letzten Backup dazugekommen sind', async () => {
    const db = await neueDb();
    await haushaltDesAuftraggebers(db);
    const max = (await haushaltLaden(db))!.mitglieder[0]!.person;
    const vorher = new Date(Date.now() - 60_000).toISOString();
    await unterlageSpeichern(db, {
      personId: max.id,
      typ: 'bonitaet',
      serie: null,
      original: new Blob(['pdf']),
      aufbereitet: null,
      ausstellungsdatum: '2026-10-20',
      abrechnungsmonat: null,
      variante: null,
      seiten: null,
      gerastert: false,
    });
    expect(await neuSeitBackup(db, vorher)).toBe(1);
    expect(await neuSeitBackup(db, new Date(Date.now() + 60_000).toISOString())).toBe(0);
    expect(await neuSeitBackup(db, null)).toBe(1);
  });
});

describe('Bewerbungen (Version 2)', () => {
  it('mehrere je Haushalt, mit Stand, Miete und Anschreiben; die aktuelle bleibt die zuletzt geänderte', async () => {
    const db = await neueDb();
    const haushalt = await haushaltDesAuftraggebers(db);
    const erste = await bewerbungSpeichern(db, haushalt.id, { adresse: 'Beispielstraße 1' });
    // Zeitstempel in Millisekunden: zwei Schritte im selben Moment wären gleich alt.
    const warten = () => new Promise((ok) => setTimeout(ok, 5));
    await warten();
    const zweite = await bewerbungAnlegen(db, haushalt.id, {
      adresse: 'Lindenring 3',
      miete: { kalt: 1200, warm: 1450 },
      status: 'entwurf',
    });
    expect((await bewerbungenLaden(db, haushalt.id)).map((b) => b.adresse)).toEqual([
      'Lindenring 3',
      'Beispielstraße 1',
    ]);
    await warten();
    await bewerbungAendern(db, erste.id, {
      status: 'absage',
      anschreiben: { betreff: 'Bewerbung', text: 'Hallo' },
    });
    const liste = await bewerbungenLaden(db, haushalt.id);
    expect(liste.map((b) => b.status)).toEqual(['entwurf', 'absage']);
    expect(liste[1]!.anschreiben?.text).toBe('Hallo');
    expect((await bewerbungLaden(db, haushalt.id))?.id).toBe(erste.id);
    expect(await bewerbungAendern(db, 'gibt-es-nicht', { adresse: 'x' })).toBeNull();
    await bewerbungLoeschen(db, zweite.id);
    expect(await bewerbungenLaden(db, haushalt.id)).toHaveLength(1);
  });
});

describe('Backup je Haushalt und Hinzufügen (Version 2)', () => {
  it('sichert nur einen Haushalt und fügt ihn in einen anderen Bestand ein, ohne etwas zu verlieren', async () => {
    const quelle = await neueDb();
    const hA = await haushaltDesAuftraggebers(quelle);
    const ansichtA = (await haushaltLaden(quelle))!;
    await unterlageSpeichern(quelle, {
      personId: ansichtA.mitglieder[0]!.person.id,
      typ: 'bonitaet',
      serie: null,
      original: new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' }),
      aufbereitet: null,
      ausstellungsdatum: '2026-10-20',
      abrechnungsmonat: null,
      variante: null,
      seiten: null,
      gerastert: false,
    });
    // Ein zweiter Haushalt in derselben Datenbank darf nicht mit ins Backup.
    await haushaltAnlegen(quelle, {
      kinder: 0,
      weitereErwachsene: 0,
      personen: [
        {
          vorname: 'Tom',
          nachname: 'Andere',
          bezeichnung: 'maennlich',
          rolle: 'vertrag',
          lebenssituation: 'angestellt',
        },
      ],
    });
    const backup = await sicherungErstellen(quelle, undefined, '2.0.0', RUNDEN_TEST, {
      haushaltId: hA.id,
    });
    const vorschau = await sicherungVorschau(backup);
    expect(vorschau.nurHaushalt).toBe(true);
    expect(vorschau.bestand.personen).toBe(3);

    const ziel = await neueDb();
    const hIda = await haushaltAnlegen(ziel, {
      kinder: 0,
      weitereErwachsene: 0,
      personen: [
        {
          vorname: 'Ida',
          nachname: 'Schon-da',
          bezeichnung: 'weiblich',
          rolle: 'vertrag',
          lebenssituation: 'rente',
        },
      ],
    });
    const idaDatei = await dateiSpeichern(ziel, new Blob([new Uint8Array([9])]));
    await sicherungEinspielen(ziel, backup, undefined, { art: 'hinzufuegen' });

    expect(await ziel.count('haushalte')).toBe(2);
    const namen = (await ziel.getAll('personen')).map((p) => p.vorname).sort();
    expect(namen).toEqual(['Ida', 'Lea', 'Max', 'Petra']);
    expect(await ziel.count('versionen')).toBe(1);
    expect(await dateiLesen(ziel, idaDatei)).not.toBeNull();
    expect(await ziel.count('dateien')).toBe(2);

    // Ohne Wahl der älteste Haushalt (hier der eingespielte), mit Wahl der gewählte.
    expect((await haushaltLaden(ziel))!.mitglieder[0]!.person.vorname).toBe('Max');
    expect((await haushaltLaden(ziel, hIda.id))!.mitglieder[0]!.person.vorname).toBe('Ida');
    expect((await haushaltLaden(ziel, 'weg'))!.mitglieder[0]!.person.vorname).toBe('Max');
  });
});

describe('Dateien, die sich Versionen teilen', () => {
  async function zweiMitEinerDatei(db: HeftaDb) {
    const blob = new Blob(['x'], { type: 'application/pdf' });
    const erste = await unterlageSpeichern(db, {
      personId: 'p',
      typ: 'gehaltsnachweis',
      serie: 3,
      original: blob,
      aufbereitet: null,
      ausstellungsdatum: null,
      abrechnungsmonat: '2026-09',
      variante: null,
      seiten: null,
      gerastert: false,
      aufteilung: [
        { monat: '2026-09', seiten: [0] },
        { monat: '2026-08', seiten: [1] },
      ],
    });
    const alle = await db.getAll('versionen');
    return { erste, zweite: alle.find((v) => v.id !== erste.id)! };
  }

  it('Die Datei bleibt, bis die letzte Version weg ist; „Rückgängig“ holt alles zurück', async () => {
    const db = await datenbankOeffnen(`geteilt-${Math.random()}`);
    const { erste, zweite } = await zweiMitEinerDatei(db);
    await versionLoeschen(db, erste.id);
    await verwaisteDateienLoeschen(db, -1000);
    expect(await db.get('dateien', erste.original)).toBeDefined();
    const stand = await versionLoeschen(db, zweite.id);
    // Die Datei bleibt, solange „Rückgängig“ möglich ist; Safari könnte sie sonst nicht zurückschreiben.
    expect(await db.get('dateien', erste.original)).toBeDefined();
    await versionenZurueck(db, stand);
    await verwaisteDateienLoeschen(db, -1000);
    expect(await db.get('dateien', erste.original)).toBeDefined();
    expect((await db.get('versionen', zweite.id))?.seiten).toEqual([1]);
    db.close();
  });
});

describe('Mehrere Haushalte, Modell (E53)', () => {
  function erklaerung(personId: string, zugehoerigkeitId?: string) {
    return {
      personId,
      typ: 'buergschaftserklaerung',
      serie: null,
      original: new Blob(['PDF Bürgschaft'], { type: 'application/pdf' }),
      aufbereitet: null,
      ausstellungsdatum: '2026-11-01',
      abrechnungsmonat: null,
      variante: null,
      seiten: null,
      gerastert: false,
      ...(zugehoerigkeitId ? { zugehoerigkeitId } : {}),
    };
  }

  async function zweiHaushalte() {
    const db = await neueDb();
    const erster = await haushaltDesAuftraggebers(db);
    const zweiter = await haushaltAnlegen(db, {
      kinder: 0,
      weitereErwachsene: 0,
      personen: [
        {
          vorname: 'Jonas',
          nachname: 'Becker',
          bezeichnung: 'maennlich',
          rolle: 'vertrag',
          lebenssituation: 'angestellt',
        },
      ],
    });
    const a = (await haushaltLaden(db, erster.id))!;
    const petra = a.mitglieder.find((m) => m.person.vorname === 'Petra')!;
    return { db, erster, zweiter, petra };
  }

  it('ein zweiter Haushalt vergibt keine Farbe, die im ersten schon vergeben ist', async () => {
    const { db, erster, zweiter } = await zweiHaushalte();
    const a = (await haushaltLaden(db, erster.id))!.mitglieder.map((m) => m.zugehoerigkeit.farbe);
    const b = (await haushaltLaden(db, zweiter.id))!.mitglieder.map((m) => m.zugehoerigkeit.farbe);
    expect(a).toEqual([1, 7, 8]);
    expect(b).toEqual([9]);
    db.close();
  });

  it('eine Person kommt mit ihrer Farbe in den zweiten Haushalt, einmal', async () => {
    const { db, zweiter, petra } = await zweiHaushalte();
    const zug = await personAufnehmen(db, zweiter.id, petra.person.id, 'buerge', 'weiblich');
    expect(zug.farbe).toBe(petra.zugehoerigkeit.farbe);
    expect(zug.reihenfolge).toBe(1);
    const nochmal = await personAufnehmen(db, zweiter.id, petra.person.id, 'buerge', 'weiblich');
    expect(nochmal.id).toBe(zug.id);
    expect((await db.getAll('personen')).length).toBe(4);
    db.close();
  });

  it('die Bürgschaftserklärung bleibt im ersten Haushalt, der Gehaltsnachweis gilt in beiden', async () => {
    const { db, erster, zweiter, petra } = await zweiHaushalte();
    await unterlageSpeichern(db, erklaerung(petra.person.id));
    await unterlageSpeichern(db, {
      ...erklaerung(petra.person.id),
      typ: 'rentenbescheid',
      ausstellungsdatum: '2026-01-15',
    });
    await personAufnehmen(db, zweiter.id, petra.person.id, 'buerge', 'weiblich');
    const typen = async (id: string) =>
      (await haushaltLaden(db, id))!.dokumente
        .filter((d) => d.personId === petra.person.id)
        .map((d) => d.typ)
        .sort();
    expect(await typen(erster.id)).toEqual(['buergschaftserklaerung', 'rentenbescheid']);
    expect(await typen(zweiter.id)).toEqual(['rentenbescheid']);
    const alt = (await db.getAll('dokumente')).find((d) => d.typ === 'buergschaftserklaerung')!;
    expect(alt.zugehoerigkeitId).toBe(petra.zugehoerigkeit.id);
    db.close();
  });

  it('eine neue Erklärung für den zweiten Haushalt ersetzt die des ersten nicht', async () => {
    const { db, erster, zweiter, petra } = await zweiHaushalte();
    await unterlageSpeichern(db, erklaerung(petra.person.id));
    const zug = await personAufnehmen(db, zweiter.id, petra.person.id, 'buerge', 'weiblich');
    await unterlageSpeichern(db, erklaerung(petra.person.id, zug.id));
    const erklaerungen = (await db.getAll('dokumente')).filter(
      (d) => d.typ === 'buergschaftserklaerung',
    );
    expect(erklaerungen.map((d) => d.zugehoerigkeitId).sort()).toEqual(
      [petra.zugehoerigkeit.id, zug.id].sort(),
    );
    for (const h of [erster.id, zweiter.id])
      expect(
        (await haushaltLaden(db, h))!.dokumente.filter((d) => d.typ === 'buergschaftserklaerung'),
      ).toHaveLength(1);
    db.close();
  });

  it('mit einem Haushalt bekommt eine Erklärung keine Zugehörigkeit', async () => {
    const db = await neueDb();
    const h = await haushaltDesAuftraggebers(db);
    const petra = (await haushaltLaden(db, h.id))!.mitglieder[2]!;
    await unterlageSpeichern(db, erklaerung(petra.person.id));
    const [d] = await db.getAll('dokumente');
    expect(d && 'zugehoerigkeitId' in d).toBe(false);
    db.close();
  });
});

describe('Unterlagen des Haushalts (DP45 G1, W28)', () => {
  it('der WBS liegt beim Haushalt, nicht bei einer Person, und geht mit dem Haushalt', async () => {
    const db = await neueDb();
    const haushalt = await haushaltDesAuftraggebers(db);
    await unterlageSpeichern(db, {
      personId: haushalt.id,
      typ: 'wbs',
      serie: null,
      original: new Blob(['PDF WBS'], { type: 'application/pdf' }),
      aufbereitet: null,
      ausstellungsdatum: null,
      abrechnungsmonat: null,
      variante: null,
      seiten: null,
      gerastert: false,
    });
    const ansicht = (await haushaltLaden(db, haushalt.id))!;
    expect(ansicht.haushaltDokumente?.map((d) => d.typ)).toEqual(['wbs']);
    expect(ansicht.dokumente.some((d) => d.typ === 'wbs')).toBe(false);
    expect(ansicht.versionen.some((v) => v.dokumentId === ansicht.haushaltDokumente![0]!.id)).toBe(
      true,
    );
    await haushaltLoeschen(db, haushalt.id);
    expect(await db.getAllFromIndex('dokumente', 'personId', haushalt.id)).toEqual([]);
  });
});
