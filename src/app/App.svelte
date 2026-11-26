<script lang="ts">
  import { APP_NAME } from './name';
  import { untrack } from 'svelte';
  import { faktenNachrechnen, fehlenFakten } from './pruefung';
  import { rueck, rueckgaengigVergessen } from './rueckgaengig.svelte';

  import RueckgaengigZeile from '../ui/RueckgaengigZeile.svelte';
  import { onMount } from 'svelte';
  import Einrichtung from '../screens/Einrichtung.svelte';
  import Haushalt from '../screens/Haushalt.svelte';
  import Uebersicht from '../screens/Uebersicht.svelte';
  import HinweisKasten from '../ui/HinweisKasten.svelte';
  import Stoerung from '../ui/Stoerung.svelte';
  import { verwaisteDateienLoeschen } from '../storage/speicher';
  import { geloescht } from '../ui/heftGeloescht.svelte';
  import { daten, db, neuLaden, verbindungPruefen } from './daten.svelte';
  import { pdfFenster } from './pdfFenster.svelte';
  import { fehlerBeobachten, hinweise } from './hinweise.svelte';
  import { route } from './router.svelte';
  import { anrede, anredeFuer } from '../i18n/anrede.svelte';
  import { linkWegDa } from './plattform';
  import { wechselArt, wechselEnde } from '../ui/wechsel';
  import { stelleNachsetzen } from '../ui/scrollMerken';

  // Der Technik-Test (M0-Spike) wird nur bei Bedarf geladen, damit PDF.js nicht im Start-Bundle steckt.
  const technikTest = () => import('../spike/TechnikTest.svelte');
  // Seltener gebrauchte Bildschirme als eigene Dateien: Der Start lädt nur Übersicht, Einrichtung
  // und Haushalt. Aus dem Cache des Service Workers kommen sie praktisch ohne Wartezeit.
  const seiten = {
    mappe: () => import('../screens/MappeErstellen.svelte'),
    anpassen: () => import('../screens/MappeAnpassen.svelte'),
    bitte: () => import('../screens/MappeBitte.svelte'),
    person: () => import('../screens/Person.svelte'),
    personLoeschen: () => import('../screens/PersonLoeschen.svelte'),
    personSeite: () => import('../screens/PersonSeite.svelte'),
    unterlage: () => import('../screens/Unterlage.svelte'),
    wbs: () => import('../screens/WbsSeite.svelte'),
    geno: () => import('../screens/GenossenschaftSeite.svelte'),
    vermieterWahl: () => import('../screens/VermieterWahl.svelte'),
    version: () => import('../screens/VersionSeite.svelte'),
    rutsch: () => import('../screens/Rutsch.svelte'),
    homescreen: () => import('../screens/Homescreen.svelte'),
    wohnungen: () => import('../screens/Wohnungen.svelte'),
    mappeStart: () => import('../screens/MappeStart.svelte'),
    heft: () => import('../screens/HeftSeite.svelte'),
    merkmal: () => import('../screens/MerkmalSeite.svelte'),
    termin: () => import('../screens/TerminSeite.svelte'),
    bewerben: () => import('../screens/BewerbenSeite.svelte'),
    heftMail: () => import('../screens/HeftMailSeite.svelte'),
    wuensche: () => import('../screens/WuenscheSeite.svelte'),
    anleitung: () => import('../screens/AnleitungSeite.svelte'),
    netto: () => import('../screens/NettoSeite.svelte'),
    wohnungNeu: () => import('../screens/WohnungNeu.svelte'),
    neuesHeftLink: () => import('../screens/NeuesHeftLink.svelte'),
    heftVorschau: () => import('../screens/HeftVorschau.svelte'),
    heftKontrolle: () => import('../screens/HeftKontrolle.svelte'),
    auskuenfte: () => import('../screens/Selbstauskuenfte.svelte'),
    auskunft: () => import('../screens/SelbstauskunftSeite.svelte'),
    uebertragen: () => import('../screens/Uebertragen.svelte'),
    eingang: () => import('../screens/Eingang.svelte'),
    buergschaft: () => import('../screens/BuergschaftSeite.svelte'),
    buergschaftStart: () => import('../screens/BuergschaftStart.svelte'),
  };
  const pdfAnsicht = () => import('../ui/PdfFenster.svelte');

  // Einstellungen und Backup sind selten: eigene Datei, damit der Start klein bleibt.
  const einstellungen = {
    '/einstellungen': () => import('../screens/Einstellungen.svelte'),
    '/einstellungen/backup': () => import('../screens/BackupErstellen.svelte'),
    '/einstellungen/einspielen': () => import('../screens/BackupEinspielen.svelte'),
    '/einstellungen/rechtliches': () => import('../screens/Rechtliches.svelte'),
    '/einstellungen/loeschen': () => import('../screens/AllesLoeschen.svelte'),
    // DP50 Punkt 10: Unterseite „Fragen für die Besichtigung“.
    '/einstellungen/fragen': () => import('../screens/FragenEinstellungen.svelte'),
  } as const;
  const einstellungsSeite = $derived(
    einstellungen[route.pfad as keyof typeof einstellungen] as
      (typeof einstellungen)[keyof typeof einstellungen] | undefined,
  );

  /**
   * K14 (W8, PC139): Personenseite, Selbstauskunft und Unterlage blieben beim ersten Öffnen 3 bis 5 Bilder lang
   * leer, weil sie erst dann geladen wurden. Kurz nach dem Start lädt Hefta sie im Leerlauf vor. Sie liegen in
   * der App, es geht nichts ins Netz. Browsertests schalten das mit `__heftaOhneVorladen` ab (Gegenprobe).
   */
  function seitenVorladen(): number {
    const fenster = window as unknown as {
      __heftaOhneVorladen?: boolean;
      requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number;
    };
    if (fenster.__heftaOhneVorladen) return 0;
    const laden = () => {
      for (const s of [seiten.person, seiten.auskunft, seiten.unterlage]) s().catch(() => {});
    };
    // Safari kennt requestIdleCallback nicht; dort genügt eine kurze Pause nach dem Start.
    return window.setTimeout(
      () =>
        fenster.requestIdleCallback
          ? fenster.requestIdleCallback(laden, { timeout: 1000 })
          : laden(),
      300,
    );
  }

  onMount(() => {
    // Schlägt das Laden fehl, zeigt `Stoerung` den Grund; hier nichts weiter tun.
    neuLaden().catch(() => {});
    const zurueck = () => {
      if (document.visibilityState === 'visible') void verbindungPruefen();
    };
    document.addEventListener('visibilitychange', zurueck);
    // Ein Fehler kann an der Verbindung zum Speicher liegen: prüfen und bei Bedarf neu verbinden.
    const aufhoeren = fehlerBeobachten(() => void verbindungPruefen());
    const vorladenZeit = seitenVorladen();
    return () => {
      document.removeEventListener('visibilitychange', zurueck);
      aufhoeren();
      window.clearTimeout(vorladenZeit);
    };
  });

  // PC214: Liste, Seite oder Bürgschaft einer Person ohne Haushalt.
  const ohneSeite = $derived.by(() => {
    if (route.pfad === '/selbstauskunft' || route.pfad === '/buergschaft') return true;
    const id = route.pfad.match(/^\/(?:selbstauskunft|buergschaft)\/([\w-]+)/)?.[1];
    return !!id && !!daten.ohne?.mitglieder.some((m) => m.person.id === id);
  });

  // Ansprache der App an einer Stelle (E74, E83, B28b): Texte mit Paar „ihr“/„du“ folgen ihr.
  $effect.pre(() => {
    const m = daten.ansicht?.mitglieder;
    // PC214: Seiten ohne Haushalt sprechen mit „du“ (E369), auch bei mehreren Personen.
    if (ohneSeite) {
      anrede.wert = 'du';
      return;
    }
    anrede.wert = anredeFuer(
      m
        ? m.filter((x) => x.zugehoerigkeit.rolle !== 'buerge' && !x.zugehoerigkeit.herausgenommenAm)
            .length
        : null,
    );
  });

  const personId = $derived(route.pfad.match(/^\/person\/([\w-]+)$/)?.[1]);
  // Bewegung beim Wechsel (Design 12.11.): Hefta 2 nach Vorgabe, alles andere blendet über wie bisher.
  const wechselKlasse = $derived.by(() => {
    const w = wechselArt(route.von, route.pfad, route.richtung);
    return w === 'keine' ? '' : w === 'einblenden' ? 'einblenden' : `wechsel-${w}`;
  });
  const heftId = $derived(route.pfad.match(/^\/heft\/([\w-]+)$/)?.[1]);
  // E112: Bürgschaftserklärung, aus dem Heft mit Person und Heft, sonst leer.
  const buergschaft = $derived(route.pfad.match(/^\/buergschaft(?:\/([\w-]+)(?:\/([\w-]+))?)?$/));
  // DP45 G2: Mitgliedschaft ablegen und „Wer vermietet?“ im Heft.
  const genoId = $derived(
    route.pfad.match(/^\/haushalt-unterlage\/genossenschaft\/([\w-]+)$/)?.[1],
  );
  const vermieterHeft = $derived(route.pfad.match(/^\/heft\/([\w-]+)\/vermieter$/)?.[1]);
  const merkmalId = $derived(route.pfad.match(/^\/heft\/([\w-]+)\/merkmal$/)?.[1]);
  // Zeile 9: Termin, Stand selbst setzen, Ergebnis.
  const heftUnter = $derived(
    route.pfad.match(/^\/heft\/([\w-]+)\/(termin|bewerben|loeschbitte|nachfassen)$/),
  );
  const unterlage = $derived(
    route.pfad.match(/^\/unterlage\/([\w-]+)\/(\w+)(\/datum(?:\/([\w-]+))?)?$/),
  );
  const seitenEdit = $derived(
    route.pfad.match(/^\/unterlage\/([\w-]+)\/(\w+)\/version\/([\w-]+)\/seiten$/),
  );
  const aufteilen = $derived(route.pfad.match(/^\/unterlage\/([\w-]+)\/(\w+)\/aufteilen$/));
  const version = $derived(route.pfad.match(/^\/unterlage\/([\w-]+)\/(\w+)\/version\/([\w-]+)$/));
  const rutschPerson = $derived(route.pfad.match(/^\/rutsch\/([\w-]+)$/)?.[1]);
  const loeschenId = $derived(route.pfad.match(/^\/person-loeschen\/([\w-]+)$/)?.[1]);
  const auskunft = $derived(
    route.pfad.match(/^\/selbstauskunft\/([\w-]+)(\/bereich)?(?:\/feld\/(\w+))?$/),
  );
  const uebertragen = $derived(route.pfad.match(/^\/selbstauskunft\/([\w-]+)\/uebertragen$/)?.[1]);
  // Person hinzufügen bzw. ändern (Entscheidung F); der Zusatz sagt, wohin es danach zurückgeht.
  const personNeu = $derived(
    route.pfad.match(/^\/person-neu\/(mitmieter|buerge)(\/einrichtung)?$/),
  );
  const personAendern = $derived(
    route.pfad.match(
      /^\/person-aendern\/([\w-]+)(\/einrichtung|\/person|\/mappe|\/nachname|\/ohne)?$/,
    ),
  );
  function zurueckZu(zusatz: string | undefined, id?: string): string {
    if (zusatz === '/einrichtung') return '/einrichtung/2';
    if (zusatz === '/person' && id) return `/person/${id}`;
    // PC213: ohne Haushalt zurück zur Selbstauskunft der Person.
    if (zusatz === '/ohne' && id) return `/selbstauskunft/${id}`;
    // DP74 C3: „/nachname“ kommt vom offenen Punkt im Überblick und geht dorthin zurück.
    if (zusatz === '/mappe' || zusatz === '/nachname') return '/';
    return '/haushalt';
  }

  // Beim Wechsel des Bildschirms nach oben scrollen, der Fokus steht danach auf dem Titel
  // (design/unterlage-warum-haushalt.md, Abschnitt 4). Ein Feld, das ihn schon hat, behält ihn.
  // Ohne Leiste auf der Seite hält die Zeile „Rückgängig“ selbst Platz am Seitenende frei (C14).
  $effect(() => {
    if (!rueck.eintrag || rueck.leisten > 0) return;
    const wurzel = document.documentElement.style;
    wurzel.setProperty('--leiste-hoehe', '84px');
    return () => wurzel.removeProperty('--leiste-hoehe');
  });

  // Dateien ohne Version gehen erst, wenn „Rückgängig“ vorbei ist, auch das nach „Heft löschen“ (W31).
  $effect(() => {
    if (rueck.eintrag || geloescht.heft || geloescht.mehrere.length || !daten.geladen) return;
    void db()
      .then(verwaisteDateienLoeschen)
      .catch(() => {});
  });

  // Prüfhinweise: lesen, was noch nicht gelesen ist, sobald die App sich gesetzt hat.
  $effect(() => {
    if (!daten.ansicht || !fehlenFakten(daten.ansicht.versionen)) return;
    const zeit = setTimeout(() => void faktenNachrechnen(), 800);
    return () => clearTimeout(zeit);
  });

  let ersterBildschirm = true;

  $effect(() => {
    const pfad = route.pfad;
    // „Rückgängig“ gilt nur auf der Seite, auf der es angeboten wurde.
    untrack(() => {
      if (rueck.eintrag && rueck.eintrag.seite !== pfad) rueckgaengigVergessen();
    });
    // Zurück an die Stelle, an der man war. Die Seite baut sich erst auf: so lange nachsetzen.
    const ziel = untrack(() => route.scrollZiel);
    // PC29 (A2): gleich an die alte Stelle, nicht erst nach oben und ein Bild später zurück.
    stelleNachsetzen(ziel);
    if (ersterBildschirm) {
      ersterBildschirm = false;
      return;
    }
    // PC153: Die Seite kommt oft erst aus einer eigenen Datei. Früher suchte Hefta 60 Bilder lang (etwa 1 s) nach
    // dem Titel; dauerte das Laden länger (langsames Gerät, Test unter Last), bekam der Titel nie den Fokus. Jetzt
    // höchstens 5 s, und ein neuer Seitenwechsel beendet die Suche.
    const bis = performance.now() + 5000;
    let bild = 0;
    const suchen = () => {
      const aktiv = document.activeElement;
      const feldHatFokus = aktiv && aktiv !== document.body && aktiv.closest('main');
      const titel = document.querySelector<HTMLElement>('main h1');
      if (feldHatFokus) {
        if (titel)
          document.title = `${titel.textContent?.replaceAll('\u00ad', '').trim()} · ${APP_NAME}`;
        return;
      }
      if (titel) {
        document.title = `${titel.textContent?.replaceAll('\u00ad', '').trim()} · ${APP_NAME}`;
        titel.tabIndex = -1;
        titel.focus({ preventScroll: true });
      } else if (performance.now() < bis) bild = requestAnimationFrame(suchen);
    };
    bild = requestAnimationFrame(suchen);
    return () => cancelAnimationFrame(bild);
  });
