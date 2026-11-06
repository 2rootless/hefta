// Dateinamen nach docs/06-export.md: Umlaute ausgeschrieben, nur Buchstaben, Ziffern und Unterstrich,
// zwei Nachnamen mit Bindestrich. Wird in M5 für die Mappe erweitert.

const ERSATZ: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
  ß: 'ss',
  // Zerlegt NFD nicht in Buchstabe und Akzent, sie fielen sonst einfach weg („Łukasz“ → „ukasz“).
  ł: 'l',
  Ł: 'L',
  đ: 'd',
  Đ: 'D',
  ø: 'o',
  Ø: 'O',
  æ: 'ae',
  Æ: 'Ae',
  œ: 'oe',
  Œ: 'Oe',
  ı: 'i',
  ð: 'd',
  Ð: 'D',
  þ: 'th',
  Þ: 'Th',
};

/** Ein Namensteil für Dateinamen, z. B. „von Hohenstein“ → „von-Hohenstein“. */
export function namensteil(text: string): string {
  return text
    .trim()
    .replace(/[äöüÄÖÜßłŁđĐøØæÆœŒıðÐþÞ]/g, (z) => ERSATZ[z]!)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');
}

export function selbstauskunftDateiname(person: { vorname: string; nachname: string }): string {
  const teile = ['Selbstauskunft', namensteil(person.nachname), namensteil(person.vorname)];
  return `${teile.filter(Boolean).join('_')}.pdf`;
}

// Nur ganze Monatswörter und übliche Kürzel, damit „Martin“ oder „Maier“ kein Monat werden.
const MONATSNAMEN: Record<string, number> = {};
[
  'januar jan january',
  'februar feb february',
  'märz maerz mär mrz mar march',
  'april apr',
  'mai may',
  'juni jun june',
  'juli jul july',
  'august aug',
  'september sep sept',
  'oktober okt oct october',
  'november nov',
  'dezember dez dec december',
].forEach((woerter, i) => woerter.split(' ').forEach((w) => (MONATSNAMEN[w] = i + 1)));

/**
 * Abrechnungsmonat aus dem Dateinamen, als Vorschlag beim Hochladen mehrerer Gehaltsnachweise:
 * „Gehalt_2026-09.pdf“, „Abrechnung 09.2026.pdf“, „Verdienst September.pdf“. Ohne Jahr gilt der
 * letzte solche Monat bis heute. Nichts erkannt: null.
 */
export function monatAusDateiname(name: string, heute: Date = new Date()): string | null {
  const text = name.toLowerCase().replace(/\.pdf$/, '');
  const zwei = (m: number) => String(m).padStart(2, '0');
  const iso = text.match(/(?:^|\D)(20\d\d)[-_. ]?(0[1-9]|1[0-2])(?:\D|$|\d\d(?:\D|$))/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const deutsch = text.match(/(?:^|\D)(0?[1-9]|1[0-2])[-_. ](20\d\d)(?:\D|$)/);
  if (deutsch) return `${deutsch[2]}-${zwei(Number(deutsch[1]))}`;
  for (const wort of text.split(/[^a-zäöü0-9]+/)) {
    const monat = MONATSNAMEN[wort];
    if (!monat) continue;
    const rest = text.slice(text.indexOf(wort) + wort.length);
    const jahr = rest.match(/^[-_. ]*(20\d\d|\d\d)(?:\D|$)/)?.[1];
    if (jahr) return `${jahr.length === 2 ? `20${jahr}` : jahr}-${zwei(monat)}`;
    const j = monat > heute.getMonth() + 1 ? heute.getFullYear() - 1 : heute.getFullYear();
    return `${j}-${zwei(monat)}`;
  }
  return null;
}

// Zusammengeschrieben („SeptemberAugust“) nur die langen Namen: „mai“ steckt auch in „Maier“.
const LANGE_MONATE = Object.keys(MONATSNAMEN).filter((w) => w.length >= 5);

/**
 * Alle Monate im Dateinamen, in der Reihenfolge, in der sie dastehen: „Gehalt September August.pdf“,
 * „septemberaugust.pdf“. Nennt der Name so viele Monate, wie die Datei Seiten hat, gehören sie der
 * Reihe nach zu den Seiten.
 */
export function monateAusDateiname(name: string, heute: Date = new Date()): string[] {
  const text = name.toLowerCase().replace(/\.pdf$/, '');
  const jahr = text.match(/(?:^|\D)(20\d\d)(?:\D|$)/)?.[1];
  const funde = new Map<number, number>();
  for (const wort of LANGE_MONATE) {
    for (let i = text.indexOf(wort); i >= 0; i = text.indexOf(wort, i + 1)) {
      funde.set(i, MONATSNAMEN[wort]!);
    }
  }
  for (const m of text.matchAll(/[a-zäöü]+/g)) {
    const monat = MONATSNAMEN[m[0]];
    if (monat && !funde.has(m.index)) funde.set(m.index, monat);
  }
  // „september“ enthält kein weiteres Monatswort, Kürzel zählen nur als ganze Wörter: keine Doppelten.
  const reihe = [...funde].sort((a, b) => a[0] - b[0]).map(([, monat]) => monat);
  return [...new Set(reihe)].map((monat) => {
    const j =
      jahr ?? String(monat > heute.getMonth() + 1 ? heute.getFullYear() - 1 : heute.getFullYear());
    return `${j}-${String(monat).padStart(2, '0')}`;
  });
}
