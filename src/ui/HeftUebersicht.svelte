<script lang="ts">
  // Übersicht der Hefte (B16 Gruppen, B18 Tageslinie, B21 Fassung 4):
  // „Steht an“ mit der Karte der nächsten Besichtigung, „Warten auf Antwort“, „Gemerkt“, zugeklappt
  // „Keine Antwort“ und „Abgelegt“. Jede Zeile: Titel, Zeit in Worten, Ort und Eckdaten, die Tageslinie.
  // Die Linie ergänzt das Wort und ist für Vorlesehilfen ausgeblendet.
  import { db, stillLaden } from '../app/daten.svelte';
  import { rueckgaengigAnbieten } from '../app/rueckgaengig.svelte';
  import { route } from '../app/router.svelte';
  import { gruppieren, ohneLoeschbitte } from '../domain/heftStand';
  import { heftAendern } from '../storage/speicher';
  import { eckdaten, heftOrt, heftTitel, terminKurz } from '../domain/heftKarte';
  import type { Heft } from '../domain/modell';
  import { HEUTE_LAGE, tageBis, zeile, type Marke, type ZeitWort } from '../domain/tageslinie';
  import { t, type TextSchluessel } from '../i18n';
  import Symbol from './Symbol.svelte';
  import TerminKarte from './TerminKarte.svelte';
  import { terminNaehe } from '../domain/terminNaehe';
  import { naeheWort } from './terminWorte';
  import { zuletzt } from './neuesHeft.svelte';
  import { onMount, untrack } from 'svelte';
  import { daten } from '../app/daten.svelte';
  import { haushaltsNetto } from '../domain/netto';
  import { lageAnwenden } from '../domain/lage';
  import { urteile } from '../domain/urteile';
  import { wohnungAus } from '../lesen/angaben';
  import { plzTabelle } from './plz.svelte';
  import { foto, fotoLaden } from './heftFoto.svelte';
  import { flugFuer, landen, merken, wartendesHeft } from './heftFlug';

  let { hefte, jetzt }: { hefte: Heft[]; jetzt: Date } = $props();

  // ---------- B28b: Urteile mit Zeichen und Daumenbild auf jeder Karte ----------

  const ihr = $derived(
    !daten.ansicht ||
      daten.ansicht.mitglieder.filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length > 1,
  );
  const URTEIL_REIHE = ['nicht', 'knapp', 'offen'] as const;
  /** Höchstens zwei Abweichungen; passt alles, „Passt zu euren Wünschen“ (DP21). */
  function wunschMarken(h: Heft): { art: string; text: string }[] {
    const hh = daten.ansicht?.haushalt;
    if (!h.angaben || !hh?.wuensche) return [];
    const w = lageAnwenden(wohnungAus(h.angaben), h.adresse, hh.wuensche, plzTabelle());
    const u = urteile(w.w, w.wu, {
      netto: haushaltsNetto(hh, daten.ansicht?.mitglieder ?? []),
      grenze: hh.mietgrenze ?? null,
      ihr,
    });
    const ab = URTEIL_REIHE.flatMap((art) => u.filter((x) => x.art === art))
      .slice(0, 2)
      .map((x) => ({ art: x.art, text: x.kriterium }));
    if (ab.length) return ab;
    if (!u.some((x) => x.art === 'passt')) return [];
    return [
      { art: 'passt', text: t(ihr ? 'vorschau.passtIhr' : 'vorschau.passtDu').replace(/\.$/, '') },
    ];
  }

  $effect(() => {
    const ids = hefte.map((h) => h.foto);
    untrack(() => ids.forEach((fid) => void fotoLaden(fid)));
  });

  // Muster „Heft aufschlagen“ (Handbuch 3.9): Beim Tipp auf eine Karte hält die Liste ihr Abbild fest; das
  // Heft landet den Flug. Zurück aus dem Heft landet die Liste ihn.
  let liste = $state<HTMLElement | null>(null);
  function seiteVon(el: Element): HTMLElement {
    return (el.closest('main') as HTMLElement | null) ?? (el as HTMLElement);
  }
  function teileOhne(karte: Element): Element[] {
    const seite = seiteVon(karte);
    return [
      ...[...seite.children].filter((c) => !c.contains(karte)),
      ...(liste
        ? [...liste.querySelectorAll('.gr, .bl, .z')].filter(
            (c) => !c.contains(karte) && c !== karte,
          )
        : []),
      ...karte.querySelectorAll('.e, .i, .wm, .tl, .w'),
    ];
  }
  /** Der Daumen, wenn er zu sehen ist; in sehr schmalen Listen fällt er weg, dann blendet der Flug über. */
  function daumen(karte: HTMLElement): HTMLElement | null {
    const d = karte.querySelector<HTMLElement>('.daumen');
    return d && d.getBoundingClientRect().width > 0 ? d : null;
  }
  function aufschlagenVon(e: MouseEvent, h: Heft) {
    const karte = e.currentTarget as HTMLElement;
    merken({
      nach: 'heft',
      heftId: h.id,
      seite: seiteVon(karte),
      bild: daumen(karte),
      name: karte.querySelector('.ti'),
      teile: teileOhne(karte),
    });
  }
  onMount(() => {
    const id = wartendesHeft();
    if (!flugFuer('liste') || !liste || !id) return;
    const karte = liste.querySelector<HTMLElement>(`[data-heft-karte="${CSS.escape(id)}"]`);
    if (!karte) return;
    void landen({
      nach: 'liste',
      seite: seiteVon(karte),
      bild: daumen(karte),
      name: karte.querySelector('.ti'),
      teile: teileOhne(karte),
    });
  });

  const g = $derived(gruppieren(hefte, jetzt));
  const imSpiel = $derived(g.stehtAn.length + g.wartet.length + g.gemerkt.length);

  // Die große Karte: die nächste Besichtigung, die noch kommt. Vergangene ohne Ergebnis bleiben Zeilen.
  const naechste = $derived(g.stehtAn.find((h) => tageBis(h.ereignisse.termin!.am, jetzt) >= 0));
  const stehtAnZeilen = $derived(g.stehtAn.filter((h) => h !== naechste));

  let offen = $state<'keine' | 'abgelegt' | null>(null);

  // „Alle ablegen“ bei „Keine Antwort“ (Planung 09a): erst ab drei Heften, davor die Zahl ohne
  // Löschbitte als Auskunft, kein Hindernis. Danach „Rückgängig“ bis zur nächsten Handlung.
  const ALLE_AB = 3;
  const loeschbitteFehlt = $derived(ohneLoeschbitte(g.keineAntwort));
  async function alleAblegen() {
    const vorher = g.keineAntwort.map((h) => ({
      id: h.id,
      ereignisse: $state.snapshot(h.ereignisse),
    }));
    const am = new Date().toISOString();
    const verbindung = await db();
    for (const v of vorher)
      await heftAendern(verbindung, v.id, { ereignisse: { ...v.ereignisse, abgelegtAm: am } });
    await stillLaden();
    rueckgaengigAnbieten({
      text: t('hefte.alleAbgelegt', { anzahl: vorher.length }),
      seite: route.pfad,
      ausfuehren: async () => {
        const v2 = await db();
        for (const v of vorher) await heftAendern(v2, v.id, { ereignisse: v.ereignisse });
        await stillLaden();
      },
    });
  }

  function wort(w: ZeitWort): string {
    return t(w.schluessel as TextSchluessel, w.werte ?? {});
  }

  function zweiteZeile(h: Heft): string {
    const ort = heftOrt(h);
    const eck = eckdaten(h);
    return [ort, eck || t('hefte.eckdatenFehlen')].filter(Boolean).join(' · ');
  }

  function infoZeile(h: Heft, art: string): string | null {
    const termin = h.ereignisse.termin;
    if (!termin) return null;
    if (art === 'termin')
      return [t('hefte.besichtigung', { wann: terminKurz(termin.am, true) }), termin.ort]
        .filter(Boolean)
        .join(' · ');
    return null;
  }

  function linie(m: Marke): { klasse: string; stil: string }[] {
    const hz = { klasse: 'l-hz', stil: `left:${HEUTE_LAGE}%` };
    const ax = { klasse: 'l-ax', stil: '' };
    switch (m.art) {
      case 'termin':
        return [
          ax,
          { klasse: 'l-lt', stil: `left:${HEUTE_LAGE}%;width:${m.punkt - HEUTE_LAGE}%` },
          { klasse: 'l-pt', stil: `left:${m.punkt}%` },
          hz,
        ];
      case 'tun':
        return [
          ax,
          { klasse: 'l-lt tun', stil: `left:${m.raute}%;width:${HEUTE_LAGE - m.raute}%` },
          { klasse: 'l-dm', stil: `left:${m.raute}%` },
          hz,
        ];
      case 'wartet':
      case 'keine':
        return [
          ax,
          { klasse: 'l-w3', stil: `left:${m.dreiWochen}%` },
          {
            klasse: m.art === 'keine' ? 'l-bar ka' : 'l-bar',
            stil: `left:${m.von}%;width:${HEUTE_LAGE - m.von}%`,
          },
          hz,
        ];
      case 'gemerkt':
        return [ax, { klasse: 'l-rg', stil: `left:${m.ring}%` }, hz];
      default:
        return [ax, hz];
    }
  }

  function ergebnisWort(h: Heft): string {
    const art = h.ereignisse.ergebnis?.art;
    return t(art ? `hefte.ergebnis.${art}` : 'hefte.ergebnis.abgelegt');
  }
