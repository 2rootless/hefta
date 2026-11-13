<script lang="ts">
  // Karte einer Besichtigung (B25 auf B21 Fassung 4, `x8-tc`): oben rechts ein Reiter für die Nähe
  // (heute und morgen in Violett), Datum links, groß nur die Uhrzeit, Titel oder Adresse, Ort und
  // Treffpunkt, darunter immer zwei Wochenzeilen Mo–So. Die Karte ist immer gleich hoch: Titel und Ort je
  // eine Zeile, Treffpunkt höchstens zwei, ohne Treffpunkt bleibt der Platz frei. Der ganze Satz steht als
  // Name für Vorlesehilfen da; Reiter und Band sind nur zur Anzeige. In der Übersicht ist die Karte ein
  // Link ins Heft, im Heft nur Anzeige.
  import { heftAdresseKurz, heftOrt, heftTitel, terminKarte } from '../domain/heftKarte';
  import type { Heft } from '../domain/modell';
  import { terminBand, terminNaehe } from '../domain/terminNaehe';
  import { t } from '../i18n';
  import Symbol from './Symbol.svelte';
  import { naeheWort, terminSatz, uhrzeit } from './terminWorte';

  let {
    heft,
    jetzt,
    titel = true,
    href,
  }: { heft: Heft; jetzt: Date; titel?: boolean; href?: string } = $props();

  const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  const termin = $derived(heft.ereignisse.termin!);
  const k = $derived(terminKarte(termin.am, jetzt));
  const naehe = $derived(terminNaehe(termin.am, jetzt));
  const band = $derived(terminBand(termin.am, jetzt));
  const uhr = $derived(uhrzeit(termin.am));
  const name = $derived(heftTitel(heft).text);
  const label = $derived(t('naehe.label', { satz: terminSatz(termin.am, jetzt), titel: name }));
  // Im Heft steht oben schon der Titel: Dann zeigt die Karte Straße und Ort.
  const zeile1 = $derived(titel ? name : heft.adresse.split('\n')[0]?.trim() || name);
  const zeile2 = $derived(titel ? heftAdresseKurz(heft) : heftOrt(heft));
</script>

<svelte:element
  this={href ? 'a' : 'div'}
  class="tc {naehe.art}"
  {href}
  aria-label={label}
  role={href ? undefined : 'group'}
