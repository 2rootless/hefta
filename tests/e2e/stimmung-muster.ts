import { readFileSync } from 'node:fs';

// W37: Stimmungssätze wechseln einmal am Tag (src/i18n/stimmung.ts). Tests, die so einen Satz suchen, nehmen
// deshalb jede Fassung der Stelle an. Gelesen aus denselben Daten wie die App; die Auflösung ist hier eigen,
// weil die App-Fassung den Zustand von Svelte braucht.

type Form = string | { ihr: string; du: string };
type Fassung = Record<string, unknown>;

const pools = JSON.parse(readFileSync('data/satzpools.de.json', 'utf8')) as {
  stellen: { nr: string; fassungen: Fassung[] }[];
};
const zahlwoerter = (
  JSON.parse(readFileSync('src/i18n/de.json', 'utf8')) as { zahlwoerter: string[] }
).zahlwoerter;

const gross = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** Alle Texte einer Stelle: jede Fassung, mit `an` nur in dieser Anrede, sonst in beiden. */
export function stimmungsTexte(
  stelle: string,
  o: { teil?: string; anzahl?: number; an?: 'ihr' | 'du' } = {},
): string[] {
  const s = pools.stellen.find((x) => x.nr === stelle);
  if (!s) throw new Error(`Satzpool fehlt: ${stelle}`);
  const z = o.anzahl ?? 0;
  const wort = zahlwoerter[z] ?? String(z);
  const aus = new Set<string>();
  for (const f of s.fassungen) {
    let e = (o.teil ? f[o.teil] : f) as unknown;
    if (e && typeof e === 'object' && ('one' in e || 'other' in e)) {
      const m = e as { zero?: Form; one?: Form; other: Form };
      e = z === 0 ? (m.zero ?? m.other) : z === 1 ? (m.one ?? m.other) : m.other;
    }
    const formen =
      typeof e === 'string'
        ? [e]
        : o.an
          ? [(e as { ihr: string; du: string })[o.an]]
          : [(e as { ihr: string }).ihr, (e as { du: string }).du];
    for (const t of formen)
      aus.add(
        t.replace(/\{(Wort|wort|Zahl|zahl)\}/g, (_, p: string) =>
          /^[WZ]/.test(p) ? gross(wort) : wort,
        ),
      );
  }
  return [...aus];
}

const maskiert = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Muster für jede Fassung einer oder mehrerer Stellen; `ganz`: der ganze Text, sonst irgendwo darin. */
export function stimmungMuster(
  stellen: string | string[],
  o: { teil?: string; anzahl?: number; an?: 'ihr' | 'du'; ganz?: boolean } = {},
): RegExp {
  const texte = [stellen].flat().flatMap((s) => stimmungsTexte(s, o));
  const kern = texte.map(maskiert).join('|');
  return new RegExp(o.ganz === false ? `(?:${kern})` : `^(?:${kern})$`);
}
