import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { neueId } from '../domain/modell';
import { datenbankOeffnen } from './db';
import { teilbestand } from './haushalte';
import {
  heftAnlegen,
  heftFotoEntfernen,
  heftFotosHinzufuegen,
  verwaisteDateienLoeschen,
} from './speicher';

// Fotos der Besichtigung (Zeile 9): Sie hängen am Heft, nicht an einer Version. Das Aufräumen darf sie
// nicht löschen, das Backup je Haushalt nimmt sie mit.

const entwurf = {
  haushaltId: 'h1',
  adresse: 'Weg 1\n20259 Hamburg',
  link: null,
  quelle: '',
  inseratText: null,
  angaben: undefined,
};

describe('Fotos am Heft', () => {
  it('bleiben beim Aufräumen, gehen erst, wenn sie aus dem Heft genommen sind', async () => {
    const db = await datenbankOeffnen(`test-${neueId()}`);
    const heft = await heftAnlegen(db, entwurf);
    const [a, b] = await heftFotosHinzufuegen(db, heft.id, [
      new Blob(['a'], { type: 'image/jpeg' }),
      new Blob(['b'], { type: 'image/jpeg' }),
    ]);
    expect((await db.get('hefte', heft.id))?.fotos).toEqual([a, b]);

    await verwaisteDateienLoeschen(db, -1000);
    expect(await db.getAllKeys('dateien')).toHaveLength(2);

    expect(await heftFotoEntfernen(db, heft.id, a!)).toEqual([a, b]);
    expect((await db.get('hefte', heft.id))?.fotos).toEqual([b]);
    // Bis zum Aufräumen bleibt die Datei, für „Rückgängig“.
    expect(await db.get('dateien', a!)).toBeTruthy();
    await verwaisteDateienLoeschen(db, -1000);
    expect(await db.get('dateien', a!)).toBeUndefined();
    expect(await db.get('dateien', b!)).toBeTruthy();
  });

  it('kommen ins Backup des Haushalts', () => {
    const teil = teilbestand(
      {
        haushalte: [{ id: 'h1' }],
        hefte: [
          { id: 'x', haushaltId: 'h1', fotos: ['f1', 'f2'] },
          { id: 'y', haushaltId: 'h2', fotos: ['f3'] },
        ],
      },
      'h1',
    );
    expect(teil.dateien.sort()).toEqual(['f1', 'f2']);
  });
});
