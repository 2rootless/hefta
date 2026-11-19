import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { neueId, type Heft } from '../domain/modell';
import { datenbankOeffnen } from './db';
import { sicherungEinspielen, sicherungErstellen } from './sicherung';
import { heftAendern, heftAnlegen } from './speicher';

// PC120 (§7, 4): Der gespeicherte Link eines Hefts hat keine Zählmarken, auch nach dem Einspielen eines
// Backups. Gegenprobe: Am Heft, das am Speichern vorbei in die Datenbank kam, steht die Zählmarke noch.

const MIT =
  'https://www.immobilienscout24.de/expose/000000123?referrer=RESULT_LIST_LISTING&utm_source=x';
const OHNE = 'https://www.immobilienscout24.de/expose/000000123';
const ZAEHLMARKE = /[?&](utm_|referrer|fbclid|gclid)/i;

const entwurf = {
  haushaltId: null,
  adresse: 'Lindenring 3, Erdgeschoss\n20259 Hamburg',
  link: MIT,
  quelle: 'ImmoScout24',
  inseratText: null,
  angaben: undefined,
};

describe('Zählmarken im gespeicherten Link', () => {
  it('fallen beim Anlegen und beim Ändern weg', async () => {
    const db = await datenbankOeffnen(`test-${neueId()}`);
    const heft = await heftAnlegen(db, entwurf);
    expect((await db.get('hefte', heft.id))?.link).toBe(OHNE);
    await heftAendern(db, heft.id, { link: 'https://example.com/w?id=7&fbclid=AbC&gclid=1' });
    expect((await db.get('hefte', heft.id))?.link).toBe('https://example.com/w?id=7');
    await heftAendern(db, heft.id, { link: null });
    expect((await db.get('hefte', heft.id))?.link).toBeNull();
    await heftAendern(db, heft.id, { notiz: 'ohne Link-Änderung' });
    expect((await db.get('hefte', heft.id))?.link).toBeNull();
  });

  it('fallen beim Einspielen eines Backups weg; Gegenprobe: vorher stehen sie im Bestand', async () => {
    const quelle = await datenbankOeffnen(`test-${neueId()}`);
    const roh: Heft = { ...(await heftAnlegen(quelle, entwurf)), link: MIT };
    await quelle.put('hefte', roh);
    expect(ZAEHLMARKE.test((await quelle.get('hefte', roh.id))?.link ?? '')).toBe(true);

    const datei = await sicherungErstellen(quelle, undefined, '', 1000);
    for (const art of ['ersetzen', 'hinzufuegen'] as const) {
      const ziel = await datenbankOeffnen(`test-${neueId()}`);
      await sicherungEinspielen(ziel, datei, undefined, { art });
      const link = (await ziel.get('hefte', roh.id))?.link ?? '';
      expect(link).toBe(OHNE);
      expect(ZAEHLMARKE.test(link)).toBe(false);
    }
  });
});
