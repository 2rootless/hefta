import { AUSSEHEN_STANDARD } from '../domain/modell';
import { pdfZeigen } from '../app/pdfFenster.svelte';
import { selbstauskunftDateiname } from '../domain/dateiname';
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
import { selbstauskunftBauen } from '../pdf/selbstauskunft';
import type { HaushaltAnsicht } from '../storage/speicher';
import { haushaltsAngabenAus } from './selbstauskunftEingabe';

// Erzeugt die Selbstauskunft einer Person als PDF-Datei (auf dem Gerät, ohne Netz).

export async function selbstauskunftDatei(
  person: Person,
  rolle: Rolle,
  ansicht: HaushaltAnsicht,
  schritt: Schritt = 'will_wohnung',
  heute = new Date(),
): Promise<File> {
  const vertrag = ansicht.mitglieder.filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length;
  const platz = ansicht.mitglieder.find((m) => m.person.id === person.id)?.zugehoerigkeit;
  const name = selbstauskunftDateiname(nameImPdf(person));
  const hh = haushaltsAngabenAus(ansicht);
  const { bytes } = await selbstauskunftBauen({
    dateiname: name,
    name: nameText(nameImPdf(person)),
    rolle: rollenText(rolle, platz?.bezeichnung ?? 'neutral'),
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
      { rolleText: rollenText(rolle, platz?.bezeichnung ?? 'neutral'), antwortenImmer: true },
    ),
    ...ortUndDatum(rolle, hh.ort, datum(heute)),
    schriften: await pdfSchriftenLaden(ansicht.haushalt.mappeAussehen?.schrift),
    datum: heute,
  });
  return new File([bytes.slice()], name, { type: 'application/pdf' });
}

/**
 * Zeigt die Datei in der Seitenansicht von Hefta, in App und Browser gleich: nichts wird gespeichert,
 * kein neuer Tab, kein Download (im Browser auf dem iPhone fragte sonst Safari, wohin damit).
 */
export function dateiOeffnen(datei: File): void {
  pdfZeigen(datei);
}
