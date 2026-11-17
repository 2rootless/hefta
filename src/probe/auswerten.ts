import { mrzForm, mrzLesen, type MrzForm } from '../domain/mrz';

// Probe Vision gegen Tesseract (PC75, PC68 Abschnitt 4): Auswertung je Foto und Weg. Nur im Probe-Bau. Die
// Schwelle für „deutlich besser“ steht in CP49 und wird hier nicht ausgewertet, nur gemessen.

export interface Zeile {
  text: string;
  /** Sicherheit 0 bis 1, wie der Weg sie meldet (Tesseract 0 bis 100 wird umgerechnet). */
  sicherheit: number;
}

export interface Foto {
  datei: string;
  papier: string;
  variante: string;
  soll: Record<string, string>;
  mrz: string[] | null;
}

/** Für den Vergleich: Leerzeichen raus, Striche und Minus vereinheitlicht. */
export function vereinheitlichen(t: string): string {
  return (
    t
      .normalize('NFC')
      // \s umfasst auch das geschützte Leerzeichen.
      .replace(/\s+/g, '')
      .replace(/[−–—]/g, '-')
  );
}

/**
 * Welche Sollwerte stehen genau so im Gelesenen? Werte unter zwei Zeichen (Steuerklasse „1“) zählen nicht,
 * sie stünden fast immer irgendwo.
 */
export function treffer(
  soll: Record<string, string>,
  zeilen: Zeile[],
): { gefunden: string[]; fehlt: string[] } {
  const alles = vereinheitlichen(zeilen.map((z) => z.text).join('\n'));
  const gefunden: string[] = [];
  const fehlt: string[] = [];
  for (const [schluessel, wert] of Object.entries(soll)) {
    const w = vereinheitlichen(wert);
    if (w.length < 2) continue;
    (alles.includes(w) ? gefunden : fehlt).push(schluessel);
  }
  return { gefunden, fehlt };
}

/** Zeilen, die wie Zeilen unten aussehen: nur A–Z, 0–9 und „<“, mindestens 20 Zeichen. */
export function mrzKandidaten(zeilen: Zeile[]): string[] {
  return zeilen
    .map((z) =>
      z.text
        .toUpperCase()
        .replace(/\s+/g, '')
        // Vision liest zwei Füllzeichen gern als „«“.
        .replace(/«/g, '<<')
        .replace(/[‹＜]/g, '<'),
    )
    .filter((t) => t.length >= 20 && t.includes('<') && /^[A-Z0-9<]+$/.test(t));
}

const LAENGE: Record<MrzForm, number> = { TD1: 30, TD2: 36, TD3: 44 };

/** Stellen, die nach der Norm nur Ziffern tragen (Datum, Prüfziffern), je Form und Zeile. */
const ZIFFERN: Record<MrzForm, [number, number, number][]> = {
  TD1: [
    [0, 14, 15],
    [1, 0, 7],
    [1, 8, 15],
    [1, 29, 30],
  ],
  TD2: [
    [1, 9, 10],
    [1, 13, 20],
    [1, 21, 28],
    [1, 35, 36],
  ],
  TD3: [
    [1, 9, 10],
    [1, 13, 20],
    [1, 21, 28],
    [1, 42, 44],
  ],
};
const ALS_ZIFFER: Record<string, string> = {
  O: '0',
  Q: '0',
  D: '0',
  I: '1',
  L: '1',
  Z: '2',
  S: '5',
  G: '6',
  B: '8',
};

