import { VERGABE } from '../domain/personenfarben';
// Version 2, mehrere Haushalte (docs/10-version-2.md, C7, C8): einen Haushalt mit allem, was zu
// ihm gehört, herauslösen (Backup je Haushalt) und zwei Bestände zusammenführen (Einspielen
// „hinzufügen“ statt „ersetzen“). Reine Funktionen auf den Datensätzen, wie im Backup-Manifest.

type Datensaetze = Record<string, unknown[]>;
type MitId = { id: string; updatedAt?: string };

const ids = (liste: unknown[] | undefined) => new Set((liste ?? []).map((x) => (x as MitId).id));

export interface Teilbestand {
  daten: Datensaetze;
  /** Dateien (Originale und aufbereitete Fassungen), die die Versionen brauchen. */
  dateien: string[];
}

/**
 * Alles zu einem Haushalt: der Haushalt, seine Zugehörigkeiten (auch herausgenommene), deren
 * Personen mit allen Unterlagen und Versionen, die Bewerbungen. Ohne Einstellungen der App.
 * Eine Person in zwei Haushalten (Bürgin) steckt in beiden Teilbeständen.
 */
export function teilbestand(daten: Datensaetze, haushaltId: string): Teilbestand {
  const zugehoerigkeiten = (daten.zugehoerigkeiten ?? []).filter(
    (z) => (z as { haushaltId: string }).haushaltId === haushaltId,
  );
  const personen = new Set(zugehoerigkeiten.map((z) => (z as { personId: string }).personId));
  const dokumente = (daten.dokumente ?? []).filter((d) =>
    personen.has((d as { personId: string }).personId),
  );
  const dokIds = ids(dokumente);
  const versionen = (daten.versionen ?? []).filter((v) =>
    dokIds.has((v as { dokumentId: string }).dokumentId),
  );
  const dateien = new Set<string>();
  for (const v of versionen as { original: string; aufbereitet: string | null }[]) {
    dateien.add(v.original);
    if (v.aufbereitet) dateien.add(v.aufbereitet);
  }
  const hefte = (daten.hefte ?? []).filter(
    (h) => (h as { haushaltId: string | null }).haushaltId === haushaltId,
  );
  // Fotos der Besichtigung (Zeile 9) gehören zum Heft und kommen mit.
  for (const h of hefte as { fotos?: string[] }[]) for (const f of h.fotos ?? []) dateien.add(f);
  return {
    daten: {
      haushalte: (daten.haushalte ?? []).filter((h) => (h as MitId).id === haushaltId),
      zugehoerigkeiten,
      personen: (daten.personen ?? []).filter((p) => personen.has((p as MitId).id)),
      dokumente,
      versionen,
      bewerbungen: (daten.bewerbungen ?? []).filter(
        (b) => (b as { haushaltId: string }).haushaltId === haushaltId,
      ),
      hefte,
    },
    dateien: [...dateien],
  };
}

export interface Zusammengefuehrt {
  daten: Datensaetze;
  /** Datensätze aus dem neuen Bestand, die es noch nicht gab. */
  neu: number;
  /** Gleiche ID in beiden, der neuere Stand hat gewonnen (z. B. eine Person in zwei Haushalten). */
  aktualisiert: string[];
}

/**
 * Führt `neu` in `bestehend` zusammen: nichts Bestehendes geht verloren. Gibt es einen Datensatz
 * in beiden, bleibt der zuletzt geänderte. Die Einstellungen der App bleiben die bestehenden.
 */
export function zusammenfuehren(bestehend: Datensaetze, neu: Datensaetze): Zusammengefuehrt {
  const daten: Datensaetze = {};
  let anzahlNeu = 0;
  const aktualisiert: string[] = [];
  for (const ort of new Set([...Object.keys(bestehend), ...Object.keys(neu)])) {
    const liste = new Map<string, unknown>();
    for (const x of bestehend[ort] ?? []) liste.set((x as MitId).id, x);
    if (ort !== 'einstellungen')
      for (const x of neu[ort] ?? []) {
        const { id, updatedAt = '' } = x as MitId;
        const alt = liste.get(id) as MitId | undefined;
        if (!alt) {
          liste.set(id, x);
          anzahlNeu++;
        } else if (updatedAt > (alt.updatedAt ?? '')) {
          liste.set(id, x);
          aktualisiert.push(id);
        }
      }
    daten[ort] = [...liste.values()];
  }
  return { daten: sammelplaetzeVereinen(daten), neu: anzahlNeu, aktualisiert };
}

/**
 * PC214 (Weg A): Höchstens ein Sammelplatz für Personen ohne Haushalt. Bringt ein Backup „hinzufügen“ einen zweiten,
 * kommen seine Plätze auf den älteren, hinten angereiht; eine doppelte Farbe bekommt die nächste freie. Der zweite
 * entfällt. Nichts sonst ändert sich.
 */
export function sammelplaetzeVereinen(daten: Datensaetze): Datensaetze {
  type H = { id: string; createdAt: string; ohneHaushalt?: boolean };
  type Z = { id: string; haushaltId: string; farbe: number; reihenfolge: number };
  const sammel = ((daten.haushalte ?? []) as H[])
    .filter((h) => h.ohneHaushalt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (sammel.length < 2) return daten;
  const [erster, ...andere] = sammel as [H, ...H[]];
  const weg = new Set(andere.map((h) => h.id));
  const zugs = (daten.zugehoerigkeiten ?? []) as Z[];
  const belegt = new Set(zugs.filter((z) => z.haushaltId === erster.id).map((z) => z.farbe));
  let reihe = zugs
    .filter((z) => z.haushaltId === erster.id)
    .reduce((max, z) => Math.max(max, z.reihenfolge + 1), 0);
  const neu = zugs.map((z) => {
    if (!weg.has(z.haushaltId)) return z;
    let farbe = z.farbe;
    if (belegt.has(farbe)) farbe = VERGABE.find((f) => !belegt.has(f)) ?? farbe;
    belegt.add(farbe);
    return { ...z, haushaltId: erster.id, farbe, reihenfolge: reihe++ };
  });
  return {
    ...daten,
    haushalte: ((daten.haushalte ?? []) as H[]).filter((h) => !weg.has(h.id)),
    zugehoerigkeiten: neu,
  };
}
