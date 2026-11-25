import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { neueId } from '../domain/modell';
import { datenbankOeffnen, type HeftaDb } from './db';
import { sicherungEinspielen, sicherungErstellen } from './sicherung';
import { haushaltAnlegen, haushaltLaden, personAendern } from './speicher';

// DP74 C3 (PC109, F7): Der Merker „hat keinen Nachnamen“ geht ins Backup und kommt beim Einspielen zurück.
// Gegenprobe: ein Backup ohne Merker bringt keinen mit.

const neueDb = (): Promise<HeftaDb> => datenbankOeffnen(`ohne-nachname-${neueId()}`);

async function haushaltMitAylin(db: HeftaDb, ohneNachname: boolean) {
  await haushaltAnlegen(db, {
    kinder: 0,
    weitereErwachsene: 0,
    personen: [
      {
        vorname: 'Aylin',
        nachname: '',
        bezeichnung: 'weiblich',
        rolle: 'vertrag',
        lebenssituation: 'angestellt',
      },
    ],
  });
  const aylin = (await haushaltLaden(db))!.mitglieder[0]!.person;
  if (ohneNachname) await personAendern(db, aylin.id, { ohneNachname: true });
  return aylin.id;
}

describe('DP74 C3: Merker im Backup', () => {
  for (const passwort of [undefined, 'Hefta-Test-C3']) {
    it(`hin und zurück${passwort ? ', mit Passwort' : ''}: der Merker kommt mit`, async () => {
      const quelle = await neueDb();
      const id = await haushaltMitAylin(quelle, true);
      const datei = await sicherungErstellen(quelle, passwort);
      const ziel = await neueDb();
      await sicherungEinspielen(ziel, datei, passwort);
      const p = await ziel.get('personen', id);
      expect([p?.vorname, p?.nachname, p?.ohneNachname]).toEqual(['Aylin', '', true]);
    });
  }

  it('Gegenprobe: ein Backup ohne Merker bringt keinen mit', async () => {
    const quelle = await neueDb();
    const id = await haushaltMitAylin(quelle, false);
    const ziel = await neueDb();
    await sicherungEinspielen(ziel, await sicherungErstellen(quelle));
    expect((await ziel.get('personen', id))?.ohneNachname).toBeFalsy();
  });
});
