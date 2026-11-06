import katalogRoh from '../../data/regelkatalog.de.json';
import type { AnhangPerson, AnhangUnterlage, HeftaAnhang } from '../pdf/anhang';

// Die Regeln der Vermieter-Seite (design/vermieter-seite.md, Abschnitt „Die Regel“). Reine Logik ohne
// Oberfläche. Die Lesehilfe ist eine Angabe der Bewerber: Alles wird geprüft, bevor es gezeigt wird.

export const NB = '\u00a0';
const WORTLOS = '\u2060';
const MONATE = [
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
const ZAHLEN = [
  '',
  'ein',
  'zwei',
  'drei',
  'vier',
  'fünf',
  'sechs',
  'sieben',
  'acht',
  'neun',
  'zehn',
  'elf',
  'zwölf',
];

type SchrittId = 'besichtigung' | 'will_wohnung' | 'zusage';
const RANG: Record<SchrittId, number> = { besichtigung: 1, will_wohnung: 2, zusage: 3 };

interface Erwartung {
  typ?: string;
  anforderung?: string;
  text: string;
  schritt: string;
}
interface Pruefweg {
  name: string;
  tage: number;
  adresse: string;
  url: string;
  quelle: string;
  stand: string;
}
interface Typ {
  id: string;
  text: string;
  textEinzeln?: string;
  etikett?: string;
  schritt?: string;
}
interface Rolle {
  textNeutral?: string;
}

const katalog = katalogRoh as unknown as {
  dokumenttypen: Typ[];
  rollen: Record<string, Rolle>;
  grundlage: { titel: string; url: string; version?: string; stand?: string }[];
  vermieter: {
    einkommen: string[];
    erwartet: { vertrag: Erwartung[]; buerge: Erwartung[] };
    schritte: Record<SchrittId, { ueblich: string; gehoert: string }>;
    gruppeEntscheidung: string;
    gruppeNichtNoetig: string;
    hinweise: Record<string, string>;
    pruefwege: Record<string, Pruefweg>;
  };
};
const stimme = katalog.vermieter;
const TYPEN = new Map(katalog.dokumenttypen.map((t) => [t.id, t]));

export const GRUPPE_ENTSCHEIDUNG = stimme.gruppeEntscheidung;
export const GRUPPE_NICHT_NOETIG = stimme.gruppeNichtNoetig;
/** Die Orientierungshilfe selbst, nicht nur ihre Anlage. */
export const ORIENTIERUNGSHILFE = katalog.grundlage.find((g) =>
  g.titel.includes('Orientierungshilfe zur Einholung'),
)!.url;

/** Der Musterfragebogen, die Anlage der Orientierungshilfe. */
export const MUSTERBOGEN = katalog.grundlage.find((g) =>
  g.titel.includes('Anlage Musterfragebogen'),
)!.url;

/** Mengen bis zwölf als Wort (T6). `weiblich` für „eine Mappe“, „zwei Mappen“ gilt nur bei eins. */
export function wort(n: number, weiblich = false): string {
  if (n === 1) return weiblich ? 'eine' : 'ein';
  return ZAHLEN[n] ?? String(n);
}
export const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function datumText(iso: string, mitJahr = true): string {
  const [j, m, t] = iso.split('-').map(Number);
  return `${t}.${NB}${MONATE[(m ?? 1) - 1]}${mitJahr ? ` ${j}` : ''}`;
}

export function monateText(monate: string[]): string {
  const [ja, ma] = monate[0]!.split('-').map(Number);
  const [jb, mb] = monate[monate.length - 1]!.split('-').map(Number);
  const a = MONATE[(ma ?? 1) - 1];
  const b = MONATE[(mb ?? 1) - 1];
  if (monate.length === 1) return `${a} ${ja}`;
  return ja === jb ? `${a} bis ${b} ${jb}` : `${a} ${ja} bis ${b} ${jb}`;
}

/** Seitenbereiche brechen nie am Strich (C23). */
export function seitenText([von, bis]: [number, number]): string {
  return von === bis ? `Seite${NB}${von}` : `Seiten${NB}${von}${WORTLOS}–${WORTLOS}${bis}`;
}

export function groesseText(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}${NB}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')}${NB}MB`;
}

