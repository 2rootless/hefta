<script lang="ts" module>
  export interface LeserAbschnitt {
    person: string;
    seite: number;
    teile: { abschnitt: string; seite: number; bis: number }[];
  }

  /** Personenmarke und Rufname je Name in der Mappe. */
  export type LeserMarke = { farbe: string; buerge: boolean; kurz: string };
</script>

<script lang="ts">
  // DP50 Punkt 9 (P2): Die Mappe ansehen wie auf der Vermieterseite. Die Seiten stehen untereinander und
  // rollen; der Kopf (fest) nennt die Mappe und den Abschnitt, der beim Rollen wechselt. Antippen des
  // Abschnitts öffnet das Verzeichnis wie „Was beiliegt“ auf dem Deckblatt. Unten mittig der schmale
  // Blätterer, daneben rund „Teilen“. Doppeltippen springt zwischen ganzer Seite und doppelter Größe.
  // Kein Prüfcode, kein „Fertig“, kein „Ganz / 2× / 3×“.
  import { tick } from 'svelte';
  import { t } from '../i18n';
  import { miniatur, pdfOeffnen, pdfSchliessen, type PdfDokument } from '../pdf/pdfjs';
  import { scrollMerken } from './scrollMerken';
  import Symbol from './Symbol.svelte';
  import { abstand, einrasten, mitte, stufeNachGeste, type Punkt } from './zweiFinger';

  let {
    offen = $bindable(false),
    datei,
    titel,
    inhalt,
    marken = {},
    teilen,
  }: {
    offen: boolean;
    datei: File | null;
    /** „Mappe für Lindenring 3“. */
    titel: string;
    /** Wer auf welcher Seite anfängt (aus dem Bau der Mappe). */
    inhalt: LeserAbschnitt[];
    /** Personenmarke je Name: Farbe als CSS-Wert, Bürgen als Umriss. */
    marken?: Record<string, LeserMarke>;
    teilen: () => void;
  } = $props();

  let dialog = $state<HTMLDialogElement>();
  let rolle = $state<HTMLDivElement>();
  let dokument = $state.raw<PdfDokument | null>(null);
  let anzahl = $state(0);
  let verhaeltnis = $state(1.414);
  let bilder = $state<Record<number, string>>({});
  let aktuell = $state(1);
  let verzeichnis = $state(false);
  // Vergrößerung: 1 ist die ganze Breite. Zwei Finger bis 4, Doppeltippen springt zwischen 1 und 2.
  let zoom = $state(1);
  let zuruecksetzen: (() => void) | null = null;

  // Öffnen und Schließen: das PDF laden, die Seite dahinter festhalten.
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

  $effect(() => {
    const d = datei;
    if (!offen || !d) return;
    let abgebrochen = false;
    void d
      .arrayBuffer()
      .then((b) => pdfOeffnen(new Uint8Array(b)))
      .then(async (dok) => {
        if (abgebrochen) return pdfSchliessen(dok);
        const seite = await dok.getPage(1);
        const v = seite.getViewport({ scale: 1 });
        verhaeltnis = v.height / v.width;
        dokument = dok;
        anzahl = dok.numPages;
        aktuell = 1;
      });
    return () => {
      abgebrochen = true;
    };
  });

  $effect(() => {
    if (offen) return;
    for (const url of Object.values(bilder)) URL.revokeObjectURL(url);
    bilder = {};
    verzeichnis = false;
    zoom = 1;
    if (dokument) void pdfSchliessen(dokument);
    dokument = null;
    anzahl = 0;
  });

  // Seiten erst rendern, wenn sie in die Nähe kommen.
  function seiteBeobachten(el: HTMLElement, nummer: number) {
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        if (!eintraege.some((e) => e.isIntersecting) || bilder[nummer] || !dokument) return;
        const breite = Math.min(
          2400,
          Math.round((rolle?.clientWidth || 390) * 2 * Math.min(zoom, 2)),
        );
        void miniatur(dokument, nummer, breite).then((url) => {
          if (!offen) return URL.revokeObjectURL(url);
          bilder = { ...bilder, [nummer]: url };
        });
      },
      { root: rolle, rootMargin: '150% 0px' },
    );
    beobachter.observe(el);
    return { destroy: () => beobachter.disconnect() };
  }

  // Welche Seite gerade gelesen wird: die, deren Oberkante zuletzt über der Mitte lag.
  function gerollt() {
    if (!rolle) return;
    const mitte = rolle.getBoundingClientRect().top + rolle.clientHeight / 3;
    let n = 1;
    for (const el of rolle.querySelectorAll<HTMLElement>('[data-seite]'))
      if (el.getBoundingClientRect().top <= mitte) n = Number(el.dataset.seite);
    aktuell = n;
  }

  // Zwei Finger: Der Punkt der Seite unter den Fingern bleibt dort (wie die Seitenansicht, zweiFinger.ts).
  let geste: { start: number; abstand: number; anteilX: number; anteilY: number } | null = null;
  const punkte = (e: TouchEvent): [Punkt, Punkt] => [
    { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY },
    { x: e.touches[1]!.clientX, y: e.touches[1]!.clientY },
  ];
  function gesteAnfang(e: TouchEvent) {
    if (e.touches.length !== 2 || !rolle) return;
    const [a, b] = punkte(e);
    const m = mitte(a, b);
    const r = rolle.getBoundingClientRect();
    geste = {
      start: zoom,
      abstand: abstand(a, b),
      anteilX: (rolle.scrollLeft + m.x - r.left) / rolle.scrollWidth,
      anteilY: (rolle.scrollTop + m.y - r.top) / rolle.scrollHeight,
    };
  }
  async function gesteZug(e: TouchEvent) {
    if (!geste || e.touches.length !== 2 || !rolle) return;
    e.preventDefault();
    const [a, b] = punkte(e);
    const m = mitte(a, b);
    zoom = stufeNachGeste(geste.start, geste.abstand, abstand(a, b), 1);
    await tick();
    const r = rolle.getBoundingClientRect();
    rolle.scrollLeft = geste.anteilX * rolle.scrollWidth - (m.x - r.left);
    rolle.scrollTop = geste.anteilY * rolle.scrollHeight - (m.y - r.top);
  }
  function gesteEnde(e: TouchEvent) {
    if (!geste || e.touches.length >= 2) return;
    geste = null;
    zoom = einrasten(zoom, [1, 2]);
  }
  function fingerHoeren(el: HTMLElement) {
    const nichtPassiv = { passive: false } as const;
    el.addEventListener('touchstart', gesteAnfang, nichtPassiv);
    el.addEventListener('touchmove', gesteZug, nichtPassiv);
    el.addEventListener('touchend', gesteEnde);
    return {
      destroy() {
        el.removeEventListener('touchstart', gesteAnfang);
        el.removeEventListener('touchmove', gesteZug);
        el.removeEventListener('touchend', gesteEnde);
      },
    };
  }

  async function springen(nummer: number) {
    const ziel = Math.min(Math.max(1, nummer), anzahl);
    verzeichnis = false;
    await tick();
    rolle?.querySelector(`[data-seite="${ziel}"]`)?.scrollIntoView({ block: 'start' });
    aktuell = ziel;
  }

  /** „Deckblatt“ oder „Max · Selbstauskunft“, mit Marke. */
  const abschnitt = $derived.by(() => {
    for (const p of inhalt)
      for (const teil of p.teile)
        if (aktuell >= teil.seite && aktuell <= teil.bis)
          return {
            text: t('mappeLeser.abschnitt', {
              name: marken[p.person]?.kurz ?? p.person,
              unterlage: teil.abschnitt,
            }),
            person: p.person,
          };
    return { text: t('mappeLeser.deckblatt'), person: null };
  });
  const bisTeil = (teil: { seite: number; bis: number }) =>
    teil.bis > teil.seite ? `${teil.seite}–${teil.bis}` : String(teil.seite);
