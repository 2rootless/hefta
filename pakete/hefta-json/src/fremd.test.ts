import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lesenMitGrund, type Lesehilfe } from './index.js';
import { punkteOhnePapier } from './passt.js';

// PC116 (E227): Designs unabhängiger Leser `test/fremd/leser78.py` (DP78, ersetzt leser72 aus DP72), geschrieben nur
// aus Beschreibung, Schema, Beispielen und Stresskatalog, ist die zweite, fremde Probe. Hier urteilt er ohne Papier
// (Punkte 1 bis 6) über die Beispiele und Gegenproben; das Paket muss zum selben Urteil kommen. Punkt 7 mit echten
// PDFs prüft der Stresstest der App (src/vermieter/stress.test.ts). Dazu: Seine CSV gleicht der der Vermieter-Seite.

const PAKET = fileURLToPath(new URL('..', import.meta.url));
const CSV = fileURLToPath(
  new URL('../../../tests/fixtures/export/2-paar-kind-buergin.csv', import.meta.url),
);

function python(): string | null {
  for (const p of ['python3', 'python']) {
    const r = spawnSync(p, ['-E', '-P', '-B', '-c', 'import jsonschema; print(1)'], {
      encoding: 'utf8',
    });
    if (r.status === 0 && r.stdout.trim() === '1') return p;
  }
  return null;
}
const PY = python();

type Urteil = 'gezeigt' | 'passt nicht' | 'abgelehnt' | 'ABSTURZ';
const ORDNER = new URL('../beispiele/', import.meta.url);
const beispiele = readdirSync(ORDNER)
  .filter((n) => n.endsWith('.json'))
  .sort()
  .map((n) => [n, readFileSync(new URL(n, ORDNER), 'utf8')] as const);
const basis = () => JSON.parse(beispiele[1]![1]) as Lesehilfe;
type P = Lesehilfe['haushalt']['personen'][0];
const geaendert = (f: (l: Lesehilfe) => void) => {
  const l = basis();
  f(l);
  return JSON.stringify(l);
};

/** Fälle ohne Papier: Text der Lesehilfe und Seitenzahl der PDF. */
const FAELLE: [nr: string, text: string, seiten: number][] = [
  ...beispiele.map(([n, t]): [string, string, number] => [n, t, JSON.parse(t).seitenzahl]),
  ['seitenzahl', beispiele[1]![1], 17],
  ['fassung 0', geaendert((l) => (l.hefta = 0)), 16],
  ['fassung 2', geaendert((l) => (l.hefta = 2)), 16],
  ['erstellt nur Tag', geaendert((l) => (l.erstellt = '2026-11-18')), 16],
  ['name ≠ vor+nach', geaendert((l) => (l.haushalt.personen[1]!.name = 'Lea M.')), 16],
  [
    'überschneidung',
    geaendert((l) => (l.haushalt.personen[1]!.unterlagen[0]!.seiten_mappe.von = 6)),
    16,
  ],
  [
    'hinter dem Ende',
    geaendert((l) => (l.haushalt.personen[2]!.unterlagen[2]!.seiten_mappe.bis = 17)),
    16,
  ],
  ['zwei Kontakte', geaendert((l) => (l.haushalt.personen[1]!.kontakt = true)), 16],
  [
    'telefon ohne kontakt',
    geaendert((l) =>
      Object.assign(l.haushalt.personen[1]!, {
        telefon: '0171 3920001',
        telefon_e164: '+491713920001',
      }),
    ),
    16,
  ],
  ['telefon ohne e164', geaendert((l) => delete l.haushalt.personen[0]!.telefon_e164), 16],
  ['e164 ohne telefon', geaendert((l) => delete l.haushalt.personen[0]!.telefon), 16],
  [
    'e164 andere Nummer',
    geaendert((l) => (l.haushalt.personen[0]!.telefon_e164 = '+491713920009')),
    16,
  ],
  [
    'telefon nicht fest',
    geaendert((l) => (l.haushalt.personen[0]!.telefon = '+49 (0)171 3920001')),
    16,
  ],
  [
    'TL11 Festnetz',
    geaendert((l) =>
      Object.assign(l.haushalt.personen[0]!, {
        telefon: '040 66969123',
        telefon_e164: '+494066969123',
      }),
    ),
    16,
  ],
  ['land DEU', geaendert((l) => (l.bewerbung.wohnung!.teile!.land = 'DEU')), 16],
  [
    'weggelassen ohne Seiten',
    geaendert((l) => delete l.haushalt.personen[0]!.unterlagen[2]!.vermerke![0]!.seiten_original),
    16,
  ],
  [
    'rolle keine Kennung',
    geaendert((l) => (l.haushalt.personen[1]!.rolle = 'Mit Mieter' as P['rolle'])),
    16,
  ],
  ['zwei Hauptmieter', geaendert((l) => (l.haushalt.personen[1]!.rolle = 'hauptmieter')), 16],
  ['Bürgin zuerst', geaendert((l) => l.haushalt.personen.reverse()), 16],
  ['Seite 1', geaendert((l) => (l.haushalt.personen[0]!.unterlagen[0]!.seiten_mappe.von = 1)), 16],
  [
    'vorname leer',
    geaendert((l) => Object.assign(l.haushalt.personen[0]!, { vorname: '', name: 'Mustermann' })),
    16,
  ],
  ['kennung keine UUID', geaendert((l) => (l.bewerbung.kennung = 'abc')), 16],
  ['mitziehende frei', geaendert((l) => (l.haushalt.mitziehende[0]!.text = 'Unser Sohn')), 16],
  [
    'monat 13',
    geaendert((l) => (l.haushalt.personen[0]!.unterlagen[1]!.monate![0] = '2026-13')),
    16,
  ],
  [
    'monate absteigend',
    geaendert(
      (l) => (l.haushalt.personen[0]!.unterlagen[1]!.monate = ['2026-11', '2026-10', '2026-09']),
    ),
    16,
  ],
  ['modus bleibt unbeachtet', geaendert((l) => Object.assign(l, { modus: 'marktueblich' })), 16],
  ['schritt unbekannt', geaendert((l) => Object.assign(l, { schritt: 'vorab' })), 16],
  ['doppelter Schlüssel', beispiele[1]![1].replace('"hefta": 1,', '"hefta": 1, "hefta": 1,'), 16],
];

