<script lang="ts">
  // Anleitung „So kommt ein Inserat zu Hefta“ (E81, B24): drei Bilder (Inserat in der Portal-App öffnen,
  // „Teilen“ tippen, Hefta wählen), der Hinweis zu „Mehr“ im Teilen-Menü und der kleinere zweite Weg.
  // Die Bilder zeichnet das Design als eigene SVG auf festen Plätzen (E58); bis dahin stehen leere Plätze
  // in ihrer Form da, die Sätze sind lesbar. Nur in der App: Im Browser gibt es kein Teilen an Hefta.
  import { t } from '../i18n';
  import GrafikPlatz from './GrafikPlatz.svelte';

  let { ihr, ueberschrift = true }: { ihr: boolean; ueberschrift?: boolean } = $props();

  const SCHRITTE = [
    { grafik: 'teilen-1', satz: 'anleitung.schritt1' },
    { grafik: 'teilen-2', satz: 'anleitung.schritt2' },
    { grafik: 'teilen-3', satz: 'anleitung.schritt3' },
  ] as const;
</script>

<section class="anleitung" aria-labelledby={ueberschrift ? 'anleitung-titel' : undefined}>
  {#if ueberschrift}<h2 id="anleitung-titel" class="h3">{t('anleitung.titel')}</h2>{/if}
  <ol class="schritte">
    {#each SCHRITTE as s, i (s.grafik)}
      <li>
        <GrafikPlatz name={s.grafik} hoehe={140}>
          <span class="platz" aria-hidden="true">{i + 1}</span>
        </GrafikPlatz>
        <span class="satz">{t(s.satz)}</span>
      </li>
    {/each}
  </ol>
  <p class="hinweis">{t(ihr ? 'anleitung.mehrIhr' : 'anleitung.mehrDu')}</p>
  <p class="zweit">{t(ihr ? 'anleitung.zweitIhr' : 'anleitung.zweitDu')}</p>
</section>

<style>
  .anleitung {
    margin-top: 24px;
  }

  .h3 {
    margin: 0 2px 10px;
    font-size: calc(16 * var(--px));
    font-weight: 650;
  }

  .schritte {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .schritte li {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  /* Leerer Platz in der Form des Bildes, bis das Design es zeichnet. */
  .platz {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 9 / 16;
    border: 1px dashed var(--line-strong);
    border-radius: 14px;
    background: var(--surface);
    color: var(--ink-quiet);
    font-size: calc(20 * var(--px));
    font-weight: 700;
  }

  .satz {
    font-size: calc(13.5 * var(--px));
    line-height: 1.35;
  }

  .hinweis,
  .zweit {
    margin: 12px 2px 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }

  /* Bei großer Schrift untereinander statt nebeneinander. */
  @media (max-width: 360px) {
    .schritte {
      grid-template-columns: 1fr;
    }
  }
</style>