/**
 * Berichtigung nach der Norm (CP40 Abschnitt 5, PC68 Abschnitt 5): Füllzeichen am Ende auf die Länge der
 * Form ergänzen oder kürzen, in reinen Ziffernfeldern Buchstaben, die wie Ziffern aussehen, zu Ziffern,
 * einzelne Zeichen zwischen Füllzeichen zu Füllzeichen. Das Ergebnis gilt nur, wenn danach alle Prüfziffern
 * stimmen (das prüft der Aufrufer mit `mrzLesen`).
 *
 * `buchstaben`: dazu Ziffern in reinen Buchstabenfeldern zu Buchstaben (PC77). PC79 (E160, Offen 2): Die
 * Prüfziffern decken Art, Staat, Geschlecht und Name nicht ab (ICAO 9303). „Alle Prüfziffern stimmen“
 * bestätigt dort nichts, und „gelöst“ ändert sich dadurch nie. Die Probe weist darum „genau gelesen“ ohne und
 * mit dieser Berichtigung getrennt aus; „deutlich besser“ (CP49) gilt ohne sie. Im Produkt gilt ein so
 * berichtigtes Buchstabenfeld als „gelesen“, nie als „geprüft“ (W10).
 */
export function berichtigen(zeilen: string[], form: MrzForm, buchstaben = true): string[] {
  const laenge = LAENGE[form];
  const aus = zeilen.map((z) => {
    if (z.length < laenge && /<$/.test(z)) return z.padEnd(laenge, '<');
    if (z.length > laenge && /^<+$/.test(z.slice(laenge))) return z.slice(0, laenge);
    return z;
  });
  for (const [zeile, von, bis] of ZIFFERN[form]) {
    const z = aus[zeile];
    if (!z || z.length !== laenge) continue;
    const teil = [...z.slice(von, bis)].map((c) => ALS_ZIFFER[c] ?? c).join('');
    aus[zeile] = z.slice(0, von) + teil + z.slice(bis);
  }
  // Umgekehrt (PC77, Probe mit echter OCR-B): In reinen Buchstabenfeldern (Art, Staat, Geschlecht, Name)
  // sind Ziffern Lesefehler.
  for (const [zeile, von, bis] of buchstaben ? BUCHSTABEN[form] : []) {
    const z = aus[zeile];
    if (!z || z.length !== laenge) continue;
    const teil = [...z.slice(von, bis)].map((c) => ALS_BUCHSTABE[c] ?? c).join('');
    aus[zeile] = z.slice(0, von) + teil + z.slice(bis);
  }
  for (const [zeile, von, bis] of ZUSATZ[form]) {
    const z = aus[zeile];
    if (!z || z.length !== laenge) continue;
    const teil = z.slice(von, bis);
    // Nur fast leere Felder: höchstens zwei Zeichen, die keine Füllzeichen sind.
    if (teil.replace(/</g, '').length > 2) continue;
    aus[zeile] = z.slice(0, von) + teil.replace(/(?<=<|^)[A-Z0-9](?=<|$)/g, '<') + z.slice(bis);
  }
  return aus;
}

/** Felder, die nach der Norm nur Buchstaben und Füllzeichen tragen, je Form und Zeile (Teil 4 bis 6). */
const BUCHSTABEN: Record<MrzForm, [number, number, number][]> = {
  TD1: [
    [0, 0, 5],
    [1, 7, 8],
    [1, 15, 18],
    [2, 0, 30],
  ],
  TD2: [
    [0, 0, 36],
    [1, 10, 13],
    [1, 20, 21],
  ],
  TD3: [
    [0, 0, 44],
    [1, 10, 13],
    [1, 20, 21],
  ],
};
/** PC79: nur die Paare, die in der Norm eindeutig sind; 2→Z und 6→G nicht. */
export const ALS_BUCHSTABE: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '5': 'S',
  '8': 'B',
};

/** Zusatzfelder je Form (Teil 4 bis 6), in denen einzelne Zeichen zwischen Füllzeichen Lesefehler sind. */
const ZUSATZ: Record<MrzForm, [number, number, number][]> = {
  TD1: [
    [0, 15, 30],
    [1, 18, 29],
  ],
  TD2: [[1, 28, 35]],
  TD3: [[1, 28, 42]],
};

