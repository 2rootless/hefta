import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import namensliste from '../data/namensliste.json' with { type: 'json' };
import strassen from '../data/musterstrassen.json' with { type: 'json' };

// wunsch-W40 (Wunschliste Fassung 40, PC176): Wo man Beispiele sieht, stehen glaubwürdige, erfundene Namen und Straßen
// aus der Namensliste, nicht „Muster…“, „Beispiel…“ oder „Max Mustermann“. Jede Beispiel-Straße ist gegen OSM
// geprüft (data/musterstrassen.json). In Tests dürfen Musternamen bleiben (W7 prüft dort die Adressen).
// Sichtbar in der App: alle Texte der Oberfläche, die Beispiel-Mappe in „So sieht eure Mappe aus“ und das
// Musterbackup für Vorschau und Store-Bilder.

const MUSTERWORT =
  /Mustermann|Musterfrau|Musterweg|Musterstadt|Musterplatz|Beispielstra(ß|ss)e|Lindenring/;
const NAMEN = new Set(namensliste.personen.map((p) => p.name));
const VORNAMEN = new Set(namensliste.personen.map((p) => p.name.split(' ')[0]!));
const FREI = new Set(strassen.frei.map((s) => s.strasse));
const STRASSE = /([A-ZÄÖÜ][\wäöüß-]+) \d+(?=[,\n]|\\n|$)/g;

/** Verstöße in einem sichtbaren Muster: Musterwörter, Straßen außerhalb der geprüften Liste, fremde Namen. */
function verstoesse(text: string, namen: string[] = []): string[] {
  const aus: string[] = [];
  const m = MUSTERWORT.exec(text);
  if (m) aus.push(`Musterwort: ${m[0]}`);
  for (const s of text.matchAll(STRASSE))
    if (
      /(stieg|wisch|bogen|koppel|weg|straße|reihe|kamp|schlag|höfe|allee|ring)$/.test(s[1]!) &&
      !FREI.has(s[1]!)
    )
      aus.push(`Straße nicht geprüft frei: ${s[1]}`);
  for (const n of namen)
    if (!NAMEN.has(n) && !VORNAMEN.has(n)) aus.push(`Name nicht in der Namensliste: ${n}`);
  return aus;
}

/** Alle Zeichenketten in de.json. */
function texte(o: unknown): string[] {
  if (typeof o === 'string') return [o];
  if (o && typeof o === 'object') return Object.values(o).flatMap(texte);
  return [];
}

describe('wunsch-W40: keine Muster-Namen, wo man sie sieht', () => {
  it('Texte der Oberfläche ohne Musternamen und Musterstraßen', () => {
    const de = JSON.parse(readFileSync('src/i18n/de.json', 'utf8')) as unknown;
    expect(texte(de).flatMap((t) => verstoesse(t))).toEqual([]);
  });

  it('Beispiel-Mappe in der App: Haushalt A, Straße aus der geprüften Liste', () => {
    const q = readFileSync('src/ui/mappeVorschau.ts', 'utf8');
    const auftrag = q.slice(
      q.indexOf('async function beispielAuftrag'),
      q.indexOf('export async function vorschauBauen'),
    );
    const namen = [...auftrag.matchAll(/name: '([^']+)'/g)].map((m) => m[1]!);
    expect(namen).toEqual(['Jarne Ostendorp', 'Selin Akgül']);
    expect(verstoesse(auftrag.replace(/\/\*\*[^]*?\*\//g, ''), namen)).toEqual([]);
  });

  it('Musterbackup für Vorschau und Store-Bilder: Haushalt A, die drei Hefte aus DP110', () => {
    const q = readFileSync('tests/e2e/vorschau-muster.spec.ts', 'utf8');
    // DP146: Beide Musterbackups bauen auf Haushalt A, das zweite mit alten Kopien.
    expect(q).toContain("szenario: string | Szenario = 'A-namensliste'");
    expect(q).toContain("SZENARIEN.find((x) => x.id === 'A-namensliste')");
    expect(q).toContain('szenarioLaden(page, szenario,');
    const ohneKommentar = q.replace(/^\s*\/\/.*$/gm, '');
    expect(verstoesse(ohneKommentar)).toEqual([]);
    for (const s of ['Kranichstieg 3', 'Lotsenwisch 8', 'Rotdornbogen 21']) expect(q).toContain(s);
    const sz = readFileSync('tests/e2e/szenarien.ts', 'utf8');
    const a = sz.slice(sz.indexOf("id: 'A-namensliste'"), sz.indexOf("id: 'A-namensliste'") + 2500);
    const namen = [...a.matchAll(/vorname: '([^']+)',\s*nachname: '([^']+)'/g)].map(
      (m) => `${m[1]} ${m[2]}`,
    );
    expect(namen).toEqual(['Jarne Ostendorp', 'Selin Akgül', 'Hiltrud Ostendorp']);
    expect(verstoesse('', namen)).toEqual([]);
  });

  it('Gegenproben: „Musterweg“ sichtbar, eine echte Straße und ein Name außerhalb der Liste werden rot', () => {
    expect(verstoesse('Musterweg 7, 12345 Musterstadt')).not.toEqual([]);
    expect(verstoesse('Lindenallee 3, 20259 Hamburg')).toEqual([
      'Straße nicht geprüft frei: Lindenallee',
    ]);
    expect(verstoesse('', ['Max Mustermann'])).toEqual([
      'Name nicht in der Namensliste: Max Mustermann',
    ]);
    expect(verstoesse('Kranichstieg 3, Erdgeschoss\n20259 Hamburg', ['Jarne Ostendorp'])).toEqual(
      [],
    );
  });
});
