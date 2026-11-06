<script lang="ts">
  // Dateinamen brechen nur an „_“ und vor der Endung um, nie mitten im Wort und ohne Trennstrich.
  let { name }: { name: string } = $props();
  const teile = $derived(name.split(/(?<=_)|(?=\.[^.]+$)/));
</script>

<span class="vs-datei"
  >{#each teile as teil, i (i)}{#if i}<wbr />{/if}{teil}{/each}</span
>
