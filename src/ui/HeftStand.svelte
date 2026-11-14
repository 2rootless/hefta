<script lang="ts">
  // Stand im Heft (B28b, DP21 Abschnitt 1): Weg mit Marke, darunter die Lage mit Titel, Satz, Frage und
  // Antworten. Den Stand ändert im Heft nur noch die Frage im Stand. Eine getippte Antwort, die den Titel
  // wechselt, verwandelt sich in den neuen Titel (Muster „Verwandeln“); sonst wechselt die Lage
  // („Wechseln“). Die Bewegung kommt aus dem Modul `bewegung.ts` und ist unterbrechbar.
  import { tick, untrack } from 'svelte';
  import type { Heft, HeftEreignisse } from '../domain/modell';
  import {
    dochNichtBeworben,
    dochNochOffen,
    ergebnis,
    lage as lageVon,
    ohneAntwortAblegen,
    schonBeworben,
    terminWeg,
    vorschlagJa,
    vorschlagNein,
    vorwaerts,
    type Lage,
  } from '../domain/heftLage';
  import { terminNaehe } from '../domain/terminNaehe';
  import { tagKurz } from '../domain/heftKarte';
  import { t, type TextSchluessel } from '../i18n';
  import { anrede } from '../i18n/anrede.svelte';
  import {
    abschliessen,
    abschnitt,
    bewegungReduziert,
    hoeheGleitet,
    lauf,
    verwandeln,
    wechseln,
  } from './bewegung';

  let {
    heft,
    jetzt,
    mitHaushalt,
    haushaltZiel,
    an,
    mietrueckZiel = null,
    spur,
    kalender,
    kalenderMeldung = '',
    aendern,
    rueckmeldung,
  }: {
    heft: Heft;
    jetzt: Date;
    mitHaushalt: boolean;
    haushaltZiel: string;
    /** Für „Mail an …“: der Name aus dem Inserat, sonst „den Vermieter“ (DP21). */
    an: string;
    /** Wartet eine Frage bis zur Zusage (Mietrückstände)? Dann der Weg zur Selbstauskunft. */
    mietrueckZiel?: string | null;
    /** Abschnitt „Was hinausging“: erscheint und geht mit dem Stand (ab „Beworben“). */
    spur?: HTMLElement | null;
    kalender: () => void;
    kalenderMeldung?: string;
    aendern: (neu: HeftEreignisse) => Promise<void>;
    rueckmeldung?: import('svelte').Snippet;
  } = $props();

  const NB = ' ';
  const l = $derived(lageVon(heft.ereignisse, jetzt, mitHaushalt));

  // ---------- Was eine Lage zeigt (Wortlaute B28b, Abschnitt 2) ----------

  type Aktion =
    { href: string } | { tun: (e: HeftEreignisse) => HeftEreignisse } | { knopf: () => void };
  interface Antwort {
    text: string;
    unter?: string;
    haupt?: boolean;
    leise?: boolean;
    aktion: Aktion;
  }
  interface Inhalt {
    titel: string;
    satz?: string;
    karte?: boolean;
    frage?: string;
    antworten: Antwort[];
    fuss?: string;
    zurueck?: { text: string; tun: (e: HeftEreignisse) => HeftEreignisse };
    rueck?: boolean;
  }

  const id = $derived(heft.id);
  const jetztZeit = () => new Date();

  function terminTitel(): string {
    const termin = heft.ereignisse.termin;
    if (!termin) return '';
    const d = new Date(termin.am);
    const uhr =
      d.getMinutes() === 0
        ? String(d.getHours())
        : `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    const n = terminNaehe(termin.am, jetzt);
    // „Besichtigung heute, 18 Uhr“ (DP21 nach naehe.*); sonst mit Wochentag und, wenn weiter weg, Datum.
    if (n.art === 'heute' || n.art === 'morgen') {
      const wort = t(n.art === 'heute' ? 'naehe.heute' : 'naehe.morgen');
      return t('stand.termin.titel', { tag: wort, uhr }).replace(` am ${wort}`, ` ${wort}`);
    }
    // „Do.“ wie in DP21. Die Browser schreiben den kurzen Wochentag mal mit, mal ohne Punkt.
    const wochentag = `${new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(d).replace('.', '')}.`;
    const tag = n.wort === 'dieseWoche' ? wochentag : `${wochentag}, ${tagKurz(termin.am)}`;
    return t('stand.termin.titel', { tag, uhr });
  }

  const ablegenUnter = () => t('stand.antwort.ablegenUnter');

  /** `e`: die Ereignisse, zu denen die Lage gehört. Der gehende Block im Wechsel braucht die alten. */
  function inhalt(x: Lage, e: HeftEreignisse = heft.ereignisse): Inhalt {
    const hinaus = !!heft.spur?.length || !!e.beworben;
    switch (x.art) {
      case 'gemerkt':
      case 'gemerktOhne':
        return {
          titel: t('stand.gemerkt.titel'),
          satz: t('stand.gemerkt.satz', { datum: tagKurz(heft.createdAt) }),
          frage: t('stand.gemerkt.frage'),
          antworten: [
            x.art === 'gemerkt'
              ? {
                  text: t('stand.gemerkt.bewerben'),
                  unter: t('stand.gemerkt.bewerbenUnter'),
                  haupt: true,
                  aktion: { href: `#/heft/${id}/bewerben` },
                }
              : {
                  text: t('stand.gemerkt.werZiehtEin'),
                  unter: t('stand.gemerkt.werZiehtEinUnter'),
                  haupt: true,
                  aktion: { href: haushaltZiel },
                },
            {
              text: t('stand.gemerkt.schon'),
              aktion: { tun: (v) => schonBeworben(v, jetztZeit()) },
            },
          ],
        };
      case 'vorschlag': {
        const b = e.beworben!;
        const tag = tagKurz(b.am);
        const satzSchluessel: TextSchluessel =
          b.weg === 'portal'
            ? 'stand.vorschlag.portal'
            : b.weg === 'website'
              ? anredeSchluessel('heft.vorschlagWebsite')
              : anredeSchluessel('heft.vorschlagMail');
        return {
          titel: t('stand.gemerkt.titel'),
          satz: t(satzSchluessel, { tag }),
          frage: t('stand.vorschlag.frage'),
          antworten: [
            {
              text: t('stand.vorschlag.ja'),
              haupt: true,
              aktion: { tun: (v) => vorschlagJa(v, jetztZeit()) },
            },
            {
              text: t('stand.vorschlag.nein'),
              aktion: { tun: (v) => vorschlagNein(v, jetztZeit()) },
            },
          ],
          fuss: t('stand.vorschlag.fuss'),
        };
      }
      case 'beworben':
        return {
          titel: x.heute
            ? t('stand.beworben.titelHeute')
            : t('stand.beworben.titel', { datum: tagKurz(e.beworben!.am) }),
          satz: x.heute
            ? t('stand.beworben.satzHeute')
            : t('stand.beworben.satzTage', { tage: x.tage ?? 0 }),
          frage: t('stand.beworben.frage'),
          antworten: [einladung(), absage()],
          zurueck: { text: t('stand.beworben.zurueck'), tun: dochNichtBeworben },
        };
      case 'keineAntwort':
        return {
          titel: t('stand.keine.titel'),
          satz: t('stand.keine.satz', { datum: tagKurz(e.beworben!.am) }),
          frage: t('stand.keine.frage'),
          antworten: [
            {
              text: t('stand.keine.nachfragen'),
              unter: t('stand.keine.nachfragenUnter', { an }),
              haupt: true,
              aktion: { href: `#/heft/${id}/nachfassen` },
            },
            { ...einladung(), text: t('stand.keine.doch') },
            ohneAntwort(),
          ],
        };
      case 'nachgefragt':
        return {
          titel: t('stand.nachgefragt.titel', { datum: tagKurz(e.nachgefasstAm!) }),
          satz: t('stand.nachgefragt.satz', { datum: tagKurz(e.beworben!.am) }),
          frage: t('stand.beworben.frage'),
          antworten: [einladung(), absage(), ohneAntwort()],
        };
      case 'termin':
        return {
          titel: terminTitel(),
          karte: true,
          frage: t('stand.termin.frage'),
          antworten: [
            { ...absage(), leise: true },
            { ...nichtMehr(), leise: true },
          ],
          zurueck: { text: t('stand.termin.entfernen'), tun: terminWeg },
        };
      case 'besichtigt':
        return {
          titel: t('stand.besichtigt.titel', { datum: tagKurz(e.termin!.am) }),
          satz: t('stand.besichtigt.satz'),
          frage: t('stand.besichtigt.frage'),
          antworten: [
            {
              text: t('stand.antwort.zusage'),
              aktion: { tun: (v) => ergebnis(v, 'zusage', jetztZeit()) },
            },
            absage(),
            nichtMehr(),
          ],
        };
      case 'zusage':
        return {
          titel: t('stand.zusage.titel'),
          satz: t('stand.zusage.satz'),
          ...(mietrueckZiel
            ? {
                frage: t('stand.zusage.frage'),
                antworten: [
                  {
                    text: t('stand.zusage.mietrueck'),
                    unter: t('stand.zusage.mietrueckUnter'),
                    leise: true,
                    aktion: { href: mietrueckZiel },
                  },
                ],
              }
            : { antworten: [] }),
          zurueck: { text: t('stand.ergebnis.zurueck'), tun: dochNochOffen },
          rueck: true,
        };
      case 'absage':
      case 'nichtMehr':
      case 'ohneAntwort': {
        const titel =
          x.art === 'absage'
            ? t('stand.absage.titel')
            : x.art === 'nichtMehr'
              ? t('stand.nichtMehr.titel')
              : t('stand.ohneAntwort.titel');
        const voll = t('stand.abgelegt.satz');
        // „nur, wenn etwas hinausging; sonst nur der erste Satz“ (DP21)
        const satz = x.bitte
          ? t('stand.abgelegt.bitteAm', { datum: tagKurz(e.loeschbitteAm!) })
          : hinaus
            ? voll
            : voll.slice(0, voll.indexOf('.') + 1);
        return {
          titel,
          satz,
          antworten:
            !x.bitte && hinaus
              ? [
                  {
                    text: t('stand.abgelegt.bitte'),
                    unter: t('stand.abgelegt.bitteUnter', { an }),
                    aktion: { href: `#/heft/${id}/loeschbitte` },
                  },
                ]
              : [],
          zurueck: { text: t('stand.ergebnis.zurueck'), tun: dochNochOffen },
          rueck: true,
        };
      }
    }
  }

  /** Schlüssel mit Ihr/Du am Ende nach der Anrede der App (für die Sätze aus heft.vorschlag*). */
  function anredeSchluessel(stamm: string): TextSchluessel {
    return `${stamm}${anrede.wert === 'ihr' ? 'Ihr' : 'Du'}` as TextSchluessel;
  }

  function einladung(): Antwort {
    return {
      text: t('stand.beworben.einladung'),
      unter: t('stand.beworben.einladungUnter'),
      aktion: { href: `#/heft/${id}/termin` },
    };
  }
  function absage(): Antwort {
    return {
      text: t('stand.antwort.absage'),
      unter: ablegenUnter(),
      aktion: { tun: (v) => ergebnis(v, 'absage', jetztZeit()) },
    };
  }
  function nichtMehr(): Antwort {
    return {
      text: t('stand.antwort.nichtMehr'),
      unter: ablegenUnter(),
      aktion: { tun: (v) => ergebnis(v, 'nicht_mehr', jetztZeit()) },
    };
  }
  function ohneAntwort(): Antwort {
    return {
      text: t('stand.keine.ablegen'),
      unter: t('stand.keine.ablegenUnter'),
      aktion: { tun: (v) => ohneAntwortAblegen(v, jetztZeit()) },
    };
  }

  // ---------- Wechsel der Lage ----------

  const schluessel = (x: Lage) => `${x.art}|${x.bitte ? 1 : 0}|${x.heute ? 1 : 0}`;
  // Jeder Block behält die Ereignisse seiner Lage: Während des Wechsels steht der alte Block noch da,
  // die Ereignisse sind aber schon neu (etwa ohne Bewerbung nach „Doch noch nicht beworben“).
  let anzeige = $state<{ nr: number; l: Lage; e: HeftEreignisse }[]>([]);
  let nr = 0;
  /** Die Ereignisse beim letzten Lauf von `wechsel`, also vor der jetzigen Änderung. */
  let eZuletzt: HeftEreignisse | null = null;
  let buehne = $state<HTMLDivElement | null>(null);
  /** Die getippte Antwort, wenn der Wechsel von einem Tipp kommt. */
  let held: HTMLElement | null = null;
  let vomTipp = false;
  let zuletzt = '';

  $effect(() => {
    const neu = l;
    untrack(() => void wechsel(neu));
  });

  async function wechsel(neu: Lage) {
    const k = schluessel(neu);
    const eJetzt = $state.snapshot(heft.ereignisse) as HeftEreignisse;
    const eAlt = eZuletzt ?? eJetzt;
    eZuletzt = eJetzt;
    if (k === zuletzt) return;
    const vorher = anzeige.at(-1)?.l;
    zuletzt = k;
    if (!vorher || !vomTipp || !buehne) {
      anzeige = [{ nr: ++nr, l: neu, e: eJetzt }];
      return;
    }
    vomTipp = false;
    const alt = buehne.lastElementChild as HTMLElement | null;
    const hAlt = buehne.offsetHeight;
    anzeige = [
      { nr: anzeige.at(-1)!.nr, l: vorher, e: eAlt },
      { nr: ++nr, l: neu, e: eJetzt },
    ];
    await tick();
    const neuEl = buehne.lastElementChild as HTMLElement | null;
    if (!alt || !neuEl || alt === neuEl) {
      anzeige = [{ nr, l: neu, e: eJetzt }];
      return;
    }
    const r = vorwaerts(vorher, neu) ? 1 : -1;
    const lf = lauf();
    alt.classList.add('frei', 'geht');
    neuEl.classList.add('frei');
    buehne.style.height = `${hAlt}px`;
    const hNeu = neuEl.offsetHeight;
    const titelAlt = inhalt(vorher, eAlt).titel;
    const titelNeu = inhalt(neu).titel;
    const titelEl = neuEl.querySelector<HTMLElement>('h2');
    const hz =
      held && !bewegungReduziert() && alt.contains(held) && titelAlt !== titelNeu && titelEl
        ? verwandeln(lf, buehne, alt, neuEl, held, titelEl, { r })
        : { schrumpfAb: wechseln(lf, buehne, alt, neuEl, { r }) };
    held = null;
    hoeheGleitet(lf, buehne, hAlt, hNeu, hz);
    if (spur && spur.hidden === neu.ort >= 1 && heft.spur?.length)
      abschnitt(lf, spur, neu.ort >= 1);
    const b = buehne;
    lf.danach(() => {
      anzeige = anzeige.slice(-1);
      neuEl.classList.remove('frei');
      b.style.height = '';
    });
    lf.start();
  }

  async function antwort(a: Antwort, el: HTMLElement) {
    abschliessen();
    if ('tun' in a.aktion) {
      held = el;
      vomTipp = true;
      await aendern(a.aktion.tun($state.snapshot(heft.ereignisse) as HeftEreignisse));
    } else if ('knopf' in a.aktion) a.aktion.knopf();
  }

  async function zurueckTippen(tun: (e: HeftEreignisse) => HeftEreignisse) {
    abschliessen();
    held = null;
    vomTipp = true;
    await aendern(tun($state.snapshot(heft.ereignisse) as HeftEreignisse));
  }

  // ---------- Weg und Marke ----------

  const ORTE = ['gemerkt', 'beworben', 'besichtigung', 'ergebnis'] as const;
  const ortWort = (i: number) => t(`stand.ort.${ORTE[i]!}`);
  const anteil = (o: number) => `${(o * 100) / 3}%`;

  const termin = $derived(heft.ereignisse.termin);
  const terminTag = $derived.by(() => {
    if (!termin) return null;
    const d = new Date(termin.am);
    return {
      wochentag: new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(d),
      tag: d.getDate(),
      monat: new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(d),
      uhr: new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(d),
    };
  });
