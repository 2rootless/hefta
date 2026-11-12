import 'fake-indexeddb/auto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { neueId } from '../domain/modell';
import { BackupFehler, backupErstellen, backupLesen } from './backup';
import { SCHEMA_VERSION, datenbankOeffnen, type HeftaDb } from './db';
import {
  sicherungEinspielen,
  sicherungErstellen,
  sicherungPruefen,
  sicherungVorschau,
} from './sicherung';
import { dateiLesen, dateiSpeichern, haushaltLaden } from './speicher';

// Backups müssen über alle Versionen hinweg halten. In tests/fixtures/backup liegen echte Backups von
// jedem Stand seit dem Neustart als Hefta. Sie werden nie gelöscht und nie neu erzeugt: Ändert sich das
// Schema, kommt eine neue dazu (schema<N>-offen.hefta), und alle alten müssen sich weiter einspielen lassen.

const ORDNER = 'tests/fixtures/backup';
const PASSWORT = 'gold-passwort';

const lesen = (name: string) => new Blob([readFileSync(`${ORDNER}/${name}`)]);
const neueDb = (): Promise<HeftaDb> => datenbankOeffnen(`gold-${neueId()}`);

/** Enthält alles, woran sich ein suchendes Einlesen verschluckt. */
function fiese(text: string): Uint8Array {
  return new Uint8Array([
    ...new TextEncoder().encode(`%PDF-1.7 ${text} `),
    0x50,
    0x4b,
    0x07,
    0x08,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    0x50,
    0x4b,
    0x03,
    0x04,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0x50,
    0x4b,
    0x01,
    0x02,
    20,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    ...new TextEncoder().encode(` Ende ${text}`),
  ]);
}

async function bytes(db: HeftaDb, id: string): Promise<number[]> {
  const blob = await dateiLesen(db, id);
  return [...new Uint8Array(await blob!.arrayBuffer())];
}

describe('Backups aus jeder bisherigen Version', () => {
  it('für jeden Stand des Schemas liegt eine Datei bereit', () => {
    for (let v = 1; v <= SCHEMA_VERSION; v++) {
      expect(existsSync(`${ORDNER}/schema${v}-offen.hefta`), `schema${v}-offen.hefta fehlt`).toBe(
        true,
      );
    }
  });

  for (const name of readdirSync(ORDNER).filter((n) => n.endsWith('.hefta'))) {
    const passwort = name.includes('passwort') ? PASSWORT : undefined;
    it(`${name} lässt sich prüfen, ansehen und einspielen`, async () => {
      await sicherungPruefen(lesen(name), passwort);
      const vorschau = await sicherungVorschau(lesen(name), passwort);
      expect(vorschau.bestand.personen).toBeGreaterThan(0);
      const db = await neueDb();
      const inhalt = await sicherungEinspielen(db, lesen(name), passwort);
      expect(inhalt.dateien).toBeGreaterThan(0);
      expect(await db.count('dateien')).toBe(inhalt.dateien);
      expect((await haushaltLaden(db))?.mitglieder.length).toBeGreaterThan(0);
      for (const p of await db.getAll('personen')) expect(p.rufname).toBeTruthy();
    });
  }

  for (const [name, passwort] of [
    ['schema1-offen.hefta', undefined],
    ['schema1-passwort.hefta', PASSWORT],
  ] as const) {
    it(`${name}: alles kommt zurück, auch Dateien mit Bytes, die wie ZIP-Marken aussehen`, async () => {
      const vorschau = await sicherungVorschau(lesen(name), passwort);
      expect(vorschau.bestand).toEqual({
        personen: 3,
        kinder: 1,
        weitere: 1,
        unterlagen: 2,
        bewerbungen: 0,
        vertragNamen: ['Max Mustermann', 'Lea Mustermann'],
        buergenNamen: ['Petra Mustermann'],
      });
      const db = await neueDb();
      await sicherungEinspielen(db, lesen(name), passwort);
      const versionen = await db.getAll('versionen');
      expect(versionen.map((v) => v.dateiname).sort()).toEqual([
        'bonitaet.pdf',
        'gehalt-oktober.pdf',
      ]);
      const gehalt = versionen.find((v) => v.dateiname === 'gehalt-oktober.pdf')!;
      const bonitaet = versionen.find((v) => v.dateiname === 'bonitaet.pdf')!;
      expect(await bytes(db, gehalt.original)).toEqual([...fiese('Oktober')]);
      expect(await bytes(db, bonitaet.original)).toEqual([...fiese('Bonitaet')]);
      expect(gehalt.abrechnungsmonat).toBe('2026-10');
      expect(bonitaet.ausstellungsdatum).toBe('2026-10-20');
    });
  }
});

