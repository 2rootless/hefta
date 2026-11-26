import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import katalog from '../../data/regelkatalog.de.json';
import de from '../i18n/de.json';
import { formImText, rollenAnzeige, rollenText } from './regelkatalog';

// PC202: H1 (E363) – unter einem Namen zeigt die App nur „Im Mietvertrag“ oder „Bürgt“, nie „Bürgin“ oder „Bürge“.
// H2 (W32) – kein „Pflicht“ in der Oberfläche. Jede Prüfung mit Gegenprobe.

/** Svelte-Dateien, die die Form nach Geschlecht noch zeigen dürfen, mit Grund. */
const FORM_ERLAUBT: Record<string, string> = {
  // Die Wahl der Form selbst (Bürge, Bürgin, neutral); sie steuert noch „sie“, „er“ oder den Namen in Sätzen
  // (Frage an Design in CP121).
  'PersonFormular.svelte': 'Wahl der Form',
};

function svelteDateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? svelteDateien(join(ordner, e.name))
      : e.name.endsWith('.svelte')
        ? [join(ordner, e.name)]
        : [],
  );
}

function formFunde(dateien: [name: string, text: string][]): string[] {
  return dateien
    .filter(([name, text]) => /\brollenText\(/.test(text) && !(name in FORM_ERLAUBT))
    .map(([name]) => name);
}

function texte(o: unknown, pfad = ''): [string, string][] {
  if (typeof o === 'string') return [[pfad, o]];
  if (o && typeof o === 'object')
    return Object.entries(o).flatMap(([k, v]) => texte(v, pfad ? `${pfad}.${k}` : k));
  return [];
}
const pflichtFunde = (o: unknown) =>
  texte(o)
    .filter(([, v]) => /\bPflicht/i.test(v))
    .map(([k]) => k);

describe('PC202: Rolle unter dem Namen und kein „Pflicht“', () => {
  it('H1: „Im Mietvertrag“ und „Bürgt“, ohne Form nach Geschlecht', () => {
    expect(rollenAnzeige('vertrag')).toBe('Im Mietvertrag');
    expect(rollenAnzeige('buerge')).toBe('Bürgt');
    // PC208 (CP121, 2): Auch in den PDFs gibt es keine Form mehr; eine früher gewählte bleibt ohne Wirkung.
    expect(rollenText('buerge', 'weiblich')).toBe('bürgt');
    expect(rollenText('buerge', 'maennlich')).toBe('bürgt');
    expect(formImText('buerge', 'weiblich')).toBe('neutral');
    expect(formImText('vertrag', 'weiblich')).toBe('weiblich');
  });

  it('H1: keine Beschriftung in der App nimmt die Form nach Geschlecht; Gegenprobe', () => {
    const dateien = svelteDateien('src').map(
      (d) => [d.split(/[\\/]/).at(-1)!, readFileSync(d, 'utf8')] as [string, string],
    );
    expect(dateien.length).toBeGreaterThan(50);
    expect(formFunde(dateien)).toEqual([]);
    expect(
      formFunde([['Selbstauskuenfte.svelte', '<span>{rollenText(m.rolle, m.bezeichnung)}</span>']]),
    ).toEqual(['Selbstauskuenfte.svelte']);
  });

  it('PC205 (E363): kein „Bürgin“ oder „Bürge“ in den Texten der App und des Katalogs; Gegenprobe', () => {
    // „Bürgen“ bleibt in der Mehrzahl erlaubt. PC210: Die Einzahl im Wem- und Wenfall („den Bürgen“, „dem Bürgen“)
    // fällt jetzt auch auf; das hatte die erste Fassung übersehen (DP138, Abschnitt 3).
    const wort =
      /[bB]ürgin(nen)?[^a-zäöüß]|[bB]ürgin(nen)?$|[bB]ürge[^a-zäöüßn]|[bB]ürge$|\b(den|dem|des) Bürgen\b/;
    const funde = (o: unknown) =>
      texte(o)
        .filter(([k, v]) => !k.startsWith('rollen.') && wort.test(v))
        .map(([k]) => k);
    expect(funde(de)).toEqual([]);
    expect(funde(katalog)).toEqual([]);
    expect(
      funde({
        a: 'Die Bürgin könnt ihr abwählen.',
        b: 'Der Bürge unterschreibt.',
        c: 'an den Bürgen wenden',
        d: 'mit dem Bürgen',
        e: 'Bürgen ziehen nicht ein.',
      }),
    ).toEqual(['a', 'b', 'c', 'd']);
  });

  it('H2 (W32): kein „Pflicht“ in den Texten der Oberfläche; Gegenprobe', () => {
    expect(pflichtFunde(de)).toEqual([]);
    expect(pflichtFunde({ buergschaft: { pflicht: 'Pflicht' } })).toEqual(['buergschaft.pflicht']);
  });
});

// DP138, Abschnitt 1: ein Knopf „Person hinzufügen, die bürgt“, auch wenn schon jemand bürgt, mit geschütztem
// Leerzeichen vor „bürgt“ (sonst steht es bei 320 px und 130 % allein in der dritten Zeile).
describe('DP138: Knopf für Bürgen', () => {
  const haushalt = de.einrichtung.haushalt as unknown as Record<string, unknown>;
  const geschuetzt = (s: string) => s.includes(`die${String.fromCharCode(0xa0)}bürgt`);
  it('ein Wortlaut, mit geschütztem Leerzeichen', () => {
    expect(haushalt.buerge).toBe(`Person hinzufügen, die${String.fromCharCode(0xa0)}bürgt`);
    expect(geschuetzt(String(haushalt.buerge))).toBe(true);
    expect(Object.values(haushalt).some((s) => /^Weitere Person hinzufügen/.test(String(s)))).toBe(
      false,
    );
    expect(readFileSync('src/screens/Haushalt.svelte', 'utf-8')).not.toMatch(/buergeWeiterer/);
  });
  it('Gegenprobe: mit normalem Leerzeichen schlägt die Prüfung an', () => {
    expect(geschuetzt('Person hinzufügen, die bürgt')).toBe(false);
  });
});

// PC209/PC210: Die Bürgschaft nach § 771 BGB heißt „gewöhnliche Bürgschaft“. „Ausfallbürgschaft“ ist im Recht eine
// andere Form und steht nirgends mehr, weder in der Eingabe noch auf Blatt 1 oder 2. Der interne Wert `ausfall` bleibt.
describe('PC210: Gewöhnliche Bürgschaft', () => {
  const pdf = readFileSync('src/pdf/buergschaft.ts', 'utf-8');
  const sichtbar = (text: string) => /Ausfallbürgschaft/i.test(text);
  it('kein „Ausfallbürgschaft“ in de.json und im PDF, der neue Name an drei Stellen', () => {
    expect(texte(de).filter(([, v]) => sichtbar(v))).toEqual([]);
    expect(sichtbar(pdf)).toBe(false);
    expect(de.buergschaft.ausfall).toBe('Gewöhnliche Bürgschaft');
    expect(pdf.match(/name: 'Gewöhnliche Bürgschaft'/g)).toHaveLength(2);
  });
  it('Gegenprobe: der alte Name würde gefunden', () => {
    expect(sichtbar("name: 'Ausfallbürgschaft'")).toBe(true);
  });
});
