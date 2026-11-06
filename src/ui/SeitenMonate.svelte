<script lang="ts">
  // Je Seite eine Zeile mit Miniatur, Fundstelle und Monat (design/nachtraeglich-ordnen.md, OR2, OR3).
  import { monatName, t } from '../i18n';
  import Symbol from './Symbol.svelte';
  import { monatJahr } from './versionInfo';

  let {
    zeilen,
    werte = $bindable(),
    monate,
    ansehen,
  }: {
    zeilen: { seite: number; bild?: string; fund: string | null }[];
    /** Monat je Seite, leer heißt „Nicht in die Mappe“. */
    werte: string[];
    monate: string[];
    ansehen?: (seite: number) => void;
  } = $props();
</script>

<ul class="liste">
  {#each zeilen as z (z.seite)}
    <li>
      <button
        type="button"
        class="bild"
        aria-label={t('seiten.grossAnsehen', { nummer: z.seite + 1 })}
        onclick={() => ansehen?.(z.seite)}
      >
        {#if z.bild}<img src={z.bild} alt="" />{:else}<span class="leer"></span>{/if}
      </button>
      <div>
        <b>{t('aufteilen.seite', { nummer: z.seite + 1 })}</b>
        <small
          >{z.fund
            ? t('aufteilen.fund', { monat: monatJahr(z.fund) })
            : t('aufteilen.keinFund')}</small
        >
        <label class="auswahl" class:ohne={!werte[z.seite]}>
          <span class="visually-hidden">{t('aufteilen.monatVon', { nummer: z.seite + 1 })}</span>
          <span class="pfeil" aria-hidden="true"><Symbol name="weiter" groesse={16} /></span>
          <select bind:value={werte[z.seite]}>
            {#each monate as m (m)}
              <option value={m}>{monatName(m)}</option>
            {/each}
            <option value="">{t('aufteilen.nichtInMappe')}</option>
          </select>
        </label>
      </div>
    </li>
  {/each}
</ul>

<style>
  .liste {
    margin: 0;
    padding: 0;
    border-radius: 16px;
    background: var(--surface);
    list-style: none;
  }

  li {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 12px 10px 16px;
  }

  li + li {
    border-top: 1px solid var(--track);
  }

  .bild {
    flex-shrink: 0;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }

  img,
  .leer {
    display: block;
    flex-shrink: 0;
    width: 56px;
    height: 76px;
    border-radius: 5px;
    background: #fff;
    box-shadow: 0 1px 3px rgba(25, 26, 44, 0.22);
    object-fit: contain;
  }

  div {
    flex: 1 1 110px;
    min-width: 0;
  }

  b {
    display: block;
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
  }

  small {
    display: block;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  .auswahl {
    position: relative;
    display: block;
    margin-top: 8px;
  }

  /* Eigener Pfeil, Rundung und Rahmen wie .sel in Stil C. Auf dem iPhone öffnet sich trotzdem das Rad. */
  select {
    width: 100%;
    min-height: 48px;
    padding: 0 38px 0 14px;
    border: 1.5px solid var(--control-border);
    border-radius: 14px;
    background: var(--surface);
    color: var(--ink);
    font-size: calc(16 * var(--px));
    font-weight: 600;
    white-space: nowrap;
    appearance: none;
    -webkit-appearance: none;
  }

  .ohne select {
    border-style: dashed;
    color: var(--ink-muted);
  }

  .pfeil {
    position: absolute;
    top: 50%;
    right: 14px;
    display: grid;
    color: var(--ink);
    pointer-events: none;
    transform: translateY(-50%) rotate(90deg);
  }
</style>
