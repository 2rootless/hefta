<script lang="ts">
  // W60 (DP135, Abschnitt 3): Anschrift in drei Feldern, „Straße und Hausnummer“, darunter „PLZ“ und „Ort“ in einer
  // Reihe, als Gruppe mit Namen. Sieht die Postleitzahl nicht nach fünf Ziffern aus, fragt Hefta nach, sobald man das
  // Feld verlässt (W33); gesperrt wird nichts, Anschriften im Ausland sehen anders aus.
  import { t } from '../i18n';
  import Nachfrage from '../ui/Nachfrage.svelte';
  import { plzSiehtGutAus, type Anschrift } from './anschrift';
  import FormFeld from './FormFeld.svelte';

  let {
    anschrift = $bindable(),
    titel,
    satz,
    datenFeld = 'anschrift',
    tasten = {},
  }: {
    anschrift: Anschrift;
    titel: string;
    satz?: string;
    /** Für `data-feld`, damit „Es fehlt noch“ und Sprünge das erste Feld finden. */
    datenFeld?: string;
    /** Zusätzliche Tasten an jedem Feld (etwa „Weiter“ mit der Eingabetaste). */
    tasten?: Record<string, unknown>;
  } = $props();

  const id = $props.id();
  let plzVerlassen = $state(false);
  const plzFragt = $derived(plzVerlassen && !plzSiehtGutAus(anschrift.plz));
</script>

<fieldset class="anschrift" aria-describedby={satz ? `${id}-satz` : undefined}>
  <legend>{titel}</legend>
  <FormFeld
    etikett={t('formblatt.strasse')}
    bind:wert={anschrift.strasse}
    feld={{ autocomplete: 'address-line1', 'data-feld': datenFeld, ...tasten }}
  />
  <div class="reihe">
    <div class="plz">
      <FormFeld
        etikett={t('formblatt.plz')}
        bind:wert={anschrift.plz}
        pruefen={plzFragt}
        nachfrageId="{id}-plz"
        feld={{
          autocomplete: 'postal-code',
          inputmode: 'numeric',
          'data-feld': `${datenFeld}-plz`,
          onblur: () => (plzVerlassen = true),
          ...tasten,
        }}
      />
    </div>
    <div class="ort">
      <FormFeld
        etikett={t('formblatt.ort')}
        bind:wert={anschrift.ort}
        feld={{ autocomplete: 'address-level2', 'data-feld': `${datenFeld}-ort`, ...tasten }}
      />
    </div>
  </div>
  <Nachfrage aktiv={plzFragt} id="{id}-plz" text={t('formblatt.plzNachfrage')} />
  {#if satz}<p class="satz w30" id="{id}-satz" data-w30="feld">{satz}</p>{/if}
</fieldset>

<style>
  .anschrift {
    display: grid;
    gap: 12px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 4px;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 800;
  }

  /* PLZ schmal, Ort breit; bei großer Schrift oder 320 px untereinander (W5). */
  .reihe {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .plz {
    display: grid;
    flex: 1 1 calc(110 * var(--px));
    max-width: 100%;
  }

  .ort {
    display: grid;
    flex: 999 1 calc(160 * var(--px));
    min-width: 0;
  }

  .satz {
    margin: -4px 0 0;
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    color: var(--ink-muted);
  }

  .anschrift :global(.nachfrage) {
    margin-top: -4px;
  }
</style>
