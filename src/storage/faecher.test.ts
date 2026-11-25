import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { frageLoesen, verschieben, zurAnsprech, type Fach } from '../domain/faecher';
import { neueId } from '../domain/modell';
import { datenbankOeffnen } from './db';
import { faecherAus, faecherSpeichern, haushaltAnlegen, haushaltLaden } from './speicher';

// W57/W54 (PC199, DP128): Der Stand der Fächer wird genau so gespeichert, wie die Vorschau ihn zeigt, und
// „Rückgängig“ stellt den Stand davor genau wieder her (G5, G9).

const entwurf = (vorname: string, rolle: 'vertrag' | 'buerge') => ({
  vorname,
  nachname: 'Test',
  bezeichnung: 'neutral' as const,
  rolle,
  lebenssituation: 'angestellt' as const,
});

async function haushaltA() {
  const db = await datenbankOeffnen(`faecher-${neueId()}`);
  await haushaltAnlegen(db, {
    kinder: 1,
    weitereErwachsene: 0,
    personen: [
      entwurf('Jarne', 'vertrag'),
      entwurf('Selin', 'vertrag'),
      entwurf('Hiltrud', 'buerge'),
    ],
  });
  const lesen = async () => {
    const a = (await haushaltLaden(db))!;
    return {
      a,
      liste: faecherAus(a),
      ansprech: a.mitglieder.find((m) => m.person.id === a.haushalt.ansprechpersonId)?.person
        .vorname,
      weitere: a.haushalt.weitereErwachsene,
    };
  };
  return { db, lesen };
}
const stand = (l: { name: string; fach: Fach }[]) => l.map((x) => `${x.name}:${x.fach}`);

describe('Fächer speichern (R1)', () => {
  it('liest die Fächer: Ansprechperson zuerst, dann Vertrag, Bürgen', async () => {
    const { lesen } = await haushaltA();
    const s = await lesen();
    expect(stand(s.liste)).toEqual(['Jarne:vertrag', 'Selin:vertrag', 'Hiltrud:buerge']);
    expect(s.ansprech).toBe('Jarne');
  });

  it('speichert genau den Stand der Vorschau; Rückgängig stellt ihn genau wieder her (G5, G9)', async () => {
    const { db, lesen } = await haushaltA();
    const vorher = await lesen();
    const r = verschieben(vorher.liste, vorher.liste[0]!.id, 'nurmit');
    if (!('liste' in r)) throw new Error('Frage unerwartet');
    await faecherSpeichern(db, vorher.a.haushalt.id, r.liste);
    const nach = await lesen();
    expect(stand(nach.liste)).toEqual(stand(r.liste));
    expect(nach.ansprech).toBe('Selin');
    expect(nach.weitere).toBe(1);
    // Rückgängig
    await faecherSpeichern(db, vorher.a.haushalt.id, vorher.liste);
    const zurueck = await lesen();
    expect(stand(zurueck.liste)).toEqual(stand(vorher.liste));
    expect(zurueck.ansprech).toBe('Jarne');
    expect(zurueck.weitere).toBe(0);
    // Gegenprobe: Ohne Rückgängig bliebe Selin Ansprechperson.
    expect(nach.ansprech).not.toBe(zurueck.ansprech);
  });

  it('Ansprechperson per Wahlpunkt und die Frage mit einer neuen Person (W42)', async () => {
    const { db, lesen } = await haushaltA();
    const s = await lesen();
    await faecherSpeichern(db, s.a.haushalt.id, zurAnsprech(s.liste, s.liste[1]!.id).liste);
    expect((await lesen()).ansprech).toBe('Selin');
    const s2 = await lesen();
    // Beide aus dem Vertrag: erst Jarne, dann Selin gibt eine Frage; Konstantin kommt neu hinein.
    const r1 = verschieben(s2.liste, s2.liste.find((x) => x.name === 'Jarne')!.id, 'weg');
    if (!('liste' in r1)) throw new Error('Frage unerwartet');
    const r2 = verschieben(r1.liste, r1.liste.find((x) => x.name === 'Selin')!.id, 'weg');
    expect('frage' in r2).toBe(true);
    if (!('frage' in r2)) return;
    const g = frageLoesen(r1.liste, r2.frage, { neu: 'Konstantin' });
    await faecherSpeichern(db, s.a.haushalt.id, g.liste);
    const s3 = await lesen();
    expect(stand(s3.liste)).toEqual([
      'Konstantin:vertrag',
      'Hiltrud:buerge',
      // Selin behält ihren Platz in der Liste, wie in Designs Probe; Jarne kam vorher ans Ende.
      'Selin:weg',
      'Jarne:weg',
    ]);
    expect(s3.ansprech).toBe('Konstantin');
    // Unterlagen und Personen bleiben: Jarne und Selin sind nur herausgenommen.
    expect(s3.a.herausgenommen.map((m) => m.person.vorname).sort()).toEqual(['Jarne', 'Selin']);
  });
});
