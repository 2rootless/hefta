<script lang="ts">
  import { untrack } from 'svelte';
  import { rueck } from '../app/rueckgaengig.svelte';
  import RueckgaengigZeile from './RueckgaengigZeile.svelte';
  // Hauptaktion unten, fixiert (design/stil-c.md, „Hauptaktion unten“), mit kleinem Zusatz wie „3 offen“.
  // Deckender Hintergrund mit Verlauf auf den ersten 26 px (mappe-erstellen-einstellungen.md, Abschnitt 7; C13).
  let {
    text,
    zusatz,
    ansage,
    href,
    onclick,
    grund,
    neben,
    beiGrund,
    fuss,
    zahlNeu = false,
    einblenden = false,
    nebenGeist,
    statt,
  }: {
    text: string;
    zusatz?: string;
    /** Vorgelesen statt des Sichtbaren, wenn es als Satz anders klingt („…, zwei offen“ statt „2 offen“). */
    ansage?: string;
    /** Mit `onclick` zusammen: Das sagt, wie es dorthin geht (etwa eine Seite zurück). */
    /** Öffnet eine andere Seite: ein Link, kein Knopf (design/unterlage-warum-haushalt.md, Abschnitt 4). */
    href?: string;
    onclick?: () => void;
    grund?: string;
    /** Zweite, leise Möglichkeit als Textlink darunter („Später“, „Mappe trotzdem erstellen“). */
    neben?: { text: string; onclick: () => void };
    /** Tipp auf den gedämpften Knopf: z. B. zum fehlenden Feld springen (D6). */
    beiGrund?: () => void;
    /** Leiser Zusatz ganz unten in der Leiste, immer sichtbar (E42: Hinweis für Vermieter). */
    fuss?: import('svelte').Snippet;
    /** B21: Der Zusatz („1 offen“) hat sich geändert und steigt ein. */
    zahlNeu?: boolean;
    /** B21, „Alles da“: Der Knopf ist neu und blendet ein. */
    einblenden?: boolean;
    /** B21, „Alles da“: Dieser leise Link geht; er blendet aus, und sein Platz schließt sich. */
    nebenGeist?: string;
    /** B21, Mappe entsteht: statt des Knopfs ein ruhiger Kasten, solange Hefta baut. */
    statt?: import('svelte').Snippet;
  } = $props();
  const grundId = $props.id();

  // Beim Tippen den Hinweis unter dem Knopf ausblenden: Mit offener Tastatur auf kleinen Geräten
  // würde er sonst das Feld verdecken (Prüfkatalog C12). Der Knopf selbst bleibt.
  let tippt = $state(false);
  // Bleibt mit offener Tastatur kaum Höhe (320 px, große Schrift), gehört sie dem Feld: Die Leiste
  // kommt zurück, sobald die Tastatur zu ist.
  let knapp = $state(false);
  $effect(() => {
    const istFeld = (e: EventTarget | null) =>
      e instanceof HTMLElement && e.matches('input, textarea, select');
    const messen = () => {
      const hoehe = window.visualViewport?.height ?? window.innerHeight;
      const zoom = parseFloat(document.documentElement.style.getPropertyValue('zoom') || '1');
      knapp = hoehe * (1 / zoom) < 240;
    };
    const rein = (e: FocusEvent) => {
      tippt = istFeld(e.target);
      messen();
    };
    // Ältere Browser melden das Verlassen auch, während Svelte ein Feld entfernt; dort darf sich kein
    // Zustand ändern, also einen Moment warten. Sonst bricht der Bildschirmwechsel mit einer Ausnahme ab,
    // und Screenreader sehen bis zum nächsten Wechsel nichts (gefunden im Test der Android-App).
    const raus = () => queueMicrotask(() => (tippt = istFeld(document.activeElement)));
    document.addEventListener('focusin', rein);
    document.addEventListener('focusout', raus);
    window.visualViewport?.addEventListener('resize', messen);
    tippt = istFeld(document.activeElement);
    messen();
    return () => {
      document.removeEventListener('focusin', rein);
      document.removeEventListener('focusout', raus);
      window.visualViewport?.removeEventListener('resize', messen);
    };
  });

  // Höhe der Leiste als --leiste-hoehe: Seiten halten so viel Platz am Ende frei, auch wenn ein
  // Hinweis oder ein zweiter Link die Leiste höher macht (Prüfkatalog C14).
  let leiste = $state<HTMLDivElement>();
  // Ohne Leiste auf der Seite zeigt App.svelte „Rückgängig“ selbst.
  $effect(() => {
    untrack(() => rueck.leisten++);
    return () => untrack(() => rueck.leisten--);
  });
  $effect(() => {
    const element = leiste;
    if (!element) return;
    const wurzel = document.documentElement.style;
    const messen = () => wurzel.setProperty('--leiste-hoehe', `${element.offsetHeight}px`);
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(element);
    messen();
    return () => {
      beobachter.disconnect();
      wurzel.removeProperty('--leiste-hoehe');
    };
  });
