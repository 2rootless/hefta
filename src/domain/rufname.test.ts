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
