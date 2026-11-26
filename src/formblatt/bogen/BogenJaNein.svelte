<script lang="ts" generics="W extends string">
  // „Der Bogen selbst“ (DP134, Abschnitt 3): Ja/Nein als Radiogruppe mit Namen, die Wahl wie im PDF: das Wort mit Strich
  // darunter. Fokus ist der Strich (W33), bei gewählter Antwort unter dem Strich der Wahl.
  import { t } from '../../i18n';

  let {
    frage,
    name,
    wert = $bindable(null),
    fett = false,
    optionen,
  }: {
    frage: string;
    /** Name der Gruppe für den Vorleser, etwa „Frage 1: Insolvenzverfahren“. */
    name: string;
    wert?: W | null;
    /** Ohne Angabe Ja und Nein; sonst etwa „Schon unterschrieben“ und „Noch nicht“ (DP135). */
    optionen?: { wert: W; text: string }[];
    /** Fett gesetzte Frage, etwa „Wohnberechtigungsschein (freiwillig)“ mit `zusatz`. */
    fett?: boolean;
  } = $props();

  const liste = $derived(
    optionen ??
      (['ja', 'nein'] as W[]).map((w) => ({
        wert: w,
        text: t(`selbstauskunft.${w as 'ja' | 'nein'}`),
      })),
  );
</script>

<div class="zeile">
  <p class:fett>{frage}</p>
  <div class="janein" role="radiogroup" aria-label={name}>
    {#each liste as o (o.wert)}
      <button
        type="button"
        role="radio"
        aria-checked={wert === o.wert}
        onclick={() => (wert = o.wert)}>{o.text}</button
      >
    {/each}
  </div>
</div>

<style>
  .zeile {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 4px 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
  }

  p {
    flex: 1 1 calc(180 * var(--px));
    margin: 0;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .fett {
    font-weight: 700;
  }

  /* Bei 320 px mit 130 % reichen lange Wahlen („Schon unterschrieben“, „Noch nicht“) bis an den Rand; mit anderen
     Schriftmaßen (Linux) darüber. Dann bricht die zweite Wahl um, statt die Seite breiter zu machen (E10). */
  .janein {
    display: flex;
    flex-wrap: wrap;
    max-width: 100%;
    gap: 0 8px;
  }

  button {
    min-width: 52px;
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    border-radius: 0;
    background: none;
    color: var(--ink-quiet);
    font: inherit;
    font-weight: 400;
    cursor: pointer;
  }

  button[aria-checked='true'] {
    color: var(--ink);
    font-weight: 700;
    box-shadow: inset 0 -2px 0 var(--ink);
  }

  button:focus-visible {
    outline: none;
    box-shadow: 0 3px 0 0 var(--ink);
  }

  button[aria-checked='true']:focus-visible {
    box-shadow:
      inset 0 -2px 0 var(--ink),
      0 3px 0 0 var(--ink);
  }
</style>