</script>

{#snippet marke(name: string | null)}
  {#if name && marken[name]}
    <span
      class="marke"
      class:umriss={marken[name].buerge}
      style:--farbe={marken[name].farbe}
      aria-hidden="true"
    ></span>
  {/if}
{/snippet}

<dialog
  bind:this={dialog}
  class="leser"
  aria-label={titel}
  onclose={() => (offen = false)}
  oncancel={() => (offen = false)}
>
  <header class="kopf">
    <button
      type="button"
      class="zurueck"
      aria-label={t('mappeLeser.zurueck')}
      onclick={() => (offen = false)}><Symbol name="zurueck" groesse={20} /></button
    >
    <span class="titel">
      <small>{titel}</small>
      <button
        type="button"
        class="leser-abschnitt"
        aria-expanded={verzeichnis}
        aria-controls="leser-verzeichnis"
        onclick={() => (verzeichnis = !verzeichnis)}
      >
        {@render marke(abschnitt.person)}
        <b>{abschnitt.text}</b>
        <span class="pfeil" class:auf={verzeichnis} aria-hidden="true"
          ><Symbol name="ab" groesse={16} /></span
        >
      </button>
    </span>
  </header>

  {#if verzeichnis}
    <button
      type="button"
      class="schleier"
      aria-label={t('mappeLeser.verzeichnisZu')}
      onclick={() => (verzeichnis = false)}
    ></button>
    <nav id="leser-verzeichnis" class="verzeichnis" aria-label={t('mappeLeser.verzeichnis')}>
      <ul>
        <li>
          <button
            type="button"
            class:jetzt={abschnitt.person === null}
            onclick={() => void springen(1)}
            ><span>{t('mappeLeser.deckblatt')}</span><i></i><span class="nr">1</span></button
          >
        </li>
        {#each inhalt as p (p.person + p.seite)}
          <li class="person">{@render marke(p.person)}{marken[p.person]?.kurz ?? p.person}</li>
          {#each p.teile as teil (teil.seite)}
            <li>
              <button
                type="button"
                class:jetzt={aktuell >= teil.seite && aktuell <= teil.bis}
                onclick={() => void springen(teil.seite)}
                ><span>{teil.abschnitt}</span><i></i><span class="nr">{bisTeil(teil)}</span></button
              >
            </li>
          {/each}
        {/each}
      </ul>
    </nav>
  {/if}

  <div
    class="rolle"
    style:--zoom={zoom}
    bind:this={rolle}
    use:fingerHoeren
    onscroll={gerollt}
    ondblclick={() => (zoom = zoom > 1 ? 1 : 2)}
    role="document"
  >
    {#each Array.from({ length: anzahl }, (_, i) => i + 1) as nummer (nummer)}
      <div
        class="seite"
        data-seite={nummer}
        style:aspect-ratio="1 / {verhaeltnis}"
        use:seiteBeobachten={nummer}
      >
        {#if bilder[nummer]}
          <img src={bilder[nummer]} alt={t('mappeLeser.seite', { nummer })} />
        {/if}
      </div>
    {/each}
  </div>

  <div class="unten">
    <div class="blaetterer">
      <button
        type="button"
        aria-label={t('mappeLeser.vorige')}
        disabled={aktuell <= 1}
        onclick={() => void springen(aktuell - 1)}><Symbol name="zurueck" groesse={20} /></button
      >
      <span class="zahl" aria-live="polite"
        >{t('mappeLeser.zahl', { seite: aktuell, seiten: anzahl })}</span
      >
      <button
        type="button"
        aria-label={t('mappeLeser.naechste')}
        disabled={aktuell >= anzahl}
        onclick={() => void springen(aktuell + 1)}><Symbol name="weiter" groesse={20} /></button
      >
    </div>
    <button type="button" class="teilen" aria-label={t('mappeLeser.teilen')} onclick={teilen}
      ><Symbol name="teilen" groesse={20} /></button
    >
  </div>
</dialog>

<style>
  .leser {
    width: 100vw;
    max-width: none;
    height: 100dvh;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: var(--ground);
    color: var(--ink);
  }

  .leser::backdrop {
    background: var(--ground);
  }

  .kopf {
    position: fixed;
    top: 0;
    right: 0;
    left: 0;
    z-index: 3;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    height: calc(96px + env(safe-area-inset-top));
    padding: 0 16px 12px 8px;
    background: var(--ground);
  }

  .zurueck {
    display: grid;
    place-items: center;
    width: var(--tap-target);
    height: var(--tap-target);
    border: 0;
    background: none;
    color: var(--accent-text);
    cursor: pointer;
  }

  .titel {
    display: grid;
    min-width: 0;
  }

  .titel small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .leser-abschnitt {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(16 * var(--px));
    text-align: left;
    cursor: pointer;
  }

  .leser-abschnitt b {
    overflow: hidden;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
    animation: ueberblenden var(--bw-blende) var(--bw-weich);
  }

  @keyframes ueberblenden {
    from {
      opacity: 0;
    }
  }

  .pfeil {
    display: inline-flex;
    transition: transform var(--bw-kurz) var(--bw-ziel);
  }

  .pfeil.auf {
    transform: rotate(180deg);
  }

  .marke {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: var(--farbe);
  }

  .marke.umriss {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--farbe);
  }

  .schleier {
    position: fixed;
    inset: 0;
    z-index: 1;
    border: 0;
    background: rgb(0 0 0 / 0.35);
  }

  .verzeichnis {
    position: fixed;
    top: calc(96px + env(safe-area-inset-top));
    right: 16px;
    left: 16px;
    z-index: 2;
    max-height: calc(100dvh - 200px);
    overflow-y: auto;
    padding: 8px 20px 16px;
    border-radius: 0 0 20px 20px;
    background: var(--surface);
  }

  .verzeichnis ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .verzeichnis .person {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    color: var(--ink-muted);
    font-size: calc(12 * var(--px));
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .verzeichnis button {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    min-height: var(--tap-target);
    padding: 0 0 0 18px;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(15 * var(--px));
    text-align: left;
    cursor: pointer;
  }

  .verzeichnis li:first-child button {
    padding-left: 0;
  }

  .verzeichnis button i {
    flex: 1;
    border-bottom: 1px dotted var(--line-strong);
  }

  .verzeichnis button.jetzt {
    font-weight: 700;
  }

  .nr {
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }

  .rolle {
    position: fixed;
    inset: calc(96px + env(safe-area-inset-top)) 0 0;
    overflow: auto;
    padding: 0 16px calc(96px + env(safe-area-inset-bottom));
    overscroll-behavior: contain;
  }

  .seite {
    width: 100%;
    margin: 0 auto 12px;
    background: #fff;
    box-shadow: 0 0 0 1px var(--line);
  }

  .rolle .seite {
    width: calc(var(--zoom, 1) * 100%);
  }

  .seite img {
    display: block;
    width: 100%;
    height: 100%;
  }

  .unten {
    position: fixed;
    right: 0;
    bottom: calc(16px + env(safe-area-inset-bottom));
    left: 0;
    z-index: 2;
    display: flex;
    justify-content: center;
    gap: 12px;
    pointer-events: none;
  }

  .blaetterer,
  .teilen {
    pointer-events: auto;
    height: 52px;
    border-radius: 26px;
    background: var(--surface);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.14);
  }

  .blaetterer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 140px;
    padding: 0 4px;
  }

  .blaetterer button,
  .teilen {
    display: grid;
    place-items: center;
    width: var(--tap-target);
    height: var(--tap-target);
    border: 0;
    background: none;
    color: var(--ink);
    cursor: pointer;
  }

  .blaetterer button:disabled {
    color: var(--ink-quiet);
    cursor: default;
  }

  .teilen {
    width: 52px;
    height: 52px;
    background: var(--surface);
  }

  .zahl {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
</style>
