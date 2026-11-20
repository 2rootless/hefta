// Bindung an das Papier (Abschnitt 11, Punkt 7; E223, V1 bis V12, V19, V22): Was ein Leser zeigt, steht auf dem
// Deckblatt oder im Verzeichnis „Was beiliegt“, also auf den Seiten vor der ersten Unterlage (V1). Gelesen wird der
// Text in der Reihenfolge des Inhalts, wie PDF.js ihn mit `getTextContent()` liefert, Zeile für Zeile (V2).
// Gleiche Regeln wie Designs fremder Leser `test/fremd/leser78.py`, Funktion `papier()`.
import { VERZEICHNIS } from './listen.js';
import type { Lesehilfe, Person, Unterlage, Vermerk } from './typen.js';

const ZEILE = String.fromCharCode(10);
const WEICH = String.fromCharCode(0xad);
const GESCHUETZT = [String.fromCharCode(0xa0), String.fromCharCode(0x202f)];
export const MONATSNAMEN = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];
/** E227 (DP78): fester Satz je Schritt, direkt unter dem Satz zum Haushalt. Eine Änderung heißt Fassung 2. */
export const SCHRITT_SATZ: Readonly<Record<string, string>> = {
  besichtigung: 'Zur Besichtigung nur dieses Deckblatt. Die Unterlagen folgen auf Wunsch.',
  will_wohnung:
    'Zum Mietwunsch ohne Einkommens- und Bonitätsnachweise. Beide folgen nach der Zusage.',
  zusage: 'Zum Vertrag ohne Ausweiskopie. Der Ausweis wird bei der Unterschrift vorgezeigt.',
};
/** V5: feste Überschriften auf dem Deckblatt, je als eigene Zeile. Sie gehören zum Format. */
export const UEBERSCHRIFTEN = [
  'im mietvertrag',
  'ziehen mit ein',
  'bürgt',
  'kontakt',
  'was beiliegt',
];
const ENDE = ['fassung ', 'erstellt mit hefta', 'seite 1 von'];

/** V3, V4: NFC, ohne weiche Trennstriche, geschützte Leerzeichen als Leerzeichen, Leerraum als ein Leerzeichen, klein. */
export function normiert(text: string): string {
  let t = (text ?? '').normalize('NFC').replaceAll(WEICH, '');
  for (const g of GESCHUETZT) t = t.replaceAll(g, ' ');
  return t.replace(/\s+/g, ' ').trim().toLowerCase();
}

const WORTZEICHEN = "[\\p{L}\\p{M}\\p{N}_\\-‐'’`]";
const maskiert = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** V3: `phrase` als ganzes Wort oder ganze Wortfolge in `text`. Bindestrich und Apostroph gehören zum Wort. */
export function ganzesWort(phrase: string, text: string): boolean {
  if (!phrase) return false;
  return new RegExp(`(?<!${WORTZEICHEN})${maskiert(phrase)}(?!${WORTZEICHEN})`, 'u').test(text);
}

const ohneLeer = (s: string) => s.replace(/\s+/g, '');

/** Zeilen von Deckblatt und Verzeichnis, normiert; dazu flache Fassungen für Suchen über Zeilen hinweg. */
export class Papiertext {
  readonly zeilen: string[];
  readonly flach: string;
  /** V3: Ein Zeilenumbruch direkt nach einem Bindestrich zählt nicht („Beispielsdorf-⏎Mustermann“). */
  readonly flachB: string;

  constructor(roh: string) {
    this.zeilen = (roh ?? '')
      .split(ZEILE)
      .map((z) => normiert(z))
      .filter(Boolean);
    this.flach = this.zeilen.join(' ');
    this.flachB = Papiertext.zusammen(this.zeilen);
  }

  private static zusammen(zeilen: string[]): string {
    let aus = '';
    for (const z of zeilen) aus += !aus || aus.endsWith('-') || aus.endsWith('‐') ? z : ` ${z}`;
    return aus;
  }

  /** Zeilen nach der Überschrift `kopf` bis zur nächsten Überschrift oder bis zum Fuß; null ohne Überschrift. */
  abschnitt(kopf: string, stopp: string[]): [string, string] | null {
    const i = this.zeilen.indexOf(kopf);
    if (i < 0) return null;
    let j = i + 1;
    while (
      j < this.zeilen.length &&
      !stopp.includes(this.zeilen[j]!) &&
      !ENDE.some((e) => this.zeilen[j]!.startsWith(e))
    )
      j++;
    const teil = this.zeilen.slice(i + 1, j);
    return [teil.join(' '), Papiertext.zusammen(teil)];
  }
}

