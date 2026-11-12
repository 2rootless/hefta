import type { HeftAngaben } from '../domain/modell';
import type { Wohnung } from '../domain/urteile';
import type { GeleseneAdresse, Gelesen } from './leser';

// Vom Gelesenen zum Heft (B23): was die Vorschau und die letzte Kontrolle zeigen und was „Heft anlegen“
// speichert. Jeder Wert bleibt ein Vorschlag, bis er bestätigt ist. Warmmiete: angegeben, sonst kalt plus
// Nebenkosten plus Heizkosten, dann aber nur „ca.“ (nie als Angabe des Vermieters).

/** Die Portale mit Namen, wie sie im Heft stehen („Gefunden auf ImmoScout24“). */
const PORTALE: Record<string, string> = {
  'immobilienscout24.de': 'ImmoScout24',
  'immowelt.de': 'Immowelt',
  'kleinanzeigen.de': 'Kleinanzeigen',
  'wg-gesucht.de': 'WG-Gesucht',
  'vonovia.de': 'Vonovia',
};

export function portalAus(url: string): string | null {
  const host = url.replace(/^https?:\/\/(www\.)?/, '').split(/[/?#]/)[0] ?? '';
  return PORTALE[host] ?? null;
}

export function warmAus(g: Gelesen): { warm: number | null; ca: boolean } {
  if (g.warm !== undefined) return { warm: g.warm, ca: !!g.warm_ca };
  if (g.kalt !== undefined && g.nk !== undefined && g.heiz !== undefined)
    return { warm: Math.round((g.kalt + g.nk + g.heiz) * 100) / 100, ca: true };
  return { warm: null, ca: false };
}

/** Die Angaben für das Heft. `titel` ist die Überschrift des Inserats, wenn Hefta sie hat. */
export function angabenAus(
  g: Gelesen,
  a: GeleseneAdresse | null,
  titel: string | null,
  url: string | null,
): HeftAngaben {
  const { warm, ca } = warmAus(g);
  const einzug = g.einzug && /^\d{4}-\d{2}-\d{2}$/.test(g.einzug) ? g.einzug : null;
  return {
    titel: titel?.trim() || null,
    stadtteil: a?.stadtteil ?? null,
    warm,
    ...(ca ? { warmCa: true } : {}),
    kalt: g.kalt ?? null,
    nebenkosten: g.nk ?? null,
    heizkosten: g.heiz ?? null,
    kaution: g.kaution ?? null,
    mietart: g.staffel ? 'staffel' : g.index ? 'index' : null,
    zimmer: g.zimmer ?? null,
    flaeche: g.flaeche ?? null,
    einzug,
    // Nur „befristet“, wenn die Seite es sagt; sonst offen: Schweigen heißt nicht „unbefristet“.
    befristung: g.befristet ? 'befristet' : null,
    portal: url ? portalAus(url) : null,
  };
}

/** Die Adresse im Format der Hefte: erste Zeile Straße, zweite Postleitzahl und Ort. */
export function adresseAus(a: GeleseneAdresse | null): string {
  return a ? `${a.strasse}\n${a.plz} ${a.ort}` : '';
}

/** Für den Abgleich mit den Wünschen (urteile.ts). */
export function wohnungAus(h: HeftAngaben): Wohnung {
  return {
    warm: h.warmCa ? null : h.warm,
    warmCa: h.warmCa ? h.warm : null,
    zimmer: h.zimmer,
    flaeche: h.flaeche,
    flaecheCa: h.flaecheCa,
    lage: null,
    einzug: h.einzug ?? null,
    tiere: h.tiere ?? null,
    befristung: h.befristung ?? null,
  };
}
