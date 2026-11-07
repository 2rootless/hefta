import vorlage from '../../data/nachforderung.de.json';
import { APP_NAME } from '../app/name';
import type { HeftaAnhang } from '../pdf/anhang';
import { imVertrag, NB, vollstaendigkeit } from './regel';

// Die Mail „Für den Vertrag anfordern“ (design/nachforderung.md): Zusage zuerst, dann genau die üblichen
// Unterlagen, die in der Mappe fehlen, die Fragen des Musterbogens für diesen Schritt und was nicht nötig ist.
// Der Text ist Vorlage in data/nachforderung.de.json; hier steht nur, was wann drinsteht.

type PostenId = keyof typeof vorlage.posten;

/** Länger werden Mail-Links in manchen Mailprogrammen unter Windows abgeschnitten. */
export const MAIL_LINK_GRENZE = 1800;

export const fuellen = (text: string, werte: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, name: string) => werte[name] ?? '');

export const reihe = (namen: string[]) =>
  namen.length > 1
    ? `${namen.slice(0, -1).join(', ')} und ${namen[namen.length - 1]}`
    : (namen[0] ?? '');

export interface Nachforderung {
  betreff: string;
  text: string;
  /** Wie viele Unterlagen die Mail erbittet: je Person und Unterlage eine (VS15). */
  posten: number;
  ziel: string;
}

/** Die Wohnung, wie sie in einer Mail steht: „Hauptstraße 12, 3. OG links, 22767 Hamburg“. */
export function wohnungText(a: HeftaAnhang): string | null {
  const w = a.bewerbung.wohnung;
  return w ? `${w.strasse}, ${w.rest}`.replaceAll(NB, ' ').replaceAll(' · ', ', ') : null;
}

export function nachforderung(a: HeftaAnhang): Nachforderung {
  const { ziel, personen } = vollstaendigkeit(a);
  const vertrag = personen.filter((x) => imVertrag(x.person));
  const buergen = personen.filter((x) => !imVertrag(x.person));
  const reihenfolge = [...vertrag, ...buergen];

  const wohnung = wohnungText(a) ?? vorlage.wohnungOhne;

  // Fehlt dieselbe Unterlage mehreren, steht sie in einer Zeile mit allen Namen.
  const je = new Map<PostenId, string[]>();
  let posten = 0;
  for (const x of reihenfolge) {
    const name = imVertrag(x.person)
      ? x.person.name
      : fuellen(vorlage.buergt, { name: x.person.name });
    for (const f of [...x.fehlt, ...x.spaeter]) {
      const id = (f.typ ?? 'einkommen') as PostenId;
      je.set(id, [...(je.get(id) ?? []), name]);
      posten += 1;
    }
  }

  const z = [
    fuellen(vorlage.anrede, {
      namen: reihe((vertrag.length ? vertrag : personen).map((x) => x.person.name)),
    }),
    '',
    vorlage.zusage,
  ];
  if (je.size) {
    z.push(vorlage.fehltKopf, '');
    for (const id of Object.keys(vorlage.posten) as PostenId[]) {
      const namen = je.get(id);
      if (namen)
        z.push(fuellen(vorlage.fehltZeile, { namen: reihe(namen), was: vorlage.posten[id] }));
    }
    if (je.has('einkommen')) z.push(vorlage.schwaerzen);
  } else {
    z.push(vorlage.liegtBei);
  }
  z.push('');
  // Für den Vertrag zusammengestellt: Die Selbstauskunft druckt die Antworten schon.
  if (ziel !== 'zusage') {
    z.push(
      vorlage.fragenKopf,
      ...vorlage.fragen.map((frage) => fuellen(vorlage.frageZeile, { frage })),
      fuellen(vorlage.fragenApp, { app: APP_NAME }),
      '',
    );
  }
  const original = buergen
    .filter((x) => x.da.some((u) => u.typ === 'buergschaftserklaerung'))
    .map((x) => x.person.name);
  if (original.length) z.push(fuellen(vorlage.original, { namen: reihe(original) }));
  z.push(vorlage.nichtNoetig, vorlage.loeschen, '', vorlage.gruss, vorlage.absender);

  return { betreff: fuellen(vorlage.betreff, { wohnung }), text: z.join('\n'), posten, ziel };
}

/**
 * Mit Empfänger, wenn die Lesehilfe eine saubere Mailadresse trägt (Fassung 3, E17); sonst ohne, und die
 * Adresse steht auf dem Deckblatt.
 */
export function mailLink(
  betreff: string,
  text: string,
  an: string | null = null,
): { href: string; nurBetreff: boolean } {
  const kurz = `mailto:${an ?? ''}?subject=${encodeURIComponent(betreff)}`;
  const voll = `${kurz}&body=${encodeURIComponent(text)}`;
  return voll.length > MAIL_LINK_GRENZE
    ? { href: kurz, nurBetreff: true }
    : { href: voll, nurBetreff: false };
}
