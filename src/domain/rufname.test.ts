import { describe, expect, it } from 'vitest';
import { rufnameAus, rufnameFolgt, rufnameGelesen } from './modell';

// E257 (PC138, CP78): Titel am Anfang zählen nicht für den Rufnamen.
const FAELLE: [vorname: string, rufname: string][] = [
  ['Dr. Maximiliane', 'Maximiliane'],
  ['Prof. Dr. Lea', 'Lea'],
  ['Dipl.-Ing. Max', 'Max'],
  ['Dr. Maximiliane-Charlotte Henriette', 'Maximiliane'],
  ['Max', 'Max'],
  ['Anna-Lena', 'Anna'],
  ['Thị Mai', 'Thị'],
  ['  Dr.  Lea ', 'Lea'],
  // Nur Titel: die alte Regel bleibt.
  ['Dr.', 'Dr.'],
];

describe('Rufname ohne Titel (E257)', () => {
  it('Titel am Anfang werden übersprungen', () => {
    expect(FAELLE.map(([v]) => rufnameAus(v))).toEqual(FAELLE.map(([, r]) => r));
  });

  it('Gegenprobe: die alte Regel (bis zum ersten Leerzeichen) ergibt „Dr.“ und wird rot', () => {
    const alt = (v: string) => v.trim().split(' ')[0]!.split('-')[0]!;
    const abweichend = FAELLE.filter(([v, r]) => alt(v) !== r).map(([v]) => v);
    expect(abweichend).toContain('Dr. Maximiliane');
    expect(alt('Dr. Maximiliane')).not.toBe(rufnameAus('Dr. Maximiliane'));
  });

  it('ein gespeicherter, selbst gebildeter Rufname „Dr.“ wird beim Lesen neu gebildet', () => {
    const p = { id: '1', vorname: 'Dr. Maximiliane', rufname: 'Dr.' };
    expect(rufnameGelesen(p)).toEqual({ ...p, rufname: 'Maximiliane' });
    // Das Original bleibt unverändert; gespeichert wird beim Lesen nichts.
    expect(p.rufname).toBe('Dr.');
  });

  it('ein eigens gewählter Rufname bleibt', () => {
    expect(rufnameGelesen({ vorname: 'Dr. Maximiliane', rufname: 'Maxi' }).rufname).toBe('Maxi');
    expect(rufnameGelesen({ vorname: 'Dr. Maximiliane', rufname: 'Maximiliane' }).rufname).toBe(
      'Maximiliane',
    );
    expect(rufnameGelesen({ vorname: 'Max', rufname: 'Max' }).rufname).toBe('Max');
    // Nur Titel im Vornamen: nichts zu ändern.
    expect(rufnameGelesen({ vorname: 'Dr.', rufname: 'Dr.' }).rufname).toBe('Dr.');
  });

  it('Vorname ändern: ein bis 2.0 gebildeter Rufname „Dr.“ folgt, ein eigener bleibt', () => {
    expect(rufnameFolgt('Dr. Maximiliane', 'Dr. Maximiliane Henriette', 'Dr.')).toBe('Maximiliane');
    expect(rufnameFolgt('Dr. Maximiliane', 'Prof. Lea', 'Maximiliane')).toBe('Lea');
    expect(rufnameFolgt('Dr. Maximiliane', 'Prof. Lea', 'Maxi')).toBe('Maxi');
  });
});

// PC148: „Dr“, „Prof“, „Dipl-Ing“ ohne Punkt gelten auch als Titel, nur als ganzes Wort und nur, wenn noch
// ein Wort folgt. Jeder Fall hat seine Gegenprobe: eine falsche Regel, unter der genau dieser Fall rot wird.
const nurMitPunkt = (v: string) => {
  const w = v.trim().split(/\s+/);
  const ab = w.findIndex((x) => !x.endsWith('.'));
  return (ab < 0 ? v.trim() : w.slice(ab).join(' ')).split(/[\s-]/)[0];
};
// Falsch: schneidet „Dr“ oder „Prof“ vorn ab, auch mitten im Namen („Drago“ wird „ago“).
const nachAnfang = (v: string) =>
  v
    .trim()
    .replace(/^((dr|prof)\.?\s*)+/i, '')
    .split(/[\s-]/)[0];
const TITEL_OHNE_PUNKT: [
  vorname: string,
  rufname: string,
  falscheRegel: (v: string) => string | undefined,
][] = [
  ['Dr Maximiliane', 'Maximiliane', nurMitPunkt],
  ['Dr. Maximiliane', 'Maximiliane', (v) => v.trim().split(/[\s-]/)[0]],
  ['Prof Dr Maximiliane', 'Maximiliane', nurMitPunkt],
  ['Drago', 'Drago', nachAnfang],
  ['Dipl-Ing Max', 'Max', nurMitPunkt],
  ['dr Lea', 'Lea', nurMitPunkt],
  ['Professor Lea', 'Professor', nachAnfang],
];

describe('Titel ohne Punkt (PC148)', () => {
  it.each(TITEL_OHNE_PUNKT)(
    '„%s“ ergibt „%s“, die Gegenprobe wird rot',
    (vorname, rufname, falsch) => {
      expect(rufnameAus(vorname)).toBe(rufname);
      expect(falsch(vorname)).not.toBe(rufname);
    },
  );

  it('nur ein Titel: die alte Regel bleibt', () => {
    expect(rufnameAus('Dr')).toBe('Dr');
    expect(rufnameAus('Prof Dr')).toBe('Prof');
  });

  it('ein in 2.0.1 gebildeter Rufname „Dr“ wird beim Lesen neu gebildet, ein eigener bleibt', () => {
    expect(rufnameGelesen({ vorname: 'Dr Maximiliane', rufname: 'Dr' }).rufname).toBe(
      'Maximiliane',
    );
    expect(rufnameGelesen({ vorname: 'Drago', rufname: 'Drago' }).rufname).toBe('Drago');
    expect(rufnameGelesen({ vorname: 'Dr Maximiliane', rufname: 'Maxi' }).rufname).toBe('Maxi');
    expect(rufnameFolgt('Dr Maximiliane', 'Prof Lea', 'Dr')).toBe('Lea');
  });
});
