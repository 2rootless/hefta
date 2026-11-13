// Erinnerungen in der App (Zeile 9): Nach jedem Laden plant Hefta die Mitteilungen neu, aus dem, was gerade
// gilt. Bisher nur unter iOS; unter Android und im Web gibt es keine (Web ohne Server: Bericht 61).
import { erinnerungenPlanen, erinnerungsNummer, type Erinnerung } from '../domain/erinnerungen';
import { heftTitel } from '../domain/heftKarte';
import type { Heft } from '../domain/modell';
import { t } from '../i18n';
import { uhrzeit } from '../ui/terminWorte';
import type { HaushaltAnsicht } from '../storage/speicher';
import type { Einstellungen } from '../domain/modell';
import { istIosApp } from './plattform';

/** Ob das System Mitteilungen erlaubt; null, solange Hefta nicht gefragt hat. */
export const mitteilungen = $state<{ erlaubt: boolean | null }>({ erlaubt: null });

export function erinnerungenMoeglich(): boolean {
  return istIosApp();
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
  }
}

/** Wer einen Gehaltsnachweis in Hefta hat: für „Neuer Monat beim Gehaltsnachweis“. */
function gehaltsPersonen(ansicht: HaushaltAnsicht | null) {
  if (!ansicht) return [];
  const aktive = ansicht.mitglieder.filter((m) => !m.zugehoerigkeit.herausgenommenAm);
  return aktive
    .filter((m) =>
      ansicht.dokumente.some((d) => d.personId === m.person.id && d.typ === 'gehaltsnachweis'),
    )
    .map((m) => ({ personId: m.person.id, meist: m.person.abrechnungMeist }));
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
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- nur ein Zeitpunkt für die Rechnung
    jetzt: new Date(),
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
