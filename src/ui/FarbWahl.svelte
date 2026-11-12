<script lang="ts">
  import { t } from '../i18n';
  import Symbol from './Symbol.svelte';

  // Farbe bei der Person (design/person-und-haushalt.md, § 3, PF1, PF1b). Hat jemand anderes die Farbe,
  // tauscht ihr: Sie oder er bekommt die bisherige (Rückmeldung vom 4.11., sperren war nur nervig).
  let {
    farbe = $bindable(),
    ursprung,
    vergeben,
    beimWaehlen,
  }: {
    farbe: number;
    /** Die Farbe, mit der die Person gerade gespeichert ist. */
    ursprung: number;
    /** Wer sonst im Haushalt welche Farbe hat, so wie es gespeichert ist. */
    vergeben: { farbe: number; name: string }[];
    /** Sofort wirksam statt erst mit „Speichern“. */
    beimWaehlen?: (farbe: number) => void;
  } = $props();

  // B14: zwölf Farben, nach Nummer.
  const FARBEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
  const id = $props.id();
  let meldung = $state('');
  const farbName = (f: number) => t(`personSeite.farbNamen.${f as (typeof FARBEN)[number]}`);
  const gespeichert = (f: number) => vergeben.find((v) => v.farbe === f)?.name;
  /** Wer die Farbe hat, wenn die Wahl so gespeichert wird. */
  function inhaber(f: number): string | undefined {
    if (f === farbe) return undefined;
    if (f === ursprung) return gespeichert(farbe);
    return gespeichert(f);
  }
  const mitBuchstabe = $derived(FARBEN.some((f) => !!inhaber(f)));

  function tippen(f: number) {
    if (f === farbe) return;
    const wer = f === ursprung ? undefined : gespeichert(f);
    meldung = wer ? t('personSeite.farbeTausch', { name: wer, farbe: farbName(ursprung) }) : '';
    farbe = f;
    beimWaehlen?.(f);
  }
</script>

<div class="wahl">
  <span class="marke" id="{id}-marke">{t('personSeite.farbe')} <b>· {farbName(farbe)}</b></span>
  <div class="farben" role="radiogroup" aria-labelledby="{id}-marke">
    {#each FARBEN as f (f)}
      {@const name = inhaber(f)}
      <button
        type="button"
        class="knopf farbe-{f}"
        class:an={f === farbe}
        class:vergeben={!!name}
        role="radio"
        aria-checked={f === farbe}
        aria-label={name ? t('personSeite.farbeHat', { farbe: farbName(f), name }) : farbName(f)}
        onclick={() => tippen(f)}
      >
        {#if f === farbe}
          <Symbol name="haken" groesse={24} />
        {:else if name}
          <span aria-hidden="true">{[...name][0]?.toUpperCase()}</span>
        {/if}
      </button>
    {/each}
  </div>
  <p class="meldung" role="status">{meldung}</p>
  <p class="hinweis">
    {mitBuchstabe ? t('personSeite.farbeHinweisBuchstabe') : t('personSeite.farbeHinweis')}
  </p>
</div>

<style>
  .wahl {
    container-type: inline-size;
  }

  .marke {
    display: block;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    font-weight: 700;
  }

  .marke b {
    font-weight: 500;
    color: var(--ink-muted);
  }

  .farben {
    display: grid;
    grid-template-columns: repeat(6, 44px);
    gap: 10px;
    margin: 6px 0 2px;
  }

  /* Sechs Knöpfe brauchen 314 px. Gefragt wird der Kasten, nicht der Bildschirm: Auch bei großer Ansicht passt es. */
  @container (max-width: 313.98px) {
    .farben {
      grid-template-columns: repeat(3, 44px);
      gap: 10px 16px;
    }
  }

  .knopf {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--farbe);
    color: var(--on-person);
    font-family: inherit;
    font-size: 15px;
    font-weight: 800;
    line-height: 1;
    cursor: pointer;
  }

  .an {
    box-shadow:
      0 0 0 3px var(--surface),
      0 0 0 5.5px var(--ink);
  }

  .vergeben {
    box-shadow: inset 0 0 0 1.5px rgba(60, 40, 20, 0.28);
  }

  .farbe-1 {
    --farbe: var(--person-1);
  }

  .farbe-2 {
    --farbe: var(--person-2);
  }

  .farbe-3 {
    --farbe: var(--person-3);
  }

  .farbe-4 {
    --farbe: var(--person-4);
  }

  .farbe-5 {
    --farbe: var(--person-5);
  }

  .farbe-6 {
    --farbe: var(--person-6);
  }

  .meldung {
    margin: 8px 0 0;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    font-weight: 700;
  }

  .meldung:empty {
    margin: 0;
  }

  .hinweis {
    margin: 8px 0 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }
</style>
