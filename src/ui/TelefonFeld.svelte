<script lang="ts">
  // Telefon mit Land (DP77, E224): links „Telefon“, rechts das Land als Textknopf; darunter das Feld in voller Breite.
  // Gruppen erst beim Verlassen, nie beim Tippen (W8). Ein Fehler steht mit Warnzeichen unter dem Feld, ohne
  // Tintenrand (W33; Bernstein kommt erst mit den App-Farben, PC114). Bei einer deutschen Nummer steht leise darunter,
  // was Hefta verstanden hat. Stellt Hefta das Land nach dem „+“ um, sagt es das einmal (aria-live).
  import type { HTMLInputAttributes } from 'svelte/elements';
  import Sheet from './Sheet.svelte';
  import Symbol from './Symbol.svelte';
  import { t } from '../i18n';
  import {
    alleLaender,
    DEUTSCHLAND,
    laenderSuchen,
    landName,
    OFT,
    telefonPruefen,
    type Land,
    type LandEintrag,
    type TelefonErgebnis,
  } from '../domain/telefon';

  let {
    wert = $bindable(''),
    land = $bindable(DEUTSCHLAND),
    allein = false,
    /** Weitere Länder, die im Haushalt schon gewählt sind („Oft gewählt“). */
    gewaehlte = [],
    feld = {},
    /** W33 (DP49b): Hefta fragt nach, ob eine Sonderrufnummer stimmt; das Feld zeigt den Tintenrand. */
    pruefen = false,
    /** Kennung des Satzes der Nachfrage unter dem Feld, damit Vorleser ihn mit dem Feld vorlesen. */
    nachfrageId,
    onfocus,
    onblur,
  }: {
    wert: string;
    land: string;
    allein?: boolean;
    gewaehlte?: string[];
    /** Weitere Eigenschaften des Felds, etwa `data-feld` und die Taste „Weiter“. */
    feld?: HTMLInputAttributes;
    pruefen?: boolean;
    nachfrageId?: string;
    onfocus?: () => void;
    onblur?: () => void;
  } = $props();

  const id = $props.id();
  // Beim Öffnen mit einer alten Eingabe, die sich nicht umsetzen lässt: Der passende Fehler steht gleich da
  // (DP77, Abschnitt 5). Nur einmal; beim Tippen verschwindet er bis zum Verlassen.
  const anfang = (() => {
    const r = wert.trim() ? telefonPruefen(wert, land as Land) : null;
    return r?.art === 'fehler' ? r : null;
  })();
  let ergebnis = $state<TelefonErgebnis | null>(anfang);
  let umgestellt = $state<string | null>(null);
  let blattOffen = $state(false);
  let suche = $state('');

  function verlassen() {
    const r = telefonPruefen(wert, land as Land);
    ergebnis = r;
    umgestellt = null;
    if (r.art === 'gut') {
      wert = r.anzeige;
      if (r.umgestellt) umgestellt = r.vorwahl;
      land = r.land;
    }
    onblur?.();
  }

  function eingetippt() {
    // Während des Tippens steht kein Fehler da; er kommt erst, wenn die Nummer fertig ist (DP77, Abschnitt 2).
    if (ergebnis?.art === 'fehler') ergebnis = null;
    umgestellt = null;
  }

  function fehlerText(r: Extract<TelefonErgebnis, { art: 'fehler' }>): string {
    if (r.fehler === 'durchwahl')
      return t(allein ? 'telefon.fehler.durchwahlDu' : 'telefon.fehler.durchwahlIhr');
    return t(`telefon.fehler.${r.fehler}`, { vorwahl: r.vorwahl ?? '' });
  }

  const alle = alleLaender();
  const oft = $derived(
    [...new Set([...OFT, ...gewaehlte])]
      .map((l) => alle.find((e) => e.land === l))
      .filter((e): e is LandEintrag => !!e),
  );
  const treffer = $derived(suche.trim() ? laenderSuchen(suche, alle) : null);

  function waehlen(l: Land) {
    land = l;
    blattOffen = false;
    suche = '';
    umgestellt = null;
    if (wert.trim()) {
      const r = telefonPruefen(wert, l);
      ergebnis = r;
      if (r.art === 'gut') wert = r.anzeige;
    }
  }

  const fehler = $derived(ergebnis?.art === 'fehler' ? ergebnis : null);
  const verstanden = $derived(
    ergebnis?.art === 'gut' && ergebnis.land === DEUTSCHLAND ? ergebnis.international : null,
  );
</script>

