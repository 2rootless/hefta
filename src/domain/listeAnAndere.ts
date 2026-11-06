import { felderFuer } from './selbstauskunft';
import {
  listenText,
  ohneTrennstellen,
  type PersonStand,
  type UnterlagenStand,
} from './regelkatalog';

// Version 2.0, Liste an andere schicken (design/version-2-0.md, Entwürfe L1 bis L4): Petras
// Unterlagen liegen auf Petras Telefon. Die Nachricht sagt ihr, was fehlt; nur der Text geht raus.

/** Was der Person noch fehlt, in der Reihenfolge des Katalogs; was man zusammen ausfüllt, zuletzt. */
export function fehlendFuerListe(stand: PersonStand): UnterlagenStand[] {
  const fehlt = stand.pfad.filter((u) => u.status === 'fehlt');
  return [
    ...fehlt.filter((u) => !u.typ.inAppErstellt),
    ...fehlt.filter((u) => u.typ.inAppErstellt),
  ];
}

/** Wer eine Liste bekommen kann: alle außer der ersten Person, denen etwas fehlt. */
export function listenEmpfaenger(staende: PersonStand[]): PersonStand[] {
  return staende.slice(1).filter((s) => fehlendFuerListe(s).length);
}

function zeile(stand: PersonStand, u: UnterlagenStand): string {
  const titel = ohneTrennstellen(listenText(u.typ));
  if (u.typ.inAppErstellt) {
    const { rolle, person } = stand;
    const mitEinkommen = felderFuer(rolle, person.lebenssituation).some(
      (f) => f.id === 'nettoeinkommen',
    );
    const einkommen = person.lebenssituation === 'rente' ? 'deiner Rente' : 'deinem Einkommen';
    return mitEinkommen
      ? `${titel}: die füllen wir zusammen aus, ich frage dich kurz nach ${einkommen} und drei Ja-Nein-Fragen.`
      : `${titel}: die füllen wir zusammen aus, ich stelle dir kurz drei Ja-Nein-Fragen.`;
  }
  const hilfe = u.typ.hilfeAndere ?? u.typ.hilfe ?? '';
  const satz = ohneTrennstellen(hilfe.charAt(0).toLowerCase() + hilfe.slice(1));
  return satz ? `${titel}: ${satz}` : titel;
}

export interface ListenOptionen {
  /** Rufname der Person, die schickt. */
  von: string;
  /** Allein im Haushalt: „ich“ statt „wir“. */
  allein?: boolean;
  /** Schalter „Selbstauskunft aufführen“ (Entwurf L2). */
  selbstauskunft?: boolean;
}

/** Die Nachricht als Text für das Teilen-Blatt. Keine Daten außer Namen und Unterlagen. */
export function listeAlsText(stand: PersonStand, optionen: ListenOptionen): string {
  const { von, allein = false, selbstauskunft = true } = optionen;
  const name = stand.person.rufname || stand.person.vorname;
  const zeilen = fehlendFuerListe(stand)
    .filter((u) => selbstauskunft || !u.typ.inAppErstellt)
    .map((u) => `• ${zeile(stand, u)}`);
  return [
    allein
      ? `Hallo ${name}, für meine Wohnungsbewerbung brauche ich noch von dir:`
      : `Hallo ${name}, für unsere Wohnungsbewerbung brauchen wir noch von dir:`,
    '',
    ...zeilen,
    '',
    `Am liebsten als PDF. Papier machst du am iPhone in der App Dateien über „Dokumente scannen“ zum PDF. Danke! ${von}`,
  ].join('\n');
}
