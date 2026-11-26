import type { Fach } from '../domain/faecher';
import {
  jetzt,
  neueId,
  type Haushalt,
  type Id,
  type Rolle,
  type Zugehoerigkeit,
} from '../domain/modell';
import { ansprechperson } from '../domain/nachruecken';
import { farbeImHaushalt } from '../domain/zugehoerigkeiten';
import type { HeftaDb } from './db';
import { haushaltLaden, personAus, type HaushaltAnsicht, type PersonEntwurf } from './speicher';

// PC213/PC214 (E385, Weg A): Personen ohne Haushalt stehen auf einem verborgenen Sammelplatz, einem Haushalt-Datensatz
// mit `ohneHaushalt`. So laufen Liste, Seite, Prüfung und PDF der App unverändert, denn sie bekommen eine Person mit
// Platz und Farbe. Der Sammelplatz ist nie aktiv, und leer gibt es ihn nicht sichtbar. „Übernehmen“ verschiebt die
// Plätze in einen neuen oder bestehenden Haushalt; Farbe und Angaben bleiben, nichts liegt danach doppelt.

/** Der Sammelplatz, wenn es ihn gibt (der älteste, falls ein Einspielen zwei hinterließ). */
export async function sammelplatz(db: HeftaDb): Promise<Haushalt | null> {
  const alle = (await db.getAll('haushalte')).filter((h) => h.ohneHaushalt);
  return alle.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null;
}

/** Die Personen ohne Haushalt als Ansicht wie ein Haushalt; null, wenn niemand darauf steht. */
export async function ohneHaushaltLaden(db: HeftaDb): Promise<HaushaltAnsicht | null> {
  const s = await sammelplatz(db);
  if (!s) return null;
  const a = await haushaltLaden(db, s.id, { sammelplatz: true });
  return a && a.mitglieder.length ? a : null;
}

