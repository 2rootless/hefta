import { describe, expect, it } from 'vitest';
import {
  haushaltsNetto,
  laeuft,
  mietanteil,
  mieteBeiAnteil,
  sortieren,
  statusSetzen,
} from './bewerbungen';

describe('Bewerbungs-Tracker', () => {
  it('führt den Verlauf mit Zeitpunkten, ohne doppelte Einträge', () => {
    let b = statusSetzen({ status: null }, 'gesendet', '2026-11-01T10:00:00Z');
    b = statusSetzen(b, 'gesendet', '2026-11-02T10:00:00Z');
    b = statusSetzen(b, 'besichtigung', '2026-11-05T10:00:00Z');
    expect(b.status).toBe('besichtigung');
    expect(b.verlauf).toEqual([
      { status: 'gesendet', am: '2026-11-01T10:00:00Z' },
      { status: 'besichtigung', am: '2026-11-05T10:00:00Z' },
    ]);
  });

  it('zeigt laufende Bewerbungen zuerst', () => {
    const liste = [
      { id: 'a', status: 'absage' as const, updatedAt: '2026-11-05' },
      { id: 'b', status: 'gesendet' as const, updatedAt: '2026-11-01' },
      { id: 'c', status: null, updatedAt: '2026-11-03' },
    ];
    expect(sortieren(liste).map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(laeuft({ status: 'zusage' })).toBe(false);
  });
});

describe('Mietanteil', () => {
  const max = { nettoeinkommen: 2800, selbstauskunft: undefined };
  const lea = { nettoeinkommen: 1900, selbstauskunft: undefined };

  it('summiert die Vertragsparteien, eingetragenes Netto geht vor', () => {
    expect(haushaltsNetto({}, [max, lea])).toEqual({
      betrag: 4700,
      mindestens: false,
      quelle: 'selbstauskunft',
    });
    expect(haushaltsNetto({ netto: 5000 }, [max, lea])?.betrag).toBe(5000);
    expect(haushaltsNetto({}, [{ nettoeinkommen: null, selbstauskunft: undefined }])).toBeNull();
  });

  it('nennt Untergrenzen ehrlich', () => {
    expect(
      haushaltsNetto({}, [max, { nettoeinkommen: null, selbstauskunft: undefined }])?.mindestens,
    ).toBe(true);
  });

  it('rechnet Anteil und Betrag', () => {
    expect(mietanteil(4700, 1450)).toBe(30.9);
    expect(mietanteil(0, 1450)).toBeNull();
    expect(mieteBeiAnteil(4700, 33)).toBe(1551);
  });
});
