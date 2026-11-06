import { describe, expect, it } from 'vitest';
import { alterGrenze, unterlageSatz } from './texte';

const typ = (warnungTage?: number) =>
  ({ typ: { fristen: warnungTage ? { warnungTage } : undefined } }) as Parameters<
    typeof alterGrenze
  >[0];

describe('alterGrenze (Z2, Z5)', () => {
  it('nennt das Höchstalter aus dem Katalog in Monaten', () => {
    expect(alterGrenze(typ(90))).toBe('drei Monate');
    expect(alterGrenze(typ(180))).toBe('sechs Monate');
    expect(alterGrenze(typ(30))).toBe('einen Monat');
  });
});

describe('unterlageSatz: bald zu alt', () => {
  const stand = (fristen: object, neuestesDatum: string) =>
    ({
      status: 'bald',
      veraltet: false,
      neuestesDatum,
      versionen: [{ id: 'v', ausstellungsdatum: neuestesDatum }],
      monate: [],
      typ: { etikett: 'ueblich', fristen },
    }) as unknown as Parameters<typeof unterlageSatz>[0];

  it('nennt den ersten Tag, an dem sie zu alt ist, Tag und Monat bleiben zusammen', () => {
    // 90 Tage nach dem 1. September ist der 30. November: an dem gilt sie noch (fristen.test.ts).
    expect(unterlageSatz(stand({ hinweisTage: 60, warnungTage: 90 }, '2026-09-01'), false)).toBe(
      'Vom 1.\u00a0September 2026, ab 1.\u00a0Dezember zu alt. Kommt in die Mappe.',
    );
  });

  it('ohne Höchstalter nennt sie keinen Tag', () => {
    expect(unterlageSatz(stand({ hinweisTage: 365 }, '2025-06-01'), false)).toBe(
      'Bald zu alt, vom 1.\u00a0Juni 2025. Kommt in die Mappe.',
    );
  });
});
