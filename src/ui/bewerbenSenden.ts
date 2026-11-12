// Was beim Bewerben hinausgeht (Zeile 8): Hefta verschickt nichts selbst. Es öffnet die Mail mit Mappe,
// kopiert Text, teilt die Mappe oder öffnet die Website, und sagt danach, ob es sicher weiß, dass etwas
// hinausging. Sicher nur, wenn das System „gesendet“ meldet (Mailfenster unter iOS, 09b).
import { ablageLeeren, ablegen, appTeilen, istApp, istIosApp } from '../app/plattform';
import { mailLink } from '../domain/nachricht';
import { sichern } from './mappeErstellen';

export type Gesendet = 'gesendet' | 'geoeffnet' | 'abgebrochen' | 'anhangSelbst';

/** Mail mit Mappe: im Mailfenster mit Anhang, sonst über das Teilen-Blatt oder einen Mail-Link. */
export async function mailMitMappe(o: {
  an: string | null;
  betreff: string;
  text: string;
  dateien: File[];
}): Promise<Gesendet> {
  if (istIosApp()) {
    // Das eigene Mailfenster: Meldet es „gesendet“, weiß Hefta es sicher (Planung 09b).
    await ablageLeeren();
    const anhaenge = [];
    for (const d of o.dateien)
      anhaenge.push({ uri: await ablegen(d), name: d.name, typ: d.type || 'application/pdf' });
    const { HeftaNativ } = await import('../app/heftaNativ');
    const { status } = await HeftaNativ.mail({
      an: o.an ?? undefined,
      betreff: o.betreff,
      text: o.text,
      anhaenge,
    });
    if (status === 'gesendet') return 'gesendet';
    if (status === 'abgebrochen') return 'abgebrochen';
    // Als Entwurf gesichert oder fehlgeschlagen: geöffnet, aber nicht sicher hinaus.
    if (status !== 'keinKonto') return 'geoeffnet';
    // Keine Apple-Mail: das Teilen-Blatt mit Betreff, sonst nimmt die Mail-App den Dateinamen.
    const { geteilt } = await HeftaNativ.teilen({
      dateien: anhaenge.map((a) => a.uri),
      text: o.text,
      betreff: o.betreff,
    });
    return geteilt ? 'geoeffnet' : 'abgebrochen';
  }
  // Ohne Mailkonto, in einer anderen Mail-App, auf Android: das Teilen-Blatt, der Stand bleibt unsicher.
  if (istApp()) return (await appTeilen(o.dateien, o.text)) ? 'geoeffnet' : 'abgebrochen';
  // Ein Mail-Link trägt keinen Anhang: Das Teilen-Blatt kann beides, ohne Titel (sonst legt iOS eine
  // Textdatei bei).
  if (navigator.canShare?.({ files: o.dateien, text: o.text })) {
    try {
      await navigator.share({ files: o.dateien, text: o.text });
      return 'geoeffnet';
    } catch {
      return 'abgebrochen';
    }
  }
  sichern(o.dateien);
  window.location.href = mailLink(o.an, o.betreff, o.text);
  return 'anhangSelbst';
}

/** Die Mappe teilen, ohne Text (Portal, Website). */
export async function mappeTeilen(dateien: File[]): Promise<boolean> {
  if (istApp()) return appTeilen(dateien);
  if (navigator.canShare?.({ files: dateien })) {
    try {
      await navigator.share({ files: dateien });
      return true;
    } catch {
      return false;
    }
  }
  sichern(dateien);
  return true;
}

export async function textKopieren(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
