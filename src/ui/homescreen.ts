import type { Einstellungen } from '../domain/modell';
import { istApp } from '../app/plattform';

// Homescreen-Anleitung (G4b): nur in Safari auf dem iPhone und nur, wenn Hefta nicht schon vom
// Homescreen läuft. „Später“ fragt höchstens noch einmal, beim ersten fertigen Haushalt.

function iphoneSafari(): boolean {
  if (istApp()) return false; // Die App ist schon auf dem Homescreen.
  const ua = navigator.userAgent;
  return /iPhone|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function vomHomescreen(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * E30: Seit Hefta im App Store ist, empfiehlt die Seite am iPhone in Safari die App statt des
 * Home-Bildschirms. „Weiter im Browser“ bleibt offen.
 */
export function appEmpfehlen(): boolean {
  return iphoneSafari() && !vomHomescreen();
}

/** Vor der Einrichtung: Bisher nicht beantwortet? */
export function homescreenFragen(e: Einstellungen | null): boolean {
  return (
    iphoneSafari() && !vomHomescreen() && !e?.homescreenHinweisGezeigt && !e?.homescreenSpaeter
  );
}

/** Nach der Einrichtung: einmal „Später“ gesagt, noch nicht wieder gefragt? */
export function homescreenNochmal(e: Einstellungen | null): boolean {
  return (
    iphoneSafari() && !vomHomescreen() && !e?.homescreenHinweisGezeigt && !!e?.homescreenSpaeter
  );
}
