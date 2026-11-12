<script lang="ts">
  // Deckblatt als Bild (B26, `deckblatt()` in build_b26.py): leer mit einem freien Platz, oder als lebende
  // Vorschau mit den eingetragenen Personen in ihrer Farbe und dem Anfangsbuchstaben (Zeichen bis 36 px,
  // E37). Der nächste freie Platz ist gestrichelt mit „+“. Eine Person, die seit dem letzten Blick dazukam,
  // erscheint einmal mit `bw-punkt` (B21 „Person kommt dazu“).
  let {
    personen,
    breite,
    label,
  }: {
    personen: { id: string; anfang: string; farbe: number; neu?: boolean }[];
    breite: number;
    label: string;
  } = $props();

  const H = 262;
  const plaetze = $derived(
    [...personen, ...(personen.length < 3 ? [null] : [])].slice(0, 3) as (
      (typeof personen)[number] | null
    )[],
  );
  const zeilen = Array.from({ length: 8 }, (_, i) => ({ y: 56 + i * 18, breit: i % 2 ? 88 : 100 }));
</script>

<svg
  class="deck"
  viewBox="0 0 210 {H}"
  width={breite}
  height={Math.round((breite * H) / 210)}
  role="img"
  aria-label={label}
>
  <rect
    x="1.1"
    y="1.1"
    width="207.8"
    height={H - 2.2}
    rx="10"
    fill="var(--surface)"
    stroke="var(--ink)"
    stroke-width="2.2"
  />
  <path
    d="M11 1.1H62V{H - 1.1}H11A9.9 9.9 0 0 1 1.1 {H - 11}V11A9.9 9.9 0 0 1 11 1.1z"
    fill="var(--accent-soft)"
  />
  {#each plaetze as p, i (p?.id ?? 'frei')}
    {@const y = 18 + i * 44}
    {#if p}
      <g class="person" class:neu={p.neu} style:--mitte="30px {y + 18}px">
        <rect
          x="12"
          {y}
          width="36"
          height="36"
          rx="6"
          fill="var(--person-{p.farbe})"
          stroke="var(--on-person)"
          stroke-width="1.6"
        />
        <text
          x="30"
          y={y + 25}
          text-anchor="middle"
          font-weight="700"
          font-size="20"
          fill="var(--on-person)">{p.anfang}</text
        >
      </g>
    {:else}
      <rect
        x="12"
        {y}
        width="36"
        height="36"
        rx="6"
        fill="none"
        stroke="var(--accent)"
        stroke-width="2.4"
        stroke-dasharray="5 4"
      />
      <path
        d="M30 {y + 10}v16M22 {y + 18}h16"
        stroke="var(--accent)"
        stroke-width="2.6"
        stroke-linecap="round"
      />
    {/if}
  {/each}
  {#if personen.length}
    <rect x="80" y="24" width="96" height="10" rx="4" fill="var(--ink)" />
  {:else}
    <rect
      x="80"
      y="24"
      width="96"
      height="10"
      rx="4"
      fill="none"
      stroke="var(--line-strong)"
      stroke-width="1.4"
      stroke-dasharray="4 3"
    />
  {/if}
  {#each zeilen as z (z.y)}
    <rect x="80" y={z.y} width={z.breit} height="5" rx="2.5" fill="var(--line-strong)" />
    <rect x="190" y={z.y} width="8" height="5" rx="2.5" fill="var(--line-strong)" />
  {/each}
</svg>

<style>
  .deck {
    display: block;
    filter: drop-shadow(0 6px 14px rgb(38 34 30 / 0.1));
  }

  /* „Person kommt dazu“ (B21, B26): einmal mit bw-punkt, bei „Bewegung reduzieren“ nur die Blende. */
  .person.neu {
    transform-box: view-box;
    transform-origin: var(--mitte);
    animation:
      bw-punkt var(--bw-mittel) var(--bw-setzen) backwards,
      bw-blende var(--bw-nur-reduziert) var(--bw-gleich) backwards;
  }
</style>