describe('Schema 2 (Hefta 2)', () => {
  it('schema1-offen.hefta: Bewerbungen ohne Adresse werden keine Hefte', async () => {
    const db = await neueDb();
    await sicherungEinspielen(db, lesen('schema1-offen.hefta'));
    expect(await db.count('hefte')).toBe(0);
  });

  it('schema2-offen.hefta: Hefte mit und ohne Haushalt kommen zurück', async () => {
    const db = await neueDb();
    await sicherungEinspielen(db, lesen('schema2-offen.hefta'));
    const hefte = (await db.getAll('hefte')).sort((a, b) => a.id.localeCompare(b.id));
    expect(hefte.map((h) => [h.id, h.haushaltId === null, h.kennung])).toEqual([
      ['heft-mit', false, 'kennung-heft-mit'],
      ['heft-ohne', true, 'kennung-heft-ohne'],
    ]);
    expect(await db.count('bewerbungen')).toBe(1);
  });
});

describe('Neues Backup', () => {
  for (const passwort of [undefined, 'Sommer in Hamburg']) {
    const art = passwort ? 'mit' : 'ohne';
    it(`Dateien mit ZIP-Marken im Inhalt kommen unverändert zurück (${art} Passwort)`, async () => {
      const inhalt = fiese('Marken');
      const datei = await backupErstellen(
        [
          { pfad: 'manifest.json', daten: new Blob(['{}']) },
          { pfad: 'dateien/a', daten: new Blob([inhalt as Uint8Array<ArrayBuffer>]) },
          { pfad: 'dateien/leer', daten: new Blob([]) },
        ],
        passwort,
        1000,
      );
      const gelesen = new Map<string, number[]>();
      await backupLesen(datei, passwort, async ({ pfad, daten }) => {
        gelesen.set(pfad, [...new Uint8Array(await daten.arrayBuffer())]);
      });
      expect(gelesen.get('dateien/a')).toEqual([...inhalt]);
      expect(gelesen.get('dateien/leer')).toEqual([]);
    });
  }

  async function grund(versprechen: Promise<unknown>) {
    const e = await versprechen.then(
      () => null,
      (x: unknown) => x,
    );
    return e instanceof BackupFehler ? e.grund : e;
  }

  it('ein verändertes Byte fällt auch ohne Passwort auf (Prüfsumme je Datei)', async () => {
    const inhalt = new Uint8Array(4000).fill(7);
    const datei = await backupErstellen([{ pfad: 'dateien/a', daten: new Blob([inhalt]) }]);
    const roh = new Uint8Array(await datei.arrayBuffer());
    roh[2000] = 8;
    const lesen = backupLesen(new Blob([roh]), undefined, async () => {});
    expect(await grund(lesen)).toBe('beschaedigt');
  });

  it('eine abgeschnittene Datei fällt auch ohne Passwort auf', async () => {
    const datei = await backupErstellen([
      { pfad: 'dateien/a', daten: new Blob([new Uint8Array(4000)]) },
    ]);
    const lesen = backupLesen(datei.slice(0, 3000), undefined, async () => {});
    expect(await grund(lesen)).toBe('beschaedigt');
  });

  it('prüft ein frisches Backup und lehnt ein defektes ab, ohne den Bestand anzufassen', async () => {
    const db = await neueDb();
    await dateiSpeichern(db, new Blob([new Uint8Array(3000).fill(1)]), 'x');
    const datei = await sicherungErstellen(db, undefined, '', 1000);
    await sicherungPruefen(datei);
    const roh = new Uint8Array(await datei.arrayBuffer());
    roh[roh.length - 1500] = (roh[roh.length - 1500] ?? 0) ^ 0xff;
    expect(await grund(sicherungPruefen(new Blob([roh])))).toBe('beschaedigt');
    const ziel = await neueDb();
    await dateiSpeichern(ziel, new Blob(['alt']), 'alt');
    expect(await grund(sicherungEinspielen(ziel, new Blob([roh])))).toBe('beschaedigt');
    expect(await ziel.getAllKeys('dateien')).toEqual(['alt']);
  });
});
