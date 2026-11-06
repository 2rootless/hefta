<script lang="ts">
  // Prüfhinweis als Kasten (design/nachtraeglich-ordnen.md, PH2 bis PH4): eine Frage mit dem, was Hefta
  // gesehen hat, darunter die Lösung und „Passt so“. Sperrt nie etwas.
  import type { Pruefhinweis } from '../domain/pruefhinweise';
  import { t } from '../i18n';
  import { hinweisLoesen, passtSo } from './pruefAktionen';
  import { pruefAnzeige } from './pruefTexte';

  let {
    hinweis,
    rufname,
    hochladen,
    warum,
    beimPasstSo,
    ohneLoesung = false,
    aufMonatsSeite = false,
    beimLoesen,
  }: {
    hinweis: Pruefhinweis;
    rufname: string;
    /** „Seite dazunehmen“. */
    hochladen?: () => void;
    warum?: (e: MouseEvent) => void;
    /** Beim Hochladen ist noch nichts gespeichert: Dann merkt es sich das Formular. */
    beimPasstSo?: () => void;
    /** Beim Hochladen lässt sich die Lösung noch nicht ausführen. */
    ohneLoesung?: boolean;
    /** Auf der Seite eines Monats steht der Monat schon im Titel. */
    aufMonatsSeite?: boolean;
    /** Beim Hochladen: eine Lösung, die das Formular selbst ausführt. */
    beimLoesen?: { text: string; onclick: () => void };
  } = $props();

  const a = $derived(pruefAnzeige(hinweis, rufname, aufMonatsSeite));
  const k = $derived(a.knopf);
</script>

<div class="kasten" role="group" aria-label={t('pruef.bitteLabel')}>
  <span class="ic" aria-hidden="true">?</span>
  <p>
    {#each a.satz as teil, i (i)}{#if teil.fett}<b>{teil.text}</b>{:else}{teil.text}{/if}{/each}
  </p>
  <div class="wege">
    {#if beimLoesen}
      <button type="button" class="los" onclick={beimLoesen.onclick}>{beimLoesen.text}</button>
    {:else if !ohneLoesung || k.art === 'hochladen'}
      {#if k.art === 'link'}
        <a class="los" href={k.href}>{k.text}</a>
      {:else if k.art === 'tun'}
        <button type="button" class="los" onclick={() => hinweisLoesen(hinweis)}>{k.text}</button>
      {:else if k.art === 'hochladen'}
        <button type="button" class="los" onclick={() => hochladen?.()}>{k.text}</button>
      {:else}
        <button type="button" class="los" onclick={(e) => warum?.(e)}>{k.text}</button>
      {/if}
    {/if}
    <button
      type="button"
      class="textlink"
      onclick={() => (beimPasstSo ? beimPasstSo() : passtSo(hinweis))}>{t('pruef.passtSo')}</button
    >
  </div>
</div>

<style>
  .kasten {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0 12px;
    padding: 14px 16px;
    border: 2px solid var(--ink);
    border-radius: 18px;
    background: var(--surface);
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .ic {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 22px;
    height: 22px;
    margin-top: 1px;
    border-radius: 50%;
    background: var(--action);
    color: var(--on-action);
    font-size: 14px;
    font-weight: 800;
  }

  p {
    flex: 1 1 0;
    min-width: 0;
    margin: 0;
  }

  .wege {
    display: flex;
    flex-basis: 100%;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 16px;
    margin-top: 10px;
    padding-left: 34px;
  }

  @media (max-width: 359px) {
    .wege {
      padding-left: 0;
    }
  }

  .los {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-target);
    padding: 0 16px;
    border: 0;
    border-radius: 22px;
    background: var(--action);
    color: var(--on-action);
    font: inherit;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }
</style>