function unserUrteil(text: string, seiten: number): Urteil {
  const g = lesenMitGrund(text);
  if (!g.lesehilfe) return 'abgelehnt';
  return punkteOhnePapier(g.lesehilfe, seiten).length ? 'passt nicht' : 'gezeigt';
}

describe.skipIf(!PY)('hefta-json: zweite Probe mit Designs Leser (DP78)', () => {
  const ordner = mkdtempSync(join(tmpdir(), 'hefta-json-fremd-'));
  const liste = FAELLE.map(([nr, text, seiten], i) => {
    const datei = join(ordner, `fall-${i}.json`);
    writeFileSync(datei, text);
    return { nr, datei, seiten };
  });
  const faelleDatei = join(ordner, 'faelle.json');
  const aus = join(ordner, 'aus.json');
  writeFileSync(faelleDatei, JSON.stringify(liste));
  const lauf = spawnSync(
    PY!,
    ['-E', '-P', '-B', join(PAKET, 'test/fremd/gegen78.py'), PAKET, faelleDatei, aus],
    { encoding: 'utf8' },
  );

  it('gegen78.py läuft durch', () => {
    expect(lauf.status, `${lauf.stdout}${lauf.stderr}`).toBe(0);
    expect(lauf.stdout).toContain(`ok: ${FAELLE.length}`);
  });

  it('beide Leser kommen bei jedem Fall zum selben Urteil, und leser78 stürzt nie ab', () => {
    const { faelle } = JSON.parse(readFileSync(aus, 'utf8')) as {
      faelle: Record<string, [Urteil, string]>;
    };
    const anders = FAELLE.filter(
      ([nr, text, seiten]) => unserUrteil(text, seiten) !== faelle[nr]![0],
    ).map(
      ([nr, text, seiten]) =>
        `${nr}: Paket ${unserUrteil(text, seiten)}, leser78 ${faelle[nr]![0]} (${faelle[nr]![1].slice(0, 160)})`,
    );
    expect(anders).toEqual([]);
    for (const [n] of beispiele) expect(faelle[n]![0], n).toBe('gezeigt');
  });

  it('die CSV von leser78 gleicht der Beispieldatei der Vermieter-Seite Zeichen für Zeichen (T5, V20, V23)', () => {
    const { csv } = JSON.parse(readFileSync(aus, 'utf8')) as { csv: Record<string, string> };
    expect(csv['2-paar-kind-buergin.json']).toBe(readFileSync(CSV, 'utf8'));
  });
});
