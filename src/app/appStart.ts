import { App } from '@capacitor/app';
import { gehe } from './daten.svelte';
import { eingang } from './eingang.svelte';
import { HeftaNativ } from './heftaNativ';
import { ablageLeeren, appDateiLesen } from './plattform';
import { geteiltOeffnen } from '../ui/neuesHeft.svelte';

// Nur in der App: Zurück-Knopf von Android, PDFs, die andere Apps an Hefta schicken, und Inserate, die eine
// Portal-App an Hefta teilt (E81: `hefta://teilen?link=…` von der Erweiterung HeftaTeilen).

function adresseOeffnen(url: string | undefined) {
  if (!url) return;
  try {
    const u = new URL(url);
    if (u.protocol !== 'hefta:' || u.hostname !== 'teilen') return;
    const link = u.searchParams.get('link');
    if (link && /^https?:\/\//.test(link)) geteiltOeffnen(link);
  } catch {
    // keine gültige Adresse: nichts tun
  }
}

function zurueck() {
  // Ein offenes Blatt oder die Seitenansicht zuerst schließen.
  const offen = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1);
  if (offen) {
    offen.close();
    return;
  }
  const pfad = window.location.hash.replace(/^#/, '');
  // Reiter sind Wurzeln (Auftraggeber 13.11.): Auf „Mappe“ und „Wohnungen“ schließt die Taste die App.
  if (pfad === '' || pfad === '/' || pfad === '/wohnungen' || pfad === '/mappe-start')
    void App.minimizeApp();
  else if (window.history.length > 1) window.history.back();
  else gehe('/');
}

export async function appStarten(): Promise<void> {
  await App.addListener('backButton', zurueck);
  await App.addListener('appUrlOpen', ({ url }) => adresseOeffnen(url));
  adresseOeffnen((await App.getLaunchUrl())?.url);
  await HeftaNativ.addListener('eingang', ({ dateien }) => {
    void Promise.all(dateien.map((d) => appDateiLesen(d.uri, d.name))).then((gelesen) => {
      eingang.dateien = gelesen;
      gehe('/eingang');
    });
  });
  // Tipp auf eine Erinnerung (Zeile 9): an die Stelle, um die es geht.
  await HeftaNativ.addListener('erinnerung', ({ ziel }) => ziel && gehe(ziel));
  await ablageLeeren();
}
