<script lang="ts">
  // Abschnitt im Bogen: Versalien 12 px mit Linie darunter, wie im PDF (DP135, U2). Optional die Marke „in allen Bögen
  // gleich“ (DP134, Abschnitt 1).
  let { titel, gleich }: { titel: string; gleich?: string } = $props();
</script>

<h3 class="abschnitt">
  <span>{titel}</span>{#if gleich}<span class="gleich">{gleich}</span>{/if}
</h3>

<style>
  .abschnitt {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    margin: 32px 0 0;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--line-strong);
    font-size: calc(12 * var(--px));
    line-height: calc(16 * var(--px));
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .gleich {
    padding: 0 8px;
    border: 1px solid var(--ink-muted);
    border-radius: 999px;
    color: var(--ink-muted);
    letter-spacing: 0;
    text-transform: none;
    white-space: nowrap;
  }
</style>
