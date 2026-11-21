// Erinnerungen in der App (Zeile 9): Nach jedem Laden plant Hefta die Mitteilungen neu, aus dem, was gerade
// gilt. In der App unter iOS und Android; im Web gibt es keine (ohne Server keine Mitteilungen, Bericht 61).
import { erinnerungenPlanen, erinnerungsNummer, type Erinnerung } from '../domain/erinnerungen';
import { heftTitel } from '../domain/heftKarte';
import type { Heft } from '../domain/modell';
import { t, tagText } from '../i18n';
import { haushaltSchein } from '../domain/haushaltUnterlagen';
import { uhrzeit } from '../ui/terminWorte';
import type { HaushaltAnsicht } from '../storage/speicher';
import type { Einstellungen } from '../domain/modell';
import { istApp } from './plattform';
import type { ZuAltUnterlage } from '../domain/erinnerungen';
import { personStand } from '../domain/regelkatalog';
import { erinnertQuelleSetzen } from '../ui/texte';
import { zuAltWortlaut } from '../ui/zuAltWortlaut';
import { daten } from './daten.svelte';
import { erinnertWirklich } from '../ui/erinnertWort';

/** W48: Sagt Hefta hier „erinnert“? Nur in der App, mit Schalter an und erlaubten Mitteilungen. */
export function erinnert(): boolean {
  return erinnertWirklich({
    app: istApp(),
    einstellungen: daten.einstellungen,
    erlaubt: mitteilungen.erlaubt,
  });
}
erinnertQuelleSetzen(erinnert);

/** Ob das System Mitteilungen erlaubt; null, solange Hefta nicht gefragt hat. */
export const mitteilungen = $state<{ erlaubt: boolean | null }>({ erlaubt: null });

export function erinnerungenMoeglich(): boolean {
  return istApp();
}

/**
 * Zeigen die Einstellungen die Schalter für Erinnerungen? In der App immer. Browsertests schalten den
 * Abschnitt mit `__heftaErinnerungenTest` an, um sein Aussehen zu prüfen (wie `__heftaEmpfangTest`); geplant
 * wird dabei nichts, das prüft weiter `erinnerungenMoeglich`.
 */
export function erinnerungenZeigen(): boolean {
  return (
    erinnerungenMoeglich() ||
    (globalThis as { __heftaErinnerungenTest?: boolean }).__heftaErinnerungenTest === true
  );
}

const MONATE = new Intl.DateTimeFormat('de-DE', { month: 'long' });

function wortlaut(
  e: Erinnerung,
  hefte: Heft[],
  ansicht: HaushaltAnsicht | null,
): { titel: string; text: string } {
  const heft = e.heftId ? hefte.find((h) => h.id === e.heftId) : undefined;
  const titel = heft ? heftTitel(heft).text : '';
  const uhr = heft?.ereignisse.termin ? uhrzeit(heft.ereignisse.termin.am) : '';
  switch (e.art) {
    case 'vorabend':
      return {
        titel: t('erinnerung.vorabendTitel'),
        text: t('erinnerung.terminText', { titel, uhr }),
      };
    case 'bald':
      return { titel: t('erinnerung.baldTitel'), text: t('erinnerung.terminText', { titel, uhr }) };
    case 'keineAntwort':
      return {
        titel: t('erinnerung.keineAntwortTitel'),
        text: t('erinnerung.keineAntwortText', { titel }),
      };
    case 'gehalt': {
      const p = ansicht?.mitglieder.find((m) => m.person.id === e.personId)?.person;
      const [j, m] = (e.monat ?? '').split('-').map(Number);
      const monat = j && m ? MONATE.format(new Date(j, m - 1, 1)) : '';
      return {
        titel: t('erinnerung.gehaltTitel'),
        text: t('erinnerung.gehaltText', { name: p?.rufname || p?.vorname || '', monat }),
      };
    }
    case 'wbs':
      return {
        titel: t('erinnerung.wbsTitel'),
        text: t('erinnerung.wbsText', { datum: e.gueltigBis ? tagText(e.gueltigBis) : '' }),
      };
    case 'zuAlt': {
      const p = ansicht?.mitglieder.find((m) => m.person.id === e.personId)?.person;
      return zuAltWortlaut(
        p?.rufname || p?.vorname || '',
        (e.unterlagen ?? []).map((u) => ({ ...u, name: typNamen.get(u.typId) ?? u.typId })),
      );
    }
  }
}

