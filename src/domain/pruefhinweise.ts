import { dateiSchluessel, dieselbeDatei } from './aufteilen';
import { aktuelleVersionen, datumAus, tageZwischen } from './fristen';
import type { DateiVersion, SeitenFakten, Tag } from './modell';
import type { Dokumenttyp, PersonStand, UnterlagenStand } from './regelkatalog';
import { eigeneSeiten, kommtInMappe } from './seitenVersion';

// Prüfhinweise (design/nachtraeglich-ordnen.md, Abschnitt 6): Hefta fragt nach, wenn etwas vermutlich
// falsch einsortiert ist. Nur bei klarem Befund, je Unterlage höchstens einer, sperrt nie etwas.
// Reine Rechnung auf dem, was beim Lesen der Datei gemerkt wurde (src/pdf/fakten.ts).

/** Ändert sich, was gelesen wird: Dann liest Hefta vorhandene Dateien einmal neu. */
export const FAKTEN_STAND = 1;

export type PruefArt =
  | 'datei'
  | 'seite'
  | 'monat'
  | 'monatDoppelt'
  | 'name'
  | 'nameFehlt'
  | 'seiteFehlt'
  | 'leer'
  | 'art'
  | 'datum';

// Reihenfolge: der wichtigste zuerst.
const RANG: PruefArt[] = [
  'datei',
  'seite',
  'monat',
  'monatDoppelt',
  'name',
  'nameFehlt',
  'seiteFehlt',
  'leer',
  'art',
  'datum',
];

export interface Pruefhinweis {
  /** Bei `nameFehlt`: der Nachname, der nicht auf dem Dokument steht. */
  nachname?: string;
  art: PruefArt;
  personId: string;
  typ: Dokumenttyp;
  version: DateiVersion;
  /** Dieselbe Datei in mehreren Monaten: alle betroffenen Versionen. */
  gruppe?: DateiVersion[];
  /** Dieselbe Datei oder Seite an anderer Stelle. */
  anderswo?: { name: string; typ: Dokumenttyp };
  /** Monat auf der Seite. */
  monat?: string;
  /** Name einer anderen Person. */
  person?: { id: string; rufname: string; voll: string };
  /** Seite in der Datei. */
  seite?: number;
  /** „Seite 1 von 2“. */
  von?: [number, number];
  /** Falsche Unterlage: was auf dem Dokument steht und was das heißt. */
  anzeige?: string;
  hinweis?: string;
  /** Datum in der Zukunft oder vor 2000. */
  datum?: 'zukunft' | 'alt';
}

