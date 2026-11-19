import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  lesenMitGrund,
  monateText,
  pruefen,
  telefonPasst,
} from '../../pakete/hefta-json/src/index';
import { katalogLaden, mappeBauen, type Fall, type Urteil } from '../../tests/stress/katalog';
import { anhangLesen } from '../pdf/anhang';
import { SPALTEN, zelle } from './export';
import { papierLesen } from './papier';
import { lesehilfePasst } from './regel';

const ZEILE = String.fromCharCode(10);

// Stresstest der Lesehilfe, Fassung 1 (PC110, PC113, PC116; Katalog DP76 und DP78 von Design). Jeder Fall ist eine
// echte PDF-Mappe mit Anhang `hefta.json`. Zwei Leser urteilen über dieselbe Datei:
//   - die Vermieter-Seite: PDF.js, `papierLesen()`, das Paket `hefta-json` (`lesenMitGrund`, `pruefen`) und
//     `lesehilfePasst()` der Seite, die zum selben Ergebnis kommen muss;
//   - Designs fremder Leser `leser78.py` (pypdf und pdfplumber), unverändert in Fassung 4 (DP82, PC126), über
//     `urteil78.py`.
// Die Vermieter-Seite muss jeden Fall so entscheiden wie die Spalte „soll“ des Katalogs. Seit Fassung 3 kennt leser78
// die Zeile im Verzeichnis nach V6; die Ausnahme dafür ist weg (PC121): Paket und leser78 urteilen in jedem Fall
// gleich, jede Abweichung macht den Test rot.
//
// Die Mappen baut dieser Test selbst, mit Deckblatt in Fassung 1 (V5 bis V9: Verzeichnis „– Seite n“, „Fassung n
// vom …“). Designs Proben aus DP76 und DP78 haben das alte Deckblatt von 2.0 und gehen darum hier nicht ein; ihre
// Lesehilfen sind die Grundlage (tests/fixtures/stress/grundlagen.json): LH0 aus DP73 (Lea, Aylin), BSP0 die
// Beispiel-Mappe (Max, Lea, Petra, ein Kind). SE1 und SE2 nutzen Designs echte 2.0-Mappe aus DP78, Lauf B.
//
// STRESS_TABELLE=<pfad> schreibt die Tabelle aller Fälle als Markdown (für den Bericht an Planung).
// STRESS_MAPPEN=<ordner> legt dort jede gebaute Mappe als <Nr>.pdf ab (für Design, PC122 und CP71 D3).

interface Ergebnis {
  urteil: Urteil;
  grund: string;
  /** `lesehilfePasst()` der Seite stimmt mit `pruefen()` des Pakets überein. */
  einig: boolean;
}

async function unserUrteil(bytes: Uint8Array): Promise<Ergebnis> {
  const aufgabe = pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 });
  const dok = await aufgabe.promise;
  try {
    const anh = await dok.getAttachments();
    const t = anh ? [...anh.entries()].find(([, a]) => a.filename === 'hefta.json') : undefined;
    const roh = t ? await dok.getAttachmentContent(t[0]) : null;
    if (!roh) return { urteil: 'abgelehnt', grund: 'kein Anhang', einig: true };
    const g = lesenMitGrund(roh);
    const app = anhangLesen(roh);
    if (!g.lesehilfe) return { urteil: 'abgelehnt', grund: g.grund, einig: app === null };
    const papier = await papierLesen(dok, g.lesehilfe);
    const gruende = pruefen(g.lesehilfe, { ...papier, seiten: dok.numPages });
    const seite = !!app && lesehilfePasst(app, dok.numPages, papier);
    return gruende.length
      ? { urteil: 'passt nicht', grund: gruende.join('; '), einig: !seite }
      : { urteil: 'gezeigt', grund: '', einig: seite };
  } catch (e) {
    return { urteil: 'ABSTURZ', grund: String(e).slice(0, 200), einig: false };
  } finally {
    await aufgabe.destroy();
  }
}

// ---------------------------------------------------------------- Lauf
function python(): string | null {
  for (const p of ['python3', 'python']) {
    const r = spawnSync(
      p,
      ['-E', '-P', '-B', '-c', 'import pypdf, pdfplumber, jsonschema; print(1)'],
      {
        encoding: 'utf8',
      },
    );
    if (r.status === 0 && r.stdout.trim() === '1') return p;
  }
  return null;
}
const PY = python();

interface Zeile {
  f: Fall;
  datei: string;
  unser: Ergebnis;
  fremd?: [Urteil, string];
}
const gez = (u: string) => (u === 'gezeigt' ? 'gezeigt' : u === 'ABSTURZ' ? 'ABSTURZ' : 'nicht');

