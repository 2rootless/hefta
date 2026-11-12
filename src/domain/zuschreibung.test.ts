import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Die Regel aus Entscheidung W für alle Texte, nicht nur den Ratgeber: Hefta sagt nie selbst „darf nicht“ oder
// „du musst“. Wo so ein Wort steht, muss derselbe Text sagen, wer es sagt.

const ZUSCHREIBUNG =
  /Orientierungs|Datenschutz|Musterbogen|\bDSK\b|Abschnitt|Aufsichtsbeh|Behörde|BGB|DSGVO|AGG/;
const AUSSAGE =
  /\bdu musst\b|\bmusst du\b|\bihr müsst\b|\bmüsst ihr\b|\bSie müssen\b|\bmüssen Sie\b|\b(darf|dürfen)\s+(\w+\s+)?nicht\b|\bunzulässig\b|\bnicht zulässig\b|\brechtswidrig\b|\bverboten\b/i;

// Sätze, die zwar so klingen, aber etwas anderes sagen. „dürfen nicht erforderliche Angaben“: Geschwärzt werden
// darf, was nicht erforderlich ist.
// Ebenso „Abschicken müsst ihr selbst“ (Planung 12z): keine Aussage über Recht, sondern dass Hefta nichts
// selbst verschickt.
const AUSNAHMEN = new Set<string>([
  'data/nachforderung.de.json:schwaerzen',
  'src/i18n/de.json:heft.naechstesSatzIhr',
  'src/i18n/de.json:heft.naechstesSatzDu',
]);

function texte(wert: unknown, pfad = ''): [string, string][] {
  if (typeof wert === 'string') return [[pfad, wert.replaceAll('­', '')]];
  if (wert && typeof wert === 'object')
    return Object.entries(wert).flatMap(([k, v]) => texte(v, pfad ? `${pfad}.${k}` : k));
  return [];
}
const datei = (pfad: string) => JSON.parse(readFileSync(pfad, 'utf8')) as unknown;

describe('Zuschreibung', () => {
  it.each([
    'src/i18n/de.json',
    'src/i18n/vermieter.de.json',
    'data/nachforderung.de.json',
    'data/regelkatalog.de.json',
    'data/datenschutz-zusatz.de.json',
  ])('%s: jede Aussage über Recht nennt ihre Quelle', (pfad) => {
    const treffer = texte(datei(pfad))
      .filter(
        ([k, t]) => AUSSAGE.test(t) && !ZUSCHREIBUNG.test(t) && !AUSNAHMEN.has(`${pfad}:${k}`),
      )
      .map(([k, t]) => `${k}: ${t.slice(0, 80)}`);
    expect(treffer).toEqual([]);
  });

  it('Die Prüfung schlägt an', () => {
    expect(AUSSAGE.test('Der Vermieter darf das nicht verlangen.')).toBe(true);
    expect(AUSSAGE.test('Das musst du nicht, aber du musst nichts.')).toBe(true);
    expect(ZUSCHREIBUNG.test('Der Vermieter darf das nicht verlangen.')).toBe(false);
  });
});

describe('„Ein Hinweis, keine Rechtsberatung“', () => {
  const app = datei('src/i18n/de.json') as { uebertragen: { hinweis: string } };
  const vermieter = datei('src/i18n/vermieter.de.json') as Record<string, string>;

  it('steht überall, wo es um Recht geht', () => {
    for (const t of [
      app.uebertragen.hinweis,
      vermieter['schritte.quelle']!,
      vermieter['anfordern.quelle']!,
      vermieter['loeschen.quelle']!,
    ])
      expect(t).toContain('keine Rechtsberatung');
  });
});