<div class="telefon">
  <div class="kopf">
    <label for={id}>{t('selbstauskunft.telefon')}</label>
    <button
      type="button"
      class="land"
      aria-label={t('telefon.landKnopf', { land: landName(land as Land) })}
      onclick={() => (blattOffen = true)}
      >{landName(land as Land)}<span aria-hidden="true"><Symbol name="ab" groesse={16} /></span
      ></button
    >
  </div>
  <input
    {id}
    {...feld}
    bind:value={wert}
    type="tel"
    autocomplete="tel"
    inputmode="tel"
    aria-invalid={fehler ? 'true' : undefined}
    class:pruefzustand={pruefen}
    aria-describedby={pruefen && nachfrageId ? `${id}-satz ${nachfrageId}` : `${id}-satz`}
    onfocus={() => onfocus?.()}
    onblur={verlassen}
    oninput={eingetippt}
  />
  <div id="{id}-satz" class="satz">
    {#if fehler}
      <p class="fehler">
        <span class="warnzeichen" aria-hidden="true">!</span><span
          ><span class="sr">{t('telefon.fehlerVorspann')}</span>{fehlerText(fehler)}</span
        >
      </p>
    {:else if verstanden}
      <p class="leise">{t('telefon.wirdZu', { nummer: verstanden })}</p>
    {/if}
  </div>
  <p class="leise" aria-live="polite">
    {#if umgestellt}{t('telefon.umgestellt', { vorwahl: umgestellt })}{/if}
  </p>
</div>

<Sheet bind:offen={blattOffen} titel={t('telefon.blattTitel')} kreuz>
  <label class="eingabe suche">
    <span class="sr">{t('telefon.suche')}</span>
    <input type="search" bind:value={suche} placeholder={t('telefon.suche')} autocomplete="off" />
  </label>
  {#if treffer}
    {#if treffer.length}
      <p class="zahl">
        {treffer.length === 1
          ? t('telefon.einLand')
          : t('telefon.laender', { zahl: treffer.length })}
      </p>
      {@render liste(treffer)}
    {:else}
      <p class="zahl">{t('telefon.keinLand')}</p>
    {/if}
  {:else}
    <h3 class="abschnitt">{t('telefon.oft')}</h3>
    {@render liste(oft)}
    <h3 class="abschnitt">{t('telefon.alle')}</h3>
    {@render liste(alle)}
  {/if}
</Sheet>

{#snippet liste(eintraege: LandEintrag[])}
  <ul class="laender">
    {#each eintraege as e (e.land)}
      <li>
        <button
          type="button"
          aria-label={t(e.land === land ? 'telefon.zeileGewaehlt' : 'telefon.zeile', {
            land: e.name,
            vorwahl: e.vorwahl.replace('+', t('telefon.plus')),
          })}
          aria-pressed={e.land === land}
          onclick={() => waehlen(e.land)}
        >
          <span class="name">{e.name}</span>
          <span class="vw">{e.vorwahl}</span>
          <span class="hk" aria-hidden="true"
            >{#if e.land === land}<Symbol name="haken" groesse={16} />{/if}</span
          >
        </button>
      </li>
    {/each}
  </ul>
{/snippet}

<style>
  .telefon {
    display: grid;
    gap: var(--space-1);
  }

  .kopf {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    column-gap: 12px;
  }

  label {
    font-size: calc(14 * var(--px));
    line-height: calc(18 * var(--px));
    font-weight: 700;
  }

  /* DP77: 14 px in Tinte, Tippfläche 44 px; ein langer Name rutscht unter „Telefon“. */
  .land {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    margin: -13px 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 400;
  }

  input[type='tel'] {
    width: 100%;
    min-width: 0;
    min-height: 48px;
    padding: 0 var(--space-4);
    border: 0;
    border-radius: 14px;
    background: var(--weich);
    font-size: calc(17 * var(--px));
  }

  /* W33 (DP49b): Der Rand in Tinte heißt nur „Hefta fragt nach“, nie Fokus; wie die übrigen Felder. */
  input[type='tel'] {
    transition:
      background-color var(--bw-nachfrage) ease-in-out,
      box-shadow var(--bw-nachfrage) ease-in-out;
  }

  input[type='tel']:focus-visible {
    outline: 0;
    box-shadow: none;
  }

  input[type='tel'].pruefzustand {
    background: var(--surface);
    box-shadow: inset 0 0 0 1.5px var(--ink);
  }

  .satz:empty,
  .leise:empty {
    display: none;
  }

  .satz p,
  .leise {
    margin: 8px 0 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  .leise {
    color: var(--ink);
  }

  .fehler {
    display: flex;
    gap: 8px;
    color: var(--ink);
  }

  /* Das Warnzeichen wie auf der Seite einer Unterlage (DP39), bis Bernstein kommt (PC114). */
  .warnzeichen {
    display: grid;
    flex: none;
    place-items: center;
    width: 16px;
    height: 16px;
    margin-top: 1px;
    border-radius: 8px;
    background: var(--fehler);
    color: var(--surface);
    font-size: calc(11 * var(--px));
    font-weight: 800;
    line-height: 1;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .suche {
    margin-bottom: 12px;
  }

  .zahl {
    margin: 0 0 8px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .abschnitt {
    margin: 16px 0 4px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    font-weight: 700;
  }

  .laender {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .laender li + li {
    border-top: 1px solid var(--line);
  }

  .laender button {
    display: grid;
    grid-template-columns: 1fr auto 20px;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 52px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(17 * var(--px));
    text-align: left;
  }

  .vw {
    color: var(--ink-muted);
    font-size: calc(15 * var(--px));
  }
</style>