/** „1. Januar 2027“ aus `JJJJ-MM-TT`. */
export function datumText(tag: string): string {
  const [j, m, t] = tag.split('-').map(Number);
  return `${t}. ${MONATSNAMEN[m! - 1]} ${j}`;
}

/** V6: „September bis November“ im selben Jahr, „Dezember 2026 bis Januar 2027“ darüber, „November 2026“ allein. */
export function monateText(monate: string[]): string {
  const [aj, am] = monate[0]!.split('-').map(Number);
  const [bj, bm] = monate[monate.length - 1]!.split('-').map(Number);
  if (monate.length === 1) return `${MONATSNAMEN[am! - 1]} ${aj}`;
  if (aj === bj) return `${MONATSNAMEN[am! - 1]} bis ${MONATSNAMEN[bm! - 1]}`;
  return `${MONATSNAMEN[am! - 1]} ${aj} bis ${MONATSNAMEN[bm! - 1]} ${bj}`;
}

/** V6: Seitenangabe im Verzeichnis, „Seite 6“ oder „Seiten 3 bis 5“. */
export function seitenText(u: Unterlage): string {
  const { von, bis } = u.seiten_mappe;
  return von === bis ? `Seite ${von}` : `Seiten ${von} bis ${bis}`;
}

/** V6: die Zeile einer Unterlage im Verzeichnis, ohne Seiten. Unbekannte Art: null (V10). */
export function verzeichnisZeile(u: Unterlage): string | null {
  const wort = VERZEICHNIS[u.typ];
  if (!wort) return null;
  if (u.monate?.length) return `${wort}, ${monateText(u.monate)}`;
  if (u.vom) return `${wort} vom ${datumText(u.vom)}`;
  return wort;
}

const VERMERK_KURZ: Readonly<Record<string, string>> = {
  seiten_weggelassen: 'weggelassen',
  verkleinert: 'verkleinert',
  als_bild: 'als Bild übernommen',
  formularfelder_fest: 'Formularfelder fest',
};