</script>

{#if rueck.eintrag && rueck.leisten === 0}
  <div class="rueck-allein"><RueckgaengigZeile /></div>
{/if}

<!-- Bildschirmwechsel: kurz einblenden (design/README.md, „Bewegung“). -->
{#key route.pfad}
  {#if hinweise.fehler && route.pfad !== '/' && route.pfad !== ''}
    <div class="stoerung-oben"><HinweisKasten nurFehler /></div>
  {/if}
  <div class={wechselKlasse} use:wechselEnde>
    {#if route.pfad === '/technik-test'}
      {#await technikTest() then modul}
        <modul.default />
      {/await}
    {:else if daten.fehler === 'andererTab' || (daten.fehler && !daten.geladen)}
      <Stoerung />
    {:else if !daten.geladen}
      <!-- Lädt meist schneller, als man es sieht. -->
    {:else if route.pfad === '/homescreen/einrichtung'}
      {#await seiten.homescreen() then m}
        <m.default weiter="/einrichtung" />
      {/await}
    {:else if route.pfad === '/homescreen/einspielen'}
      {#await seiten.homescreen() then m}
        <m.default weiter="/einstellungen/einspielen" />
      {/await}
    {:else if route.pfad === '/homescreen/einstellungen'}
      {#await seiten.homescreen() then m}
        <m.default weiter="/einstellungen" zweitesMal />
      {/await}
    {:else if route.pfad === '/homescreen/rutsch'}
      {#await seiten.homescreen() then m}
        <m.default weiter="/rutsch" zweitesMal />
      {/await}
    {:else if route.pfad === '/mappe-start'}
      {#await seiten.mappeStart() then m}
        <m.default />
      {/await}
    {:else if route.pfad === '/wohnungen'}
      {#await seiten.wohnungen() then m}
        <m.default />
      {/await}
    {:else if route.pfad === '/wohnung-neu' && linkWegDa()}
      {#await seiten.neuesHeftLink() then m}
        <m.default />
      {/await}
    {:else if route.pfad === '/wohnung-neu' || route.pfad === '/wohnung-neu/text'}
      {#await seiten.wohnungNeu() then m}
        <m.default />
      {/await}
    {:else if route.pfad === '/wohnung-neu/vorschau'}
      {#await seiten.heftVorschau() then m}
        <m.default />
      {/await}
    {:else if route.pfad === '/wohnung-neu/kontrolle'}
      {#await seiten.heftKontrolle() then m}
        <m.default />
      {/await}
    {:else if route.pfad === '/wohnung-neu/so-gehts'}
      {#await seiten.anleitung() then m}
        <m.default />
      {/await}
    {:else if route.pfad === '/wuensche'}
      {#await seiten.wuensche() then m}
        <m.default />
      {/await}
    {:else if route.pfad === '/wuensche/netto'}
      {#await seiten.netto() then m}
        <m.default />
      {/await}
    {:else if heftUnter?.[2] === 'termin'}
      {#await seiten.termin() then m}
        <m.default id={heftUnter[1]!} />
      {/await}
    {:else if heftUnter?.[2] === 'bewerben'}
      {#await seiten.bewerben() then m}
        <m.default id={heftUnter[1]!} />
      {/await}
    {:else if heftUnter?.[2] === 'loeschbitte' || heftUnter?.[2] === 'nachfassen'}
      {#await seiten.heftMail() then m}
        <m.default id={heftUnter[1]!} art={heftUnter[2]} />
      {/await}
    {:else if route.pfad === '/selbstauskunft'}
      <!-- PC213/PC214 (E385): die Selbstauskünfte der App für Personen ohne Haushalt. -->
      {#await seiten.auskuenfte() then m}
        <m.default ohne />
      {/await}
    {:else if buergschaft}
      {#key route.pfad}
        <!-- W63: In der App in vier Teilen, mit Heft oder ohne (PC213: auch ohne Haushalt); ohne Person der Einstieg. -->
        {#if buergschaft[1]}
          {#await seiten.buergschaft() then m}
            <m.default personId={buergschaft[1]} heftId={buergschaft[2]} />
          {/await}
        {:else}
          {#await seiten.buergschaftStart() then m}
            <m.default />
          {/await}
        {/if}
      {/key}
    {:else if merkmalId}
      {#await seiten.merkmal() then m}
        <m.default id={merkmalId} />
      {/await}
    {:else if heftId}
      {#await seiten.heft() then m}
        <m.default id={heftId} />
      {/await}
    {:else if route.pfad === '/eingang'}
      {#await seiten.eingang() then m}
        <m.default />
      {/await}
    {:else if route.pfad === '/einrichtung'}
      <Einrichtung />
    {:else if route.pfad === '/einrichtung/2'}
      <Haushalt einrichtung />
    {:else if route.pfad === '/haushalt'}
      <Haushalt />
    {:else if personNeu}
      {#key route.pfad}
        {#await seiten.personSeite() then m}
          <m.default
            neueRolle={personNeu[1] === 'buerge' ? 'buerge' : 'vertrag'}
            zurueckZu={zurueckZu(personNeu[2])}
          />
        {/await}
      {/key}
    {:else if personAendern}
      {#key route.pfad}
        {#await seiten.personSeite() then m}
          <m.default
            personId={personAendern[1]}
            zurueckZu={zurueckZu(personAendern[2], personAendern[1])}
            ziel={personAendern[2] === '/nachname' ? 'ueber' : null}
          />
        {/await}
      {/key}
    {:else if loeschenId}
      {#key loeschenId}
        {#await seiten.personLoeschen() then m}
          <m.default personId={loeschenId} />
        {/await}
      {/key}
    {:else if uebertragen}
      {#await seiten.uebertragen() then m}
        <m.default personId={uebertragen} />
      {/await}
    {:else if auskunft}
      {#key route.pfad}
        {#await seiten.auskunft() then m}
          <m.default personId={auskunft[1]!} ausBereich={!!auskunft[2]} feld={auskunft[3]} />
        {/await}
      {/key}
    {:else if seitenEdit}
      {#await import('../screens/SeitenBearbeiten.svelte') then m}
        <m.default personId={seitenEdit[1]!} typId={seitenEdit[2]!} versionId={seitenEdit[3]!} />
      {/await}
    {:else if aufteilen}
      {#await import('../screens/Aufteilen.svelte') then m}
        <m.default personId={aufteilen[1]!} typId={aufteilen[2]!} />
      {/await}
    {:else if unterlage?.[3]}
      {#await import('../screens/DatumSeite.svelte') then m}
        <m.default
          personId={unterlage[1]!}
          typId={unterlage[2]!}
          versionId={unterlage[4] ?? null}
        />
      {/await}
    {:else if unterlage}
      {#key route.pfad}
        {#await seiten.unterlage() then m}
          <m.default personId={unterlage[1]!} typId={unterlage[2]!} />
        {/await}
      {/key}
    {:else if version}
      {#key route.pfad}
        {#await seiten.version() then m}
          <m.default personId={version[1]!} typId={version[2]!} versionId={version[3]!} />
        {/await}
      {/key}
    {:else if genoId}
      {#key genoId}
        {#await seiten.geno() then m}
          <m.default id={genoId} />
        {/await}
      {/key}
    {:else if vermieterHeft}
      {#await seiten.vermieterWahl() then m}
        <m.default id={vermieterHeft} />
      {/await}
    {:else if route.pfad === '/haushalt-unterlage/wbs'}
      {#await seiten.wbs() then m}
        <m.default />
      {/await}
    {:else if route.pfad === '/mappe'}
      {#await seiten.mappe() then m}
        <m.default />
      {/await}
    {:else if route.pfad === '/mappe/deckblatt'}
      {#await seiten.mappe() then m}
        <m.default gross />
      {/await}
    {:else if route.pfad === '/mappe/anpassen'}
      {#await seiten.anpassen() then m}
        <m.default />
      {/await}
    {:else if route.pfad === '/mappe/anpassen/bitte'}
      {#await seiten.bitte() then m}
        <m.default />
      {/await}
    {:else if route.pfad === '/selbstauskuenfte'}
      {#await seiten.auskuenfte() then m}
        <m.default />
      {/await}
    {:else if route.pfad === '/rutsch' || rutschPerson}
      {#key route.pfad}
        {#await seiten.rutsch() then m}
          <m.default nurPerson={rutschPerson ?? null} />
        {/await}
      {/key}
    {:else if einstellungsSeite}
      {#key route.pfad}
        {#await einstellungsSeite() then modul}
          <modul.default />
        {/await}
      {/key}
    {:else if personId}
      {#key personId}
        {#await seiten.person() then m}
          <m.default id={personId} />
        {/await}
      {/key}
    {:else}
      <Uebersicht />
    {/if}
  </div>
{/key}

{#if pdfFenster.datei}
  {#await pdfAnsicht() then m}
    <m.default />
  {/await}
{/if}

<style>
  .rueck-allein {
    position: fixed;
    right: 16px;
    bottom: calc(6px + env(safe-area-inset-bottom));
    left: 16px;
    z-index: 20;
  }

  .stoerung-oben {
    padding-top: env(safe-area-inset-top);
  }
</style>
