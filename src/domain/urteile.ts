// Urteile zu den Wünschen (B16 Abschnitt 3, `urteile()` und `abweichungen()` in build_b16.py), mit den
// Regeln aus Nachricht 9.11. b und c und E50: Einzug „knapp“ nur bis einen Monat vor dem frühesten Wunsch,
// ungefähre Lage mit Spanne je Postleitzahl (bei ungefährem eigenem Ort beide Spannen), „passt: …“ bei
// höchstens zwei passenden Kriterien und etwas Offenem. Kein Bildschirm „Nebeneinander“ (E51): Die
// Abweichungen stehen im Heft. Reine Rechnung; die Oberfläche kommt mit B18.

const NB = ' ';
const MONATE = [
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

export type Art = 'passt' | 'knapp' | 'nicht' | 'offen' | 'ohne' | 'leer';

export interface Urteil {
  kriterium:
    | 'Warmmiete'
    | 'Zimmer'
    | 'Fläche'
    | 'Lage'
    | 'Einzug'
    | 'Haustiere'
    | 'Befristung'
    | 'Anteil am Einkommen';
  art: Art;
  /** Wert für die Zelle, etwa „1.240 €“, „ca. 3 km“. */
  wert: string;
  /** Satz für die Abweichung, ohne das Urteilswort; leer, wenn es passt. */
  abweichung: string;
}

/**
 * Wünsche des Haushalts. Jeder Wunsch ist freiwillig (Bildschirm „Was sucht ihr?“, B23): Fehlt einer
 * (null), gibt es für dieses Kriterium kein Urteil („ohne“).
 */
export interface Wuensche {
  warmBis: number | null;
  zimmerAb: number | null;
  flaecheAb: number | null;
  /**
   * Der Ort in der Mitte, nur sein Name, etwa „UKE“ oder „Kita Sonnenschein“ (Nachricht 10.11. k:
   * ohne Präposition), mit Umkreis in km.
   */
  ort: {
    name: string;
    kmBis: number;
    /** Postleitzahl des Orts: daraus Lage und Spanne (E46, E50). */
    plz?: string;
    ungefaehr?: boolean;
    spanne?: number;
  } | null;
  /** Einzug von bis, als „JJJJ-MM-TT“; jede Grenze für sich freiwillig. */
  einzugVon: string | null;
  einzugBis: string | null;
}

/** Wünsche mit neutral gefüllten Lücken: So rechnet `urteile` unverändert, Lücken werden danach „ohne“. */
interface WuenscheVoll {
  warmBis: number;
  zimmerAb: number;
  flaecheAb: number;
  ort: Wuensche['ort'];
  einzugVon: string;
  einzugBis: string;
}

function voll(wu: Wuensche): WuenscheVoll {
  return {
    warmBis: wu.warmBis ?? Number.POSITIVE_INFINITY,
    zimmerAb: wu.zimmerAb ?? 0,
    flaecheAb: wu.flaecheAb ?? 0,
    ort: wu.ort,
    einzugVon: wu.einzugVon ?? '0000-01-01',
    einzugBis: wu.einzugBis ?? '9999-12-31',
  };
}

/** Welche Kriterien ohne Wunsch sind. */
function ohneWunsch(wu: Wuensche): Set<Urteil['kriterium']> {
  const ohne = new Set<Urteil['kriterium']>();
  if (wu.warmBis === null) ohne.add('Warmmiete');
  if (wu.zimmerAb === null) ohne.add('Zimmer');
  if (wu.flaecheAb === null) ohne.add('Fläche');
  if (!wu.ort) ohne.add('Lage');
  if (wu.einzugVon === null && wu.einzugBis === null) ohne.add('Einzug');
  return ohne;
}

export interface Wohnung {
  warm: number | null;
  /** Schätzung des Portals oder gerechnet: Nur als „offen“ mit „ca.“, nie als Angabe des Vermieters. */
  warmCa?: number | null;
  zimmer: number | null;
  flaeche: number | null;
  flaecheCa?: boolean;
  /** Luftlinie zum Ort; `ungefaehr` aus der Postleitzahl, mit der Spanne dieser Postleitzahl (E50). */
  lage: { km: number; ungefaehr: boolean; spanne?: number } | null;
  einzug: string | null;
  tiere: 'erlaubt' | 'anfrage' | 'nicht' | null;
  /** „unbefristet“, „2 Jahre“, null: nicht bekannt. */
  befristung: string | null;
}

export interface Haushaltsgeld {
  /** Netto des Haushalts (E50); null: ohne Haushalt (E45). */
  netto: number | null;
  /** Eigene Grenze in Prozent (E36); ohne Grenze kein Urteil. */
  grenze: number | null;
  ihr: boolean;
}

const zahl = (n: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(n);
const eur = (n: number) => `${new Intl.NumberFormat('de-DE').format(Math.round(n))}${NB}€`;
const tag = (t: string) => {
  const [, m, d] = t.split('-').map(Number);
  return `${d}.${NB}${MONATE[(m ?? 1) - 1]}`;
};

/** „ca. 3 km“ aus der Postleitzahl in ganzen Kilometern, sonst „2,4 km“ (Nachricht 9.11. b). */
export function kmText(km: number, ungefaehr: boolean): string {
  return ungefaehr
    ? `ca.${NB}${Math.floor(km + 0.5)}${NB}km`
    : `${km.toFixed(1).replace('.', ',')}${NB}km`;
}

/** Einen Monat vor einem Tag, am selben Tag oder am Monatsende („JJJJ-MM-TT“). */
export function monatVorher(t: string): string {
  const [j, m, d] = t.split('-').map(Number) as [number, number, number];
  const jj = m > 1 ? j : j - 1;
  const mm = m > 1 ? m - 1 : 12;
  const letzter = new Date(Date.UTC(jj, mm, 0)).getUTCDate();
  return `${jj}-${String(mm).padStart(2, '0')}-${String(Math.min(d, letzter)).padStart(2, '0')}`;
}

export function urteile(w: Wohnung, wunsch: Wuensche, geld: Haushaltsgeld): Urteil[] {
  const ohne = ohneWunsch(wunsch);
  return urteileVoll(w, voll(wunsch), geld).map((u) =>
    ohne.has(u.kriterium) ? { ...u, art: 'ohne', abweichung: '' } : u,
  );
}

function urteileVoll(w: Wohnung, wu: WuenscheVoll, geld: Haushaltsgeld): Urteil[] {
  const r: Urteil[] = [];
  if (w.warm !== null) {
    const wt = eur(w.warm);
    const satz = `${wt} warm, ${eur(w.warm - wu.warmBis)} über ${eur(wu.warmBis)}`;
    r.push(
      w.warm <= wu.warmBis
        ? { kriterium: 'Warmmiete', art: 'passt', wert: wt, abweichung: '' }
        : {
            kriterium: 'Warmmiete',
            art: w.warm <= wu.warmBis * 1.05 ? 'knapp' : 'nicht',
            wert: wt,
            abweichung: satz,
          },
    );
  } else if (w.warmCa)
    r.push({
      kriterium: 'Warmmiete',
      art: 'offen',
      wert: `ca.${NB}${eur(w.warmCa)}`,
      abweichung: 'Heizkosten',
    });
  else r.push({ kriterium: 'Warmmiete', art: 'offen', wert: '–', abweichung: 'Warmmiete' });

  if (w.zimmer === null)
    r.push({ kriterium: 'Zimmer', art: 'offen', wert: '–', abweichung: 'Zimmer' });
  else {
    const zt = zahl(w.zimmer);
    r.push(
      w.zimmer >= wu.zimmerAb
        ? { kriterium: 'Zimmer', art: 'passt', wert: zt, abweichung: '' }
        : {
            kriterium: 'Zimmer',
            art: 'nicht',
            wert: zt,
            abweichung: `${zt} Zimmer statt ab ${zahl(wu.zimmerAb)}`,
          },
    );
  }

  if (w.flaeche === null)
    r.push({ kriterium: 'Fläche', art: 'offen', wert: '–', abweichung: 'Fläche' });
  else {
    const qt = `${w.flaecheCa ? `ca.${NB}` : ''}${zahl(w.flaeche)}${NB}m²`;
    const satz = `${qt}, ab ${zahl(wu.flaecheAb)}${NB}m² gewünscht`;
    r.push(
      w.flaeche >= wu.flaecheAb
        ? { kriterium: 'Fläche', art: 'passt', wert: qt, abweichung: '' }
        : {
            kriterium: 'Fläche',
            art: w.flaeche >= wu.flaecheAb * 0.9 ? 'knapp' : 'nicht',
            wert: qt,
            abweichung: satz,
          },
    );
  }

  if (!w.lage || !wu.ort)
    r.push({ kriterium: 'Lage', art: 'offen', wert: '–', abweichung: 'Lage' });
  else {
    const { km, ungefaehr } = w.lage;
    const ungenau = ungefaehr || !!wu.ort.ungefaehr;
    const kt = kmText(km, ungefaehr);
    // „UKE ca. 5 km entfernt, bis 5 km gewünscht“ (Nachricht 10.11. k).
    const satz = `${wu.ort.name} ${kt} entfernt, bis ${zahl(wu.ort.kmBis)}${NB}km gewünscht`;
    let art: Art;
    if (ungenau) {
      // E50: Spanne je Postleitzahl, mindestens 1 km; ist auch der eigene Ort ungefähr, zählen beide.
      const spanne =
        (ungefaehr ? Math.max(1, w.lage.spanne ?? 1) : 0) +
        (wu.ort.ungefaehr ? Math.max(1, wu.ort.spanne ?? 1) : 0);
      art = Math.abs(km - wu.ort.kmBis) <= spanne ? 'knapp' : km < wu.ort.kmBis ? 'passt' : 'nicht';
    } else art = km <= wu.ort.kmBis ? 'passt' : km <= wu.ort.kmBis * 1.1 ? 'knapp' : 'nicht';
    r.push({ kriterium: 'Lage', art, wert: kt, abweichung: art === 'passt' ? '' : satz });
  }

  if (!w.einzug) r.push({ kriterium: 'Einzug', art: 'offen', wert: '–', abweichung: 'Einzug' });
  else if (w.einzug < wu.einzugVon) {
    // Nachricht 9.11. b: knapp nur bis einen Monat vor dem frühesten Wunschtermin; früher heißt doppelte Miete.
    const knapp = w.einzug >= monatVorher(wu.einzugVon);
    r.push({
      kriterium: 'Einzug',
      art: knapp ? 'knapp' : 'nicht',
      wert: tag(w.einzug),
      abweichung: knapp
        ? `Einzug schon am ${tag(w.einzug)}`
        : `Einzug schon am ${tag(w.einzug)}, mehr als einen Monat vor dem Wunsch`,
    });
  } else if (w.einzug > wu.einzugBis)
    r.push({
      kriterium: 'Einzug',
      art: 'nicht',
      wert: tag(w.einzug),
      abweichung: `Einzug erst am ${tag(w.einzug)}, nach dem spätesten Wunschtermin`,
    });
  else r.push({ kriterium: 'Einzug', art: 'passt', wert: tag(w.einzug), abweichung: '' });

  r.push(
    {
      erlaubt: { kriterium: 'Haustiere', art: 'passt', wert: 'ja', abweichung: '' },
      anfrage: {
        kriterium: 'Haustiere',
        art: 'offen',
        wert: 'auf Anfrage',
        abweichung: 'Haustiere (auf Anfrage)',
      },
      nicht: { kriterium: 'Haustiere', art: 'nicht', wert: 'nein', abweichung: 'keine Haustiere' },
      ohne: { kriterium: 'Haustiere', art: 'offen', wert: '–', abweichung: 'Haustiere' },
    }[w.tiere ?? 'ohne'] as Urteil,
  );

  const b = w.befristung;
  r.push(
    b === null
      ? { kriterium: 'Befristung', art: 'offen', wert: '–', abweichung: 'Befristung' }
      : b === 'unbefristet'
        ? { kriterium: 'Befristung', art: 'passt', wert: 'unbefristet', abweichung: '' }
        : { kriterium: 'Befristung', art: 'nicht', wert: b, abweichung: `befristet auf ${b}` },
  );

  // Anteil am Einkommen (E36, E45, E50): ohne Haushalt leer, ohne eigene Grenze ohne Urteil.
  const warm = w.warm ?? w.warmCa ?? null;
  if (geld.netto === null)
    r.push({ kriterium: 'Anteil am Einkommen', art: 'leer', wert: '–', abweichung: '' });
  else if (warm === null || geld.netto <= 0)
    r.push({ kriterium: 'Anteil am Einkommen', art: 'offen', wert: '–', abweichung: '' });
  else {
    const anteil = Math.round((100 * warm) / geld.netto);
    const at = `${anteil}${NB}%`;
    if (geld.grenze === null)
      r.push({ kriterium: 'Anteil am Einkommen', art: 'ohne', wert: at, abweichung: '' });
    else if (anteil <= geld.grenze)
      r.push({ kriterium: 'Anteil am Einkommen', art: 'passt', wert: at, abweichung: '' });
    else
      r.push({
        kriterium: 'Anteil am Einkommen',
        art: anteil <= geld.grenze + 3 ? 'knapp' : 'nicht',
        wert: at,
        abweichung: `Anteil am Einkommen ${at}, ${geld.ihr ? 'eure' : 'deine'} Grenze ${geld.grenze}${NB}%`,
      });
  }
  return r;
}

export interface AbweichungsZeile {
  art: 'nicht' | 'knapp' | 'offen' | 'passt' | 'sonst' | 'alles';
  /** „passt nicht“, „knapp“, „offen“, „passt“; bei „sonst“ und „alles“ leer. */
  wort: string;
  text: string;
  /** Anteil am Einkommen: mit Schloss, „nur für euch“. */
  schloss?: boolean;
  /** Für die Vorschau (B23 F5): Kriterium und Wert, etwa „Warmmiete“ und „1.290 €“. */
  kriterium?: Urteil['kriterium'];
  wert?: string;
}

const WORT = { nicht: 'passt nicht', knapp: 'knapp', offen: 'offen', passt: 'passt' } as const;

/** Die Karte der Abweichungen: nur, was abweicht; „offen“ in einer Zeile; dazu „passt: …“ oder „Sonst passt alles.“ */
export function abweichungen(u: Urteil[]): AbweichungsZeile[] {
  const z: AbweichungsZeile[] = [];
  for (const art of ['nicht', 'knapp'] as const)
    for (const x of u)
      if (x.art === art)
        z.push({
          art,
          wort: WORT[art],
          text: x.abweichung,
          ...(x.kriterium === 'Anteil am Einkommen' ? { schloss: true } : {}),
        });
  const offen = u.filter((x) => x.art === 'offen' && x.abweichung).map((x) => x.abweichung);
  if (offen.length) z.push({ art: 'offen', wort: WORT.offen, text: offen.join(', ') });
  if (!z.length) return [{ art: 'alles', wort: '', text: 'Alles passt.' }];
  const passt = u.filter((x) => x.art === 'passt').map((x) => x.kriterium);
  // Nachricht 9.11. c: wenig passt und etwas ist offen: beim Namen nennen. Nachricht 9.11. b: „Sonst
  // passt alles.“ nur, wenn mindestens ein Kriterium passt.
  if (passt.length && passt.length <= 2 && offen.length)
    z.push({ art: 'passt', wort: WORT.passt, text: passt.join(', ') });
  else if (passt.length) z.push({ art: 'sonst', wort: '', text: 'Sonst passt alles.' });
  return z;
}

// E76 (Planung 11r, 11s, 11t; Antworten n und o): Die Vorschau nennt höchstens drei Abweichungen mit
// Grund, die übrigen zählt sie. Reihenfolge, intern und nie angezeigt:
// 1. „passt nicht“ vor „knapp“; „offen“ zählt nicht.
// 2. Ja-Nein-Punkte stehen oben in ihrer Gruppe: „keine Haustiere“ wie 0 Monate, eine Befristung nach
//    ihrer Dauer in Monaten, kürzer zuerst (gewünscht ist immer „unbefristet“).
// 3. Sonst die Entfernung vom Wunsch in Prozent: Miete und Anteil am Einkommen über der Grenze, Zimmer
//    und Fläche unter dem Wunsch, Lage über dem Umkreis; der Einzug in Monaten außerhalb des Zeitraums.
// 4. Gleichstand: die feste Reihenfolge der Kriterien.

const TAG_MS = 86_400_000;

/** „2 Jahre“, „18 Monate“, „1 Jahr und 6 Monate“ → Monate; unlesbar: 0 (gilt als am weitesten weg). */
export function befristungMonate(b: string): number {
  const jahre = Number(b.match(/(\d+(?:[.,]\d+)?)\s*Jahr/i)?.[1]?.replace(',', '.') ?? 0);
  const monate = Number(b.match(/(\d+)\s*Monat/i)?.[1] ?? 0);
  return Math.round(jahre * 12 + monate);
}

function monateZwischen(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / (TAG_MS * 30.44);
}

/** Schlüssel für die Reihenfolge: kleiner steht weiter oben. */
function rang(
  u: Urteil,
  index: number,
  w: Wohnung,
  wu: WuenscheVoll,
  geld: Haushaltsgeld,
): [number, number, number, number] {
  const gruppe = u.art === 'nicht' ? 0 : 1;
  const pro = (ist: number, soll: number) => (soll > 0 ? (100 * Math.abs(ist - soll)) / soll : 0);
  switch (u.kriterium) {
    case 'Haustiere':
      return [gruppe, 0, 0, index];
    case 'Befristung':
      return [gruppe, 0, befristungMonate(w.befristung ?? ''), index];
    case 'Warmmiete':
      return [gruppe, 1, -pro(w.warm ?? 0, wu.warmBis), index];
    case 'Zimmer':
      return [gruppe, 1, -pro(w.zimmer ?? 0, wu.zimmerAb), index];
    case 'Fläche':
      return [gruppe, 1, -pro(w.flaeche ?? 0, wu.flaecheAb), index];
    case 'Lage':
      return [gruppe, 1, -(w.lage && wu.ort ? pro(w.lage.km, wu.ort.kmBis) : 0), index];
    case 'Einzug': {
      const e = w.einzug ?? '';
      const m =
        e < wu.einzugVon ? monateZwischen(e, wu.einzugVon) : monateZwischen(wu.einzugBis, e);
      return [gruppe, 1, -m, index];
    }
    case 'Anteil am Einkommen': {
      const warm = w.warm ?? w.warmCa ?? 0;
      const anteil = geld.netto ? (100 * warm) / geld.netto : 0;
      return [gruppe, 1, -pro(anteil, geld.grenze ?? anteil), index];
    }
  }
}

/** Die wichtigsten Abweichungen für die Vorschau und wie viele weitere in der Kontrolle stehen. */
export function wichtigsteAbweichungen(
  w: Wohnung,
  wu: Wuensche,
  geld: Haushaltsgeld,
  hoechstens = 3,
): { zeilen: AbweichungsZeile[]; weitere: number; alle: number } {
  const u = urteile(w, wu, geld);
  const ab = u
    .map((x, i) => ({ x, r: rang(x, i, w, voll(wu), geld) }))
    .filter(({ x }) => x.art === 'nicht' || x.art === 'knapp')
    .sort((a, b) => {
      for (let i = 0; i < 4; i++) if (a.r[i] !== b.r[i]) return a.r[i]! - b.r[i]!;
      return 0;
    });
  const zeilen = ab.slice(0, hoechstens).map(({ x }) => ({
    art: x.art as 'nicht' | 'knapp',
    wort: WORT[x.art as 'nicht' | 'knapp'],
    text: x.abweichung,
    kriterium: x.kriterium,
    wert: x.wert,
    ...(x.kriterium === 'Anteil am Einkommen' ? { schloss: true } : {}),
  }));
  return { zeilen, weitere: Math.max(0, ab.length - hoechstens), alle: ab.length };
}

/** Rang einer Wohnung für den Vergleich über Wohnungen hinweg (Test der Planung 11s). */
export function abweichungsRang(
  w: Wohnung,
  wu: Wuensche,
  geld: Haushaltsgeld,
): [number, number, number, number] | null {
  const u = urteile(w, wu, geld);
  const r = u
    .map((x, i) => ({ x, r: rang(x, i, w, voll(wu), geld) }))
    .filter(({ x }) => x.art === 'nicht' || x.art === 'knapp')
    .map(({ r }) => r)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
  return r[0] ?? null;
}
