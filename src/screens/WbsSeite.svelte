<script lang="ts">
  // DP45 G1 (W28): Wohnberechtigungsschein einmal für den ganzen Haushalt ablegen. Der Schein mit Vorschau,
  // „Gültig bis“ vom Schein gelesen und auf dem Ausschnitt wie mit Textmarker hinterlegt (W20, W10), dazu
  // Personen und Räume. Gespeichert beim Haushalt (`personId = haushalt.id`), nie bei einem Heft.
  import { onDestroy } from 'svelte';
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { istAndroidApp } from '../app/plattform';
  import { rueckgaengigAnbieten } from '../app/rueckgaengig.svelte';
  import { abschliessen } from '../app/router.svelte';
  import { datenFinden, gueltigBis, type DatumFund } from '../domain/datumErkennen';
  import { haushaltSchein } from '../domain/haushaltUnterlagen';
  import { t, tagText, zahlwort } from '../i18n';
  import {
    PdfPasswortFehler,
    alsBilderPdf,
    miniatur,
    pdfOeffnen,
    pdfSchliessen,
    seitenStuecke,
    type PdfDokument,
  } from '../pdf/pdfjs';
  import { pdfEntsperren } from '../pdf/zusammenfuegen';
  import {
    dateiLesen,
    unterlageSpeichern,
    versionLoeschen,
    versionenZurueck,
    versionWbsSetzen,
  } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import { einmal } from '../ui/einmal';
  import NamensVorschau from '../ui/NamensVorschau.svelte';
  import Notiz from '../ui/Notiz.svelte';
  import SeitenAnsicht from '../ui/SeitenAnsicht.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  const ZIEL = '/';
  /** So viele Seiten liest Hefta höchstens nach „Gültig bis“. */
  const SEITEN_LESEN = 3;
  const PERSONEN = Array.from({ length: 10 }, (_, i) => i + 1);

  const haushalt = $derived(daten.ansicht?.haushalt ?? null);
  const gespeichert = $derived(
    haushaltSchein(daten.ansicht?.haushaltDokumente, daten.ansicht?.versionen ?? [], 'wbs'),
  );
  const schein = $derived(gespeichert?.version ?? null);

  /** Eine neu gewählte Datei, noch nicht gespeichert. */
  interface Neu {
    name: string;
    bytes: Uint8Array;
    gesperrt: boolean;
    passwort: string;
    passwortFalsch: boolean;
    aufbereitet: Uint8Array | null;
    alsBilder: boolean;
  }
  let neu = $state<Neu | null>(null);
  let dokument = $state.raw<PdfDokument | null>(null);
  let bild = $state('');
  let funde = $state.raw<(DatumFund & { seite: number })[]>([]);
  let fehler = $state('');
  let beschaeftigt = $state(false);
  let ansichtOffen = $state(false);
  let ansichtIndex = $state(0);

  let gueltig = $state('');
  let personen = $state('');
  let raeume = $state('');
  let angefasst = false;
  let geladenVon = '';

  // Angaben einer schon gespeicherten Fassung übernehmen, einmal je Fassung.
  $effect(() => {
    if (schein && !neu && geladenVon !== schein.id) {
      geladenVon = schein.id;
      gueltig = schein.wbs?.gueltigBis ?? '';
      personen = schein.wbs?.personen ? String(schein.wbs.personen) : '';
      raeume = schein.wbs?.raeume ?? '';
    }
  });

  // Gespeicherten Schein öffnen, solange keine neue Datei gewählt ist: Vorschau und Ausschnitt.
  $effect(() => {
    const v = schein;
    if (!v || neu) return;
    let vorbei = false;
    let offen: PdfDokument | null = null;
    void (async () => {
      try {
        const datei = await dateiLesen(await db(), v.aufbereitet ?? v.original);
        if (!datei || vorbei) return;
        offen = await pdfOeffnen(new Uint8Array(await datei.arrayBuffer()));
        if (vorbei) return;
        await zeigen(offen, () => vorbei);
      } catch {
        // Datei nicht lesbar: Die Felder gehen trotzdem.
      }
    })();
    return () => {
      vorbei = true;
      wegraeumen();
      if (offen) void pdfSchliessen(offen);
    };
  });

  onDestroy(() => wegraeumen());

  function wegraeumen() {
    if (bild) URL.revokeObjectURL(bild);
    bild = '';
    dokument = null;
    funde = [];
  }

  /** Vorschau der ersten Seite und die Daten auf den ersten Seiten. */
  async function zeigen(d: PdfDokument, vorbei: () => boolean) {
    const url = await miniatur(d, 1, 160);
    if (vorbei()) return URL.revokeObjectURL(url);
    const gefunden: (DatumFund & { seite: number })[] = [];
    for (let n = 1; n <= Math.min(SEITEN_LESEN, d.numPages); n++) {
      const stuecke = await seitenStuecke(d, n);
      if (vorbei()) return URL.revokeObjectURL(url);
      gefunden.push(...datenFinden(stuecke, new Date(), true).map((f) => ({ ...f, seite: n })));
    }
    if (bild) URL.revokeObjectURL(bild);
    bild = url;
    dokument = d;
    funde = gefunden;
  }

  const keinPdfText = () =>
    t(istAndroidApp() ? 'hochladen.fehler.keinPdfAndroid' : 'hochladen.fehler.keinPdf');

  let lauf = 0;
  async function waehlen(liste: FileList | null) {
    const datei = liste?.[0];
    if (!datei) return;
    fehler = '';
    const meins = ++lauf;
    const bytes = await datei.arrayBuffer().then(
      (p) => new Uint8Array(p),
      () => null,
    );
    if (meins !== lauf) return;
    if (!bytes) {
      fehler = t('hochladen.fehler.nichtLesbar');
      return;
    }
    const alt = dokument;
    wegraeumen();
    if (alt && neu) void pdfSchliessen(alt);
    neu = {
      name: datei.name,
      bytes,
      gesperrt: false,
      passwort: '',
      passwortFalsch: false,
      aufbereitet: null,
      alsBilder: false,
    };
    try {
      await neuZeigen(await pdfOeffnen(bytes), meins);
    } catch (e) {
      if (meins !== lauf) return;
      if (e instanceof PdfPasswortFehler) neu.gesperrt = true;
      else {
        neu = null;
        fehler = keinPdfText();
      }
    }
  }

  async function neuZeigen(d: PdfDokument, meins: number) {
    await zeigen(d, () => meins !== lauf);
    if (meins !== lauf) return void pdfSchliessen(d);
    const vorschlag = gueltigBis(funde);
    if (vorschlag && !angefasst) gueltig = vorschlag.tag;
  }

  async function entsperren() {
    if (!neu || beschaeftigt) return;
    beschaeftigt = true;
    neu.passwortFalsch = false;
    const meins = lauf;
    try {
      const d = await pdfOeffnen(neu.bytes, neu.passwort);
      try {
        neu.aufbereitet = await pdfEntsperren(neu.bytes, neu.passwort);
      } catch {
        neu.aufbereitet = await alsBilderPdf(d);
        neu.alsBilder = true;
      }
      neu.gesperrt = false;
      await neuZeigen(d, meins);
    } catch (e) {
      if (e instanceof PdfPasswortFehler) neu.passwortFalsch = true;
      else fehler = keinPdfText();
    } finally {
      beschaeftigt = false;
    }
  }

  /** Der eingetragene Tag steht so auf dem Schein: Dann zeigt der Ausschnitt die Stelle. */
  const aufSchein = $derived(!!gueltig && funde.some((f) => f.tag === gueltig));
  const suchen = $derived((stuecke: Parameters<typeof datenFinden>[0]) => {
    const tag = gueltig;
    return datenFinden(stuecke, new Date(), true).find((f) => f.tag === tag) ?? null;
  });
  const seitenZahl = $derived(dokument?.numPages ?? 0);
  const ansichtSeiten = $derived(
    dokument
      ? Array.from({ length: dokument.numPages }, (_, i) => ({
          dokument: dokument!,
          nummer: i + 1,
          schluessel: String(i + 1),
        }))
      : [],
  );
  const titelZeile = $derived(
    neu
      ? neu.name
      : schein
        ? t('wbsSeite.abgelegt', { datum: tagText(schein.createdAt.slice(0, 10)) })
        : '',
  );
  const kannSpeichern = $derived(!!haushalt && ((!!neu && !neu.gesperrt) || (!!schein && !neu)));

  function angaben() {
    return {
      gueltigBis: gueltig || null,
      personen: personen ? Number(personen) : null,
      raeume: raeume.trim() || null,
    };
  }

  async function speichernRoh() {
    if (!haushalt || !kannSpeichern) return;
    const verbindung = await db();
    try {
      if (neu) {
        await unterlageSpeichern(verbindung, {
          dateiname: neu.name,
          personId: haushalt.id,
          typ: 'wbs',
          serie: null,
          original: new Blob([neu.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
          aufbereitet: neu.aufbereitet
            ? new Blob([neu.aufbereitet as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
            : null,
          ausstellungsdatum: null,
          abrechnungsmonat: null,
          variante: null,
          seiten: null,
          gerastert: neu.alsBilder,
          wbs: angaben(),
        });
      } else if (schein) {
        await versionWbsSetzen(verbindung, schein.id, angaben());
      }
    } catch (e) {
      fehler =
        e instanceof DOMException && e.name === 'QuotaExceededError'
          ? t('hochladen.fehler.platz')
          : t('hochladen.fehler.unbekannt');
      return;
    }
    await neuLaden();
    abschliessen(ZIEL);
  }
  const speichern = einmal(speichernRoh);

  async function loeschenRoh() {
    if (!schein) return;
    const stand = await versionLoeschen(await db(), schein.id);
    await neuLaden();
    abschliessen(ZIEL);
    rueckgaengigAnbieten({
      text: t('wbsSeite.geloescht'),
      seite: ZIEL,
      ausfuehren: async () => {
        await versionenZurueck(await db(), stand);
        await neuLaden();
      },
    });
  }
  const loeschen = einmal(loeschenRoh);

  const gross = (wort: string) => wort.charAt(0).toUpperCase() + wort.slice(1);
</script>

<main class="seite">
  <div class="kopf">
    <Zurueck href="#/" text={t('tabs.mappe')} />
  </div>
  <div class="titelblock">
    <h1 class="display">{t('wbsSeite.titel')}</h1>
    <p class="lead">{t('wbsSeite.lead')}</p>
  </div>

  <h2 class="et">{t('wbsSeite.schein')}</h2>
  <div class="karte">
    {#if neu?.gesperrt}
      <p class="gesperrt-text">
        <b>{t('hochladen.passwort.titel')}</b>
        {t('hochladen.passwort.text')}
      </p>
      <label class="eingabe">
        {t('hochladen.passwort.feldEine')}
        <input
          type="password"
          autocomplete="off"
          bind:value={neu.passwort}
          aria-invalid={neu.passwortFalsch}
          onkeydown={(e) => {
            if (e.key === 'Enter') void entsperren();
          }}
        />
      </label>
      {#if neu.passwortFalsch}<p class="fehler" role="alert">
          {t('hochladen.passwort.falsch')}
        </p>{/if}
      <button type="button" class="chip entsperren" onclick={entsperren} disabled={!neu.passwort}
        >{t('hochladen.passwort.knopf')}</button
      >
    {:else if bild}
      <div class="scan">
        <button
          type="button"
          class="miniatur"
          aria-label={t('wbsSeite.ansehen')}
          onclick={() => {
            ansichtIndex = 0;
            ansichtOffen = true;
          }}
        >
          <img src={bild} alt="" />
        </button>
        <div class="scan-text">
          <b class:datei={!!neu}>{titelZeile}</b>
          {#if seitenZahl}<p class="cap">{t('wbsSeite.seiten', { anzahl: seitenZahl })}</p>{/if}
        </div>
      </div>
    {/if}
    <label class="waehlen" class:allein={!neu && !schein}>
      <Symbol name={neu || schein ? 'hochladen' : 'plus'} groesse={16} />
      {neu || schein ? t('hochladen.andereDatei') : t('hochladen.menue.waehlen')}
      <input
        class="visually-hidden"
        type="file"
        accept="application/pdf,.pdf"
        data-feld="pdf"
        onchange={(e) => {
          void waehlen(e.currentTarget.files);
          e.currentTarget.value = '';
        }}
      />
    </label>
    {#if !neu && !schein}<p class="cap">{t('hochladen.menue.papier')}</p>{/if}
    {#if fehler}<Notiz stark><p role="alert">{fehler}</p></Notiz>{/if}
  </div>

  {#if neu || schein}
    <h2 class="et">{t('wbsSeite.steht')}</h2>
    <div class="karte karte-weich">
      <label class="eingabe">
        {t('wbsSeite.gueltigBis')}
        <input
          type="date"
          bind:value={gueltig}
          oninput={() => (angefasst = true)}
          data-feld="gueltig-bis"
        />
      </label>
      {#if aufSchein && dokument}
        <div class="ausschnitt">
          <NamensVorschau
            {dokument}
            {suchen}
            beschreibung={t('wbsSeite.vorschau')}
            ansehen={(seite) => {
              ansichtIndex = seite - 1;
              ansichtOffen = true;
            }}
          />
        </div>
        <p class="cap">{t('wbsSeite.soSteht')}</p>
      {/if}
      <label class="eingabe">
        {t('wbsSeite.personen')}
        <select class="feld-weich" bind:value={personen} data-feld="personen">
          <option value="">{t('wbsSeite.personenLeer')}</option>
          {#each PERSONEN as n (n)}
            <option value={String(n)}>{gross(zahlwort(n))}</option>
          {/each}
        </select>
      </label>
      <label class="eingabe">
        {t('wbsSeite.raeume')}
        <input type="text" bind:value={raeume} autocomplete="off" data-feld="raeume" />
      </label>
    </div>
    <p class="cap draussen">{t('wbsSeite.bescheid')}</p>

    {#if schein && !neu}
      <button type="button" class="textlink grau loeschen" onclick={loeschen}
        >{t('wbsSeite.loeschen')}</button
      >
    {/if}
    <Aktionsleiste text={t('allgemein.speichern')} onclick={speichern} />
  {/if}

  {#if ansichtSeiten.length}
    <SeitenAnsicht bind:offen={ansichtOffen} bind:index={ansichtIndex} seiten={ansichtSeiten} />
  {/if}
</main>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0
      max(calc(140px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf,
  .titelblock {
    padding: 0 var(--space-5);
  }

  .titelblock {
    margin-top: 10px;
  }

  /* DP45 G1: Abschnitt wie „Der Schein“, 15 px, halbfett. */
  .et {
    margin: 24px 20px 8px;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 650;
  }

  .karte {
    display: grid;
    gap: 12px;
    margin: 0 16px;
    padding: 16px;
    border-radius: var(--radius-card);
    background: var(--surface);
  }

  .scan {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
  }

  .miniatur {
    flex: none;
    width: 72px;
    padding: 0;
    border: 0;
    border-radius: 2px;
    background: #fff;
    box-shadow:
      0 1px 2px rgba(38, 34, 30, 0.12),
      0 4px 12px rgba(38, 34, 30, 0.1);
    cursor: zoom-in;
  }

  .miniatur img {
    display: block;
    width: 100%;
    border-radius: 2px;
  }

  /* Bei 320 px mit 130 % rutscht der Text unter die Miniatur, statt sich schmal zu quetschen (C21). */
  .scan-text {
    flex: 1 1 140px;
    min-width: 0;
  }

  .scan-text b {
    display: block;
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 600;
  }

  /* Dateinamen dürfen nach „_“ umbrechen (Design X7), sonst bricht kein Wort. */
  .scan-text .datei {
    overflow-wrap: anywhere;
  }

  .cap {
    margin: 0;
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }

  .scan-text .cap {
    margin-top: 4px;
  }

  .draussen {
    margin: 8px 20px 0;
  }

  .waehlen {
    display: inline-flex;
    align-items: center;
    justify-self: start;
    gap: 8px;
    min-height: var(--tap-target);
    font-size: calc(15 * var(--px));
    font-weight: 600;
    color: var(--ink);
    cursor: pointer;
  }

  .waehlen:focus-within {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
    border-radius: 8px;
  }

  .eingabe select {
    width: 100%;
    min-width: 0;
    min-height: var(--slot-height);
    padding: 0 var(--space-4);
    border: 0;
    border-radius: var(--radius-slot);
    background: var(--weich);
    color: var(--ink);
    font-size: calc(17 * var(--px));
    font-weight: 400;
  }

  .ausschnitt {
    margin-top: -4px;
  }

  .gesperrt-text {
    margin: 0;
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .gesperrt-text b {
    display: block;
  }

  .fehler {
    margin: 0;
    color: var(--ink);
    font-size: calc(14 * var(--px));
  }

  .entsperren {
    justify-self: start;
  }

  /* Mit Rand, aber nicht breiter als die Seite (C11). */
  .loeschen {
    display: block;
    width: auto;
    margin: 24px 20px 0;
  }
</style>
