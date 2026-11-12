// „In den Kalender“ (Zeile 9): die Besichtigung eines Hefts in den Kalender des Geräts. Hefta trägt nichts
// selbst ein. Auf dem iPhone öffnet sich das Kalenderfenster von iOS, gesichert wird dort. Unter Android
// geht die .ics-Datei an das Teilen-Blatt (die Kalender-App nimmt sie an), im Browser ist sie ein Download.
import { besichtigungTermin, icsErzeugen } from '../domain/kalender';
import type { Heft } from '../domain/modell';
import { appTeilen, istApp, istIosApp } from '../app/plattform';

export type KalenderAntwort = 'gesichert' | 'abgebrochen' | 'nicht_erlaubt' | 'datei';

/** Name der Datei: ohne Umlaute und Satzzeichen, damit jedes System sie annimmt. */
export function kalenderDateiname(titel: string): string {
  const kurz = titel
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `Besichtigung${kurz ? `-${kurz}` : ''}.ics`;
}

export async function inDenKalender(heft: Heft, titel: string): Promise<KalenderAntwort> {
  const termin = heft.ereignisse.termin;
  if (!termin) return 'abgebrochen';
  const t = besichtigungTermin({ id: heft.id, titel, adresse: heft.adresse, termin });
  if (istIosApp()) {
    const { HeftaNativ } = await import('../app/heftaNativ');
    const a = await HeftaNativ.termin({
      titel: t.titel,
      start: new Date(termin.am).getTime(),
      dauerMin: t.dauerMin ?? 30,
      vorherMin: t.vorherMin ?? 60,
      ort: t.ort || undefined,
      notiz: t.text || undefined,
    });
    if (!a.erlaubt) return 'nicht_erlaubt';
    return a.gesichert ? 'gesichert' : 'abgebrochen';
  }
  const datei = new File([icsErzeugen([t])], kalenderDateiname(titel), {
    type: 'text/calendar',
  });
  if (istApp()) return (await appTeilen([datei])) ? 'datei' : 'abgebrochen';
  const url = URL.createObjectURL(datei);
  const a = document.createElement('a');
  a.href = url;
  a.download = datei.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'datei';
}
