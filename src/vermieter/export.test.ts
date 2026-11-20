import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { anhangLesen, type HeftaAnhang } from '../pdf/anhang';
import { csvText, dateiname, exportierbar, SPALTEN, zelle } from './export';

// Export als CSV (PC99, PC100; Fassung 1: E218, V20, V23): gegen das Beispiel aus dem Entwurf (export-entwurf.md,
// Abschnitt 2), Zeichen für Zeichen, ohne `modus`; dazu die Gegenproben aus Abschnitt 5.

const lesehilfe = (datei: string) =>
  anhangLesen(readFileSync(`pakete/hefta-json/beispiele/${datei}`, 'utf8')) as HeftaAnhang;

describe('Export als CSV', () => {
  it('ergibt aus Beispiel 2 genau die Beispieldatei: BOM, Semikolon, CRLF, eine Zeile je Person', () => {
    const soll = readFileSync('tests/fixtures/export/2-paar-kind-buergin.csv', 'utf8');
    const ist = csvText([lesehilfe('2-paar-kind-buergin.json')]);
    expect(ist).toBe(soll);
    expect(ist.charCodeAt(0)).toBe(0xfeff);
    const zeilen = ist.slice(1).split('\r\n').filter(Boolean);
    expect(zeilen).toHaveLength(4);
    expect(zeilen[0]).toBe(SPALTEN.join(';'));
  });

  it('mehrere Mappen hintereinander, Kopfzeile einmal', () => {
    const ist = csvText([lesehilfe('1-eine-person.json'), lesehilfe('2-paar-kind-buergin.json')]);
    const zeilen = ist.slice(1).split('\r\n').filter(Boolean);
    expect(zeilen).toHaveLength(1 + 1 + 3);
    expect(zeilen.filter((z) => z.startsWith('kennung;'))).toHaveLength(1);
  });

  it('Regel 1: Namen und Kontaktdaten stehen genau so in der Lesehilfe', () => {
    const a = lesehilfe('2-paar-kind-buergin.json');
    const zeilen = csvText([a])
      .slice(1)
      .split('\r\n')
      .filter(Boolean)
      .slice(1)
      .map((z) => z.split(';'));
    const spalte = (n: (typeof SPALTEN)[number]) => SPALTEN.indexOf(n);
    zeilen.forEach((z, i) => {
      const p = a.haushalt.personen[i]!;
      expect(z[spalte('vorname')]).toBe(p.vorname);
      expect(z[spalte('nachname')]).toBe(p.nachname);
      expect(z[spalte('email')]).toBe(p.email ?? '');
      // T5, V20: `telefon_e164` in geprüfter Form ohne Apostroph, damit Programme die Nummer richtig lesen.
      expect(z[spalte('telefon_e164')]).toBe(p.telefon_e164 ?? '');
    });
  });

  it('Gegenproben: Formel, Semikolon, Anführungszeichen, Zeilenumbruch', () => {
    expect(zelle('=SUMME(A1:A9)')).toBe("'=SUMME(A1:A9)");
    expect(zelle('+491713920001')).toBe("'+491713920001");
    expect(zelle('+491713920001', 'telefon')).toBe("'+491713920001");
    expect(zelle('+491713920001', 'telefon_e164')).toBe('+491713920001');
    expect(zelle('+49=1', 'telefon_e164')).toBe("'+49=1");
    expect(zelle('-1')).toBe("'-1");
    expect(zelle('@kurz')).toBe("'@kurz");
    expect(zelle('Muster;Beispiel')).toBe('"Muster;Beispiel"');
    expect(zelle('Er sagt "ja"')).toBe('"Er sagt ""ja"""');
    expect(zelle('eins\nzwei')).toBe('"eins\nzwei"');
    expect(zelle(undefined)).toBe('');
    expect(zelle(0)).toBe('0');
    expect(zelle('Lindenring 3')).toBe('Lindenring 3');
  });

  it('nur gelesene Lesehilfen; die alte Form vor Fassung 1 ist keine (E216)', () => {
    expect(exportierbar(lesehilfe('1-eine-person.json'))).toBe(true);
    const alt = anhangLesen(
      JSON.stringify({
        hefta: 3,
        erstellt: '2026-11-06',
        bewerbung: { kennung: 'd2e0f734-0b59-41ea-95f4-c9715acbe034', wohnung: null },
        haushalt: { personen: [{ name: 'Max Mustermann', rolle: 'hauptmieter' }], mitziehende: [] },
        unterlagen: [],
      }),
    );
    expect(alt).toBeNull();
    expect(exportierbar(alt)).toBe(false);
    expect(exportierbar(null)).toBe(false);
  });

  it('V23, E227: keine Spalte modus; schritt nur mit festem Satz', () => {
    expect(SPALTEN).not.toContain('modus');
    const a = lesehilfe('3-nach-der-zusage.json');
    expect(a.schritt).toBe('zusage');
    const kopf = csvText([a]).slice(1).split('\r\n')[0]!.split(';');
    const zeile = csvText([a]).slice(1).split('\r\n')[1]!.split(';');
    expect(zeile[kopf.indexOf('schritt')]).toBe('zusage');
    const fremd = { ...a, schritt: 'vorab' } as unknown as HeftaAnhang;
    const zeileFremd = csvText([fremd]).slice(1).split('\r\n')[1]!.split(';');
    expect(zeileFremd[kopf.indexOf('schritt')]).toBe('');
  });

  it('Dateiname nach dem Tag des Exports', () => {
    expect(dateiname(new Date(2026, 10, 18, 23, 59))).toBe('hefta-export-2026-11-18.csv');
  });
});