>
  <span class="reiter" aria-hidden="true">{naeheWort(naehe)}</span>
  <span class="dt" aria-hidden="true"><i>{k.wochentag}</i><b>{k.tag}</b><i>{k.monat}</i></span>
  <span class="tx" aria-hidden={href ? 'true' : undefined}>
    <span class="rel">{uhr || k.wochentag}</span>
    <b class="ti">{zeile1}</b>
    <span class="ad">{zeile2}</span>
    <span class="tr" class:ohne={!termin.treffpunkt}
      >{#if termin.treffpunkt}<Symbol name="person" groesse={16} /><span class="trt"
          >{termin.treffpunkt}</span
        >{/if}</span
    >
  </span>
  <span class="wl" aria-hidden="true">
    <span class="ba">
      <span class="za kopf"
        >{#each WOCHENTAGE as w (w)}<i>{w}</i>{/each}</span
      >
      {#each band.wochen as woche, n (n)}
        <span class="za" class:nach-luecke={n === 1 && band.luecke}>
          {#each woche as tag, i (i)}
            <span
              class="tg"
              class:we={tag.wochenende}
              class:vorbei={tag.vorbei}
              class:heute={tag.heute}
              class:termin={tag.termin}>{tag.tag}</span
            >
          {/each}
        </span>
      {/each}
    </span>
  </span>
</svelte:element>

<style>
  .tc {
    position: relative;
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    column-gap: 14px;
    align-items: start;
    margin-top: 16px;
    padding: 14px 16px 12px 15px;
    border: 1px solid var(--line);
    border-left: 3px solid var(--termin);
    border-radius: 14px;
    background: var(--surface);
    color: var(--ink);
    text-decoration: none;
  }

  /* Reiter: wie der Reiter eines Hefts, oben rechts an der Karte. */
  .reiter {
    position: absolute;
    top: -15px;
    right: 16px;
    display: flex;
    align-items: center;
    height: 22px;
    padding: 0 10px;
    border: 1px solid var(--termin-line);
    border-bottom: 0;
    border-radius: 7px 7px 0 0;
    background: var(--termin-soft);
    color: var(--termin);
    font-size: calc(11 * var(--px));
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .heute .reiter {
    border-color: var(--nah);
    background: var(--nah);
    color: var(--nah-auf);
  }

  .morgen .reiter {
    border-color: var(--nah-linie);
    background: var(--nah-hell);
    color: var(--nah-text);
  }

  .vorbei .reiter {
    border-color: var(--line-strong);
    background: var(--ground);
    color: var(--ink-muted);
  }

  /* Heute ganz violett getönt, morgen Rand und Termin in Violett, vorbei grau. */
  .tc.heute {
    border-left-color: var(--nah);
    background: var(--nah-hell);
  }

  .tc.morgen {
    border-left-color: var(--nah);
  }

  .tc.vorbei {
    border-left-color: var(--line-strong);
  }

  .dt {
    padding-top: 3px;
    color: var(--termin);
    line-height: 1.1;
    text-align: center;
  }

  .heute .dt,
  .morgen .dt,
  .heute .rel,
  .morgen .rel {
    /* Schrift in Violett nimmt --nah-text, im Dunkeln Tinte (B25 n1). */
    color: var(--nah-text);
  }

  .vorbei .dt,
  .vorbei .rel {
    color: var(--ink-muted);
  }

  /* Wochentag und Monat brechen nie um, auch nicht bei 200 % (Prüfkatalog C2). */
  .dt i {
    display: block;
    white-space: nowrap;
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
    flex-direction: column;
    min-width: 0;
  }

  .rel {
    color: var(--termin);
    font-size: calc(21 * var(--px));
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
  }

  /* Nie höher als vorgesehen: Titel und Ort je eine Zeile, Treffpunkt zwei. */
  .ti,
  .ad {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ti {
    margin-top: 3px;
    font-size: calc(17 * var(--px));
    font-weight: 700;
    line-height: 1.25;
  }

  .ad {
    color: var(--ink-muted);
    font-size: calc(14.5 * var(--px));
    line-height: 1.35;
  }

  .tr {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    height: calc(2 * 1.35em);
    margin-top: 5px;
    overflow: hidden;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: 1.35;
  }

  .tr :global(svg) {
    flex: none;
    margin-top: 1px;
  }

  .trt {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .tr.ohne {
    visibility: hidden;
  }

  /* Band: immer zwei Wochenzeilen Mo–So, nur zur Anzeige. */
  .wl {
    grid-column: 1 / -1;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }

  .heute .wl {
    border-top-color: var(--nah-linie);
  }

  .ba {
    display: grid;
    gap: 4px;
  }

  .za {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    text-align: center;
  }

  .za.kopf i {
    color: var(--ink-muted);
    font-size: calc(11 * var(--px));
    font-style: normal;
    font-weight: 650;
    letter-spacing: 0.04em;
  }

  .tg {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 26px;
    border-radius: 13px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    font-weight: 600;
  }

  .tg.we {
    color: var(--ink-quiet);
  }

  .tg.vorbei {
    color: var(--ink-quiet);
    opacity: 0.6;
  }

  .tg.heute {
    box-shadow: inset 0 0 0 1.5px var(--ink);
    color: var(--ink);
    opacity: 1;
  }

  .tg.termin {
    background: var(--termin);
    color: var(--surface);
    font-weight: 750;
    opacity: 1;
  }

  .heute .tg.termin,
  .morgen .tg.termin {
    background: var(--nah);
    color: var(--nah-auf);
  }

  .vorbei .tg.termin {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--ink-muted);
    color: var(--ink-muted);
  }

  .za.nach-luecke {
    position: relative;
  }

  .za.nach-luecke::before {
    position: absolute;
    top: -2.5px;
    right: 8px;
    left: 8px;
    border-top: 1.5px dashed var(--line-strong);
    content: '';
  }
</style>
