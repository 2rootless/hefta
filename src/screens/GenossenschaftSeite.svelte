<script lang="ts">
  // DP45 G2: Mitgliedschaft in einer Genossenschaft, einmal beim Haushalt. Name, Mitgliedsnummer und ein
  // freiwilliger Nachweis; „Weitere Genossenschaft“ für Haushalte in mehreren. Ins Heft kommt sie nur, wenn
  // dort unter „Wer vermietet?“ diese Genossenschaft gewählt ist.
  import { onDestroy } from 'svelte';
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { istAndroidApp } from '../app/plattform';
  import { rueckgaengigAnbieten } from '../app/rueckgaengig.svelte';
  import { abschliessen, ersetzen } from '../app/router.svelte';
  import { mitgliedschaften } from '../domain/haushaltUnterlagen';
  import { t } from '../i18n';
  import {
    PdfPasswortFehler,
    miniatur,
    pdfOeffnen,
    pdfSchliessen,
    type PdfDokument,
  } from '../pdf/pdfjs';
  import {
    dateiLesen,
    mitgliedschaftLoeschen,
    mitgliedschaftSpeichern,
    mitgliedschaftZurueck,
    unterlageSpeichern,
  } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import { einmal } from '../ui/einmal';
  import Notiz from '../ui/Notiz.svelte';
  import SeitenAnsicht from '../ui/SeitenAnsicht.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  let { id }: { id: string } = $props();

  const ZIEL = '/';
  const haushalt = $derived(daten.ansicht?.haushalt ?? null);
  const vorhanden = $derived(
    id === 'neu'
      ? null
      : (mitgliedschaften(daten.ansicht?.haushaltDokumente, daten.ansicht?.versionen ?? []).find(
          (m) => m.dokument.id === id,
        ) ?? null),
  );

  let name = $state('');
  let nummer = $state('');
  let geladenVon = '';
  $effect(() => {
    if (vorhanden && geladenVon !== vorhanden.dokument.id) {
      geladenVon = vorhanden.dokument.id;
      name = vorhanden.name;
      nummer = vorhanden.nummer;
    }
  });

  /** Neu gewählter Nachweis, noch nicht gespeichert. */
  let neu = $state.raw<{ name: string; bytes: Uint8Array } | null>(null);
  let dokument = $state.raw<PdfDokument | null>(null);
  let bild = $state('');
  let fehler = $state('');
  let ansichtOffen = $state(false);
  let ansichtIndex = $state(0);

  function wegraeumen() {
    if (bild) URL.revokeObjectURL(bild);
    bild = '';
    dokument = null;
  }
  onDestroy(wegraeumen);

  async function zeigen(d: PdfDokument, vorbei: () => boolean) {
    const url = await miniatur(d, 1, 160);
    if (vorbei()) return URL.revokeObjectURL(url);
    if (bild) URL.revokeObjectURL(bild);
    bild = url;
    dokument = d;
  }

  // Gespeicherten Nachweis zeigen, solange kein neuer gewählt ist.
  $effect(() => {
    const v = vorhanden?.nachweis;
    if (!v || neu) return;
    let vorbei = false;
    let offen: PdfDokument | null = null;
    void (async () => {
      try {
        const datei = await dateiLesen(await db(), v.aufbereitet ?? v.original);
        if (!datei || vorbei) return;
        offen = await pdfOeffnen(new Uint8Array(await datei.arrayBuffer()));
        if (!vorbei) await zeigen(offen, () => vorbei);
      } catch {
        // nicht lesbar: Die Felder gehen trotzdem.
      }
    })();
    return () => {
      vorbei = true;
      wegraeumen();
      if (offen) void pdfSchliessen(offen);
    };
  });

  let lauf = 0;
  async function waehlen(liste: FileList | null) {
    const datei = liste?.[0];
    if (!datei) return;
    fehler = '';
    const meins = ++lauf;
    const bytes = await datei.arrayBuffer().then(
      (b) => new Uint8Array(b),
      () => null,
    );
    if (meins !== lauf) return;
    if (!bytes) {
      fehler = t('hochladen.fehler.nichtLesbar');
      return;
    }
    try {
      const d = await pdfOeffnen(bytes);
      if (meins !== lauf) return void pdfSchliessen(d);
      const alt = neu ? dokument : null;
      wegraeumen();
      if (alt) void pdfSchliessen(alt);
      neu = { name: datei.name, bytes };
      await zeigen(d, () => meins !== lauf);
    } catch (e) {
      if (meins !== lauf) return;
      fehler =
        e instanceof PdfPasswortFehler
          ? `${t('hochladen.passwort.titel')} ${t('hochladen.passwort.text')}`
          : t(istAndroidApp() ? 'hochladen.fehler.keinPdfAndroid' : 'hochladen.fehler.keinPdf');
    }
  }

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
    neu?.name ?? vorhanden?.nachweis?.dateiname ?? t('genoSeite.nachweis'),
  );

  /** Speichert; gibt zurück, ob es geklappt hat. */
  async function sichern(): Promise<boolean> {
    if (!haushalt) return false;
    if (!name.trim()) {
      fehler = t('genoSeite.nameFehlt');
      return false;
    }
    const verbindung = await db();
    try {
      const dok = await mitgliedschaftSpeichern(verbindung, haushalt.id, {
        id: vorhanden?.dokument.id,
        name: name.trim(),
        nummer: nummer.trim(),
      });
      if (neu)
        await unterlageSpeichern(verbindung, {
          dokumentId: dok.id,
          dateiname: neu.name,
          personId: haushalt.id,
          typ: 'mitgliedschaft',
          serie: null,
          original: new Blob([neu.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
          aufbereitet: null,
          ausstellungsdatum: null,
          abrechnungsmonat: null,
          variante: null,
          seiten: null,
          gerastert: false,
        });
    } catch (e) {
      fehler =
        e instanceof DOMException && e.name === 'QuotaExceededError'
          ? t('hochladen.fehler.platz')
          : t('hochladen.fehler.unbekannt');
      return false;
    }
    await neuLaden();
    return true;
  }

  const speichern = einmal(async () => {
    if (await sichern()) abschliessen(ZIEL);
  });

  const weitere = einmal(async () => {
    // Ist schon etwas eingetragen, wird es zuerst gespeichert; leer geht es direkt weiter.
    if ((name.trim() || neu) && !(await sichern())) return;
    if (id !== 'neu') return ersetzen('/haushalt-unterlage/genossenschaft/neu');
    // Schon auf „neu“: Die Seite bleibt, also leeren.
    name = '';
    nummer = '';
    neu = null;
    fehler = '';
    wegraeumen();
    window.scrollTo({ top: 0 });
  });

  const loeschen = einmal(async () => {
    if (!vorhanden) return;
    const weg = await mitgliedschaftLoeschen(await db(), vorhanden.dokument.id);
    await neuLaden();
    abschliessen(ZIEL);
    rueckgaengigAnbieten({
      text: t('genoSeite.geloescht'),
      seite: ZIEL,
      ausfuehren: async () => {
        await mitgliedschaftZurueck(await db(), weg);
        await neuLaden();
      },
    });
  });
</script>

<main class="seite">
  <div class="kopf">
    <Zurueck href="#/" text={t('tabs.mappe')} />
  </div>
  <div class="titelblock">
    <h1 class="display">{t('genoSeite.titel')}</h1>
    <p class="lead">{t('genoSeite.lead')}</p>
  </div>

  <div class="karte karte-weich">
    <label class="eingabe">
      {t('genoSeite.name')}
      <input type="text" bind:value={name} autocomplete="organization" data-feld="geno-name" />
    </label>
    <label class="eingabe">
      {t('genoSeite.nummer')}
      <input type="text" bind:value={nummer} autocomplete="off" data-feld="geno-nummer" />
    </label>
    <p class="lab">{t('genoSeite.nachweis')}</p>
    {#if bild}
      <div class="scan">
        <button
          type="button"
          class="miniatur"
          aria-label={titelZeile}
          onclick={() => {
            ansichtIndex = 0;
            ansichtOffen = true;
          }}
        >
          <img src={bild} alt="" />
        </button>
        <div class="scan-text">
          <b class:datei={!!(neu || vorhanden?.nachweis?.dateiname)}>{titelZeile}</b>
          {#if seitenZahl}<p class="cap">
              {t('genoSeite.nachweisSeiten', { anzahl: seitenZahl })}
            </p>{/if}
        </div>
      </div>
    {/if}
    <label class="waehlen">
      <Symbol name={bild ? 'hochladen' : 'plus'} groesse={16} />
      {bild ? t('hochladen.andereDatei') : t('hochladen.menue.waehlen')}
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
    {#if !bild}<p class="cap">{t('genoSeite.nachweisFrei')}</p>{/if}
    {#if fehler}<Notiz stark><p role="alert">{fehler}</p></Notiz>{/if}
  </div>

  <ul class="karte zeilen">
    <li>
      <button type="button" class="zeile" onclick={weitere}>
        <span class="zeichen"><Symbol name="plus" groesse={20} /></span>
        <b>{t('genoSeite.weitere')}</b>
      </button>
    </li>
  </ul>

  {#if vorhanden}
    <button type="button" class="textlink grau loeschen" onclick={loeschen}
      >{t('genoSeite.loeschen')}</button
    >
  {/if}
  <Aktionsleiste text={t('allgemein.speichern')} onclick={speichern} />

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

  .karte {
    display: grid;
    gap: 12px;
    margin: 24px 16px 0;
    padding: 16px;
    border-radius: var(--radius-card);
    background: var(--surface);
  }

  .zeilen {
    gap: 0;
    padding: 0 16px;
    list-style: none;
  }

  .zeile {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 12px 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .zeile b {
    font-weight: 600;
  }

  .zeichen {
    display: flex;
    flex: none;
  }

  .lab {
    margin: 4px 0 -4px;
    font-size: calc(14 * var(--px));
    line-height: calc(18 * var(--px));
    font-weight: 700;
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

  /* Mit Rand, aber nicht breiter als die Seite (C11). */
  .loeschen {
    display: block;
    width: auto;
    margin: 24px 20px 0;
  }
</style>