/** Wörter vergleichbar machen: klein, ohne Akzente, „ü“ wie „ue“. */
export function wortForm(wort: string): string {
  return wort
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Wörter eines Texts, ohne Zahlen und Doppelte. */
export function woerterAus(text: string): string[] {
  const liste = text.match(/\p{L}[\p{L}'’]+/gu) ?? [];
  return [...new Set(liste.map(wortForm))];
}

/** Steht auf dieser Fassung erkennbar ein Prüfcode? Bei Scans und anderen Anbietern nicht. */
export function hatPruefcode(
  typ: Pick<Dokumenttyp, 'erkennen'>,
  version: Pick<DateiVersion, 'erkannteWerte'> | undefined,
): boolean {
  const woerter = typ.erkennen?.pruefcode;
  if (!woerter) return false;
  const seiten = version?.erkannteWerte?.seiten ?? [];
  return seiten.some((s) => woerter.some((w) => s.woerter.includes(wortForm(w))));
}

/**
 * Prüfcode statt Panik (design/zeit-und-dateien.md): Die 60 Tage sind die Laufzeit des Prüfcodes, keine
 * Gültigkeit. Ab Tag 55 sagt Hefta, wann er abläuft, ab Tag 61, dass er abgelaufen ist. Das ist eine
 * Information, keine Aufgabe. Ohne das Wort im Text (Scan, anderer Anbieter) gibt es keinen Prüfcode.
 */
export function pruefcodeStand(
  u: {
    typ: Pick<Dokumenttyp, 'fristen' | 'erkennen'>;
    versionen: DateiVersion[];
    neuestesDatum?: Tag | null;
    veraltet?: boolean;
  },
  heute: Date = new Date(),
): { art: 'laeuft'; am: Date } | { art: 'abgelaufen' } | null {
  const { hinweisTage, pruefcodeTage } = u.typ.fristen ?? {};
  if (!u.neuestesDatum || u.veraltet || !hinweisTage || !pruefcodeTage) return null;
  if (!hatPruefcode(u.typ, aktuelleVersionen(u.versionen)[0])) return null;
  const start = datumAus(u.neuestesDatum);
  const alter = tageZwischen(start, heute);
  if (alter > pruefcodeTage) return { art: 'abgelaufen' };
  if (alter < hinweisTage) return null;
  return {
    art: 'laeuft',
    am: new Date(start.getFullYear(), start.getMonth(), start.getDate() + pruefcodeTage),
  };
}

const namensWoerter = (text: string) => woerterAus(text.replace(/-/g, ' '));

function hatNamen(woerter: Set<string>, vorname: string, nachname: string): boolean {
  const teile = [...namensWoerter(vorname), ...namensWoerter(nachname)];
  return teile.length > 0 && teile.every((t) => woerter.has(t));
}

/** Die Seiten der Version mit dem, was auf ihnen steht. */
function eigeneMitFakten(v: DateiVersion, alle: DateiVersion[]) {
  const seiten = v.erkannteWerte?.seiten ?? [];
  return eigeneSeiten(v, seiten.length, alle).flatMap((seite) => {
    const fakten: SeitenFakten | undefined = seiten[seite];
    return fakten ? [{ seite, fakten }] : [];
  });
}

const bestaetigt = (v: DateiVersion, art: PruefArt) => !!v.vomNutzerBestaetigt?.includes(art);

interface Umfeld {
  personId: string;
  typ: Dokumenttyp;
  /** Eigene Namen, um Dokumente mit beiden Namen nicht zu melden. */
  eigen: { vorname: string; nachname: string }[];
  andere: { id: string; rufname: string; vorname: string; nachname: string }[];
}

/** Prüfungen, für die eine Version allein reicht; auch beim Hochladen, bevor sie gespeichert ist. */
export function versionPruefen(
  v: DateiVersion,
  umfeld: Umfeld,
  alle: DateiVersion[],
  heute: Date = new Date(),
  beimHochladen = false,
): Pruefhinweis[] {
  const { personId, typ } = umfeld;
  const funde: Pruefhinweis[] = [];
  const basis = { personId, typ, version: v };
  const seiten = eigeneMitFakten(v, alle);
  const woerter = new Set(seiten.flatMap((s) => s.fakten.woerter));

  // PH-e: voller Name einer anderen Person steht da, der eigene nicht.
  if (woerter.size && !umfeld.eigen.some((n) => hatNamen(woerter, n.vorname, n.nachname))) {
    const andere = umfeld.andere.find(
      (p) => p.nachname.trim() && hatNamen(woerter, p.vorname, p.nachname),
    );
    if (andere)
      funde.push({
        ...basis,
        art: 'name',
        person: {
          id: andere.id,
          rufname: andere.rufname,
          voll: `${andere.vorname} ${andere.nachname}`.trim(),
        },
      });
  }

  // PH-f: „Seite 1 von 2“, aber weniger Seiten da.
  const von = seiten.find((s) => s.fakten.von)?.fakten.von;
  const gesamt = Math.max(0, ...seiten.map((s) => s.fakten.von?.[1] ?? 0));
  if (von && seiten.length < gesamt) funde.push({ ...basis, art: 'seiteFehlt', von });

  // PH-g: leere Seite. Die letzte in der Mappe bleibt, die lässt sich nicht herausnehmen.
  const drin = seiten.filter((s) => kommtInMappe(v, s.seite));
  const leer = drin.find((s) => s.fakten.leer);
  if (leer && drin.length > 1) funde.push({ ...basis, art: 'leer', seite: leer.seite });

  // PH-h: falsche Art, nach den Wörtern im Regelkatalog. Ein Wort allein ist ein schwaches Zeichen:
  // Eine echte Auskunft kann die Datenkopie im Kleingedruckten erwähnen.
  const passt = typ.erkennen?.passt?.some((w) => woerter.has(wortForm(w)));
  const treffer = passt
    ? undefined
    : typ.erkennen?.passtNicht.find((p) => p.woerter.some((w) => woerter.has(wortForm(w))));
  if (treffer)
    funde.push({ ...basis, art: 'art', anzeige: treffer.anzeige, hinweis: treffer.hinweis });

  // PH-i: Datum unplausibel.
  const tag: Tag | null = v.ausstellungsdatum;
  const heuteTag = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`;
  if (tag && tag > heuteTag) funde.push({ ...basis, art: 'datum', datum: 'zukunft' });
  else if (tag && tag < '2000-01-01') funde.push({ ...basis, art: 'datum', datum: 'alt' });

  // Der eigene Nachname steht nirgends, und niemand aus dem Haushalt passt: vielleicht von jemand anderem.
  // Ein schwaches Zeichen, deshalb nur beim Hochladen, wenn die Datei noch in der Hand ist, und zuletzt.
  const eigenerName = umfeld.eigen[0]?.nachname.trim();
  if (
    beimHochladen &&
    woerter.size &&
    typ.erkennen?.nameErwartet &&
    eigenerName &&
    !funde.some((f) => f.art === 'name') &&
    !umfeld.eigen.some((n) => namensWoerter(n.nachname).some((t) => woerter.has(t)))
  )
    funde.push({ ...basis, art: 'nameFehlt', nachname: eigenerName });

  return funde.filter((f) => !bestaetigt(v, f.art));
}

const seitenInMappe = (v: DateiVersion, alle: DateiVersion[]) =>
  eigeneMitFakten(v, alle).filter((s) => kommtInMappe(v, s.seite));

function nameVon(s: PersonStand): string {
  return s.person.rufname || s.person.vorname;
}

function zuPruefen(s: PersonStand): UnterlagenStand[] {
  return s.unterlagen.filter((u) => !u.typ.inAppErstellt && u.typ.etikett !== 'meist_unnoetig');
}

/** Alle Prüfhinweise des Haushalts, je Unterlage der wichtigste. Schlüssel: „Person/Unterlage“. */
export function pruefhinweise(
  staende: PersonStand[],
  heute: Date = new Date(),
): Map<string, Pruefhinweis> {
  const alle = staende.flatMap((s) => s.unterlagen.flatMap((u) => u.versionen));
  const funde: Pruefhinweis[] = [];
  // Erste Stelle je Datei und je Seite: Die zweite bekommt den Hinweis.
  const dateien = new Map<string, { v: DateiVersion; s: PersonStand; typ: Dokumenttyp }>();
  const seitenText = new Map<
    string,
    { v: DateiVersion; seite: number; s: PersonStand; typ: Dokumenttyp }
  >();

  for (const s of staende) {
    const eigen = [s.person, ...(s.person.nameMappe ? [s.person.nameMappe] : [])];
    const andere = staende
      .filter((x) => x !== s)
      .map((x) => ({
        id: x.person.id,
        rufname: nameVon(x),
        vorname: x.person.vorname,
        nachname: x.person.nachname,
      }));
    for (const u of zuPruefen(s)) {
      const basis = { personId: s.person.id, typ: u.typ };
      const aktuell = aktuelleVersionen(u.versionen, u.typ.serie, u.typ.jeVariante);

      // PH-a in einer Serie: Dieselbe Datei steckt in mehreren Monaten.
      const gruppe = u.typ.serie ? dieselbeDatei(aktuell) : [];
      if (gruppe.length && !gruppe.every((v) => bestaetigt(v, 'datei')))
        funde.push({ ...basis, art: 'datei', version: gruppe[0]!, gruppe });

      for (const v of aktuell) {
        const hash = v.erkannteWerte?.hash;
        const drin = seitenInMappe(v, alle);
        // PH-a über Unterlagen und Personen hinweg.
        if (hash) {
          const erste = dateien.get(hash);
          if (!erste) dateien.set(hash, { v, s, typ: u.typ });
          else if (erste.typ.id !== u.typ.id || erste.s !== s) {
            const dort = new Set(seitenInMappe(erste.v, alle).map((x) => x.seite));
            if (drin.some((x) => dort.has(x.seite)) && !bestaetigt(v, 'datei'))
              funde.push({
                ...basis,
                art: 'datei',
                version: v,
                anderswo: { name: nameVon(erste.s), typ: erste.typ },
              });
          }
        }

        // PH-b: dieselbe Seite aus einer anderen Datei oder zweimal in derselben.
        for (const { seite, fakten } of drin) {
          if (!fakten.textHash) continue;
          const erste = seitenText.get(fakten.textHash);
          if (!erste) {
            seitenText.set(fakten.textHash, { v, seite, s, typ: u.typ });
            continue;
          }
          const gleicheStelle =
            dateiSchluessel(erste.v) === dateiSchluessel(v) && erste.seite === seite;
          if (!gleicheStelle && !bestaetigt(v, 'seite'))
            funde.push({
              ...basis,
              art: 'seite',
              version: v,
              seite,
              anderswo: { name: nameVon(erste.s), typ: erste.typ },
            });
        }

        // PH-c, PH-d: Auf den Seiten steht ein anderer Monat als gewählt.
        if (u.typ.serie && v.abrechnungsmonat) {
          const monate = new Set(
            eigeneMitFakten(v, alle).flatMap((x) => (x.fakten.monat ? [x.fakten.monat] : [])),
          );
          const [monat] = monate;
          if (monate.size === 1 && monat && monat !== v.abrechnungsmonat) {
            const belegt = u.versionen.some((x) => x.abrechnungsmonat === monat);
            const art = belegt ? 'monatDoppelt' : 'monat';
            if (!bestaetigt(v, art)) funde.push({ ...basis, art, version: v, monat });
          }
        }

        funde.push(...versionPruefen(v, { ...basis, eigen, andere }, alle, heute));
      }
    }
  }

  const ergebnis = new Map<string, Pruefhinweis>();
  for (const f of funde.sort((a, b) => RANG.indexOf(a.art) - RANG.indexOf(b.art))) {
    const schluessel = `${f.personId}/${f.typ.id}`;
    if (!ergebnis.has(schluessel)) ergebnis.set(schluessel, f);
  }
  return ergebnis;
}

/** Welche Seiten vorgewählt sind (`nurSeitenMit` im Regelkatalog). Null: alle. */
export function seitenVorauswahl(
  seiten: { woerter: string[] }[],
  woerter: string[] | undefined,
): number[] | null {
  if (seiten.length < 2) return null;
  for (const wort of woerter ?? []) {
    const form = wortForm(wort);
    const treffer = seiten.flatMap((s, i) => (s.woerter.includes(form) ? [i] : []));
    if (treffer.length && treffer.length < seiten.length) return treffer;
  }
  return null;
}

/** Welche Variante nach den Wörtern im Dokument (`varianten` im Regelkatalog). */
export function varianteErkennen(
  seiten: { woerter: string[] }[],
  regel: { wenn: Record<string, string[]>; beide?: string } | undefined,
): string | null {
  if (!regel) return null;
  const alle = new Set(seiten.flatMap((s) => s.woerter));
  const treffer = Object.entries(regel.wenn)
    .filter(([, woerter]) => woerter.some((w) => alle.has(wortForm(w))))
    .map(([id]) => id);
  if (treffer.length > 1) return regel.beide ?? null;
  return treffer[0] ?? null;
}
