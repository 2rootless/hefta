<script lang="ts">
  // DP63b/DP63c (W5): Fehler und Warnungen stehen in Bernstein, immer mit diesem Zeichen. Es trägt die Bedeutung,
  // nicht die Farbe allein. Stumm, denn der Satz daneben sagt, worum es geht.
</script>

<span class="warnzeichen" aria-hidden="true">!</span>

<style>
  .warnzeichen {
    display: inline-grid;
    flex-shrink: 0;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 8px;
    background: var(--fehler);
    color: var(--surface);
    font-size: calc(11 * var(--px));
    font-weight: 800;
    line-height: 1;
  }
</style>
