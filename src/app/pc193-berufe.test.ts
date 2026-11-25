import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// PC193 (E360, DP121): Haushalt A hat neue Berufe und Arbeitgeber. Jarne ist Logistikplaner bei der Tidenwerk
// Logistik GmbH, Selin Bauingenieurin bei der Seilerkoppel Ingenieure GmbH (beide im Registerportal der Länder am
// 24.11. ohne Treffer). Die alten Berufe stehen in keinem sichtbaren Muster mehr: Namensliste, Beispiel der Mappe in
// der App, Musterbackup der Vorschau mit Selins Abrechnungen, Test-Backup 6 (Beispiel-Mappe der Website).
// Gegenprobe: die alten Wörter wieder eingesetzt.
const DATEIEN = [
  'data/namensliste.json',
  'src/ui/mappeVorschau.ts',
  'tests/e2e/szenarien.ts',
  'tests/e2e/vorschau-muster.spec.ts',
];
const ALT = /Mechatroniker|Pflegefachfrau|Pflegezentrum/g;

/** Test-Backup 6 (Haushalt A); die anderen Test-Backups haben eigene, erfundene Personen. */
const haushaltA = (t: string) =>
  t.slice(t.indexOf('const HAUSHALT_A'), t.indexOf('function familie('));

const funde = (lesen: (d: string) => string) => {
  const aus: string[] = [];
  for (const d of DATEIEN) for (const w of lesen(d).match(ALT) ?? []) aus.push(`${d}: ${w}`);
  for (const w of haushaltA(lesen('scripts/test-backups.mjs')).match(ALT) ?? [])
    aus.push(`scripts/test-backups.mjs: ${w}`);
  return aus;
};

describe('PC193: Berufe in Haushalt A', () => {
  it('die alten Berufe stehen nirgends, die neuen in der Namensliste und im Test-Backup', () => {
    expect(funde((d) => readFileSync(d, 'utf8'))).toEqual([]);
    const liste = JSON.parse(readFileSync('data/namensliste.json', 'utf8')) as {
      personen: { haushalt: string; name: string; beruf: string | null }[];
    };
    expect(liste.personen.filter((p) => p.haushalt === 'A').map((p) => [p.name, p.beruf])).toEqual([
      ['Jarne Ostendorp', 'Logistikplaner'],
      ['Selin Akgül', 'Bauingenieurin'],
      ['Hiltrud Ostendorp', 'Verwaltungsangestellte'],
      ['Frieda Ostendorp', null],
    ]);
    const a = haushaltA(readFileSync('scripts/test-backups.mjs', 'utf8'));
    expect(a).toContain("ag: 'Tidenwerk Logistik GmbH'");
    expect(a).toContain("ag: 'Seilerkoppel Ingenieure GmbH'");
    expect(readFileSync('tests/e2e/vorschau-muster.spec.ts', 'utf8')).toContain(
      'Seilerkoppel Ingenieure GmbH',
    );
  });

  it('Gegenprobe: der alte Stand wird gefunden', () => {
    // Ohne Git-Geschichte (das öffentliche Repository hat eine eigene): die alten Wörter in den heutigen Stand.
    const alt = funde((d) =>
      readFileSync(d, 'utf8')
        .replaceAll('Logistikplaner', 'Mechatroniker')
        .replaceAll('Bauingenieurin', 'Pflegefachfrau')
        .replaceAll('Seilerkoppel Ingenieure GmbH', 'Pflegezentrum Seilerkoppel'),
    );
    expect(alt).toEqual(
      expect.arrayContaining([
        'data/namensliste.json: Mechatroniker',
        'data/namensliste.json: Pflegefachfrau',
        'src/ui/mappeVorschau.ts: Mechatroniker',
        'tests/e2e/vorschau-muster.spec.ts: Pflegezentrum',
        'scripts/test-backups.mjs: Pflegezentrum',
      ]),
    );
  });
});
