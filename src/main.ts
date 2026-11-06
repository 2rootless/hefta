import { mount } from 'svelte';
import App from './app/App.svelte';
import './app/global.css';
import { themaFolgen } from './app/theme';
import { serviceWorkerAnmelden } from './app/update.svelte';
import { wacheStarten } from './app/wache';

wacheStarten();
themaFolgen();

const ziel = document.getElementById('app');
if (!ziel) throw new Error('#app fehlt');
mount(App, { target: ziel });

void serviceWorkerAnmelden();
