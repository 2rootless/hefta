<script lang="ts">
  // Reiter „Mappe“ ohne fertigen Haushalt (B26, E93, Variante B): Leer eine ruhige Startseite mit Bild des
  // Deckblatts, „Haushalt anlegen“, dem Hinweis für Vermieter (E42) und der Anleitung „So entsteht eure
  // Mappe“. Angefangen die wachsende Mappe: das Deckblatt als lebende Vorschau, die Schritte als Karten,
  // fest „Weiter anlegen“ und leise „Von vorn beginnen“. Erst ein Knopf startet den Ablauf, nie der Reiter.
  import { daten, db, gehe, stillLaden } from '../app/daten.svelte';
  import { VERMIETER_ADRESSE, VERMIETER_DOMAIN } from '../app/name';
  import { t } from '../i18n';
  import { haushaltAendern, haushaltVonVorn } from '../storage/speicher';
  import { dauer, kurve } from '../ui/bewegung';
  import DeckblattBild from '../ui/DeckblattBild.svelte';
  import { homescreenFragen } from '../ui/homescreen';
  import Sheet from '../ui/Sheet.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import TabLeiste from '../ui/TabLeiste.svelte';

  const ansicht = $derived(daten.ansicht);
  const angefangen = $derived(!!ansicht?.haushalt.einrichtungOffen);
  const aktive = $derived(
    (ansicht?.mitglieder ?? []).filter((m) => !m.zugehoerigkeit.herausgenommenAm),
  );
  const vertrag = $derived(aktive.filter((m) => m.zugehoerigkeit.rolle !== 'buerge'));
  const buergen = $derived(aktive.filter((m) => m.zugehoerigkeit.rolle === 'buerge'));
  // Ohne fertigen Haushalt „ihr“ (E74, E83); angefangen mit nur einer Person im Vertrag „du“ (12y).
  const du = $derived(angefangen && vertrag.length === 1);
  const name = (m: (typeof aktive)[number]) => m.person.rufname || m.person.vorname;

  // Wer seit dem letzten Blick dazukam, erscheint einmal mit bw-punkt. Beim ersten Blick keiner.
  const SPEICHER = 'hefta-deckblatt-gesehen';
  function gesehen(): Set<string> | null {
    try {
      const roh = sessionStorage.getItem(`${SPEICHER}-${ansicht?.haushalt.id}`);
      return roh ? new Set(JSON.parse(roh) as string[]) : null;
    } catch {
      return null;
    }
  }
  const vorher = gesehen();
  $effect(() => {
    if (!ansicht) return;
    try {
      sessionStorage.setItem(
        `${SPEICHER}-${ansicht.haushalt.id}`,
        JSON.stringify(vertrag.map((m) => m.person.id)),
      );
    } catch {
      // Ohne Speicher erscheint niemand bewegt.
    }
  });
  const imBild = $derived(
    vertrag.map((m) => ({
      id: m.person.id,
      anfang: [...name(m)][0]?.toUpperCase() ?? '',
      farbe: m.zugehoerigkeit.farbe,
      neu: !!vorher && !vorher.has(m.person.id),
    })),
  );

  const namen = $derived.by(() => {
    const n = vertrag.map(name);
    return n.length < 2
      ? (n[0] ?? '')
      : `${n.slice(0, -1).join(', ')} ${t('mappeStart.und')} ${n.at(-1)}`;
  });

  // Weg in den Ablauf: Das Deckblatt wächst und blendet aus (Dauer `aufschlagen`, Kurve `ziel`), dann folgt
  // der Schritt. Mit „Bewegung reduzieren“ sind die Dauern 0 ms; es bleibt der Wechsel der Seite.
  let bild: HTMLElement | undefined = $state();
  async function los(pfad: string) {
    const d = dauer('aufschlagen');
    if (bild && d > 0)
      await bild
        .animate(
          [{ transform: 'none' }, { transform: 'scale(1.35) translateY(-8%)', opacity: 0 }],
          {
            duration: d,
            easing: kurve('ziel'),
            fill: 'backwards',
          },
        )
        .finished.catch(() => {});
    gehe(pfad);
  }
  const anlegenZiel = $derived(
    homescreenFragen(daten.einstellungen) ? '/homescreen/einrichtung' : '/einrichtung',
  );

  async function niemandWeiter() {
    if (!ansicht) return;
    await haushaltAendern(await db(), ansicht.haushalt.id, {
      kinder: 0,
      weitereErwachsene: 0,
      einrichtungOffen: false,
    });
    await stillLaden();
  }

  let vonVornOffen = $state(false);
  async function vonVorn() {
    if (!ansicht) return;
    await haushaltVonVorn(await db(), ansicht.haushalt.id);
    vonVornOffen = false;
    await stillLaden();
    gehe('/mappe-start');
  }
