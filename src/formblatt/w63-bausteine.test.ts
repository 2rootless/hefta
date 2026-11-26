import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// W63 (PC204): Bürgschaft und Selbstauskunft nutzen in der App dieselben Bausteine für Teil, Feld, Anschrift und den
// gesperrten Knopf. Gegenprobe: Ein eigener Teil oder ein eigenes Anschriftfeld in nur einem der beiden wird rot.

const BAUSTEINE = [
  "import FormTeil from '../formblatt/FormTeil.svelte'",
  "import AnschriftFelder from '../formblatt/AnschriftFelder.svelte'",
] as const;

/** Was in einem Formular gegen W63 verstößt: fehlende gemeinsame Bausteine, eigene Teil-Karten oder Anschriftzeilen. */
function funde(name: string, quelle: string): string[] {
  const aus: string[] = [];
  for (const b of BAUSTEINE) if (!quelle.includes(b)) aus.push(`${name}: ohne ${b.split(' ')[1]}`);
  if (/<section[^>]*class="teil/.test(quelle) || /class="teil zu"/.test(quelle))
    aus.push(`${name}: eigener Teil statt FormTeil`);
  if (/placeholder=\{t\('buergschaft\.platzAnschrift'\)\}/.test(quelle))
    aus.push(`${name}: Anschrift in einem Feld statt drei (W60)`);
  if (!quelle.includes('Aktionsleiste')) aus.push(`${name}: ohne Aktionsleiste`);
  return aus;
}

const lesen = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('W63: gleiche Bausteine in Bürgschaft und Selbstauskunft', () => {
  it('beide Formulare in der App bauen auf dem Formblatt', () => {
    const selbst =
      lesen('../ui/SelbstauskunftAkkordeon.svelte') +
      lesen('../screens/SelbstauskunftSeite.svelte');
    const buerg = lesen('../screens/BuergschaftSeite.svelte');
    expect(funde('Selbstauskunft', selbst.replaceAll("from './", "from '../ui/"))).toEqual([]);
    expect(funde('Bürgschaft', buerg)).toEqual([]);
  });

  it('Gegenprobe: ein eigener Teil oder eine Anschrift in einem Feld wird rot', () => {
    const buerg = lesen('../screens/BuergschaftSeite.svelte');
    expect(
      funde('Bürgschaft', buerg.replace('<FormTeil', '<section class="teil offen"><FormTeil')),
    ).toContain('Bürgschaft: eigener Teil statt FormTeil');
    expect(
      funde('Bürgschaft', buerg + "<input placeholder={t('buergschaft.platzAnschrift')} />"),
    ).toContain('Bürgschaft: Anschrift in einem Feld statt drei (W60)');
    expect(
      funde('Bürgschaft', buerg.replace("import FormTeil from '../formblatt/FormTeil.svelte'", '')),
    ).toContain('Bürgschaft: ohne FormTeil');
  });
});
