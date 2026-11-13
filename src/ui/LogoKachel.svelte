<script lang="ts">
  // Die Kachel: Klammer in Papier auf dem Deckel des App-Icons, in allen Themen gleich (D002, design/logo).
  // Nur die Klammer: Die Seiten des Icons wären hier zu fein.
  import { KLAMMER } from '../domain/logo';
  import { t } from '../i18n';

  let { groesse = 76 }: { groesse?: number } = $props();
  const marke = $derived(Math.round(groesse * 0.74));
</script>

<svg
  width={groesse}
  height={groesse}
  viewBox="0 0 {groesse} {groesse}"
  role="img"
  aria-label={t('logo.alt')}
>
  <rect
    width={groesse}
    height={groesse}
    rx={Math.round(groesse * 0.225)}
    fill="var(--app-zeichen)"
  />
  <svg
    x={(groesse - marke) / 2}
    y={(groesse - marke) / 2}
    width={marke}
    height={marke}
    viewBox="0 2 32 30"
  >
    <path
      d={KLAMMER}
      fill="none"
      stroke="var(--app-zeichen-haus)"
      stroke-width="3.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</svg>
