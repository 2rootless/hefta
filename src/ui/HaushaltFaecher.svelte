<script lang="ts">
  // W57/W54, Bedienung R1 „Fächer“ (PC199, E372; DP127, DP128, DP129). Vier Fächer, immer sichtbar, auch leer.
  // Die Ansprechperson per Wahlpunkt; Verschieben am Griff mit Vorschau (der Platzhalter zeigt das Ziel, das Fach
  // wird einen Ton dunkler), Loslassen übernimmt genau den Stand der Vorschau (kein Rücksprung, G9). Ohne Ziehen:
  // Tipp oder Eingabetaste auf den Griff klappt die Ziele in der Zeile auf (W54). Danach eine Zeile mit der Folge und
  // „Rückgängig“ (G5). Würde der Vertrag leer, fragt die Liste, wer hineinkommt (W42). Kinder als eigene Zeilen mit
  // Kind-Zeichen, ohne Griff, ohne Namen (Auftraggeber 24.11.: Namen später).
  import { tick } from 'svelte';
  import { daten } from '../app/daten.svelte';
  import {
    FAECHER,
    ansprech,
    imFach,
    kandidaten,
    verschieben,
    vorschau,
    ziele,
    type Eintrag,
    type Fach,
  } from '../domain/faecher';
  import { t } from '../i18n';
  import { FaecherAktion } from './faecherAktion.svelte';
  import { tonStil } from './personTon';

  const GRIFF =
    '<svg viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M8 11h16M8 16h16M8 21h16"/></svg>';
  // DP129: Kind-Zeichen im Hefta-Strich (2,4 auf 32), Kopf und Schultern.
  const KIND =
    '<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="16" cy="11.5" r="5.2"/><path d="M10 26.5c0-3.7 2.7-6.4 6-6.4s6 2.7 6 6.4"/></svg>';

  // Wie früher „Rolle ändern“: zurück in den Haushalt, in der Einrichtung zurück in Schritt 2.
  let { suffix = '' }: { suffix?: string } = $props();
  const ansicht = $derived(daten.ansicht);
  let wurzel = $state<HTMLElement | null>(null);
  const aktion = new FaecherAktion(
    () => wurzel,
    (f) => mitFlip(f),
  );
  const liste = $derived(aktion.liste);
  const kinder = $derived(ansicht?.haushalt.kinder ?? 0);
  // Weitere Erwachsene ohne eigene Person (nur gezählt): die Zahl minus die Personen, die nur mit einziehen.
  const weitereOhne = $derived(
    Math.max(0, (ansicht?.haushalt.weitereErwachsene ?? 0) - imFach(liste, 'nurmit').length),
  );

  let offen = $state<string | null>(null);
  let neuerName = $state('');

  // ---------- Ziehen ----------
  interface Zug {
    id: string;
    x0: number;
    y0: number;
    dx: number;
    dy: number;
    breite: number;
    los: boolean;
    flug?: HTMLElement;
    ziel?: Fach | 'ansprech';
    stelle?: number;
    vorschau?: Eintrag[];
  }
  let zug = $state<Zug | null>(null);
  let klickSperre = false;
  const angezeigt = $derived(zug?.vorschau ?? liste);
  const an = $derived(ansprech(angezeigt));

  /** Dauer aus den Bewegungs-Tokens (E58); bei „Bewegung reduzieren“ setzen die Tokens 0. */
  function dauer(token = '--bw-mittel'): number {
    // Der Bau schreibt „200ms“ als „.2s“: die Einheit zählt (G8 fand 0,2 ms).
    const w = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    const n = Number.parseFloat(w) || 0;
    return w.endsWith('ms') ? n : w.endsWith('s') ? n * 1000 : n;
  }

  /** Ruhige Umordnung (FLIP, 200 ms, bei „Bewegung reduzieren“ sofort). */
  async function mitFlip(f: () => void) {
    // nur für diese eine Messung, nicht reaktiv
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const alt = new Map<string, DOMRect>();
    wurzel?.querySelectorAll<HTMLElement>('[data-id]').forEach((e) => {
      alt.set(e.dataset.id!, e.getBoundingClientRect());
    });
    f();
    await tick();
    const d = dauer();
    if (!d) return;
    wurzel?.querySelectorAll<HTMLElement>('[data-id]').forEach((e) => {
      const a = alt.get(e.dataset.id!);
      if (!a) return;
      const b = e.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (dx || dy)
        e.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], {
          duration: d,
          easing: 'ease',
        });
    });
  }

  async function nach(id: string, ziel: Fach | 'ansprech', stelle?: number) {
    offen = null;
    await aktion.nach(id, ziel, stelle);
  }

  async function beantworten(wer: string | { neu: string }) {
    if (await aktion.beantworten(wer)) neuerName = '';
  }

  async function griffTipp(id: string) {
    if (klickSperre) return;
    offen = offen === id ? null : id;
    await tick();
    const erstes = wurzel?.querySelector<HTMLElement>(`[data-ziele="${id}"] button`);
    (offen && erstes
      ? erstes
      : wurzel?.querySelector<HTMLElement>(`[data-griff="${id}"]`)
    )?.focus();
  }

  function zielBei(x: number, y: number): { fach: Fach; stelle: number } | null {
    for (const el of wurzel?.querySelectorAll<HTMLElement>('[data-gruppe]') ?? []) {
      const r = el.getBoundingClientRect();
      if (y < r.top - 12 || y > r.bottom + 12) continue;
      const fach = el.dataset.gruppe as Fach;
      const zeilen = [...el.querySelectorAll<HTMLElement>('[data-id]')].filter(
        (k) => k.dataset.id !== zug?.id,
      );
      let stelle = zeilen.length;
      for (let n = 0; n < zeilen.length; n++) {
        const b = zeilen[n]!.getBoundingClientRect();
        if (y < b.top + b.height / 2) {
          stelle = n;
          break;
        }
      }
      return { fach, stelle };
    }
    return null;
  }

  function runter(ev: PointerEvent, id: string) {
    const zeile = wurzel?.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (!zeile) return;
    const r = zeile.getBoundingClientRect();
    zug = {
      id,
      x0: ev.clientX,
      y0: ev.clientY,
      dx: ev.clientX - r.left,
      dy: ev.clientY - r.top,
      breite: r.width,
      los: false,
    };
    window.addEventListener('pointermove', bewegen);
    window.addEventListener('pointerup', hoch, { once: true });
  }

  function bewegen(ev: PointerEvent) {
    const z = zug;
    if (!z) return;
    if (!z.los) {
      if (Math.hypot(ev.clientX - z.x0, ev.clientY - z.y0) < 8) return;
      z.los = true;
      offen = null;
      const el = wurzel?.querySelector<HTMLElement>(`[data-id="${z.id}"]`);
      if (el) {
        const f = el.cloneNode(true) as HTMLElement;
        f.classList.add('flug');
        f.style.width = `${z.breite}px`;
        f.removeAttribute('data-id');
        f.setAttribute('aria-hidden', 'true');
        document.body.appendChild(f);
        z.flug = f;
      }
    }
    if (z.flug) {
      z.flug.style.left = `${ev.clientX - z.dx}px`;
      z.flug.style.top = `${ev.clientY - z.dy}px`;
    }
    const ziel = zielBei(ev.clientX, ev.clientY);
    if (ziel && (ziel.fach !== z.ziel || ziel.stelle !== z.stelle)) {
      void mitFlip(() => {
        zug = {
          ...z,
          ziel: ziel.fach,
          stelle: ziel.stelle,
          vorschau: vorschau(liste, z.id, ziel.fach, ziel.stelle),
        };
      });
    }
  }

  async function hoch() {
    window.removeEventListener('pointermove', bewegen);
    const z = zug;
    if (!z) return;
    if (!z.los) {
      zug = null;
      return;
    }
    klickSperre = true;
    setTimeout(() => (klickSperre = false), 0);
    const platz = wurzel
      ?.querySelector<HTMLElement>(`[data-id="${z.id}"]`)
      ?.getBoundingClientRect();
    const flug = z.flug;
    const d = dauer('--bw-kurz');
    if (flug && platz && d) {
      // DP128: Die Karte gleitet höchstens 160 ms auf den Platzhalter; der Stand der Vorschau bleibt stehen.
      const a = flug.animate(
        [
          { left: flug.style.left, top: flug.style.top },
          { left: `${platz.left}px`, top: `${platz.top}px` },
        ],
        { duration: d, easing: 'ease-out', fill: 'forwards' },
      );
      a.onfinish = () => flug.remove();
    } else flug?.remove();
    const vorschauStand = z.vorschau;
    if (!z.ziel || !vorschauStand) {
      zug = null;
      return;
    }
    // Genau den Stand der Vorschau übernehmen (G9): `gesetzt` vor dem Ende des Zugs, damit nichts zurückspringt.
    const stelle = imFach(vorschauStand, z.ziel as Fach).findIndex((x) => x.id === z.id);
    const r = verschieben(liste, z.id, z.ziel as Fach, stelle);
    if ('frage' in r) {
      zug = null;
      await mitFlip(() => (aktion.frage = r.frage));
      return;
    }
    // Den Stand davor merken, bevor die Anzeige den neuen zeigt: sonst holt „Rückgängig“ nichts zurück (G5).
    const davor = aktion.liste;
    aktion.gesetzt = r.liste;
    zug = null;
    if (r.folgen.length) await aktion.anwenden(r, davor);
    else await nach(z.id, z.ziel as Fach, stelle);
  }

  function taste(ev: KeyboardEvent) {
    if (ev.key === 'Escape' && (offen || aktion.frage)) {
      const id = offen;
      offen = null;
      aktion.frage = null;
      if (id) wurzel?.querySelector<HTMLElement>(`[data-griff="${id}"]`)?.focus();
    }
  }
