<script lang="ts">
  // DP49b, W33: das Zeichen der Nachfrage, „?“ im feinen Kreis, 16 px, Strich 1,5 px in Tinte. Gemeinsam für
  // den Satz unter dem Feld (Nachfrage.svelte) und den Hinweis im zugeklappten Teil (PC73).
</script>

<svg class="zeichen" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
  <circle cx="8" cy="8" r="6.6" />
  <path d="M6.3 6.4c.1-1 .8-1.6 1.7-1.6s1.7.6 1.7 1.5c0 .7-.4 1-1 1.4-.4.3-.7.5-.7 1.1" />
  <path d="M8 11.3v.1" stroke-width="1.9" />
</svg>

<style>
  .zeichen {
    flex: none;
    width: 16px;
    height: 16px;
  }

  .zeichen circle,
  .zeichen path {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