export interface MrzAuswertung {
  /** Gelesene Zeilen des besten Fensters (am nächsten an den Sollzeilen). */
  zeilen: string[];
  /** Zeichen, die von den Sollzeilen abweichen (je Stelle, dazu der Unterschied der Länge). */
  falsch: number;
  /** Alle Prüfziffern stimmen, ohne Berichtigung. */
  geloest: boolean;
  /** Alle Prüfziffern stimmen nach der Berichtigung nach der Norm. */
  geloestBerichtigt: boolean;
  /** Gelesen ist genau das Soll. */
  exakt: boolean;
  /** Nach der Berichtigung ohne Buchstabenfelder genau das Soll (zählt, PC79). */
  genauBerichtigt: boolean;
  /** Ebenso mit Buchstabenfeldern (PC79: steht nur daneben). */
  genauBuchstaben: boolean;
}

function abweichung(ist: string[], soll: string[]): number {
  let n = 0;
  for (let i = 0; i < soll.length; i++) {
    const a = ist[i] ?? '';
    const b = soll[i]!;
    n += Math.abs(a.length - b.length);
    for (let j = 0; j < Math.min(a.length, b.length); j++) if (a[j] !== b[j]) n++;
  }
  return n;
}

/**
 * Zeilen unten: Jedes Fenster aus aufeinanderfolgenden Kandidaten in der Zahl der Sollzeilen wird geprüft.
 * „Gelöst“ heißt: In einem Fenster stimmen alle Prüfziffern, so wie Hefta es ohne Kenntnis des Solls prüfen
 * würde. Die Zahl falscher Zeichen dient nur der Beschreibung.
 */
export function mrzAuswerten(kandidaten: string[], soll: string[]): MrzAuswertung {
  const n = soll.length;
  const fenster: string[][] = [];
  for (let i = 0; i + n <= kandidaten.length; i++) fenster.push(kandidaten.slice(i, i + n));
  if (!fenster.length) fenster.push(kandidaten);
  let bestes = fenster[0]!;
  for (const f of fenster) if (abweichung(f, soll) < abweichung(bestes, soll)) bestes = f;
  const geloest = fenster.some((f) => f.length === n && mrzLesen(f).ok);
  // Ohne Buchstabenfelder: Dort ändert die Berichtigung an den Prüfziffern ohnehin nichts (PC79).
  const geloestBerichtigt = fenster.some((f) => {
    if (f.length !== n) return false;
    const form = mrzForm(f) ?? mrzFormNachSoll(soll);
    return form ? mrzLesen(berichtigen(f, form, false)).ok : false;
  });
  const gleich = (f: string[]) => f.length === n && f.every((z, i) => z === soll[i]);
  const form = bestes.length === n ? (mrzForm(bestes) ?? mrzFormNachSoll(soll)) : null;
  return {
    zeilen: bestes,
    falsch: abweichung(bestes, soll),
    geloest,
    geloestBerichtigt,
    exakt: gleich(bestes),
    genauBerichtigt: form ? gleich(berichtigen(bestes, form, false)) : false,
    genauBuchstaben: form ? gleich(berichtigen(bestes, form, true)) : false,
  };
}

/** Form aus Zahl der Zeilen, wenn die gelesene Länge nicht passt (die Berichtigung ergänzt sie erst). */
function mrzFormNachSoll(soll: string[]): MrzForm | null {
  return mrzForm(soll);
}

export interface Lauf {
  weg: string;
  zeilen: Zeile[];
  ms: number;
  fehler?: string;
}

