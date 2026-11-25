<script lang="ts">
  // Reiter „Mappe“ ohne fertigen Haushalt (B26, E93, Variante B): Leer eine ruhige Startseite mit Bild des
  // Deckblatts, „Haushalt anlegen“, dem Hinweis für Vermieter (E42) und der Anleitung „So entsteht eure
  // Mappe“. Angefangen die wachsende Mappe: das Deckblatt als lebende Vorschau, die Schritte als Karten,
  // fest „Weiter anlegen“ und leise „Von vorn beginnen“. Erst ein Knopf startet den Ablauf, nie der Reiter.
  import { onDestroy } from 'svelte';
  import { daten, db, gehe, stillLaden } from '../app/daten.svelte';
  import { nachLoeschen } from '../app/haushaltGeloescht.svelte';
  import { VERMIETER_ADRESSE, VERMIETER_DOMAIN } from '../app/name';
  import { t, tIn } from '../i18n';
  import { haushaltAendern, haushaltVonVorn } from '../storage/speicher';
  import { aufgehen, lauf } from '../ui/bewegung';
  import DeckblattBild from '../ui/DeckblattBild.svelte';
  import MappeBild from '../ui/MappeBild.svelte';
  import { geloescht } from '../ui/heftGeloescht.svelte';
  import { heftLoeschen, heftZurueckholen } from '../storage/speicher';
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
  // „du“ ohne Haushalt und mit nur einer Person im Vertrag (12y, E369 hebt E74.4 auf), sonst „ihr“.
  const du = $derived(vertrag.length <= 1);
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

  // Weg in den Ablauf: Das Deckblatt geht auf (Handbuch 3.20 „Aufgehen“), dann folgt der Schritt.
  let bild: HTMLElement | undefined = $state();
  async function los(pfad: string) {
    if (bild) {
      const l = lauf();
      aufgehen(l, bild);
      // Bis die nächste Seite steht, bleibt das Deckblatt weg; sonst springt es kurz zurück
      // (TestFlight 12.11.). Beim Zurückkommen ist die Seite neu, ohne diesen Stil.
      const b = bild;
      l.danach(() => (b.style.opacity = '0'));
      l.start();
      await l.fertig;
    }
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

  // Der Hinweis nach „Haushalt löschen“ gilt nur, bis man die Seite verlässt; mit ihm „Rückgängig“ nach
  // „Hefte auch löschen“ (DP50 Punkt 1, wie H1 in DP49). Danach räumt Hefta die Fotos weg.
  onDestroy(() => {
    nachLoeschen.offen = false;
    geloescht.mehrere = [];
  });
  const hefteDa = $derived(daten.hefte.length);
  async function hefteAuchLoeschen() {
    const verbindung = await db();
    const weg = [];
    for (const h of daten.hefte) {
      const alt = await heftLoeschen(verbindung, h.id);
      if (alt) weg.push(alt);
    }
    geloescht.mehrere = weg;
    await stillLaden();
  }
  async function hefteZurueck() {
    const verbindung = await db();
    for (const h of $state.snapshot(geloescht.mehrere)) await heftZurueckholen(verbindung, h);
    geloescht.mehrere = [];
    nachLoeschen.offen = false;
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
    {t('mappeStart.vermieter')}
    <a class="link-weit" href={VERMIETER_ADRESSE}>{VERMIETER_DOMAIN}</a>.
  </p>
{/snippet}

<main class="seite">
  {#if nachLoeschen.offen && !ansicht}
    <!-- DP50 Punkt 1: Nach „Haushalt löschen“ einmal die Frage nach den Heften, als Karte. „Hefte auch
         löschen“ in Tinte, nicht Rot (W5); danach „Rückgängig“ an der Stelle der Karte. -->
    {#if geloescht.mehrere.length}
      <p class="weg-zeile" role="status">
        <span>{t('mappeStart.hefteGeloescht', { anzahl: geloescht.mehrere.length })}</span>
        <button type="button" class="textlink" onclick={() => void hefteZurueck()}
          >{t('mappeStart.rueckgaengig')}</button
        >
      </p>
    {:else if hefteDa}
      <section class="geloescht" aria-labelledby="geloescht-titel">
        <h2 id="geloescht-titel">{t('mappeStart.geloeschtTitel')}</h2>
        <p>
          {tIn(nachLoeschen.du ? 'du' : 'ihr', 'mappeStart.geloeschtHefte', { anzahl: hefteDa })}
        </p>
        <div class="knopfreihe">
          <button type="button" class="btn" onclick={() => void hefteAuchLoeschen()}
            >{t('mappeStart.hefteAuchLoeschen', { anzahl: hefteDa })}</button
          >
          <button type="button" class="textlink" onclick={() => (nachLoeschen.offen = false)}
            >{t('mappeStart.behalten')}</button
          >
        </div>
      </section>
    {/if}
  {/if}
  {#if !angefangen}
    <!-- DP50 Punkt 1 (L1): oben die Mappe wie auf dem Tisch, darunter Knopf und drei Schritte. -->
    <p class="kicker leer-kicker">{t('mappeStart.mappe')}</p>
    <h1 class="h2 leer-titel">{t('mappeStart.titel')}</h1>
    <p class="leer-sub">{t('mappeStart.satz')}</p>
    <div class="leer-bild" bind:this={bild}><MappeBild /></div>
    <a
      class="btn los"
      href="#{anlegenZiel}"
      onclick={(e) => {
        e.preventDefault();
        void los(anlegenZiel);
      }}>{t('mappeStart.anlegen')}</a
    >
    <section class="anl" aria-labelledby="anleitung-mappe">
      <h2 id="anleitung-mappe" class="kicker anl-titel">{t('mappeStart.anleitungTitel')}</h2>
      <ol>
        {#each [1, 2, 3] as const as n (n)}
          <li>
            <span class="nr" aria-hidden="true">{n}</span>
            <span class="mt"
              ><b>{t(`mappeStart.schritt${n}Titel`)}</b><span>{t(`mappeStart.schritt${n}`)}</span
              ></span
            >
          </li>
        {/each}
      </ol>
    </section>
    {@render vermieter()}
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

  .geloescht {
    margin: 4px 0 20px;
    padding: 16px;
    border-radius: 20px;
    background: var(--surface);
  }

  .geloescht h2 {
    margin: 0;
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 700;
  }

  .geloescht p {
    margin: 4px 0 12px;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .knopfreihe {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 20px;
  }

  .knopfreihe .btn {
    min-height: 48px;
    font-size: calc(15 * var(--px));
  }

  .knopfreihe .textlink {
    min-height: var(--tap-target);
    font-size: calc(15 * var(--px));
    font-weight: 700;
  }

  .weg-zeile {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 4px 0 20px;
    padding: 4px 16px;
    min-height: 52px;
    border-radius: 16px;
    background: var(--weich-karte);
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }

  .weg-zeile .textlink {
    min-height: var(--tap-target);
    color: var(--ink);
    font-weight: 700;
  }

  .kicker.leer-kicker {
    margin-top: 16px;
    color: var(--ink-muted);
  }

  .leer-titel {
    margin: 6px 0 0;
    text-wrap: balance;
  }

  .leer-sub {
    margin: 8px 0 0;
    color: var(--ink-muted);
  }

  .leer-bild {
    margin: 20px auto 0;
    max-width: 300px;
  }

  .nr {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1.5px var(--ink-muted);
    font-size: calc(13 * var(--px));
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .verm {
    margin: 14px 4px 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .verm a {
    color: inherit;
  }

  .anl {
    margin-top: 24px;
  }

  .kicker.anl-titel {
    margin: 0 4px 8px;
    color: var(--ink-muted);
    line-height: 18px;
  }

  .anl ol {
    display: grid;
    margin: 0;
    padding: 4px 16px;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
  }

  /* Nummern an der ersten Zeile, nicht mittig (DP50, wie Ü2). */
  .anl li {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr);
    gap: 14px;
    align-items: start;
    padding: 12px 0;
  }

  .anl li + li {
    border-top: 1px solid var(--track);
  }

  .mt b {
    display: block;
    font-size: calc(15 * var(--px));
  }

  .mt span {
    display: block;
    color: var(--ink-muted);
    font-size: calc(13.5 * var(--px));
    line-height: calc(19 * var(--px));
  }

  .kicker {
    /* DP35 R3: Aktion in Tinte; Rot nur für Zurück und Warnungen. */
    margin: 4px 0 0;
    color: var(--ink);
    font-size: calc(12 * var(--px));
    font-weight: 600;
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
    padding: 16px;
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
    /* DP35 R3: Aktion in Tinte; Rot nur für Zurück und Warnungen. */
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 6px;
    color: var(--ink);
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
    /* DP35 R3: Aktion in Tinte; Rot nur für Zurück und Warnungen. */
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 44px;
    border: 0;
    background: none;
    color: var(--ink);
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
