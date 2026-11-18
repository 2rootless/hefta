// PC120 (§7, 4): Beim Speichern fallen Zählmarken aus dem Link eines Inserats weg. Sie sagen nur, woher man kam
// (Werbung, Trefferliste, geteilter Beitrag), nichts über das Inserat. Pfad, Anker und alle anderen Teile der
// Anfrage bleiben genau so, wie sie waren: Manche Portale bestimmen das Inserat über die Anfrage („?id=…“).

/** Namen von Zählmarken, klein geschrieben; dazu jede, die mit `utm_` beginnt. */
const ZAEHLMARKEN = new Set([
  'referrer',
  'referer',
  'enteredfrom',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'yclid',
  'twclid',
  'ttclid',
  'igshid',
  'li_fat_id',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  's_kwcid',
  'ef_id',
  'srsltid',
]);

function istZaehlmarke(name: string): boolean {
  const n = name.toLowerCase();
  return n.startsWith('utm_') || ZAEHLMARKEN.has(n);
}

/** Der Name eines Teils der Anfrage, entschlüsselt; unlesbar bleibt er, wie er ist. */
function teilName(teil: string): string {
  const roh = teil.split('=')[0] ?? '';
  try {
    return decodeURIComponent(roh.replace(/\+/g, ' '));
  } catch {
    return roh;
  }
}

/**
 * Der Link ohne Zählmarken. Die übrigen Teile behalten ihre Schreibweise und Reihenfolge; bleibt keiner übrig,
 * fällt auch das „?“ weg. Was kein Link mit `http` oder `https` ist, bleibt unverändert.
 */
export function ohneZaehlmarken(link: string): string {
  const m = /^(https?:\/\/[^?#]*)(\?[^#]*)?(#.*)?$/i.exec(link.trim());
  if (!m || !m[2]) return link.trim();
  const teile = m[2]
    .slice(1)
    .split('&')
    .filter((t) => t !== '' && !istZaehlmarke(teilName(t)));
  return `${m[1]}${teile.length ? `?${teile.join('&')}` : ''}${m[3] ?? ''}`;
}

/** Für eingespielte Backups: jedes Heft mit Link ohne Zählmarken, alles andere unverändert. */
export function linksOhneZaehlmarken(hefte: unknown[]): unknown[] {
  return hefte.map((h) => {
    const link = (h as { link?: unknown } | null)?.link;
    return typeof link === 'string' && link ? { ...(h as object), link: ohneZaehlmarken(link) } : h;
  });
}
