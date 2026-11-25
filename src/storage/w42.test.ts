import 'fake-indexeddb/auto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { neueId } from '../domain/modell';
import { backupLesen } from './backup';
import { SCHEMA_VERSION, datenbankOeffnen, datenMigrieren, schema4 } from './db';
import { sicherungEinspielen, sicherungErstellen } from './sicherung';
import {
  haushaltAnlegen,
  haushaltLaden,
  mitgliedZiehtMitEin,
  mitgliedZurueckholen,
  rolleWechseln,
} from './speicher';

// W42 (DP93, DP94, CP88) mit W57 (PC198, E363, E366): Rolle direkt wählen. „Zieht nur mit ein“, die Ansprechperson
// statt der hauptmietenden Person, und Schema 4, damit 2.1 ein Backup mit den neuen Rollen sauber ablehnt.

const neueDb = () => datenbankOeffnen(`w42-${neueId()}`);
const entwurf = (vorname: string, rolle: 'vertrag' | 'buerge') => ({
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
      entwurf('Max', 'vertrag'),
      entwurf('Lea', 'vertrag'),
      entwurf('Aylin', 'vertrag'),
      entwurf('Petra', 'buerge'),
    ],
  });
  const ansicht = (await haushaltLaden(db))!;
  const zug = (v: string) => ansicht.mitglieder.find((m) => m.person.vorname === v)!.zugehoerigkeit;
  return { db, zug };
}
const stand = async (db: Awaited<ReturnType<typeof neueDb>>) => {
  const a = (await haushaltLaden(db))!;
  const an = a.mitglieder.find((m) => m.person.id === a.haushalt.ansprechpersonId);
  return {
    vertrag: a.mitglieder
      .filter((m) => m.zugehoerigkeit.rolle === 'vertrag')
      .map((m) => m.person.vorname),
    buergen: a.mitglieder
      .filter((m) => m.zugehoerigkeit.rolle === 'buerge')
      .map((m) => m.person.vorname),
    ansprech: an?.person.vorname ?? null,
    weitere: a.haushalt.weitereErwachsene,
  };
};

describe('W42 mit W57: Wechsel, Ansprechperson und „Zieht nur mit ein“', () => {
  it('Max wird Bürge: Lea wird ohne Frage Ansprechperson (E366, früher Fall 2)', async () => {
    const { db, zug } = await haushalt();
    await rolleWechseln(db, zug('Max').id, 'buerge');
    expect(await stand(db)).toEqual({
      vertrag: ['Lea', 'Aylin'],
      buergen: ['Max', 'Petra'],
      ansprech: 'Lea',
      weitere: 0,
    });
  });

  it('Fall 4: erst kommt die Bürgin in den Vertrag, dann wird Max Bürge; nie ein leerer Vertrag', async () => {
    const db = await neueDb();
    await haushaltAnlegen(db, {
      kinder: 0,
      weitereErwachsene: 0,
      personen: [entwurf('Max', 'vertrag'), entwurf('Petra', 'buerge')],
    });
    const a = (await haushaltLaden(db))!;
    const z = (v: string) => a.mitglieder.find((m) => m.person.vorname === v)!.zugehoerigkeit;
    await rolleWechseln(db, z('Petra').id, 'vertrag');
    // Zwischenstand: beide im Vertrag, Max bleibt Ansprechperson.
    expect(await stand(db)).toMatchObject({ vertrag: ['Max', 'Petra'], ansprech: 'Max' });
    await rolleWechseln(db, z('Max').id, 'buerge');
    expect(await stand(db)).toEqual({
      vertrag: ['Petra'],
      buergen: ['Max'],
      ansprech: 'Petra',
      weitere: 0,
    });
  });

  it('Fall 7: Lea zieht nur mit ein: nicht im Vertrag, zählt unter „Weitere Erwachsene“; zurückgeholt zählt sie dort nicht mehr', async () => {
    const { db, zug } = await haushalt();
    await mitgliedZiehtMitEin(db, zug('Lea').id);
    expect(await stand(db)).toEqual({
      vertrag: ['Max', 'Aylin'],
      buergen: ['Petra'],
      ansprech: 'Max',
      weitere: 1,
    });
    const a = (await haushaltLaden(db))!;
    expect(a.herausgenommen.map((m) => [m.person.vorname, m.zugehoerigkeit.ziehtMitEin])).toEqual([
      ['Lea', true],
    ]);
    await mitgliedZurueckholen(db, zug('Lea').id, { rolle: 'vertrag' });
    expect(await stand(db)).toEqual({
      vertrag: ['Max', 'Aylin', 'Lea'],
      buergen: ['Petra'],
      ansprech: 'Max',
      weitere: 0,
    });
  });

  it('Fall 7, die Ansprechperson zieht nur mit ein: die nächste im Vertrag wird es', async () => {
    const { db, zug } = await haushalt();
    await mitgliedZiehtMitEin(db, zug('Max').id);
    expect(await stand(db)).toMatchObject({ vertrag: ['Lea', 'Aylin'], ansprech: 'Lea' });
  });
});

