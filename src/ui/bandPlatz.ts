// Wie die Steine einer Person auf ihren Abschnitt im Band passen, ohne sich zu überlappen.
// Reicht der Platz für gleich große Abschnitte, bleibt es dabei. Sonst bekommen Punkte weniger Platz
// als Steine; wird es noch enger, sammeln sich die erledigten in einem Punkt und die letzten offenen
// in einem Stein mit „+n“.

/** Höhe, die ein Stein (24 px, mit Rand) und ein Punkt (8 px) mindestens brauchen. */
const STEIN = 27;
const PUNKT = 12;

export interface BandAbschnitt<T> {
  stein: T;
  /** Darin mitgezählt, aber nicht einzeln gezeichnet. */
  weitere: T[];
  von: number;
  bis: number;
}

export function steineVerteilen<T extends { zustand: string }>(
  steine: T[],
  hoehe: number,
): BandAbschnitt<T>[] {
  const bedarf = (s: T) => (s.zustand === 'da' ? PUNKT : STEIN);
  const summe = steine.reduce((n, s) => n + bedarf(s), 0);
  const gleich = steine.length > 0 && hoehe / steine.length >= STEIN;
  let liste: { stein: T; weitere: T[] }[] = steine.map((stein) => ({ stein, weitere: [] }));
  if (!gleich && summe > hoehe) {
    const da = steine.filter((s) => s.zustand === 'da');
    const offen = steine.filter((s) => s.zustand !== 'da');
    const erster = da[0];
    const frei = Math.max(1, Math.floor((hoehe - (erster ? PUNKT : 0)) / STEIN));
    const einzeln = offen.length <= frei ? offen : offen.slice(0, frei - 1);
    const [naechster, ...rest] = offen.slice(einzeln.length);
    liste = [
      ...(erster ? [{ stein: erster, weitere: da.slice(1) }] : []),
      ...einzeln.map((stein) => ({ stein, weitere: [] })),
      ...(naechster ? [{ stein: naechster, weitere: rest }] : []),
    ];
  }
  const gewicht = (e: { stein: T }) => (gleich ? 1 : bedarf(e.stein));
  const gesamt = liste.reduce((n, e) => n + gewicht(e), 0);
  let y = 0;
  return liste.map((e) => {
    const von = y;
    y += (gewicht(e) / gesamt) * hoehe;
    return { ...e, von, bis: y };
  });
}
