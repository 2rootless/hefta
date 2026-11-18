import { describe, expect, it } from 'vitest';
import { ohneZaehlmarken } from './zaehlmarken';

// PC120 (§7, 4): Zählmarken fallen beim Speichern weg; Pfad und Teile, die das Inserat bestimmen, bleiben.
// Nur erfundene Nummern (W7).

describe('ohneZaehlmarken', () => {
  it('nimmt utm_…, referrer, fbclid, gclid und ähnliche weg', () => {
    expect(
      ohneZaehlmarken(
        'https://www.immobilienscout24.de/expose/000000123?referrer=RESULT_LIST_LISTING&enteredFrom=result_list',
      ),
    ).toBe('https://www.immobilienscout24.de/expose/000000123');
    expect(
      ohneZaehlmarken(
        'https://example.com/wohnung/42?utm_source=newsletter&utm_medium=mail&UTM_Campaign=herbst&fbclid=AbC&gclid=x1',
      ),
    ).toBe('https://example.com/wohnung/42');
    expect(ohneZaehlmarken('https://example.com/a?msclkid=1&_gl=2&mc_cid=3&igshid=4')).toBe(
      'https://example.com/a',
    );
  });

  it('lässt Teile, die das Inserat bestimmen, Anker und Schreibweise stehen', () => {
    expect(
      ohneZaehlmarken('https://example.com/expose.php?id=000123&utm_source=x&lang=de#bilder'),
    ).toBe('https://example.com/expose.php?id=000123&lang=de#bilder');
    expect(ohneZaehlmarken('https://example.com/suche?ort=Musterstadt%20Nord&q=a+b')).toBe(
      'https://example.com/suche?ort=Musterstadt%20Nord&q=a+b',
    );
    expect(ohneZaehlmarken('https://example.com/expose/000000123')).toBe(
      'https://example.com/expose/000000123',
    );
    expect(ohneZaehlmarken('  https://example.com/x?utm_term=1  ')).toBe('https://example.com/x');
  });

  it('erkennt Zählmarken auch verschlüsselt geschrieben, kaputte Teile bleiben', () => {
    expect(ohneZaehlmarken('https://example.com/x?utm%5Fsource=1&id=2')).toBe(
      'https://example.com/x?id=2',
    );
    expect(ohneZaehlmarken('https://example.com/x?%E0%A4%A=1')).toBe(
      'https://example.com/x?%E0%A4%A=1',
    );
  });

  it('was kein Link ist, bleibt', () => {
    expect(ohneZaehlmarken('kein Link ?utm_source=x')).toBe('kein Link ?utm_source=x');
    expect(ohneZaehlmarken('')).toBe('');
  });

  it('Gegenprobe: eine Zählmarke im gespeicherten Link würde hier anschlagen', () => {
    const gespeichert = ohneZaehlmarken('https://example.com/x?id=1&gclid=abc');
    expect(/[?&](utm_|gclid|fbclid|referrer)/i.test(gespeichert)).toBe(false);
    expect(/[?&](utm_|gclid|fbclid|referrer)/i.test('https://example.com/x?id=1&gclid=abc')).toBe(
      true,
    );
  });
});