/** Wortlaut eines Vermerks, wie ein Verzeichnis ihn druckt (DP64). */
export function vermerkText(v: Vermerk): string {
  const art = VERMERK_KURZ[v.art] ?? 'angepasst';
  const so = v.seiten_original;
  const liste = (z: number[]) =>
    z.length === 1 ? `${z[0]}` : `${z.slice(0, -1).join(', ')} und ${z[z.length - 1]}`;
  const t = so?.length ? `${so.length === 1 ? 'Seite' : 'Seiten'} ${liste(so)} ${art}` : art;
  if (v.monat) {
    const [j, m] = v.monat.split('-').map(Number);
    return `${MONATSNAMEN[m! - 1]} ${j}: ${t}`;
  }
  if (v.datei !== undefined) return `Datei ${v.datei}: ${t}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** V19: `teile` aus `strasse` und `rest` nachgerechnet; null, wenn die Straße keine Hausnummer trägt. */
export function teileAus(strasse: string, rest: string) {
  const m = /^(.+?)\s+(\d[\p{L}\p{N}_/-]*)$/u.exec(strasse.trim());
  if (!m) return null;
  const angaben = (rest ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  const ort = angaben.find((a) => /^\d{5}\s/.test(a)) ?? '';
  return {
    strasse: m[1]!,
    hausnummer: m[2]!,
    plz: ort ? ort.slice(0, 5) : '',
    ort: ort ? ort.slice(6) : '',
    lage: angaben.filter((a) => a !== ort).join(', '),
    land: 'DE',
  };
}

/** Was ein Leser über die Mappe wissen muss, um die Bindung an das Papier zu prüfen. */
export interface Papier {
  /** Text von Seite 1, in der Reihenfolge des Inhalts, Zeilen mit Zeilenumbruch. */
  seite1: string;
  /** Text der Seiten vor der ersten Unterlage, in der Reihenfolge des Inhalts, Zeilen mit Zeilenumbruch. */
  text: string;
  /** Seiten (ab 1), die weder Text noch Bild tragen (V12). */
  leereSeiten: number[];
  /** Erstelldatum der PDF (V11); null, wenn es fehlt. */
  erstellt: Date | null;
}

const ROLLENWORT: Readonly<Record<string, [string, string]>> = {
  hauptmieter: ['im mietvertrag', 'hauptmiet'],
  mitmieter: ['im mietvertrag', 'mitmiet'],
  buerge: ['bürgt', 'bürg'],
};

/** Gründe, warum etwas, das ein Leser zeigt, nicht auf dem Papier steht. Leer: alles gebunden. */
export function papierGruende(l: Lesehilfe, papier: Papier): string[] {
  const x = new Papiertext(papier.text);
  const g: string[] = [];
  const personen: Person[] = l.haushalt.personen;

  const im = (kopf: string, phrase: string, danach?: string) => {
    const a = x.abschnitt(
      kopf,
      UEBERSCHRIFTEN.filter((k) => k !== kopf),
    );
    if (!a) return false;
    for (const t of a) {
      let start = t.indexOf(phrase);
      while (start >= 0) {
        const ende = start + phrase.length;
        if (
          ganzesWort(phrase, t.slice(Math.max(0, start - 1), ende + 1)) &&
          (danach === undefined || t.slice(ende).trimStart().startsWith(danach))
        )
          return true;
        start = t.indexOf(phrase, start + 1);
      }
    }
    return false;
  };

  const w = l.bewerbung.wohnung;
  if (w) {
    for (const k of ['strasse', 'rest'] as const) {
      const wert = w[k];
      if (wert && !ganzesWort(normiert(wert), x.flach) && !ganzesWort(normiert(wert), x.flachB))
        g.push(`Wohnung: „${wert}“ steht nicht auf dem Deckblatt`);
    }
    if (w.teile) {
      const soll = teileAus(w.strasse, w.rest ?? '');
      const ist = Object.fromEntries(Object.entries(w.teile).filter(([k]) => !k.startsWith('x_')));
      if (JSON.stringify(soll) !== JSON.stringify(soll && ordne(ist, Object.keys(soll))))
        g.push(`Wohnung: teile passen nicht zu „${w.strasse}, ${w.rest}“ (V19)`);
    }
  }
  const b = l.bewerbung;
  if (b.einzug && !x.flach.includes(`einzug möglich ab ${normiert(datumText(b.einzug))}`))
    g.push(`Einzug: „Einzug möglich ab ${datumText(b.einzug)}“ steht nicht auf dem Deckblatt`);
  if (b.inserat?.portal && !ganzesWort(`inserat auf ${normiert(b.inserat.portal)}`, x.flach))
    g.push(`Portal „${b.inserat.portal}“ steht nicht auf dem Deckblatt`);
  if (l.loeschwunsch && !ohneLeer(x.flachB).includes(ohneLeer(normiert(l.loeschwunsch))))
    g.push('Löschbitte steht nicht wörtlich auf dem Deckblatt');
  for (const m of l.haushalt.mitziehende)
    if (!im('ziehen mit ein', normiert(m.text)))
      g.push(`Mitziehende „${m.text}“ stehen nicht unter „Ziehen mit ein“`);

  // E227 (L78-3): Der Satz zum Schritt steht auf Seite 1 vor der ersten Überschrift. Ein unbekannter Schritt wird
  // weder gezeigt noch gebunden (L78-4). Ein Satz zu einem anderen Schritt, oder ohne Schritt, passt nicht.
  const s1 = new Papiertext(papier.seite1);
  const ende = s1.zeilen.findIndex((z) =>
    UEBERSCHRIFTEN.some((k) => z === k || z.startsWith(`${k} `)),
  );
  const kopfzone = (ende < 0 ? s1.zeilen : s1.zeilen.slice(0, ende)).join(' ');
  const saetze = Object.fromEntries(Object.entries(SCHRITT_SATZ).map(([k, v]) => [k, normiert(v)]));
  const schritt = l.schritt;
  if (schritt && schritt in saetze && !` ${kopfzone} `.includes(` ${saetze[schritt]} `))
    g.push(`Schritt „${schritt}“: der feste Satz steht nicht unter dem Satz zum Haushalt`);
  for (const [k, satz] of Object.entries(saetze))
    if (k !== schritt && [x.flach, x.flachB].some((t) => ` ${t} `.includes(` ${satz} `)))
      g.push(
        `Satz zum Schritt „${k}“ steht auf dem Deckblatt, die Lesehilfe nennt ${schritt ? `„${schritt}“` : 'keinen Schritt'}`,
      );

  // V7: „Fassung n vom …“ steht immer auf dem Deckblatt.
  const fassung = /fassung (\d+) vom (\d+\. \p{L}+ \d{4})/u.exec(x.flach);
  if (
    !fassung ||
    Number(fassung[1]) !== l.fassung ||
    fassung[2] !== normiert(datumText(l.erstellt.slice(0, 10)))
  )
    g.push(
      `„Fassung ${l.fassung} vom ${datumText(l.erstellt.slice(0, 10))}“ steht so nicht auf dem Deckblatt`,
    );
  // V8: „Seite 1 von N“ im Fuß des Deckblatts.
  if (!x.flach.includes(`seite 1 von ${l.seitenzahl}`))
    g.push(`Fuß nennt nicht „Seite 1 von ${l.seitenzahl}“`);
  // V11: `erstellt` ist das Erstelldatum der PDF, Abweichung unter einer Sekunde.
  const erstellt = Date.parse(l.erstellt);
  if (!papier.erstellt || !(Math.abs(papier.erstellt.getTime() - erstellt) < 1000))
    g.push(`erstellt ${l.erstellt} ist nicht das Erstelldatum der PDF`);

  // V5, V9: ganzer Name unter seiner Überschrift, dahinter das Rollenwort; Kontakt unter „Kontakt“.
  for (const p of personen) {
    const [kopf, rolle] = ROLLENWORT[p.rolle] ?? ['im mietvertrag', ''];
    if (!im(kopf, normiert(p.name), rolle))
      g.push(`${p.name}: steht nicht als ganzer Name mit dieser Rolle auf dem Deckblatt`);
    if (p.kontakt) {
      const a = x.abschnitt(
        'kontakt',
        UEBERSCHRIFTEN.filter((k) => k !== 'kontakt'),
      );
      const gut =
        !!a &&
        ganzesWort(normiert(p.name), a[0]) &&
        [p.telefon, p.email].every(
          (wert) => wert === undefined || ohneLeer(a[0]).includes(ohneLeer(normiert(wert))),
        );
      if (!gut) g.push(`${p.name}: Kontakt steht so nicht unter „Kontakt“`);
    }
  }

  // V6, V10: je Unterlage ihre Zeile im Verzeichnis, im Block der Person.
  const namen = personen.map((p) => normiert(p.name));
  const verzeichnis = x.abschnitt('was beiliegt', []);
  personen.forEach((p, i) => {
    for (const u of p.unterlagen) {
      const zeile = verzeichnisZeile(u);
      const soll = zeile ? normiert(zeile) : null;
      const seiten = normiert(seitenText(u));
      if (!unterlageImVerzeichnis(verzeichnis, namen, i, soll, seiten))
        g.push(
          `${p.name}: „${zeile ?? 'Unterlage'}“ auf ${seitenText(u)} steht so nicht im Verzeichnis`,
        );
      for (const v of u.vermerke ?? [])
        if (!x.flach.includes(normiert(vermerkText(v))))
          g.push(`${p.name}: Vermerk „${vermerkText(v)}“ steht nicht im Verzeichnis`);
      // V12: Die Seiten einer Unterlage sind nicht leer.
      for (let s = u.seiten_mappe.von; s <= u.seiten_mappe.bis; s++)
        if (papier.leereSeiten.includes(s)) g.push(`${p.name}: Seite ${s} ist leer`);
    }
  });
  return g;
}

function ordne(o: Record<string, unknown>, schluessel: string[]) {
  const aus: Record<string, unknown> = {};
  for (const k of schluessel) if (k in o) aus[k] = o[k];
  for (const k of Object.keys(o)) if (!(k in aus)) aus[k] = o[k];
  return aus;
}

function unterlageImVerzeichnis(
  verzeichnis: [string, string] | null,
  namen: string[],
  i: number,
  soll: string | null,
  seiten: string,
): boolean {
  if (!verzeichnis) return false;
  for (const t of verzeichnis) {
    let start = t.indexOf(namen[i]!);
    while (start >= 0) {
      const ende = start + namen[i]!.length;
      if (ganzesWort(namen[i]!, t.slice(Math.max(0, start - 1), ende + 1))) {
        const rest = t.slice(ende);
        const andere = namen.map((n, j) => (j === i ? -1 : rest.indexOf(n))).filter((k) => k >= 0);
        const block = rest.slice(0, Math.min(...andere, rest.length));
        // V6 (PC121): genau die zwei Formen „– Seite n“ und „– Seiten n bis m“, auch bei unbekannter Art (V10);
        // „Seiten 2–3“, die Zahl allein und „Seite 3 bis 5“ passen nicht.
        const muster =
          soll === null
            ? new RegExp(`– ${maskiert(seiten)}(?![\\d–]| bis \\d)`, 'u')
            : new RegExp(
                `(?<!${WORTZEICHEN})${maskiert(soll)} – ${maskiert(seiten)}(?![\\d–]| bis \\d)`,
                'u',
              );
        if (muster.test(block)) return true;
      }
      start = t.indexOf(namen[i]!, start + 1);
    }
  }
  return false;
}
