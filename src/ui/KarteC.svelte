<script lang="ts">
  // Personenkarte in Stil C (design/stil-c.md): im Vertrag volle Personenfarbe, Bürgen weiß mit
  // 2 px Rahmen in ihrer Farbe und Etikett „Zusatz“. Die Karte ist eine Zeile des Bands (data-band).
  import { eintragenText, rollenText, type PersonStand } from '../domain/regelkatalog';
  import { t, zahlwort } from '../i18n';
  import { steineAttr } from './Band.svelte';
  import Eintragen from './Eintragen.svelte';
  import { passend } from './passend';
  import Symbol from './Symbol.svelte';

  let {
    stand,
    zusatz = false,
    ebene = 2,
    oneintragen,
    pruefung,
  }: {
    stand: PersonStand;
    zusatz?: boolean;
    /** Überschriftenebene: 3 unter „Im Mietvertrag“ und „Bürgschaft“, ohne diese 2. */
    ebene?: 2 | 3;
    oneintragen: () => void;
    /** Prüfhinweis als nächster Schritt: nach „Fehlt noch“, vor allem anderen (PH1). */
    pruefung?: { unterlage: string; kurz: string; href: string };
  } = $props();

  const GROSS = ['24px/26px', '20px/24px', '18px/22px', '16px/20px'];
  const KLEIN = ['20px/24px', '18px/22px', '16px/20px', '14px/18px'];

  const steine = $derived(
    steineAttr(
      stand.pfad.map((u) => ({
        zustand: u.status === 'da' ? 'da' : u.status === 'bald' ? 'bald' : 'fehlt',
        symbol: u.typ.symbol,
        id: `${stand.person.id}.${u.typ.id}`,
      })),
    ),
  );
  const offen = $derived(
    stand.unterlagen.filter((u) => u.status === 'fehlt' || u.status === 'bald').length,
  );
  const naechster = $derived(stand.naechster);
  const name = $derived(stand.person.vorname);
  const da = $derived(stand.pfad.filter((u) => u.status === 'da').length);
  const rolle = $derived(rollenText(stand.rolle, stand.bezeichnung));
  const anfang = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  // Name, Rolle, Stand. Der Stand zählt „aktuell“ wie das Band: Eine zu alte Unterlage ist da, aber
  // nicht aktuell (design/unterlage-warum-haushalt.md, Abschnitt 4).
  const ansage = $derived(
    [
      `${name}, ${rolle}${zusatz ? `, ${t('allgemein.zusatz')}` : ''}.`,
      naechster
        ? t('uebersicht.karteStand', {
            da: anfang(zahlwort(da)),
            gesamt: zahlwort(stand.pfad.length),
          })
        : `${t('allgemein.allesDa')}.`,
    ].join(' '),
  );
</script>

<div
  class="karte farbe-{stand.farbe}"
  class:zusatz
  class:erledigt={!naechster && !pruefung}
  data-band="p"
  data-farbe={stand.farbe}
  data-duenn={zusatz ? '1' : '0'}
  data-docs={steine}
>
  <div class="kopf">
    <svelte:element this={`h${ebene}`} class="name" use:passend={zusatz ? KLEIN : GROSS}>
      <a class="ueberzug" href="#/person/{stand.person.id}" aria-label={ansage}>{name}</a>
    </svelte:element>
    <span class="rolle" aria-hidden="true">{rolle}</span>
    {#if zusatz}<span class="etikett" aria-hidden="true">{t('allgemein.zusatz')}</span>{/if}
  </div>
  {#if pruefung}
    <div class="feld">
      <Eintragen
        pruefen
        unterlage={t('uebersicht.pruefen', { unterlage: pruefung.unterlage })}
        grund={pruefung.kurz}
        ansage
        href={pruefung.href}
      />
    </div>
  {:else if naechster}
    <div class="feld">
      <Eintragen
        unterlage={eintragenText(naechster.typ)}
        grund={naechster.grund}
        ansage
        href={naechster.typ.inAppErstellt ? `#/selbstauskunft/${stand.person.id}` : undefined}
        onclick={oneintragen}
      />
    </div>
    {#if offen > 1}
      <a class="weitere" href="#/person/{stand.person.id}"
        >{t('uebersicht.weitereUnterlagen', { anzahl: offen - 1 })}</a
      >
    {/if}
  {:else}
    <span class="alles-da" aria-hidden="true"
      ><Symbol name="haken" groesse={20} />{t('allgemein.allesDa')}</span
    >
  {/if}
</div>

<style>
  .karte {
    position: relative;
    margin: 0 0 12px var(--spalte);
    padding: 12px 14px;
    border-radius: 20px;
    background: var(--farbe);
    color: var(--on-person);
    box-shadow: 0 8px 18px rgb(25 26 44 / 0.1);
  }

  .farbe-1 {
    --farbe: var(--person-1);
  }
  .farbe-2 {
    --farbe: var(--person-2);
  }
  .farbe-3 {
    --farbe: var(--person-3);
  }
  .farbe-4 {
    --farbe: var(--person-4);
  }

  .farbe-5 {
    --farbe: var(--person-5);
  }

  .farbe-6 {
    --farbe: var(--person-6);
  }

  .zusatz {
    border: 2px solid var(--farbe);
    background: var(--surface);
    color: var(--ink);
  }

  /* Dunkles Thema (themen.md, 4.11.): Ein Eintragen-Feld ist nie dunkler oder grauer als die Karte, auf der
     es liegt. Auf der Karte ohne Farbe darum dunkel wie die Karte, Rand und Text hell, Plus-Kreis hell mit
     dunklem Plus. */
  :global([data-theme='dark']) .zusatz {
    --on-person: var(--ink);
    --on-person-muted: var(--ink-muted);
    --slot-fill: var(--surface);
    --stone: var(--surface);
  }

  .erledigt {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  /* Der Link steht in der Überschrift, seine Fläche ist die ganze Karte. */
  .ueberzug {
    color: inherit;
    text-decoration: none;
    pointer-events: auto;
  }

  .ueberzug::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 20px;
  }

  .ueberzug:focus-visible {
    outline: none;
    box-shadow: none;
  }

  .ueberzug:focus-visible::after {
    outline: 3px solid var(--ink);
    outline-offset: 2px;
  }

  .kopf,
  .alles-da {
    pointer-events: none;
  }

  .kopf {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
  }

  .name {
    max-width: 100%;
    min-width: 0;
    margin: 0;
    font-size: calc(24 * var(--px));
    line-height: calc(26 * var(--px));
    font-weight: 800;
    font-stretch: 118%;
    letter-spacing: -0.5px;
    overflow-wrap: normal;
    hyphens: manual;
  }

  .zusatz .name {
    font-size: calc(20 * var(--px));
    line-height: calc(24 * var(--px));
  }

  .rolle {
    font-size: calc(14 * var(--px));
    line-height: calc(18 * var(--px));
    font-weight: 600;
  }

  .etikett {
    align-self: center;
    padding: 0 8px;
    border: 1.5px solid currentColor;
    border-radius: 10px;
    font-size: calc(12 * var(--px));
    line-height: calc(17 * var(--px));
    font-weight: 700;
  }

  .feld {
    position: relative;
    z-index: 1;
    margin-top: 10px;
  }

  .weitere {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-target);
    margin-bottom: -8px;
    color: inherit;
    font-size: calc(13 * var(--px));
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .alles-da {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: calc(14 * var(--px));
    font-weight: 700;
    white-space: nowrap;
  }
</style>
