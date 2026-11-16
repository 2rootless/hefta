<script lang="ts" module>
  export type HaarZustand = 'aktuell' | 'fertig' | 'uebersprungen' | 'offen';
  export interface HaarStueck {
    /** Wort der Unterlage für den Vorleser („Selbstauskunft“). */
    text: string;
    symbol: SymbolName;
    zustand: HaarZustand;
    /** Rutsch: Stelle in der Runde; mit `springen` wird das Symbol zum Knopf dorthin. */
    ziel?: number;
  }
</script>

<script lang="ts">
  // DP39, Abschnitt 1.2: Fortschritt als feine Haarlinie (W19), im Rutsch und auf der Personenseite. Eine Linie
  // von 2 px über die ganze Breite, je Unterlage ein gleich breites Stück mit dem Symbol in der Mitte. Das
  // Symbol liegt auf einer Fläche in der Farbe der Karte (`--hl-grund`), die die Linie dort ausspart. Fertig
  // in Druckfarbe (dunkel App-Farbe), offen und übersprungen blass; die aktuelle Unterlage im feinen Ring,
  // übersprungene mit kleinem Pfeil. Erwartet `--p-linie` von einer Fläche `person-ton` darüber.
  import { t } from '../i18n';
  import Symbol from './Symbol.svelte';
  import type { SymbolName } from './symbolPfade';

  let { stuecke, springen }: { stuecke: HaarStueck[]; springen?: (ziel: number) => void } =
    $props();

  const voll = (z: HaarZustand) => z === 'fertig' || z === 'aktuell';
  const verlauf = $derived(
    stuecke
      .map((s, i) => {
        const farbe = voll(s.zustand) ? 'var(--p-linie)' : 'var(--hl-leer)';
        const von = ((i / stuecke.length) * 100).toFixed(2);
        const bis = (((i + 1) / stuecke.length) * 100).toFixed(2);
        return `${farbe} ${von}%, ${farbe} ${bis}%`;
      })
      .join(', '),
  );
</script>

<div
  class="haarlinie"
  role="list"
  aria-label={t('haarlinie.liste')}
  style:--hl-anzahl={stuecke.length}
>
  <i class="linie" style:background={`linear-gradient(90deg, ${verlauf})`}></i>
  {#each stuecke as s, i (i)}
    <span class="stueck" role="listitem" aria-label={t(`haarlinie.${s.zustand}`, { text: s.text })}>
      <span class="platz z-{s.zustand}">
        {#if s.zustand === 'aktuell'}<span class="ring" aria-hidden="true"></span>{/if}
        {#if springen && s.ziel !== undefined}
          {@const ziel = s.ziel}
          <button
            type="button"
            class="zeichen knopf"
            aria-label={t(`haarlinie.${s.zustand}`, { text: s.text })}
            onclick={() => springen(ziel)}><Symbol name={s.symbol} groesse={20} /></button
          >
        {:else}
          <span class="zeichen"><Symbol name={s.symbol} groesse={20} /></span>
        {/if}
        {#if s.zustand === 'uebersprungen'}
          <svg
            class="pfeil"
            viewBox="0 0 12 12"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            ><path d="M2 8.5C2.6 5 6.5 3.4 9.4 5.6" /><path d="M9.6 2.9v2.9H6.7" /></svg
          >
        {/if}
      </span>
    </span>
  {/each}
</div>

<style>
  .haarlinie {
    --hl-leer: rgba(38, 34, 30, 0.09);
    position: relative;
    display: flex;
    align-items: center;
    height: 34px;
    margin: 0;
    padding: 0;
    container-type: inline-size;
  }
  :global([data-theme='dark']) .haarlinie {
    --hl-leer: rgba(243, 237, 228, 0.14);
  }
  .linie {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 2px;
    margin-top: -1px;
    border-radius: 1px;
  }
  .stueck {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    justify-content: center;
  }
  /* Rand um das Symbol 8 px; bei vielen Unterlagen auf schmaler Zeile (320 px, Text 130 %) bis 2 px. */
  .platz {
    position: relative;
    display: flex;
    padding: 0 clamp(2px, calc((100cqi / var(--hl-anzahl, 1) - 20px) / 2), 8px);
    background: var(--hl-grund, var(--surface));
  }
  .zeichen {
    position: relative;
    display: flex;
    color: var(--ink);
  }
  /* Als Knopf: Tippfläche 44 px um das Symbol (C5); der Rand von -12 px hält die Linie, wie sie ist. */
  .knopf {
    justify-content: center;
    align-items: center;
    width: 44px;
    height: 44px;
    margin: -12px;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    cursor: pointer;
  }
  .z-fertig .zeichen {
    opacity: 0.8;
  }
  .z-uebersprungen .zeichen {
    color: var(--ink-quiet);
  }
  .z-offen .zeichen {
    color: var(--ink-quiet);
    opacity: 0.45;
  }
  /* Ring: Kreis 36 px, Strich 1,5 px in Druckfarbe (dunkel App-Farbe), innen die Farbe der Karte. */
  .ring {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 36px;
    height: 36px;
    margin: -18px 0 0 -18px;
    border-radius: 50%;
    background: var(--hl-grund, var(--surface));
    box-shadow: inset 0 0 0 1.5px var(--p-linie);
  }
  .pfeil {
    position: absolute;
    right: -3px;
    top: -10px;
    color: var(--ink-quiet);
  }
</style>
