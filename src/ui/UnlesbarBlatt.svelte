<script lang="ts">
  // PC126 K5 (DP83 a): Eine Datei der Mappe lässt sich nicht öffnen. Bevor etwas hinausgeht, steht das in diesem Blatt;
  // bis zur Wahl gibt es kein PDF und keine Mail. „Datei austauschen“ öffnet die Unterlage (die Datei ist dort
  // markiert), „Diesmal weglassen“ baut die Mappe ohne die ganze Unterlage. Farbe wie die heutigen Fehler.
  import type { UnlesbareDatei } from '../pdf/bewerbung';
  import { t } from '../i18n';
  import Sheet from './Sheet.svelte';

  let {
    offen = $bindable(false),
    datei,
    weglassen,
  }: {
    offen: boolean;
    datei: UnlesbareDatei | null;
    weglassen: (d: UnlesbareDatei) => void;
  } = $props();
</script>

{#if datei}
  <Sheet
    bind:offen
    titel={t('mappe.nichtOeffnen', {
      unterlage: datei.unterlage ?? datei.name,
      name: datei.person ?? '',
    })}
    titelFokus
  >
    <p class="satz">{t('mappe.nichtOeffnenText')}</p>
    {#if datei.href}
      <a class="austauschen" href={datei.href} onclick={() => (offen = false)}
        >{t('mappe.dateiAustauschen')}</a
      >
    {/if}
    {#if datei.personId && datei.typ}
      <button
        class="weglassen"
        type="button"
        onclick={() => {
          offen = false;
          weglassen(datei);
        }}>{t('mappe.diesmalWeglassen')}</button
      >
    {/if}
  </Sheet>
{/if}

<style>
  .satz {
    margin: 0 0 20px;
    color: var(--ink-muted);
  }

  .austauschen {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 54px;
    padding: 0 20px;
    border-radius: var(--radius-full);
    background: var(--action);
    color: var(--on-action);
    font-weight: 700;
    text-decoration: none;
  }

  .weglassen {
    display: block;
    width: 100%;
    min-height: var(--tap-target);
    margin-top: 8px;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
</style>
