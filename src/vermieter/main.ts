import { mount } from 'svelte';
import '../app/global.css';
import './vermieter.css';
import Seite from './Seite.svelte';

const ziel = document.getElementById('app');
if (!ziel) throw new Error('#app fehlt');
mount(Seite, { target: ziel });
