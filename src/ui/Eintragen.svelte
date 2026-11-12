<script lang="ts">
  // Eintragen-Feld (design/bausteine/Eintragen.md): der eine nächste Schritt einer Person.
  // Gestrichelter Platz mit Plus, Name der Unterlage, darunter der Grund in zwei Wörtern.
  import { ohneTrennstellen } from '../domain/regelkatalog';
  import { t } from '../i18n';
  import { passend } from './passend';
  import Symbol from './Symbol.svelte';

  let {
    unterlage,
    grund,
    onclick,
    href,
    ansage,
    gross = false,
    pruefen = false,
  }: {
    unterlage: string;
    grund: string;
    onclick?: () => void;
    /** Öffnet eine andere Seite: ein Link, kein Knopf. */
    href?: string;
    /** Vorgelesen „Gehaltsnachweis hinzufügen. Neuer Monat.“; zu sehen bleiben die zwei Zeilen. */
    ansage?: boolean;
    gross?: boolean;
    /** Prüfhinweis (PH1): „?“ und fester Rahmen statt Plus und gestrichelt. */
    pruefen?: boolean;
  } = $props();
</script>

{#snippet innen()}
  {#if ansage}
    <span class="visually-hidden"
      >{pruefen
        ? t('uebersicht.pruefenAnsage', { unterlage: ohneTrennstellen(unterlage), grund })
        : t('uebersicht.eintragenAnsage', { unterlage: ohneTrennstellen(unterlage), grund })}</span
    >
  {/if}
  <span class="plus" aria-hidden={ansage ? 'true' : undefined}
    >{#if pruefen}?{:else}<Symbol name="plus" groesse={16} />{/if}</span
  >
  <span class="text" aria-hidden={ansage ? 'true' : undefined}>
    <b
      use:passend={gross
        ? ['15px/19px', '14px/18px', '13px/17px']
        : ['14px/17px', '13px/16px', '12px/15px']}>{unterlage}</b
    >
    <small>{grund}</small>
  </span>
{/snippet}

{#if href}
  <a class="eintragen" class:gross class:pruefen {href}>{@render innen()}</a>
{:else}
  <button type="button" class="eintragen" class:gross class:pruefen {onclick}
    >{@render innen()}</button
  >
{/if}

<style>
  a.eintragen {
    color: inherit;
    text-decoration: none;
  }

  .eintragen {
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 9px;
    width: 100%;
    min-height: var(--slot-height);
    padding: 6px 10px 6px 7px;
    border: 2px dashed var(--on-person);
    border-radius: var(--radius-slot);
    background: var(--slot-fill);
    color: var(--on-person);
    text-align: left;
    cursor: pointer;
    container-type: inline-size;
  }

  .pruefen {
    border-style: solid;
    background: #fff;
    color: #26221e;
  }

  .pruefen .plus {
    font-size: 17px;
    font-weight: 800;
  }

  .gross {
    min-height: 56px;
    gap: 10px;
    padding: 8px 14px 8px 9px;
  }

  .plus {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: var(--plus-size);
    height: var(--plus-size);
    border-radius: 50%;
    background: var(--on-person);
    color: var(--stone);
  }

  /* Sehr große Schrift: Passt der Text nicht neben das Plus, steht er darunter statt mitten im Wort
     umzubrechen. */
  .text {
    display: flex;
    flex: 1 1 86px;
    flex-direction: column;
    min-width: 0;
  }

  b {
    font-size: calc(14 * var(--px));
    line-height: calc(17 * var(--px));
    font-weight: 800;
    hyphens: manual;
    overflow-wrap: break-word;
  }

  .gross b {
    font-size: calc(15 * var(--px));
    line-height: calc(19 * var(--px));
  }

  small {
    font-size: calc(12 * var(--px));
    line-height: calc(15 * var(--px));
    font-weight: 500;
    color: var(--on-person-muted);
  }

  .gross small {
    font-size: calc(13 * var(--px));
    line-height: calc(16 * var(--px));
  }

  /* Sehr schmal (320 px mit großer Schrift): Das Plus bleibt, nur kleiner. Es sagt „hier tippen“. */
  @container (max-width: 170px) {
    .plus {
      width: 24px;
      height: 24px;
    }
  }
</style>
