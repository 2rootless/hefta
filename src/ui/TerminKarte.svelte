<script lang="ts">
  // Karte einer Besichtigung (B21 Fassung 4, `x8-tc`): Datum links, „morgen 17:30“, Titel oder Adresse,
  // Treffpunkt, darunter die Woche ab heute mit dem Termin. In der Übersicht ist sie ein Link ins Heft,
  // im Heft nur Anzeige. Die Woche ist Schmuck; das Wort steht immer daneben.
  import {
    heftAdresseKurz,
    heftOrt,
    heftTitel,
    terminKarte,
    WOCHE_TAGE,
  } from '../domain/heftKarte';
  import type { Heft } from '../domain/modell';
  import { bisWort, vorWort } from '../domain/tageslinie';
  import { t, type TextSchluessel } from '../i18n';
  import Symbol from './Symbol.svelte';

  let {
    heft,
    jetzt,
    titel = true,
    href,
  }: { heft: Heft; jetzt: Date; titel?: boolean; href?: string } = $props();

  const termin = $derived(heft.ereignisse.termin!);
  const k = $derived(terminKarte(termin.am, jetzt));
  const wann = $derived.by(() => {
    // Vorbei (noch ohne Ergebnis): „vor 2 Tagen“ statt „heute“.
    const w = k.tage < 0 ? vorWort(-k.tage) : bisWort(k.tage);
    return t(w.schluessel as TextSchluessel, w.werte ?? {});
  });
  const name = $derived(heftTitel(heft).text);
  const label = $derived(
    t('hefte.terminLabel', { wann: k.uhr ? `${wann}, ${k.uhr}` : wann, titel: name }),
  );
  // Im Heft steht oben schon der Titel: Dann zeigt die Karte Straße und Ort.
  const zeile1 = $derived(titel ? name : heft.adresse.split('\n')[0]?.trim() || name);
  const zeile2 = $derived(titel ? heftAdresseKurz(heft) : heftOrt(heft));
  const SPALTE = 100 / WOCHE_TAGE;
</script>

<svelte:element
  this={href ? 'a' : 'div'}
  class="tc"
  class:heute={k.tage === 0}
  {href}
  aria-label={href ? label : undefined}
  role={href ? undefined : 'group'}
>
  <span class="dt" aria-hidden={href ? 'true' : undefined}
    ><i>{k.wochentag}</i><b>{k.tag}</b><i>{k.monat}</i></span
  >
  <span class="tx" aria-hidden={href ? 'true' : undefined}>
    <span class="rel"
      >{wann}
      {#if k.uhr}<small>{k.uhr}</small>{/if}</span
    >
    <b class="ti">{zeile1}</b>
    {#if zeile2}<span class="ad">{zeile2}</span>{/if}
    {#if termin.treffpunkt}
      <span class="tr"><Symbol name="person" groesse={16} /><span>{termin.treffpunkt}</span></span>
    {/if}
  </span>
  <span class="wl" aria-hidden="true">
    <span class="wz">
      {#if k.ereignis !== null && k.ereignis > 0}
        <i class="wp" style={`left:${SPALTE / 2}%;width:${k.ereignis * SPALTE}%`}></i>
      {/if}
      {#each k.woche as tag, i (i)}
        <i class="t" class:hz={i === 0} class:mo={tag.montag}
          ><i class="tk"></i>{#if k.ereignis === i}<i class="ev"></i>{#if i > 0}<b class="el"
                >{k.wochentag}</b
              >{/if}{/if}</i
        >
      {/each}
    </span>
    <span class="wh">{t('zeit.heute')}</span>
  </span>
</svelte:element>

<style>
  .tc {
    display: flex;
    flex-wrap: wrap;
    gap: 0 14px;
    padding: 14px 16px 10px 15px;
    border: 1px solid var(--line);
    border-left: 3px solid var(--termin);
    border-radius: 14px;
    background: var(--surface);
    color: var(--ink);
    text-decoration: none;
  }

  .tc.heute {
    border-color: var(--termin-line);
    border-left-color: var(--termin);
    background: var(--termin-soft);
  }

  .dt {
    flex: none;
    width: 44px;
    padding-top: 3px;
    color: var(--termin);
    line-height: 1.1;
    text-align: center;
  }

  .dt i {
    display: block;
    font-size: calc(11.5 * var(--px));
    font-style: normal;
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .dt b {
    display: block;
    font-size: calc(28 * var(--px));
    font-weight: 650;
    line-height: 1.05;
  }

  .tx {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    min-width: min-content;
  }

  .rel {
    color: var(--termin);
    font-size: calc(21 * var(--px));
    font-weight: 700;
    line-height: 1.2;
  }

  .rel small {
    margin-left: 2px;
    font-size: calc(14.5 * var(--px));
    font-weight: 600;
  }

  .ti {
    margin-top: 3px;
    font-size: calc(17 * var(--px));
    font-weight: 700;
    line-height: 1.25;
    overflow-wrap: break-word;
  }

  .ad {
    color: var(--ink-muted);
    font-size: calc(14.5 * var(--px));
  }

  .tr {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-top: 5px;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: 1.35;
  }

  .tr :global(svg) {
    flex: none;
    margin-top: 1px;
  }

  .wl {
    display: block;
    flex-basis: 100%;
    margin-top: 12px;
    padding-top: 6px;
    border-top: 1px solid var(--line);
  }

  .tc.heute .wl {
    border-top-color: var(--termin-line);
  }

  .wz {
    position: relative;
    display: grid;
    grid-template-columns: repeat(15, 1fr);
    height: 28px;
  }

  .wz::before {
    position: absolute;
    top: 20px;
    right: 0;
    left: 0;
    height: 1px;
    background: var(--line-strong);
    content: '';
  }

  .wz .t {
    position: relative;
    display: block;
    font-style: normal;
  }

  .wz i,
  .wz b {
    position: absolute;
    display: block;
  }

  .wz .tk {
    top: 17px;
    left: 50%;
    width: 1px;
    height: 7px;
    background: var(--line-strong);
  }

  .wz .mo .tk {
    top: 15px;
    height: 11px;
    background: var(--ink-quiet);
    opacity: 0.55;
  }

  .wz .hz .tk {
    top: 14px;
    width: 1.5px;
    height: 13px;
    background: var(--ink-muted);
  }

  .wp {
    z-index: 0;
    top: 20px;
    height: 0;
    border-top: 1.5px dotted var(--termin);
    opacity: 0.75;
  }

  .ev {
    z-index: 1;
    top: 16px;
    left: 50%;
    width: 9px;
    height: 9px;
    margin-left: -4.5px;
    border-radius: 50%;
    background: var(--termin);
  }

  .el {
    top: 0;
    left: 50%;
    color: var(--termin);
    font-size: calc(11 * var(--px));
    font-weight: 700;
    white-space: nowrap;
    transform: translateX(-50%);
  }

  .wh {
    display: block;
    margin-top: 1px;
    color: var(--ink-muted);
    font-size: calc(11 * var(--px));
    font-weight: 600;
  }
</style>
