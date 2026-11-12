import { mount } from 'svelte';
import App from './app/App.svelte';
import './app/global.css';
import { themaFolgen } from './app/theme';
import { istApp } from './app/plattform';
import { serviceWorkerAnmelden } from './app/update.svelte';
import { wacheStarten } from './app/wache';

wacheStarten();
themaFolgen();

const ziel = document.getElementById('app');
if (!ziel) throw new Error('#app fehlt');
mount(App, { target: ziel });

// In der App kommt alles aus dem App-Paket; Updates laufen über den Store, nicht den Service Worker.
if (istApp()) void import('./app/appStart').then((m) => m.appStarten());
else void serviceWorkerAnmelden();

// Browsertests mit nachgestelltem App-Weg (`__heftaInseratTest`) übergeben so ein geteiltes Inserat (E81).
const fenster = window as unknown as { __heftaInseratTest?: unknown; __heftaTeilen?: unknown };
if (fenster.__heftaInseratTest)
  void import('./ui/neuesHeft.svelte').then((m) => (fenster.__heftaTeilen = m.geteiltOeffnen));
