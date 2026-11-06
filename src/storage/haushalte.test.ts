import { describe, expect, it } from 'vitest';
import { teilbestand, zusammenfuehren } from './haushalte';

// Zwei Haushalte, Petra bürgt für beide (dieselbe Person).
const DATEN = {
  haushalte: [
    { id: 'h1', updatedAt: '1' },
    { id: 'h2', updatedAt: '1' },
  ],
  zugehoerigkeiten: [
    { id: 'z1', haushaltId: 'h1', personId: 'max' },
    { id: 'z2', haushaltId: 'h1', personId: 'petra' },
    { id: 'z3', haushaltId: 'h2', personId: 'tom' },
    { id: 'z4', haushaltId: 'h2', personId: 'petra' },
  ],
  personen: [
    { id: 'max', updatedAt: '1' },
    { id: 'petra', updatedAt: '1' },
    { id: 'tom', updatedAt: '1' },
  ],
  dokumente: [
    { id: 'd-max', personId: 'max' },
    { id: 'd-petra', personId: 'petra' },
    { id: 'd-tom', personId: 'tom' },
  ],
  versionen: [
    { id: 'v1', dokumentId: 'd-max', original: 'f1', aufbereitet: null },
    { id: 'v2', dokumentId: 'd-petra', original: 'f2', aufbereitet: 'f3' },
    { id: 'v3', dokumentId: 'd-tom', original: 'f4', aufbereitet: null },
  ],
  bewerbungen: [
    { id: 'b1', haushaltId: 'h1' },
    { id: 'b2', haushaltId: 'h2' },
  ],
  einstellungen: [{ id: 'app', updatedAt: '1' }],
};

const idListe = (x: unknown[] | undefined) => (x ?? []).map((y) => (y as { id: string }).id);

describe('Teilbestand (Backup je Haushalt)', () => {
  it('nimmt alles zum Haushalt mit, auch die gemeinsame Bürgin, aber keine App-Einstellungen', () => {
    const t = teilbestand(DATEN, 'h1');
    expect(idListe(t.daten.personen)).toEqual(['max', 'petra']);
    expect(idListe(t.daten.versionen)).toEqual(['v1', 'v2']);
    expect(idListe(t.daten.bewerbungen)).toEqual(['b1']);
    expect(t.dateien.sort()).toEqual(['f1', 'f2', 'f3']);
    expect(t.daten.einstellungen).toBeUndefined();
    expect(idListe(teilbestand(DATEN, 'h2').daten.personen)).toEqual(['petra', 'tom']);
  });
});

describe('Zusammenführen (Einspielen „hinzufügen“)', () => {
  it('fügt einen Haushalt hinzu, ohne Bestehendes zu verlieren', () => {
    const nurH1 = teilbestand(DATEN, 'h1').daten;
    const h2 = teilbestand(DATEN, 'h2').daten;
    const z = zusammenfuehren(nurH1, h2);
    expect(idListe(z.daten.haushalte)).toEqual(['h1', 'h2']);
    expect(idListe(z.daten.personen)).toEqual(['max', 'petra', 'tom']);
    // Petra gab es schon (gleicher Stand): nicht doppelt, nicht „aktualisiert“.
    expect(z.aktualisiert).toEqual([]);
    expect(z.neu).toBe(1 + 2 + 1 + 1 + 1 + 1);
  });

  it('behält bei gleicher ID den neueren Stand; App-Einstellungen bleiben', () => {
    const bestehend = {
      personen: [{ id: 'petra', updatedAt: '2026-11-01', nachname: 'alt' }],
      einstellungen: [{ id: 'app', updatedAt: '1', x: 'hier' }],
    };
    const neuer = {
      personen: [{ id: 'petra', updatedAt: '2026-11-05', nachname: 'neu' }],
      einstellungen: [{ id: 'app', updatedAt: '9', x: 'dort' }],
    };
    const z = zusammenfuehren(bestehend, neuer);
    expect(z.daten.personen).toEqual([{ id: 'petra', updatedAt: '2026-11-05', nachname: 'neu' }]);
    expect(z.aktualisiert).toEqual(['petra']);
    expect(z.daten.einstellungen).toEqual(bestehend.einstellungen);
    // Älterer Stand im Backup überschreibt nichts.
    expect(zusammenfuehren(neuer, bestehend).daten.personen).toEqual(neuer.personen);
  });
});
