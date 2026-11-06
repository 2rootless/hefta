<script lang="ts">
  // Kasten unter der Begrüßung (G2, G3, G5): schiebt den Inhalt nach unten, liegt nie darüber und
  // geht nicht von selbst weg. Immer nur einer: Fehler, Speicher, neue Version. Auf anderen
  // Bildschirmen zeigt die App nur den Fehler; „Neue Version“ stört dort nie (Formular, Rutsch).
  import { hinweise } from '../app/hinweise.svelte';
  import { aktualisieren, update } from '../app/update.svelte';
  import { t } from '../i18n';

  let { nurFehler = false }: { nurFehler?: boolean } = $props();

  const art = $derived(
    hinweise.fehler
      ? 'fehler'
      : nurFehler
        ? null
        : hinweise.speicherKnapp
          ? 'speicher'
          : update.verfuegbar && !hinweise.versionWeg
            ? 'version'
            : null,
  );
</script>

{#if art}
  <div class="kasten" class:stark={art !== 'version'} role="status">
    <span class="ic" aria-hidden="true">{art === 'version' ? 'i' : '!'}</span>
    <div class="tx">
      {#if art !== 'speicher'}
        <button
          type="button"
          class="zu"
          aria-label={t('stoerung.schliessen')}
          onclick={() => {
            if (art === 'fehler') hinweise.fehler = false;
            else hinweise.versionWeg = true;
          }}>×</button
        >
      {/if}
      {#if art === 'fehler'}
        <p><b>{t('stoerung.fehlerTitel')}</b> {t('stoerung.fehlerText')}</p>
        <button type="button" class="textlink" onclick={() => window.location.reload()}
          >{t('stoerung.nochmal')}</button
        >
      {:else if art === 'speicher'}
        <p><b>{t('stoerung.knappTitel')}</b> {t('stoerung.knappText')}</p>
        <a class="textlink" href="#/einstellungen">{t('stoerung.speicherAnsehen')}</a>
      {:else}
        <p><b>{t('update.titel')}</b> {t('update.text')}</p>
        <button type="button" class="textlink" onclick={aktualisieren}>{t('update.knopf')}</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .kasten {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin: 14px var(--space-4) 0;
    padding: 12px 8px 4px 14px;
    border-radius: 18px;
    background: var(--surface);
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .stark {
    border: 2px solid var(--ink);
  }

  .ic {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    margin-top: 1px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    font-size: calc(13 * var(--px));
    font-weight: 800;
  }

  .tx {
    flex: 1;
    min-width: 0;
  }

  p {
    margin: 0;
  }

  .textlink {
    text-align: left;
  }

  b {
    font-weight: 800;
  }

  /* Fließt mit: Nur die erste Zeile weicht dem Schließen aus, der Text behält die Breite. */
  .zu {
    float: right;
    width: var(--tap-target);
    height: var(--tap-target);
    margin: -10px -6px 0 2px;
    border: 0;
    background: none;
    color: var(--ink);
    font-size: calc(22 * var(--px));
    cursor: pointer;
  }
</style>
