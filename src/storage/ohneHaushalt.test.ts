import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { neueId } from '../domain/modell';
import { VERGABE } from '../domain/personenfarben';
import { datenbankOeffnen, type HeftaDb } from './db';
import { sammelplaetzeVereinen, teilbestand } from './haushalte';
import {
  ohneHaushaltAnlegen,
  ohneHaushaltLaden,
  ohneHaushaltUebernehmen,
  sammelplatz,
  vorrang,
} from './ohneHaushalt';
import { bestandAusDb, sicherungEinspielen, sicherungErstellen } from './sicherung';
import {
  haushaltAendern,
  haushaltAnlegen,
  haushaltLaden,
  personAendern,
  personGanzLoeschen,
} from './speicher';

// PC213/PC214 (E385, Weg A): Personen ohne Haushalt auf dem verborgenen Sammelplatz. Namen aus der Namensliste (W40).

const neueDb = (): Promise<HeftaDb> => datenbankOeffnen(`test-${neueId()}`);

async function haushaltA(db: HeftaDb) {
  return haushaltAnlegen(db, {
    kinder: 1,
    weitereErwachsene: 0,
    personen: [
      {
        vorname: 'Jarne',
        nachname: 'Ostendorp',
        bezeichnung: 'neutral',
        rolle: 'vertrag',
        lebenssituation: 'angestellt',
      },
    ],
  });
}

async function zwei(db: HeftaDb) {
  const selin = await ohneHaushaltAnlegen(db, {
    vorname: 'Selin',
    nachname: 'Akgül',
    rolle: 'vertrag',
  });
  const hiltrud = await ohneHaushaltAnlegen(db, {
    vorname: 'Hiltrud',
    nachname: 'Ostendorp',
    rolle: 'buerge',
  });
  return { selin, hiltrud };
}

