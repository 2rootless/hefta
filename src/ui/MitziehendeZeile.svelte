<script lang="ts">
  // Hinweis zu den Personen ohne Mietvertrag (Aufgabe 55, Entwurf B8): unter der letzten Person im
  // Mietvertrag, ohne Rahmen und Fläche, kleine weiße Kreise mit Figur. Am Band nur die graue Unterlage.
  // Die ganze Zeile führt zu „Euer Haushalt“.
  import { mitEinSatz } from '../domain/mappeWoerter';
  import { t } from '../i18n';
  import Symbol from './Symbol.svelte';

  let { kinder, weitere }: { kinder: number; weitere: number } = $props();

  const satz = $derived(mitEinSatz(kinder, weitere));
  const unter = $derived(t('uebersicht.mitKeineUnterlagen', { anzahl: kinder + weitere }));
</script>

{#if kinder + weitere}
  <a class="mit" href="#/haushalt" data-band="track">
    <span class="figs" aria-hidden="true">
      {#each { length: weitere }, i (i)}
        <span class="fc er"><Symbol name="person" groesse={16} /></span>
      {/each}
      {#each { length: kinder }, i (i)}
        <span class="fc ki"><Symbol name="kind" groesse={12} /></span>
      {/each}
    </span>
    <!-- Vorgelesen: „Ein Kind zieht mit ein. Braucht keine Unterlagen. Haushalt bearbeiten“ -->
    <span class="mt"
      ><span class="m1">{satz}<span class="visually-hidden">. </span></span><span class="m2"
        >{unter}<span class="visually-hidden">. {t('uebersicht.haushaltBearbeiten')}</span></span
      ></span
    >
    <span class="chev" aria-hidden="true"><Symbol name="weiter" groesse={16} /></span>
  </a>
{/if}

<style>
  .mit {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    min-height: 48px;
    margin: -2px 0 10px var(--spalte);
    padding: 6px 24px 6px 2px;
    border-radius: 12px;
    color: var(--ink);
    text-decoration: none;
  }

  .figs {
    display: flex;
    flex: none;
    align-items: flex-end;
  }

  .fc {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: -7px;
    border-radius: 50%;
    background: var(--person-child);
    box-shadow:
      inset 0 0 0 1.6px var(--on-person),
      0 0 0 2px var(--ground);
    color: var(--on-person);
  }

  .fc:first-child {
    margin-left: 0;
  }

  .er {
    width: 28px;
    height: 28px;
  }

  .ki {
    width: 22px;
    height: 22px;
  }

  /* Reicht der Platz neben den Kreisen nicht, steht der Text darunter. */
  .mt {
    display: flex;
    flex: 1 1 min(8em, 100%);
    flex-direction: column;
    min-width: 0;
  }

  .m1 {
    font-size: calc(15 * var(--px));
    font-weight: 700;
    line-height: 1.3;
  }

  .m2 {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: 1.35;
  }

  .chev {
    position: absolute;
    top: 50%;
    right: 4px;
    color: var(--ink-muted);
    display: flex;
    transform: translateY(-50%);
  }
</style>