const prozent = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** Eine Zeile des Ergebnisses zum Kopieren: Foto, Weg, Treffer, Sicherheit, Zeit, Zeilen unten. */
export function berichtZeile(foto: Foto, lauf: Lauf): string {
  if (lauf.fehler) return `${foto.datei} | ${lauf.weg} | Fehler: ${lauf.fehler}`;
  const t = treffer(foto.soll, lauf.zeilen);
  const zahl = t.gefunden.length + t.fehlt.length;
  const sicher = lauf.zeilen.length
    ? Math.round((lauf.zeilen.reduce((s, z) => s + z.sicherheit, 0) / lauf.zeilen.length) * 100)
    : 0;
  let z =
    `${foto.datei} | ${lauf.weg} | Treffer ${t.gefunden.length}/${zahl} (${prozent(t.gefunden.length, zahl)} %)` +
    ` | Zeilen ${lauf.zeilen.length}, Sicherheit ⌀ ${sicher} % | ${lauf.ms} ms`;
  if (t.fehlt.length) z += ` | fehlt: ${t.fehlt.join(', ')}`;
  if (foto.mrz) {
    const m = mrzAuswerten(mrzKandidaten(lauf.zeilen), foto.mrz);
    z +=
      ` | unten: ${m.exakt ? 'genau' : `${m.falsch} Zeichen falsch`}` +
      `, Prüfziffern ${m.geloest ? 'gelöst' : 'nicht gelöst'}` +
      `, berichtigt ${m.geloestBerichtigt ? 'gelöst' : 'nicht gelöst'}` +
      `, danach ${m.genauBerichtigt ? 'genau' : 'nicht genau'}` +
      `, mit Buchstabenfeldern ${m.genauBuchstaben ? 'genau' : 'nicht genau'}` +
      ` | gelesen: ${m.zeilen.join(' / ') || '–'}`;
  }
  return z;
}

/** Summen je Variante und Weg, für den Vergleich nach CP49 Abschnitt 2. */
export function summen(ergebnisse: { foto: Foto; laeufe: Lauf[] }[]): {
  variante: string;
  weg: string;
  gefunden: number;
  zahl: number;
  mrzGeloest: number;
  mrzBerichtigt: number;
  mrzGenau: number;
  mrzGenauBuchstaben: number;
  mrzZahl: number;
  ms: number;
}[] {
  const tabelle = new Map<
    string,
    {
      variante: string;
      weg: string;
      gefunden: number;
      zahl: number;
      mrzGeloest: number;
      mrzBerichtigt: number;
      mrzGenau: number;
      mrzGenauBuchstaben: number;
      mrzZahl: number;
      ms: number;
    }
  >();
  for (const { foto, laeufe } of ergebnisse) {
    for (const lauf of laeufe) {
      if (lauf.fehler) continue;
      // Die Fotos mit echter OCR-B (PC77) stehen als eigener Satz neben denen aus CP40.
      const variante = `${foto.variante}${satz(foto) === 'OCR-B' ? ' (OCR-B)' : ''}`;
      const schluessel = `${variante}|${lauf.weg}`;
      const s = tabelle.get(schluessel) ?? {
        variante,
        weg: lauf.weg,
        gefunden: 0,
        zahl: 0,
        mrzGeloest: 0,
        mrzBerichtigt: 0,
        mrzGenau: 0,
        mrzGenauBuchstaben: 0,
        mrzZahl: 0,
        ms: 0,
      };
      const t = treffer(foto.soll, lauf.zeilen);
      s.gefunden += t.gefunden.length;
      s.zahl += t.gefunden.length + t.fehlt.length;
      s.ms += lauf.ms;
      // Die Fassung in Consolas zählt nicht zu den 14 Fotos der Zeilen unten (CP40); sie steht in mrzGesamt.
      if (foto.mrz && satz(foto) !== 'Consolas') {
        const m = mrzAuswerten(mrzKandidaten(lauf.zeilen), foto.mrz);
        s.mrzZahl++;
        if (m.geloest) s.mrzGeloest++;
        if (m.geloestBerichtigt) s.mrzBerichtigt++;
        if (m.genauBerichtigt) s.mrzGenau++;
        if (m.genauBuchstaben) s.mrzGenauBuchstaben++;
      }
      tabelle.set(schluessel, s);
    }
  }
  return [...tabelle.values()];
}

/** Zu welchem Satz ein Foto gehört: die Schrift der Zeilen unten (CP40 Lucida Console, PC77 echte OCR-B). */
export function satz(foto: Foto): string {
  if (foto.papier.endsWith('-ocrb')) return 'OCR-B';
  if (foto.papier.endsWith('consolas')) return 'Consolas';
  return 'Lucida (CP40)';
}

