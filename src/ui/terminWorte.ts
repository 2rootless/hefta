// Wörter zur Nähe eines Termins (B25, wortlaute-B25.md): das Wort im Reiter der Terminkarte, dasselbe in
// den Zeilen der Übersicht (Planung 12w), und der ganze Satz für Vorlesehilfen.
import { terminKurz } from '../domain/heftKarte';
import { terminNaehe, type Naehe } from '../domain/terminNaehe';
import { t } from '../i18n';

const monatName = new Intl.DateTimeFormat('de-DE', { month: 'long' });
const tagName = new Intl.DateTimeFormat('de-DE', { weekday: 'long' });

/** „heute“, „nächste Woche“, „in 3 Wochen“, „im Dezember 2027“ (klein; den Reiter setzt CSS groß). */
export function naeheWort(n: Naehe): string {
  switch (n.wort) {
    case 'inWochen':
      return t('naehe.inWochen', { n: n.wochen });
    case 'monat': {
      const monat = monatName.format(new Date(2026, n.monat, 1));
      // Das Jahr als Text: Als Zahl setzte i18n einen Tausenderpunkt („2.027“).
      return n.jahr
        ? t('naehe.monatJahr', { monat, jahr: String(n.jahr) })
        : t('naehe.monat', { monat });
    }
    default:
      return t(`naehe.${n.wort}`);
  }
}

/** „17:30“ oder leer, wenn der Termin keine Uhrzeit hat (Mitternacht, aus Version 1). */
export function uhrzeit(am: string): string {
  const d = new Date(am);
  if (!d.getHours() && !d.getMinutes()) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Der ganze Satz nach Nachricht j: „Dienstag nächster Woche, 17:30“, „war am Di, 10. Nov.“. */
export function terminSatz(am: string, jetzt: Date): string {
  const n = terminNaehe(am, jetzt);
  const zeit = uhrzeit(am);
  const d = new Date(am);
  const tag = tagName.format(d);
  let datum = terminKurz(am, false);
  if (n.wort === 'monat' && n.jahr) datum = `${datum} ${n.jahr}`;
  const satz = (() => {
    switch (n.wort) {
      case 'vorbei':
        return n.heute ? t('naehe.satzVorbeiHeute', { zeit }) : t('naehe.satzVorbei', { datum });
      case 'heute':
        return t('naehe.satzHeute', { zeit });
      case 'morgen':
        return t('naehe.satzMorgen', { zeit });
      case 'dieseWoche':
        return t('naehe.satzDieseWoche', { tag, zeit });
      case 'naechsteWoche':
        return t('naehe.satzNaechsteWoche', { tag, zeit });
      default:
        return t('naehe.satzSpaeter', { datum, zeit });
    }
  })();
  // Ohne Uhrzeit fällt „, 17:30“ weg.
  return zeit ? satz : satz.replace(/,\s*$/, '');
}