</script>

{#snippet inhalt()}
  {#if ansage}
    <span class="visually-hidden">{ansage}</span>
    <span aria-hidden="true">{text}</span>{#if zusatz}<small class:neu={zahlNeu} aria-hidden="true"
        >{zusatz}</small
      >{/if}
  {:else}
    {text}{#if zusatz}<small class:neu={zahlNeu}>{zusatz}</small>{/if}
  {/if}
{/snippet}

<div class="leiste" class:beim-tippen-weg={tippt && knapp} bind:this={leiste}>
  <div class="innen">
    {#if rueck.eintrag}<RueckgaengigZeile />{/if}
    {#if statt}
      {@render statt()}
    {:else if href && !grund}
      <a
        class="haupt"
        class:einblenden-neu={einblenden}
        {href}
        onclick={(e) => {
          if (!onclick) return;
          e.preventDefault();
          onclick();
        }}
      >
        {@render inhalt()}
      </a>
    {:else}
      <button
        type="button"
        class="haupt"
        class:deaktiviert={!!grund}
        aria-disabled={grund ? 'true' : undefined}
        aria-describedby={grund ? grundId : undefined}
        onclick={() => {
          if (!grund) onclick?.();
          else beiGrund?.();
        }}
      >
        {@render inhalt()}
      </button>
    {/if}
    {#if grund}<p id={grundId} class:visually-hidden={tippt}>{grund}</p>{/if}
    {#if neben}
      <button type="button" class="textlink neben" onclick={neben.onclick}>{neben.text}</button>
    {:else if nebenGeist}
      <div class="geist" inert aria-hidden="true">
        <div><span class="textlink neben">{nebenGeist}</span></div>
      </div>
    {/if}
    {#if fuss}<div class="fuss">{@render fuss()}</div>{/if}
  </div>
</div>

<style>
  .leiste {
    position: fixed;
    left: 0;
    right: 0;
    /* Hefta 2: über der Tab-Leiste, die den sicheren Rand unten schon hält (TabLeiste.svelte). */
    bottom: var(--tabs-hoehe, 0px);
    z-index: 5;
    padding: 26px 16px calc(20px + var(--leiste-sicher, env(safe-area-inset-bottom)));
    background: linear-gradient(to bottom, transparent, var(--ground) 26px);
  }

  .beim-tippen-weg {
    display: none;
  }

  .innen {
    max-width: calc(var(--content-width) - 32px);
    margin: 0 auto;
  }

  .haupt {
    display: flex;
    align-items: center;
    justify-content: center;
    /* Passt der Zusatz nicht daneben, steht er als ganze Zeile darunter, nie als zweite Spalte. */
    flex-wrap: wrap;
    column-gap: 8px;
    width: 100%;
    min-height: 54px;
    padding: 6px 8px;
    border: 0;
    border-radius: 27px;
    background: var(--action);
    color: var(--on-action);
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 800;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    transition: transform var(--bw-knapp) var(--bw-weich);
  }

  .haupt:active:not(.deaktiviert) {
    transform: scale(0.98);
  }

  .neben {
    display: block;
    margin: 6px auto 0;
  }

  /* B21, „Alles da“: Knopf blendet ab zwei Takten ein; „trotzdem teilen“ geht und schließt seinen Platz. */
  .einblenden-neu {
    animation: bw-blende var(--bw-kurz) var(--bw-weich) calc(2 * var(--bw-takt)) backwards;
  }

  .geist {
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    animation: bw-zu var(--bw-mittel) var(--bw-ziel) backwards;
  }

  .geist > div {
    min-height: 0;
    overflow: hidden;
  }

  /* B21: Die neue Zahl steigt ein. */
  small.neu {
    display: inline-block;
    animation:
      bw-zahl var(--bw-kurz) var(--bw-weich) var(--bw-takt) backwards,
      bw-blende var(--bw-nur-reduziert) var(--bw-gleich) backwards;
  }

  small {
    font-size: calc(15 * var(--px));
    font-weight: 600;
    opacity: 0.75;
    white-space: nowrap;
  }

  /* Eigens über `button:not(.neben)`: Sonst bliebe der Knopf trotz Hinweis voll dunkel (C17). */
  .haupt.deaktiviert {
    background: var(--track);
    color: var(--ink-muted);
    cursor: not-allowed;
  }

  p {
    margin: 6px 0 0;
    padding: 4px 8px;
    border-radius: 10px;
    background: var(--ground);
    font-size: calc(14 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
    text-align: center;
  }
</style>
