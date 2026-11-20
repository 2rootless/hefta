<script lang="ts">
  // DP73 Z1 (PC106): Umbruch nach einem Zeichen („@“ in Mailadressen, „_“ in Dateinamen) mit <wbr>, nicht mit
  // einem unsichtbaren Zeichen (U+200B). Das käme beim Kopieren von Hand mit, und eine Mail ginge nicht an.
  let { text, nach }: { text: string; nach: string } = $props();
  const teile = $derived(text.split(nach));
</script>

{#each teile as teil, i (i)}{#if i}{nach}<wbr />{/if}{teil}{/each}
