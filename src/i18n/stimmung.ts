// W37 (E190, E193, PC94): Abwechslung in der Sprache. An zwölf Stellen stehen Stimmungssätze, die einmal am
// Tag wechseln; am selben Tag steht an einer Stelle überall derselbe Satz. Die Fassungen sind Daten
// (data/satzpools.de.json, Endfassung der Planung). Knöpfe, Hinweise, Warnungen und Fakten bleiben fest, ebenso
// die festen Teile vor oder nach einem Stimmungssatz; die stehen weiter in de.json.
import pools from '../../data/satzpools.de.json';
import { streuung } from '../domain/streuung';
import { anrede, type Anrede } from './anrede.svelte';
import { zahlwort } from './index';

export type Stelle =
  'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8' | 'P9' | 'P10a' | 'P10b' | 'P11';

type Paar = { ihr: string; du: string };
type Form = string | Paar;
type Formen = { zero?: Form; one?: Form; other?: Form };
/** Eine Fassung: entweder direkt die Formen nach Zahl (P1, P2) oder Teile wie `satz` und `titel`. */
export type Fassung = Record<string, Form | Formen | boolean>;

const STELLEN = new Map<string, Fassung[]>(
  pools.stellen.map((s) => [s.nr, s.fassungen as unknown as Fassung[]]),
);

/** Alle Fassungen einer Stelle, die erste ist die von Release 2.0. */
export function fassungen(stelle: Stelle): Fassung[] {
  const liste = STELLEN.get(stelle);
  if (!liste?.length) throw new Error(`Satzpool fehlt: ${stelle}`);
  return liste;
}

/** Der Kalendertag als fortlaufende Zahl, in der Zeit des Geräts: Um Mitternacht kommt der nächste Satz. */
export function tagNummer(tag: Date): number {
  return Math.round(Date.UTC(tag.getFullYear(), tag.getMonth(), tag.getDate()) / 86_400_000);
}

/**
 * Welche Fassung an einem Tag gilt. Samen ist das Datum, dazu die Stelle: Jeden Tag kommt die nächste Fassung
 * dran, reihum. So wechselt der Satz jeden Tag, und nach so vielen Tagen, wie es Fassungen gibt, war jede da.
 * Die Streuung je Stelle sorgt dafür, dass nicht alle Stellen am selben Tag dieselbe Nummer tragen.
 */
export function fassungNr(stelle: Stelle, tag: Date = new Date()): number {
  const n = fassungen(stelle).length;
  return (tagNummer(tag) + (streuung(stelle) % n)) % n;
}

const gross = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** Text einer Fassung: Teil, Zahl (null, eins, mehr), Anrede, dann die Zahlwörter eingesetzt. */
export function fassungText(
  f: Fassung,
  o: { teil?: string; anzahl?: number; an: Anrede },
  stelle = '',
): string {
  let e: unknown = o.teil ? f[o.teil] : f;
  if (e && typeof e === 'object' && ('one' in e || 'other' in e || 'zero' in e)) {
    const formen = e as Formen;
    const z = o.anzahl ?? 0;
    e =
      z === 0
        ? (formen.zero ?? formen.other)
        : z === 1
          ? (formen.one ?? formen.other)
          : formen.other;
  }
  if (e && typeof e === 'object' && 'ihr' in e && 'du' in e) e = (e as Paar)[o.an];
  if (typeof e !== 'string') throw new Error(`Fassung unvollständig: ${stelle} ${o.teil ?? ''}`);
  const wort = zahlwort(o.anzahl ?? 0);
  return e.replace(/\{(Wort|wort|Zahl|zahl)\}/g, (_, p: string) =>
    p === 'Wort' || p === 'Zahl' ? gross(wort) : wort,
  );
}

/**
 * Der Stimmungssatz einer Stelle für heute. `an` nur, wo die Stelle ihre Anrede selbst bestimmt (etwa die
 * Übersicht nach der Zahl im Mietvertrag); sonst gilt die Anrede der App.
 */
export function stimmung(
  stelle: Stelle,
  o: { teil?: string; anzahl?: number; an?: Anrede; tag?: Date } = {},
): string {
  const f = fassungen(stelle)[fassungNr(stelle, o.tag)]!;
  return fassungText(f, { teil: o.teil, anzahl: o.anzahl, an: o.an ?? anrede.wert }, stelle);
}
