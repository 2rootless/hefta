import {
  anschriftAusText,
  anschriftGetrimmt,
  anschriftText,
  anschriftVollstaendig,
  leereAnschrift,
  type Anschrift,
} from '../formblatt/anschrift';
import { teilStand, type Formular, type TeilStand } from '../formblatt/formblatt';
import {
  betragText,
  leereAngaben,
  type BuergschaftAngaben,
  type BuergschaftsArt,
} from './buergschaft';

// W63 (PC205, Abschnitt 3; DP135, Abschnitt 2; PC208, Schritt 3): Die Bürgschaftserklärung in der App in vier Teilen
// wie die Selbstauskunft, auf demselben Formblatt. Gespeichert wird sofort, am Heft und je Person, die bürgt; Name
// und Mieter kommen immer aus dem Haushalt (U7). Nötig sind nur Höchstbetrag und Art (E112, PC47 §3); alles andere
// bleibt sonst auf dem Blatt frei für die Hand. Läuft ohne Browser-APIs.

export const BUERGSCHAFT_TEILE = ['wer', 'fuerWen', 'wohnung', 'betrag'] as const;
export type BuergschaftTeil = (typeof BUERGSCHAFT_TEILE)[number];

/** Was man in der App einträgt; die Anschriften in drei Feldern (W60). */
export interface BuergschaftEingabe {
  /** Anschrift der Person, die bürgt. */
  anschrift: Anschrift;
  vermieterName: string;
  vermieterAnschrift: Anschrift;
  wohnung: Anschrift;
  /** „2. OG links“, freiwillig (DP135, U6). */
  lage: string;
  vertrag: 'unterschrieben' | 'nochNicht';
  /** „JJJJ-MM-TT“: „Mietvertrag vom“ oder „Einzug zum“, je nach `vertrag`. */
  vertragTag: string;
  hoechstbetrag: number | null;
  art: BuergschaftsArt | null;
}

/** Gespeichert am Heft (`Heft.buergschaften`), je Person, die bürgt. */
export interface BuergschaftEntwurf extends BuergschaftEingabe {
  /** ISO-Zeit der letzten Änderung, für „Zuletzt geändert am …“. */
  geaendert: string;
}

/** Was das Formblatt prüft: die Eingabe und, was aus dem Haushalt kommt. */
export interface BuergschaftWerte {
  e: BuergschaftEingabe;
  name: string;
  mieter: string[];
}

const da = (s: string) => s.trim() !== '';

export const BUERGSCHAFT_FORMULAR: Formular<BuergschaftWerte> = {
  id: 'buergschaft',
  teile: BUERGSCHAFT_TEILE,
  felder: [
    { id: 'name', teil: 'wer', art: 'name', noetig: false, gefuellt: (w) => da(w.name) },
    {
      id: 'anschrift',
      teil: 'wer',
      art: 'anschrift',
      noetig: false,
      gefuellt: (w) => anschriftVollstaendig(w.e.anschrift),
    },
    {
      id: 'mieter',
      teil: 'fuerWen',
      art: 'name',
      noetig: false,
      gefuellt: (w) => w.mieter.some(da),
    },
    {
      id: 'vermieter',
      teil: 'fuerWen',
      art: 'name',
      noetig: false,
      gefuellt: (w) => da(w.e.vermieterName),
    },
    {
      id: 'vermieterAnschrift',
      teil: 'fuerWen',
      art: 'anschrift',
      noetig: false,
      gefuellt: (w) => anschriftVollstaendig(w.e.vermieterAnschrift),
    },
    {
      id: 'wohnung',
      teil: 'wohnung',
      art: 'anschrift',
      noetig: false,
      gefuellt: (w) => anschriftVollstaendig(w.e.wohnung),
    },
    {
      id: 'lage',
      teil: 'wohnung',
      art: 'text',
      noetig: false,
      zusatz: true,
      gefuellt: (w) => da(w.e.lage),
    },
    {
      id: 'vertragTag',
      teil: 'wohnung',
      art: 'datum',
      noetig: false,
      gefuellt: (w) => /^\d{4}-\d{2}-\d{2}$/.test(w.e.vertragTag),
    },
    {
      id: 'hoechstbetrag',
      teil: 'betrag',
      art: 'betrag',
      noetig: true,
      gefuellt: (w) => !!w.e.hoechstbetrag && w.e.hoechstbetrag > 0,
    },
    { id: 'art', teil: 'betrag', art: 'wahl', noetig: true, gefuellt: (w) => !!w.e.art },
  ],
};

export function buergschaftStand(w: BuergschaftWerte): (TeilStand & { id: BuergschaftTeil })[] {
  return teilStand(BUERGSCHAFT_FORMULAR, w) as (TeilStand & { id: BuergschaftTeil })[];
}

export type BuergschaftKnopf =
  { art: 'weiter'; ziel: BuergschaftTeil } | { art: 'blass' } | { art: 'fertig' };

/**
 * Hauptknopf wie in der Selbstauskunft (K9): „Weiter“ mit dem nächsten Teil, der noch nicht ganz ausgefüllt ist;
 * nach dem letzten Teil zurück nur zu einem, dem Nötiges fehlt. Freiwillige Lücken halten nichts auf: Sind Höchstbetrag
 * und Art da und kommt danach kein offener Teil mehr, heißt der Knopf „Fertig“. Fehlt das Nötige nur noch im offenen
 * Teil, ist er blass, und der Satz darüber sagt, was fehlt.
 */