/** Legt eine Person ohne Haushalt an, mit Farbe nach der Reihe der App (B5); den Sammelplatz bei Bedarf dazu. */
export async function ohneHaushaltAnlegen(
  db: HeftaDb,
  p: Omit<PersonEntwurf, 'bezeichnung' | 'lebenssituation'> &
    Partial<Pick<PersonEntwurf, 'lebenssituation'>> & { rolle: Rolle },
): Promise<Id> {
  const zeit = jetzt();
  const tx = db.transaction(['haushalte', 'personen', 'zugehoerigkeiten'], 'readwrite');
  let sammel = (await tx.objectStore('haushalte').getAll())
    .filter((h) => h.ohneHaushalt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (!sammel) {
    sammel = {
      id: neueId(),
      createdAt: zeit,
      updatedAt: zeit,
      name: '',
      notiz: '',
      kinder: 0,
      weitereErwachsene: 0,
      ohneHaushalt: true,
    };
    await tx.objectStore('haushalte').put(sammel);
  }
  const alle = await tx.objectStore('zugehoerigkeiten').getAll();
  const hier = alle.filter((z) => z.haushaltId === sammel.id);
  const person = personAus(
    { ...p, bezeichnung: 'neutral', lebenssituation: p.lebenssituation ?? null },
    zeit,
  );
  await tx.objectStore('personen').put(person);
  await tx.objectStore('zugehoerigkeiten').put({
    id: neueId(),
    createdAt: zeit,
    updatedAt: zeit,
    haushaltId: sammel.id,
    personId: person.id,
    rolle: p.rolle,
    bezeichnung: 'neutral',
    farbe: farbeImHaushalt(person.id, sammel.id, alle),
    reihenfolge: hier.reduce((max, z) => Math.max(max, z.reihenfolge + 1), 0),
    herausgenommenAm: null,
  });
  await tx.done;
  return person.id;
}

/** Ein Haushalt zur Wahl beim Übernehmen (DP148): seine Namen und die Personen, für „dieselbe Person?“. */
export interface HaushaltZurWahl {
  id: Id;
  /** Rufnamen, wie sie im Haushalt stehen: im Vertrag, dann wer bürgt. */
  namen: string[];
  personen: { id: Id; vorname: string; nachname: string; rufname: string }[];
  haushalt: Haushalt;
}

/** Alle Haushalte, ohne den Sammelplatz, in der Reihenfolge ihres Entstehens. */
export async function haushalteZurWahl(db: HeftaDb): Promise<HaushaltZurWahl[]> {
  const liste = (await db.getAll('haushalte'))
    .filter((h) => !h.ohneHaushalt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ergebnis: HaushaltZurWahl[] = [];
  for (const h of liste) {
    const a = await haushaltLaden(db, h.id);
    if (!a) continue;
    const alle = [...a.mitglieder, ...a.herausgenommen].map((m) => m.person);
    ergebnis.push({
      id: h.id,
      namen: a.mitglieder.map((m) => m.person.rufname || m.person.vorname),
      personen: alle.map((p) => ({
        id: p.id,
        vorname: p.vorname,
        nachname: p.nachname,
        rufname: p.rufname || p.vorname,
      })),
      haushalt: a.haushalt,
    });
  }
  return ergebnis;
}

/** Gleicher Name (Vor- und Nachname, ohne Groß und Klein, ohne Leerzeichen am Rand): die Person im Haushalt. */
export function gleicherName(
  p: { vorname: string; nachname: string },
  personen: readonly { id: Id; vorname: string; nachname: string }[],
): Id | null {
  const k = (x: { vorname: string; nachname: string }) =>
    `${x.vorname.trim().toLocaleLowerCase('de')} ${x.nachname.trim().toLocaleLowerCase('de')}`;
  return personen.find((x) => k(x) === k(p))?.id ?? null;
}

/** Je Person ohne Haushalt: das Fach im Ziel (W54) und, falls es sie dort schon gibt, die bestehende Person. */
export interface Wahl {
  fach: Exclude<Fach, 'weg'>;
  /** „Ja, Angaben übernehmen“: Die Angaben gehen an diese Person im Ziel, die Person ohne Haushalt entfällt. */
  dieselbe?: Id;
}

export type Ziel = { art: 'neu' } | { art: 'bestehend'; haushaltId: Id };

export interface Uebernommen {
  haushaltId: Id;
  /** Die neue Ansprechperson, wenn sie aus dem Sammelplatz kommt (E366); sonst null. */
  ansprech: Id | null;
}

/** Was im bestehenden Haushalt schon beantwortet ist und darum bleibt (E-Vorrang, CP129). */
export function vorrang(ziel: Haushalt, sammel: Haushalt): ('haustiere' | 'ort' | 'wbs')[] {
  const f: ('haustiere' | 'ort' | 'wbs')[] = [];
  const da = (x: unknown) => x !== undefined && x !== null && x !== '';
  if (da(sammel.haustiere) && da(ziel.haustiere) && sammel.haustiere !== ziel.haustiere)
    f.push('haustiere');
  if (da(sammel.ort?.trim()) && da(ziel.ort?.trim()) && sammel.ort!.trim() !== ziel.ort!.trim())
    f.push('ort');
  if (da(sammel.wbsAngabe) && da(ziel.wbsAngabe) && sammel.wbsAngabe !== ziel.wbsAngabe)
    f.push('wbs');
  return f;
}

/**
 * Übernimmt alle Personen ohne Haushalt (E-Auswahl) in einen neuen oder bestehenden Haushalt, in einer Transaktion.
 * Gibt es keinen Sammelplatz (schon übernommen), geschieht nichts und es kommt null zurück.
 */
export async function ohneHaushaltUebernehmen(
  db: HeftaDb,
  ziel: Ziel,
  wahl: Record<Id, Wahl>,
): Promise<Uebernommen | null> {
  const zeit = jetzt();
  const tx = db.transaction(['haushalte', 'personen', 'zugehoerigkeiten'], 'readwrite');
  const haushalte = tx.objectStore('haushalte');
  const orte = tx.objectStore('zugehoerigkeiten');
  const sammel = (await haushalte.getAll())
    .filter((h) => h.ohneHaushalt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (!sammel) {
    await tx.done;
    return null;
  }
  const lose = (await orte.index('haushaltId').getAll(sammel.id)).sort(
    (a, b) => a.reihenfolge - b.reihenfolge,
  );
  const nurmit = lose.filter(
    (z) => wahl[z.personId]?.fach === 'nurmit' && !wahl[z.personId]?.dieselbe,
  ).length;
  let haushalt: Haushalt;
  if (ziel.art === 'neu') {
    haushalt = {
      id: neueId(),
      createdAt: zeit,
      updatedAt: zeit,
      name: '',
      notiz: '',
      kinder: sammel.kinder,
      weitereErwachsene: sammel.weitereErwachsene,
      ...(sammel.haustiere ? { haustiere: sammel.haustiere } : {}),
      ...(sammel.haustiereText ? { haustiereText: sammel.haustiereText } : {}),
      ...(sammel.ort ? { ort: sammel.ort } : {}),
      ...(sammel.wbsAngabe ? { wbsAngabe: sammel.wbsAngabe } : {}),
    };
  } else {
    const h = await haushalte.get(ziel.haushaltId);
    if (!h || h.ohneHaushalt) throw new Error('Haushalt nicht gefunden');
    // E-Vorrang: Was der Haushalt schon beantwortet hat, bleibt; Fehlendes kommt vom Sammelplatz.
    haushalt = {
      ...h,
      ...(!h.haustiere && sammel.haustiere
        ? { haustiere: sammel.haustiere, haustiereText: sammel.haustiereText ?? '' }
        : {}),
      ...(!h.ort?.trim() && sammel.ort?.trim() ? { ort: sammel.ort } : {}),
      ...(!h.wbsAngabe && sammel.wbsAngabe ? { wbsAngabe: sammel.wbsAngabe } : {}),
    };
  }
  // „Zieht mit ein“ zählt wie in den Fächern als weiterer Erwachsener (faecherSpeichern).
  haushalt.weitereErwachsene += nurmit;
  const alle = await orte.getAll();
  const vorherHier = alle.filter((z) => z.haushaltId === haushalt.id);
  let reihe = vorherHier.reduce((max, z) => Math.max(max, z.reihenfolge + 1), 0);
  const bisherAnsprech = ziel.art === 'bestehend' ? ansprechperson(haushalt, vorherHier) : null;
  let erste: Id | null = null;
  for (const z of lose) {
    const w = wahl[z.personId] ?? { fach: 'vertrag' as const };
    if (w.dieselbe) {
      // „Ja, Angaben übernehmen“: Name und Platz der bestehenden Person bleiben, ihre Angaben kommen von hier.
      const lo = await tx.objectStore('personen').get(z.personId);
      const be = await tx.objectStore('personen').get(w.dieselbe);
      if (lo && be) {
        // Name, Kennung und Anlagezeit bleiben die der bestehenden Person.
        await tx.objectStore('personen').put({
          ...be,
          ...lo,
          id: be.id,
          createdAt: be.createdAt,
          vorname: be.vorname,
          nachname: be.nachname,
          rufname: be.rufname,
          nameMappe: be.nameMappe ?? null,
          updatedAt: zeit,
        });
        await tx.objectStore('personen').delete(lo.id);
      }
      await orte.delete(z.id);
      continue;
    }
    const belegt = alle.some(
      (x) => x.haushaltId === haushalt.id && !x.herausgenommenAm && x.farbe === z.farbe,
    );
    const neu: Zugehoerigkeit = {
      ...z,
      haushaltId: haushalt.id,
      rolle: w.fach === 'buerge' ? 'buerge' : 'vertrag',
      herausgenommenAm: w.fach === 'nurmit' ? zeit : null,
      ziehtMitEin: w.fach === 'nurmit',
      farbe: belegt ? farbeImHaushalt(z.personId, haushalt.id, alle) : z.farbe,
      reihenfolge: reihe++,
      updatedAt: zeit,
    };
    alle.splice(
      alle.findIndex((x) => x.id === z.id),
      1,
      neu,
    );
    await orte.put(neu);
    if (w.fach === 'vertrag' && !erste) erste = z.personId;
  }
  // E366: Die erste im Vertrag wird Ansprechperson nur, wenn der Haushalt noch keine hat.
  const ansprech = bisherAnsprech ? null : erste;
  await haushalte.put({
    ...haushalt,
    ansprechpersonId: bisherAnsprech ?? erste ?? haushalt.ansprechpersonId ?? null,
    updatedAt: zeit,
  });
  await haushalte.delete(sammel.id);
  await tx.done;
  return { haushaltId: haushalt.id, ansprech };
}
