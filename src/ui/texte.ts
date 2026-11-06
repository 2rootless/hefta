import { pruefcodeStand } from '../domain/pruefhinweise';
import { faelligAb, monatPlus } from '../domain/fristen';
import type { Person } from '../domain/modell';
import { eintragenText, type UnterlagenStand } from '../domain/regelkatalog';
import { monatName, t, tagText, tagZusammen, zahlwort } from '../i18n';

// Texte zum Stand einer Unterlage, gemeinsam für Übersicht und Personenansicht.

/** Tag ohne Jahr, wenn es das laufende ist („2. Oktober“), sonst mit Jahr. */
export function tagKurz(tag: string, heute: Date = new Date()): string {
  const [j, m, d] = tag.split('-').map(Number) as [number, number, number];
  if (j !== heute.getFullYear()) return tagText(tag);
  return tagZusammen(
    new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(
      new Date(j, m - 1, d),
    ),
  );
}

/**
 * Stand einer Unterlage in Worten (Personenansicht P1–P3, Wortlaute aus design/zeit-und-dateien.md):
 * „August bis Oktober“, „Neuer Monat: November kann da sein“, „Vom 2. Oktober“,
 * „Bald zu alt, vom 28. Aug.“, „Zu alt, vom 12. Juli“, „Fertig, 1 Seite“, „Fehlt noch“.
 */
/** „August und Oktober“ oder „August bis Oktober“. */
function monateListe(monate: string[], heute: Date): string {
  return new Intl.ListFormat('de-DE', { type: 'conjunction' }).format(
    monate.map((m) => monatName(m, heute)),
  );
}

function lueckenlos(monate: string[]): boolean {
  return monate.every((m, i) => i === 0 || monatPlus(monate[i - 1]!, 1) === m);
}

/** „August fehlt noch.“, „August und Juli fehlen noch.“ */
function fehltText(u: UnterlagenStand, heute: Date): string {
  if (!u.fehlend.length) return `${u.grund}.`;
  const monate = monateListe(u.fehlend, heute);
  return u.fehlend.length === 1
    ? t('unterlage.monatFehlt', { monate })
    : t('unterlage.monateFehlen', { monate });
}

export function standText(u: UnterlagenStand, heute = new Date()): string {
  // Die Selbstauskunft entsteht in der App: fertig oder nicht, ohne Datum einer Datei.
  if (u.typ.inAppErstellt)
    return u.status === 'da' ? t('person.standFertigSeite') : t('person.standFehlt');
  if (u.typ.serie && u.monate.length > 0) {
    const von = u.monate[0]!;
    const bis = u.monate.at(-1)!;
    if (u.status === 'bald' && u.naechsterMonat)
      return t('person.standNeuerMonat', { monat: monatName(u.naechsterMonat, heute) });
    const da =
      von === bis
        ? t('person.standSerieEins', { monat: monatName(von, heute) })
        : lueckenlos(u.monate)
          ? t('person.standSerieVonBis', {
              von: monatName(von, heute),
              bis: monatName(bis, heute),
            })
          : monateListe(u.monate, heute);
    return u.status === 'fehlt' ? `${da}. ${fehltText(u, heute).replace(/\.$/, '')}` : da;
  }
  if (u.neuestesDatum) {
    if (u.status === 'bald' || (u.status === 'fehlt' && u.veraltet)) return u.grund;
    const code = pruefcodeStand(u, heute);
    const vom = tagKurz(u.neuestesDatum, heute);
    if (code?.art === 'abgelaufen') return t('person.standPruefcodeAbgelaufen', { datum: vom });
    if (code?.art === 'laeuft')
      return t('person.standPruefcodeLaeuft', { datum: vom, am: tagKurzAus(code.am) });

    return t(u.veraltet && u.status === 'optional' ? 'person.standVomAlt' : 'person.standVom', {
      datum: tagKurz(u.neuestesDatum, heute),
    });
  }
  if (ohneDatum(u)) return t('person.standOhneDatum');
  if (u.status === 'da') return t('person.standDa');
  if (u.status === 'fehlt') return t('person.standFehlt');
  return u.typ.kurz ?? t('person.standFreiwillig');
}

/** Ohne Datum kann Hefta nicht erinnern, wenn die Unterlage zu alt wird. Das geht nicht still verloren. */
export function ohneDatum(u: UnterlagenStand): boolean {
  return (
    u.status === 'da' &&
    !u.neuestesDatum &&
    !!u.versionen.length &&
    u.typ.datum === 'ausstellungsdatum' &&
    !!u.typ.fristen
  );
}

