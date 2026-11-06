import { describe, expect, it } from 'vitest';
import { datum, groesse, t } from './index';

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
    expect(groesse(850 * 1024)).toBe('850 KB');
    expect(groesse(12.4 * 1024 * 1024)).toBe('12,4 MB');
    expect(groesse(10 * 1024 ** 3)).toBe('10 GB');
  });

  it('formatiert Daten wie im Design', () => {
    expect(datum(new Date(2026, 9, 28))).toBe('28.\u00a0Oktober 2026');
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
