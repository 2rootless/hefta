// Der Leser (Schritt 4, docs/25-messung-auslesen.md): liest Eckdaten aus dem Text einer Inseratsseite.
// Übertragen aus dem Probe-Leser der Messung (hefta-probe/leser.py, außerhalb des Repositorys), Regel für
// Regel. Dort las er 65 Inserate mit 424 Angaben ohne Fehler; derselbe Vergleich läuft hier in
// `korpus.test.ts`, wenn die Rohdaten auf dem Rechner liegen. Regel: lieber leer als falsch. Jeder Wert ist
// ein Vorschlag, den der Nutzer in der letzten Kontrolle bestätigt (B23).

export interface Seite {
  text: string;
  url?: string;
  titel?: string;
}

export interface Gelesen {
  kauf?: true;
  kalt?: number;
  kalt_ca?: true;
  /** Kopfpreis bei Kleinanzeigen: meist kalt, bei Privaten oft warm. */
  kalt_kopf?: true;
  warm?: number;
  warm_ca?: true;
  nk?: number;
  nk_ca?: true;
  heiz?: number;
  heiz_ca?: true;
  kaution?: number;
  kaution_ca?: true;
  kaution_monate?: number;
  flaeche?: number;
  zimmer?: number;
  /** „JJJJ-MM-TT“, „JJJJ-MM“ (nur Monat) oder „sofort“. */
  einzug?: string;
  bis?: string;
  staffel?: boolean;
  index?: boolean;
  wbs?: boolean;
  befristet?: boolean;
}

type Feld = 'kalt' | 'warm' | 'nk' | 'heiz' | 'kaution' | 'flaeche' | 'zimmer' | 'einzug' | 'bis';

