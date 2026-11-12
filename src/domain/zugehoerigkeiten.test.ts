import { describe, expect, it } from 'vitest';
import { VERGABE } from './personenfarben';
import {
  erklaerungenFestlegen,
  farbeDerPerson,
  farbeImHaushalt,
  giltImHaushalt,
} from './zugehoerigkeiten';

let n = 0;
function zug(personId: string, haushaltId: string, farbe: number, raus = false) {
  n += 1;
  return {
    id: `z${n}`,
    personId,
    haushaltId,
    farbe,
    createdAt: `2026-11-10T10:00:${String(n).padStart(2, '0')}Z`,
    herausgenommenAm: raus ? '2026-11-10T12:00:00Z' : null,
  };
}

const [F1, F2, F3] = VERGABE as [number, number, number];

describe('Farbe gehört der Person (§ 10, E53)', () => {
  it('mit einem Haushalt: die erste freie Farbe der Reihe, wie bisher', () => {
    const alle = [zug('max', 'h1', F1), zug('lea', 'h1', F2)];
    expect(farbeImHaushalt(null, 'h1', alle)).toBe(F3);
  });

  it('eine herausgenommene Person zählt nicht als belegt', () => {
    const alle = [zug('max', 'h1', F1), zug('lea', 'h1', F2, true)];
    expect(farbeImHaushalt(null, 'h1', alle)).toBe(F2);
  });

  it('wer in einen zweiten Haushalt kommt, bringt seine Farbe mit', () => {
    const alle = [zug('max', 'h1', F1), zug('jonas', 'h1', F3)];
    expect(farbeImHaushalt('jonas', 'h2', alle)).toBe(F3);
  });

  it('eine neue Person bekommt keine Farbe, die in einem anderen Haushalt vergeben ist', () => {
    const alle = [zug('max', 'h1', F1), zug('lea', 'h1', F2), zug('jonas', 'h2', F1)];
    expect(farbeImHaushalt(null, 'h2', alle)).toBe(F3);
  });

  it('ist die mitgebrachte Farbe im Haushalt schon vergeben, bekommt sie still eine andere', () => {
    const alle = [zug('max', 'h1', F1), zug('mira', 'h2', F1)];
    expect(farbeImHaushalt('max', 'h2', alle)).toBe(F2);
  });

  it('sind alle zwölf vergeben: eine Farbe, die im Haushalt frei ist', () => {
    const alle = VERGABE.map((f, i) => zug(`p${i}`, i < 6 ? 'h1' : 'h2', f));
    const neu = farbeImHaushalt(null, 'h1', alle);
    const hier = alle.filter((z) => z.haushaltId === 'h1').map((z) => z.farbe);
    expect(hier).not.toContain(neu);
    expect(neu).toBe(VERGABE[6]);
  });

  it('nie zweimal dieselbe Farbe in einem Haushalt, bis zwölf Personen', () => {
    const alle: ReturnType<typeof zug>[] = [];
    for (let i = 0; i < 12; i++) alle.push(zug(`p${i}`, 'h1', farbeImHaushalt(null, 'h1', alle)));
    expect(new Set(alle.map((z) => z.farbe)).size).toBe(12);
  });

  it('die Farbe der Person kommt aus ihrer ältesten Zugehörigkeit, die noch gilt', () => {
    const alle = [zug('lea', 'h1', F2, true), zug('lea', 'h2', F3), zug('lea', 'h3', F1)];
    expect(farbeDerPerson('lea', alle)).toBe(F3);
    expect(farbeDerPerson('niemand', alle)).toBeNull();
  });
});

describe('Bürgschaftserklärung je Haushalt (E53)', () => {
  const jeHaushalt = (typ: string) => typ === 'buergschaftserklaerung';
  const hier = new Set(['z-hier']);

  it('Unterlagen der Person gelten überall', () => {
    expect(
      giltImHaushalt({ typ: 'gehaltsnachweis', zugehoerigkeitId: 'z-dort' }, hier, jeHaushalt),
    ).toBe(true);
  });

  it('eine Erklärung gilt nur in ihrem Haushalt', () => {
    expect(
      giltImHaushalt(
        { typ: 'buergschaftserklaerung', zugehoerigkeitId: 'z-hier' },
        hier,
        jeHaushalt,
      ),
    ).toBe(true);
    expect(
      giltImHaushalt(
        { typ: 'buergschaftserklaerung', zugehoerigkeitId: 'z-dort' },
        hier,
        jeHaushalt,
      ),
    ).toBe(false);
  });

  it('ohne Zugehörigkeit gilt sie: Die Person ist dann nur in einem Haushalt', () => {
    expect(giltImHaushalt({ typ: 'buergschaftserklaerung' }, hier, jeHaushalt)).toBe(true);
  });

  it('beim zweiten Haushalt bekommen offene Erklärungen die Zugehörigkeit des ersten', () => {
    const dokumente = [
      { id: 'd1', typ: 'buergschaftserklaerung', zugehoerigkeitId: null },
      { id: 'd2', typ: 'buergschaftserklaerung', zugehoerigkeitId: 'z-alt' },
      { id: 'd3', typ: 'gehaltsnachweis', zugehoerigkeitId: null },
    ];
    expect(erklaerungenFestlegen(dokumente, 'z-erst', jeHaushalt)).toEqual([
      { id: 'd1', typ: 'buergschaftserklaerung', zugehoerigkeitId: 'z-erst' },
    ]);
  });
});
