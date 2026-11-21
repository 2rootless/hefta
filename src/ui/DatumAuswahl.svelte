<script lang="ts">
  import { scrollMerken } from './scrollMerken';
  // „Im Dokument auswählen“ (Entwürfe D11b, D11c): Hefta sucht die Daten im Text aller Seiten, nur auf
  // dem Gerät. Unter der Seite stehen sie als große Auswahl mit dem Wort davor; das gewählte ist auf
  // der Seite umrandet, die Markierungen lassen sich ebenfalls antippen. Findet Hefta nichts, bleibt
  // die Seite zum Nachsehen da, mit einem Feld darunter. Der Bildschirm scrollt als Ganzes (C22).
  import { tick, untrack } from 'svelte';
  import {
    ausstellungstag,
    datenFinden,
    datenZurAuswahl,
    type DatumFund,
  } from '../domain/datumErkennen';
  import { tagAus } from '../domain/fristen';
  import { t } from '../i18n';
  import { miniatur, seitenStuecke, type PdfDokument } from '../pdf/pdfjs';
  import Hauptbutton from './Hauptbutton.svelte';
  import Symbol from './Symbol.svelte';

  type Fund = DatumFund & { seite: number };

  let {
    offen = $bindable(false),
    seiten,
    vorschlag = '',
    beimDatum,
    beimKeinen,
  }: {
    offen: boolean;
    /** `drin: false`: Die Seite geht nicht in die Mappe; ihre Daten zählen nur, wenn sonst keins passt. */
    seiten: { dokument: PdfDokument; nummer: number; schluessel: string; drin?: boolean }[];
    /** Schon eingetragener oder erkannter Tag: ist vorgewählt, wenn er im Dokument steht. */
    vorschlag?: string;
    beimDatum: (tag: string) => void;
    /** „Keins davon“. */
    beimKeinen: () => void;
  } = $props();

  let dialog = $state<HTMLDialogElement>();
  let zuruecksetzen: (() => void) | null = null;
  let flaeche = $state<HTMLDivElement>();
  let blatt = $state<HTMLDivElement>();
  let bild = $state('');
  let index = $state(0);
  let stufe = $state(1);
  let sucht = $state(false);
  let ohneText = $state(false);
  let vonHand = $state('');
  let funde = $state.raw<Fund[]>([]);
  let gewaehlt = $state.raw<Fund | null>(null);
  const titelId = $props.id();
  const STUFEN = [1, 2, 3];
  /** So viele Seiten liest Hefta höchstens: Das Datum steht fast immer am Anfang. */
  const SEITEN_LESEN = 30;

  const zweistellig = (tag: string) => tag.split('-').reverse().join('.');
  const aufDieserSeite = $derived(funde.filter((f) => f.seite === index + 1));
  // DP49 Punkt 11: Bis drei Funde stehen alle in der Liste; ab vier nur die der gezeigten Seite, darunter je
  // andere Seite „Auf Seite n: … weitere ›“.
  const JE_SEITE_AB = 4;
  const jeSeite = $derived(funde.length >= JE_SEITE_AB);
  const inDerListe = $derived(jeSeite ? aufDieserSeite : funde);
  const weitere = $derived.by(() => {
    if (!jeSeite) return [];
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- nur zum Zählen innerhalb der Ableitung.
    const zahl = new Map<number, number>();
    for (const f of funde)
      if (f.seite !== index + 1) zahl.set(f.seite, (zahl.get(f.seite) ?? 0) + 1);
    return [...zahl].sort((a, b) => a[0] - b[0]).map(([seite, anzahl]) => ({ seite, anzahl }));
  });
  /** Seiten, die nicht in die Mappe gehen, als „3“ oder „3 und 4“. */
  const aussen = $derived(seiten.flatMap((s, i) => (s.drin === false ? [i + 1] : [])));
  const aussenListe = $derived(
    aussen.length < 2
      ? String(aussen[0] ?? '')
      : `${aussen.slice(0, -1).join(', ')} und ${aussen.at(-1)}`,
  );
  const keinFund = $derived(!sucht && !funde.length);

  $effect(() => {
    if (!dialog) return;
    if (offen && !dialog.open) {
      zuruecksetzen = scrollMerken();
      dialog.showModal();
    }
    if (!offen && dialog.open) dialog.close();
    if (!offen && zuruecksetzen) {
      zuruecksetzen();
      zuruecksetzen = null;
    }
  });

  // Beim Öffnen alle Seiten lesen und vorwählen: den Vorschlag, sonst den wahrscheinlichsten Tag.
  $effect(() => {
    if (!offen) return;
    const liste = seiten;
    const vorbelegt = untrack(() => vorschlag);
    let abgebrochen = false;
    sucht = true;
    funde = [];
    gewaehlt = null;
    index = 0;
    vonHand = '';
    void (async () => {
      const alle: Fund[] = [];
      let textDa = false;
      for (const [i, s] of liste.slice(0, SEITEN_LESEN).entries()) {
        const stuecke = await seitenStuecke(s.dokument, s.nummer).catch(() => []);
        if (abgebrochen) return;
        textDa ||= stuecke.some((x) => x.text.trim());
        alle.push(...datenFinden(stuecke).map((f) => ({ ...f, seite: i + 1 })));
      }
      ohneText = !textDa;
      // DP49 Punkt 11: Zuerst die Seiten, die in die Mappe gehen. Die anderen zählen nur, wenn sonst keins passt.
      const drin = alle.filter((f) => liste[f.seite - 1]?.drin !== false);
      const basis = drin.length ? drin : alle;
      funde = datenZurAuswahl(basis);
      const tag = vorbelegt || ausstellungstag(basis)?.tag;
      waehlen(funde.find((f) => f.tag === tag) ?? funde[0] ?? null);
      sucht = false;
    })();
    return () => {
      abgebrochen = true;
    };
  });

  $effect(() => {
    const s = seiten[index];
    if (!offen || !s) return;
    let abgebrochen = false;
    const breite = Math.min(2400, Math.round((flaeche?.clientWidth || 390) * 2.5));
    void miniatur(s.dokument, s.nummer, breite).then((url) => {
      if (abgebrochen) return URL.revokeObjectURL(url);
      if (bild) URL.revokeObjectURL(bild);
      bild = url;
    });
    return () => {
      abgebrochen = true;
    };
  });

  // Breite über CSSOM (keine Inline-Styles wegen der Inhaltsrichtlinie).
  $effect(() => {
    if (blatt) blatt.style.width = `${stufe * 100}%`;
  });

  function waehlen(f: Fund | null) {
    gewaehlt = f;
    if (!f) return;
    index = f.seite - 1;
    void tick().then(zentrieren);
  }

  /** Das gewählte Datum in die Mitte des Ausschnitts holen, auch bei 2× und 3×. */
  function zentrieren() {
    if (!gewaehlt || !flaeche || !blatt || gewaehlt.seite !== index + 1) return;
    flaeche.scrollTo({
      left: (gewaehlt.x + gewaehlt.breite / 2) * blatt.offsetWidth - flaeche.clientWidth / 2,
      top: (gewaehlt.y + gewaehlt.hoehe / 2) * blatt.offsetHeight - flaeche.clientHeight / 2,
    });
  }

  function blaettern(schritt: number) {
    index = Math.max(0, Math.min(seiten.length - 1, index + schritt));
    flaeche?.scrollTo(0, 0);
  }

  function schliessen() {
    offen = false;
    stufe = 1;
    if (bild) URL.revokeObjectURL(bild);
    bild = '';
  }

  /** Lage eines gefundenen Datums auf dem Blatt, über CSSOM gesetzt. */
  function lage(element: HTMLElement, fund: DatumFund) {
    const setzen = (f: DatumFund) => {
      element.style.left = `${f.x * 100}%`;
      element.style.top = `${f.y * 100}%`;
      element.style.width = `${f.breite * 100}%`;
      element.style.height = `${f.hoehe * 100}%`;
    };
    setzen(fund);
    return { update: setzen };
  }

  /** Die Tippfläche liegt mittig auf dem Datum und ist höher als die Markierung (CSS). */
  function tippLage(element: HTMLElement, fund: DatumFund) {
    const setzen = (f: DatumFund) => {
      element.style.left = `${f.x * 100}%`;
      element.style.top = `${(f.y + f.hoehe / 2) * 100}%`;
      element.style.width = `${f.breite * 100}%`;
    };
    setzen(fund);
    return { update: setzen };
  }
