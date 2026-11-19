import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { neueId, type Person } from '../domain/modell';
import { datenbankOeffnen } from './db';
import { telefoneUmsetzen } from './speicher';

// PC126 K2 (DP82 T2): Stellt Hefta eine alte Nummer still um (E222), bleibt „Zuletzt geändert“ beim alten Datum.
// TL1 („0171 3920001“) und TL28 („+49 (0)171 3920001“) aus DP77. Gegenprobe: Setzt das Umsetzen das Datum neu (wie
// vor PC126), wird dieser Test rot.

const ALT = '2026-11-01T09:00:00.000Z';
const person = (id: string, telefon: string) =>
  ({
    id,
    createdAt: ALT,
    updatedAt: ALT,
    vorname: 'Max',
    nachname: 'Mustermann',
    kontakt: { telefon },
  }) as unknown as Person;

describe('Telefon still umsetzen (E222)', () => {
  it('TL1 und TL28: umgesetzt, das Datum der letzten Änderung bleibt', async () => {
    const db = await datenbankOeffnen(`test-${neueId()}`);
    await db.put('personen', person('tl1', '0171 3920001'));
    await db.put('personen', person('tl28', '+49 (0)171 3920001'));
    expect(await telefoneUmsetzen(db)).toBe(2);
    for (const id of ['tl1', 'tl28']) {
      const p = await db.get('personen', id);
      expect(p?.kontakt?.telefonE164, id).toBe('+491713920001');
      expect(p?.updatedAt, id).toBe(ALT);
    }
  });
});
