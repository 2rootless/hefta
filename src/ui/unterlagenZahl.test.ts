import { describe, expect, it } from 'vitest';
import { unterlagenZahl } from './mappeErstellen';

// PC95 N3, PC96: „Was hinausging“ zählt die Unterlagen wie „Was beiliegt“ auf dem Deckblatt.
describe('Zahl der Unterlagen unter „Was hinausging“', () => {
  const teil = (abschnitt: string) => ({ abschnitt, seite: 2, bis: 3 });
  const inhalt = [
    { teile: [teil('Selbstauskunft'), teil('Gehaltsnachweise'), teil('Ausweis')] },
    { teile: [teil('Selbstauskunft'), teil('Gehaltsnachweise'), teil('Ausweis')] },
  ] as unknown as Parameters<typeof unterlagenZahl>[0]['inhalt'];

  it('zählt je Person und Unterlage: zweimal drei sind sechs, wie auf dem Deckblatt', () => {
    expect(unterlagenZahl({ inhalt, dateien: [] })).toBe(6);
  });

  it('Gegenprobe: die Arten allein wären drei', () => {
    const arten = new Set(inhalt.flatMap((p) => p.teile.map((t) => t.abschnitt)));
    expect(arten.size).toBe(3);
    expect(unterlagenZahl({ inhalt, dateien: [] })).not.toBe(arten.size);
  });

  it('Einzeldateien ohne Deckblatt: jede Datei zählt', () => {
    const dateien = [new File(['a'], 'a.pdf'), new File(['b'], 'b.pdf')];
    expect(unterlagenZahl({ inhalt: [], dateien })).toBe(2);
  });
});