/** „Als Nächstes“ in der Personenansicht: bei Gehalt mit Monat, z. B. „Gehaltsnachweis Oktober“. */
export function naechsterText(
  u: UnterlagenStand,
  person: Pick<Person, 'abrechnungMeist'>,
  heute = new Date(),
): { unterlage: string; grund: string } {
  const unterlage = eintragenText(u.typ);
  if (u.typ.serie && u.status === 'bald' && u.naechsterMonat) {
    const monat = monatName(u.naechsterMonat, heute);
    const grund = person.abrechnungMeist
      ? t('person.kommtMeist', {
          zeit: t(`person.zeit.${person.abrechnungMeist}`),
          monat: monatName(monatPlus(u.naechsterMonat, 1), heute),
        })
      : faelligAb(u.naechsterMonat, null) <= heute
        ? t('person.kannDaSein')
        : u.grund;
    return { unterlage: t('person.naechsterMonat', { unterlage, monat }), grund };
  }
  return { unterlage, grund: u.grund };
}

/** Höchstalter aus den Fristen des Katalogs in Worten: 90 Tage → „drei Monate“ (Z2, Z5). */
export function alterGrenze(u: Pick<UnterlagenStand, 'typ'>): string {
  const tage = u.typ.fristen?.warnungTage ?? 90;
  const monate = Math.max(1, Math.round(tage / 30));
  return t('zahlen.monate', { anzahl: monate, zahl: zahlwort(monate) });
}

/**
 * Der Satz im Kopf der Seite einer Unterlage (design/unterlage-warum-haushalt.md, UL1 bis UL6): was in
 * der Mappe ist und ob etwas zu tun ist.
 */
export function unterlageSatz(
  u: UnterlagenStand,
  nichtMehrNoetig: boolean,
  heute = new Date(),
): string {
  const da = u.versionen.length > 0;
  if (nichtMehrNoetig) return t('unterlage.satzNichtMehr');
  if (u.typ.etikett === 'meist_unnoetig')
    return da ? t('unterlage.satzGespeichert') : t('unterlage.satzNichtDrin');
  if (!da) return u.status === 'fehlt' ? t('unterlage.satzFehlt') : t('unterlage.satzFreiwillig');
  if (u.typ.serie && u.monate.length > 0) {
    const von = u.monate[0]!;
    const bis = u.monate.at(-1)!;
    const inMappe =
      von === bis
        ? t('unterlage.satzSerieEins', { monat: monatName(von, heute) })
        : lueckenlos(u.monate)
          ? t('unterlage.satzSerie', { von: monatName(von, heute), bis: monatName(bis, heute) })
          : t('unterlage.satzSerieListe', { monate: monateListe(u.monate, heute) });
    if (u.status === 'bald' && u.naechsterMonat)
      return `${inMappe} ${t('unterlage.satzNeuerMonat', { monat: monatName(u.naechsterMonat, heute) })}`;
    return u.status === 'fehlt' ? `${inMappe} ${fehltText(u, heute)}` : inMappe;
  }
  if (ohneDatum(u)) return t('unterlage.satzOhneDatum', satzForm(u.typ));
  if (u.neuestesDatum) {
    const datum = tagText(u.neuestesDatum);
    if (u.veraltet) return t('unterlage.satzZuAlt', { datum });
    if (pruefcodeStand(u, heute)?.art === 'abgelaufen')
      return t('unterlage.satzPruefcodeAbgelaufen', { datum });

    // Ohne Höchstalter im Katalog (Rentenbescheid) wird sie nie „zu alt“, also auch kein Tag dafür.
    if (u.status === 'bald' && !u.typ.fristen?.warnungTage)
      return t('unterlage.satzBaldOhneTag', { datum });
    if (u.status === 'bald' && u.typ.fristen?.warnungTage) {
      // Am Tag des Höchstalters gilt sie noch, „zu alt“ ist sie am Tag danach (fristen.ts).
      const [j, m, d] = u.neuestesDatum.split('-').map(Number) as [number, number, number];
      const ab = new Date(j, m - 1, d + u.typ.fristen.warnungTage + 1);
      return t('unterlage.satzBald', {
        datum,
        ab: tagZusammen(
          new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(ab),
        ),
      });
    }
    return t('unterlage.satzVom', { datum });
  }
  return t('unterlage.satzDrin');
}

/** „er“, „sie“, „es“ für Sätze über eine Unterlage („Wann wurde er ausgestellt?“). */
export function pronomen(typ: { artikel?: string }): string {
  return typ.artikel === 'die' ? 'sie' : typ.artikel === 'das' ? 'es' : 'er';
}

/** Werte für Sätze über eine Unterlage: Pronomen, und `anzahl` wählt Einzahl oder Mehrzahl. */
export function satzForm(typ: { artikel?: string; mehrzahl?: boolean }) {
  return { er: pronomen(typ), anzahl: typ.mehrzahl ? 2 : 1 };
}

/** „14. Dezember“. */
export function tagKurzAus(tag: Date): string {
  return tagZusammen(
    new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(tag),
  );
}
