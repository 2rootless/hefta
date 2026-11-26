<script lang="ts">
  // Formblatt (DP135, Abschnitt 3): ein Feld mit Etikett und, wenn es einen gibt, seinem Satz darunter (W30). Der
  // Satz ist über aria-describedby an das Feld gebunden (PC205, Abschnitt 2). Die Feldlinie (H3) kommt aus
  // global.css, sobald das Feld in einem `.formblatt` steht.
  import type { HTMLInputAttributes } from 'svelte/elements';

  let {
    etikett,
    wert = $bindable(''),
    satz,
    nachfrageId,
    pruefen = false,
    feld = {},
  }: {
    etikett: string;
    wert?: string;
    satz?: string;
    /** Id des Satzes einer Nachfrage (W33), wenn sie gerade fragt. */
    nachfrageId?: string;
    /** Prüfzustand der Nachfrage (W33). */
    pruefen?: boolean;
    feld?: HTMLInputAttributes;
  } = $props();

  const id = $props.id();
  const beschrieben = $derived(
    [satz ? `${id}-satz` : '', pruefen && nachfrageId ? nachfrageId : '']
      .filter(Boolean)
      .join(' ') || undefined,
  );
</script>

<label class="eingabe">
  {etikett}
  <input {...feld} bind:value={wert} class:pruefzustand={pruefen} aria-describedby={beschrieben} />
</label>
{#if satz}<p class="satz w30" id="{id}-satz" data-w30="feld">{satz}</p>{/if}

<style>
  .satz {
    margin: -4px 0 0;
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    color: var(--ink-muted);
  }
</style>
