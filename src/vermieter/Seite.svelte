<script lang="ts">
  // Vermieter-Seite (design/vermieter-seite.md): Eingang in Ankunftsreihenfolge und eine offene Mappe.
  // Nichts wird gespeichert: kein localStorage, keine IndexedDB, kein Service Worker.
  import { tick } from 'svelte';
  import Anfordern from './Anfordern.svelte';
  import { APP_ADRESSE, QUELLCODE_ADRESSE } from '../app/name';
  import logo from '../../design/logo/hefta-logo.svg';
  import SeitenAnsicht from '../ui/SeitenAnsicht.svelte';
  import Eingang from './Eingang.svelte';
  import Leer from './Leer.svelte';
  import { einlesen, pdfOeffnen, type Mappe, type PdfDok } from './lesen';
  import MappeAnsicht from './MappeAnsicht.svelte';
  import Rechtliches from './Rechtliches.svelte';
  import Schritte from './Schritte.svelte';
  import { t } from './texte';

  let mappen = $state.raw<Mappe[]>([]);
  let fehler = $state<{ name: string; text: string }[]>([]);
  let offen = $state(0);
  let lesend = $state(0);
  let hash = $state(window.location.hash);
  let ziehend = $state(0);
  let breit = $state(window.matchMedia('(min-width: 900px)').matches);
  let eingabe = $state<HTMLInputElement>();

  const nummer = $derived(Number(/^#\/mappe\/(\d+)(?:\/anfordern)?$/.exec(hash)?.[1] ?? 0));
  const anfordern = $derived(hash.endsWith('/anfordern'));
  const seite = $derived(
    hash === '#/schritte' ? 'schritte' : hash === '#/rechtliches' ? 'recht' : 'mappe',
  );
  // Breit steht immer eine Mappe offen, schmal nur auf ihrer eigenen Seite.
  const gezeigt = $derived(mappen[(nummer || (breit ? 1 : 0)) - 1] ? nummer || (breit ? 1 : 0) : 0);

  $effect(() => {
    const m = window.matchMedia('(min-width: 900px)');
    const neu = () => (breit = m.matches);
    m.addEventListener('change', neu);
    const weg = () => (hash = window.location.hash);
    window.addEventListener('hashchange', weg);
    return () => {
      m.removeEventListener('change', neu);
      window.removeEventListener('hashchange', weg);
    };
  });

  // Merken, welche Mappe zuletzt offen war: „Zur Mappe“ führt dorthin zurück.
  $effect(() => {
    if (seite === 'mappe' && gezeigt) offen = gezeigt;
  });

  // Nach der Auswahl geht der Fokus auf den Titel, die Seite beginnt oben.
  $effect(() => {
    void hash;
    if (!hash) return;
    void tick().then(() => {
      if (hash !== '#/' && !breit) window.scrollTo(0, 0);
      if (hash !== '#/') document.querySelector<HTMLElement>('[data-titel]')?.focus();
    });
  });

  const leer = $derived(!mappen.length && !lesend && seite === 'mappe' && !fehler.length);

  let kette = Promise.resolve();
  function hinzufuegen(liste: File[]) {
    if (!liste.length) return;
    lesend += liste.length;
    kette = kette.then(async () => {
      const vorher = mappen.length;
      for (const datei of liste) {
        const g = await einlesen(datei, (sha) => {
          const i = mappen.findIndex((m) => m.sha === sha);
          return i < 0 ? undefined : i + 1;
        }).catch(() => ({ art: 'fehler' as const, text: t('fehler.kaputt') }));
        if (g.art === 'mappe') mappen = [...mappen, g.mappe];
        else fehler = [...fehler, { name: datei.name, text: g.text }];
        lesend -= 1;
      }
      // Es öffnet sich die erste neue Mappe; schmal bleibt man im Eingang.
      if (mappen.length > vorher && breit) window.location.hash = `#/mappe/${vorher + 1}`;
    });
  }

  function gewaehlt(e: Event) {
    const feld = e.currentTarget as HTMLInputElement;
    hinzufuegen([...(feld.files ?? [])]);
    feld.value = '';
  }

  const mitDateien = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
  function ueber(e: DragEvent) {
    if (!mitDateien(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    ziehend = Math.max(1, e.dataTransfer?.items.length ?? 1);
  }
  function weg(e: DragEvent) {
    if (!e.relatedTarget) ziehend = 0;
  }
  function fallen(e: DragEvent) {
    if (!mitDateien(e)) return;
    e.preventDefault();
    ziehend = 0;
    hinzufuegen([...(e.dataTransfer?.files ?? [])]);
  }

  function leeren() {
    mappen = [];
    fehler = [];
    offen = 0;
    window.location.hash = '#/';
  }

  // Seitenansicht: Das Dokument wird je Öffnung geladen und danach wieder freigegeben.
  let ansichtOffen = $state(false);
  let ansichtIndex = $state(0);
  let ansichtDok = $state.raw<PdfDok | null>(null);
  let aufgabe: ReturnType<typeof pdfOeffnen> | null = null;
  const ansichtSeiten = $derived(
    ansichtDok
      ? Array.from({ length: ansichtDok.numPages }, (_, i) => ({
          dokument: ansichtDok!,
          nummer: i + 1,
          schluessel: String(i + 1),
        }))
      : [],
  );

  async function oeffnen(mappe: Mappe, seiteNr: number) {
    try {
      const neu = pdfOeffnen(new Uint8Array(await mappe.datei.arrayBuffer()));
      const dok = await neu.promise;
      void aufgabe?.destroy();
      aufgabe = neu;
      ansichtDok = dok;
      ansichtIndex = seiteNr - 1;
      ansichtOffen = true;
    } catch {
      fehler = [...fehler, { name: mappe.name, text: t('fehler.oeffnen') }];
    }
  }

  $effect(() => {
    if (ansichtOffen || !ansichtDok) return;
    ansichtDok = null;
    void aufgabe?.destroy();
    aufgabe = null;
  });
</script>

<svelte:window ondragover={ueber} ondragleave={weg} ondrop={fallen} />

<div class="s">
  <input
    bind:this={eingabe}
    class="vs-datei-eingabe"
    type="file"
    accept="application/pdf,.pdf"
    multiple
    tabindex="-1"
    aria-hidden="true"
    onchange={gewaehlt}
  />
  <header class="vs-top">
    {#snippet marke()}
      <a class="vs-brand" href="#/" aria-label={t('seite.titel')}>
        <img class="vs-logo" src={logo} alt="" />
        <span>{t('kopf.fuer')}</span>
      </a>
    {/snippet}
    {#if leer}{@render marke()}{:else}<h1 class="vs-marke">{@render marke()}</h1>{/if}
    {#if breit}
      <span class="vs-tr"><a class="vs-lk" href="#/rechtliches">{t('kopf.versprechen')}</a></span>
    {/if}
  </header>

  {#if leer}
    <Leer {breit} {ziehend} waehlen={() => eingabe?.click()} />
  {:else if !mappen.length && seite !== 'mappe'}
    <main class="vs-einzel">
      {#if seite === 'schritte'}<Schritte zurueck="#/" zurueckText={t('schritte.zurueck')} />
      {:else}<Rechtliches zurueck="#/" zurueckText={t('schritte.zurueck')} />{/if}
    </main>
  {:else}
    <main class="vs-app">
      {#if breit || (!gezeigt && seite === 'mappe')}
        <Eingang
          {mappen}
          {fehler}
          {breit}
          {lesend}
          {ziehend}
          gewaehlt={seite === 'mappe' ? gezeigt : 0}
          waehlen={() => eingabe?.click()}
          ausblenden={() => (fehler = [])}
          {leeren}
        />
      {/if}
      {#if seite === 'schritte'}
        <Schritte
          zurueck={offen ? `#/mappe/${offen}` : '#/'}
          zurueckText={t(offen ? 'schritte.zurMappe' : 'schritte.zurueck')}
        />
      {:else if seite === 'recht'}
        <Rechtliches
          zurueck={offen ? `#/mappe/${offen}` : '#/'}
          zurueckText={t(offen ? 'schritte.zurMappe' : 'schritte.zurueck')}
        />
      {:else if gezeigt && anfordern && mappen[gezeigt - 1]?.anhang}
        <Anfordern anhang={mappen[gezeigt - 1]!.anhang!} nummer={gezeigt} gesamt={mappen.length} />
      {:else if gezeigt}
        {#key gezeigt}
          <MappeAnsicht
            mappe={mappen[gezeigt - 1]!}
            nummer={gezeigt}
            gesamt={mappen.length}
            {breit}
            oeffnen={(s) => oeffnen(mappen[gezeigt - 1]!, s)}
          />
        {/key}
      {/if}
    </main>
  {/if}

  <footer class="vs-seitenfuss">
    <a class="vs-lk" href="#/rechtliches">{t('fuss.recht')}</a>
    <a class="vs-lk" href={APP_ADRESSE} rel="noreferrer">{t('fuss.mieter')}</a>
    {#if QUELLCODE_ADRESSE}
      <a class="vs-lk" href={QUELLCODE_ADRESSE} rel="noreferrer">{t('fuss.quellcode')}</a>
    {/if}
    <span class="vs-lizenz">{t('fuss.lizenz')}</span>
  </footer>
</div>

<SeitenAnsicht bind:offen={ansichtOffen} bind:index={ansichtIndex} seiten={ansichtSeiten} />
