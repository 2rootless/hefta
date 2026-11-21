<script lang="ts">
  // DP50 Punkt 13: Beim Bonitätsnachweis zeigt der Rutsch, was was ist. Links die Auskunft für Vermieter
  // (eine Seite mit dem Kasten „Code zum Prüfen“), rechts die kostenlose Datenkopie als Stapel. Ohne Rot,
  // ohne Kreuz (W5); Musterpapiere ohne echten Anbieter und ohne Logo (W7). Bei schmaler Karte stehen die
  // Papiere untereinander, das Bild 64 px breit, der Text daneben. Die Papiere sind Papier: weiß, auch dunkel.
  import { t } from '../i18n';
</script>

{#snippet seite(x: number, y: number, zeilen: number[], spalten: boolean)}
  <rect class="blatt" x={x + 0.5} y={y + 0.5} width="104" height="147" rx="2" />
  <rect class="dunkel" x={x + 9} y={y + 10} width="34" height="3" rx="1" />
  <rect class="hell" x={x + 9} y={y + 16} width="52" height="2" rx="1" />
  {#each zeilen as z, i (i)}
    <rect
      class="hell"
      x={x + 9}
      y={y + z}
      width={spalten ? 30 : 62 - (i % 3) * 9}
      height="2"
      rx="1"
    />
    {#if spalten}
      <rect class="hell" x={x + 46} y={y + z} width="24" height="2" rx="1" />
      <rect class="hell" x={x + 80} y={y + z} width="16" height="2" rx="1" />
    {/if}
  {/each}
{/snippet}

<section class="erkennen" aria-labelledby="erkennen-titel">
  <h3 id="erkennen-titel">{t('bonitaetErkennen.titel')}</h3>
  <div class="papiere">
    <div class="papier">
      <svg viewBox="0 0 106 149" aria-hidden="true">
        {@render seite(0, 0, [28, 34, 40], false)}
        <!-- Der Kasten „Code zum Prüfen“. -->
        <rect class="kasten" x="9" y="50" width="38" height="16" rx="2" />
        <rect class="hell" x="12" y="54" width="20" height="2" rx="1" />
        <rect class="dunkel" x="12" y="59" width="28" height="3" rx="1" />
        <rect class="hell" x="9" y="136" width="70" height="2" rx="1" />
      </svg>
      <span class="marke ja">{t('bonitaetErkennen.diese')}</span>
      <span class="tx">
        <b>{t('bonitaetErkennen.auskunft')}</b>
        <small>{t('bonitaetErkennen.auskunftSatz')}</small>
      </span>
    </div>
    <div class="papier">
      <svg viewBox="0 0 106 149" aria-hidden="true">
        <!-- Ein Stapel: zwei Blätter dahinter, vorn eine Seite mit Spalten. -->
        <rect class="blatt hinten" x="4.5" y="0.5" width="100" height="143" rx="2" />
        <rect class="blatt hinten" x="2.5" y="2.5" width="100" height="143" rx="2" />
        <g transform="translate(0 4) scale(0.97)">
          {@render seite(
            0,
            0,
            [28, 34, 40, 46, 52, 58, 64, 70, 76, 82, 88, 94, 100, 106, 112, 118],
            true,
          )}
        </g>
      </svg>
      <span class="marke nein">{t('bonitaetErkennen.nichtDiese')}</span>
      <span class="tx">
        <b>{t('bonitaetErkennen.datenkopie')}</b>
        <small>{t('bonitaetErkennen.datenkopieSatz')}</small>
      </span>
    </div>
  </div>
</section>

<style>
  .erkennen {
    /* Wie „PDF wählen“ darunter: 16 px zum Rand. */
    margin: 12px 16px 0;
    padding: 16px;
    border-radius: 20px;
    background: var(--surface);
    container-type: inline-size;
  }

  h3 {
    margin: 0 0 12px;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 650;
  }

  .papiere {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .papier {
    display: grid;
    align-content: start;
    justify-items: start;
    gap: 6px;
    min-width: 0;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  /* Papier bleibt Papier, auch dunkel (wie die Vorschau der Seiten). */
  .blatt {
    fill: #fff;
    stroke: #d9ccb8;
    stroke-width: 1;
  }

  .dunkel {
    fill: #3d3832;
  }

  .hell {
    fill: #cdc4b8;
  }

  .kasten {
    fill: none;
    stroke: #3d3832;
    stroke-width: 1;
  }

  .marke {
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: calc(12.5 * var(--px));
    font-weight: 650;
  }

  .marke.ja {
    background: var(--passt);
    color: var(--passt-text);
  }

  .marke.nein {
    background: var(--weich-karte);
    color: var(--ink-muted);
  }

  .tx {
    display: grid;
    gap: 2px;
  }

  .tx b {
    font-size: calc(14 * var(--px));
    line-height: calc(18 * var(--px));
    font-weight: 650;
  }

  .tx small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  /* Schmal (320 px, 130 %): untereinander, das Bild 64 px breit, der Text daneben. */
  @container (max-width: 300px) {
    .papiere {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .papier {
      grid-template-columns: 64px 1fr;
      column-gap: 12px;
    }

    .papier svg {
      grid-row: 1 / span 2;
    }

    .marke,
    .tx {
      grid-column: 2;
    }
  }
</style>