</script>

{#snippet lageBlock(x: Lage, e: HeftEreignisse | undefined)}
  {@const i = inhalt(x, e)}
  <div class="lage">
    <h2>{i.titel}</h2>
    {#if i.satz}<p class="satz">{i.satz}</p>{/if}
    {#if i.karte && termin && terminTag}
      <!-- Termin-Karte im Stand: weiche Fläche im Ton des Termins, ohne Rahmen (DP21). -->
      <div class="karte">
        <div class="tag" aria-hidden="true">
          <small>{terminTag.wochentag.replace('.', '')}</small><b>{terminTag.tag}</b><small
            >{terminTag.monat}</small
          >
        </div>
        <div class="was">
          <p class="uhr">{terminTag.uhr}{NB}Uhr</p>
          {#if termin.treffpunkt || termin.ort}<p class="treff">
              {termin.treffpunkt || termin.ort}
            </p>{/if}
          <div class="tun">
            <button type="button" onclick={kalender}>{t('stand.termin.kalender')}</button>
            <a href={`#/heft/${id}/termin`}>{t('stand.termin.aendern')}</a>
          </div>
          {#if kalenderMeldung}<p class="meldung" role="status">{kalenderMeldung}</p>{/if}
        </div>
      </div>
    {/if}
    {#if i.frage}<p class="frage">{i.frage}</p>{/if}
    {#each i.antworten as a (a.text)}
      {#if 'href' in a.aktion}
        <a class="antw" class:haupt={a.haupt} class:leise={a.leise} href={a.aktion.href}
          ><span class="antw-text"
            >{a.text}{#if a.unter}<small>{a.unter}</small>{/if}</span
          ><i aria-hidden="true">›</i></a
        >
      {:else}
        <button
          type="button"
          class="antw"
          class:haupt={a.haupt}
          class:leise={a.leise}
          onclick={(ev) =>
            antwort(a, (ev.target as Element).closest<HTMLElement>('.antw') ?? ev.currentTarget)}
          ><span class="antw-text"
            >{a.text}{#if a.unter}<small>{a.unter}</small>{/if}</span
          ><i aria-hidden="true">›</i></button
        >
      {/if}
    {/each}
    {#if i.fuss}<p class="fuss">{i.fuss}</p>{/if}
    {#if i.rueck && rueckmeldung}<div class="rueck">{@render rueckmeldung()}</div>{/if}
    {#if i.zurueck}
      {@const z = i.zurueck}
      <button type="button" class="zurueck" onclick={() => zurueckTippen(z.tun)}>{z.text}</button>
    {/if}
  </div>
{/snippet}

<section
  class="stand"
  aria-label={t('stand.ansage', { ort: ortWort(l.ort), titel: inhalt(l).titel })}
>
  <div class="weg" aria-hidden="true">
    <div class="spur"></div>
    <div class="voll" style:width={anteil(l.ort)}></div>
    {#each ORTE as ort, i (ort)}
      <div
        class="ort"
        class:erster={i === 0}
        class:letzter={i === ORTE.length - 1}
        class:war={i < l.ort}
        class:hier={i === l.ort}
        style:left={anteil(i)}
      >
        <small>{ortWort(i)}</small>
      </div>
    {/each}
    <div class="marke" style:left={anteil(l.ort)}></div>
  </div>
  <div class="buehne" bind:this={buehne} aria-live="polite">
    <!-- Ein Block liest die Ereignisse lebendig, solange seine Lage gilt; sonst die seiner Lage (beim
         Wechsel, und kurz bevor der Wechsel nach einer Änderung läuft). -->
    {#each anzeige as a, n (a.nr)}{@render lageBlock(
        a.l,
        n === anzeige.length - 1 && schluessel(a.l) === schluessel(l) ? undefined : a.e,
      )}{/each}
  </div>
</section>

<style>
  .stand {
    margin: 14px 0 0;
    padding: 18px 16px 14px;
    border-radius: 22px;
    background: var(--surface);
    /* Für den Titel: lieber kleinere Schrift als ein Wort trennen (Prüfkatalog C2). */
    container-type: inline-size;
  }

  /* Weg mit Marke (DP21): Die Linie zieht die Marke, sie folgt zwei Takte später und setzt sich. */
  .weg {
    position: relative;
    /* Wächst mit der Schrift, damit die Wörter unter dem Weg den Titel nicht berühren. */
    height: calc(31px + 1.6em);
    margin: 2px 10px 0;
    font-size: calc(11.5 * var(--px));
    container-type: inline-size;
  }

  .weg .spur,
  .weg .voll {
    position: absolute;
    top: 11px;
    left: 0;
    height: 4px;
    border-radius: 2px;
  }

  .weg .spur {
    right: 0;
    background: var(--line);
  }

  .weg .voll {
    background: var(--ink);
    transition: width var(--bw-aufschlagen) var(--bw-ziel);
  }

  .ort {
    position: absolute;
    top: 7px;
    width: 12px;
    height: 12px;
    margin-left: -6px;
    border: 2px solid var(--line-strong);
    border-radius: 50%;
    background: var(--surface);
    transition:
      background-color var(--bw-mittel) var(--bw-weich),
      border-color var(--bw-mittel) var(--bw-weich);
  }

  .ort.war {
    border-color: var(--ink);
    background: var(--ink);
  }

  .ort small {
    position: absolute;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    color: var(--ink-quiet);
    font-size: 1em;
    line-height: 1.3;
    white-space: nowrap;
    transition:
      color var(--bw-mittel) var(--bw-weich),
      opacity var(--bw-mittel) var(--bw-weich);
  }

  .ort.hier small {
    color: var(--ink);
    font-weight: 700;
  }

  /* Das erste und das letzte Wort stehen bündig am Ende des Wegs, nicht mittig unter dem Punkt. */
  .ort.erster small {
    left: -10px;
    transform: none;
  }

  .ort.letzter small {
    right: -10px;
    left: auto;
    transform: none;
  }

  /* Passen vier Beschriftungen nicht nebeneinander, bleibt nur die des heutigen Orts. Wechselt er, geht
     das alte Wort erst, dann kommt das neue. */
  @container (max-width: 24em) {
    .ort:not(.hier) small {
      visibility: hidden;
      opacity: 0;
      transition-duration: var(--bw-knapp);
      transition-property: color, opacity, visibility;
    }

    .ort.hier small {
      transition-delay: var(--bw-knapp);
    }
  }

  .marke {
    position: absolute;
    top: 1px;
    width: 24px;
    height: 24px;
    margin-left: -12px;
    border-radius: 50%;
    background: var(--ink);
    box-shadow: 0 0 0 4px var(--surface);
    transition: left var(--bw-aufschlagen) var(--bw-setzen) calc(var(--bw-takt) * 2);
  }

  .buehne {
    position: relative;
  }

  .lage {
    padding-top: 12px;
  }

  .buehne :global(.lage.frei) {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
  }

  .buehne :global(.lage.geht) {
    pointer-events: none;
  }

  .lage h2 {
    margin: 0;
    font-size: min(calc(25 * var(--px)), 12.5cqi);
    font-weight: 780;
    font-stretch: 110%;
    line-height: 1.12;
  }

  .satz {
    margin: 5px 0 0;
    color: var(--ink-muted);
    font-size: calc(15 * var(--px));
  }

  .frage {
    margin: 18px 0 0;
    color: var(--ink-muted);
    font-size: calc(12 * var(--px));
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .antw {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    width: 100%;
    min-height: 54px;
    margin-top: 8px;
    padding: 6px 18px;
    border: 0;
    border-radius: 16px;
    background: var(--ground);
    color: var(--ink);
    font: inherit;
    font-size: calc(16 * var(--px));
    font-weight: 650;
    line-height: 1.25;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    transition:
      transform var(--bw-knapp) var(--bw-ziel),
      background-color var(--bw-kurz) var(--bw-weich);
  }

  .antw-text {
    flex: 1;
  }

  .antw small {
    display: block;
    color: var(--ink-muted);
    font-size: calc(12.5 * var(--px));
    font-weight: 400;
  }

  .antw i {
    color: var(--ink-quiet);
    font-size: 20px;
    font-style: normal;
    transition:
      transform var(--bw-kurz) var(--bw-ziel),
      opacity var(--bw-knapp) var(--bw-weich);
  }

  /* Drücken (Handbuch 3.10): Die Fläche gibt nach, der Pfeil rückt vor. */
  .antw:active {
    transform: scale(0.975);
  }

  .antw:active i {
    transform: translateX(4px);
  }

  .antw.haupt {
    background: var(--action);
    color: var(--on-action);
  }

  .antw.haupt small,
  .antw.haupt i {
    color: inherit;
    opacity: 0.75;
  }

  /* Leise Antwort: für das, was eher selten ist (etwas kommt dazwischen). */
  .antw.leise {
    min-height: 48px;
    margin-top: 2px;
    padding: 0 4px;
    background: transparent;
    color: var(--ink-muted);
    font-weight: 550;
  }

  .fuss {
    margin: 8px 0 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .zurueck {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    margin-top: 4px;
    padding: 0 2px;
    border: 0;
    background: none;
    color: var(--ink-muted);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 500;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  /* Termin-Karte im Stand: weiche Fläche im Ton des Termins, ohne Rahmen. */
  .karte {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    margin-top: 12px;
    padding: 14px;
    border-radius: 16px;
    background: var(--termin-soft);
  }

  .karte .tag {
    flex: none;
    /* Wächst mit der Schrift, damit „NOV.“ nicht bricht. */
    min-width: 52px;
    white-space: nowrap;
    color: var(--termin);
    line-height: 1.2;
    text-align: center;
  }

  .karte .tag b {
    display: block;
    margin: 1px 0;
    font-size: calc(24 * var(--px));
    font-weight: 780;
  }

  .karte .tag small {
    display: block;
    font-size: calc(11 * var(--px));
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .karte .was {
    flex: 1;
    min-width: 0;
  }

  .karte .uhr {
    margin: 0;
    color: var(--termin);
    font-weight: 700;
  }

  .karte .treff {
    margin: 2px 0 0;
    color: var(--ink-muted);
    font-size: calc(14.5 * var(--px));
  }

  .karte .tun {
    display: flex;
    flex-wrap: wrap;
    gap: 0 16px;
  }

  /* Die Links im Ton des Termins: Rot auf der dunklen Fläche erreicht nur 4,2 : 1 (DP21). */
  .karte .tun button,
  .karte .tun a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--termin);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .meldung {
    margin: 4px 0 0;
    color: var(--ink-muted);
    font-size: calc(13.5 * var(--px));
  }

  .rueck {
    margin-top: 16px;
    padding: 14px;
    border-radius: 16px;
    background: var(--ground);
  }

  /* Flug-Ebenen aus dem Modul (Verwandeln). */
  .buehne :global(.flug-flaeche),
  .buehne :global(.flug-text) {
    position: absolute;
    z-index: 3;
    margin: 0;
    pointer-events: none;
  }

  .buehne :global(.flug-flaeche) {
    border-radius: 16px;
  }

  .buehne :global(.flug-flaeche i) {
    position: absolute;
    top: 50%;
    right: 18px;
    margin-top: -0.6em;
    color: var(--ink-quiet);
    font-size: 20px;
    font-style: normal;
    line-height: 1.2;
  }

  .buehne :global(.flug-flaeche.haupt i) {
    color: var(--on-action);
    opacity: 0.75;
  }

  .buehne :global(.flug-text) {
    color: var(--ink);
    font-size: calc(16 * var(--px));
    font-weight: 650;
    line-height: 1.25;
  }

  .buehne :global(.flug-text small) {
    display: block;
    color: var(--ink-muted);
    font-size: calc(12.5 * var(--px));
    font-weight: 400;
  }

  .buehne :global(.flug-text.haupt) {
    color: var(--on-action);
  }

  .buehne :global(.flug-text.haupt small) {
    color: inherit;
    opacity: 0.75;
  }
</style>
