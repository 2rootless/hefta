import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { inDerStrasse } from '../domain/bewerben';
import { mappenDateiname } from '../domain/export';

// Robustheitskatalog (E232, PC120 Abschnitt 5, PC123 mit dem Dokument der Planung): ein Korpus je Bereich, angelegt
// für 2.0 mit dem, was es schon gibt. tests/robustheit/bereiche.json nennt je Bereich Name, Messgröße, Quellen und
// Quote. Dieser Test hält das Verzeichnis ehrlich: Jede Quelle gibt es, die Zahlen stimmen, wo sie sich zählen lassen,
// die Fälle, die nur hier liegen, laufen, und die Quoten, die sich ohne Browser rechnen lassen (I und N aus dem Katalog
// PC117), sinken nie unter die erste Zahl von 2.0 (Regel 1 und 4). Richtig oder ehrlich leer zählt als richtig, ein
// falscher Wert als falsch (Regel 5). Ab jetzt wird jeder Fehler zuerst ein Fall.
// ROBUST_TABELLE=<pfad> schreibt die Übersicht mit den Quoten als Markdown (für die CP und die Release-Mappe).

vi.mock('../app/router.svelte', () => ({ gehe: () => {} }));
vi.mock('../app/plattform', () => ({ linkWegDa: () => true }));

const { entwurf, entwurfAusVorschau, entwurfVergessen } = await import('../ui/neuesHeft.svelte');
const { heftTitel } = await import('../domain/heftKarte');
const { adresseZeilen } = await import('../domain/adresse');

interface Quelle {
  datei: string;
  was: string;
  faelle: number;
  soll?: string;
}
interface Quote {
  was: string;
  richtig: number | null;
  von: number | null;
}
interface Bereich {
  bereich: string;
  name: string;
  messgroesse: string;
  quote: Quote[];
  quellen: Quelle[];
}
const verzeichnis = JSON.parse(readFileSync('tests/robustheit/bereiche.json', 'utf8')) as {
  bereiche: Bereich[];
  spaeter: { bereich: string }[];
};
const bereich = (b: string) => verzeichnis.bereiche.find((x) => x.bereich === b)!;

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

