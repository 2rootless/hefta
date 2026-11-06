<script lang="ts">
  // Die Kachel: weiße Klammer auf Koralle wie das App-Symbol, in allen Themen gleich (design/logo).
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
  <rect width={groesse} height={groesse} rx={Math.round(groesse * 0.225)} fill="#ff8466" />
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
      stroke="#ffffff"
      stroke-width="3.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</svg>
