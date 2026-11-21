<script lang="ts">
  // DP50 Punkt 1 (L1): die Mappe wie auf dem Tisch. Der Deckel liegt leicht schräg (−3°), darauf zwei
  // Blätter und vorn das Deckblatt mit einem Strich Textmarker auf dem Titel; darunter Zeilen mit den
  // Personenmarken. An der Kante stecken drei Reiter in Personenfarben, die Bürgin umrandet wie im PDF.
  // Nichts gestrichelt, nichts rot. Dunkel: Deckel #5a4a3b, Papier #f3ede4; die Personenfarben bleiben.
  // Höchstens 300 × 210 px, bei schmaler Seite schmaler, nie breiter als die Seite.
</script>

<svg class="mappe-bild" viewBox="0 0 300 210" aria-hidden="true">
  <g transform="rotate(-3 150 105)">
    <rect class="deckel" x="68" y="16" width="156" height="180" rx="7" />
    <!-- Reiter an der Kante: Max, Lea, Petra (Bürgin, umrandet). -->
    <rect x="216" y="38" width="20" height="26" rx="5" style:fill="var(--person-1)" />
    <rect x="216" y="70" width="20" height="26" rx="5" style:fill="var(--person-7)" />
    <rect
      class="umriss"
      x="217"
      y="103"
      width="18"
      height="24"
      rx="4.5"
      style:stroke="var(--person-9)"
    />
  </g>
  <g transform="rotate(2 152 104)">
    <rect class="papier hinten" x="92" y="24" width="122" height="162" rx="3" />
  </g>
  <rect class="papier hinten" x="88" y="25" width="122" height="162" rx="3" />
  <g transform="rotate(-1 145 105)">
    <rect class="papier" x="82" y="26" width="122" height="162" rx="3" />
    <rect class="grau" x="96" y="42" width="34" height="4" rx="2" />
    <rect class="marker" x="94" y="53" width="78" height="12" rx="6" />
    <rect class="tinte" x="98" y="56.5" width="66" height="5" rx="2.5" />
    <rect class="grau" x="96" y="76" width="90" height="3.5" rx="1.75" />
    <rect class="grau" x="96" y="86" width="72" height="3.5" rx="1.75" />
    <rect class="grau" x="96" y="96" width="80" height="3.5" rx="1.75" />
    {#each [0, 1, 2] as i (i)}
      {@const y = 118 + i * 14}
      {#if i < 2}
        <rect
          x="96"
          y={y - 1.5}
          width="7"
          height="7"
          rx="1"
          style:fill={i === 0 ? 'var(--person-1)' : 'var(--person-7)'}
        />
      {:else}
        <rect
          class="umriss"
          x="96.6"
          y={y - 0.9}
          width="5.8"
          height="5.8"
          rx="0.8"
          style:stroke="var(--person-9)"
        />
      {/if}
      <rect class="grau" x="110" {y} width="52" height="3.5" rx="1.75" />
      <rect class="grau" x="178" {y} width="12" height="3.5" rx="1.75" />
    {/each}
  </g>
</svg>

<style>
  .mappe-bild {
    --deckel: #c9b59c;
    --papier: #fff;
    display: block;
    width: 100%;
    max-width: 300px;
    height: auto;
    margin: 0 auto;
  }

  :global([data-theme='dark']) .mappe-bild {
    --deckel: #5a4a3b;
    --papier: #f3ede4;
  }

  .deckel {
    fill: var(--deckel);
  }

  .papier {
    fill: var(--papier);
    stroke: rgb(38 34 30 / 0.12);
    stroke-width: 0.8;
  }

  .papier.hinten {
    fill: var(--papier);
    opacity: 0.92;
  }

  /* Was auf dem Papier steht, ist Druck: gleich in hell und dunkel. */
  .grau {
    fill: #ddd4c8;
  }

  .tinte {
    fill: #26221e;
  }

  /* Textmarker wie W20 (DP41): hell .5, auf dem Papier auch dunkel kräftig genug. */
  .marker {
    fill: rgb(247 206 70 / 0.55);
  }

  .umriss {
    fill: var(--papier);
    stroke-width: 1.6;
  }
</style>
