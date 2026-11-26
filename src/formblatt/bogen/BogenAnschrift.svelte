<script lang="ts">
  // W60 im Bogen (DP134, DP135): Straße und Hausnummer, darunter PLZ schmal und Ort breit, als Linien. Fragt nach, wenn
  // die PLZ nicht nach fünf Ziffern aussieht (W33), sperrt aber nichts.
  import { t } from '../../i18n';
  import { plzSiehtGutAus, type Anschrift } from '../anschrift';
  import BogenFeld from './BogenFeld.svelte';

  let {
    anschrift = $bindable(),
    satz,
    mitLage,
  }: {
    anschrift: Anschrift;
    satz?: string;
    /** Bei der Wohnung kommt nach der Straße „Lage (freiwillig)“ (DP135). */
    mitLage?: import('svelte').Snippet;
  } = $props();

  let plzVerlassen = $state(false);
  const plzFragt = $derived(plzVerlassen && !plzSiehtGutAus(anschrift.plz));
</script>

<BogenFeld
  etikett={t('formblatt.strasse')}
  bind:wert={anschrift.strasse}
  feld={{ autocomplete: 'street-address' }}
/>
{@render mitLage?.()}
<div class="zwei">
  <div class="plz">
    <BogenFeld
      etikett={t('formblatt.plz')}
      bind:wert={anschrift.plz}
      feld={{
        inputmode: 'numeric',
        autocomplete: 'postal-code',
        onblur: () => (plzVerlassen = true),
      }}
    />
  </div>
  <div class="ort">
    <BogenFeld
      etikett={t('formblatt.ort')}
      bind:wert={anschrift.ort}
      feld={{ autocomplete: 'address-level2' }}
    />
  </div>
</div>
{#if plzFragt}<p class="nachfrage" role="status">{t('formblatt.plzNachfrage')}</p>{/if}
{#if satz}<p class="satz w30" data-w30="feld">{satz}</p>{/if}

<style>
  .zwei {
    display: flex;
    flex-wrap: wrap;
    gap: 0 16px;
  }

  .plz {
    flex: 0 0 calc(96 * var(--px));
    min-width: 0;
  }

  .ort {
    flex: 1 1 calc(120 * var(--px));
    min-width: 0;
  }

  .satz,
  .nachfrage {
    margin: 4px 0 0;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }

  .nachfrage {
    color: var(--ink);
    font-weight: 600;
  }
</style>
