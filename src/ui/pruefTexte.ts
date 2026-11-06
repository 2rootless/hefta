import type { Pruefhinweis } from '../domain/pruefhinweise';
import { listenText, ohneTrennstellen } from '../domain/regelkatalog';
import { monatName, t, tagText, zahlwort } from '../i18n';
import { monatJahr } from './versionInfo';

// Wortlaute der Prüfhinweise (design/nachtraeglich-ordnen.md, Abschnitt 6): immer als Frage, mit dem,
// was Hefta gesehen hat. `kurz` steht als Unterzeile, der Satz im Kasten, die Fundstelle in Fett.

export type PruefKnopf =
  | { art: 'link'; text: string; href: string }
  | { art: 'tun'; text: string }
  | { art: 'hochladen'; text: string }
  | { art: 'warum'; text: string };

export interface PruefAnzeige {
  kurz: string;
  satz: { text: string; fett?: boolean }[];
  knopf: PruefKnopf;
}

const fett = (text: string) => ({ text, fett: true });
const normal = (text: string) => ({ text });

/** `aufMonatsSeite`: Der Titel sagt schon, welcher Monat gemeint ist; auf der Seite der Serie nicht. */
export function pruefAnzeige(
  h: Pruefhinweis,
  rufname: string,
  aufMonatsSeite = false,
): PruefAnzeige {
  const basis = `#/unterlage/${h.personId}/${h.typ.id}`;
  const seiten = `${basis}/version/${h.version.id}/seiten`;
  const anderswo = h.anderswo
    ? t('mappe.unlesbarName', {
        unterlage: ohneTrennstellen(listenText(h.anderswo.typ)),
        name: h.anderswo.name,
      })
    : '';
  const beiMonat = h.version.abrechnungsmonat ? monatJahr(h.version.abrechnungsmonat) : '';
  const aufSeite = (monat: string) =>
    aufMonatsSeite
      ? [normal(t('pruef.aufDerSeite')), fett(`„${monatJahr(monat)}“`)]
      : [
          normal(t('pruef.bei')),
          fett(beiMonat),
          normal(t('pruef.stehtAufSeite')),
          fett(`„${monatJahr(monat)}“`),
        ];
  switch (h.art) {
    case 'datei':
      if (h.gruppe) {
        const monate = new Intl.ListFormat('de-DE', { type: 'conjunction' }).format(
          h.gruppe
            .map((v) => v.abrechnungsmonat ?? '')
            .sort()
            .map((m) => monatName(m)),
        );
        return {
          kurz: t('pruef.dateiMonate', { zahl: zahlwort(h.gruppe.length) }),
          satz: [fett(monate), normal(t('pruef.dateiMonateNach'))],
          knopf: { art: 'link', text: t('unterlage.aufteilen'), href: `${basis}/aufteilen` },
        };
      }
      return {
        kurz: t('pruef.dateiAnderswoKurz', { stelle: anderswo }),
        satz: [
          normal(t('pruef.dateiAnderswoVor')),
          fett(anderswo),
          normal(t('pruef.dateiAnderswoNach')),
        ],
        knopf: { art: 'tun', text: t('pruef.hierLoeschen') },
      };
    case 'seite':
      return {
        kurz: t('pruef.seiteKurz'),
        satz: [
          normal(t('pruef.seiteVor', { nummer: (h.seite ?? 0) + 1 })),
          fett(anderswo),
          normal(t('pruef.seiteNach')),
        ],
        knopf: { art: 'link', text: t('seiten.titel'), href: seiten },
      };
    case 'monat': {
      const monat = h.monat!;
      return {
        kurz: t('pruef.monatKurz', { bei: beiMonat, monat: monatJahr(monat) }),
        satz: [...aufSeite(monat), normal(t('pruef.monatNach', { monat: monatName(monat) }))],
        knopf: { art: 'tun', text: t('pruef.monatKnopf', { monat: monatName(monat) }) },
      };
    }
    case 'monatDoppelt': {
      const monat = h.monat!;
      return {
        kurz: t('pruef.monatKurz', { bei: beiMonat, monat: monatJahr(monat) }),
        satz: [...aufSeite(monat), normal(t('pruef.doppeltNach', { monat: monatName(monat) }))],
        knopf: {
          art: 'link',
          text: t('pruef.doppeltKnopf', { monat: monatName(h.version.abrechnungsmonat ?? monat) }),
          href: `${basis}/version/${h.version.id}`,
        },
      };
    }
    case 'name':
      return {
        kurz: t('pruef.nameKurz', { name: h.person!.voll }),
        satz: [
          normal(t('pruef.aufDemDokument')),
          fett(h.person!.voll),
          normal(t('pruef.nameNach', { eigen: rufname, name: h.person!.rufname })),
        ],
        knopf: { art: 'tun', text: t('pruef.nameKnopf', { name: h.person!.rufname }) },
      };
    case 'nameFehlt':
      return {
        kurz: t('pruef.nameFehltKurz', { name: h.nachname! }),
        satz: [
          normal(t('pruef.nameFehltVor')),
          fett(h.nachname!),
          normal(t('pruef.nameFehltNach', { eigen: rufname })),
        ],
        knopf: {
          art: 'link',
          text: t('pruef.nameFehltKnopf'),
          href: `${basis}/version/${h.version.id}`,
        },
      };
    case 'seiteFehlt': {
      const [n, gesamt] = h.von!;
      const fund = t('pruef.vonFund', { n, gesamt });
      return {
        kurz: t('pruef.fehltKurz', { fund }),
        satz: [
          normal(t('pruef.aufDerSeite')),
          fett(`„${fund}“`),
          normal(gesamt === 2 ? t('pruef.fehltZweite') : t('pruef.fehltEine')),
        ],
        knopf: { art: 'hochladen', text: t('pruef.fehltKnopf') },
      };
    }
    case 'leer':
      return {
        kurz: t('pruef.leerKurz', { nummer: (h.seite ?? 0) + 1 }),
        satz: [
          fett(t('pruef.leerKurz', { nummer: (h.seite ?? 0) + 1 })),
          normal(t('pruef.leerNach')),
        ],
        knopf: { art: 'tun', text: t('seiten.nichtInMappe') },
      };
    case 'art':
      return {
        kurz: t('pruef.artKurz', { wort: h.anzeige! }),
        satz: [
          normal(t('pruef.aufDemDokument')),
          fett(`„${h.anzeige!}“`),
          normal(t('pruef.artNach', { hinweis: h.hinweis! })),
        ],
        knopf: { art: 'warum', text: t('unterlage.warum') },
      };
    case 'datum':
      return {
        kurz: h.datum === 'zukunft' ? t('pruef.datumZukunftKurz') : t('pruef.datumAltKurz'),
        satz: [
          normal(t('pruef.datumVor')),
          fett(tagText(h.version.ausstellungsdatum!)),
          normal(h.datum === 'zukunft' ? t('pruef.datumZukunftNach') : t('pruef.datumAltNach')),
        ],
        knopf: {
          art: 'link',
          text: t('pruef.datumKnopf'),
          href: `${basis}/datum/${h.version.id}`,
        },
      };
  }
}
