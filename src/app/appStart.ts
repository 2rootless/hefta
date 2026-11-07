import { App } from '@capacitor/app';
import { gehe } from './daten.svelte';
import { eingang } from './eingang.svelte';
import { HeftaNativ } from './heftaNativ';
import { ablageLeeren, appDateiLesen } from './plattform';

// Nur in der App: Zurück-Knopf von Android und PDFs, die andere Apps an Hefta schicken.

function zurueck() {
  // Ein offenes Blatt oder die Seitenansicht zuerst schließen.
  const offen = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1);
  if (offen) {
    offen.close();
    return;
  }
  const pfad = window.location.hash.replace(/^#/, '');
  if (pfad === '' || pfad === '/') void App.minimizeApp();
  else if (window.history.length > 1) window.history.back();
  else gehe('/');
}

export async function appStarten(): Promise<void> {
  await App.addListener('backButton', zurueck);
  await HeftaNativ.addListener('eingang', ({ dateien }) => {
    void Promise.all(dateien.map((d) => appDateiLesen(d.uri, d.name))).then((gelesen) => {
      eingang.dateien = gelesen;
      gehe('/eingang');
    });
  });
  await ablageLeeren();
}