export function seitenzahlText(n: number): string {
  return n === 1 ? 'Eine Seite' : `${gross(wort(n))} Seiten`;
}

export const imVertrag = (p: AnhangPerson) => p.rolle !== 'buerge';
const vorname = (name: string) => name.trim().split(/\s+/)[0] ?? name;

function aufzaehlen(teile: string[]): string {
  if (teile.length < 2) return teile[0] ?? '';
  return `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`;
}

/** Der Haushalt wie in der Fußzeile der Mappe: „Max und Lea Mustermann“. */
export function haushaltTitel(a: HeftaAnhang): string {
  const v = a.haushalt.personen.filter(imVertrag);
  const nach = new Map<string, string[]>();
  for (const p of v.length ? v : a.haushalt.personen) {
    const w = p.name.trim().split(/\s+/);
    const nachname = w.length > 1 ? w[w.length - 1]! : '';
    nach.set(nachname, [...(nach.get(nachname) ?? []), w.slice(0, -1).join(' ') || w[0]!]);
  }
  return aufzaehlen(
    [...nach].map(([nachname, vornamen]) => `${aufzaehlen(vornamen)} ${nachname}`.trim()),
  );
}

export function personenGesamt(a: HeftaAnhang): number {
  return (
    a.haushalt.personen.filter(imVertrag).length +
    a.haushalt.mitziehende.reduce((s, m) => s + m.anzahl, 0)
  );
}

/**
 * Die Zeile im Eingang. Abweichung vom Entwurf: nur die Personenzahl. Kinder und Bürgen stehen erst in
 * der geöffneten Mappe, sonst wird die Liste ein Vergleich nach genau diesen Merkmalen.
 */
export function werKurz(a: HeftaAnhang): string {
  const v = a.haushalt.personen.filter(imVertrag);
  const namen = v.map((p) => vorname(p.name));
  const gesamt = personenGesamt(a);
  if (v.length === 1 && gesamt === 1) return `${namen[0]} allein im Vertrag`;
  const vertrag =
    v.length === 1
      ? `${namen[0]} im Vertrag`
      : v.length === 2
        ? `${namen[0]} und ${namen[1]} im Vertrag`
        : `${gross(wort(v.length))} im Vertrag`;
  return gesamt > v.length ? `${vertrag} · ${wort(gesamt)} Personen` : vertrag;
}

export interface Fehlend {
  text: string;
  schritt: SchrittId;
  typ?: string;
}
export interface PersonStand {
  person: AnhangPerson;
  index: number;
  da: AnhangUnterlage[];
  fehlt: Fehlend[];
  spaeter: Fehlend[];
}

/** Bezugsfassung: vollstaendigkeit() in design/werkzeug/vs_bau.py. */
export function vollstaendigkeit(a: HeftaAnhang): { ziel: SchrittId; personen: PersonStand[] } {
  const ziel: SchrittId =
    a.modus === 'datensparsam' && a.schritt && a.schritt in RANG
      ? (a.schritt as SchrittId)
      : 'will_wohnung';
  const personen = a.haushalt.personen.map((person, index) => {
    const da = a.unterlagen
      .filter((u) => u.person === index)
      .sort((x, y) => x.seiten[0] - y.seiten[0]);
    const typen = new Set(da.map((u) => u.typ));
    const fehlt: Fehlend[] = [];
    const spaeter: Fehlend[] = [];
    for (const e of imVertrag(person) ? stimme.erwartet.vertrag : stimme.erwartet.buerge) {
      const hat =
        e.anforderung === 'einkommen'
          ? stimme.einkommen.some((t) => typen.has(t))
          : typen.has(e.typ ?? '');
      if (hat) continue;
      const schritt = e.schritt as SchrittId;
      (RANG[schritt] <= RANG[ziel] ? fehlt : spaeter).push({ text: e.text, schritt, typ: e.typ });
    }
    return { person, index, da, fehlt, spaeter };
  });
  return { ziel, personen };
}

