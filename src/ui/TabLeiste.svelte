<script lang="ts">
  // Hefta 2: die zwei Tabs unten (B12, B17a). „Wohnungen“ und „Mappe“; Einstellungen haben keine
  // Tab-Leiste (B12c). Ihre Höhe steht als --tabs-hoehe an der Wurzel: Die Aktionsleiste sitzt darüber,
  // und Seiten halten unten so viel Platz frei.
  import { daten } from '../app/daten.svelte';
  import { t } from '../i18n';
  import Symbol from './Symbol.svelte';

  let { aktiv }: { aktiv: 'wohnungen' | 'mappe' } = $props();

  // Ohne Haushalt zeigt „Mappe“ eine ruhige Startseite (B26, E93); erst ihr Knopf startet das Anlegen.
  const mappeZiel = $derived(daten.ansicht ? '#/' : '#/mappe-start');

  let leiste = $state<HTMLElement>();
  $effect(() => {
    const element = leiste;
    if (!element) return;
    const wurzel = document.documentElement.style;
    const messen = () => wurzel.setProperty('--tabs-hoehe', `${element.offsetHeight}px`);
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(element);
    messen();
    wurzel.setProperty('--leiste-sicher', '0px');
    return () => {
      beobachter.disconnect();
      wurzel.removeProperty('--tabs-hoehe');
      wurzel.removeProperty('--leiste-sicher');
    };
  });
</script>

<nav class="tabs" aria-label={t('tabs.bereiche')} bind:this={leiste}>
  <a href="#/wohnungen" aria-current={aktiv === 'wohnungen' ? 'page' : undefined}>
    <Symbol name="wohnung" groesse={24} />{t('tabs.wohnungen')}
  </a>
  <a href={mappeZiel} aria-current={aktiv === 'mappe' ? 'page' : undefined}>
    <Symbol name="mappe" groesse={24} />{t('tabs.mappe')}
  </a>
</nav>

<style>
  .tabs {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 6;
    display: flex;
    padding: 6px 0 max(8px, env(safe-area-inset-bottom));
    border-top: 1px solid var(--line);
    background: var(--surface);
  }

  a {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 48px;
    color: var(--ink-quiet);
    font-size: calc(11 * var(--px));
    font-weight: 500;
    text-decoration: none;
  }

  a[aria-current='page'] {
    color: var(--accent-text);
    font-weight: 650;
  }
</style>
