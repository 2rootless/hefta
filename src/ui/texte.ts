import { pruefcodeStand } from '../domain/pruefhinweise';
import { faelligAb, monatPlus } from '../domain/fristen';
import type { BonitaetAngabe, Bezeichnung, Person } from '../domain/modell';
import { eintragenText, situationText, type UnterlagenStand } from '../domain/regelkatalog';
import { monatName, t, tagText, tagZusammen, zahlwort } from '../i18n';
import { anrede } from '../i18n/anrede.svelte';

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

/**
 * K10 (DP96, Wortlaut F): Satz im Rutsch, sobald ein Monat einer Serie drin ist. Nennt, was drin ist, und jeden
 * fehlenden Monat: „September und November sind drin. Oktober fehlt noch.“ Monate in Kalenderfolge und ohne Jahr,
 * auch über den Jahreswechsel; ihr und du lauten gleich.
 */
export function serieSatz(fenster: { monat: string; da: boolean }[]): string {
  const sortiert = [...fenster].sort((a, b) => a.monat.localeCompare(b.monat));
  // Ohne Jahr: monatName nennt das Jahr nur, wenn es nicht das „heutige“ ist; hier ist es immer das des Monats.
  const liste = (monate: string[]) =>
    new Intl.ListFormat('de-DE', { type: 'conjunction' }).format(
      monate.map((m) => monatName(m, new Date(Number(m.slice(0, 4)), 0, 1))),
    );
  const drin = sortiert.filter((f) => f.da).map((f) => f.monat);
  const fehlend = sortiert.filter((f) => !f.da).map((f) => f.monat);
  const teil1 =
    drin.length === 1
      ? t('rutsch.serieDrinEins', { monat: liste(drin) })
      : t('rutsch.serieDrinListe', { monate: liste(drin) });
  if (!fehlend.length) return teil1;
  const teil2 =
    fehlend.length === 1
      ? t('unterlage.monatFehlt', { monate: liste(fehlend) })
      : t('unterlage.monateFehlen', { monate: liste(fehlend) });
  return `${teil1} ${teil2}`;
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
  // W48: „erinnert“ nur, wenn es stimmt (in der App, Schalter an, Mitteilungen erlaubt).
  if (ohneDatum(u))
    return t(erinnertJetzt() ? 'person.standOhneDatum' : 'person.standOhneDatumZeigt');
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
/**
 * W48: Ob Hefta wirklich erinnert. Die Quelle setzt der Teil der App, der die Mitteilungen plant
 * (erinnerungen.svelte.ts); bis dahin, und im Browser, gilt „zeigt“ (W10).
 */
let erinnertJetzt: () => boolean = () => false;
export function erinnertQuelleSetzen(quelle: () => boolean): void {
  erinnertJetzt = quelle;
}

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
  if (u.typ.nieInMappe)
    return (anrede.wert === 'du' ? u.typ.nieInMappeSatzDu : u.typ.nieInMappeSatz) ?? '';
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

/**
 * Unterzeile im Blatt des Tabs „Mappe“ (B12b): klein geschrieben, wo es ein Satzanfang wäre
 * („vom 6. Nov.“, „fehlt noch“), Monate bleiben groß („Aug. bis Okt.“). Bei der Bonität mit Prüfcode
 * „prüfbar bis 27. Dez.“.
 */
/**
 * DP45 G4 (K1): „Noch keiner möglich: bisher keine Verträge auf ihren Namen. Steht so in der Mappe.“ Ohne
 * Grund nur „Noch keiner möglich. Steht so in der Mappe.“ Das Fürwort folgt der Bezeichnung; allein „deinen“.
 */
export function keinerText(angabe: BonitaetAngabe, bezeichnung: Bezeichnung, du: boolean): string {
  const grund =
    angabe.grund === 'keine_vertraege'
      ? t(
          du
            ? 'bonitaetWahl.grundDu'
            : bezeichnung === 'weiblich'
              ? 'bonitaetWahl.grundIhren'
              : bezeichnung === 'maennlich'
                ? 'bonitaetWahl.grundSeinen'
                : 'bonitaetWahl.grundNeutral',
        )
      : angabe.grund === 'eigener'
        ? (angabe.text ?? '').trim().replace(/[.!]+$/, '')
        : '';
  return grund ? t('bonitaetWahl.zeileGrund', { grund }) : t('bonitaetWahl.zeileOhne');
}

export function blattText(u: UnterlagenStand, heute = new Date()): string {
  if (u.status === 'fehlt' && !u.typ.serie && !u.veraltet) return t('mappeTab.fehltNoch');
  if (u.neuestesDatum && u.status !== 'bald') {
    const code = pruefcodeStand(u, heute);
    if (code?.art === 'laeuft') return t('mappeTab.pruefbarBis', { am: tagKurzAus(code.am) });
  }
  const s = standText(u, heute);
  return /^(Vom|Fehlt|Fertig|Bald|Zu|Neuer|Ohne|Freiwillig|Da)\b/.test(s)
    ? s.charAt(0).toLowerCase() + s.slice(1)
    : s;
}

/** „Max’ Liste“, „Leas Liste“: Genitiv eines Namens (DP47 G5). */
export function genitiv(name: string): string {
  return /[sßxz]$/i.test(name) ? `${name}’` : `${name}s`;
}

const UND = new Intl.ListFormat('de-DE', { type: 'conjunction' });

/**
 * DP47 G5: Lebenslagen in einer Zeile, „Angestellt, dazu selbstständig oder freiberuflich und in Rente“.
 * Nach „dazu“ klein, außer was mit einem Hauptwort beginnt. Mit einer Lage wie bisher nur ihr Name.
 */
export function lagenText(
  person: Pick<Person, 'lebenssituation' | 'ausbildungArt' | 'weitereLagen'>,
): string | null {
  if (!person.lebenssituation) return null;
  const erste = situationText(person.lebenssituation, person.ausbildungArt);
  const weitere = (person.weitereLagen ?? []).map((l) => {
    const text = situationText(l.situation, l.ausbildungArt);
    // „Miete zahlt eine öffentliche Stelle“ beginnt mit einem Hauptwort und bleibt groß.
    return l.situation === 'leistungsbezug' ? text : text.charAt(0).toLowerCase() + text.slice(1);
  });
  return weitere.length ? t('lagen.kopfDazu', { erste, weitere: UND.format(weitere) }) : erste;
}

/**
 * DP47 G5: Hat die Person mehr als eine Lage, steht vor dem Stand eines Einkommensnachweises seine Lage:
 * „Angestellt. August bis Oktober“. Mit einer Lage bleibt alles wie bisher.
 */
export function mitLage(u: UnterlagenStand, text: string): string {
  if (!u.lage) return text;
  // L4: Bei zwei Arbeitgebern nennt die Zeile den Arbeitgeber; ohne Angabe „Noch ein Arbeitgeber“.
  const vorn = u.lage.mitArbeitgeber
    ? u.lage.arbeitgeber ||
      (u.typ.basis ? t('lagen.nochArbeitgeberKurz') : situationText(u.lage.situation, u.lage.art))
    : situationText(u.lage.situation, u.lage.art);
  // Nach dem Punkt groß, auch wo der Stand sonst klein beginnt („fehlt noch“ im Blatt).
  return `${vorn}. ${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}
