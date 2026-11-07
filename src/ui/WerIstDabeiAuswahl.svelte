<script lang="ts">
  // „Wer ist dabei?“ in „Mappe erstellen“ (Aufgabe 56, E25): drei Gruppen. Im Mietvertrag und wer mit
  // einzieht sind immer dabei, ohne Kästchen. Bürgen lassen sich je Zeile weglassen; die ganze Zeile
  // schaltet. Ohne Bürgen ist der Abschnitt nur zum Ansehen.
  import { GRUPPE_BUERGT, GRUPPE_MIT, GRUPPE_VERTRAG, mitEinSatz } from '../domain/mappeWoerter';
  import { rollenText, type PersonStand } from '../domain/regelkatalog';
  import { t } from '../i18n';
  import Symbol from './Symbol.svelte';

  let {
    vertrag,
    buergen,
    kinder,
    weitere,
    ohne,
    umschalten,
  }: {
    vertrag: PersonStand[];
    buergen: PersonStand[];
    kinder: number;
    weitere: number;
    ohne: string[];
    umschalten: (id: string) => void;
  } = $props();

  const name = (s: PersonStand) => s.person.rufname || s.person.vorname;
</script>

<div class="wer">
  {#if vertrag.length}
    <h3>{GRUPPE_VERTRAG}</h3>
    <ul>
      {#each vertrag as s (s.person.id)}
        <li class="zeile">
          <span class="punkt" style:--farbe="var(--person-{s.farbe})" aria-hidden="true"></span>
          <span class="tx"
            ><b>{name(s)}</b> <small>{rollenText(s.rolle, s.bezeichnung)}</small></span
          >
        </li>
      {/each}
    </ul>
  {/if}

  {#if kinder + weitere}
    <h3>{GRUPPE_MIT}</h3>
    <ul>
      <li class="zeile"><span class="tx">{mitEinSatz(kinder, weitere)}</span></li>
    </ul>
  {/if}

  {#if buergen.length}
    <h3>{GRUPPE_BUERGT}</h3>
    <p class="satz">{t('mappe.buergenWeglassen')}</p>
    <ul>
      {#each buergen as s (s.person.id)}
        {@const an = !ohne.includes(s.person.id)}
        <li>
          <button
            type="button"
            class="zeile wahl"
            class:aus={!an}
            role="checkbox"
            aria-checked={an}
            style:--farbe="var(--person-{s.farbe})"
            onclick={() => umschalten(s.person.id)}
          >
            <span class="kasten" aria-hidden="true"
              >{#if an}<Symbol name="haken" groesse={16} />{/if}</span
            >
            <span class="tx"
              ><b>{name(s)}</b> <small>{rollenText(s.rolle, s.bezeichnung)}</small>{#if !an}<span
                  class="nicht">{t('mappe.nichtInMappe')}</span
                >{/if}</span
            >
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .wer {
    margin: 0 var(--space-1);
  }

  h3 {
    margin: 12px 0 2px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    font-weight: 700;
    line-height: calc(18 * var(--px));
  }

  h3:first-child {
    margin-top: 0;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .zeile {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: var(--tap-target);
    padding: 4px 0;
    color: var(--ink);
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .tx {
    min-width: 0;
    overflow-wrap: break-word;
  }

  b {
    font-weight: 800;
  }

  small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .punkt {
    flex: none;
    width: 14px;
    height: 14px;
    margin: 0 5px;
    border-radius: 50%;
    background: var(--farbe);
  }

  .satz {
    margin: 0 0 2px;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }

  .wahl {
    width: 100%;
    border: 0;
    background: none;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .kasten {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 2px solid var(--farbe);
    border-radius: 7px;
    background: var(--farbe);
    color: var(--on-person);
  }

  .aus .kasten {
    border-color: var(--ink-muted);
    background: var(--surface);
  }

  .aus b,
  .aus small {
    opacity: 0.55;
  }

  .nicht {
    display: block;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }
</style>
