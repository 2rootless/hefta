<script lang="ts">
  // Ein Heft (B28b, DP21 Abschnitt 1): Leiste „‹ Wohnungen · Heft“, Foto über die ganze Breite (K1),
  // Name, Adresse, Eckdaten mit „warm“ und zwei leise Links; der Stand mit Weg und Marke; darunter weiche
  // Flächen ohne Rahmen: „Was hinausging“ (ab „Beworben“), „Zu euren Wünschen“, Notizen und die übrigen
  // Abschnitte. Den Stand ändert nur noch die Frage im Stand.
  import { onMount, tick, untrack } from 'svelte';
  import { route } from '../app/router.svelte';
  import { haushaltsNetto } from '../domain/netto';
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { istAndroidApp, istApp } from '../app/plattform';
  import { eckdaten, heftAdresseKurz, heftTitel, tagKurz } from '../domain/heftKarte';
  import { lage } from '../domain/heftLage';
  import { homescreenFragen } from '../ui/homescreen';
  import type { HeftEreignisse, SpurEintrag } from '../domain/modell';
  import { namenListe, spurAn, spurEintragen } from '../domain/datenspur';
  import { erkennen } from '../domain/nachricht';
  import { urteile, type Urteil } from '../domain/urteile';
  import { t, type TextSchluessel } from '../i18n';
  import { wohnungAus } from '../lesen/angaben';
  import { lageAnwenden } from '../domain/lage';
  import { plzTabelle } from '../ui/plz.svelte';
  import { einstellungenAendern, heftAendern } from '../storage/speicher';
  import Rueckmeldung from '../ui/Rueckmeldung.svelte';
  import RueckmeldungMail from '../ui/RueckmeldungMail.svelte';
  import { passend } from '../ui/passend';
  import TabLeiste from '../ui/TabLeiste.svelte';
  import { inDenKalender } from '../ui/kalenderEintrag';
  import BesichtigungsFragen from '../ui/BesichtigungsFragen.svelte';
  import HeftFotos from '../ui/HeftFotos.svelte';
  import HeftStand from '../ui/HeftStand.svelte';
  import { foto, fotoLaden, fotoVergessen } from '../ui/heftFoto.svelte';
  import { blende, lauf } from '../ui/bewegung';
  import { flugFuer, landen, merken } from '../ui/heftFlug';
  import { sicherungMs, wechselArt } from '../ui/wechsel';
  import Zurueck from '../ui/Zurueck.svelte';

  let { id }: { id: string } = $props();

  const heft = $derived(daten.hefte.find((h) => h.id === id) ?? null);
  const jetzt = new Date();
  const ihr = $derived(
    // Ohne Haushalt „ihr“ (E74.4, Design 12.11.), sonst ab zwei Personen ohne Bürgen.
    !daten.ansicht ||
      daten.ansicht.mitglieder.filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length > 1,
  );
  const l = $derived(heft ? lage(heft.ereignisse, jetzt, !!daten.ansicht) : null);

  // Öffnen eines Hefts. Aus der Liste: Muster „Heft aufschlagen“ (der Flug landet hier). Sonst kommt der
  // Rest im Takt; PC8 A5: diese Bewegung fällt nach ihrer Dauer sicher weg.
  const fliegt = untrack(() => flugFuer('heft', id));
  let auf = $state(
    !fliegt && untrack(() => wechselArt(route.von, route.pfad, route.richtung) === 'heft'),
  );
  let seiteEl = $state<HTMLElement | null>(null);
  let bildEl = $state<HTMLElement | null>(null);
  let nameEl = $state<HTMLElement | null>(null);
  /** Was Platz macht oder nachkommt: alles außer Foto und Name (Handbuch 3.9). */
  function heftTeile(): Element[] {
    if (!seiteEl) return [];
    const kopf = seiteEl.querySelector('.kopf');
    return [
      ...[...seiteEl.children].filter((c) => !c.classList.contains('kopfteil')),
      ...(kopf ? [...kopf.children].filter((c) => c !== nameEl) : []),
    ];
  }
  function zuschlagen() {
    if (!seiteEl) return;
    merken({
      nach: 'liste',
      heftId: id,
      seite: seiteEl,
      // Ist der Kopf weggescrollt, entfällt der Flug (Handbuch 3.9).
      bild: window.scrollY < 40 ? bildEl : null,
      name: nameEl,
      teile: heftTeile(),
    });
  }
  onMount(() => {
    if (fliegt)
      void tick().then(() => {
        if (seiteEl)
          void landen({
            nach: 'heft',
            seite: seiteEl,
            bild: bildEl,
            name: nameEl,
            teile: heftTeile(),
          });
      });
    if (!auf) return;
    const ende = () => (auf = false);
    const uhr = setTimeout(ende, seiteEl ? sicherungMs(seiteEl) : 0);
    document.addEventListener('visibilitychange', ende);
    return () => {
      clearTimeout(uhr);
      document.removeEventListener('visibilitychange', ende);
    };
  });

  // ---------- Kopf K1: Foto ----------

  const f = $derived(foto(heft?.foto));
  $effect(() => {
    const fid = heft?.foto;
    untrack(() => {
      fotoVergessen(fid);
      void fotoLaden(fid);
    });
  });
  // Ist das Foto da, blendet es ein (Muster „Blende“), kein Ladezeichen.
  let fotoEl = $state<HTMLImageElement | null>(null);
  let warLadend = false;
  $effect(() => {
    if (f.zustand === 'laedt') warLadend = true;
    if (f.zustand === 'da' && fotoEl && warLadend) {
      warLadend = false;
      const lf = lauf();
      blende(lf, [fotoEl]);
      lf.start();
    }
  });

  const titel = $derived(heft ? heftTitel(heft) : null);
  const nf = (n: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(n);
  /** „1.390 € warm · 3 Zi · 81 m²“: „warm“, weil Wünsche und Anteil mit der Warmmiete rechnen. */
  const eck = $derived.by(() => {
    const a = heft?.angaben;
    if (!a) return '';
    if (a.warm != null && a.zimmer != null && a.flaeche != null && !a.warmCa && !a.flaecheCa)
      return t('heft.eckWarm', {
        betrag: `${new Intl.NumberFormat('de-DE').format(Math.round(a.warm))} €`,
        zimmer: nf(a.zimmer),
        flaeche: nf(a.flaeche),
      });
    // Fehlt eine Angabe oder ist sie geschätzt, die Eckdaten wie auf der Karte.
    return heft ? eckdaten(heft) : '';
  });

  // ---------- Abgleich mit den Wünschen ----------

  const alleUrteile = $derived.by(() => {
    const a = heft?.angaben;
    const hh = daten.ansicht?.haushalt;
    if (!a || !hh?.wuensche) return null;
    const w = lageAnwenden(wohnungAus(a), heft!.adresse, hh.wuensche, plzTabelle());
    return urteile(w.w, w.wu, {
      netto: haushaltsNetto(hh, daten.ansicht?.mitglieder ?? []),
      grenze: hh.mietgrenze ?? null,
      ihr,
    });
  });
  const URTEIL_WORT: Record<string, TextSchluessel> = {
    passt: 'neuesHeft.urteilPasst',
    knapp: 'neuesHeft.urteilKnapp',
    nicht: 'neuesHeft.urteilNicht',
    offen: 'neuesHeft.urteilOffen',
  };
  const wunschZeilen = $derived.by(() => {
    const hh = daten.ansicht?.haushalt;
    return (alleUrteile ?? [])
      .filter((u) => u.art in URTEIL_WORT)
      .map((u: Urteil) => {
        if (u.kriterium === 'Anteil am Einkommen')
          return {
            art: u.art,
            titel: t('heft.wunschAnteil', { wert: parseInt(u.wert, 10) || 0 }),
            grund:
              hh?.mietgrenze != null ? t('heft.wunschAnteilGrenze', { grenze: hh.mietgrenze }) : '',
          };
        return {
          art: u.art,
          titel: u.wert && u.wert !== '–' ? `${u.kriterium} ${u.wert}` : u.kriterium,
          grund:
            // „offen“: Die Angabe steht nicht im Inserat (der Name stünde sonst doppelt da).
            u.art === 'passt' ? '' : u.art === 'offen' ? t('neuesHeft.grundFehlt') : u.abweichung,
        };
      });
  });

  // Ohne Haushalt führt „Wer zieht ein?“ in die Einrichtung, wie der Tab „Mappe“.
  const haushaltZiel = $derived(
    homescreenFragen(daten.einstellungen) ? '#/homescreen/einrichtung' : '#/einrichtung',
  );

  // ---------- Rückmeldung bei den Ergebnissen (PC12: je Heft einmal, nach drei Antworten nicht mehr) ----

  const rueckmeldungZeigen = $derived(
    !!heft && !heft.rueckmeldungFertig && (daten.einstellungen?.rueckmeldungAntworten ?? 0) < 3,
  );
  // Nach einer Antwort bleibt „Danke“ stehen, bis das Heft wieder geöffnet wird.
  const rueckmeldungBeimOeffnen = untrack(() => rueckmeldungZeigen);
  let rueckmeldungWeg = $state(false);
  async function rueckmeldungFertig(beantwortet: boolean) {
    if (!heft) return;
    await heftAendern(await db(), heft.id, { rueckmeldungFertig: true });
    if (beantwortet)
      await einstellungenAendern(await db(), {
        rueckmeldungAntworten: (daten.einstellungen?.rueckmeldungAntworten ?? 0) + 1,
      });
    else rueckmeldungWeg = true;
    await stillLaden();
  }

  // E100: Löschbitte oder Nachfrage geöffnet, aber nicht sicher hinaus: einmal fragen.
  const mailFragen = $derived.by(() => {
    const e = heft?.ereignisse;
    if (!e) return [];
    const liste: { art: 'loeschbitte' | 'nachfrage'; frage: TextSchluessel }[] = [];
    if (e.loeschbitteOffen && !e.loeschbitteAm)
      liste.push({
        art: 'loeschbitte',
        frage: ihr ? 'heft.loeschbitteFrageIhr' : 'heft.loeschbitteFrageDu',
      });
    if (e.nachfrageOffen)
      liste.push({
        art: 'nachfrage',
        frage: ihr ? 'heft.nachfrageFrageIhr' : 'heft.nachfrageFrageDu',
      });
    return liste;
  });

  async function mailBestaetigen(art: 'loeschbitte' | 'nachfrage', ja: boolean) {
    if (!heft) return;
    const e = $state.snapshot(heft.ereignisse);
    const am =
      (art === 'loeschbitte' ? e.loeschbitteOffen : e.nachfrageOffen) ?? new Date().toISOString();
    // „Noch nicht“ lässt den Stand, wie er war; Hefta fragt erst nach dem nächsten Öffnen wieder.
    const neu =
      art === 'loeschbitte'
        ? { ...e, loeschbitteOffen: null, ...(ja ? { loeschbitteAm: am } : {}) }
        : { ...e, nachfrageOffen: null, ...(ja ? { nachgefasstAm: am } : {}) };
    const an = spurAn({
      anbieter: heft.angaben?.anbieter,
      mail: erkennen(heft.inseratText ?? '').mail,
      portal: null,
      weg: 'mail',
    });
    await heftAendern(await db(), heft.id, {
      ereignisse: neu,
      ...(ja
        ? {
            spur: spurEintragen($state.snapshot(heft.spur), {
              am,
              art: art === 'loeschbitte' ? 'loeschbitte' : 'nachfrage',
              weg: 'mail',
              an,
            }),
          }
        : {}),
    });
    await stillLaden();
  }

  /** „Mail an Frau Hansen“; ohne Namen „Mail an den Vermieter“ (DP21). */
  const mailAn = $derived(
    (heft && spurAn({ anbieter: heft.angaben?.anbieter, mail: null, portal: null, weg: 'mail' })) ||
      'den Vermieter',
  );

  /** Wartet eine Frage bis zur Zusage (Mietrückstände, E49)? Dann führt „Noch offen“ zur Selbstauskunft. */
  const mietrueckZiel = $derived.by(() => {
    if (!heft?.export?.mietrueckstaendeNachZusage) return null;
    const m = daten.ansicht?.mitglieder.find(
      (x) =>
        x.zugehoerigkeit.rolle !== 'buerge' &&
        !x.zugehoerigkeit.herausgenommenAm &&
        x.person.selbstauskunft?.mietrueckstaende == null,
    );
    return m ? `#/selbstauskunft/${m.person.id}` : null;
  });

  /** „Mail an Herrn Kraus“, „Über ImmoScout24“, „Löschbitte an …“: die erste Zeile eines Eintrags. */
  function spurKopf(e: SpurEintrag): string {
    if (e.art === 'loeschbitte')
      return e.an ? t('heft.spurLoeschbitte', { an: e.an }) : t('heft.spurLoeschbitteOhne');
    if (e.art === 'nachfrage')
      return e.an ? t('heft.spurNachfrage', { an: e.an }) : t('heft.spurNachfrageOhne');
    if (e.weg === 'mail') return e.an ? t('heft.spurMail', { an: e.an }) : t('heft.spurMailOhne');
    if (e.weg === 'portal')
      return e.an ? t('heft.spurPortal', { an: e.an }) : t('heft.spurPortalOhne');
    if (e.weg === 'website') return t('heft.spurWebsite');
    return t('heft.spurSonst');
  }

  const TITEL_STUFEN = ['26px/29px', '23px/26px', '20px/23px', '18px/21px', '16px/19px'];

  let kalenderMeldung = $state('');
  async function kalender() {
    if (!heft) return;
    kalenderMeldung = '';
    const a = await inDenKalender(heft, heftTitel(heft).text);
    // Vermerk für „Termin entfernen“: Dann steht dort der Satz zum Kalender (Planung 12t).
    if (
      (a === 'gesichert' || a === 'datei') &&
      heft.ereignisse.termin &&
      !heft.ereignisse.termin.imKalender
    )
      await ereignisse({
        ...heft.ereignisse,
        termin: { ...heft.ereignisse.termin, imKalender: true },
      });
    kalenderMeldung =
      a === 'gesichert'
        ? t('heft.kalenderGesichert')
        : a === 'nicht_erlaubt'
          ? t('heft.kalenderNein')
          : a === 'datei' && !istApp()
            ? t('heft.kalenderDatei')
            : '';
  }

  async function ereignisse(neu: HeftEreignisse) {
    if (!heft) return;
    // Ohne Proxys von Svelte: IndexedDB kann sie nicht kopieren.
    await heftAendern(await db(), heft.id, { ereignisse: $state.snapshot(neu) });
    await stillLaden();
  }

  let notiz = $state('');
  let notizVon = $state<string | null>(null);
  $effect(() => {
    // Beim Öffnen eines anderen Hefts die gespeicherte Notiz übernehmen, sonst nicht überschreiben.
    if (heft && notizVon !== heft.id) {
      notiz = heft.notiz;
      notizVon = heft.id;
    }
  });

  async function notizSichern() {
    if (!heft || notiz === heft.notiz) return;
    await heftAendern(await db(), heft.id, { notiz });
    await stillLaden();
  }

  let spurEl = $state<HTMLElement | null>(null);
</script>

{#snippet platzBild()}
  <!-- Ohne Foto: weiches Feld im Akzent mit gezeichneten Fenstern (DP16). -->
  <svg class="platz" viewBox="0 0 390 195" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="390" height="195" class="pf" />
    {#each [40, 80, 120] as y (y)}
      {#each [117, 151, 185, 219, 253] as x (x)}
        <rect {x} {y} width="20" height="26" rx="3" class="pr" />
      {/each}
    {/each}
    <path d="M105 160H285" class="pr" />
  </svg>
{/snippet}

<main class="seite" class:auf data-heft={id} bind:this={seiteEl}>
  <header class="bar">
    <Zurueck href="#/wohnungen" text={t('heft.zurueck')} davor={zuschlagen} />
    <span class="ort">{t('heft.ort')}</span>
  </header>

  {#if !heft || !titel || !l}
    <p class="fehlt">{t('heft.fehlt')}</p>
  {:else}
    <div class="kopfteil" class:abgelegt={l.abgelegt}>
      <div class="bild" data-foto={f.zustand} bind:this={bildEl}>
        {#if f.zustand === 'da' && f.url}
          <img class="foto" bind:this={fotoEl} src={f.url} alt={t('heft.fotoAlt')} />
        {:else}
          {@render platzBild()}
        {/if}
      </div>
      <div class="kopf">
        <!-- Lange Wörter nie mitten im Wort trennen: lieber kleinere Schrift (Prüfkatalog C2). -->
        <h1 use:passend={TITEL_STUFEN} bind:this={nameEl}>{titel.text}</h1>
        <p class="adr">{heftAdresseKurz(heft)}</p>
        {#if eck}<p class="eck">{eck}</p>{/if}
        <div class="links">
          <a href={`#/heft/${heft.id}/merkmal`}>{t('heft.nameAendern')}</a>
          {#if heft.link}
            <a href={heft.link} target="_blank" rel="noopener noreferrer">{t('heft.zumInserat')}</a>
          {/if}
        </div>
      </div>
    </div>

    <HeftStand
      {heft}
      {jetzt}
      mitHaushalt={!!daten.ansicht}
      {haushaltZiel}
      an={mailAn}
      {mietrueckZiel}
      spur={spurEl}
      {kalender}
      {kalenderMeldung}
      aendern={ereignisse}
    >
      {#snippet rueckmeldung()}
        {#if rueckmeldungBeimOeffnen && !rueckmeldungWeg}
          {#if istAndroidApp()}<RueckmeldungMail />{:else}<Rueckmeldung
              fragen={['geholfen']}
              frisch
              gesendetBei={() => void rueckmeldungFertig(true)}
            />{/if}
          {#if rueckmeldungZeigen}
            <button class="leis" type="button" onclick={() => rueckmeldungFertig(false)}
              >{t('rueckmeldung.nichtMehrFragen')}</button
            >
          {/if}
        {/if}
      {/snippet}
    </HeftStand>

    {#each mailFragen as fr (fr.art)}
      <!-- E100: Die Mail wurde geöffnet, ob sie hinausging, weiß Hefta nicht sicher. -->
      <section class="block">
        <b class="mf">{t(fr.frage)}</b>
        <div class="knopfreihe">
          <button class="knopf haupt" type="button" onclick={() => mailBestaetigen(fr.art, true)}
            >{t('heft.mailJa')}</button
          >
          <button class="knopf" type="button" onclick={() => mailBestaetigen(fr.art, false)}
            >{t('heft.nochNicht')}</button
          >
        </div>
      </section>
    {/each}

    <!-- Was hinausging (Datenspur, B21): erst ab „Beworben“; erscheint und geht mit dem Stand. -->
    <section class="block" bind:this={spurEl} hidden={!(l.ort >= 1 && heft.spur?.length)}>
      <h2>{t('heft.spurTitel')}</h2>
      {#each [...(heft.spur ?? [])].reverse() as e (e.am + e.art)}
        <div class="zeile">
          <span class="wo">
            <b>{tagKurz(e.am)} · {spurKopf(e)}</b>
            {#if e.art === 'mappe'}
              <small
                >{[
                  t('heft.spurMappe', { fassung: e.fassung ?? 1 }),
                  e.unterlagen ? t('heft.spurUnterlagen', { anzahl: e.unterlagen }) : '',
                  e.seiten ? t('heft.spurSeiten', { anzahl: e.seiten }) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}</small
              >
              {#if e.ueber}<small>{t('heft.spurUeber', { ziel: e.ueber })}</small>{/if}
              {#if e.personen?.length}
                <small>{t('heft.spurPersonen', { namen: namenListe(e.personen) })}</small>
              {/if}
            {:else if e.art === 'loeschbitte'}
              <small>{t('heft.spurGeloescht')}</small>
            {/if}
          </span>
        </div>
      {/each}
    </section>

    {#if heft.ereignisse.termin}
      <!-- Fragen für die Besichtigung (E52): ab dem Termin, danach mit den Antworten. -->
      <BesichtigungsFragen {heft} urteile={alleUrteile ?? []} {ihr} />
    {/if}

    {#if daten.ansicht}
      <section class="block">
        <h2>{t(ihr ? 'heft.wuenscheIhr' : 'heft.wuenscheDu')}</h2>
        {#if wunschZeilen.length}
          {#each wunschZeilen as z, i (i)}
            <div class="zeile">
              <span class="wo"
                ><b>{z.titel}</b>{#if z.grund}<small>{z.grund}</small>{/if}</span
              >
              <span class="urteil {z.art}">{t(URTEIL_WORT[z.art]!)}</span>
            </div>
          {/each}
          <a class="mehr" href="#/wuensche">{t('wuensche.aendern')}</a>
        {:else}
          <p class="leer">{t(ihr ? 'wuensche.ohneIhr' : 'wuensche.ohneDu')}</p>
          <a class="mehr" href="#/wuensche">{t('wuensche.festlegen')}</a>
        {/if}
      </section>
    {/if}

    <section class="block">
      <h2><label for="notiz">{t('heft.notizen')}</label></h2>
      <textarea
        id="notiz"
        rows="3"
        placeholder={t(ihr ? 'heft.notizIhr' : 'heft.notizDu')}
        bind:value={notiz}
        onblur={notizSichern}></textarea>
    </section>

    <!-- B21: Fotos der Besichtigung unter den Notizen, nur auf dem Gerät. -->
    <HeftFotos {heft} />
  {/if}
</main>
<TabLeiste aktiv="wohnungen" />

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: env(safe-area-inset-top) var(--space-4) calc(var(--tabs-hoehe, 72px) + 24px);
  }

  /* Leiste: „‹ Wohnungen“, in der Mitte „Heft“. */
  .bar {
    --on-zurueck: var(--accent-text);
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    min-height: 52px;
    padding: 4px 0;
  }

  .bar .ort {
    color: var(--ink-muted);
    font-size: calc(12.5 * var(--px));
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .fehlt {
    color: var(--ink-muted);
  }

  /* Kopf K1: Foto im Verhältnis 2:1 über die ganze Breite, auf die Mitte zugeschnitten, etwas über der
     Mitte. Ablegen: Foto grau und blasser, Kopf auf 70 % (Muster „Ablegen“). */
  .bild {
    position: relative;
    overflow: hidden;
    margin: 0 calc(-1 * var(--space-4));
    aspect-ratio: 2 / 1;
    background: var(--foto-grund);
    transition:
      filter var(--bw-lang) var(--bw-weich),
      opacity var(--bw-lang) var(--bw-weich);
  }

  .foto,
  .platz {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .foto {
    object-fit: cover;
    object-position: 50% 40%;
  }

  .platz .pf {
    fill: var(--accent-soft);
  }

  .platz .pr {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    opacity: 0.55;
  }

  .kopf {
    padding: 14px 4px 4px;
    transition: opacity var(--bw-lang) var(--bw-weich);
  }

  .abgelegt .bild {
    filter: grayscale(1);
    opacity: 0.45;
  }

  .abgelegt .kopf {
    opacity: 0.7;
  }

  .kopf h1 {
    margin: 0;
    font-size: calc(26 * var(--px));
    font-weight: 780;
    font-stretch: 112%;
    line-height: 1.1;
    text-wrap: balance;
  }

  .adr {
    margin: 4px 0 0;
    color: var(--ink-muted);
    font-size: calc(14.5 * var(--px));
  }

  .eck {
    margin: 8px 0 0;
    font-size: calc(15 * var(--px));
    font-weight: 650;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 0 18px;
    margin-top: 4px;
  }

  .links a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--accent-text);
    font-size: calc(14 * var(--px));
    font-weight: 500;
    text-decoration: none;
  }

  /* Unter dem Stand: weiche Flächen, keine Rahmen (DP21). */
  .block {
    margin: 14px 0 0;
    padding: 16px;
    border-radius: 22px;
    background: var(--surface);
  }

  .block h2 {
    margin: 0 0 6px;
    color: var(--ink-muted);
    font-size: calc(12 * var(--px));
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .zeile {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 10px 0;
  }

  .zeile + .zeile {
    box-shadow: 0 -1px 0 var(--line);
  }

  .wo {
    flex: 1;
    min-width: 0;
  }

  .wo b {
    display: block;
    font-weight: 650;
  }

  .wo small {
    display: block;
    margin-top: 1px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .leer {
    margin: 0;
    padding: 4px 0;
    color: var(--ink-muted);
    font-size: calc(14.5 * var(--px));
  }

  .mehr {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--accent-text);
    font-size: calc(14 * var(--px));
    font-weight: 600;
    text-decoration: none;
  }

  .mf {
    display: block;
    margin-bottom: 10px;
  }

  .knopfreihe {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .knopf {
    display: inline-flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--radius-full);
    background: var(--ground);
    color: var(--ink);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 650;
    cursor: pointer;
  }

  .knopf.haupt {
    background: var(--action);
    color: var(--on-action);
  }

  .leis {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent-text);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 600;
    cursor: pointer;
  }

  textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 88px;
    padding: 12px 14px;
    border: 0;
    border-radius: 14px;
    background: var(--ground);
    color: var(--ink);
    font: inherit;
    resize: vertical;
  }

  /* Öffnen ohne Flug: Der Kopf steht, der Rest kommt im Takt. */
  .auf > :not(.bar, .kopfteil) {
    animation: bw-folgen var(--bw-mittel) var(--bw-ziel) var(--bw-takt) backwards;
  }
</style>