describe('Stresstest der Lesehilfe, Fassung 1 (DP76, DP78)', () => {
  const zeilen: Zeile[] = [];
  const ordner = mkdtempSync(join(tmpdir(), 'hefta-stress-'));

  beforeAll(async () => {
    for (const f of await katalogLaden()) {
      const bytes = await mappeBauen(f);
      const datei = join(ordner, `${f.nr}.pdf`);
      writeFileSync(datei, bytes);
      if (process.env.STRESS_MAPPEN)
        writeFileSync(join(process.env.STRESS_MAPPEN, `${f.nr}.pdf`), bytes);
      zeilen.push({ f, datei, unser: await unserUrteil(bytes) });
    }
    if (PY) {
      const liste = join(ordner, 'liste.json');
      const aus = join(ordner, 'urteil78.json');
      writeFileSync(liste, JSON.stringify(zeilen.map((z) => z.datei)));
      const lauf = spawnSync(
        PY,
        [
          '-E',
          '-P',
          '-B',
          'pakete/hefta-json/test/fremd/urteil78.py',
          'pakete/hefta-json/schema.json',
          liste,
          aus,
        ],
        { encoding: 'utf8', maxBuffer: 1 << 26 },
      );
      if (lauf.status !== 0) throw new Error(`urteil78.py: ${lauf.stdout}${lauf.stderr}`);
      const u = JSON.parse(readFileSync(aus, 'utf8')) as Record<string, [Urteil, string]>;
      for (const z of zeilen) z.fremd = u[z.datei];
    }
    if (process.env.STRESS_TABELLE) writeFileSync(process.env.STRESS_TABELLE, tabelle(zeilen));
  }, 300_000);

  it('der Katalog ist vollständig: 96 Fälle (mit V7a, PC126), jede Nummer einmal', () => {
    expect(zeilen.length).toBe(96);
    expect(new Set(zeilen.map((z) => z.f.nr)).size).toBe(zeilen.length);
  });

  it('die Vermieter-Seite entscheidet jeden Fall wie „soll“, und Seite und Paket sind sich einig', () => {
    const falsch = zeilen
      .filter(
        (z) =>
          z.unser.urteil === 'ABSTURZ' || (z.f.soll !== '?' && gez(z.unser.urteil) !== z.f.soll),
      )
      .map(
        (z) => `${z.f.nr} soll ${z.f.soll}, ist ${z.unser.urteil}: ${z.unser.grund.slice(0, 160)}`,
      );
    expect(falsch).toEqual([]);
    expect(zeilen.filter((z) => !z.unser.einig).map((z) => z.f.nr)).toEqual([]);
  });

  it('die beiden offenen Fälle („?“) entscheidet die Seite streng', () => {
    const offen = Object.fromEntries(
      zeilen.filter((z) => z.f.soll === '?').map((z) => [z.f.nr, z.unser.urteil]),
    );
    expect(offen).toEqual({ S21: 'abgelehnt', S30b: 'passt nicht' });
  });

  it.skipIf(!PY)(
    'leser78 (Fassung 4) stürzt nie ab und urteilt in jedem Fall wie die Seite (PC121)',
    () => {
      expect(
        zeilen.filter((z) => z.fremd?.[0] === 'ABSTURZ').map((z) => `${z.f.nr}: ${z.fremd![1]}`),
      ).toEqual([]);
      expect(zeilen.filter((z) => !z.fremd).map((z) => z.f.nr)).toEqual([]);
      const anders = zeilen
        .filter((z) => gez(z.fremd![0]) !== gez(z.unser.urteil))
        .map(
          (z) =>
            `${z.f.nr} Seite ${z.unser.urteil}, leser78 ${z.fremd![0]}: ${z.fremd![1].slice(0, 200)}`,
        );
      expect(anders).toEqual([]);
      // Gegenprobe der Ausnahme: Wo leser78 „passt nicht“ sagt, nennt er nie nur die Form der Zeile, wenn die Seite
      // die Mappe zeigt.
      expect(
        zeilen
          .filter((z) => z.unser.urteil === 'gezeigt' && z.fremd![0] !== 'gezeigt')
          .map((z) => z.f.nr),
      ).toEqual([]);
    },
  );
});

describe('Stresstest, Teil F: Telefon nach E222 und Tabelle nach V20', () => {
  it('TR1 bis TR12: die Regel für Leser', () => {
    const tr: [string, string, string, boolean][] = [
      ['TR1', '0171 3920001', '+491713920001', true],
      ['TR2', '040 66969123', '+494066969123', true],
      ['TR3', '+44 20 7946 0018', '+442079460018', true],
      ['TR4', '+49 0171 3920001', '+491713920001', false],
      ['TR5', '+49 171 3920001', '+491713920001', false],
      ['TR6', '+44 020 7946 0018', '+442079460018', false],
      ['TR7', '0171 3920001', '+491713920009', false],
      ['TR8', '0171-3920001', '+491713920001', false],
      ['TR9', '0171  3920001', '+491713920001', false],
      ['TR10', '0049 171 3920001', '+491713920001', false],
      ['TR11', '0171 TAXI', '+491713920001', false],
      ['TR12', '0171 3920001', '491713920001', false],
    ];
    for (const [nr, t, e, soll] of tr) expect(telefonPasst(t, e), nr).toBe(soll);
  });

  it('C1 bis C4: CSV ohne modus, mit schritt; telefon_e164 ohne Apostroph, eine Formel mit', () => {
    expect(SPALTEN).not.toContain('modus');
    expect(SPALTEN).toContain('schritt');
    expect(zelle('+44 20 7946 0018', 'telefon')).toBe("'+44 20 7946 0018");
    expect(zelle('+442079460018', 'telefon_e164')).toBe('+442079460018');
    expect(zelle('=1+1', 'telefon_e164')).toBe("'=1+1");
  });

  it('S25: Monate über den Jahreswechsel', () => {
    expect(monateText(['2026-12', '2027-01'])).toBe('Dezember 2026 bis Januar 2027');
  });
});

function tabelle(zeilen: Zeile[]): string {
  const z = [
    '| Nr. | Fall | soll | Vermieter-Seite | leser78 | leser78 anders | Grund (Seite) |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const x of zeilen)
    z.push(
      `| ${x.f.nr} | ${x.f.was.replaceAll('|', '/')} | ${x.f.soll} | ${x.unser.urteil} | ${x.fremd?.[0] ?? '–'} | ${x.fremd && gez(x.fremd[0]) !== gez(x.unser.urteil) ? 'anders' : ''} | ${x.unser.grund.slice(0, 140).replaceAll('|', '/')} |`,
    );
  return z.join(ZEILE) + ZEILE;
}
