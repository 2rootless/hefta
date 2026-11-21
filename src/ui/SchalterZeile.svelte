<script lang="ts">
  // Hefta 2 (B17a, Nachricht 9.11. a, Punkt 3): Zeile mit Schalter, die ganze Zeile ist die Tippfläche,
  // mindestens 44 px, role="switch". Aussehen des Schalters wie Schalter.svelte.
  import Symbol from './Symbol.svelte';

  let {
    an,
    titel,
    text = '',
    gesperrt = false,
    schlicht = false,
    onclick,
  }: {
    an: boolean;
    titel: string;
    text?: string;
    gesperrt?: boolean;
    /** DP50: Ein ganzer Satz als Titel (eine Frage) steht in normaler Stärke, nicht fett. */
    schlicht?: boolean;
    onclick: () => void;
  } = $props();
</script>

<button
  type="button"
  class="zeile"
  class:schlicht
  role="switch"
  aria-checked={an}
  aria-disabled={gesperrt}
  onclick={() => {
    if (!gesperrt) onclick();
  }}
>
  <span class="innen">
    <span class="tx"
      ><b>{titel}</b>{#if text}<small>{text}</small>{/if}</span
    >
    <span class="bahn" aria-hidden="true">
      <span class="knopf"
        >{#if an}<Symbol name="haken" groesse={16} />{/if}</span
      >
    </span>
  </span>
</button>

<style>
  .zeile {
    display: block;
    width: 100%;
    container-type: inline-size;
    min-height: var(--tap-target);
    padding: 10px 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  /* PC66 (W22): In einer Karte (.zeilen, etwa Einstellungen) denselben Innenabstand wie die anderen Zeilen
     (.listenzeile, 16 px links und rechts). Sonst stießen Text und Schalter an die Kante der Karte. */
  :global(.zeilen) .zeile {
    padding-right: 16px;
    padding-left: 16px;
  }

  .innen {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .tx {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }

  /* DP50 Ü5: Schmal (320 px mit 130 %) überlappte der Satz den Schalter. Dann stehen Titel und Schalter in
     einer Zeile, der Satz darunter über die ganze Breite. */
  @container (max-width: 260px) {
    .innen {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 2px 12px;
    }

    .tx {
      display: contents;
    }

    .tx b {
      grid-column: 1;
      grid-row: 1;
      align-self: center;
    }

    .bahn {
      grid-column: 2;
      grid-row: 1;
    }

    .tx small {
      grid-column: 1 / -1;
      grid-row: 2;
    }
  }

  .tx b {
    font-size: calc(15 * var(--px));
    line-height: calc(19 * var(--px));
    font-weight: 800;
  }

  .schlicht .tx b {
    font-size: calc(16 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 500;
  }

  .tx small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  .bahn {
    position: relative;
    display: block;
    flex-shrink: 0;
    width: 51px;
    height: 31px;
    border: 2px solid var(--control-border);
    border-radius: 16px;
    transition:
      background-color var(--bw-knapp) var(--bw-weich),
      border-color var(--bw-knapp) var(--bw-weich);
  }

  .knopf {
    position: absolute;
    top: 2px;
    left: 2px;
    display: grid;
    place-items: center;
    width: 23px;
    height: 23px;
    border-radius: 50%;
    background: var(--control-border);
    color: var(--ink);
    transition:
      left var(--bw-knapp) var(--bw-ziel),
      background-color var(--bw-knapp) var(--bw-weich);
  }

  [aria-checked='true'] .bahn {
    border-color: var(--ink);
    background: var(--ink);
  }

  [aria-checked='true'] .knopf {
    left: 22px;
    background: var(--ground);
  }

  [aria-disabled='true'] {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