/** Stand im Eingang: nur Text, ohne Haken und ohne Wertung (VS13). */
export function standText(a: HeftaAnhang): string {
  const { ziel, personen } = vollstaendigkeit(a);
  if (ziel === 'besichtigung') return 'Zusammengestellt für die Besichtigung';
  const v = personen.filter((p) => imVertrag(p.person));
  const ohne = v
    .filter((p) => p.fehlt.some((f) => f.typ === 'selbstauskunft'))
    .map((p) => vorname(p.person.name));
  if (v.length === 1) return ohne.length ? 'Selbstauskunft nicht dabei' : 'Selbstauskunft dabei';
  if (!ohne.length) return 'Selbstauskunft von allen dabei';
  return `Selbstauskunft von ${aufzaehlen(ohne)} nicht dabei`;
}

/** 1: bis zum Mietwunsch, 2: nach der Entscheidung des Vermieters, 3: nicht nötig. */
export function gruppe(u: AnhangUnterlage, p: AnhangPerson): 1 | 2 | 3 {
  const t = TYPEN.get(u.typ);
  if (t?.etikett === 'meist_unnoetig') return 3;
  if (!imVertrag(p)) return 2;
  const schritt = (t?.schritt ?? 'zusage') as SchrittId;
  return (RANG[schritt] ?? 3) <= 2 ? 1 : 2;
}

export function fehlendeGruppe(f: Fehlend, p: AnhangPerson): 1 | 2 {
  return RANG[f.schritt] <= 2 && imVertrag(p) ? 1 : 2;
}

/** Bezeichnungen nur aus dem Katalog; was die Seite nicht kennt, zeigt sie allgemein. */
export function unterlageText(u: AnhangUnterlage): string {
  const t = TYPEN.get(u.typ);
  if (!t) return 'Weitere Unterlage';
  return u.monate?.length === 1 && t.textEinzeln ? t.textEinzeln : t.text;
}

export function unterlageAngabe(u: AnhangUnterlage): string {
  if (u.monate?.length) return monateText(u.monate);
  return u.vom ? `vom ${datumText(u.vom)}` : '';
}

export const unterlageHinweis = (u: AnhangUnterlage) => stimme.hinweise[u.typ] ?? '';
export const rolleText = (p: AnhangPerson) => katalog.rollen[p.rolle]?.textNeutral ?? 'Mietpartei';
export const ueblichText = (f: Fehlend) => stimme.schritte[f.schritt].ueblich;
export const gehoertText = (s: SchrittId) => stimme.schritte[s].gehoert;

export interface PruefPunkt {
  titel: string;
  text: string;
  link?: { text: string; url: string };
}

/**
 * Was sich prüfen lässt. Abweichung vom Entwurf: kein errechnetes „bis 19. Dezember“. Die 60 Tage stehen
 * nur in einem Muster von 2022, die Prüfseite selbst nennt keine Frist.
 */
export function pruefPunkte(a: HeftaAnhang): { punkte: PruefPunkt[]; quelle: string } {
  const weg = stimme.pruefwege.bonitaet!;
  const punkte: PruefPunkt[] = [];
  for (const u of [...a.unterlagen].sort((x, y) => x.seiten[0] - y.seiten[0])) {
    const p = a.haushalt.personen[u.person]!;
    const wer = vorname(p.name);
    if (u.typ === 'bonitaet') {
      const frist = `laut Muster der SCHUFA ${weg.tage} Tage ab Ausstellung`;
      punkte.push({
        titel: `Bonitätsnachweis von ${wer}`,
        text:
          u.pruefweg === 'pruefcode'
            ? `Der ${weg.name} steht auf dem Zertifikat (${seitenText(u.seiten)}). Online prüfen lässt er sich ${frist}, mit dem Code und dem Geburtsdatum von ${p.name}. Beides steht auf dem Zertifikat. Endet die Frist, wird der Nachweis dadurch nicht ungültig.`
            : `Steht auf dem Zertifikat ein ${weg.name}, lässt er sich ${frist} online prüfen. Endet die Frist, wird der Nachweis dadurch nicht ungültig.`,
        link: { text: `Auf ${weg.adresse} prüfen`, url: weg.url },
      });
    }
    if (u.typ === 'buergschaftserklaerung') {
      punkte.push({
        titel: `Bürgschaft von ${wer}`,
        text: `In der Mappe liegt nur ein Scan. Gültig ist die Bürgschaft mit Unterschrift auf Papier (§${NB}766 BGB); das Original gehört zur Vertrags\u00adunterzeichnung.`,
      });
    }
  }
  return {
    punkte,
    quelle: `Quellen: ${weg.quelle} (Stand ${weg.stand}), §${NB}766 BGB. Ein Hinweis, keine Rechtsberatung.`,
  };
}

