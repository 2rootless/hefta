// Formblatt (DP135, Abschnitt 3; PC205, Abschnitt 3; PC208, Schritt 1): der gemeinsame Baustein der Formulare. Ein
// Formular ist eine Liste von Feldern, jedes mit seinem Teil, seiner Art, ob es nötig ist und wann es als ausgefüllt
// gilt. Aus derselben Liste entstehen die Teile in der App (Stand, „Weiter“), im Browser der Bogen (E111) und der
// Satz „Es fehlt noch: …“. So bleiben Selbstauskunft, Bürgschaft (W63) und spätere Formulare von selbst gleich.
// Die Liste sagt nur, was gefragt wird und was fehlt; welche Felder es gibt, steht für die Selbstauskunft weiter im
// Regelkatalog (Regelkatalog ist Daten).

/** Die Bausteine eines Bogens (DP135, Abschnitt 3). */
export type FeldArt =
  | 'text'
  | 'name'
  | 'anschrift'
  | 'telefon'
  | 'email'
  | 'betrag'
  | 'datum'
  | 'janein'
  | 'wahl'
  | 'unterschrift';

export interface FormFeld<W> {
  id: string;
  /** Teil in der App, Abschnitt im Bogen. */
  teil: string;
  art: FeldArt;
  /** Wird dieses Feld bei diesen Werten überhaupt gefragt? Ohne Angabe: immer. */
  gefragt?: (w: W) => boolean;
  /** Nötig fürs Formular; sonst freiwillig. Freiwillige Felder fehlen nie. */
  noetig: boolean | ((w: W) => boolean);
  /** Gilt als ausgefüllt. */
  gefuellt: (w: W) => boolean;
  /**
   * Ein Zusatz wie „Lage (freiwillig)“: Er zählt nicht dafür, ob ein Teil ganz ausgefüllt ist (`voll`). Ohne Angabe
   * zählt das Feld mit.
   */
  zusatz?: boolean;
}

export interface Formular<W> {
  id: string;
  /** Die Teile in ihrer Reihenfolge. */
  teile: readonly string[];
  felder: readonly FormFeld<W>[];
}

export interface TeilStand {
  id: string;
  fertig: boolean;
  /** Wie viele nötige Felder in diesem Teil noch fehlen. */
  offen: number;
  /**
   * Alle gefragten Felder des Teils ausgefüllt, auch die freiwilligen (ohne Zusätze). Bei der Bürgschaft (W63) zeigt
   * erst das den Haken: Leere Felder sind dort kein Fehler, sie bleiben auf dem Blatt frei für die Hand.
   */
  voll: boolean;
}

export function gefragteFelder<W>(form: Formular<W>, w: W): FormFeld<W>[] {
  return form.felder.filter((f) => !f.gefragt || f.gefragt(w));
}

export function istNoetig<W>(f: FormFeld<W>, w: W): boolean {
  return typeof f.noetig === 'function' ? f.noetig(w) : f.noetig;
}

/** Was noch fehlt, in der Reihenfolge der Liste. Dasselbe Feld kann unter mehreren Bedingungen stehen; es zählt einmal. */
export function fehlendeFelder<W>(form: Formular<W>, w: W): FormFeld<W>[] {
  const gesehen = new Set<string>();
  return gefragteFelder(form, w).filter((f) => {
    if (gesehen.has(f.id) || !istNoetig(f, w) || f.gefuellt(w)) return false;
    gesehen.add(f.id);
    return true;
  });
}

/** Stand je Teil. Ein Teil ohne gefragtes Feld entfällt (etwa „Haushalt“ bei einer Person, die bürgt). */
export function teilStand<W>(form: Formular<W>, w: W): TeilStand[] {
  const gefragt = gefragteFelder(form, w);
  const fehlt = fehlendeFelder(form, w);
  return form.teile
    .filter((teil) => gefragt.some((f) => f.teil === teil))
    .map((teil) => {
      const offen = fehlt.filter((f) => f.teil === teil).length;
      const voll = gefragt.every((f) => f.teil !== teil || f.zusatz || f.gefuellt(w));
      return { id: teil, fertig: offen === 0, offen, voll };
    });
}

export function formularFertig<W>(form: Formular<W>, w: W): boolean {
  return fehlendeFelder(form, w).length === 0;
}

/** „Höchstbetrag“, „Name und Anschrift“, „Name, Anschrift und Art“: die Namen für „Es fehlt noch: …“. */
export function aufzaehlung(namen: string[]): string {
  if (namen.length <= 1) return namen[0] ?? '';
  return `${namen.slice(0, -1).join(', ')} und ${namen.at(-1)}`;
}
