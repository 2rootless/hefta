<script lang="ts">
  // „Neues Heft“ in der App (B23 Bildschirm 1, `#s=link`; E74, E75): Der Kopf mit dem Blatt scrollt nie,
  // darin an fester Stelle der Einsetzen-Knopf von iOS. Hefta legt nur einen Platz an; den Knopf selbst
  // zeichnet iOS darüber (`HeftaInseratPlugin.knopf`). Er blendet nach dem Aufschlagen knapp ein und ist
  // weg, solange die Tastatur offen ist. Ein eingesetzter Text gilt, wenn Hefta darin einen Link findet.
  // Ohne Knopf (vor iOS 16) oder bei leerer Zwischenablage steht das Feld da. Darunter scrollt nur der Rest.
  import { onDestroy, onMount } from 'svelte';
  import { daten } from '../app/daten.svelte';
  import { heftaInserat, linkAus } from '../app/heftaInserat';
  import { gehe, zurueckGehen } from '../app/router.svelte';
  import { t } from '../i18n';
  import Hauptbutton from '../ui/Hauptbutton.svelte';
  import { entwurf, entwurfVergessen } from '../ui/neuesHeft.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  const plugin = heftaInserat();
  const ihr = $derived(
    (daten.ansicht?.mitglieder ?? []).filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length > 1,
  );

  /** Kann iOS den Knopf zeigen (ab iOS 16)? Erst nach der ersten Antwort bekannt. */
  let knopfGeht = $state<boolean | null>(null);
  let ablage = $state<{ link: boolean; inhalt: boolean } | null>(null);
  let feldOffen = $state(false);
  let keinLink = $state(false);
  let eingabe = $state('');
  let platz = $state<HTMLDivElement | null>(null);
  let feld = $state<HTMLInputElement | null>(null);

  const mitKnopf = $derived(!feldOffen && knopfGeht !== false && ablage?.inhalt !== false);

  /** Dauer des Aufschlagens aus den Tokens (`--bw-aufschlagen`; „Bewegung reduzieren“ regeln die Tokens). */
  function aufschlagen(): number {
    const wert = getComputedStyle(document.documentElement).getPropertyValue('--bw-aufschlagen');
    const ms = parseFloat(wert);
    return Number.isFinite(ms) ? (wert.trim().endsWith('ms') ? ms : ms * 1000) : 0;
  }

  async function knopfSetzen(verzoegerung = 0) {
    if (!plugin || !platz || !mitKnopf) return;
    const r = platz.getBoundingClientRect();
    const { geht } = await plugin.knopf({
      x: r.left,
      y: r.top,
      breite: r.width,
      hoehe: r.height,
      verzoegerung,
    });
    knopfGeht = geht;
    if (!geht) feldOffen = true;
  }

  async function ablagePruefen() {
    if (!plugin) return;
    ablage = await plugin.ablage();
  }

  function starten(link: string) {
    entwurfVergessen();
    entwurf.link = link;
    void plugin?.knopfWeg();
    gehe('/wohnung-neu/vorschau');
  }

  let abmelden: (() => void) | null = null;
  const sichtbar = () => {
    if (document.visibilityState === 'visible') void ablagePruefen();
  };
  const neuSetzen = () => void knopfSetzen();

  onMount(async () => {
    if (!plugin) return;
    const h = await plugin.addListener('eingesetzt', ({ url, text }) => {
      const link = url ?? (text ? linkAus(text) : null);
      if (link) starten(link);
      else keinLink = true;
    });
    abmelden = () => void h.remove();
    document.addEventListener('visibilitychange', sichtbar);
    window.addEventListener('resize', neuSetzen);
    await ablagePruefen();
    await knopfSetzen(aufschlagen());
  });

  onDestroy(() => {
    abmelden?.();
    document.removeEventListener('visibilitychange', sichtbar);
    window.removeEventListener('resize', neuSetzen);
    void plugin?.knopfWeg();
  });

  $effect(() => {
    // Feld offen oder Zwischenablage leer: der Knopf geht weg.
    if (!mitKnopf) void plugin?.knopfWeg();
  });

  function selbstEintippen() {
    feldOffen = true;
    void plugin?.knopfWeg();
    queueMicrotask(() => feld?.focus());
  }

  function vorschauZeigen() {
    const link = linkAus(eingabe);
    if (link) starten(link);
    else keinLink = true;
  }
</script>