</script>

{#snippet vermieter()}
  <p class="verm">
    {t('mappeStart.vermieter')} <a href={VERMIETER_ADRESSE}>{VERMIETER_DOMAIN}</a>.
  </p>
{/snippet}

{#snippet mini(n: 1 | 2 | 3)}
  <svg viewBox="0 0 120 213.33" aria-hidden="true">
    <rect
      x="8"
      y="8"
      width="104"
      height="197.33"
      rx="14"
      fill="var(--surface)"
      stroke="var(--ink)"
      stroke-width="2.2"
    />
    {#if n === 1}
      {#each [1, 4] as farbe, i (farbe)}
        <rect
          x="22"
          y={40 + i * 44}
          width="26"
          height="26"
          rx="5"
          fill="var(--person-{farbe})"
          stroke="var(--on-person)"
          stroke-width="1.4"
        />
        <rect
          x="58"
          y={48 + i * 44}
          width={40 - i * 8}
          height="8"
          rx="4"
          fill="var(--line-strong)"
        />
      {/each}
      <rect
        x="22"
        y="128"
        width="26"
        height="26"
        rx="5"
        fill="none"
        stroke="var(--accent)"
        stroke-width="2.2"
        stroke-dasharray="5 4"
      />
      <path
        d="M35 134v14M28 141h14"
        stroke="var(--accent)"
        stroke-width="2.2"
        stroke-linecap="round"
      />
    {:else if n === 2}
      {#each [0, 1, 2] as i (i)}
        <rect
          x={26 + i * 8}
          y={36 + i * 12}
          width="60"
          height="78"
          rx="6"
          fill="var(--surface)"
          stroke="var(--ink)"
          stroke-width="2"
        />
        <rect
          x={36 + i * 8}
          y={50 + i * 12}
          width="36"
          height="6"
          rx="3"
          fill="var(--line-strong)"
        />
        <rect
          x={36 + i * 8}
          y={62 + i * 12}
          width="28"
          height="6"
          rx="3"
          fill="var(--line-strong)"
        />
      {/each}
      <circle cx="86" cy="160" r="15" fill="var(--passt)" />
      <path
        d="M79 160l5 5 9-10"
        fill="none"
        stroke="var(--passt-text)"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    {:else}
      <rect
        x="24"
        y="34"
        width="62"
        height="86"
        rx="6"
        fill="var(--surface)"
        stroke="var(--ink)"
        stroke-width="2"
      />
      <rect x="24" y="34" width="18" height="86" rx="6" fill="var(--accent-soft)" />
      <rect x="48" y="46" width="30" height="6" rx="3" fill="var(--ink)" />
      <rect x="48" y="60" width="28" height="5" rx="2.5" fill="var(--line-strong)" />
      <rect x="48" y="72" width="24" height="5" rx="2.5" fill="var(--line-strong)" />
      <path
        d="M60 150h34M84 140l10 10-10 10"
        fill="none"
        stroke="var(--accent)"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <rect
        x="22"
        y="138"
        width="30"
        height="24"
        rx="4"
        fill="none"
        stroke="var(--ink)"
        stroke-width="2"
      />
      <path d="M22 140l15 11 15-11" fill="none" stroke="var(--ink)" stroke-width="2" />
    {/if}
  </svg>
{/snippet}

<main class="seite">
  {#if !angefangen}
    <div class="held">
      <div class="heldt">
        <h1 class="h2">{t('mappeStart.titel')}</h1>
        <p class="sub">{t('mappeStart.satz')}</p>
      </div>
      <div class="bild" bind:this={bild}>
        <DeckblattBild personen={[]} breite={104} label={t('mappeStart.deckblattLeer')} />
      </div>
    </div>
    <a
      class="btn los"
      href="#{anlegenZiel}"
      onclick={(e) => {
        e.preventDefault();
        void los(anlegenZiel);
      }}>{t('mappeStart.anlegen')}</a
    >
    {@render vermieter()}
    <section class="anl" aria-labelledby="anleitung-mappe">
      <h2 id="anleitung-mappe" class="h3">{t('mappeStart.anleitungTitel')}</h2>
      <ol>
        {#each [1, 2, 3] as const as n (n)}
          <li>
            <span class="mb">{@render mini(n)}</span>
            <span class="mt"
              ><b>{n}. {t(`mappeStart.schritt${n}Titel`)}</b><span
                >{t(`mappeStart.schritt${n}`)}</span
              ></span
            >
          </li>
        {/each}
      </ol>
    </section>
  {:else}
    <div class="held">
      <div class="heldt">
        <p class="kicker">{t(du ? 'mappeStart.kickerDu' : 'mappeStart.kickerIhr')}</p>
        <h1 class="h2">{t('mappeStart.weiterTitel')}</h1>
        <p class="sub">
          {t(du ? 'mappeStart.standEinsDu' : 'mappeStart.standMehrIhr', { namen })}
        </p>
        <div
          class="fort"
          role="img"
          aria-label={t('mappeStart.fortschritt', { erledigt: 1, gesamt: 2 })}
        >
          <i class="an"></i><i></i>
        </div>
      </div>
      <div class="bild lebt" bind:this={bild}>
        <DeckblattBild personen={imBild} breite={112} label={t('mappeStart.deckblattVorschau')} />
        <span class="bildlab">{t(du ? 'mappeStart.bildDu' : 'mappeStart.bildIhr')}</span>
      </div>
    </div>

    <div class="sks">
      <div class="sk fertig">
        <span class="z fertig" role="img" aria-label={t('mappeStart.erledigt')}
          ><Symbol name="haken" groesse={12} /></span
        >
        <div class="skt">
          <b>{t('mappeStart.imVertrag')}</b>
          <div class="chips">
            {#each vertrag as m (m.person.id)}
              <span class="chip"
                ><i style:background="var(--person-{m.zugehoerigkeit.farbe})"
                  >{[...name(m)][0]?.toUpperCase()}</i
                >{name(m)}</span
              >
            {/each}
            <a
              class="plus"
              href="#/person-neu/mitmieter/einrichtung"
              aria-label={t('mappeStart.personLabel')}>+ {t('mappeStart.person')}</a
            >
          </div>
        </div>
      </div>
      <div class="sk offen jetzt">
        <span class="z offen" role="img" aria-label={t('mappeStart.offen')}></span>
        <div class="skt">
          <b>{t('mappeStart.mitEin')}</b>
          <span class="frage">{t('mappeStart.mitEinFrage')}</span>
          <div class="schnell">
            <button class="klein" type="button" onclick={niemandWeiter}
              >{t('mappeStart.niemand')}</button
            >
            <a
              class="klein"
              href="#/einrichtung/2"
              onclick={(e) => {
                e.preventDefault();
                void los('/einrichtung/2');
              }}>{t('mappeStart.jaHinzufuegen')}</a
            >
          </div>
        </div>
      </div>
      <div class="sk frei" class:fertig={buergen.length > 0}>
        <span class="z frei" role="img" aria-label={t('mappeStart.freiwillig')}></span>
        <div class="skt">
          <b>{t('mappeStart.buergschaft')}</b>
          {#if buergen.length}
            <div class="chips">
              {#each buergen as m (m.person.id)}
                <span class="chip"
                  ><i style:background="var(--person-{m.zugehoerigkeit.farbe})"
                    >{[...name(m)][0]?.toUpperCase()}</i
                  >{name(m)}</span
                >
              {/each}
            </div>
          {:else}
            <span class="frage">{t('mappeStart.buergschaftSatz')}</span>
            <div class="schnell">
              <a class="leise2" href="#/person-neu/buerge/einrichtung"
                >{t('mappeStart.jetztEintragen')}</a
              >
            </div>
          {/if}
        </div>
      </div>
    </div>
    <button class="leise" type="button" onclick={() => (vonVornOffen = true)}
      >{t('mappeStart.vonVorn')}</button
    >
    {@render vermieter()}
    <div class="cta">
      <a
        class="btn los"
        href="#/einrichtung/2"
        onclick={(e) => {
          e.preventDefault();
          void los('/einrichtung/2');
        }}>{t('mappeStart.weiterAnlegen')}</a
      >
    </div>
  {/if}
</main>
<TabLeiste aktiv="mappe" />

<Sheet bind:offen={vonVornOffen} titel={t('mappeStart.vonVornFrage')}>
  <p class="blatt-satz">{t('mappeStart.vonVornSatz')}</p>
  <button class="btn los" type="button" onclick={vonVorn}>{t('mappeStart.vonVorn')}</button>
  <button class="leise" type="button" onclick={() => (vonVornOffen = false)}
    >{t('mappeStart.abbrechen')}</button
  >
</Sheet>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(env(safe-area-inset-top) + 12px) var(--space-4)
      calc(var(--tabs-hoehe, 72px) + 96px);
  }

  .held {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: start;
    margin-top: 6px;
  }

  .heldt .sub {
    margin: 4px 0 10px;
    color: var(--ink-muted);
  }

  .bild {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding-top: 6px;
  }

  .bild.lebt :global(svg) {
    transform: rotate(2deg);
  }

  .bildlab {
    max-width: 104px;
    color: var(--ink-muted);
    font-size: calc(11 * var(--px));
    line-height: 1.25;
    text-align: center;
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 54px;
    padding: 0 20px;
    border: 0;
    border-radius: var(--radius-full);
    background: var(--action);
    color: var(--on-action);
    font: inherit;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  .los {
    width: 100%;
    margin-top: 14px;
  }

  .verm {
    margin: 12px 2px 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .verm a {
    color: inherit;
  }

  .anl {
    margin-top: 22px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
  }

  .h3 {
    margin: 0 2px 10px;
    font-size: calc(16 * var(--px));
    font-weight: 650;
  }

  .anl ol {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .anl li {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 14px;
    align-items: center;
    padding: 8px 12px 8px 8px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .mb {
    display: block;
    width: 44px;
    aspect-ratio: 9 / 16;
  }

  .mb :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }

  .mt b {
    display: block;
    font-size: calc(15 * var(--px));
  }

  .mt span {
    color: var(--ink-muted);
    font-size: calc(13.5 * var(--px));
  }

  .kicker {
    margin: 4px 0 0;
    color: var(--accent-text);
    font-size: calc(12 * var(--px));
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .fort {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    max-width: 180px;
    margin: 2px 0 0;
  }

  .fort i {
    display: block;
    height: 6px;
    border-radius: 3px;
    background: var(--line-strong);
  }

  .fort i.an {
    background: var(--ink);
  }

  .sks {
    display: grid;
    gap: 10px;
    margin-top: 16px;
  }

  .sk {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .sk.jetzt {
    border: 1.5px solid var(--ink);
    box-shadow: 0 4px 14px rgb(38 34 30 / 0.08);
  }

  .sk.frei:not(.fertig) {
    border-style: dashed;
    background: transparent;
  }

  .z {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin-top: 1px;
    border-radius: 50%;
  }

  .z.fertig {
    background: var(--passt);
    color: var(--passt-text);
  }

  .z.offen {
    border: 2px solid var(--ink);
  }

  .z.frei {
    border: 1.5px dashed var(--ink-muted);
  }

  .skt b {
    display: block;
    margin-bottom: 4px;
    font-size: calc(15.5 * var(--px));
  }

  .frage {
    color: var(--ink-muted);
    font-size: calc(13.5 * var(--px));
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 4px;
    border: 1px solid var(--line);
    border-radius: var(--radius-full);
    background: var(--ground);
    font-size: calc(14 * var(--px));
    font-weight: 600;
  }

  .chip i {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 5px;
    box-shadow: inset 0 0 0 1px var(--on-person);
    color: var(--on-person);
    font-size: calc(11 * var(--px));
    font-style: normal;
    font-weight: 700;
  }

  .plus,
  .leise2 {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 6px;
    color: var(--accent-text);
    font-size: calc(14 * var(--px));
    font-weight: 600;
    text-decoration: none;
  }

  .schnell {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  .klein {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 14px;
    border: 1.5px solid var(--ink);
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 650;
    text-decoration: none;
    cursor: pointer;
  }

  .leise {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 44px;
    border: 0;
    background: none;
    color: var(--accent-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  /* Fest über der Leiste, mit Grund und Übergang (B23 Fassung 2). */
  .cta {
    position: fixed;
    right: 0;
    bottom: var(--tabs-hoehe, 72px);
    left: 0;
    z-index: 3;
    max-width: var(--content-width);
    margin: 0 auto;
    padding: 10px var(--space-4);
    background: var(--ground);
    box-shadow: 0 -14px 14px -2px var(--ground);
  }

  .cta .los {
    margin-top: 0;
  }

  .blatt-satz {
    margin: 0 0 16px;
    color: var(--ink-muted);
  }
</style>
