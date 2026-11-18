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
//   - Designs fremder Leser `leser78.py` (pypdf und pdfplumber), unverändert, über `urteil78.py`.
// Die Vermieter-Seite muss jeden Fall so entscheiden wie die Spalte „soll“ des Katalogs. Wo leser78 anders
// entscheidet, braucht es einen bekannten Grund (abweichung78); jede neue Abweichung macht den Test rot.
//
// Die Mappen baut dieser Test selbst, mit Deckblatt in Fassung 1 (V5 bis V9: Verzeichnis „– Seite n“, „Fassung n
// vom …“). Designs Proben aus DP76 und DP78 haben das alte Deckblatt von 2.0 und gehen darum hier nicht ein; ihre
// Lesehilfen sind die Grundlage (tests/fixtures/stress/grundlagen.json): LH0 aus DP73 (Lea, Aylin), BSP0 die
// Beispiel-Mappe (Max, Lea, Petra, ein Kind). SE1 und SE2 nutzen Designs echte 2.0-Mappe aus DP78, Lauf B.
//
// STRESS_TABELLE=<pfad> schreibt die Tabelle aller Fälle als Markdown (für den Bericht an Planung).

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

/**
 * Fälle, in denen leser78 nur wegen V6 „passt nicht“ sagt; dort prüft sein Urteil nichts, bis er V6 kennt.
 * S18, A8, A9, A10: Der Angriff ändert eine Zeile im Verzeichnis; der Grund ist darum derselbe wie bei V6.
 * S11: leser78 nimmt einen Namen in NFD an (Katalog DP76: „gelesen“); die Seite lehnt ihn ab (E223, V16: nur NFC).
 */
const NUR_V6 = ['S18', 'A8', 'A9', 'A10', 'S11'];

/**
 * Warum leser78 anders entscheidet als die Spalte „soll“; null, wenn kein bekannter Grund passt. Die Vermieter-Seite
 * folgt der Planung (E223); Design bekommt jeden Grund im Bericht.
 */
function abweichung78(z: { f: Fall; fremd?: [Urteil, string] }): string | null {
  const [u, grund] = z.fremd ?? ['ABSTURZ', ''];
  const teile = grund.split('; ').filter(Boolean);
  // V6: leser78 erwartet die Seitenzahl als eigene Zeile („Selbstauskunft“, darunter „2“), wie im Deckblatt von 2.0.
  // Fassung 1 setzt „Selbstauskunft – Seite 2“ in eine Zeile (E223, V6).
  if (
    z.f.soll === 'gezeigt' &&
    u === 'passt nicht' &&
    teile.length &&
    teile.every((t) => t.endsWith('steht so nicht im Verzeichnis'))
  )
    return 'V6';
  return null;
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

  it('der Katalog ist vollständig: 95 Fälle, jede Nummer einmal', () => {
    expect(zeilen.length).toBe(95);
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

  it.skipIf(!PY)('leser78 stürzt nie ab und weicht nur aus bekanntem Grund ab', () => {
    expect(
      zeilen.filter((z) => z.fremd?.[0] === 'ABSTURZ').map((z) => `${z.f.nr}: ${z.fremd![1]}`),
    ).toEqual([]);
    const ohneGrund = zeilen
      .filter((z) => z.f.soll !== '?' && gez(z.fremd![0]) !== z.f.soll && !abweichung78(z))
      .map(
        (z) => `${z.f.nr} soll ${z.f.soll}, leser78 ${z.fremd![0]}: ${z.fremd![1].slice(0, 200)}`,
      );
    expect(ohneGrund).toEqual([]);
    // Wo leser78 richtig „passt nicht“ sagt, nicht nur wegen V6: sonst wäre sein Urteil Zufall.
    const nurV6 = zeilen
      .filter((z) => z.f.soll === 'nicht' && z.fremd![0] === 'passt nicht')
      .filter((z) =>
        z.fremd![1].split('; ').every((t) => t.endsWith('steht so nicht im Verzeichnis')),
      )
      .map((z) => z.f.nr);
    expect(nurV6, 'leser78 sagt hier nur wegen V6 „passt nicht“').toEqual(NUR_V6);
  });
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
    '| Nr. | Fall | soll | Vermieter-Seite | leser78 | Abweichung leser78 | Grund (Seite) |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const x of zeilen)
    z.push(
      `| ${x.f.nr} | ${x.f.was.replaceAll('|', '/')} | ${x.f.soll} | ${x.unser.urteil} | ${x.fremd?.[0] ?? '–'} | ${x.fremd && x.f.soll !== '?' && gez(x.fremd[0]) !== x.f.soll ? (abweichung78(x) ?? 'ohne Grund') : ''} | ${x.unser.grund.slice(0, 140).replaceAll('|', '/')} |`,
    );
  return z.join(ZEILE) + ZEILE;
}
