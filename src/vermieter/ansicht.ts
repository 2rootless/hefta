import katalogRoh from '../../data/regelkatalog.de.json';
import { werIstDabeiSatz } from '../domain/mappeWoerter';
import type { Tag } from '../domain/modell';
import type { AnhangUnterlage, HeftaAnhang } from '../pdf/anhang';
import {
  datumText,
  gruppe,
  haushaltTitel,
  imVertrag,
  NB,
  rolleText,
  unterlageAngabe,
  unterlageText,
  vollstaendigkeit,
} from './regel';

// Kern von 57 (Bericht 61, Abschnitt 8, Schritt 1; Bericht 57, Abschnitt 2): Aus der Lesehilfe wird die
// Ansicht der neuen Vermieterseite nach B10 und B13, ohne Oberfläche. Die Seite zeichnet nur noch, was
// hier steht. Dieselbe Rechnung braucht später die Mieter-App für „Was hinausging“ (Hefta 2).

const vermieter = (
  katalogRoh as unknown as {
    vermieter: {
      etiketten: Record<string, string>;
      etikettSonst: string;
      pruefwege: Record<string, { tage: number; quelle: string; stand: string }>;
    };
  }
).vermieter;

/** Etikett im Register und an den Zeilen (B10, Liste für Code, „Etiketten der Zeilen“). */
export type Etikett =
  | 'Deckblatt'
  | 'Selbstauskunft'
  | 'Einkommen'
  | 'Bonität'
  | 'Bürgschaft'
  | 'Mietzahlungen'
  | 'Weiteres';

export const DECKBLATT: Etikett = 'Deckblatt';

/** Das Etikett kommt aus dem Regelkatalog (Daten, nicht Code). Unbekannte Typen stehen unter „Weiteres“. */
export function etikettVon(typ: string): Etikett {
  return (vermieter.etiketten[typ] ?? vermieter.etikettSonst) as Etikett;
}

const MONATE_KURZ = [
  'Jan.',
  'Feb.',
  'März',
  'Apr.',
  'Mai',
  'Juni',
  'Juli',
  'Aug.',
  'Sept.',
  'Okt.',
  'Nov.',
  'Dez.',
];

function tagPlus(tag: Tag, tage: number): Tag {
  const [j, m, t] = tag.split('-').map(Number);
  const d = new Date(Date.UTC(j!, m! - 1, t! + tage));
  return d.toISOString().slice(0, 10) as Tag;
}

function tagVon(heute: Date): Tag {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${heute.getFullYear()}-${p(heute.getMonth() + 1)}-${p(heute.getDate())}` as Tag;
}

export interface Frist {
  /** Letzter Tag, an dem sich der Nachweis online prüfen lässt. */
  bis: Tag;
  /** Am Blatt der Bonität: „prüfbar bis 19. Dez.“ */
  kurz: string;
  /** Am Rand: „Online prüfbar bis 19. Dezember 2026.“ */
  lang: string;
  /** Endet die Frist, wird der Nachweis dadurch nicht ungültig (Bericht 57, Punkt 4). */
  hinweis: string;
  quelle: string;
  vorbei: boolean;
}

/**
 * Frist der Bonität, gerechnet ab dem Datum in der Lesehilfe nach dem Muster des SCHUFA-BonitätsChecks
 * (60 Tage ab Ausstellung, Katalog). Ohne Datum gibt es keine Frist.
 */
export function bonitaetFrist(u: AnhangUnterlage, heute: Date): Frist | null {
  const weg = vermieter.pruefwege.bonitaet;
  if (u.typ !== 'bonitaet' || !u.vom || !weg) return null;
  const bis = tagPlus(u.vom, weg.tage);
  const [, m, t] = bis.split('-').map(Number);
  return {
    bis,
    kurz: `prüfbar bis ${t}.${NB}${MONATE_KURZ[m! - 1]}`,
    lang: `Online prüfbar bis ${datumText(bis)}.`,
    hinweis: 'Endet die Frist, wird der Nachweis dadurch nicht ungültig.',
    quelle: `Quelle: ${weg.quelle}, Stand ${weg.stand}`,
    vorbei: bis < tagVon(heute),
  };
}

export interface Zeile {
  /** Stelle in `unterlagen` der Lesehilfe. */
  index: number;
  typ: string;
  etikett: Etikett;
  /** „Gehaltsnachweise“, „Bonitätsnachweis“; nur aus dem Katalog. */
  text: string;
  /** „Juli bis September 2026“, „vom 20. Oktober 2026“ oder leer. */
  angabe: string;
  seiten: [number, number];
  /** 1: bis zum Mietwunsch, 2: nach der Entscheidung, 3: nicht nötig. */
  gruppe: 1 | 2 | 3;
  frist: Frist | null;
}

export interface PersonAnsicht {
  index: number;
  name: string;
  rolle: string;
  imVertrag: boolean;
  zeilen: Zeile[];
}

export interface RegisterEintrag {
  etikett: Etikett;
  /** Name der Person; beim Deckblatt leer. */
  name: string;
  seite: number;
}

export interface Ansicht {
  kennung: string | null;
  /** „Max und Lea Mustermann“ */
  haushalt: string;
  /** Rahmen-Satz nach E25: „Zwei im Mietvertrag, ein Kind zieht mit ein. Eine Person bürgt.“ */
  rahmen: string;
  erstellt: Tag;
  personen: PersonAnsicht[];
  /** Sprungmarken im Lesen, nach Seiten geordnet, mit dem Deckblatt vorn. */
  register: RegisterEintrag[];
  /** Was fehlt, je Person; aus derselben Regel wie heute. */
  vollstaendigkeit: ReturnType<typeof vollstaendigkeit>;
}

export function ansicht(a: HeftaAnhang, heute: Date): Ansicht {
  const personen: PersonAnsicht[] = a.haushalt.personen.map((p, index) => ({
    index,
    name: p.name,
    rolle: rolleText(p),
    imVertrag: imVertrag(p),
    zeilen: [],
  }));
  a.unterlagen.forEach((u, index) => {
    const p = personen[u.person];
    const roh = a.haushalt.personen[u.person];
    if (!p || !roh) return; // Die Prüfung der Lesehilfe lässt das nicht durch; hier nur zur Sicherheit.
    p.zeilen.push({
      index,
      typ: u.typ,
      etikett: etikettVon(u.typ),
      text: unterlageText(u),
      angabe: unterlageAngabe(u),
      seiten: u.seiten,
      gruppe: gruppe(u, roh),
      frist: bonitaetFrist(u, heute),
    });
  });
  for (const p of personen) p.zeilen.sort((x, y) => x.seiten[0] - y.seiten[0]);

  const register: RegisterEintrag[] = [
    { etikett: DECKBLATT, name: '', seite: 1 },
    ...a.unterlagen
      .map((u) => ({
        etikett: etikettVon(u.typ),
        name: a.haushalt.personen[u.person]?.name ?? '',
        seite: u.seiten[0],
      }))
      .sort((x, y) => x.seite - y.seite),
  ];

  const vertrag = a.haushalt.personen.filter(imVertrag).length;
  const buergen = a.haushalt.personen.length - vertrag;
  return {
    kennung: a.bewerbung.kennung ?? null,
    haushalt: haushaltTitel(a),
    rahmen: werIstDabeiSatz(vertrag, a.haushalt.mitziehende, buergen),
    erstellt: a.erstellt,
    personen,
    register,
    vollstaendigkeit: vollstaendigkeit(a),
  };
}
