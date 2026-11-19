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

/**
 * PC126 K6 (DP82 I1): jeder Link in einem Text ohne Zählmarken, etwa im geteilten Text eines Inserats. Der übrige
 * Text bleibt Zeichen für Zeichen, wie er ist.
 */
export function textOhneZaehlmarken(text: string): string {
  return text.replace(/https?:\/\/[^\s<>"']+/gi, (link) => ohneZaehlmarken(link));
}

/** Für eingespielte Backups: jedes Heft mit Link und Text des Inserats ohne Zählmarken, alles andere unverändert. */
export function linksOhneZaehlmarken(hefte: unknown[]): unknown[] {
  return hefte.map((h) => {
    const heft = h as { link?: unknown; inseratText?: unknown } | null;
    if (!heft || typeof heft !== 'object') return h;
    const aus: Record<string, unknown> = { ...heft };
    if (typeof heft.link === 'string' && heft.link) aus.link = ohneZaehlmarken(heft.link);
    if (typeof heft.inseratText === 'string' && heft.inseratText)
      aus.inseratText = textOhneZaehlmarken(heft.inseratText);
    return aus;
  });
}
