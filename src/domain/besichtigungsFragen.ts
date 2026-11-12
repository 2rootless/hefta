// Fragen für die Besichtigung (E52, B17c Abschnitt 3, B21): eine Liste zum Abhaken vor Ort, geordnet wie ein
// Gang durch die Wohnung. Was das Inserat sicher sagt, fällt weg und steht in einer Zeile darüber. Was bei
// den Wünschen offen ist, steht oben. Eigene Fragen gehören zum Gerät (Planung 10i) und kommen bei der
// nächsten Besichtigung wieder. Antworten bleiben im Heft, kein Export. Reine Rechnung.
import type { HeftAngaben } from './modell';
import type { Urteil } from './urteile';

export type Thema =
  | 'zustand'
  | 'uebernahme'
  | 'haus'
  | 'internet'
  | 'nebenkosten'
  | 'heizung'
  | 'kaution'
  | 'vertrag'
  | 'haustiere'
  | 'einzug'
  | 'ablauf';

/** Die Reihenfolge der Liste (B17c Abschnitt 3). */
export const THEMEN: Thema[] = [
  'zustand',
  'uebernahme',
  'haus',
  'internet',
  'nebenkosten',
  'heizung',
  'kaution',
  'vertrag',
  'haustiere',
  'einzug',
  'ablauf',
];

/** Welche Themen das Inserat sicher klärt. Das Internet nennt Hefta nicht, also bleibt die Frage. */
export function sicherImInserat(a: HeftAngaben | undefined): Set<Thema> {
  const sicher = new Set<Thema>();
  if (!a) return sicher;
  // Heizung in der Warmmiete: eine Warmmiete aus dem Inserat, keine Schätzung.
  if (a.warm !== null && !a.warmCa) sicher.add('heizung');
  if (a.kaution !== null && a.kaution !== undefined) sicher.add('kaution');
  if (a.befristung && a.mietart) sicher.add('vertrag');
  if (a.tiere === 'erlaubt' || a.tiere === 'nicht') sicher.add('haustiere');
  return sicher;
}

/** Welche Themen bei den Wünschen offen sind; sie stehen oben (B17c-09). */
const AUS_KRITERIUM: Partial<Record<Urteil['kriterium'], Thema>> = {
  Warmmiete: 'heizung',
  Befristung: 'vertrag',
  Haustiere: 'haustiere',
  Einzug: 'einzug',
};

export interface Frage {
  /** Schlüssel der Antwort: das Thema oder „eigen:“ mit dem Text der Frage. */
  id: string;
  thema: Thema | 'eigen';
  /** Offen bei den Wünschen: steht oben, mit Etikett. */
  offen: boolean;
  /** Text einer eigenen Frage; sonst null (der Wortlaut kommt aus i18n). */
  text: string | null;
}

export interface FragenListe {
  fragen: Frage[];
  /** Weggelassene Themen in der Reihenfolge der Liste, für „Nicht in der Liste, weil …“. */
  weg: Thema[];
  /** Ausgeblendete Fragen dieses Hefts (E92), für „… wieder zeigen“; `auchNeu`: auch in neuen Heften. */
  versteckt: { thema: Thema; auchNeu: boolean }[];
}

/** Eine Frage, die in neuen Heften fehlt (E92): seit wann, damit schon angelegte Hefte bleiben. */
export interface AusgeblendeteFrage {
  thema: Thema;
  seit: string;
}

export function besichtigungsFragen(o: {
  angaben: HeftAngaben | undefined;
  /** Urteile zu den Wünschen; ohne Wünsche leer. */
  urteile: Urteil[];
  /** Hat der Haushalt Haustiere? Nur dann ist die Frage dazu „offen bei euren Wünschen“. */
  mitTieren: boolean;
  /** Eigene Fragen: die des Geräts und die schon in diesem Heft gestellten. */
  eigene: string[];
  /**
   * Ausblenden (E92, Planung 12x): `hier` am Heft; `neu` vom Gerät, gilt für Hefte, die danach angelegt
   * wurden. Schon beantwortete Fragen bleiben im Heft stehen.
   */
  ausgeblendet?: {
    hier: readonly Thema[];
    neu: readonly AusgeblendeteFrage[];
    heftAngelegt: string;
  };
  /** Häkchen und Antworten dieses Hefts, für „schon beantwortet“. */
  antworten?: HeftFragen['antworten'];
}): FragenListe {
  const sicher = sicherImInserat(o.angaben);
  const offen = new Set<Thema>();
  for (const u of o.urteile) {
    const thema = AUS_KRITERIUM[u.kriterium];
    if (!thema || u.art !== 'offen') continue;
    if (thema === 'haustiere' && !o.mitTieren) continue;
    offen.add(thema);
  }
  const weg = THEMEN.filter((th) => sicher.has(th) && !offen.has(th));
  const beantwortet = (th: Thema) => {
    const a = o.antworten?.[th];
    return !!a && (a.ab || !!a.antwort.trim());
  };
  const neu = new Set((o.ausgeblendet?.neu ?? []).map((a) => a.thema));
  const hierAus = new Set([
    ...(o.ausgeblendet?.hier ?? []),
    ...(o.ausgeblendet?.neu ?? [])
      .filter((a) => o.ausgeblendet!.heftAngelegt > a.seit)
      .map((a) => a.thema),
  ]);
  const aus = new Set([...hierAus].filter((th) => !beantwortet(th) && !weg.includes(th)));
  const liste = THEMEN.filter((th) => !weg.includes(th) && !aus.has(th)).map((th): Frage => ({
    id: th,
    thema: th,
    offen: offen.has(th),
    text: null,
  }));
  const oben = liste.filter((f) => f.offen);
  const rest = liste.filter((f) => !f.offen);
  const gesehen = new Set<string>();
  const eigene: Frage[] = [];
  for (const roh of o.eigene) {
    const text = roh.trim();
    const schluessel = text.toLocaleLowerCase('de');
    if (!text || gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    eigene.push({ id: `eigen:${text}`, thema: 'eigen', offen: false, text });
  }
  const versteckt = THEMEN.filter((th) => aus.has(th)).map((th) => ({
    thema: th,
    auchNeu: neu.has(th),
  }));
  return { fragen: [...oben, ...rest, ...eigene], weg, versteckt };
}

/**
 * Die Frage nach dem Tier aus der Selbstauskunft des Haushalts (B17c: „Ist eine Katze erlaubt?“). Nur wenn
 * der Text mit „ein“, „eine“ oder einer Zahl beginnt, passt er in den Satz; sonst die allgemeine Frage.
 */
export function tierFrage(text: string | undefined): { art: 'ein' | 'mehr'; tier: string } | null {
  const t = (text ?? '').trim().replace(/[.!?]+$/, '');
  if (!t || t.length > 40) return null;
  if (/^(ein|eine|einen)\s/i.test(t)) return { art: 'ein', tier: t.replace(/^einen\s/i, 'ein ') };
  if (/^(\d+|zwei|drei|vier|fünf)\s/i.test(t)) return { art: 'mehr', tier: t };
  return null;
}

/** Häkchen und Antworten eines Hefts. */
export interface HeftFragen {
  antworten: Record<string, { ab: boolean; antwort: string }>;
  /** Eigene Fragen, die in diesem Heft gestellt wurden. */
  eigene: string[];
  /** Nur in diesem Heft ausgeblendet, oder hier und in neuen Heften (E92). */
  ausgeblendet?: Thema[];
}

export const KEINE_FRAGEN: HeftFragen = { antworten: {}, eigene: [] };
