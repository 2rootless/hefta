<script lang="ts">
  // „So geht's“ hinter „Aus der App teilen“ auf „Neues Heft“ (E81): dieselbe Anleitung wie in der leeren
  // Übersicht, als eigene Seite.
  import { daten } from '../app/daten.svelte';
  import { t } from '../i18n';
  import AnleitungTeilen from '../ui/AnleitungTeilen.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  const ihr = $derived(
    !daten.ansicht ||
      daten.ansicht.mitglieder.filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length > 1,
  );
</script>

<main class="seite">
  <header class="kopf">
    <Zurueck href="#/wohnung-neu" text={t('neuesHeft.linkTitel')} />
  </header>
  <h1 class="h2">{t('anleitung.titel')}</h1>
  <AnleitungTeilen {ihr} ueberschrift={false} />
</main>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: env(safe-area-inset-top) var(--space-4) calc(env(safe-area-inset-bottom) + 24px);
  }

  .kopf {
    --on-zurueck: var(--accent-text);
    display: flex;
    align-items: center;
    min-height: 52px;
    padding: 4px 0;
  }
</style>
