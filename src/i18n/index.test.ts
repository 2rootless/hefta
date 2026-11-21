import { beforeEach, describe, expect, it } from 'vitest';
import { anrede } from './anrede.svelte';
import { datum, groesse, t, tIn } from './index';

// Die Sätze hier sind in der Fassung „du“ geschrieben; die Anrede der App setzt sonst App.svelte.
beforeEach(() => {
  anrede.wert = 'du';
});

describe('Ansprache „ihr“ und „du“ (B28b)', () => {
  it('wählt die Fassung nach der Anrede der App, auch in der Mehrzahl', () => {
    expect(t('rueckmeldung.mehr', { adresse: 'hallo@hefta.de' })).toBe(
      'Mehr zu sagen? Schreib an hallo@hefta.de.',
    );
    anrede.wert = 'ihr';
    expect(t('rueckmeldung.mehr', { adresse: 'hallo@hefta.de' })).toBe(
      'Mehr zu sagen? Schreibt an hallo@hefta.de.',
    );
    expect(t('rutsch.endeUebersprungen', { anzahl: 3 })).toBe(
      'Drei habt ihr übersprungen, sie bleiben auf der Übersicht offen.',
    );
    expect(tIn('du', 'rueckmeldung.mehr', { adresse: 'hallo@hefta.de' })).toBe(
      'Mehr zu sagen? Schreib an hallo@hefta.de.',
    );
  });
});

describe('i18n', () => {
  it('liefert Texte zum Schlüssel', () => {
    expect(t('update.knopf')).toBe('Jetzt neu starten');
  });

  it('setzt Werte ein', () => {
    expect(t('fuss.version', { version: '0.1.0' })).toBe('Version 0.1.0');
  });

  it('wählt Einzahl und Mehrzahl', () => {
    expect(t('export.seiten', { anzahl: 1 })).toBe('1 Seite');
    expect(t('export.seiten', { anzahl: 14 })).toBe('14 Seiten');
  });

  it('formatiert Größen in KB, MB und GB', () => {
    // PC186: wie „Dateien“ am iPhone, 1 MB = 1 000 000 Byte.
    expect(groesse(850_000)).toBe('850 KB');
    expect(groesse(12_400_000)).toBe('12,4 MB');
    expect(groesse(10_000_000_000)).toBe('10,0 GB');
    // Gegenprobe: mit 1024 wären 12 400 000 Byte nur 11,8 MB.
    expect(groesse(12_400_000)).not.toBe('11,8 MB');
  });

  it('formatiert Daten wie im Design', () => {
    expect(datum(new Date(2026, 9, 28))).toBe('28.\u00a0Oktober 2026');
  });
});

describe('DP33, Fehler 1 und 2', () => {
  it('kein doppelter Punkt, wenn der Wert auf einen Punkt endet', () => {
    // W37: Der feste Teil steht jetzt allein (`satzFest`), der Satz danach kommt aus dem Pool P8.
    expect(t('stand.nachgefragt.satzFest', { datum: '12. Okt.' })).toBe('Beworben am 12. Okt.');
    expect(t('stand.nachgefragt.satzFest', { datum: '12. Oktober' })).toBe(
      'Beworben am 12. Oktober.',
    );
  });

  it('vor dem fetten Namen steht ein Leerzeichen', () => {
    for (const k of ['pruef.nameFehltVor', 'pruef.aufDemDokument', 'pruef.aufDerSeite'])
      expect(t(k as never)).toMatch(/ $/);
  });
});

describe('Monate und Tage', () => {
  it('nennt Monate ohne Jahr im laufenden Jahr, sonst mit', async () => {
    const { monatName, tagText } = await import('./index');
    expect(monatName('2026-10', new Date(2026, 9, 31))).toBe('Oktober');
    expect(monatName('2025-12', new Date(2026, 0, 5))).toBe('Dezember 2025');
    expect(tagText('2026-11-04')).toBe('4.\u00a0November 2026');
  });

  it('schreibt Zahlen im Satz bis zwölf aus, darüber Ziffern', async () => {
    const { t } = await import('./index');
    expect(t('rutsch.endeDrin', { anzahl: 7 })).toBe('Sieben Unterlagen sind drin.');
    expect(t('rutsch.endeUebersprungen', { anzahl: 3 })).toBe(
      'Drei hast du übersprungen, sie bleiben auf der Übersicht offen.',
    );
    expect(t('rutsch.endeUebersprungen', { anzahl: 1 })).toBe(
      'Eine hast du übersprungen, sie bleibt auf der Übersicht offen.',
    );
    expect(t('rutsch.endeAlleDrin', { anzahl: 5 })).toBe('Alle fünf Unterlagen sind drin.');
    expect(t('rutsch.endeDrin', { anzahl: 13 })).toBe('13 Unterlagen sind drin.');
  });
});