/** Wer einen Gehaltsnachweis in Hefta hat: für „Neue Monate und Ablauf von Unterlagen“ (PC62). */
function gehaltsPersonen(ansicht: HaushaltAnsicht | null) {
  if (!ansicht) return [];
  const aktive = ansicht.mitglieder.filter((m) => !m.zugehoerigkeit.herausgenommenAm);
  return aktive
    .filter((m) =>
      ansicht.dokumente.some((d) => d.personId === m.person.id && d.typ === 'gehaltsnachweis'),
    )
    .map((m) => ({ personId: m.person.id, meist: m.person.abrechnungMeist }));
}

const WEICH = String.fromCharCode(0xad);
/** W48: Namen der Unterlagen für die Mitteilung, beim Sammeln gefüllt. */
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- nur ein Zwischenspeicher für den Wortlaut, nichts zeigt ihn an
const typNamen = new Map<string, string>();

/**
 * W48: Unterlagen mit Datum, die zu alt werden können, für alle im Haushalt. Serien (Gehalt) haben ihre eigene
 * Erinnerung. Gezählt wird jede Unterlage mit Datum und einer Grenze, ab der sie zu alt ist.
 */
function zuAltUnterlagen(ansicht: HaushaltAnsicht | null, heute: Date): ZuAltUnterlage[] {
  if (!ansicht) return [];
  const liste: ZuAltUnterlage[] = [];
  for (const m of ansicht.mitglieder) {
    if (m.zugehoerigkeit.herausgenommenAm) continue;
    const s = personStand(m.person, m.zugehoerigkeit, ansicht.dokumente, ansicht.versionen, heute);
    for (const u of s.pfad) {
      const f = u.typ.fristen;
      if (u.typ.serie || !u.neuestesDatum || f?.warnungTage === undefined) continue;
      // Kurz wie in der App („Mietzahlungen“), ohne weiche Trennstriche: Die Mitteilung trennt das Gerät.
      typNamen.set(u.typ.id, (u.typ.textKurz ?? u.typ.text).replaceAll(WEICH, ''));
      liste.push({
        personId: m.person.id,
        typId: u.typ.id,
        datum: u.neuestesDatum,
        warnungTage: f.warnungTage,
      });
    }
  }
  return liste;
}

let letzterPlan = '';

export async function erinnerungenAbgleichen(d: {
  hefte: Heft[];
  ansicht: HaushaltAnsicht | null;
  einstellungen: Einstellungen | null;
}): Promise<void> {
  if (!erinnerungenMoeglich()) return;
  const liste = erinnerungenPlanen({
    hefte: d.hefte,
    gehalt: gehaltsPersonen(d.ansicht),
    besichtigungenAn: d.einstellungen?.erinnerungBesichtigungen !== false,
    gehaltAn: d.einstellungen?.erinnerungGehalt !== false,
    zuAltAn: d.einstellungen?.erinnerungZuAlt !== false,
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- nur ein Zeitpunkt für die Rechnung
    zuAlt: zuAltUnterlagen(d.ansicht, new Date()),
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- nur ein Zeitpunkt für die Rechnung
    jetzt: new Date(),
    wbsGueltigBis:
      haushaltSchein(d.ansicht?.haushaltDokumente, d.ansicht?.versionen ?? [], 'wbs')?.version.wbs
        ?.gueltigBis ?? null,
  }).map((e) => ({
    nummer: erinnerungsNummer(e.schluessel),
    am: e.am.getTime(),
    ziel: e.ziel,
    ...wortlaut(e, d.hefte, d.ansicht),
  }));
  // Nur, wenn sich etwas geändert hat: Jedes Laden der Daten ruft hierher.
  const plan = JSON.stringify(liste);
  if (plan === letzterPlan) return;
  letzterPlan = plan;
  try {
    const { HeftaNativ } = await import('./heftaNativ');
    const { erlaubt } = await HeftaNativ.erinnerungenSetzen({ liste });
    mitteilungen.erlaubt = erlaubt;
  } catch {
    letzterPlan = '';
  }
}
