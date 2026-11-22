import { t, zahlwort } from '../i18n';
import { alterGrenze } from './texte';

const TAG_MONAT = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' });

/** W48: „Bonitätsnachweis, dann Mietzahlungen“; bei drei und mehr „…, dann A und B“. */
function reihe(namen: string[]): { erste: string; rest: string } {
  const [erste = '', ...rest] = namen;
  const letzte = rest.pop();
  return {
    erste,
    rest: rest.length ? `${rest.join(', ')} ${t('erinnerung.und')} ${letzte}` : (letzte ?? ''),
  };
}

/**
 * W48 (Design): Titel und Zeile der Mitteilung. Für ihr und du gleich, denn ein Tipp öffnet sie ohnehin.
 * Die Zahl steht als Wort bis zwölf, danach als Ziffer; die Grenze kommt aus derselben Stelle wie in der App.
 */
export function zuAltWortlaut(
  name: string,
  unterlagen: { name: string; ab: Date; warnungTage: number }[],
): { titel: string; text: string } {
  const [erste] = unterlagen;
  const datum = erste ? TAG_MONAT.format(erste.ab) : '';
  if (unterlagen.length === 1 && erste)
    return {
      // DP118: Der Titel ist kurz, damit iOS ihn nicht kürzt; der Name steht in der Zeile.
      titel: t('erinnerung.zuAltTitel', { unterlage: erste.name }),
      text: t('erinnerung.zuAltText', {
        name,
        datum,
        grenze: alterGrenze({ typ: { fristen: { warnungTage: erste.warnungTage } } } as never),
      }),
    };
  const zahl = zahlwort(unterlagen.length);
  return {
    titel: t('erinnerung.zuAltMehrTitel', {
      zahl: zahl.charAt(0).toUpperCase() + zahl.slice(1),
      name,
    }),
    text: t('erinnerung.zuAltMehrText', { datum, ...reihe(unterlagen.map((u) => u.name)) }),
  };
}
