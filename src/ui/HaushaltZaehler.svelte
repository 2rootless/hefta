<script lang="ts">
  // PC213/PC214 (E-B1, CP129): Ohne Haushalt fragt „Wer einzieht“ selbst, wie Musterbogen B.1, mit zwei Zählern.
  // Erwachsene sind mindestens alle mit einer Selbstauskunft hier im Vertrag; gezählt werden die weiteren wie im
  // Haushalt (`weitereErwachsene`). Speichert sofort.
  import { db, neuLaden } from '../app/daten.svelte';
  import { t } from '../i18n';
  import { haushaltZaehlen } from '../storage/speicher';
  import Symbol from './Symbol.svelte';

  let {
    haushaltId,
    vertrag,
    weitere,
    kinder,
  }: { haushaltId: string; vertrag: number; weitere: number; kinder: number } = $props();

  async function zaehlen(feld: 'kinder' | 'weitereErwachsene', schritt: number) {
    await haushaltZaehlen(await db(), haushaltId, feld, schritt);
    await neuLaden();
  }
</script>

{#snippet zaehler(
  feld: 'kinder' | 'weitereErwachsene',
  titel: string,
  satz: string,
  wert: number,
  weg: boolean,
)}
  <div class="zaehler" role="group" aria-label={titel}>
    <span class="lab">{titel}<small>{satz}</small></span>
    <span class="stufen">
      <button
        type="button"
        aria-label="{t('allgemein.weniger')}: {titel}"
        disabled={!weg}
        onclick={() => zaehlen(feld, -1)}><Symbol name="minus" groesse={20} /></button
      >
      <b aria-live="polite">{wert}</b>
      <button
        type="button"
        aria-label="{t('allgemein.mehr')}: {titel}"
        onclick={() => zaehlen(feld, 1)}><Symbol name="plus" groesse={20} /></button
      >
    </span>
  </div>
{/snippet}

<div class="zaehler-paar">
  {@render zaehler(
    'weitereErwachsene',
    t('ohneHaushalt.erwachsene'),
    t('ohneHaushalt.erwachseneSatz'),
    vertrag + weitere,
    weitere > 0,
  )}
  {@render zaehler(
    'kinder',
    t('ohneHaushalt.kinder'),
    t('ohneHaushalt.kinderSatz'),
    kinder,
    kinder > 0,
  )}
</div>

<style>
  .zaehler-paar {
    display: grid;
    gap: 8px;
  }

  .zaehler {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 6px 10px;
    min-height: 56px;
  }

  .lab {
    display: grid;
    flex: 1 1 55%;
    min-width: 0;
    font-size: calc(15 * var(--px));
    font-weight: 700;
  }

  .lab small {
    font-size: calc(13 * var(--px));
    font-weight: 400;
    color: var(--ink-muted);
  }

  .stufen {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }

  .stufen b {
    min-width: 2ch;
    text-align: center;
    font-size: calc(17 * var(--px));
  }

  button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid var(--ink-quiet);
    border-radius: 999px;
    background: none;
    color: var(--ink);
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