interface Inserat {
  nr: string;
  url: string;
  h1: string;
  text: string;
  geteilt?: string;
}
interface Soll {
  nr: string;
  adresse: string | null;
  warm: number | null;
  zimmer: number | null;
  flaeche: number | null;
}
const katalog = (
  JSON.parse(readFileSync('tests/fixtures/inserate/katalog-pc117.json', 'utf8')) as {
    faelle: Inserat[];
  }
).faelle;
const soll = (
  JSON.parse(readFileSync('tests/robustheit/i/katalog-soll.json', 'utf8')) as { faelle: Soll[] }
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

/** Was Hefta aus einem Inserat des Katalogs liest, auf dem Weg „Link einsetzen → Vorschau“ (wie katalogPc117.test). */
function gelesen(f: Inserat) {
  entwurfVergessen();
  if (f.geteilt) entwurf.geteilterText = f.geteilt;
  entwurfAusVorschau({ zustand: 'ok', text: f.text, url: f.url, h1: f.h1 } as never, f.url);
  const a = entwurf.angaben!;
  const strasse = (adresseZeilen(entwurf.adresse)[0] ?? '').replace(/\u00a0/g, ' ').trim() || null;
  const name = heftTitel({
    adresse: entwurf.adresse,
    angaben: a,
    createdAt: '2026-11-18T10:00:00Z',
  }).text;
  return { strasse, warm: a.warm, zimmer: a.zimmer, flaeche: a.flaeche, name };
}

const gleich = (a: string | number, b: string | number) =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.01 : a === b;

/** Die Quoten aus dem Katalog: I je Feld (richtig oder ehrlich leer; dazu Treffer), N je Name. */
function katalogQuoten(sollListe: Soll[] = soll) {
  let felder = 0;
  let richtig = 0;
  let nennbar = 0;
  let treffer = 0;
  let namen = 0;
  const falsch: string[] = [];
  const titelAlsName: string[] = [];
  for (const f of katalog) {
    const s = sollListe.find((x) => x.nr === f.nr)!;
    const g = gelesen(f);
    const paare: [string, string | number | null, string | number | null][] = [
      ['Adresse', g.strasse, s.adresse],
      ['Warmmiete', g.warm, s.warm],
      ['Zimmer', g.zimmer, s.zimmer],
      ['Fläche', g.flaeche, s.flaeche],
    ];
    for (const [feld, ist, sollWert] of paare) {
      felder++;
      if (sollWert !== null) nennbar++;
      if (ist === null || ist === undefined) richtig++;
      else if (sollWert !== null && gleich(ist, sollWert)) {
        richtig++;
        treffer++;
      } else falsch.push(`${f.nr} ${feld}: ${ist} statt ${sollWert ?? 'leer'}`);
    }
    // N: Straße und Hausnummer, sonst ein gebauter Name; der Titel des Inserats zählt nicht (Messgröße N).
    const nameRichtig = g.strasse
      ? s.adresse !== null && g.name === s.adresse
      : g.name.trim() !== f.h1.trim();
    if (nameRichtig) namen++;
    else titelAlsName.push(`${f.nr}: ${g.name}`);
  }
  return { felder, richtig, nennbar, treffer, namen, falsch, titelAlsName };
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
    for (const b of verzeichnis.bereiche) expect(b.messgroesse, b.bereich).not.toBe('');
    const falsch: string[] = [];
    for (const b of verzeichnis.bereiche)
      for (const q of b.quellen) {
        if (!existsSync(q.datei) || (q.soll && !existsSync(q.soll))) {
          falsch.push(`${b.bereich}: ${q.datei} fehlt`);
          continue;
        }
        const n = gezaehlt(q);
        if (n !== null && n !== q.faelle)
          falsch.push(`${b.bereich}: ${q.datei} hat ${n}, nicht ${q.faelle}`);
      }
    expect(falsch).toEqual([]);
    // Jeder Fall des Katalogs hat ein Soll, und jedes Soll gehört zu einem Fall.
    expect(soll.map((s) => s.nr)).toEqual(katalog.map((f) => f.nr));
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

  it('Bereiche I und N aus dem Katalog: die Quoten sinken nicht unter die erste Zahl von 2.0', () => {
    const q = katalogQuoten();
    const [iFelder, iTreffer] = bereich('I').quote;
    const [nNamen] = bereich('N').quote;
    expect(q.felder).toBe(iFelder!.von);
    expect(q.richtig, `I: falsch gelesen: ${q.falsch.join('; ')}`).toBeGreaterThanOrEqual(
      iFelder!.richtig!,
    );
    expect(q.nennbar).toBe(iTreffer!.von);
    expect(q.treffer).toBeGreaterThanOrEqual(iTreffer!.richtig!);
    expect(q.namen, `N: Titel als Name: ${q.titelAlsName.join('; ')}`).toBeGreaterThanOrEqual(
      nNamen!.richtig!,
    );
  });

  it('Gegenprobe: ein anderer Wert als das Soll zählt als falsch, ein leerer als richtig (Regel 5)', () => {
    const vorher = katalogQuoten();
    // Soll N01 Warmmiete 851 statt 850: Hefta liest 850, das ist jetzt ein falscher Wert.
    const anders = soll.map((x) => (x.nr === 'N01' ? { ...x, warm: 851 } : x));
    const mitAnders = katalogQuoten(anders);
    expect(mitAnders.richtig).toBe(vorher.richtig - 1);
    expect(mitAnders.falsch).toContain('N01 Warmmiete: 850 statt 851');
    // Soll N05 mit Adresse: Hefta liest dort keine, das bleibt ehrlich leer und damit richtig.
    const leer = soll.map((x) => (x.nr === 'N05' ? { ...x, adresse: 'Musterweg 7' } : x));
    const mitLeer = katalogQuoten(leer);
    expect(mitLeer.richtig).toBe(vorher.richtig);
    expect(mitLeer.nennbar).toBe(vorher.nennbar + 1);
    expect(mitLeer.treffer).toBe(vorher.treffer);
  });

  it.skipIf(!process.env.ROBUST_TABELLE)('schreibt die Übersicht', () => {
    const q = katalogQuoten();
    const zahl = (x: Quote, b: string, i: number) => {
      if (b === 'I' && i === 0) return `${q.richtig} von ${q.felder}`;
      if (b === 'I' && i === 1) return `${q.treffer} von ${q.nennbar}`;
      if (b === 'N' && i === 0) return `${q.namen} von ${katalog.length}`;
      return x.richtig === null ? 'offen' : `${x.richtig} von ${x.von}`;
    };
    const z = ['| Bereich | Messgröße | Quote 2.0 | Quellen |', '|---|---|---|---|'];
    for (const b of verzeichnis.bereiche) {
      const quoten = b.quote.length
        ? b.quote.map((x, i) => `${x.was}: **${zahl(x, b.bereich, i)}**`).join('<br>')
        : 'noch keine Fälle';
      const quellen = b.quellen.length
        ? b.quellen.map((x) => `\`${x.datei}\` (${x.faelle})`).join('<br>')
        : '–';
      z.push(`| ${b.bereich}. ${b.name} | ${b.messgroesse} | ${quoten} | ${quellen} |`);
    }
    z.push('', `Falsch gelesen (I): ${q.falsch.join('; ') || 'nichts'}`);
    z.push('', `Name nicht Straße und nicht gebaut (N): ${q.titelAlsName.join('; ') || 'keiner'}`);
    writeFileSync(process.env.ROBUST_TABELLE!, z.join('\n') + '\n');
  });
});
