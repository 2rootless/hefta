<script lang="ts">
  // Anleitung „So kommt ein Inserat zu Hefta“ (E81, B24 Richtung B, E84): drei Schritte mit Bild
  // (Inserat öffnen, „Teilen“ tippen, Hefta wählen), darunter ein breiter vierter Schritt (die Vorschau),
  // der Hinweis zu „Mehr“ und der kleinere zweite Weg. Die Bilder sind Schmuck (die Sätze tragen die
  // Bedeutung, B24 Abschnitt 2). Werden die Plätze schmaler als etwa 96 px (320 px mit 130 %), stehen die
  // Schritte untereinander: Bild links, Satz mit Nummer rechts (Container-Abfrage, E84.3).
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
        <span class="bild">
          <GrafikPlatz name={s.grafik} hoehe={240}>
            <span class="platz" aria-hidden="true">{i + 1}</span>
          </GrafikPlatz>
        </span>
        <span class="satz"><span class="nr">{i + 1}.</span> {t(s.satz)}</span>
      </li>
    {/each}
    <li class="vier">
      <span class="bild">
        <GrafikPlatz name="teilen-4" hoehe={240}>
          <span class="platz" aria-hidden="true">4</span>
        </GrafikPlatz>
      </span>
      <span class="satz">{t('anleitung.schritt4')}</span>
    </li>
  </ol>
  <p class="hinweis">{t(ihr ? 'anleitung.mehrIhr' : 'anleitung.mehrDu')}</p>
  <p class="zweit">{t('anleitung.zweit')}</p>
</section>

<style>
  .anleitung {
    margin-top: 24px;
    container-type: inline-size;
  }

  .h3 {
    margin: 0 2px 10px;
    font-size: calc(16 * var(--px));
    font-weight: 650;
  }

  .schritte {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px 10px;
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

  .bild {
    display: block;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .bild :global(svg) {
    width: 100%;
    height: auto;
  }

  /* Leerer Platz in der Form des Bildes, falls eine Grafik fehlt. */
  .platz {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 9 / 16;
    color: var(--ink-quiet);
    font-size: calc(20 * var(--px));
    font-weight: 700;
  }

  .satz {
    font-size: calc(13.5 * var(--px));
    line-height: 1.35;
  }

  /* In der breiten Form steht die Nummer schon im Bild; sie gilt nur untereinander. */
  .nr {
    display: none;
  }

  /* Schritt 4: ein breiter Kasten, Bild links, Satz rechts (E84.2). */
  /* Kompakt (B24 Fassung 2): Bild 72 px, Polster 10, Abstand 16. */
  .schritte li.vier {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: 72px 1fr;
    align-items: center;
    gap: 16px;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .vier .bild {
    width: 72px;
    border: 0;
  }

  .hinweis,
  .zweit {
    margin: 12px 2px 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }

  /* Plätze schmaler als etwa 96 px (3 × 96 + 2 × 10): untereinander, Bild links, Satz mit Nummer rechts. */
  @container (max-width: 308px) {
    .schritte {
      grid-template-columns: 1fr;
    }

    .schritte li {
      flex-direction: row;
      align-items: center;
      gap: 14px;
    }

    .schritte li .bild {
      flex: none;
      width: 84px;
    }

    .schritte li.vier {
      grid-template-columns: 84px 1fr;
      gap: 14px;
    }

    .nr {
      display: inline;
    }
  }
</style>
