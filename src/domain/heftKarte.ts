import type { Heft } from './modell';
import { tageBis } from './tageslinie';

// Was eine Zeile der Übersicht und der Kopf eines Hefts zeigen (B21 Fassung 4): Titel, Ort, Eckdaten,
// und für die nächste Besichtigung die Karte mit Datum und Woche. Reine Rechnung, Texte als Schlüssel
// für i18n.

const NB = ' ';
const zahl = (n: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(n);
const eur = (n: number) => `${new Intl.NumberFormat('de-DE').format(Math.round(n))}${NB}€`;

function zeilen(adresse: string): [string, string] {
  const [a = '', b = ''] = adresse.split('\n').map((z) => z.trim());
  return [a, b];
}

/** Ort aus der zweiten Adresszeile, ohne Postleitzahl: „20259 Hamburg“ → „Hamburg“. */
function ortAusAdresse(adresse: string): string {
  return zeilen(adresse)[1].replace(/^\d{5}\s*/, '');
}

/**
 * Der Name des Hefts (E78): Merkmal, sonst Titel des Inserats, sonst die Straße, sonst gebaut aus dem,
 * was bekannt ist: „2-Zimmer-Wohnung in Eimsbüttel“, „Wohnung in Eimsbüttel“, „2-Zimmer-Wohnung bei
 * ImmoScout24“, „Inserat bei ImmoScout24“, „Wohnung vom 11. Nov.“. Der gebaute Titel steht wie ein
 * normaler Titel; ein Merkmal ersetzt ihn.
 */
export function heftTitel(h: Pick<Heft, 'adresse' | 'angaben'> & { createdAt?: string }): {
  text: string;
  strasse: boolean;
} {
  const a = h.angaben;
  const name = (a?.merkmal ?? '').trim() || (a?.titel ?? '').trim();
  if (name) return { text: name, strasse: false };
  const strasse = zeilen(h.adresse)[0] || h.adresse.trim();
  if (strasse) return { text: strasse, strasse: true };
  return { text: gebauterTitel(a ?? null, h.createdAt), strasse: false };
}

function gebauterTitel(a: Heft['angaben'] | null, erstellt?: string): string {
  const stadtteil = (a?.stadtteil ?? '').trim();
  const portal = (a?.portal ?? '').trim();
  const wohnung = a?.zimmer != null ? `${zahl(a.zimmer)}-Zimmer-Wohnung` : null;
  if (stadtteil) return `${wohnung ?? 'Wohnung'} in ${stadtteil}`;
  if (wohnung && portal) return `${wohnung} bei ${portal}`;
  if (portal) return `Inserat bei ${portal}`;
  const d = erstellt ? new Date(erstellt) : new Date();
  return `Wohnung vom ${d.getDate()}.${NB}${MONAT[d.getMonth()]}`;
}

/** Ab dieser Länge steht im Zurück-Link wieder das Wort „Heft“ (Planung P003). */
export const ZURUECK_HOECHSTENS = 14;

/**
 * Text des Zurück-Links von den Seiten im Heft (P003): das Merkmal, sonst die Straße. Ist der Name 15 Zeichen
 * oder länger oder fehlt er, `null`; dann steht dort „Heft“.
 */
export function zurueckZumHeft(h: Pick<Heft, 'adresse' | 'angaben'> | null): string | null {
  if (!h) return null;
  const name = (h.angaben?.merkmal ?? '').trim() || zeilen(h.adresse)[0] || h.adresse.trim();
  return name && [...name].length <= ZURUECK_HOECHSTENS ? name : null;
}

/** Stadtteil, sonst der Ort aus der Adresse; leer, wenn beides fehlt. */
export function heftOrt(h: Pick<Heft, 'adresse' | 'angaben'>): string {
  return (h.angaben?.stadtteil ?? '').trim() || ortAusAdresse(h.adresse);
}

/** „Lindenallee 3, EG · Eimsbüttel“: erste Adresszeile und Stadtteil. */
export function heftAdresseKurz(h: Pick<Heft, 'adresse' | 'angaben'>): string {
  const strasse = zeilen(h.adresse)[0];
  const ort = heftOrt(h);
  return [strasse, ort].filter(Boolean).join(' · ');
}

/** Die Eckdaten ohne Ort: „1.310 € · 3 Zi · 78 m²“, mit „ca.“ vor geschätzten Werten; leer ohne Angaben. */
export function eckdaten(h: Pick<Heft, 'angaben'>): string {
  const a = h.angaben;
  if (!a) return '';
  const teile: string[] = [];
  if (a.warm != null) teile.push(`${a.warmCa ? `ca.${NB}` : ''}${eur(a.warm)}`);
  if (a.zimmer != null) teile.push(`${zahl(a.zimmer)}${NB}Zi`);
  if (a.flaeche != null) teile.push(`${a.flaecheCa ? `ca.${NB}` : ''}${zahl(a.flaeche)}${NB}m²`);
  return teile.join(' · ');
}

/** Die zweite Zeile der Übersicht: Ort und Eckdaten, oder der Hinweis, dass sie noch fehlen. */
export function eckdatenZeile(h: Pick<Heft, 'adresse' | 'angaben'>): { ort: string; eck: string } {
  return { ort: heftOrt(h), eck: eckdaten(h) };
}

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONAT = [
  'Jan.',
  'Feb.',
  'März',
  'Apr.',
  'Mai',
  'Juni',
  'Juli',
  'Aug.',
  'Sept.',
  'Okt.',
  'Nov.',
  'Dez.',
];

/** Tage, die die Woche auf der Karte zeigt: heute und 14 voraus (B21, 15 Spalten). */
export const WOCHE_TAGE = 15;

export interface TerminKarte {
  wochentag: string;
  tag: number;
  monat: string;
  /** „17:30“; leer, wenn keine Uhrzeit gesetzt ist (Mitternacht). */
  uhr: string;
  /** Tage bis zum Termin, 0 heißt heute. */
  tage: number;
  /** Die Woche: je Tag, ob er ein Montag ist; `ereignis` ist die Spalte des Termins oder null. */
  woche: { montag: boolean }[];
  ereignis: number | null;
}

/** Die große Karte der nächsten Besichtigung. */
export function terminKarte(am: string, jetzt: Date): TerminKarte {
  const d = new Date(am);
  const tage = tageBis(d, jetzt);
  const woche = Array.from({ length: WOCHE_TAGE }, (_, i) => {
    const t = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + i);
    return { montag: t.getDay() === 1 };
  });
  const uhr =
    d.getHours() || d.getMinutes()
      ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      : '';
  return {
    wochentag: WOCHENTAG[d.getDay()] ?? '',
    tag: d.getDate(),
    monat: MONAT[d.getMonth()] ?? '',
    uhr,
    tage,
    woche,
    ereignis: tage >= 0 && tage < WOCHE_TAGE ? tage : null,
  };
}

/** „Do, 18:00“ oder „Fr, 6. Nov.“: kurzes Datum für die Zeile unter einem Termin. */
export function terminKurz(am: string, mitUhr: boolean): string {
  const d = new Date(am);
  if (mitUhr && (d.getHours() || d.getMinutes()))
    return `${WOCHENTAG[d.getDay()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${WOCHENTAG[d.getDay()]}, ${d.getDate()}.${NB}${MONAT[d.getMonth()]}`;
}

/** „4. Nov.“: Datum ohne Wochentag, etwa für „Beworben am …“. */
export function tagKurz(am: string): string {
  const d = new Date(am);
  return `${d.getDate()}.${NB}${MONAT[d.getMonth()]}`;
}