export function buergschaftKnopf(
  stand: Pick<TeilStand, 'id' | 'fertig' | 'voll'>[],
  offen: string | null,
): BuergschaftKnopf {
  const i = offen ? stand.findIndex((s) => s.id === offen) : -1;
  const danach = stand.slice(i + 1).find((s) => !s.fertig || !s.voll);
  if (danach) return { art: 'weiter', ziel: danach.id as BuergschaftTeil };
  const noetig = stand.find((s) => !s.fertig && s.id !== offen);
  if (noetig) return { art: 'weiter', ziel: noetig.id as BuergschaftTeil };
  return stand.some((s) => !s.fertig) ? { art: 'blass' } : { art: 'fertig' };
}

export function leereEingabe(): BuergschaftEingabe {
  return {
    anschrift: leereAnschrift(),
    vermieterName: '',
    vermieterAnschrift: leereAnschrift(),
    wohnung: leereAnschrift(),
    lage: '',
    vertrag: 'nochNicht',
    vertragTag: '',
    hoechstbetrag: null,
    art: null,
  };
}

/** Was Hefta beim ersten Öffnen schon weiß: aus der Person, aus dem Heft. */
export interface BuergschaftVorbelegung {
  /** Anschrift aus der Selbstauskunft der Person, getrennt oder als Zeile (ältere Daten). */
  anschrift?: Anschrift | null;
  anschriftText?: string | null;
  vermieterName?: string | null;
  /** Zeilen der Adresse aus dem Heft: „Lindenring 3, 2. OG“ und „20259 Hamburg“. */
  wohnungZeilen?: string[];
  einzug?: string | null;
}

/**
 * Die Eingabe beim Öffnen: der gespeicherte Entwurf, sonst vorbelegt. Ein gespeicherter Entwurf geht vor, auch wenn
 * sich Heft oder Person seither geändert haben; wer etwas geändert hat, findet es so wieder.
 */
export function eingabeFuer(
  entwurf: BuergschaftEntwurf | null | undefined,
  v: BuergschaftVorbelegung,
): BuergschaftEingabe {
  if (entwurf) {
    const { geaendert: _, ...eingabe } = entwurf;
    void _;
    return { ...leereEingabe(), ...eingabe };
  }
  const zeilen = (v.wohnungZeilen ?? []).map((z) => z.trim()).filter(Boolean);
  const wohnung = anschriftAusText(zeilen.join(', '));
  // Die erste Zeile im Heft heißt „Straße und Lage“: Was nach der Hausnummer mit Komma folgt, ist die Lage.
  const [strasse = '', ...lage] = wohnung.plz
    ? wohnung.strasse.split(/\s*,\s*/)
    : [wohnung.strasse];
  return {
    ...leereEingabe(),
    anschrift: v.anschrift
      ? { ...leereAnschrift(), ...v.anschrift }
      : anschriftAusText(v.anschriftText ?? ''),
    vermieterName: v.vermieterName?.trim() ?? '',
    wohnung: { ...wohnung, strasse },
    lage: lage.join(', '),
    vertragTag: /^\d{4}-\d{2}-\d{2}$/.test(v.einzug ?? '') ? v.einzug! : '',
  };
}

/** Für die Speicherung: getrimmt und als einfaches Objekt (IndexedDB klont keine Proxys). */
export function entwurfAus(e: BuergschaftEingabe, jetzt: string): BuergschaftEntwurf {
  return {
    anschrift: anschriftGetrimmt(e.anschrift),
    vermieterName: e.vermieterName.trim(),
    vermieterAnschrift: anschriftGetrimmt(e.vermieterAnschrift),
    wohnung: anschriftGetrimmt(e.wohnung),
    lage: e.lage.trim(),
    vertrag: e.vertrag,
    vertragTag: e.vertragTag,
    hoechstbetrag: e.hoechstbetrag,
    art: e.art,
    geaendert: jetzt,
  };
}

/** Die Zeile der Wohnung fürs PDF: „Lindenring 3, 2. OG links, 20259 Hamburg“ (Kopfzeile und Erklärung). */
export function wohnungText(e: Pick<BuergschaftEingabe, 'wohnung' | 'lage'>): string {
  const w = e.wohnung;
  return [w.strasse.trim(), e.lage.trim(), [w.plz.trim(), w.ort.trim()].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
}

/** Die Angaben fürs PDF (E112) aus der Eingabe und dem, was aus dem Haushalt kommt. */
export function angabenAusEingabe(w: BuergschaftWerte): BuergschaftAngaben {
  return {
    ...leereAngaben(),
    buerge: { name: w.name.trim(), anschrift: anschriftText(w.e.anschrift) },
    mieter: w.mieter.length ? w.mieter : [''],
    vermieter: { name: w.e.vermieterName.trim(), anschrift: anschriftText(w.e.vermieterAnschrift) },
    wohnung: wohnungText(w.e),
    vertrag: w.e.vertrag,
    vertragTag: w.e.vertragTag,
    hoechstbetrag: w.e.hoechstbetrag,
    art: w.e.art,
  };
}

/** Kurz, was in einem zugeklappten Teil steht (wie die Zusammenfassung der Selbstauskunft). */
export function teilZusammenfassung(
  teil: BuergschaftTeil,
  w: BuergschaftWerte,
  arten: Record<BuergschaftsArt, string>,
  tagText: (iso: string) => string,
): string {
  const e = w.e;
  if (teil === 'wer') return [w.name.trim(), anschriftText(e.anschrift)].filter(Boolean).join(', ');
  if (teil === 'fuerWen')
    return [w.mieter.filter(da).join(', '), e.vermieterName.trim()].filter(Boolean).join(' · ');
  if (teil === 'wohnung')
    return [wohnungText(e), e.vertragTag ? tagText(e.vertragTag) : ''].filter(Boolean).join(' · ');
  return [e.hoechstbetrag ? `${betragText(e.hoechstbetrag)} Euro` : '', e.art ? arten[e.art] : '']
    .filter(Boolean)
    .join(', ');
}
