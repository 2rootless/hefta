import { groesseWieDateien } from '../domain/mailGroesse';
import katalogRoh from '../../data/regelkatalog.de.json';
import { passt, type Papier } from '../../pakete/hefta-json/src/index';
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
  text?: string;
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
    /** Dieselben Sätze mit der Erklärung der Datenschutzkonferenz, für ihr erstes Vorkommen auf der Seite. */
    hinweiseErklaert: Record<string, string>;
    /** Zeile „Quelle“ mit Stand, Abschnitt und Nummer (Aufgabe 52). */
    hinweisQuellen: Record<string, string>;
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
  // Fassung 4: `erstellt` ist ein Zeitpunkt; der Tag sind seine ersten zehn Zeichen.
  const [j, m, t] = iso.slice(0, 10).split('-').map(Number);
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
export function seitenText({ von, bis }: { von: number; bis: number }): string {
  return von === bis ? `Seite${NB}${von}` : `Seiten${NB}${von}${WORTLOS}–${WORTLOS}${bis}`;
}

/** PC186: wie in der App und in „Dateien“ (1 MB = 1 000 000 Byte), mit geschütztem Leerzeichen. */
export function groesseText(bytes: number): string {
  return groesseWieDateien(bytes).replace(' ', NB);
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
  return gesamt > v.length ? `${vertrag}, ${wort(gesamt)} Personen` : vertrag;
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
    // E227: `schritt` allein, gebunden an seinen festen Satz auf dem Deckblatt (V23: kein `modus` mehr).
    a.schritt && a.schritt in RANG ? (a.schritt as SchrittId) : 'will_wohnung';
  const personen = a.haushalt.personen.map((person, index) => {
    const da = [...person.unterlagen].sort((x, y) => x.seiten_mappe.von - y.seiten_mappe.von);
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

export const unterlageHinweis = (u: AnhangUnterlage, erklaert = false) =>
  (erklaert ? stimme.hinweiseErklaert[u.typ] : undefined) ?? stimme.hinweise[u.typ] ?? '';
export const unterlageQuelle = (u: AnhangUnterlage) => stimme.hinweisQuellen[u.typ] ?? '';
/** Nennt der Hinweis die Datenschutzkonferenz? Dann erklärt ihn das erste Vorkommen auf der Seite. */
export const nenntDsk = (u: AnhangUnterlage) => u.typ in stimme.hinweiseErklaert;
/**
 * W57: Fassung 1 und 2 zeigen dasselbe, ohne „Hauptmieter“ und „Mitmieter“: im Vertrag „Im Mietvertrag“, Bürgen „bürgt“.
 * Eine unbekannte Rolle heißt „Mietpartei“ (E220, Regel 6).
 */
export const rolleText = (p: AnhangPerson) =>
  p.rolle === 'buerge'
    ? (katalog.rollen.buerge?.textNeutral ?? 'bürgt')
    : p.rolle === 'vertrag' || p.rolle === 'hauptmieter' || p.rolle === 'mitmieter'
      ? (katalog.rollen.vertrag?.text ?? 'Im Mietvertrag')
      : 'Mietpartei';
export const ueblichText = (f: Fehlend) => stimme.schritte[f.schritt].ueblich;
export const gehoertText = (s: SchrittId) => stimme.schritte[s].gehoert;

export interface PruefPunkt {
  titel: string;
  text: string;
  link?: { text: string; url: string };
}

/**
 * Was sich prüfen lässt. Abweichung vom Entwurf: kein errechnetes „bis 19. Dezember“. Die 60 Tage stehen
 * im Muster der SCHUFA (Januar 2024, Aufgabe 49) als „60 Tagen ab Ausstellungsdatum“; das errechnete Datum
 * (E7) kommt erst mit dem neuen Design.
 */
export function pruefPunkte(a: HeftaAnhang): { punkte: PruefPunkt[]; quelle: string } {
  const weg = stimme.pruefwege.bonitaet!;
  const punkte: PruefPunkt[] = [];
  for (const { u, person: p } of alleUnterlagen(a)) {
    const wer = vorname(p.name);
    if (u.typ === 'bonitaet') {
      const frist = `laut Muster der SCHUFA ${weg.tage} Tage ab Ausstellung`;
      punkte.push({
        titel: `Bonitätsnachweis von ${wer}`,
        text:
          u.pruefweg === 'pruefcode'
            ? `Der ${weg.name} steht auf dem Zertifikat (${seitenText(u.seiten_mappe)}). Online prüfen lässt er sich ${frist}, mit dem Code und dem Geburtsdatum von ${p.name}. Beides steht auf dem Zertifikat. Nach Ablauf der Frist lässt sich der Nachweis nur nicht mehr online prüfen.`
            : `Steht auf dem Zertifikat ein ${weg.name}, lässt er sich ${frist} online prüfen. Nach Ablauf der Frist lässt sich der Nachweis nur nicht mehr online prüfen.`,
        link: { text: `Auf ${weg.adresse} prüfen`, url: weg.url },
      });
    }
    if (u.typ === 'buergschaftserklaerung') {
      punkte.push({
        titel: `Bürgschaft von ${wer}`,
        // Aufgabe 52, Nachtrag k: zugeschrieben statt in der Stimme von Hefta; Quelle in der Zeile darunter.
        text: `In der Mappe liegt nur ein Scan. Laut §${NB}766 BGB ist eine Bürgschaft nur mit schriftlicher Erklärung gültig, nicht in elektronischer Form; das Original gehört zur Vertrags\u00adunterzeichnung.`,
      });
    }
  }
  return {
    punkte,
    quelle: `Quellen: ${weg.quelle} (Stand ${weg.stand}), §${NB}766 BGB. Ein Hinweis, keine Rechtsberatung.`,
  };
}

/** Was in einen Link `tel:` darf: Ziffern, Plus, Klammern, Leerzeichen, Punkt, Strich, Schrägstrich. */
const TELEFON = /^\+?[\d ()./-]{3,30}$/;
/** Eine schlichte Mailadresse, ohne Zeichen, die einen Link `mailto:` verändern könnten. */
const MAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,180}\.[A-Za-z]{2,24}$/;

/** Link zum Anrufen, nur aus einer sauberen Nummer; sonst null und die Nummer steht als Text da. */
export function telefonLink(telefon: string | undefined): string | null {
  if (!telefon || !TELEFON.test(telefon.trim())) return null;
  const ziffern = telefon.replace(/[^\d+]/g, '');
  return ziffern.replace(/\D/g, '').length >= 3 ? `tel:${ziffern}` : null;
}

/** Die Mailadresse für `mailto:`, nur wenn sie sauber ist; sonst null. */
export function mailEmpfaenger(email: string | undefined): string | null {
  return email && MAIL.test(email.trim()) ? email.trim() : null;
}

/**
 * Passt die Lesehilfe zu dieser Mappe? Sonst wird sie gar nicht gezeigt, auch nicht teilweise (VS5b).
 * Die Prüfung aus dem Paket hefta-json (FORMAT.md, Abschnitt 11, Punkte 1 bis 7), mit der Bindung an das Papier.
 */
export function lesehilfePasst(a: HeftaAnhang, seiten: number, papier: Papier): boolean {
  return passt(a, { seiten, ...papier });
}

/** Alle Unterlagen der Mappe mit ihrer Person, in der Reihenfolge der Seiten. */
export function alleUnterlagen(
  a: HeftaAnhang,
): { u: AnhangUnterlage; person: AnhangPerson; index: number }[] {
  return a.haushalt.personen
    .flatMap((person, index) => person.unterlagen.map((u) => ({ u, person, index })))
    .sort((x, y) => x.u.seiten_mappe.von - y.u.seiten_mappe.von);
}

/** Die Person, die als Kontakt auf dem Deckblatt steht (Fassung 2: `ansprech`, Fassung 1: `kontakt`); sonst null. */
export function kontaktPerson(a: HeftaAnhang): AnhangPerson | null {
  return a.haushalt.personen.find((p) => istKontakt(a, p)) ?? null;
}

/** Ist diese Person die Kontakt- bzw. Ansprechperson? */
export function istKontakt(a: HeftaAnhang, p: AnhangPerson): boolean {
  return a.hefta >= 2 ? p.ansprech === true : p.kontakt === true;
}

/** Telefon und Mail der Kontaktperson, wie auf dem Deckblatt; null, wenn keins von beiden da ist. */
export function kontaktwege(a: HeftaAnhang): { telefon?: string; email?: string } | null {
  const p = kontaktPerson(a);
  if (!p || (!p.telefon && !p.email)) return null;
  return { ...(p.telefon ? { telefon: p.telefon } : {}), ...(p.email ? { email: p.email } : {}) };
}
