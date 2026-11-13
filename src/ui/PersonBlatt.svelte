<script lang="ts">
  // Blatt einer Person im Tab „Mappe“ (B12b, B18 Fassung 2 und 3): Der Kopf ist ein Reiter, der oben
  // aus dem Blatt ragt, mit Kachel, Name und Rolle. Darunter alle Unterlagen der Person, rechts der
  // Stand: Haken, Ring im Akzent (fehlt), Marke „läuft bald ab“ oder „prüfen“ in Ocker.
  import {
    listenText,
    rollenText,
    type PersonStand,
    type UnterlagenStand,
  } from '../domain/regelkatalog';
  import { t } from '../i18n';
  import Symbol from './Symbol.svelte';
  import { blattText } from './texte';

  let {
    stand,
    pruefen,
    kam = new Set(),
  }: {
    stand: PersonStand;
    /** Kurzer Prüfhinweis je Dokumenttyp („Falscher Monat?“), wenn einer offen ist. */
    pruefen: (typ: string) => string | null;
    /** B21: Typen, deren Zeile sich seit dem letzten Blick geändert hat (angekommen, neuer Prüfhinweis). */
    kam?: Set<string>;
  } = $props();

  const name = $derived(stand.person.rufname || stand.person.vorname);
  const anfang = $derived([...name][0]?.toUpperCase() ?? '');

  type Art = 'da' | 'fehlt' | 'bald' | 'pruef';
  function art(u: UnterlagenStand): Art {
    if (pruefen(u.typ.id)) return 'pruef';
    if (u.status === 'fehlt') return 'fehlt';
    if (u.status === 'bald') return 'bald';
    return 'da';
  }

  const rolle = $derived(rollenText(stand.rolle, stand.bezeichnung));

  function ziel(u: UnterlagenStand): string {
    if (u.typ.inAppErstellt) return `#/selbstauskunft/${stand.person.id}`;
    return `#/unterlage/${stand.person.id}/${u.typ.id}`;
  }
</script>

<section class="blatt farbe-{stand.farbe}">
  <h2 class="reiter">
    <!-- Vorgelesen: „Max Hauptmieter“; der Buchstabe der Kachel steht nur im Bild. -->
    <a href="#/person/{stand.person.id}">
      <span class="kachel" aria-hidden="true" data-anfang={anfang}></span>
      <b>{stand.person.vorname}</b>
      <span class="rolle">{rolle}</span>
    </a>
  </h2>
  <ul class="zeilen">
    {#each stand.pfad as u (u.typ.id)}
      {@const a = art(u)}
      <li>
        <!-- Vorgelesen: „Gehaltsnachweise Aug. bis Okt. prüfen: Falscher Monat?“ (B18 Fassung 2). -->
        <a class="zeile {a}" class:kam={kam.has(u.typ.id)} href={ziel(u)}>
          <span class="sym" aria-hidden="true"><Symbol name={u.typ.symbol} groesse={20} /></span>
          <span class="tx">
            <b>{listenText(u.typ)}</b>
            <small>{blattText(u)}</small>
          </span>
          {#if a === 'da'}
            <span class="ok"
              ><span class="visually-hidden">{t('mappeTab.da')}</span><Symbol
                name="haken"
                groesse={20}
              /></span
            >
          {:else if a === 'fehlt'}
            <span class="ring" aria-hidden="true"></span>
          {:else if a === 'bald'}
            <span class="marke">{t('mappeTab.baldAb')}</span>
          {:else}
            <span class="marke"
              >{t('mappeTab.pruefen')}<span class="visually-hidden">: {pruefen(u.typ.id)}</span
              ></span
            >
          {/if}
        </a>
      </li>
    {/each}
  </ul>
</section>

<style>
  .blatt {
    margin: 0 0 18px;
  }

  .reiter {
    position: relative;
    display: inline-flex;
    max-width: 100%;
    margin: 0 0 -1px;
    border: 1px solid var(--line);
    border-bottom: 0;
    border-radius: 14px 14px 0 0;
    background: var(--surface);
    font-size: inherit;
  }

  .reiter a {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    min-height: var(--tap-target);
    padding: 6px 16px 6px 12px;
    color: var(--ink);
    text-decoration: none;
  }

  /* Der Buchstabe steht nur im Bild, nicht im Text: Vorgelesen wird „Max, Hauptmieter“. */
  .kachel::before {
    content: attr(data-anfang);
  }

  .kachel {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    background: var(--farbe);
    color: var(--on-person);
    font-size: calc(13 * var(--px));
    font-weight: 800;
  }

  .reiter b {
    font-size: calc(18 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 800;
  }

  .rolle {
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(18 * var(--px));
  }

  .zeilen {
    margin: 0;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 0 16px 16px 16px;
    background: var(--surface);
    list-style: none;
    box-shadow: 0 2px 0 var(--line);
    overflow: hidden;
  }

  li + li {
    border-top: 1px solid var(--line);
  }

  .zeile {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 14px;
    min-height: 64px;
    padding: 10px 16px;
    color: var(--ink);
    text-decoration: none;
  }

  .zeile:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }

  .sym {
    display: inline-flex;
    flex: none;
  }

  .tx {
    display: grid;
    flex: 1 1 10em;
    min-width: 0;
  }

  .tx b {
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 700;
    overflow-wrap: break-word;
  }

  .tx small {
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }

  .fehlt .tx small {
    color: var(--accent-text);
    font-weight: 600;
  }

  .ok {
    display: inline-flex;
    flex: none;
    color: var(--passt-text);
  }

  .ring {
    flex: none;
    width: 26px;
    height: 26px;
    border: 2px solid var(--accent);
    border-radius: 50%;
  }

  /* „läuft bald ab“ und „prüfen“ in Ocker. Bei schmaler Breite rückt die Marke unter den Text,
     rechtsbündig (B18 Fassung 2). */
  /* B21, Stellen 1 bis 3: Die Zeile tönt grün (angekommen) oder ocker (prüfen) und klingt aus. Der Haken
     zieht sich, darunter blendet der Stand ein; die Marke „prüfen“ wächst. Bei „Bewegung reduzieren“
     blenden Haken und Marke knapp ein, alles andere steht sofort. */
  .zeile.kam {
    --bw-ton: var(--passt);
    animation: bw-toenen var(--bw-lang) var(--bw-weich) var(--bw-takt) backwards;
  }

  .zeile.pruef.kam {
    --bw-ton: var(--knapp);
  }

  .kam .ok {
    animation: bw-blende var(--bw-nur-reduziert) var(--bw-gleich) backwards;
  }

  .kam .ok :global(svg path) {
    stroke-dasharray: 30;
    animation: bw-haken var(--bw-kurz) var(--bw-weich) calc(2 * var(--bw-takt)) backwards;
  }

  .da.kam .tx small {
    animation: bw-blende var(--bw-kurz) var(--bw-weich) calc(2 * var(--bw-takt)) backwards;
  }

  .pruef.kam .marke {
    animation:
      bw-marke var(--bw-mittel) var(--bw-ziel) calc(2 * var(--bw-takt)) backwards,
      bw-blende var(--bw-nur-reduziert) var(--bw-gleich) backwards;
  }

  .marke {
    flex: none;
    margin-left: auto;
    padding: 2px 8px;
    border-radius: 6px;
    background: var(--knapp);
    color: var(--knapp-text);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    font-weight: 700;
    white-space: nowrap;
  }
</style>
