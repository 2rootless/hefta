import 'fake-indexeddb/auto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { neueId } from '../domain/modell';
import { backupLesen } from './backup';
import { SCHEMA_VERSION, datenbankOeffnen } from './db';
import { sicherungEinspielen, sicherungErstellen } from './sicherung';
import {
  haushaltAnlegen,
  haushaltLaden,
  hauptmieterSetzen,
  mitgliedZiehtMitEin,
  mitgliedZurueckholen,
  rolleWechseln,
} from './speicher';

// W42 (DP93, DP94, CP88): Rolle direkt wählen. Speicherseite: Nachfolge vorn im Vertrag, „Zieht nur mit ein“, und
// Schema 3, damit 2.0.1 ein Backup aus 2.1 sauber ablehnt.

const neueDb = () => datenbankOeffnen(`w42-${neueId()}`);
const entwurf = (vorname: string, rolle: 'hauptmieter' | 'mitmieter' | 'buerge') => ({
  vorname,
  nachname: 'Test',
  bezeichnung: 'neutral' as const,
  rolle,
  lebenssituation: 'angestellt' as const,
});

async function haushalt() {
  const db = await neueDb();
  await haushaltAnlegen(db, {
    kinder: 1,
    weitereErwachsene: 0,
    personen: [
      entwurf('Max', 'hauptmieter'),
      entwurf('Lea', 'mitmieter'),
      entwurf('Aylin', 'mitmieter'),
      entwurf('Petra', 'buerge'),
    ],
  });
  const ansicht = (await haushaltLaden(db))!;
  const zug = (v: string) => ansicht.mitglieder.find((m) => m.person.vorname === v)!.zugehoerigkeit;
  return { db, zug };
}
const stand = async (db: Awaited<ReturnType<typeof neueDb>>) => {
  const a = (await haushaltLaden(db))!;
  return {
    vertrag: a.mitglieder
      .filter((m) => m.zugehoerigkeit.rolle !== 'buerge')
      .sort((x, y) => x.zugehoerigkeit.reihenfolge - y.zugehoerigkeit.reihenfolge)
      .map((m) => `${m.person.vorname}:${m.zugehoerigkeit.rolle}`),
    buergen: a.mitglieder
      .filter((m) => m.zugehoerigkeit.rolle === 'buerge')
      .map((m) => m.person.vorname),
    weitere: a.haushalt.weitereErwachsene,
  };
};

describe('W42: Nachfolge und „Zieht nur mit ein“', () => {
  it('Fall 2: Aylin wird gewählt, steht vorn; Max wird danach Bürge; Lea bleibt Mitmieterin', async () => {
    const { db, zug } = await haushalt();
    await hauptmieterSetzen(db, zug('Aylin').id);
    await rolleWechseln(db, zug('Max').id, 'buerge');
    expect(await stand(db)).toEqual({
      vertrag: ['Aylin:hauptmieter', 'Lea:mitmieter'],
      buergen: ['Max', 'Petra'],
      weitere: 0,
    });
  });

  it('Fall 4: die Bürgin rückt nach, erst die Nachfolge, dann der Wechsel; nie ein leerer Vertrag', async () => {
    const db = await neueDb();
    await haushaltAnlegen(db, {
      kinder: 0,
      weitereErwachsene: 0,
      personen: [entwurf('Max', 'hauptmieter'), entwurf('Petra', 'buerge')],
    });
    const a = (await haushaltLaden(db))!;
    const z = (v: string) => a.mitglieder.find((m) => m.person.vorname === v)!.zugehoerigkeit;
    await hauptmieterSetzen(db, z('Petra').id);
    // Zwischenstand: beide im Vertrag, Petra vorn.
    expect((await stand(db)).vertrag).toEqual(['Petra:hauptmieter', 'Max:mitmieter']);
    await rolleWechseln(db, z('Max').id, 'buerge');
    expect(await stand(db)).toEqual({
      vertrag: ['Petra:hauptmieter'],
      buergen: ['Max'],
      weitere: 0,
    });
  });

  it('Fall 7: Lea zieht nur mit ein: nicht im Vertrag, zählt unter „Weitere Erwachsene“; zurückgeholt zählt sie dort nicht mehr', async () => {
    const { db, zug } = await haushalt();
    await mitgliedZiehtMitEin(db, zug('Lea').id);
    expect(await stand(db)).toEqual({
      vertrag: ['Max:hauptmieter', 'Aylin:mitmieter'],
      buergen: ['Petra'],
      weitere: 1,
    });
    const a = (await haushaltLaden(db))!;
    expect(a.herausgenommen.map((m) => [m.person.vorname, m.zugehoerigkeit.ziehtMitEin])).toEqual([
      ['Lea', true],
    ]);
    await mitgliedZurueckholen(db, zug('Lea').id, { rolle: 'mitmieter' });
    expect(await stand(db)).toEqual({
      vertrag: ['Max:hauptmieter', 'Aylin:mitmieter', 'Lea:mitmieter'],
      buergen: ['Petra'],
      weitere: 0,
    });
  });

  it('Fall 7, Hauptmieter zieht nur mit ein: die nächste im Vertrag rückt nach', async () => {
    const { db, zug } = await haushalt();
    await mitgliedZiehtMitEin(db, zug('Max').id);
    expect((await stand(db)).vertrag).toEqual(['Lea:hauptmieter', 'Aylin:mitmieter']);
  });
});