<div class="screen">
  <div class="kopfteil">
    <header class="kopf">
      <Zurueck
        href="#/wohnungen"
        text={t('heft.zurueck')}
        onclick={() => {
          entwurfVergessen();
          zurueckGehen('/wohnungen');
        }}
      />
    </header>
    <h1 class="h2">{t('neuesHeft.linkTitel')}</h1>
    <p class="sub">{t(ihr ? 'neuesHeft.linkSubIhr' : 'neuesHeft.linkSubDu')}</p>

    {#if mitKnopf}
      <div class="ablage">
        <p>
          <Symbol name="kopieren" groesse={20} /><span
            >{t(ablage?.link ? 'neuesHeft.linkAusAblage' : 'neuesHeft.ausAblage')}</span
          >
        </p>
        <!-- Platz für den Knopf von iOS; iOS zeichnet ihn darüber. -->
        <div class="platz" bind:this={platz} aria-hidden="true"></div>
        {#if keinLink}<p class="ergebnis" role="status">{t('neuesHeft.keinLink')}</p>{/if}
      </div>
      <button class="selbst" type="button" onclick={selbstEintippen}
        >{t('neuesHeft.selbstEintippen')}</button
      >
    {/if}
  </div>

  <main class="roll">
    {#if !mitKnopf}
      <label class="lab" for="link">{t('neuesHeft.linkZumInserat')}</label>
      <input
        id="link"
        type="url"
        inputmode="url"
        autocomplete="off"
        autocapitalize="off"
        placeholder="https://"
        bind:this={feld}
        bind:value={eingabe}
        oninput={() => (keinLink = false)}
        onkeydown={(e) => {
          if (e.key === 'Enter' && eingabe.trim()) vorschauZeigen();
        }}
      />
      {#if keinLink}
        <p class="hinweis" role="status">{t('neuesHeft.keinLink')}</p>
      {:else if !eingabe.trim()}
        <p class="hinweis">{t(ihr ? 'neuesHeft.haltenIhr' : 'neuesHeft.haltenDu')}</p>
      {/if}
    {/if}

    <h2 class="oder">{t('neuesHeft.oder')}</h2>
    <div class="wege">
      <a class="weg" href="#/wohnung-neu/text">
        <span
          ><b>{t('neuesHeft.textEinsetzen')}</b><small
            >{t(ihr ? 'neuesHeft.ohneLinkIhr' : 'neuesHeft.ohneLinkDu')}</small
          ></span
        ><Symbol name="weiter" groesse={20} />
      </a>
      <!-- E81: der bequemste Weg. Bis die Anleitung „So geht's“ kommt, nur ein Hinweis, kein Link. -->
      <p class="weg">
        <span
          ><b>{t('neuesHeft.ausAppTeilen')}</b><small>{t('neuesHeft.ausAppTeilenText')}</small
          ></span
        >
      </p>
    </div>

    {#if !mitKnopf && eingabe.trim()}
      <div class="cta">
        <Hauptbutton text={t('neuesHeft.vorschauZeigen')} onclick={vorschauZeigen} />
      </div>
    {/if}
  </main>
</div>

<style>
  /* F3 (Code j): der Kopf mit dem Blatt scrollt nie; darunter scrollt nur der Rest. */
  .screen {
    display: flex;
    flex-direction: column;
    max-width: var(--content-width);
    height: 100dvh;
    margin: 0 auto;
  }

  .kopfteil {
    position: relative;
    z-index: 2;
    flex: none;
    padding: env(safe-area-inset-top) var(--space-4) 2px;
    background: var(--ground);
    box-shadow: 0 14px 14px -2px var(--ground);
  }

  .kopf {
    --on-zurueck: var(--accent-text);
    display: flex;
    align-items: center;
    min-height: 52px;
    padding: 4px 0;
  }

  .sub {
    margin: 0 0 14px;
    color: var(--ink-muted);
  }

  .ablage {
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 20px;
    background: var(--surface);
    box-shadow: 0 6px 20px rgb(38 34 30 / 10%);
  }

  .ablage p {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 2px 4px 10px;
    font-weight: 650;
  }

  .ablage p :global(svg) {
    flex: none;
    color: var(--accent-text);
  }

  .ablage p.ergebnis {
    display: block;
    margin: 10px 4px 2px;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    font-weight: 400;
    text-align: center;
  }

  /* Der Platz für den Knopf von iOS: 60 px hoch, ganze Breite (B23 F5). */
  .platz {
    min-height: 60px;
    border-radius: var(--radius-full);
  }

  .selbst {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 44px;
    margin-top: 6px;
    border: 0;
    background: none;
    color: var(--accent-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .roll {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 4px var(--space-4) 0;
    overflow-y: auto;
  }

  .lab {
    margin: 4px 0 6px;
    font-weight: 650;
  }

  input {
    box-sizing: border-box;
    width: 100%;
    min-height: 56px;
    padding: 12px 14px;
    border: 1.5px solid var(--line-strong);
    border-radius: 14px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
  }

  input:focus {
    border-color: var(--ink);
    outline: none;
  }

  .hinweis {
    margin: 8px 2px 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }

  .oder {
    margin: 28px 2px 8px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .wege {
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .weg + .weg {
    border-top: 1px solid var(--line);
  }

  p.weg {
    margin: 0;
  }

  .weg {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    padding: 12px 14px;
    color: var(--ink);
    text-decoration: none;
  }

  .weg > span {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .weg small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .weg > :global(svg) {
    flex: none;
    color: var(--ink-quiet);
  }

  .cta {
    position: sticky;
    bottom: 0;
    z-index: 2;
    margin: auto calc(-1 * var(--space-4)) 0;
    padding: 12px var(--space-4) calc(env(safe-area-inset-bottom) + 16px);
    background: var(--ground);
    box-shadow: 0 -14px 14px -2px var(--ground);
  }
</style>