</script>

{#snippet zeileVon(h: Heft)}
  {@const z = zeile(h.ereignisse, h.createdAt, jetzt)}
  {@const titel = heftTitel(h)}
  {@const info = infoZeile(h, z.art)}
  <!-- Bewegung beim Neuen (Zeile 6, Design 12.11.): die Zeile des eben angelegten Hefts, einmal. -->
  {@const fo = foto(h.foto)}
  {@const marken = wunschMarken(h)}
  <a
    class="z {z.art}"
    class:neu={h.id === zuletzt.heftId}
    href={`#/heft/${h.id}`}
    data-heft-karte={h.id}
    onclick={(e) => aufschlagenVon(e, h)}
    onanimationend={(e) => {
      // Erst wenn das Steigen fertig ist; das Überblenden für „Bewegung reduzieren“ endet früher.
      if (e.animationName === 'bw-hoch' && h.id === zuletzt.heftId) zuletzt.heftId = null;
    }}
  >
    <span class="daumen" data-foto={fo.zustand} aria-hidden="true"
      >{#if fo.url}<img src={fo.url} alt="" />{/if}</span
    >
    <span class="text">
      <span class="k">
        <b class="ti" class:str={titel.strasse}>{titel.text}</b>
        {#if z.art === 'termin' && h.ereignisse.termin}
          <!-- Dieselben Wörter wie der Reiter der Terminkarte, heute und morgen in Violett (Planung 12w). -->
          {@const n = terminNaehe(h.ereignisse.termin.am, jetzt)}
          <span class="w termin {n.art}">{naeheWort(n)}</span>
        {:else}
          <span class="w {z.art}">{wort(z.wort)}</span>
        {/if}
      </span>
      <small class="e">{zweiteZeile(h)}</small>
      {#if z.art === 'tun' && h.ereignisse.termin}
        <span class="i"
          >{t('hefte.besichtigtAm', { datum: terminKurz(h.ereignisse.termin.am, false) })} ·
          <b>{t('hefte.wieAusgegangen')}</b></span
        >
      {:else if info}
        <span class="i termin">{info}</span>
      {/if}
      <span class="tl" aria-hidden="true">
        {#each linie(z.marke) as l, i (i)}<i class={l.klasse} style={l.stil}></i>{/each}
      </span>
      {#if marken.length}
        <span class="wm"
          >{#each marken as m (m.text)}<span class="urteil {m.art}">{m.text}</span>{/each}</span
        >
      {/if}
    </span>
  </a>
{/snippet}

{#snippet gruppe(art: 'termin' | 'wartet' | 'gemerkt', titel: string, anzahl: number)}
  <h2 class="gr">
    <span class="gz {art}" aria-hidden="true"><i></i></span>
    <span>{titel}</span>
    <span class="n">{anzahl}</span>
  </h2>
{/snippet}

<p class="sub">
  {imSpiel ? t('hefte.imSpiel', { anzahl: imSpiel }) : t('hefte.keineImSpiel')}
</p>

<div class="hefte" bind:this={liste}>
  {#if g.stehtAn.length}
    {@render gruppe('termin', t('hefte.stehtAn'), g.stehtAn.length)}
    {#if naechste}
      <TerminKarte heft={naechste} {jetzt} href={`#/heft/${naechste.id}`} />
    {/if}
    {#if stehtAnZeilen.length}
      <div class="bl st">
        {#each stehtAnZeilen as h (h.id)}{@render zeileVon(h)}{/each}
      </div>
    {/if}
  {/if}

  {#if g.wartet.length}
    {@render gruppe('wartet', t('hefte.wartet'), g.wartet.length)}
    <div class="bl wa">
      {#each g.wartet as h (h.id)}{@render zeileVon(h)}{/each}
    </div>
  {/if}

  {#if g.gemerkt.length}
    {@render gruppe('gemerkt', t('hefte.gemerkt'), g.gemerkt.length)}
    <div class="bl gm">
      {#each g.gemerkt as h (h.id)}{@render zeileVon(h)}{/each}
    </div>
  {/if}

  {#if g.keineAntwort.length}
    <button
      class="auf"
      type="button"
      aria-expanded={offen === 'keine'}
      onclick={() => (offen = offen === 'keine' ? null : 'keine')}
    >
      <span>{t('hefte.keineAntwort')}</span><span class="an">{g.keineAntwort.length}</span>
      <Symbol name={offen === 'keine' ? 'auf' : 'ab'} groesse={20} />
    </button>
    {#if offen === 'keine'}
      <div class="bl ke">
        {#each g.keineAntwort as h (h.id)}{@render zeileVon(h)}{/each}
      </div>
      {#if g.keineAntwort.length >= ALLE_AB}
        <div class="alle">
          {#if loeschbitteFehlt}
            <p>{t('hefte.ohneLoeschbitte', { anzahl: loeschbitteFehlt })}</p>
          {/if}
          <button type="button" class="alle-ab" onclick={alleAblegen}
            >{t('hefte.alleAblegen', { anzahl: g.keineAntwort.length })}</button
          >
        </div>
      {/if}
    {/if}
  {/if}

  {#if g.abgelegt.length}
    <button
      class="auf"
      type="button"
      aria-expanded={offen === 'abgelegt'}
      onclick={() => (offen = offen === 'abgelegt' ? null : 'abgelegt')}
    >
      <span>{t('hefte.abgelegt')}</span><span class="an">{g.abgelegt.length}</span>
      <Symbol name={offen === 'abgelegt' ? 'auf' : 'ab'} groesse={20} />
    </button>
    {#if offen === 'abgelegt'}
      <div class="leise">
        {#each g.abgelegt as h (h.id)}
          <a class="lz" href={`#/heft/${h.id}`}
            ><b>{heftTitel(h).text}</b><span>{ergebnisWort(h)}</span></a
          >
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .alle {
    margin: 4px 0 12px;
    padding: 0 var(--space-1);
  }

  .alle p {
    margin: 0 0 4px;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }

  .alle-ab {
    min-height: var(--tap-target);
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .sub {
    margin: 0 0 4px;
    color: var(--ink-muted);
  }

  .gr {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 24px 0 8px;
    color: var(--ink-muted);
    font-size: calc(13.5 * var(--px));
    font-weight: 650;
  }

  .gr .n {
    margin-left: auto;
    font-weight: 600;
  }

  .gz {
    position: relative;
    flex: none;
    width: 18px;
    height: 10px;
  }

  .gz i {
    position: absolute;
  }

  .gz.termin i {
    top: 1px;
    left: 5px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--termin);
  }

  .gz.wartet i {
    top: 3.5px;
    right: 1px;
    left: 1px;
    height: 3px;
    border-radius: 2px;
    background: var(--ink-quiet);
  }

  .gz.gemerkt i {
    top: 1px;
    left: 5px;
    box-sizing: border-box;
    width: 8px;
    height: 8px;
    border: 1.5px solid var(--ink-quiet);
    border-radius: 50%;
  }

  .bl {
    overflow: hidden;
    container-type: inline-size;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .bl.st {
    margin-top: 8px;
    box-shadow: inset 3px 0 0 var(--termin);
  }

  .bl.gm {
    border-style: dashed;
    border-color: var(--line-strong);
    background: transparent;
  }

  .bl.ke {
    margin: 4px 0 8px;
  }

  .z {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    min-height: 56px;
    padding: 11px 14px 10px;
    border-top: 1px solid var(--line);
    color: var(--ink);
    text-decoration: none;
  }

  .z:first-child {
    border-top: 0;
  }

  .bl.gm .z {
    border-top: 1px dashed var(--line-strong);
  }

  .bl.gm .z:first-child {
    border-top: 0;
  }

  /* B28b: Daumenbild der Karte; Heft aufschlagen fliegt von hier zum Foto im Kopf. */
  .daumen {
    position: relative;
    flex: none;
    overflow: hidden;
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: var(--accent-soft);
  }

  /* Sehr schmal (320 px mit großer Schrift): Der Titel braucht den Platz, der Daumen fällt weg. */
  @container (max-width: 260px) {
    .daumen {
      display: none;
    }
  }

  .daumen[data-foto='laedt'] {
    background: var(--foto-grund);
  }

  .daumen img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .text {
    display: block;
    flex: 1;
    min-width: 0;
  }

  .wm {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 7px;
  }

  .k {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0 10px;
  }

  /* Der Titel hat die ganze Breite neben dem Daumen (DP21, .wkarte); das Wort zum Stand steht darunter. */
  .ti {
    flex: 1 1 100%;
    min-width: 0;
    font-size: calc(15.5 * var(--px));
    font-weight: 650;
    line-height: 1.25;
  }

  .ti.str {
    font-weight: 600;
  }

  .w {
    flex: none;
    font-size: calc(13.5 * var(--px));
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    white-space: nowrap;
  }

  .w.termin {
    color: var(--termin);
  }

  /* Heute und morgen als kleine Marke im Aussehen des Reiters, ringsum gerundet (B25 n1). */
  .w.termin.heute,
  .w.termin.morgen {
    padding: 1px 8px;
    border: 1px solid var(--nah-linie);
    border-radius: 7px;
    background: var(--nah-hell);
    color: var(--nah-text);
    font-size: calc(11 * var(--px));
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .w.termin.heute {
    border-color: var(--nah);
    background: var(--nah);
    color: var(--nah-auf);
  }

  .w.tun {
    color: var(--accent-text);
  }

  .w.wartet {
    color: var(--ink);
  }

  .w.gemerkt,
  .w.keine {
    color: var(--ink-muted);
    font-weight: 500;
  }

  .e {
    display: block;
    margin-top: 1px;
    color: var(--ink-muted);
    font-size: calc(13.5 * var(--px));
  }

  .i {
    display: block;
    margin-top: 2px;
    color: var(--ink-muted);
    font-size: calc(13.5 * var(--px));
  }

  .i.termin {
    color: var(--termin);
    font-weight: 600;
  }

  .i b {
    color: var(--accent-text);
    font-weight: 650;
  }

  .tl {
    position: relative;
    display: block;
    height: 10px;
    margin-top: 8px;
  }

  .tl i {
    position: absolute;
    display: block;
  }

  .tl :global(.l-ax) {
    top: 4.5px;
    right: 0;
    left: 0;
    height: 1px;
    background: var(--line-strong);
  }

  .tl :global(.l-hz) {
    top: 0;
    width: 1.5px;
    height: 10px;
    margin-left: -0.75px;
    border-radius: 1px;
    background: var(--ink-muted);
  }

  .tl :global(.l-w3) {
    top: 2.5px;
    width: 1px;
    height: 5px;
    margin-left: -0.5px;
    background: var(--ink-quiet);
    opacity: 0.7;
  }

  .tl :global(.l-bar) {
    top: 3.5px;
    height: 3px;
    border-radius: 2px;
    background: var(--ink-quiet);
  }

  .tl :global(.l-bar.ka) {
    background: repeating-linear-gradient(90deg, var(--ink-quiet) 0 3px, transparent 3px 6px);
  }

  .tl :global(.l-lt) {
    top: 4px;
    height: 0;
    border-top: 1.5px dotted var(--termin);
    opacity: 0.75;
  }

  .tl :global(.l-lt.tun) {
    border-top-color: var(--accent);
  }

  .tl :global(.l-pt) {
    top: 1px;
    width: 8px;
    height: 8px;
    margin-left: -4px;
    border-radius: 50%;
    background: var(--termin);
  }

  .tl :global(.l-rg) {
    top: 1px;
    box-sizing: border-box;
    width: 8px;
    height: 8px;
    margin-left: -4px;
    border: 1.5px solid var(--ink-quiet);
    border-radius: 50%;
    background: var(--ground);
  }

  .tl :global(.l-dm) {
    top: 1.5px;
    width: 7px;
    height: 7px;
    margin-left: -3.5px;
    border-radius: 1px;
    background: var(--accent);
    transform: rotate(45deg);
  }

  .auf {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 52px;
    margin-top: 14px;
    padding: 0;
    border: 0;
    border-top: 1px solid var(--line);
    background: none;
    color: var(--ink-muted);
    font: inherit;
    font-size: calc(15 * var(--px));
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }

  .auf + .auf,
  .bl + .auf,
  .leise + .auf {
    margin-top: 0;
  }

  .auf span:first-child {
    flex: 1;
  }

  .an {
    font-weight: 400;
  }

  .leise {
    display: flex;
    flex-direction: column;
    margin-bottom: 8px;
  }

  .lz {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 48px;
    border-top: 1px solid var(--line);
    color: var(--ink-muted);
    text-decoration: none;
  }

  .lz b {
    min-width: 0;
    font-weight: 600;
  }

  .lz span {
    flex: none;
    font-size: calc(13.5 * var(--px));
  }

  .z.neu {
    animation:
      bw-hoch var(--bw-mittel) var(--bw-ziel) var(--bw-takt) backwards,
      bw-blende var(--bw-nur-reduziert) var(--bw-gleich) backwards;
  }
</style>
