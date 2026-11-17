import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lesen, passt, type Lesehilfe } from './index.js';

// PC101 (E208): Designs unabhängiger Leser (DP72, `test/fremd/leser72.py`), geschrieben nur aus Beschreibung, Schema
// und Beispielen, ist die zweite, fremde Probe. Er läuft mit `python3 -I`, nur in den Tests. Für jede seiner Proben
// muss das Paket zum selben Urteil kommen; weichen beide ab, ist die Beschreibung an dieser Stelle nicht fertig.

const PAKET = fileURLToPath(new URL('..', import.meta.url));
const CSV = fileURLToPath(
  new URL('../../../tests/fixtures/export/2-paar-kind-buergin.csv', import.meta.url),
);

function python(): string | null {
  for (const p of ['python3', 'python']) {
    const r = spawnSync(p, ['-I', '-c', 'import sys; print(sys.version_info[0])'], {
      encoding: 'utf8',
    });
    if (r.status === 0 && r.stdout.trim() === '3') return p;
  }
  return null;
}
const PY = python();

interface Fall {
  nr: string;
  erwartet: string;
  ist: string;
  text: string;
  seiten: number | null;
}

/** Seite 1 mit allem, was Punkt 3 und 4 verlangen; leser72 prüft diese beiden Punkte nicht. */
function seite1(l: Lesehilfe): string {
  const teile = [l.bewerbung.wohnung?.strasse ?? ''];
  for (const p of l.haushalt.personen) teile.push(p.name, p.telefon ?? '', p.email ?? '');
  return teile.join('\n');
}

describe.skipIf(!PY)('hefta-json: zweite Probe mit Designs Leser (DP72)', () => {
  const ordner = mkdtempSync(join(tmpdir(), 'hefta-json-fremd-'));
  const faelleDatei = join(ordner, 'faelle.json');
  const lauf = spawnSync(
    PY!,
    ['-I', '-B', join(PAKET, 'test/fremd/gegen72.py'), PAKET, CSV, faelleDatei],
    {
      encoding: 'utf8',
    },
  );

  it('alle Proben von gegen72.py sind grün', () => {
    expect(lauf.status, `${lauf.stdout}\n${lauf.stderr}`).toBe(0);
    expect(lauf.stdout).toMatch(/ok: (\d+) von \1/);
  });

  it('beide Leser kommen bei jeder Probe zum selben Urteil', () => {
    const { faelle } = JSON.parse(readFileSync(faelleDatei, 'utf8')) as { faelle: Fall[] };
    expect(faelle.length).toBeGreaterThan(15);
    for (const f of faelle) {
      const l = lesen(f.text);
      const unser =
        !l || l.hefta < 4
          ? 'abgelehnt'
          : passt(l, { seiten: f.seiten ?? l.seitenzahl ?? 0, textSeite1: seite1(l) })
            ? 'gelesen'
            : 'passt nicht';
      expect(unser, `${f.nr}: leser72 sagt „${f.ist}“`).toBe(f.ist);
    }
  });
});
