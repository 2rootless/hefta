import { describe, expect, it } from 'vitest';
import de from './de.json';

// PC156 (W10): Unter dem Datum einer Unterlage verspricht Hefta keine Erinnerung. Eine Mitteilung gibt es nur beim
// Gehaltsnachweis in der App am iPhone; sonst zeigt die Übersicht, wann eine Unterlage zu alt wird.
type Saetze = { one: { ihr: string; du: string }; other: { ihr: string; du: string } };

function datumSatzFalsch(s: Saetze): string[] {
  const alle = [s.one.ihr, s.one.du, s.other.ihr, s.other.du];
  return alle.filter(
    (x) => /erinner/i.test(x) || !/^Mit Datum zeigt \{app\} (euch|dir), wann /.test(x),
  );
}

describe('Satz unter dem Datum (PC156)', () => {
  it('zeigt, statt zu erinnern, in allen vier Formen', () => {
    expect(datumSatzFalsch(de.unterlage.datumSatz as Saetze)).toEqual([]);
    expect(de.unterlage.datumSatz.one.du).toBe('Mit Datum zeigt {app} dir, wann {er} zu alt wird.');
  });

  it('Gegenprobe: der Satz aus 2.0.1 wird rot', () => {
    const alt: Saetze = {
      one: {
        ihr: 'Mit Datum erinnert {app} euch, bevor {er} zu alt ist.',
        du: 'Mit Datum erinnert {app} dich, bevor {er} zu alt ist.',
      },
      other: {
        ihr: 'Mit Datum erinnert {app} euch, bevor sie zu alt sind.',
        du: 'Mit Datum erinnert {app} dich, bevor sie zu alt sind.',
      },
    };
    expect(datumSatzFalsch(alt)).toHaveLength(4);
  });
});