/** Bezeichnungen je Feld, in der Reihenfolge des Vorrangs. */
const FELDER: [Feld, string[]][] = [
  [
    'kalt',
    [
      'kaltmiete (zzgl. nebenkosten)',
      'nettokaltmiete',
      'kaltmiete',
      'grundmiete',
      'mietpreis',
      'miete',
    ],
  ],
  ['warm', ['warmmiete', 'gesamtmiete (in €)', 'gesamtmiete']],
  ['nk', ['nebenkosten', 'betriebskosten']],
  ['heiz', ['heizkosten (netto)', 'heizkosten']],
  [
    'kaution',
    [
      'kaution o. genossenschaftsanteile',
      'kaution oder genossenschaftsanteile',
      'kaution / genoss.-anteile',
      'kaution/genossenschaftsanteile',
      'kaution',
    ],
  ],
  ['flaeche', ['wohnfläche ca.', 'wohnfläche', 'größe', 'fläche']],
  ['zimmer', ['anzahl zimmer', 'zimmer']],
  ['einzug', ['bezugsfrei ab', 'verfügbar ab', 'frei ab']],
  ['bis', ['frei bis']],
];
const GELD = new Set<Feld>(['kalt', 'warm', 'nk', 'heiz', 'kaution']);
const STOPP = [
  /\nähnliche anzeigen\n/,
  /\nzusatzkosten sparen\n/,
  /\nbei nebenkosten sparen\n/,
  /\nwohnung mieten deutschland\n/,
  /\nweitere ergebnisse für/,
  /\nbeliebte stadtteile/,
  /\nwie zufrieden bist du/,
  /\nähnliche objekte/,
  /das könnte dich auch interessieren/,
];
const ZAHL = String.raw`(\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
const MONATSNAMEN = [
  'januar',
  'februar',
  'märz',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'dezember',
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

export function zahl(text: string): number | null {
  const t = text.trim();
  if (/^\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?$/.test(t))
    return Number(t.replace(/\./g, '').replace(/\s/g, '').replace(',', '.'));
  if (/^\d+,\d{1,2}$/.test(t)) return Number(t.replace(',', '.'));
  if (/^\d+\.\d{1,2}$/.test(t)) return Number(t);
  if (/^\d+$/.test(t)) return Number(t);
  return null;
}

function bereinigen(text: string): string {
  const t = text
    .replace(/\u00ad/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, ': ');
  const klein = t.toLowerCase();
  let ende = t.length;
  for (const s of STOPP) {
    const m = s.exec(klein);
    if (m) ende = Math.min(ende, m.index);
  }
  return t.slice(0, ende);
}

/**
 * Alle Kandidaten zur Bezeichnung, in Textfolge: „Bez: Wert“, „Bez Wert“ oder Wert in der nächsten Zeile.
 * Steht in der nächsten Zeile ein Preis je m², kommt auch die übernächste dran (Immowelt).
 */
function* werteNach(t: string, bez: string): Generator<string> {
  const muster = new RegExp(
    // Die Folgezeilen nur ansehen, nicht verbrauchen: Sonst verschluckt „Heizkosten enthalten / Nein“
    // die nächste Zeile „Heizkosten“ (Vonovia im Fenster, Probe 2).
    String.raw`(?:^|\n)\s*(?:[*•·\-–]\s*)?` +
      esc(bez) +
      String.raw`[ ]*:?[ ]*([^\n]*)(?=\n?([^\n]*)\n?([^\n]*))`,
    'gi',
  );
  for (const m of t.matchAll(muster)) {
    const [gleich, naechste, dritte] = [m[1], m[2], m[3]].map((x) => (x ?? '').trim()) as [
      string,
      string,
      string,
    ];
    // „Kaltmiete 19,75 €/m²: 2.350 €“ (geteilter Text von ImmoScout24): der Betrag nach dem Doppelpunkt.
    const nachM2 = /€\s*\/\s*m²\s*:\s*(.+)$/.exec(gleich);
    if (nachM2) yield nachM2[1] ?? '';
    else if (gleich) yield gleich;
    else if (naechste) {
      yield naechste;
      if (/€\s*\/\s*m|^nicht in/i.test(naechste)) yield dritte;
    }
  }
}

function geld(roh: string | null): number | null {
  if (
    roh === null ||
    roh.trimStart().startsWith('~') ||
    /geschätzt|n\.a\.|auf anfrage|keine angabe|inklusive|\binkl\b|enthalten/i.test(roh)
  )
    return null;
  // „ca. 900 €“: Wert mit Merkzeichen
  const r = roh.replace(/EUR/g, '€').replace(/^\s*(ca\.|circa|etwa)\s*/i, '');
  // nur der erste Betrag („1872 €1.872 €“)
  const m = new RegExp(String.raw`^\s*\+?\s*` + ZAHL + String.raw`\s*(€?)\s*(\S*)`).exec(r);
  if (!m) return null;
  // Preis je m², Fläche, Zimmer, Prozent, Energie
  // „1.100 €/Monat“ (Immowelt im Fenster) ist ein Monatsbetrag, kein Preis je m².
  const nach = (m[3] ?? '').replace(/^\/monat$/i, '');
  if (/^(\/|m²|m2|qm|zi|%|kwh)/i.test(nach) || /€\s*\/\s*m(?!onat\s*$)/.test(r.slice(0, 25)))
    return null;
  const w = zahl(m[1] ?? '');
  return w !== null && w >= 0 && w < 100000 ? w : null;
}

function flaeche(roh: string): number | null {
  const m = new RegExp(
    String.raw`^\s*(?:ca\.\s*)?` + ZAHL + String.raw`\s*(m²|m2|qm|m\b)`,
    'i',
  ).exec(roh);
  if (!m) return null;
  const w = zahl(m[1] ?? '');
  return w && w >= 8 && w <= 500 ? w : null;
}

function zimmer(roh: string): number | null {
  const m = /^\s*(\d+(?:[.,]\d{1,2})?)(?:\s|$|zimmer)/i.exec(roh);
  if (!m) return null;
  const w = Number((m[1] ?? '').replace(',', '.'));
  return w >= 1 && w <= 12 ? w : null;
}

const zwei = (n: number) => String(n).padStart(2, '0');

export function datum(roh: string): string | null {
  if (/^\s*(sofort|ab sofort)/i.test(roh)) return 'sofort';
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(roh);
  if (!m) {
    // „Februar 2027“ (Kleinanzeigen), „08/2025“ (ImmoScout24): nur Monat
    let mm = new RegExp(
      String.raw`^\s*(` + MONATSNAMEN.join('|') + String.raw`)\s+(\d{4})`,
      'i',
    ).exec(roh);
    if (mm) return `${mm[2]}-${zwei(MONATSNAMEN.indexOf((mm[1] ?? '').toLowerCase()) + 1)}`;
    mm = /^\s*(\d{1,2})\/(\d{4})\b/.exec(roh);
    if (mm && Number(mm[1]) >= 1 && Number(mm[1]) <= 12) return `${mm[2]}-${zwei(Number(mm[1]))}`;
    return null;
  }
  let j = m[3] ?? '';
  j = j.length === 2 ? '20' + j : j;
  return `${j}-${zwei(Number(m[2]))}-${zwei(Number(m[1]))}`;
}

const LESEN: Record<
  'flaeche' | 'zimmer' | 'einzug' | 'bis',
  (roh: string) => number | string | null
> = {
  flaeche,
  zimmer,
  einzug: datum,
  bis: datum,
};
const MONATE = /^\s*(\d|zwei|drei)\s*(?:netto)?\s*-?\s*(kalt|monats|km\b|nkm\b|mm\b|grundmiet)/i;

export function lesen(seite: Seite): Gelesen {
  const t = bereinigen(seite.text);
  const host = (seite.url ?? '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0] ?? '';
  const titel = seite.titel ?? '';
  // kein Mietinserat, nichts lesen
  if (/\nkategorie\n(eigentumswohnung|häuser zum kauf)/i.test(t) || /zum kauf/i.test(titel))
    return { kauf: true };
  // Immowelt: Kopf hat „Wert | Bezeichnung“, gerundet; genau steht es erst unter „Mietkosten“.
  let geldT = t;
  if (host === 'immowelt.de') {
    const m = /\nmietkosten\n/i.exec(t);
    if (m) geldT = t.slice(m.index);
  }
  const aus: Gelesen & Record<string, unknown> = {};
  for (const [feld, bezeichnungen] of FELDER) {
    let fertig = false;
    for (const b of bezeichnungen) {
      for (const roh of werteNach(GELD.has(feld) ? geldT : t, b)) {
        if (feld === 'kaution') {
          const mm = MONATE.exec(roh);
          if (mm) {
            const n = (mm[1] ?? '').toLowerCase();
            aus.kaution_monate = n === 'zwei' ? 2 : n === 'drei' ? 3 : Number(n);
            fertig = true;
            break;
          }
        }
        const w = GELD.has(feld) ? geld(roh) : LESEN[feld as 'flaeche'](roh);
        if (w !== null && !((feld === 'kalt' || feld === 'warm') && w === 0)) {
          (aus as Record<string, unknown>)[feld] = w;
          if (GELD.has(feld) && /^\s*(ca\.|circa|etwa)/i.test(roh)) aus[`${feld}_ca`] = true;
          fertig = true;
          break;
        }
      }
      if (fertig) break;
    }
  }
  if (aus.zimmer === undefined) {
    // erst der Titel, dann „N Zimmer“ am Zeilenanfang; nur glaubhafte Werte
    const quellen: [string, RegExp][] = [
      [t, /€\s*zimmer\n(\d+(?:,5)?)\n/gi], // WG-Gesucht: „1065€ Zimmer | 3“
      [titel, /(?:^|[\s(])(\d+(?:,5)?)\s*-?\s*(?:zimmer|zi\b|raum)/gi],
      [t, /(?:^|\n)\s*(\d+(?:[.,]5)?)\s*(?:zimmer|zi\.)/gi],
    ];
    for (const [quelle, muster] of quellen) {
      for (const m of quelle.matchAll(muster)) {
        const w = Number((m[1] ?? '').replace(',', '.'));
        if (w >= 1 && w <= 12) {
          aus.zimmer = w;
          break;
        }
      }
      if (aus.zimmer !== undefined) break;
    }
  }
  if (aus.flaeche === undefined) {
    // Immowelt-Titel „Wohnung 79.19 m² 1329 € zur Miete“, genauer als der Kopf
    const m = /(\d+(?:[.,]\d{1,2})?)\s*(?:m²|qm)/.exec(titel);
    if (m) {
      const w = Number((m[1] ?? '').replace(',', '.'));
      if (w >= 8 && w <= 500) aus.flaeche = w;
    }
  }
  if (aus.flaeche === undefined) {
    // Wert vor der Bezeichnung: „88,43 m²“, Leerzeile, „Größe“ (Vonovia im Fenster, Probe 2).
    const m =
      /(?:^|\n)\s*(\d+(?:[.,]\d{1,2})?)\s*m²\s*\n+\s*(?:größe|wohnfläche|fläche)\s*(?:\n|$)/i.exec(
        t,
      );
    if (m) {
      const w = Number((m[1] ?? '').replace(',', '.'));
      if (w >= 8 && w <= 500) aus.flaeche = w;
    }
  }
  if (aus.einzug === undefined) {
    // Wert vor der Bezeichnung: „09.12.2026“, Leerzeile, „Bezugsfrei ab“ (Vonovia im Fenster, Probe 2).
    const m =
      /(?:^|\n)\s*(\d{1,2}\.\d{1,2}\.\d{2,4})\s*\n+\s*(?:bezugsfrei|verfügbar|frei) ab\s*(?:\n|$)/i.exec(
        t,
      );
    const d = m ? datum(m[1] ?? '') : null;
    if (d) aus.einzug = d;
  }
  // Einzug: fehlt er oder ist er nur ein Monat, ein genaues Datum aus Überschrift oder Beschreibung nehmen
  // („frei ab dem 18.12.2026“, „* Verfügbar ab 01.02.2027“), beim Monat nur, wenn es derselbe Monat ist.
  if (aus.einzug === undefined || aus.einzug.length === 7) {
    for (const m of (titel + '\n' + t).matchAll(
      /(?:frei|verfügbar|bezugsfrei)\s+ab\s+(?:dem\s+)?(\d{1,2}\.\d{1,2}\.\d{2,4})/gi,
    )) {
      const d = datum(m[1] ?? '');
      if (d && (aus.einzug === undefined || d.startsWith(aus.einzug))) {
        aus.einzug = d;
        break;
      }
    }
  }
  if (aus.warm === undefined) {
    // WG-Gesucht: „45m²Gesamtmiete“ zusammengeklebt
    const m = new RegExp(String.raw`gesamtmiete\n` + ZAHL + String.raw`\s*€`, 'i').exec(t);
    if (m) {
      const w = zahl(m[1] ?? '');
      if (w !== null) aus.warm = w;
    }
  }
  if (aus.kalt === undefined && host === 'kleinanzeigen.de') {
    // Kopfpreis: meist kalt, bei Privaten oft warm. Nur nehmen, wenn er unter der Warmmiete liegt.
    const m = new RegExp(String.raw`\n\s*` + ZAHL + String.raw`\s*€\s*(?:vb)?\s*\n`, 'i').exec(
      t.slice(0, 700),
    );
    if (m) {
      const w = zahl(m[1] ?? '');
      if (w && (aus.warm === undefined || w < aus.warm - 1)) {
        aus.kalt = w;
        aus.kalt_kopf = true;
      }
    }
  }
  if (aus.kaution_monate !== undefined && aus.kaution === undefined && aus.kalt !== undefined)
    aus.kaution = Math.round(aus.kaution_monate * aus.kalt * 100) / 100;
  const klein = t.toLowerCase();
  aus.staffel = /staffelmiet/.test(klein);
  aus.index = /indexmiet/.test(klein);
  aus.wbs = new RegExp(
    String.raw`wbs (ist )?(erforderlich|notwendig|benötigt|nötig|zwingend)|wohnberechtigungsschein:?\s*(ist )?(erforderlich|notwendig)` +
      String.raw`|wohnberechtigungsschein\s*:?\s*erforderlich|\bwbs\b[^\n]{0,30}erforderlich|mit wbs\b|nur mit (gültigem )?wbs` +
      String.raw`|nur mit wohnberechtigungsschein`,
  ).test(klein);
  aus.befristet =
    aus.bis !== undefined ||
    (/\bbefristet\b|zwischenmiete/.test(klein) && !/unbefristet/.test(klein));
  return aus;
}

export interface GeleseneAdresse {
  strasse: string;
  plz: string;
  ort: string;
  /** Mittlerer Teil wie „Eimsbüttel“ in „Lindenallee 3, Eimsbüttel, 20259 Hamburg“. */
  stadtteil: string | null;
}

// Eine Straße: endet auf eine übliche Endung oder trägt eine Hausnummer. So bleiben Zeilen wie „SCHUFA
// BonitätsCheck“ oder eine Postleitzahl allein außen vor.
const STRASSE = String.raw`([A-ZÄÖÜ][^\n,()]*?(?:(?:straße|str\.|weg|allee|ring|platz|damm|chaussee|gasse|ufer|kamp|stieg|twiete|markt|berg|feld|hof)|\d+\s*[a-z]?))`;
const ORT = String.raw`([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .\-/]*[A-Za-zÄÖÜäöüß])`;

/**
 * Die erste Adresse im Text, in der Reihenfolge der Seite: Die Lage des Inserats steht oben, die des
 * Anbieters weiter unten (Probe 2). Formen (Beispiele erfunden): „Lindenallee 3, Eimsbüttel, 20259 Hamburg“,
 * „Talstraße, Westend, Frankfurt am Main (60325)“, „Am Ring 5 - 21109 Hamburg“, Straße und Postleitzahl
 * in zwei Zeilen. Lieber keine als eine falsche.
 */
export function adresseLesen(text: string): GeleseneAdresse | null {
  const zeilen = bereinigen(text)
    .split('\n')
    .map((z) => z.trim());
  const eine = new RegExp(
    '^' + STRASSE + String.raw`\s*(?:,|\s-\s)\s*(?:([^,\n\d]+?),\s*)?(\d{5})\s+` + ORT,
  );
  const klammer = new RegExp(
    '^' + STRASSE + String.raw`\s*,\s*(?:([^,\n\d]+?),\s*)?` + ORT + String.raw`\s*\((\d{5})\)`,
  );
  const nurStrasse = new RegExp('^' + STRASSE + '$');
  const plzZeile = new RegExp(String.raw`^(\d{5})\s+` + ORT);
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i] ?? '';
    let m = eine.exec(z);
    if (m)
      return {
        strasse: m[1]!.trim(),
        plz: m[3]!,
        ort: m[4]!.trim(),
        stadtteil: m[2]?.trim() || null,
      };
    m = klammer.exec(z);
    if (m)
      return {
        strasse: m[1]!.trim(),
        plz: m[4]!,
        ort: m[3]!.trim(),
        stadtteil: m[2]?.trim() || null,
      };
    if (nurStrasse.test(z)) {
      const n = plzZeile.exec(zeilen[i + 1] ?? '');
      if (n) return { strasse: z, plz: n[1]!, ort: n[2]!.trim(), stadtteil: null };
    }
  }
  return null;
}
