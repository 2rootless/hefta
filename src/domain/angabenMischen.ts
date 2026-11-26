import type { Person } from './modell';

// DP150 C1, PC215 (E385): „Ja, Angaben übernehmen“ führt eine Person ohne Haushalt mit der gleichnamigen im Haushalt
// zusammen. Regel: Leeres ersetzt nie etwas. Sind beide Seiten ausgefüllt und verschieden, gilt das von der Person
// ohne Haushalt; der Kasten nennt diese Angaben vorher („Bei Jarne ändert sich: Telefon und Beruf.“). Name, Kennung
// und Anlagezeit bleiben die der Person im Haushalt. Läuft ohne Browser-APIs.

/** Angaben, die der Kasten beim Namen nennt, in dieser Reihenfolge. */
export const ANGABE_NAMEN = [
  'Telefon',
  'E-Mail',
  'Anschrift',
  'Lebenslage',
  'Beruf',
  'Arbeitgeber',
  'Netto',
  'Antworten im Musterbogen',
  'Bürgschaft',
] as const;
export type AngabeName = (typeof ANGABE_NAMEN)[number];

/** Gilt ein Wert als ausgefüllt? Leere Texte, null, leere Listen, `false` und Objekte ohne ausgefüllten Wert nicht. */
export function ausgefuellt(v: unknown): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v as object).some(ausgefuellt);
  return true;
}

/** Gleich, wenn sich nur Leeres unterscheidet (null, undefined, leere Liste, `false`). */
const rein = (v: unknown): unknown =>
  Array.isArray(v) && v.every((x) => !Array.isArray(x))
    ? v.length
      ? v
      : null
    : ausgefuellt(v)
      ? v
      : null;
const gleich = (a: unknown, b: unknown) =>
  JSON.stringify(Array.isArray(a) ? a.map(rein) : rein(a)) ===
  JSON.stringify(Array.isArray(b) ? b.map(rein) : rein(b));

/** Felder der Person, die zusammen eine Angabe bilden (eine Nummer mit Land, eine Anschrift als Zeile und Teile). */
const GRUPPEN: { name: AngabeName; felder: (keyof Person)[] }[] = [
  {
    name: 'Lebenslage',
    felder: ['lebenssituation', 'ausbildungArt', 'weitereLagen', 'einkommenTrotzdem'],
  },
  { name: 'Beruf', felder: ['beruf'] },
  { name: 'Arbeitgeber', felder: ['arbeitgeber'] },
  { name: 'Netto', felder: ['nettoeinkommen', 'abrechnungMeist'] },
  { name: 'Bürgschaft', felder: ['buergschaftOhneHeft'] },
];
const KONTAKT: { name: AngabeName; felder: (keyof Person['kontakt'])[] }[] = [
  { name: 'Telefon', felder: ['telefon', 'telefonLand', 'telefonE164'] },
  { name: 'E-Mail', felder: ['email'] },
  { name: 'Anschrift', felder: ['anschrift', 'anschriftTeile'] },
];
const BLEIBT = new Set<string>([
  'id',
  'createdAt',
  'updatedAt',
  'vorname',
  'nachname',
  'rufname',
  'nameMappe',
  'ohneNachname',
  'kontakt',
  'selbstauskunft',
]);

/**
 * Mischt die Angaben von `hier` (ohne Haushalt) in `dort` (im Haushalt). Gibt die gemischte Person und die Namen der
 * Angaben zurück, die sich ändern, weil beide Seiten ausgefüllt und verschieden sind.
 */
export function angabenMischen(
  dort: Person,
  hier: Person,
): { person: Person; aendert: AngabeName[] } {
  const aendert = new Set<AngabeName>();
  const person: Person = { ...dort, kontakt: { ...dort.kontakt } };
  const ziel = person as unknown as Record<string, unknown>;
  const quelle = hier as unknown as Record<string, unknown>;
  const alt = dort as unknown as Record<string, unknown>;

  // Gruppen: Ist hier etwas ausgefüllt, kommt die ganze Gruppe von hier (Nummer mit Land, Lage mit ihren Teilen).
  for (const g of GRUPPEN) {
    const neu = g.felder.map((f) => quelle[f]);
    if (!neu.some(ausgefuellt)) continue;
    const vorher = g.felder.map((f) => alt[f]);
    if (vorher.some(ausgefuellt) && !gleich(neu, vorher)) aendert.add(g.name);
    for (const f of g.felder) ziel[f] = quelle[f];
  }
  for (const g of KONTAKT) {
    const neu = g.felder.map((f) => hier.kontakt?.[f]);
    if (!neu.some(ausgefuellt)) continue;
    const vorher = g.felder.map((f) => dort.kontakt?.[f]);
    if (vorher.some(ausgefuellt) && !gleich(neu, vorher)) aendert.add(g.name);
    for (const f of g.felder) (person.kontakt as Record<string, unknown>)[f] = hier.kontakt?.[f];
  }
  // Selbstauskunft: je Antwort einzeln; nur Ausgefülltes geht hinüber.
  if (hier.selbstauskunft) {
    const sa = { ...(dort.selbstauskunft ?? {}) } as Record<string, unknown>;
    for (const [k, v] of Object.entries(hier.selbstauskunft)) {
      if (!ausgefuellt(v)) continue;
      if (ausgefuellt(sa[k]) && !gleich(sa[k], v)) aendert.add('Antworten im Musterbogen');
      sa[k] = v;
    }
    person.selbstauskunft = sa as unknown as Person['selbstauskunft'];
  }
  // Alles Übrige, das es später geben mag: auch nur, was ausgefüllt ist, ohne eigenen Namen im Kasten.
  const bekannt = new Set<string>([...GRUPPEN.flatMap((g) => g.felder as string[]), ...BLEIBT]);
  for (const [k, v] of Object.entries(quelle)) if (!bekannt.has(k) && ausgefuellt(v)) ziel[k] = v;

  return { person, aendert: ANGABE_NAMEN.filter((n) => aendert.has(n)) };
}