</script>

<svelte:window onkeydown={taste} />

<div class="faecher" bind:this={wurzel}>
  <p class="satz">{t('faecher.satz')}</p>
  {#each FAECHER as fach (fach)}
    {@const drin = imFach(angezeigt, fach)}
    {@const extra = fach === 'nurmit' ? weitereOhne + kinder : 0}
    <div class="kopf">
      <h2>{t(`faecher.fach.${fach}`)}</h2>
      <span>{drin.length + extra || ''}</span>
    </div>
    <div
      class="gruppe"
      class:ziel={zug?.los && zug.ziel === fach}
      class:weg={fach === 'weg'}
      data-gruppe={fach}
    >
      {#if !drin.length && !extra}
        <p class="leer">{t(`faecher.leer.${fach}`)}</p>
      {/if}
      {#each drin as p (p.id)}
        {@const istAn = an?.id === p.id}
        <div class="zeile" class:platz={zug?.los && zug.id === p.id} data-id={p.id}>
          <span class="zeichen person-ton" style={tonStil(p.farbe)} aria-hidden="true"
            >{p.name.slice(0, 1)}</span
          >
          <!-- Der Name führt zur Personenseite (Angaben, Unterlagen, ganz löschen); verschoben wird am Griff. -->
          <a class="text" href="#/person-aendern/{p.personId}{suffix}">
            <b>{p.name}</b>
            {#if istAn}<span class="marke">{t('faecher.ansprechMarke')}</span>{/if}
          </a>
          {#if fach === 'vertrag'}
            <button
              type="button"
              class="ap"
              role="radio"
              aria-checked={istAn}
              aria-label={t('faecher.apLabel', { name: p.name })}
              onclick={() => !istAn && nach(p.id, 'ansprech')}
              ><i></i><span class="apt" aria-hidden="true">{t('faecher.ansprechMarke')}</span
              ></button
            >
          {/if}
          <button
            type="button"
            class="griff"
            data-griff={p.id}
            aria-label={t('faecher.griffLabel', { name: p.name })}
            aria-expanded={offen === p.id}
            onpointerdown={(e) => runter(e, p.id)}
            onclick={() => griffTipp(p.id)}
          >
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- festes Zeichen ohne Daten -->
            {@html GRIFF}
          </button>
        </div>
        {#if offen === p.id}
          <div
            class="ziele"
            role="group"
            data-ziele={p.id}
            aria-label={t('faecher.zieleLabel', { name: p.name })}
          >
            {#each ziele(liste, p.id) as z (z)}
              <button
                type="button"
                data-z={z}
                class:ap-ziel={z === 'ansprech'}
                onclick={() => nach(p.id, z)}
                >{z === 'ansprech' ? t('faecher.ansprech') : t(`faecher.fach.${z}`)}</button
              >
            {/each}
          </div>
        {/if}
      {/each}
      {#if fach === 'nurmit'}
        {#each Array.from({ length: weitereOhne }, (_, i) => i) as i (`w${i}`)}
          <div class="zeile" data-kind="1">
            <span class="zeichen leer-zeichen" aria-hidden="true"></span>
            <div class="text">
              <b>{t('faecher.weitere')}</b><span>{t('faecher.weitereUnter')}</span>
            </div>
          </div>
        {/each}
        {#each Array.from({ length: kinder }, (_, i) => i) as i (`k${i}`)}
          <div class="zeile" data-kind="1">
            <span class="zeichen kind" aria-hidden="true">
              <!-- eslint-disable-next-line svelte/no-at-html-tags -- festes Zeichen ohne Daten -->
              {@html KIND}
            </span>
            <div class="text"><b>{t('faecher.kind')}</b><span>{t('faecher.kindUnter')}</span></div>
          </div>
        {/each}
      {/if}
      {#if fach === 'vertrag' && aktion.frage}
        {@const gefragt = liste.find((x) => x.id === aktion.frage?.id)}
        <div class="frage">
          <p>{t('faecher.frageNur', { name: gefragt?.name ?? '' })}</p>
          <p class="f">{t('faecher.frage')}</p>
          <div class="wahl">
            {#each kandidaten(liste) as k (k.id)}
              <button type="button" onclick={() => beantworten(k.id)}>{k.name}</button>
            {/each}
            <button type="button" onclick={() => (aktion.frage = null)}
              >{t('faecher.dochNicht')}</button
            >
          </div>
          <div class="neu">
            <input
              bind:value={neuerName}
              placeholder={t('faecher.neuePerson')}
              aria-label={t('faecher.neuePerson')}
              autocomplete="off"
              onkeydown={(e) => e.key === 'Enter' && beantworten({ neu: neuerName })}
            />
            <button type="button" class="ok" onclick={() => beantworten({ neu: neuerName })}
              >{t('faecher.dazu')}</button
            >
          </div>
        </div>
      {/if}
    </div>
  {/each}
  {#if aktion.folge}
    <div class="folge" role="status">
      <p>{aktion.folge}</p>
      <button type="button" class="rueck" onclick={() => aktion.rueckgaengig()}
        >{t('faecher.rueckgaengig')}</button
      >
    </div>
  {/if}
</div>

<style>
  .faecher {
    /* wie die anderen Teile der Seite: 16 px Rand (W22) */
    margin: var(--space-4) var(--space-4) 0;
    /* Die schmale Fassung richtet sich nach dem Platz der Fächer in Schriftgrößen (unten), nicht nach dem Fenster. */
    container: faecher / inline-size;
    font-size: calc(17 * var(--px));
    user-select: none;
    -webkit-user-select: none;
  }
  .satz {
    margin: var(--space-2) 0 0;
    color: var(--ink-muted);
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
  }
  .kopf {
    margin-top: var(--space-6);
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: calc(12 * var(--px));
    line-height: calc(16 * var(--px));
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--ink-muted);
  }
  .kopf h2 {
    font: inherit;
    text-transform: uppercase;
    margin: 0;
  }
  .gruppe {
    margin-top: var(--space-2);
    border-radius: 22px;
    min-height: 52px;
    padding: var(--space-1);
    background: var(--track);
    transition: background-color var(--bw-mittel) var(--bw-weich);
  }
  .gruppe.ziel {
    background: var(--line-strong);
  }
  .leer {
    display: flex;
    align-items: center;
    margin: 0;
    min-height: 52px;
    padding: var(--space-2) var(--space-4);
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }
  .zeile {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 64px;
    padding: var(--space-2) var(--space-1) var(--space-2) var(--space-4);
    background: var(--surface);
    border-radius: 16px;
  }
  .zeile + .zeile,
  .ziele + .zeile {
    margin-top: var(--space-1);
  }
  .zeichen {
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-weight: 700;
    font-size: calc(15 * var(--px));
    background: var(--p-app);
    color: var(--on-person);
  }
  .zeichen.kind,
  .zeichen.leer-zeichen {
    background: var(--surface);
    border: 2px solid var(--ink-quiet);
    color: var(--ink);
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  a.text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    align-self: stretch;
    min-height: 44px;
    color: inherit;
    text-decoration: none;
    border-radius: 6px;
  }
  a.text:focus-visible {
    outline: 0;
    box-shadow: 0 3px 0 0 var(--ink);
  }
  .text b {
    display: block;
    font-weight: 700;
    overflow-wrap: break-word;
    hyphens: manual;
  }
  .text span {
    display: block;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }
  .text .marke {
    display: inline-block;
    max-width: 100%;
    margin-top: var(--space-1);
    padding: 0 var(--space-2);
    border: 1px solid var(--ink);
    border-radius: 999px;
    font-weight: 700;
    color: var(--ink);
    /* Große Schrift (130 %): Das Wort bricht am weichen Trennstrich, statt über Wahlpunkt und Griff zu ragen. */
    hyphens: manual;
  }
  .griff {
    flex: none;
    width: 44px;
    height: 44px;
    padding: 0;
    display: grid;
    place-items: center;
    color: var(--ink-quiet);
    border-radius: 6px;
    touch-action: none;
    cursor: grab;
    background: none;
    border: 0;
  }
  .ap {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 999px;
    background: none;
    border: 0;
    color: inherit;
  }
  .ap i {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    border: 2px solid var(--ink-quiet);
  }
  .ap[aria-checked='true'] i {
    border: 7px solid var(--ink);
  }
  .apt {
    display: none;
  }
  /* DP128 dimmt hier mit 55 % Deckkraft; der Name bleibt lesbar in --ink-muted (Kontrast ab 4,5, axe), nur das
     Zeichen ohne Text wird blass. */
  .weg .zeile .text b {
    color: var(--ink-muted);
  }
  .weg .zeile .zeichen {
    opacity: 0.55;
  }
  .platz {
    opacity: 0.35;
  }
  :global(.flug) {
    position: fixed;
    z-index: 20;
    pointer-events: none;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
    border-radius: 16px;
    transform: rotate(-1.5deg);
  }
  .ziele {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    margin-top: calc(-1 * var(--space-1));
    background: var(--surface);
    border-radius: 0 0 16px 16px;
  }
  .ziele button,
  .frage button {
    min-height: 44px;
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    font-size: calc(15 * var(--px));
    font-weight: 600;
    background: var(--surface);
    color: var(--ink);
  }
  .ziele .ap-ziel {
    border-color: var(--ink);
  }
  .folge {
    margin-top: var(--space-4);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    border-radius: 16px;
    background: var(--ink);
    color: var(--ground);
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    min-height: 52px;
  }
  .folge p {
    /* Bei großer Schrift rutscht „Rückgängig“ unter den Satz, statt ihn in eine schmale Spalte zu drücken. */
    flex: 1 1 12em;
    margin: 0;
  }
  .rueck {
    flex: none;
    min-height: 44px;
    padding: 0 var(--space-3);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 4px;
    color: var(--ground);
    background: none;
    border: 0;
  }
  .frage {
    margin-top: var(--space-1);
    padding: var(--space-3) var(--space-4) var(--space-4);
    background: var(--surface);
    border-radius: 16px;
  }
  .frage p {
    margin: 0;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }
  .frage .f {
    margin-top: var(--space-1);
    font-weight: 700;
    color: var(--ink);
  }
  .frage .wahl {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .frage .neu {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .frage input {
    flex: 1;
    min-width: 0;
    width: 0;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
  }
  .frage .ok {
    background: var(--ink);
    color: var(--ground);
    border-color: var(--ink);
  }
  :is(.griff, .ziele button, .ap, .rueck, .frage button, .frage input):focus-visible {
    outline: 0;
    box-shadow: 0 3px 0 0 var(--ink);
  }
  .rueck:focus-visible {
    box-shadow: 0 3px 0 0 var(--ground);
  }
  /* DP128, Punkt 3: unter 300 px der Wahlpunkt mit dem Wort in eigener Zeile, damit Namen nie zerbrechen. Gemessen
     am Platz der Fächer in Schriftgrößen: 300 px Fenster sind 268 px Fächer bei 17 px Schrift, also 15,8 em. So greift
     sie auch bei großer Schrift (130 %) und Zoom, wo „Bartholomäus“ sonst an den Wahlpunkt stößt. */
  @container faecher (max-width: 16.5em) {
    .zeile {
      flex-wrap: wrap;
      row-gap: 0;
      column-gap: var(--space-2);
      padding-left: var(--space-3);
    }
    .text {
      flex: 1 1 0;
    }
    /* Abweichung von DP128 (Frage an Design, CP120): Im Vertrag kommt auch der Griff in die zweite Zeile, rechts
       neben den Wahlpunkt. Sonst stößt ein langer Name wie „Bartholomäus“ bei 320 px mit 130 % an den Griff. */
    .zeile:has(.ap) .text {
      flex-basis: calc(100% - 48px);
    }
    .zeile:has(.ap) .griff {
      order: 4;
    }
    .ap {
      order: 3;
      flex: 1 1 0;
      min-width: 0;
      justify-content: flex-start;
      gap: var(--space-2);
      width: auto;
      padding-left: 32px;
      border-radius: 6px;
      font-size: calc(13 * var(--px));
      font-weight: 600;
    }
    .ap i {
      flex: none;
      width: 20px;
      height: 20px;
      margin-left: var(--space-2);
    }
    .ap[aria-checked='true'] i {
      border-width: 6px;
    }
    .apt {
      display: inline;
      min-width: 0;
      line-height: calc(18 * var(--px));
      text-align: left;
      hyphens: manual;
    }
    .text .marke {
      display: none;
    }
  }
</style>