const ROLLEN = new Set(['hauptmieter', 'mitmieter', 'buerge']);
const SCHRITTE = new Set(Object.keys(RANG));
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const MONAT = /^\d{4}-\d{2}$/;
const MAX_TEXT = 200;
const MAX_BITTE = 500;

const text = (v: unknown, max = MAX_TEXT): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const ganz = (v: unknown, von: number, bis: number): v is number =>
  Number.isInteger(v) && (v as number) >= von && (v as number) <= bis;
/** Text vergleichbar machen: Das PDF trennt Zeilen und Wörter anders als die Lesehilfe. */
const blank = (s: string) =>
  s
    .normalize('NFC')
    .replace(/[\s\u00a0\u00ad\u2060]/g, '')
    .toLowerCase();

/**
 * Passt die Lesehilfe zu dieser Mappe? Sonst wird sie gar nicht gezeigt, auch nicht teilweise (VS5b).
 * Strenger als der Entwurf: Die Seitenzahl muss stimmen, und Namen und Straße stehen auf Seite 1.
 */
export function lesehilfePasst(a: HeftaAnhang, seiten: number, ersteSeite: string): boolean {
  const personen = a.haushalt?.personen;
  const mitziehende = a.haushalt?.mitziehende;
  if (!Array.isArray(personen) || !personen.length || !Array.isArray(mitziehende)) return false;
  if (!text(a.erstellt) || !TAG.test(a.erstellt)) return false;
  if (a.seitenzahl !== undefined && a.seitenzahl !== seiten) return false;
  if (a.schritt !== undefined && !SCHRITTE.has(a.schritt)) return false;
  if (a.loeschwunsch !== undefined && !text(a.loeschwunsch, MAX_BITTE)) return false;
  if (!personen.some((p) => p && p.rolle !== 'buerge')) return false;

  const seite = blank(ersteSeite);
  const steht = (s: string) =>
    s
      .trim()
      .split(/\s+/)
      .every((w) => seite.includes(blank(w)));
  for (const p of personen) {
    if (!p || !text(p.name) || !ROLLEN.has(p.rolle) || !steht(p.name)) return false;
  }
  for (const m of mitziehende) {
    if (!m || !text(m.text) || !ganz(m.anzahl, 1, 50)) return false;
  }
  const w = a.bewerbung?.wohnung;
  if (w) {
    if (!text(w.strasse) || (w.rest !== undefined && !text(w.rest)) || !steht(w.strasse))
      return false;
  }
  if (!Array.isArray(a.unterlagen)) return false;
  for (const u of a.unterlagen) {
    if (!u || !text(u.typ) || !ganz(u.person, 0, personen.length - 1)) return false;
    if (!Array.isArray(u.seiten) || u.seiten.length !== 2) return false;
    const [von, bis] = u.seiten;
    if (!ganz(von, 1, seiten) || !ganz(bis, von, seiten)) return false;
    if (u.vom !== undefined && !(text(u.vom) && TAG.test(u.vom))) return false;
    if (u.monate !== undefined) {
      if (!Array.isArray(u.monate) || !u.monate.length) return false;
      if (!u.monate.every((m) => typeof m === 'string' && MONAT.test(m))) return false;
    }
  }
  return true;
}