describe('Personen ohne Haushalt (PC214, Weg A)', () => {
  it('Anlegen: ein Sammelplatz, Farben in der Reihe der App; er ist nie der gewählte oder erste Haushalt', async () => {
    const db = await neueDb();
    await zwei(db);
    const ohne = (await ohneHaushaltLaden(db))!;
    expect(ohne.mitglieder.map((m) => m.person.vorname)).toEqual(['Selin', 'Hiltrud']);
    expect(ohne.mitglieder.map((m) => m.zugehoerigkeit.farbe)).toEqual(VERGABE.slice(0, 2));
    expect((await db.getAll('haushalte')).filter((h) => h.ohneHaushalt)).toHaveLength(1);
    // Gegenprobe: haushaltLaden findet ihn nicht, auch nicht mit seiner ID.
    expect(await haushaltLaden(db)).toBeNull();
    expect(await haushaltLaden(db, (await sammelplatz(db))!.id)).toBeNull();
    const a = await haushaltA(db);
    expect((await haushaltLaden(db, (await sammelplatz(db))!.id))!.haushalt.id).toBe(a.id);
    // Farben: Jarne bekommt keine, die ohne Haushalt schon vergeben ist.
    const jarne = (await haushaltLaden(db))!.mitglieder[0]!;
    expect(VERGABE.slice(0, 2)).not.toContain(jarne.zugehoerigkeit.farbe);
  });

  it('Leer gibt es ihn nicht sichtbar', async () => {
    const db = await neueDb();
    expect(await ohneHaushaltLaden(db)).toBeNull();
    const id = await ohneHaushaltAnlegen(db, {
      vorname: 'Selin',
      nachname: 'Akgül',
      rolle: 'vertrag',
    });
    expect(await ohneHaushaltLaden(db)).not.toBeNull();
    await personGanzLoeschen(db, id);
    expect(await ohneHaushaltLaden(db)).toBeNull();
  });

  it('In einen neuen Haushalt: Angaben, Farbe und Rollen gehen mit, nichts liegt doppelt, die Erste im Vertrag ist Ansprechperson', async () => {
    const db = await neueDb();
    const { selin, hiltrud } = await zwei(db);
    await personAendern(db, selin, { beruf: 'Bauingenieurin' });
    const s = (await sammelplatz(db))!;
    await haushaltAendern(db, s.id, {
      kinder: 1,
      haustiere: 'nein',
      ort: 'Lüneburg',
      wbsAngabe: 'ja',
    });
    const farbenVorher = (await ohneHaushaltLaden(db))!.mitglieder.map(
      (m) => m.zugehoerigkeit.farbe,
    );
    const r = (await ohneHaushaltUebernehmen(
      db,
      { art: 'neu' },
      { [selin]: { fach: 'vertrag' }, [hiltrud]: { fach: 'buerge' } },
    ))!;
    const a = (await haushaltLaden(db, r.haushaltId))!;
    expect(a.mitglieder.map((m) => [m.person.vorname, m.zugehoerigkeit.rolle])).toEqual([
      ['Selin', 'vertrag'],
      ['Hiltrud', 'buerge'],
    ]);
    expect(a.mitglieder.map((m) => m.zugehoerigkeit.farbe)).toEqual(farbenVorher);
    expect(a.mitglieder[0]!.person.beruf).toBe('Bauingenieurin');
    expect(a.haushalt).toMatchObject({
      kinder: 1,
      haustiere: 'nein',
      ort: 'Lüneburg',
      wbsAngabe: 'ja',
    });
    expect(a.haushalt.ansprechpersonId).toBe(selin);
    expect(r.ansprech).toBe(selin);
    expect(await sammelplatz(db)).toBeNull();
    expect((await db.getAll('personen')).length).toBe(2);
    // Zweimal übernehmen: Beim zweiten Mal gibt es nichts mehr, nichts ändert sich.
    expect(await ohneHaushaltUebernehmen(db, { art: 'neu' }, {})).toBeNull();
    expect((await db.getAll('haushalte')).length).toBe(1);
  });

  it('In einen bestehenden Haushalt: Rolle je Person, Ansprechperson bleibt, „Zieht mit ein“ zählt, freie Farbe bei Doppel', async () => {
    const db = await neueDb();
    const a = await haushaltA(db);
    const jarne = (await haushaltLaden(db, a.id))!.mitglieder[0]!;
    const { selin, hiltrud } = await zwei(db);
    // Eine doppelte Farbe erzwingen (wie nach einem Einspielen).
    const z = (await db.getAll('zugehoerigkeiten')).find((x) => x.personId === selin)!;
    await db.put('zugehoerigkeiten', { ...z, farbe: jarne.zugehoerigkeit.farbe });
    const r = (await ohneHaushaltUebernehmen(
      db,
      { art: 'bestehend', haushaltId: a.id },
      { [selin]: { fach: 'nurmit' }, [hiltrud]: { fach: 'vertrag' } },
    ))!;
    expect(r.ansprech).toBeNull();
    const nach = (await haushaltLaden(db, a.id))!;
    expect(nach.haushalt.ansprechpersonId).toBe(jarne.person.id);
    expect(nach.haushalt.weitereErwachsene).toBe(1);
    expect(
      nach.herausgenommen.map((m) => [m.person.vorname, m.zugehoerigkeit.ziehtMitEin]),
    ).toEqual([['Selin', true]]);
    expect(nach.mitglieder.map((m) => m.person.vorname)).toEqual(['Jarne', 'Hiltrud']);
    const farben = [...nach.mitglieder, ...nach.herausgenommen].map((m) => m.zugehoerigkeit.farbe);
    expect(new Set(farben).size).toBe(farben.length);
  });

  it('Ohne Ansprechperson im Haushalt wird die Erste im Vertrag es (E366); Gegenprobe: mit Bürgschaft allein nicht', async () => {
    const db = await neueDb();
    const leer = await haushaltAnlegen(db, { kinder: 0, weitereErwachsene: 0, personen: [] });
    const { selin, hiltrud } = await zwei(db);
    const r = (await ohneHaushaltUebernehmen(
      db,
      { art: 'bestehend', haushaltId: leer.id },
      { [selin]: { fach: 'vertrag' }, [hiltrud]: { fach: 'buerge' } },
    ))!;
    expect(r.ansprech).toBe(selin);
    const db2 = await neueDb();
    const leer2 = await haushaltAnlegen(db2, { kinder: 0, weitereErwachsene: 0, personen: [] });
    const h = await ohneHaushaltAnlegen(db2, {
      vorname: 'Hiltrud',
      nachname: 'Ostendorp',
      rolle: 'buerge',
    });
    const r2 = (await ohneHaushaltUebernehmen(
      db2,
      { art: 'bestehend', haushaltId: leer2.id },
      { [h]: { fach: 'buerge' } },
    ))!;
    expect(r2.ansprech).toBeNull();
  });

  it('Dieselbe Person: Angaben gehen an die bestehende, die Person ohne Haushalt entfällt; Gegenprobe „Nein“: zwei', async () => {
    const db = await neueDb();
    const a = await haushaltA(db);
    const jarne = (await haushaltLaden(db, a.id))!.mitglieder[0]!.person;
    const lose = await ohneHaushaltAnlegen(db, {
      vorname: 'Jarne',
      nachname: 'Ostendorp',
      rolle: 'vertrag',
    });
    await personAendern(db, lose, { beruf: 'Logistikplaner' });
    await ohneHaushaltUebernehmen(
      db,
      { art: 'bestehend', haushaltId: a.id },
      { [lose]: { fach: 'vertrag', dieselbe: jarne.id } },
    );
    const nach = (await haushaltLaden(db, a.id))!;
    expect(nach.mitglieder.map((m) => [m.person.id, m.person.beruf])).toEqual([
      [jarne.id, 'Logistikplaner'],
    ]);
    expect(await db.get('personen', lose)).toBeUndefined();
    // Gegenprobe: „Nein, neue Person“ legt eine zweite an.
    const db2 = await neueDb();
    const a2 = await haushaltA(db2);
    const lose2 = await ohneHaushaltAnlegen(db2, {
      vorname: 'Jarne',
      nachname: 'Ostendorp',
      rolle: 'vertrag',
    });
    await ohneHaushaltUebernehmen(
      db2,
      { art: 'bestehend', haushaltId: a2.id },
      { [lose2]: { fach: 'vertrag' } },
    );
    expect((await haushaltLaden(db2, a2.id))!.mitglieder).toHaveLength(2);
  });

  it('E-Vorrang: Antworten des Haushalts bleiben, fehlende kommen dazu; vorrang() nennt die abweichenden', async () => {
    const db = await neueDb();
    const a = await haushaltA(db);
    await haushaltAendern(db, a.id, { haustiere: 'ja', haustiereText: 'Katze' });
    const { selin } = await zwei(db);
    const s = (await sammelplatz(db))!;
    await haushaltAendern(db, s.id, { haustiere: 'nein', ort: 'Lüneburg' });
    expect(vorrang((await db.get('haushalte', a.id))!, (await db.get('haushalte', s.id))!)).toEqual(
      ['haustiere'],
    );
    await ohneHaushaltUebernehmen(
      db,
      { art: 'bestehend', haushaltId: a.id },
      { [selin]: { fach: 'vertrag' } },
    );
    expect((await db.get('haushalte', a.id))!).toMatchObject({
      haustiere: 'ja',
      haustiereText: 'Katze',
      ort: 'Lüneburg',
    });
  });

  it('Backup: Personen ohne Haushalt gehen mit und zählen eigens; je Haushalt nie; „hinzufügen“ vereint zwei Sammelplätze', async () => {
    const quelle = await neueDb();
    await haushaltA(quelle);
    await zwei(quelle);
    const b = await bestandAusDb(quelle);
    expect(b.vertragNamen).toEqual(['Jarne Ostendorp']);
    expect(b.buergenNamen).toEqual([]);
    expect(b.ohneNamen).toEqual(['Selin Akgül', 'Hiltrud Ostendorp']);
    expect(b.kinder).toBe(1);
    const datei = await sicherungErstellen(quelle, undefined, '', 1000);
    const ziel = await neueDb();
    await ohneHaushaltAnlegen(ziel, {
      vorname: 'Konstantin',
      nachname: 'Meyer-Ellerbrock',
      rolle: 'vertrag',
    });
    await sicherungEinspielen(ziel, datei, undefined, { art: 'hinzufuegen' });
    expect((await ziel.getAll('haushalte')).filter((h) => h.ohneHaushalt)).toHaveLength(1);
    const ohne = (await ohneHaushaltLaden(ziel))!;
    expect(ohne.mitglieder.map((m) => m.person.vorname).sort()).toEqual([
      'Hiltrud',
      'Konstantin',
      'Selin',
    ]);
    const farben = ohne.mitglieder.map((m) => m.zugehoerigkeit.farbe);
    expect(new Set(farben).size).toBe(3);
    // „ersetzen“ nimmt sie mit; ein Backup ohne Personen ohne Haushalt hat keinen Sammelplatz.
    const leer = await neueDb();
    await haushaltA(leer);
    const ohneDatei = await sicherungErstellen(leer, undefined, '', 1000);
    await sicherungEinspielen(ziel, ohneDatei);
    expect(await sammelplatz(ziel)).toBeNull();
    // Backup je Haushalt: der Sammelplatz und seine Personen sind nicht darin.
    const daten: Record<string, unknown[]> = {};
    for (const ort of [
      'haushalte',
      'zugehoerigkeiten',
      'personen',
      'dokumente',
      'versionen',
      'bewerbungen',
      'hefte',
    ] as const)
      daten[ort] = await quelle.getAll(ort);
    const jarneHaushalt = (await haushaltLaden(quelle))!.haushalt.id;
    const teil = teilbestand(daten, jarneHaushalt);
    expect((teil.daten.personen as { vorname: string }[]).map((p) => p.vorname)).toEqual(['Jarne']);
  });

  it('Gegenprobe zum Vereinen: mit einem Sammelplatz ändert sich nichts', () => {
    const daten = {
      haushalte: [{ id: 's', createdAt: '1', ohneHaushalt: true }],
      zugehoerigkeiten: [{ id: 'z', haushaltId: 's', farbe: 1, reihenfolge: 0 }],
    };
    expect(sammelplaetzeVereinen(daten)).toBe(daten);
  });
});
