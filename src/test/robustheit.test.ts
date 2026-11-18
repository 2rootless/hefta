import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inDerStrasse } from '../domain/bewerben';
import { mappenDateiname } from '../domain/export';

// Robustheitskatalog (E232, PC120 Abschnitt 5): ein Korpus je Bereich, angelegt für 2.0 mit dem, was es schon gibt.
// tests/robustheit/bereiche.json nennt je Bereich die Quellen und wie viele Fälle sie haben. Dieser Test hält das
// Verzeichnis ehrlich: Jede Quelle gibt es, die Zahlen stimmen, wo sie sich zählen lassen, und die Fälle, die nur hier
// liegen (Bereich N, Straßenarten), laufen. Ab jetzt wird jeder Fehler zuerst ein Fall.
// ROBUST_TABELLE=<pfad> schreibt die Übersicht als Markdown (für den Bericht an Planung).

interface Quelle {
  datei: string;
  was: string;
  faelle: number;
}
interface Bereich {
  bereich: string;
  name: string;
  quote: number | null;
  quellen: Quelle[];
}
const verzeichnis = JSON.parse(readFileSync('tests/robustheit/bereiche.json', 'utf8')) as {
  bereiche: Bereich[];
  spaeter: { bereich: string }[];
};

interface StrassenFall {
  nr: string;
  was: string;
  adresse: string;
  soll_satz: string;
  soll_datei?: string;
}
const strassen = (
  JSON.parse(readFileSync('tests/robustheit/n/strassenarten.json', 'utf8')) as {
    faelle: StrassenFall[];
  }
).faelle;

/** Fälle einer Quelle, wo sie sich ohne Browser zählen lassen; sonst null. */
function gezaehlt(q: Quelle): number | null {
  const text = readFileSync(q.datei, 'utf8');
  if (q.datei.endsWith('katalog-pc117.json'))
    return (JSON.parse(text) as { faelle: unknown[] }).faelle.length;
  if (q.datei.endsWith('strassenarten.json')) return strassen.length;
  if (q.datei.endsWith('telefon.test.ts')) return new Set(text.match(/\bTL\d+\b/g)).size;
  if (q.datei.endsWith('stress.test.ts')) return new Set(text.match(/'TR\d+'/g)).size;
  return null;
}

describe('Robustheitskatalog (E232)', () => {
  it('hat die Bereiche I, N, P, T, U, L, M, B, später K; jede Quelle gibt es, die Zahlen stimmen', () => {
    expect(verzeichnis.bereiche.map((b) => b.bereich)).toEqual([
      'I',
      'N',
      'P',
      'T',
      'U',
      'L',
      'M',
      'B',
    ]);
    expect(verzeichnis.spaeter.map((b) => b.bereich)).toEqual(['K']);
    const falsch: string[] = [];
    for (const b of verzeichnis.bereiche)
      for (const q of b.quellen) {
        if (!existsSync(q.datei)) {
          falsch.push(`${b.bereich}: ${q.datei} fehlt`);
          continue;
        }
        const n = gezaehlt(q);
        if (n !== null && n !== q.faelle)
          falsch.push(`${b.bereich}: ${q.datei} hat ${n}, nicht ${q.faelle}`);
      }
    expect(falsch).toEqual([]);
  });

  it('Bereich N, Straßenarten (PC120): Präposition und Dateiname wie „soll“', () => {
    const falsch = strassen
      .map((f) => {
        // Einzeilig mit Postleitzahl 00100 (W7, Fassung 25); die Präposition hängt nur am Teil vor dem Komma.
        const satz = inDerStrasse(f.adresse);
        const datei = f.soll_datei ? mappenDateiname(['Mustermann'], f.adresse) : undefined;
        return satz !== f.soll_satz || datei !== f.soll_datei
          ? `${f.nr}: „${satz}“, ${datei ?? '–'}`
          : null;
      })
      .filter(Boolean);
    expect(falsch).toEqual([]);
  });

  it('Gegenprobe: ein falsches „soll“ würde auffallen', () => {
    const f = strassen.find((x) => x.adresse.startsWith('Musterplatz 1'))!;
    expect(f.soll_satz).toMatch(/^am /);
    expect(inDerStrasse(f.adresse)).not.toMatch(/^im /);
  });

  it.skipIf(!process.env.ROBUST_TABELLE)('schreibt die Übersicht', () => {
    const z = ['| Bereich | Name | Quelle | Fälle | Quote |', '|---|---|---|---|---|'];
    for (const b of verzeichnis.bereiche)
      if (!b.quellen.length) z.push(`| ${b.bereich} | ${b.name} | – | 0 | ${b.quote ?? 'offen'} |`);
      else
        for (const q of b.quellen)
          z.push(
            `| ${b.bereich} | ${b.name} | \`${q.datei}\`: ${q.was} | ${q.faelle} | ${b.quote ?? 'offen'} |`,
          );
    writeFileSync(process.env.ROBUST_TABELLE!, z.join('\n') + '\n');
  });
});
