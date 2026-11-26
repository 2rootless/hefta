import { AUSSEHEN_STANDARD } from '../domain/modell';
import { pdfZeigen } from '../app/pdfFenster.svelte';
import { selbstauskuenfteDateiname, selbstauskunftDateiname } from '../domain/dateiname';
import type { Person, Rolle } from '../domain/modell';
import { rollenText } from '../domain/regelkatalog';
import { nameImPdf, nameText } from '../domain/namen';
import {
  einziehend,
  ortUndDatum,
  selbstauskunftBloecke,
  type Schritt,
} from '../domain/selbstauskunft';
import { datum } from '../i18n';
import { deckFarbe, PERSONENFARBEN } from '../pdf/mappe';
import { pdfSchriftenLaden } from '../pdf/schriften';
import {
  selbstauskuenfteBauen,
  selbstauskunftBauen,
  type SelbstauskunftInhalt,
} from '../pdf/selbstauskunft';
import type { HaushaltAnsicht } from '../storage/speicher';
import { haushaltsAngabenAus } from './selbstauskunftEingabe';

// Erzeugt die Selbstauskunft einer Person als PDF-Datei (auf dem Gerät, ohne Netz).

/** Der Inhalt einer Selbstauskunft, wie die App sie baut (für eine Datei je Person oder alle in einer). */
function inhaltFuer(
  person: Person,
  rolle: Rolle,
  ansicht: HaushaltAnsicht,
  schritt: Schritt,
  heute: Date,
): SelbstauskunftInhalt {
  const vertrag = ansicht.mitglieder.filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length;
  const platz = ansicht.mitglieder.find((m) => m.person.id === person.id)?.zugehoerigkeit;
  const hh = haushaltsAngabenAus(ansicht);
  return {
    name: nameText(nameImPdf(person)),
    rolle: rollenText(rolle, platz?.bezeichnung ?? 'neutral'),
    // DP150 C6: Ohne Haushalt hat niemand „Im Mietvertrag“ gewählt; unter dem Titel steht nur der Musterbogen.
    ohneRolle: !!ansicht.haushalt.ohneHaushalt && rolle !== 'buerge',
    buerge: rolle === 'buerge',
    farbe: deckFarbe(
      ansicht.haushalt.mappeAussehen ?? AUSSEHEN_STANDARD,
      PERSONENFARBEN[((platz?.farbe ?? 1) - 1) % PERSONENFARBEN.length]!,
    ),
    bloecke: selbstauskunftBloecke(
      person,
      rolle,
      einziehend(vertrag, ansicht.haushalt),
      hh,
      schritt,
      // Ohne Haushalt gibt es keine Bewerbung, die nach einer Sozialwohnung fragt: Der Schein steht, wenn beantwortet.
      { antwortenImmer: true, wbsZeile: !!ansicht.haushalt.ohneHaushalt },
    ),
    ...ortUndDatum(rolle, hh.ort, datum(heute)),
  };
}

export async function selbstauskunftDatei(
  person: Person,
  rolle: Rolle,
  ansicht: HaushaltAnsicht,
  schritt: Schritt = 'will_wohnung',
  heute = new Date(),
): Promise<File> {
  const name = selbstauskunftDateiname(nameImPdf(person));
  const { bytes } = await selbstauskunftBauen({
    ...inhaltFuer(person, rolle, ansicht, schritt, heute),
    dateiname: name,
    schriften: await pdfSchriftenLaden(ansicht.haushalt.mappeAussehen?.schrift),
    datum: heute,
  });
  return new File([bytes.slice()], name, { type: 'application/pdf' });
}

/**
 * PC213 (DP134, Abschnitt 4): die Selbstauskünfte aller Personen einer Ansicht, ohne Bürgen ausgenommen: „eine“ Datei
 * mit allen oder „je“ Person eine. Eine Person allein gibt immer eine Datei.
 */
export async function selbstauskuenfteDateien(
  ansicht: HaushaltAnsicht,
  art: 'eine' | 'je',
  heute = new Date(),
): Promise<File[]> {
  const mitglieder = ansicht.mitglieder;
  if (art === 'je' || mitglieder.length < 2)
    return Promise.all(
      mitglieder.map((m) =>
        selbstauskunftDatei(m.person, m.zugehoerigkeit.rolle, ansicht, 'will_wohnung', heute),
      ),
    );
  const name = selbstauskuenfteDateiname(mitglieder.map((m) => nameImPdf(m.person)));
  const { bytes } = await selbstauskuenfteBauen(
    mitglieder.map((m) =>
      inhaltFuer(m.person, m.zugehoerigkeit.rolle, ansicht, 'will_wohnung', heute),
    ),
    {
      dateiname: name,
      schriften: await pdfSchriftenLaden(ansicht.haushalt.mappeAussehen?.schrift),
      datum: heute,
    },
  );
  return [new File([bytes.slice()], name, { type: 'application/pdf' })];
}

/**
 * Zeigt die Datei in der Seitenansicht von Hefta, in App und Browser gleich: nichts wird gespeichert,
 * kein neuer Tab, kein Download (im Browser auf dem iPhone fragte sonst Safari, wohin damit).
 */
export function dateiOeffnen(datei: File): void {
  pdfZeigen(datei);
}