describe('W57: Schema 4 und 2.1 (PC198)', () => {
  it('Schema 4; ein Backup aus 2.1 (schema3-offen.hefta) kommt mit „vertrag“ und Ansprechperson zurück, nichts fehlt', async () => {
    expect(SCHEMA_VERSION).toBe(4);
    const db = await neueDb();
    await sicherungEinspielen(
      db,
      new Blob([readFileSync('tests/fixtures/backup/schema3-offen.hefta')]),
    );
    const a = (await haushaltLaden(db))!;
    expect(a.herausgenommen.filter((m) => m.zugehoerigkeit.ziehtMitEin)).toHaveLength(1);
    expect(a.haushalt.weitereErwachsene).toBeGreaterThan(0);
    const roh = await db.getAll('zugehoerigkeiten');
    expect(new Set(roh.map((z) => z.rolle))).toEqual(new Set(['vertrag', 'buerge']));
    const gespeichert = (await db.get('haushalte', a.haushalt.id))!.ansprechpersonId;
    expect(gespeichert).toBeTruthy();
    expect(a.mitglieder[0]!.person.id).toBe(gespeichert);
  });

  it('Übernahme: die hauptmietende Person wird Ansprechperson, auch wenn sie nicht zuerst steht; nichts wird gelöscht', () => {
    const z = (id: string, personId: string, rolle: string, reihenfolge: number) => ({
      id,
      haushaltId: 'h',
      personId,
      rolle,
      reihenfolge,
      herausgenommenAm: null,
    });
    const daten = {
      haushalte: [{ id: 'h' }, { id: 'leer' }],
      zugehoerigkeiten: [
        z('1', 'max', 'mitmieter', 0),
        z('2', 'lea', 'hauptmieter', 1),
        z('3', 'petra', 'buerge', 2),
      ],
      personen: [{ id: 'max' }, { id: 'lea' }, { id: 'petra' }],
    };
    const neu = schema4(daten as never);
    expect((neu.haushalte as { ansprechpersonId?: string }[])[0]!.ansprechpersonId).toBe('lea');
    expect((neu.haushalte as { ansprechpersonId?: string }[])[1]!.ansprechpersonId).toBeUndefined();
    expect((neu.zugehoerigkeiten as { rolle: string }[]).map((x) => x.rolle)).toEqual([
      'vertrag',
      'vertrag',
      'buerge',
    ]);
    expect(neu.personen).toEqual(daten.personen);
    expect(neu.zugehoerigkeiten).toHaveLength(3);
    // Gegenprobe: ohne Übernahme bliebe „hauptmieter“ stehen.
    expect(datenMigrieren(daten as never, 4).zugehoerigkeiten).toEqual(daten.zugehoerigkeiten);
    // Ohne hauptmietende Person (2.0 nahm sie heraus): die erste im Vertrag.
    const ohne = schema4({
      ...daten,
      zugehoerigkeiten: [z('1', 'max', 'mitmieter', 0), z('3', 'petra', 'buerge', 1)],
    } as never);
    expect((ohne.haushalte as { ansprechpersonId?: string }[])[0]!.ansprechpersonId).toBe('max');
  });

  it('die Datenbank: beim Öffnen aus Schema 3 werden die Rollen übernommen', async () => {
    const name = `w57-${neueId()}`;
    const alt = await datenbankOeffnen(name, 3);
    const zeit = new Date().toISOString();
    await alt.put('haushalte', {
      id: 'h',
      createdAt: zeit,
      updatedAt: zeit,
      name: '',
      notiz: '',
      kinder: 0,
      weitereErwachsene: 0,
    });
    for (const [i, [pid, rolle]] of [
      ['max', 'hauptmieter'],
      ['lea', 'mitmieter'],
    ].entries())
      await alt.put('zugehoerigkeiten', {
        id: `z${i}`,
        createdAt: zeit,
        updatedAt: zeit,
        haushaltId: 'h',
        personId: pid!,
        rolle: rolle as never,
        bezeichnung: 'neutral',
        farbe: i + 1,
        reihenfolge: i,
        herausgenommenAm: null,
      });
    alt.close();
    const db = await datenbankOeffnen(name);
    expect(db.version).toBe(4);
    expect((await db.getAll('zugehoerigkeiten')).map((z) => z.rolle)).toEqual([
      'vertrag',
      'vertrag',
    ]);
    expect((await db.get('haushalte', 'h'))!.ansprechpersonId).toBe('max');
  });

  it('2.1 lehnt ein Backup mit Schema 4 ab, bevor es schreibt; Gegenprobe: mit der Nummer von 2.1 käme es durch', async () => {
    // Der Lesecode von 2.1, wie er eingereicht ist (Bau 176). Die Dateien liegen fest in tests/fixtures/stand-2-1,
    // damit der Test auch im öffentlichen Repository läuft, das den Commit nicht hat.
    const db21 = readFileSync('tests/fixtures/stand-2-1/db.ts.txt', 'utf8');
    const sicherung21 = readFileSync('tests/fixtures/stand-2-1/sicherung.ts.txt', 'utf8');
    try {
      expect(db21).toBe(
        execFileSync('git', ['show', 'b3709791:src/storage/db.ts'], { encoding: 'utf8' }),
      );
    } catch (e) {
      if (!/invalid object name|bad revision|unknown revision|not a valid object/i.test(String(e)))
        throw e;
    }
    const schema21 = (
      db21
        .split('const MIGRATIONEN')[1]!
        .split('export const SCHEMA_VERSION')[0]!
        .match(/^ {2}\((?:db|\)|db, tx)/gm) ?? []
    ).length;
    expect(schema21).toBe(3);
    expect(sicherung21).toMatch(/schemaVersion > SCHEMA_VERSION[\s\S]{0,80}version_neu/);
    const db = await neueDb();
    await haushaltAnlegen(db, {
      kinder: 0,
      weitereErwachsene: 0,
      personen: [entwurf('Max', 'vertrag')],
    });
    const backup = await sicherungErstellen(db, undefined, '2.2.0');
    let manifest = { schemaVersion: 0 };
    await backupLesen(backup, undefined, async (e) => {
      if (e.pfad === 'manifest.json')
        manifest = JSON.parse(await e.daten.text()) as typeof manifest;
    });
    const lehntAb = (v: number) => v > schema21;
    expect(manifest.schemaVersion).toBe(4);
    expect(lehntAb(manifest.schemaVersion)).toBe(true);
    // Gegenprobe: Hätte W57 die Nummer nicht angehoben, ließe 2.1 es durch.
    expect(lehntAb(3)).toBe(false);
  });
});
