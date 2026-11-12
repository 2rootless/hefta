// Gruß im Tab „Wohnungen“ (B12b, B15, Entscheidung E50 nach Bericht 61, Abschnitt 1.3).
// Er richtet sich nach der Uhrzeit des Geräts und nennt, wer im Mietvertrag steht, mit Rufnamen.
// Kinder und Bürgen nennt er nicht. Ab vier Namen „ihr vier“, sonst bricht er bei 320 px mit 130 % um.

const ZAHLEN = [
  '',
  'eins',
  'zwei',
  'drei',
  'vier',
  'fünf',
  'sechs',
  'sieben',
  'acht',
  'neun',
  'zehn',
];

/** 5:00 bis 10:59 Guten Morgen, 11:00 bis 17:59 Hallo, 18:00 bis 21:59 Guten Abend, sonst Hallo. */
export function grussWort(stunde: number): string {
  if (stunde >= 5 && stunde < 11) return 'Guten Morgen';
  if (stunde >= 18 && stunde < 22) return 'Guten Abend';
  return 'Hallo';
}

/** Die Namen im Gruß: „Max“, „Max und Lea“, „Max, Lea und Tom“, ab vier „ihr vier“. */
export function grussNamen(rufnamen: string[]): string {
  const namen = rufnamen.map((n) => n.trim()).filter(Boolean);
  if (namen.length >= 4) return `ihr ${ZAHLEN[namen.length] ?? namen.length}`;
  if (namen.length < 2) return namen[0] ?? '';
  return `${namen.slice(0, -1).join(', ')} und ${namen[namen.length - 1]}`;
}

/**
 * Der ganze Gruß, ohne Punkt: „Guten Abend, Max und Lea“. Ohne Haushalt (E45) oder ohne Namen nur das
 * Grußwort, ohne Komma (B15).
 */
export function gruss(jetzt: Date, rufnamen: string[]): string {
  const wort = grussWort(jetzt.getHours());
  const namen = grussNamen(rufnamen);
  return namen ? `${wort}, ${namen}` : wort;
}
