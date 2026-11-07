import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { festeWoerter, WORTLISTE_DATEI, wortliste } from './wortliste';

// Die Wortliste fürs Design darf nicht veralten: Weicht docs/wortliste-mappe.md vom Regelkatalog oder
// vom Bau der Mappe ab, schlägt dieser Test an. `npm run wortliste` schreibt sie neu (Modus „schreiben“).

describe('Wortliste der Mappe', () => {
  const neu = wortliste();

  it('steht aktuell in docs/', () => {
    if (import.meta.env.MODE === 'schreiben') writeFileSync(WORTLISTE_DATEI, neu);
    expect(existsSync(WORTLISTE_DATEI)).toBe(true);
    expect(readFileSync(WORTLISTE_DATEI, 'utf8').replaceAll('\r\n', '\n')).toBe(neu);
  });

  it('nennt jede Rolle, jede Unterlage und die festen Wörter des Deckblatts', () => {
    for (const wort of [
      'Hauptmieterin',
      'Mitmietpartei',
      'Bürgin',
      'Gehaltsnachweise',
      'Mietzahlungen',
    ])
      expect(neu).toContain(wort);
    expect(neu).toContain('Gehaltsnachweis Juli bis September 2026');
    expect(neu).toContain('Ein Kind');
    expect(neu).toContain('Eine weitere Person');
  });

  it('liest die festen Wörter wirklich aus dem Quelltext', () => {
    const woerter = festeWoerter(readFileSync('src/pdf/bewerbung.ts', 'utf8'));
    expect(woerter).toEqual(expect.arrayContaining(['Kontakt']));
    expect(festeWoerter("text('Probe', x)")).toEqual(['Probe']);
    // Die Muster der Fußzeile, die die Liste beschreibt, stehen so im Bau der Mappe.
    const bau = readFileSync('src/pdf/bewerbung.ts', 'utf8');
    expect(bau).toContain('`Bewerbung ${a.kurz} · ${a.fussName}`');
    expect(bau).toContain('`Seite ${nummer} von ${gesamt}`');
  });
});
