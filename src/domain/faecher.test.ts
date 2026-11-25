import { describe, expect, it } from 'vitest';
import {
  ansprech,
  frageLoesen,
  kandidaten,
  verschieben,
  ziele,
  zurAnsprech,
  type Eintrag,
  type Fach,
} from './faecher';

// W57/W54, Bedienung R1 (DP127, DP128): die Logik der Fächer, wie in Designs Probe `r.html`.
const e = (id: string, fach: Fach, farbe = 1): Eintrag => ({
  id,
  personId: `p-${id}`,
  name: id[0]!.toUpperCase() + id.slice(1),
  farbe,
  fach,
});
const A = [e('jarne', 'vertrag', 1), e('selin', 'vertrag', 2), e('hiltrud', 'buerge', 3)];
const C = [e('ronja', 'vertrag', 1), e('detlef', 'buerge', 2)];
const stand = (l: Eintrag[]) => l.map((x) => `${x.name}:${x.fach}`);

describe('Fächer (R1)', () => {
  it('Verschieben ins Fach, an die Stelle der Vorschau; die Folge nennt es', () => {
    const r = verschieben(A, 'hiltrud', 'vertrag', 1);
    expect('liste' in r && stand(r.liste)).toEqual([
      'Jarne:vertrag',
      'Hiltrud:vertrag',
      'Selin:vertrag',
    ]);
    expect('folgen' in r && r.folgen).toEqual([{ art: 'fach', fach: 'vertrag', name: 'Hiltrud' }]);
    // Ohne Stelle: ans Ende des Fachs
    const r2 = verschieben(A, 'selin', 'buerge');
    expect('liste' in r2 && stand(r2.liste)).toEqual([
      'Jarne:vertrag',
      'Hiltrud:buerge',
      'Selin:buerge',
    ]);
  });

  it('E366: Geht die Ansprechperson, wird die Nächste es, und die Folge sagt beides (G7)', () => {
    const r = verschieben(A, 'jarne', 'buerge');
    expect('liste' in r && ansprech(r.liste)?.name).toBe('Selin');
    expect('folgen' in r && r.folgen).toEqual([
      { art: 'fach', fach: 'buerge', name: 'Jarne' },
      { art: 'ansprech', name: 'Selin' },
    ]);
    // Gegenprobe: Verschiebt sich Selin, bleibt Jarne, und es gibt keinen zweiten Satz.
    const r2 = verschieben(A, 'selin', 'weg');
    expect('folgen' in r2 && r2.folgen).toHaveLength(1);
  });

  it('W42: Würde der Vertrag leer, kommt die Frage, und nichts ändert sich (G3)', () => {
    const r = verschieben(C, 'ronja', 'nurmit');
    expect(r).toEqual({ frage: { id: 'ronja', fach: 'nurmit' } });
    expect(kandidaten(C).map((x) => x.name)).toEqual(['Detlef']);
    // Detlef rückt nach, Ronja zieht nur mit ein
    const g = frageLoesen(C, { id: 'ronja', fach: 'nurmit' }, 'detlef');
    expect(stand(g.liste)).toEqual(['Detlef:vertrag', 'Ronja:nurmit']);
    expect(g.folgen).toEqual([
      { art: 'kommt', name: 'Detlef' },
      { art: 'fach', fach: 'nurmit', name: 'Ronja' },
    ]);
    // eine neue Person „Konstantin“
    const n = frageLoesen(
      [e('ronja', 'vertrag')],
      { id: 'ronja', fach: 'weg' },
      { neu: 'Konstantin' },
    );
    expect(stand(n.liste)).toEqual(['Konstantin:vertrag', 'Ronja:weg']);
    expect(n.liste[0]!.neu).toBe(true);
  });

  it('Ansprechperson per Wahlpunkt: zuerst im Vertrag, auch aus der Bürgschaft (G6)', () => {
    const r = zurAnsprech(A, 'selin');
    expect(stand(r.liste)).toEqual(['Selin:vertrag', 'Jarne:vertrag', 'Hiltrud:buerge']);
    const r2 = zurAnsprech(A, 'hiltrud');
    expect(ansprech(r2.liste)?.name).toBe('Hiltrud');
    expect(r2.folgen).toEqual([{ art: 'ansprech', name: 'Hiltrud' }]);
  });

  it('Ziele in der Zeile: Ansprechperson zuerst, nie das eigene Fach; nicht für die Ansprechperson selbst', () => {
    expect(ziele(A, 'selin')).toEqual(['ansprech', 'nurmit', 'buerge', 'weg']);
    expect(ziele(A, 'jarne')).toEqual(['nurmit', 'buerge', 'weg']);
    expect(ziele([...A, e('alt', 'weg')], 'alt')).toEqual(['vertrag', 'nurmit', 'buerge']);
  });

  it('Gegenprobe: ohne Sperre wäre der Vertrag leer', () => {
    const r = verschieben(C, 'ronja', 'buerge');
    expect('frage' in r).toBe(true);
  });
});
