import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { neueId } from '../domain/modell';
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
  haushaltZaehlen,
  mitgliedEntfernen,
  mitgliedHerausnehmen,
  mitgliedHinzufuegen,
  mitgliedZurueckholen,
  personAendern,
  personGanzLoeschen,
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
        rolle: 'hauptmieter',
        lebenssituation: 'angestellt',
      },
      {
        vorname: 'Lea',
        nachname: 'Mustermann',
        bezeichnung: 'weiblich',
        rolle: 'mitmieter',
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
      ['Max', 'hauptmieter', 1],
      ['Lea', 'mitmieter', 2],
      ['Petra', 'buerge', 3],
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
    expect(await farben()).toEqual({ Max: 2, Lea: 1, Petra: 3 });
    await farbeSetzen(db, lea, 5);
    expect(await farben()).toEqual({ Max: 2, Lea: 5, Petra: 3 });
    await farbeSetzen(db, lea, 5);
    expect(await farben()).toEqual({ Max: 2, Lea: 5, Petra: 3 });
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
      rolle: 'mitmieter',
      lebenssituation: null,
    });
    let ansicht = (await haushaltLaden(db))!;
    const zug = ansicht.mitglieder[3]!.zugehoerigkeit;
    expect(zug.reihenfolge).toBe(3);
    expect(tom.id).toBe(ansicht.mitglieder[3]!.person.id);
    expect(zug.farbe).toBe(4);

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
          rolle: 'hauptmieter',
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
          rolle: 'hauptmieter',
          lebenssituation: 'angestellt',
        },
      ],
    });
    const a = await bewerbungsKennung(
      db,
      haushalt.id,
      'Hauptstraße 12, 3. OG links\n22767 Hamburg',
    );
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(
      await bewerbungsKennung(db, haushalt.id, 'Hauptstr. 12, 3. OG links\n22767 Hamburg'),
    ).toBe(a);
    const b = await bewerbungsKennung(db, haushalt.id, 'Am Wall 140\n28195 Bremen');
    expect(b).not.toBe(a);
    // Zurück zur ersten Wohnung: wieder ihre Kennung.
    expect(
      await bewerbungsKennung(db, haushalt.id, 'Hauptstraße 12, 3. OG links\n22767 Hamburg'),
    ).toBe(a);
    const bewerbung = await bewerbungLaden(db, haushalt.id);
    expect(Object.values(bewerbung!.kennungen!)).toEqual([a, b]);
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
    // Leas Farbe 2 wird frei und geht an die nächste neue Person.
    await mitgliedHinzufuegen(db, haushalt.id, {
      vorname: 'Tom',
      nachname: 'Beispiel',
      bezeichnung: 'neutral',
      rolle: 'mitmieter',
      lebenssituation: null,
    });
    expect((await haushaltLaden(db))!.mitglieder.map((m) => m.zugehoerigkeit.farbe)).toEqual([
      1, 3, 2,
    ]);
    await mitgliedZurueckholen(db, lea.zugehoerigkeit.id);
    const ansicht = (await haushaltLaden(db))!;
    expect(ansicht.herausgenommen).toEqual([]);
    expect(ansicht.mitglieder.map((m) => [m.person.vorname, m.zugehoerigkeit.farbe])).toEqual([
      ['Max', 1],
      ['Petra', 3],
      ['Tom', 2],
      ['Lea', 4],
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
    const erste = await bewerbungSpeichern(db, haushalt.id, { adresse: 'Hauptstraße 12' });
    // Zeitstempel in Millisekunden: zwei Schritte im selben Moment wären gleich alt.
    const warten = () => new Promise((ok) => setTimeout(ok, 5));
    await warten();
    const zweite = await bewerbungAnlegen(db, haushalt.id, {
      adresse: 'Elbchaussee 1',
      miete: { kalt: 1200, warm: 1450 },
      status: 'entwurf',
    });
    expect((await bewerbungenLaden(db, haushalt.id)).map((b) => b.adresse)).toEqual([
      'Elbchaussee 1',
      'Hauptstraße 12',
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
          rolle: 'hauptmieter',
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
          rolle: 'hauptmieter',
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
