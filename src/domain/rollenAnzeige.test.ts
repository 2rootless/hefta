import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import katalog from '../../data/regelkatalog.de.json';
import de from '../i18n/de.json';
import { rollenAnzeige, rollenText } from './regelkatalog';

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
    // Die Form für die PDFs bleibt.
    expect(rollenText('buerge', 'weiblich')).toBe('Bürgin');
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
    // „Bürgen“ bleibt erlaubt: Mehrzahl und das Rechtswort in den Sätzen zur Art („an den Bürgen wenden“).
    const wort = /[bB]ürgin(nen)?[^a-zäöüß]|[bB]ürgin(nen)?$|[bB]ürge[^a-zäöüßn]|[bB]ürge$/;
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
        c: 'an den Bürgen',
      }),
    ).toEqual(['a', 'b']);
  });

  it('H2 (W32): kein „Pflicht“ in den Texten der Oberfläche; Gegenprobe', () => {
    expect(pflichtFunde(de)).toEqual([]);
    expect(pflichtFunde({ buergschaft: { pflicht: 'Pflicht' } })).toEqual(['buergschaft.pflicht']);
  });
});