describe('W42: Schema 3 und 2.0.1 (CP88, F1)', () => {
  it('Schema 3; schema3-offen.hefta kommt mit „Zieht nur mit ein“ zurück', async () => {
    expect(SCHEMA_VERSION).toBe(3);
    const db = await neueDb();
    await sicherungEinspielen(
      db,
      new Blob([readFileSync('tests/fixtures/backup/schema3-offen.hefta')]),
    );
    const a = (await haushaltLaden(db))!;
    expect(a.herausgenommen.filter((m) => m.zugehoerigkeit.ziehtMitEin)).toHaveLength(1);
    expect(a.haushalt.weitereErwachsene).toBeGreaterThan(0);
  });

  it('2.0.1 lehnt ein Backup aus 2.1 ab, bevor es schreibt; Gegenprobe: mit der Nummer von 2.0.1 käme es durch', async () => {
    // Der Lesecode von 2.0.1, wie er im Store ist: Schema = Zahl der Migrationen, und „schemaVersion >
    // SCHEMA_VERSION“ wirft „version_neu“. Die Dateien liegen fest in tests/fixtures/stand-2-0-1 (aus dem Zweig
    // app/2-0-1), damit der Test auch im öffentlichen Repository läuft, das den Zweig nicht hat.
    const db201 = readFileSync('tests/fixtures/stand-2-0-1/db.ts.txt', 'utf8');
    const sicherung201 = readFileSync('tests/fixtures/stand-2-0-1/sicherung.ts.txt', 'utf8');
    // Die Vorlage ist wirklich der Stand von 2.0.1, solange der Zweig hier da ist.
    try {
      expect(db201).toBe(
        execFileSync('git', ['show', 'app/2-0-1:src/storage/db.ts'], { encoding: 'utf8' }),
      );
    } catch (e) {
      if (!String(e).includes('invalid object name')) throw e;
    }
    const schema201 = (
      db201
        .split('const MIGRATIONEN')[1]!
        .split('export const SCHEMA_VERSION')[0]!
        .match(/^ {2}\((?:db|\)|db, tx)/gm) ?? []
    ).length;
    expect(schema201).toBe(2);
    expect(sicherung201).toMatch(/schemaVersion > SCHEMA_VERSION[\s\S]{0,80}version_neu/);
    // Ein frisches Backup aus 2.1
    const db = await neueDb();
    await haushaltAnlegen(db, {
      kinder: 0,
      weitereErwachsene: 0,
      personen: [entwurf('Max', 'hauptmieter')],
    });
    const backup = await sicherungErstellen(db, undefined, '2.1.0');
    let manifest = { schemaVersion: 0 };
    await backupLesen(backup, undefined, async (e) => {
      if (e.pfad === 'manifest.json')
        manifest = JSON.parse(await e.daten.text()) as typeof manifest;
    });
    const lehntAb = (v: number) => v > schema201;
    expect(lehntAb(manifest.schemaVersion)).toBe(true);
    // Gegenprobe: Hätte 2.1 die Nummer nicht angehoben, ließe 2.0.1 es durch.
    expect(lehntAb(2)).toBe(false);
  });
});
