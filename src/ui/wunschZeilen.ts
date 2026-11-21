// Die Wünsche eines Haushalts in Kurzform für die Einstellungen (DP50 Punkt 10, Reiter „Hefte“): je Wunsch
// Titel und Wert, etwa „Warmmiete“ und „bis 1.400 €“. Ohne Wert steht dort „nicht festgelegt“. Ändern geht
// auf der Seite der Wünsche (dieselben Bausteine wie beim Einstieg).
import type { Wuensche } from '../domain/urteile';
import { t } from '../i18n';

const NB = ' ';

const zahlText = (n: number) =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(n);

/** „1. März 2027“ ohne Trennung zwischen Tag und Monat (C23). */
const tag = (d: string, mitJahr = true) =>
  new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'short',
    ...(mitJahr ? { year: 'numeric' } : {}),
  })
    .format(new Date(`${d}T12:00`))
    .replace(/(\d\.)\s/g, `$1${NB}`);

export interface WunschZeile {
  titel: string;
  /** Kurzform; null heißt „nicht festgelegt“. */
  wert: string | null;
}

export function wunschZeilen(wu: Partial<Wuensche> | null): WunschZeile[] {
  const w = wu ?? {};
  let einzug: string | null = null;
  if (w.einzugVon && w.einzugBis) {
    // Im selben Jahr steht das Jahr nur einmal (E84.4).
    const gleich = w.einzugVon.slice(0, 4) === w.einzugBis.slice(0, 4);
    einzug = t('wuensche.einzugVonBis', {
      von: tag(w.einzugVon, !gleich),
      bis: tag(w.einzugBis),
    });
  } else if (w.einzugVon) einzug = t('wuensche.einzugAb', { von: tag(w.einzugVon) });
  else if (w.einzugBis) einzug = t('wuensche.einzugBis', { bis: tag(w.einzugBis) });
  return [
    {
      titel: t('wuensche.warmName'),
      wert:
        w.warmBis != null
          ? t('einstellungen.warmBis', { betrag: `${zahlText(w.warmBis)}${NB}€` })
          : null,
    },
    {
      titel: t('wuensche.zimmer'),
      wert: w.zimmerAb != null ? t('einstellungen.zimmerAb', { zahl: zahlText(w.zimmerAb) }) : null,
    },
    {
      titel: t('wuensche.flaeche'),
      wert:
        w.flaecheAb != null ? t('einstellungen.flaecheAb', { zahl: zahlText(w.flaecheAb) }) : null,
    },
    {
      titel: t('wuensche.weg'),
      wert: w.ort
        ? t('einstellungen.wegWert', { ort: w.ort.name, km: zahlText(w.ort.kmBis) })
        : null,
    },
    { titel: t('wuensche.einzug'), wert: einzug },
  ];
}
