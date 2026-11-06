import { mappenDateiname } from '../domain/export';
import type { Bewerbung } from '../domain/modell';
import { haushaltsZeile, imPdfSchreibbar, nameImPdf } from '../domain/namen';
import {
  berufBezeichnungen,
  selbstauskunftVon,
  type HaushaltsAngaben,
} from '../domain/selbstauskunft';
import { t } from '../i18n';
import { personStand, type PersonStand } from '../domain/regelkatalog';
import type { HaushaltAnsicht } from '../storage/speicher';
import { haushaltsAngabenAus } from './selbstauskunftEingabe';

// Leichte Helfer für „Mappe erstellen“, ohne PDF-Bibliothek (die lädt erst beim Bauen).

export function staendeAus(ansicht: HaushaltAnsicht, heute = new Date()): PersonStand[] {
  const hh = haushaltsAngabenAus(ansicht);
  return ansicht.mitglieder.map((m) =>
    personStand(m.person, m.zugehoerigkeit, ansicht.dokumente, ansicht.versionen, heute, hh),
  );
}

/** „Max und Lea Mustermann“; die Regel steht bei haushaltsZeile. */
export function fussName(staende: PersonStand[]): string {
  return haushaltsZeile(
    staende.filter((s) => s.rolle !== 'buerge').map((s) => nameImPdf(s.person)),
  );
}

export function standardDateiname(staende: PersonStand[], adresse: string): string {
  return mappenDateiname(
    staende.filter((s) => s.rolle !== 'buerge').map((s) => nameImPdf(s.person).nachname),
    adresse,
  );
}

export interface ZeichenFund {
  /** „Arbeitgeber bei Max“. */
  feld: string;
  /** Wohin „Ändern“ führt; `adresse` öffnet das Blatt der Adresse auf derselben Seite. */
  ziel: string | 'adresse';
}

/**
 * Freitext mit Zeichen, die das PDF nicht schreiben kann: Dort stünde ein Fragezeichen. Das sagt
 * „Mappe erstellen“ und führt zum Feld (design/mappe-pdf.md). Namen fragt schon das Formular (K8).
 */
export function zeichenFunde(
  dabei: PersonStand[],
  hh: HaushaltsAngaben,
  bewerbung: Pick<Bewerbung, 'adresse' | 'satz' | 'bitteSatz' | 'export'> | null,
): ZeichenFund[] {
  const funde: ZeichenFund[] = [];
  const pruefen = (wert: string | undefined, feld: string, ziel: string) => {
    if (wert?.trim() && !imPdfSchreibbar(wert)) funde.push({ feld, ziel });
  };
  pruefen(bewerbung?.adresse, t('mappe.feldAdresse'), 'adresse');
  pruefen(bewerbung?.satz, t('mappe.feldSatz'), 'satz');
  if (bewerbung?.export?.bitte)
    pruefen(bewerbung.bitteSatz, t('mappe.feldBitte'), '#/mappe/anpassen/bitte');
  for (const s of dabei) {
    const ziel = `#/selbstauskunft/${s.person.id}/feld`;
    const bei = (feld: string) =>
      t('mappe.feldBei', { feld, name: s.person.rufname || s.person.vorname });
    const namen = berufBezeichnungen(s.person);
    const sa = selbstauskunftVon(s.person);
    pruefen(s.person.kontakt.telefon, bei(t('mappe.feldTelefon')), `${ziel}/telefon`);
    pruefen(s.person.kontakt.email, bei(t('mappe.feldEmail')), `${ziel}/email`);
    pruefen(s.person.beruf, bei(namen.beruf), `${ziel}/beruf`);
    pruefen(s.person.arbeitgeber, bei(namen.arbeitgeber), `${ziel}/arbeitgeber`);
    for (const text of [sa.erklaerungInsolvenz, sa.erklaerungRaeumungstitel, sa.stellungnahme])
      pruefen(text, bei(t('mappe.feldErklaerung')), `${ziel}/erklaerung`);
  }
  const erste = dabei.find((s) => s.rolle !== 'buerge');
  if (erste) {
    const ziel = `#/selbstauskunft/${erste.person.id}/feld`;
    pruefen(hh.haustiereText, t('mappe.feldHaustiere'), `${ziel}/haustiere`);
    pruefen(hh.ort, t('mappe.feldOrt'), `${ziel}/ort`);
  }
  return funde.filter((f, i) => funde.findIndex((x) => x.feld === f.feld) === i);
}