</script>

<dialog
  bind:this={dialog}
  class="ansicht"
  aria-labelledby={titelId}
  onclose={schliessen}
  onkeydown={(e) => {
    if (e.key === 'ArrowRight') blaettern(1);
    if (e.key === 'ArrowLeft') blaettern(-1);
  }}
>
  {#if offen}
    <div class="inhalt">
      <div class="kopf">
        <button type="button" class="zurueck" onclick={schliessen}>
          <span class="gedreht"><Symbol name="weiter" groesse={20} /></span>{t('allgemein.zurueck')}
        </button>
        {#if seiten.length > 1}
          <span class="von">
            {t('ansicht.seiteVon', { nummer: index + 1, gesamt: seiten.length })}
          </span>
        {/if}
      </div>
      <h2 id={titelId} class="display">
        {keinFund ? t('ansicht.datumKeinTitel') : t('ansicht.datumTitel')}
      </h2>
      <p class="lead" role="status">
        {#if sucht}
          {t('ansicht.datumSucht')}
        {:else if jeSeite}
          {t('ansicht.datumGefundenJeSeite', { anzahl: funde.length })}
        {:else if funde.length > 1 && seiten.length > 1}
          {t('ansicht.datumGefundenSeiten', { anzahl: funde.length })}
        {:else if funde.length}
          {t('ansicht.datumGefunden', { anzahl: funde.length })}
        {:else if ohneText}
          {t('ansicht.datumKeinScan')}
        {:else}
          {t('ansicht.datumKeinText')}
        {/if}
      </p>
      <div class="flaeche" bind:this={flaeche}>
        {#if bild}
          <div class="blatt" bind:this={blatt}>
            <img src={bild} alt={t('ansicht.bildAlt', { nummer: index + 1 })} onload={zentrieren} />
            {#each aufDieserSeite as f (f.tag)}
              <span class="marke" class:gewaehlt={f === gewaehlt} use:lage={f}></span>
              <button
                type="button"
                class="fund"
                use:tippLage={f}
                aria-label={t('ansicht.datumMarke', { datum: zweistellig(f.tag) })}
                onclick={() => waehlen(f)}
              ></button>
            {/each}
          </div>
        {/if}
      </div>
      <div class="reihe">
        {#if seiten.length > 1}
          <button
            type="button"
            class="rund"
            aria-label={t('ansicht.zurueck')}
            aria-disabled={index === 0}
            onclick={() => blaettern(-1)}
            ><span class="gedreht"><Symbol name="weiter" groesse={20} /></span></button
          >
        {/if}
        <div class="zoom" role="group" aria-label={t('ansicht.groesse')}>
          {#each STUFEN as s (s)}
            <button
              type="button"
              class="chip"
              aria-pressed={stufe === s}
              onclick={() => {
                stufe = s;
                void tick().then(zentrieren);
              }}>{s === 1 ? t('ansicht.ganz') : `${s}×`}</button
            >
          {/each}
        </div>
        {#if seiten.length > 1}
          <button
            type="button"
            class="rund"
            aria-label={t('ansicht.weiter')}
            aria-disabled={index === seiten.length - 1}
            onclick={() => blaettern(1)}><Symbol name="weiter" groesse={20} /></button
          >
        {/if}
      </div>
      {#if funde.length}
        <div class="daten" role="radiogroup" aria-label={t('ansicht.datumGruppe')}>
          {#each inDerListe as f (f.tag)}
            <button
              type="button"
              class="datum"
              role="radio"
              aria-checked={f === gewaehlt}
              onclick={() => waehlen(f)}
            >
              <span class="ring" aria-hidden="true"></span>
              <span class="tx">
                <b>{zweistellig(f.tag)}</b>
                <small
                  >{f.davor
                    ? t('ansicht.datumFund', { begriff: f.davor, seite: f.seite })
                    : t('ansicht.datumNurSeite', { seite: f.seite })}</small
                >
              </span>
            </button>
          {/each}
          {#each weitere as w (w.seite)}
            <button
              type="button"
              class="datum weitere"
              onclick={() => blaettern(w.seite - 1 - index)}
            >
              <span class="tx"
                ><b>{t('ansicht.datumWeitere', { seite: w.seite, anzahl: w.anzahl })}</b></span
              >
              <span class="pfeil" aria-hidden="true"><Symbol name="weiter" groesse={16} /></span>
            </button>
          {/each}
        </div>
        {#if aussen.length}
          <p class="aussen">
            {t('ansicht.datumAussen', { anzahl: aussen.length, liste: aussenListe })}
          </p>
        {/if}
        <div class="fuss">
          <Hauptbutton
            text={t('ansicht.datumNehmen')}
            onclick={() => {
              if (gewaehlt) beimDatum(gewaehlt.tag);
            }}
          />
          <button type="button" class="textlink" onclick={beimKeinen}
            >{t('ansicht.datumKeinsDavon')}</button
          >
        </div>
      {:else if keinFund}
        <label class="eingabe von-hand">
          {t('ansicht.datumFeld')}
          <input type="date" max={tagAus(new Date())} bind:value={vonHand} />
        </label>
        <div class="fuss">
          <Hauptbutton
            text={t('ansicht.datumNehmen')}
            grund={vonHand ? undefined : t('ansicht.datumFehlt')}
            onclick={() => beimDatum(vonHand)}
          />
        </div>
      {/if}
    </div>
  {/if}
</dialog>

<style>
  /* DP49 Punkt 11: „Auf Seite n: … weitere ›“ in der Liste; der Satz zu Seiten außerhalb der Mappe leise. */
  .weitere {
    justify-content: space-between;
  }

  .weitere .pfeil {
    display: grid;
    color: var(--ink-muted);
  }

  .aussen {
    margin: 8px 0 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  /* Am Bildschirmrand festgemacht statt 100vw: folgt so auch vergrößertem Text. */
  .ansicht {
    position: fixed;
    inset: 0;
    width: auto;
    max-width: none;
    height: auto;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: var(--ground);
    color: var(--ink);
    overscroll-behavior: contain;
  }

  .ansicht[open] {
    display: flex;
    flex-direction: column;
  }

  .ansicht::backdrop {
    background: var(--ground);
  }

  .inhalt {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: calc(8px + env(safe-area-inset-top)) var(--space-4)
      calc(12px + env(safe-area-inset-bottom));
    overscroll-behavior: contain;
  }

  .kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-left: -4px;
  }

  .zurueck {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: var(--tap-target);
    padding: 0 6px 0 0;
    border: 0;
    background: none;
    /* DP33 A7: Zurück in Akzent, wie im Heft. */
    color: var(--accent-text);
    font-size: calc(16 * var(--px));
    font-weight: 700;
    cursor: pointer;
  }

  .von {
    font-size: calc(15 * var(--px));
    font-weight: 800;
  }

  .gedreht {
    display: inline-flex;
    transform: scaleX(-1);
  }

  h2 {
    margin: 4px 0 0;
    font-size: calc(30 * var(--px));
    line-height: calc(34 * var(--px));
    font-weight: 800;
    font-stretch: 112%;
    letter-spacing: -0.6px;
  }

  .lead {
    margin: 6px 0 0;
    font-size: calc(16 * var(--px));
    line-height: calc(22 * var(--px));
    color: var(--ink-muted);
  }

  /* Ein Ausschnitt der Seite: So bleibt die Auswahl direkt darunter. */
  .flaeche {
    height: min(330px, 40vh);
    margin-top: var(--space-3);
    overflow: auto;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: var(--shadow-chip);
    overscroll-behavior: contain;
  }

  .blatt {
    position: relative;
    width: 100%;
  }

  .blatt img {
    display: block;
    width: 100%;
    max-width: none;
    height: auto;
  }

  /* DP39, 1.4 (W20): Stellen im Dokument wie mit Textmarker hinterlegt, nie umrandet. Die gewählte kräftig,
     die anderen Fundstellen blass. */
  .marke {
    position: absolute;
    box-sizing: content-box;
    margin: -1px -2px;
    padding: 1px 2px;
    border-radius: 3px 6px 4px 7px;
    background: rgba(247, 206, 70, 0.22);
    mix-blend-mode: multiply;
    pointer-events: none;
  }

  .marke.gewaehlt {
    background: rgba(247, 206, 70, 0.55);
  }

  .fund {
    position: absolute;
    min-width: var(--tap-target);
    height: var(--tap-target);
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: none;
    cursor: pointer;
    transform: translateY(-50%);
  }

  .fund:focus-visible {
    outline: 2px solid var(--focus);
  }

  .reihe {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;
    margin-top: var(--space-2);
  }

  /* PC79 (C33): Chips mit 8 px Abstand. */
  .zoom {
    display: flex;
    flex: 0 1 168px;
    min-width: max-content;
    gap: 8px;
    margin: 0 auto;
  }

  /* 44 px; nur im engsten Fall schmaler, damit die Leiste eine Zeile bleibt (D9b). */
  .zoom .chip {
    flex: 1 1 44px;
    min-width: max-content;
    padding: 0 8px;
    font-size: calc(15 * var(--px));
  }

  .rund {
    display: grid;
    place-items: center;
    flex: 0 1 44px;
    min-width: 32px;
    height: var(--tap-target);
    border: 2px solid var(--ink);
    border-radius: 22px;
    background: none;
    color: var(--ink);
    cursor: pointer;
  }

  /* Die Pfeile dürfen schmal aussehen; ihre Tippfläche reicht nach außen in den Rand (D9b). */
  .rund {
    position: relative;
  }

  .reihe > .rund:first-child::after,
  .reihe > .rund:last-child::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 44px;
  }

  .reihe > .rund:first-child::after {
    right: 0;
  }

  .reihe > .rund:last-child::after {
    left: 0;
  }

  .rund[aria-disabled='true'] {
    border-color: var(--track);
    color: var(--ink-muted);
    cursor: default;
  }

  .daten {
    display: grid;
    gap: 8px;
    margin-top: var(--space-3);
  }

  .datum {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 8px 14px;
    border: 2px solid var(--control-border);
    border-radius: 16px;
    background: var(--surface);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .datum[aria-checked='true'] {
    border-color: var(--ink);
  }

  .ring {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border: 2px solid var(--ink);
    border-radius: 50%;
  }

  .datum[aria-checked='true'] .ring::after {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--ink);
  }

  .tx {
    display: grid;
    min-width: 0;
  }

  .tx b {
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
  }

  .tx small {
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .von-hand {
    margin-top: var(--space-3);
  }

  .fuss {
    display: grid;
    justify-items: center;
    gap: 2px;
    margin-top: var(--space-4);
  }

  .fuss :global(.hauptbutton) {
    width: 100%;
  }
</style>