interface MrzSumme {
  satz: string;
  weg: string;
  geloest: number;
  berichtigt: number;
  /** Genau gelesen nach der Berichtigung ohne Buchstabenfelder (PC79). */
  genau: number;
  /** Genau gelesen nach der Berichtigung mit Buchstabenfeldern (PC79, nur daneben). */
  genauBuchstaben: number;
  zahl: number;
}

/** Zeilen unten über alle Varianten: je Satz und Weg die Fotos mit gelösten Prüfziffern (CP49, Grenze 2). */
export function mrzGesamt(ergebnisse: { foto: Foto; laeufe: Lauf[] }[]): MrzSumme[] {
  const tabelle = new Map<string, MrzSumme>();
  for (const { foto, laeufe } of ergebnisse) {
    if (!foto.mrz) continue;
    for (const lauf of laeufe) {
      if (lauf.fehler) continue;
      const schluessel = `${satz(foto)}|${lauf.weg}`;
      const s = tabelle.get(schluessel) ?? {
        satz: satz(foto),
        weg: lauf.weg,
        geloest: 0,
        berichtigt: 0,
        genau: 0,
        genauBuchstaben: 0,
        zahl: 0,
      };
      const m = mrzAuswerten(mrzKandidaten(lauf.zeilen), foto.mrz);
      s.zahl++;
      if (m.geloest) s.geloest++;
      if (m.geloestBerichtigt) s.berichtigt++;
      if (m.genauBerichtigt) s.genau++;
      if (m.genauBuchstaben) s.genauBuchstaben++;
      tabelle.set(schluessel, s);
    }
  }
  return [...tabelle.values()].sort(
    (a, b) => a.satz.localeCompare(b.satz) || a.weg.localeCompare(b.weg),
  );
}

/** Der ganze Bericht als Text zum Kopieren. */
export function bericht(ergebnisse: { foto: Foto; laeufe: Lauf[] }[], geraet: string): string {
  const zeilen = [`Probe Vision gegen Tesseract (PC75), ${geraet}`, ''];
  zeilen.push('Zeilen unten gesamt (Fotos mit gelösten Prüfziffern, ohne und mit Berichtigung):');
  zeilen.push(
    '„Deutlich besser“ zählt ohne Buchstabenfelder. Dort berichtigt nur ' +
      Object.entries(ALS_BUCHSTABE)
        .map(([z, b]) => `${z}→${b}`)
        .join(', ') +
      '; die Prüfziffern decken sie nicht ab (PC79).',
  );
  for (const g of mrzGesamt(ergebnisse))
    zeilen.push(
      `${g.satz} | ${g.weg} | ${g.geloest}/${g.zahl}, berichtigt ${g.berichtigt}/${g.zahl}` +
        ` | genau ${g.genau}/${g.zahl}, mit Buchstabenfeldern ${g.genauBuchstaben}/${g.zahl}`,
    );
  zeilen.push('');
  zeilen.push(
    'Summen je Variante (Treffer gegen Sollwerte; Zeilen unten: Fotos mit gelösten Prüfziffern):',
  );
  for (const s of summen(ergebnisse).sort(
    (a, b) => a.variante.localeCompare(b.variante) || a.weg.localeCompare(b.weg),
  ))
    zeilen.push(
      `${s.variante} | ${s.weg} | Treffer ${s.gefunden}/${s.zahl} (${prozent(s.gefunden, s.zahl)} %)` +
        (s.mrzZahl
          ? ` | unten gelöst ${s.mrzGeloest}/${s.mrzZahl}, berichtigt ${s.mrzBerichtigt}/${s.mrzZahl}` +
            `, genau ${s.mrzGenau}/${s.mrzZahl}, mit Buchstabenfeldern ${s.mrzGenauBuchstaben}/${s.mrzZahl}`
          : '') +
        ` | ${s.ms} ms`,
    );
  zeilen.push('', 'Je Foto:');
  for (const { foto, laeufe } of ergebnisse)
    for (const l of laeufe) zeilen.push(berichtZeile(foto, l));
  return zeilen.join('\n');
}
