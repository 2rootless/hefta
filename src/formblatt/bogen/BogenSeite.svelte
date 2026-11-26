<script lang="ts">
  // „Der Bogen selbst“ im Browser (E111, DP134; Bürgschaft nach DP135, Abschnitt 4): Kopf mit „‹ Ratgeber“, darunter die
  // Blätter. Bis 1599 px unten die feste Leiste mit „PDF erstellen“; ab 1600 px rechts das Pult (360 px, bleibt beim
  // Rollen stehen), die Leiste entfällt. Ab 2400 px wird alles um 25 % größer, ab 2880 px um 50 % (W46).
  import type { Snippet } from 'svelte';
  import Aktionsleiste from '../../ui/Aktionsleiste.svelte';
  import Symbol from '../../ui/Symbol.svelte';
  import Zurueck from '../../ui/Zurueck.svelte';

  let {
    titel,
    satz,
    zurueck,
    haupt,
    paar = false,
    children,
    unten,
    pult,
    pultUnten,
  }: {
    titel: string;
    satz: string;
    zurueck: { href: string; text: string };
    haupt: { text: string; unterzeile?: string; grund?: string | null; onclick: () => void };
    /** Ab 2400 px zwei Bögen nebeneinander (DP134, Abschnitt 2). */
    paar?: boolean;
    children: Snippet;
    /** Unter den Blättern, nur bis 1599 px (dort steht es sonst im Pult). */
    unten?: Snippet;
    /** Im Pult über dem Hauptknopf. */
    pult?: Snippet;
    /** Im Pult unter dem Hauptknopf. */
    pultUnten?: Snippet;
  } = $props();

  const id = $props.id();
</script>

<main class="bogen-seite" class:paar>
  <div class="vorn">
    <div class="kopf">
      {#if zurueck.href.startsWith('#')}
        <Zurueck href={zurueck.href} text={zurueck.text} />
      {:else}
        <!-- DP134, U11: im Browser zurück zum Ratgeber, einer Seite der Website (kein Weg in der App). -->
        <a class="zurueck" href={zurueck.href}
          ><Symbol name="zurueck" groesse={20} />{zurueck.text}</a
        >
      {/if}
    </div>
    <h1 class="display">{titel}</h1>
    <p class="sub">{satz}</p>
    {@render children()}
    {#if unten}<div class="unten-mobil">{@render unten()}</div>{/if}
  </div>
  <aside class="pult" aria-label="PDF und mehr">
    {@render pult?.()}
    <button
      type="button"
      class="haupt"
      aria-disabled={haupt.grund ? 'true' : undefined}
      aria-describedby={haupt.grund ? `${id}-grund` : undefined}
      onclick={haupt.onclick}
      >{haupt.text}{#if haupt.unterzeile && !haupt.grund}<small>{haupt.unterzeile}</small
        >{/if}</button
    >
    {#if haupt.grund}<p class="fehlt" id="{id}-grund">{haupt.grund}</p>{/if}
    {@render pultUnten?.()}
  </aside>
</main>
<div class="leiste-mobil">
  <Aktionsleiste
    text={haupt.text}
    unterzeile={haupt.grund ? undefined : haupt.unterzeile}
    grund={haupt.grund ?? undefined}
    beiGrund={haupt.onclick}
    onclick={haupt.onclick}
  />
</div>

<style>
  .bogen-seite {
    max-width: 560px;
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(20px + env(safe-area-inset-top)) var(--space-4)
      max(calc(160px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    min-height: var(--tap-target);
  }

  .zurueck {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    color: var(--accent-text);
    font-weight: 700;
    text-decoration: none;
  }

  .zurueck:focus-visible {
    outline: none;
    box-shadow: 0 3px 0 0 var(--ink);
  }

  h1 {
    margin: 4px 0 0;
  }

  .sub {
    margin: 8px 0 0;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }

  .pult {
    display: none;
  }

  .haupt {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 52px;
    margin-top: 24px;
    padding: 4px 16px;
    border: 0;
    border-radius: 999px;
    background: var(--ink);
    color: var(--ground);
    font: inherit;
    font-weight: 700;
    line-height: 20px;
    cursor: pointer;
  }

  .haupt small {
    font-size: calc(13 * var(--px));
    font-weight: 400;
    line-height: 16px;
    opacity: 0.85;
  }

  .haupt[aria-disabled='true'] {
    background: var(--track);
    color: var(--ink-muted);
  }

  .haupt:focus-visible {
    outline: none;
    box-shadow: 0 3px 0 0 var(--ink);
  }

  .fehlt {
    margin: 8px 0 0;
    text-align: center;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }

  @media (min-width: 1600px) {
    .bogen-seite {
      display: grid;
      grid-template-columns: minmax(0, 794px) 360px;
      column-gap: 64px;
      justify-content: center;
      align-items: start;
      max-width: none;
      padding: 24px 64px 64px;
    }

    .pult {
      display: block;
      position: sticky;
      top: 24px;
      padding-top: 48px;
    }

    .unten-mobil,
    .leiste-mobil {
      display: none;
    }

    .bogen-seite :global(.blatt) {
      padding: 64px;
    }
  }

  @media (min-width: 2400px) {
    .bogen-seite {
      zoom: 1.25;
    }

    .bogen-seite.paar {
      grid-template-columns: minmax(0, 1472px) 360px;
    }

    .bogen-seite.paar :global(.bogen-reihe) {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 32px;
      align-items: start;
    }
  }

  @media (min-width: 2880px) {
    .bogen-seite {
      zoom: 1.5;
    }
  }
</style>
