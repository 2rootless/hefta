<script lang="ts">
  import { onDestroy } from 'svelte';
  import { einmal } from '../ui/einmal';
  import SeitenAnsicht from '../ui/SeitenAnsicht.svelte';

  // Seiten aufteilen (design/nachtraeglich-ordnen.md, OR2, OR2b): Dieselbe Datei steckt in mehreren
  // Monaten, danach hat jeder Monat nur noch seine Seiten. Die Datei bleibt einmal gespeichert.
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { abschliessen } from '../app/router.svelte';
  import { rueckgaengigAnbieten } from '../app/rueckgaengig.svelte';
  import { dieselbeDatei, monateVorbelegen, seitenJeMonat } from '../domain/aufteilen';
  import { monatFinden } from '../domain/datumErkennen';
  import { monatPlus } from '../domain/fristen';
  import { monatName, t } from '../i18n';
  import {
    miniatur,
    pdfOeffnen,
    pdfSchliessen,
    seitenStuecke,
    type PdfDokument,
  } from '../pdf/pdfjs';
  import { dateiLesen, seitenAufteilen, versionenZurueck } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import Notiz from '../ui/Notiz.svelte';
  import SeitenMonate from '../ui/SeitenMonate.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  let { personId, typId }: { personId: string; typId: string } = $props();

  const basis = $derived(`/unterlage/${personId}/${typId}`);
  const gruppe = $derived.by(() => {
    const a = daten.ansicht;
    const dok = a?.dokumente.find((d) => d.personId === personId && d.typ === typId);
    return dok ? dieselbeDatei(a!.versionen.filter((v) => v.dokumentId === dok.id)) : [];
  });
  const quellMonate = $derived(
    gruppe.map((v) => v.abrechnungsmonat).filter((m): m is string => !!m),
  );

  let zeilen = $state<{ seite: number; bild?: string; fund: string | null }[]>([]);
  let werte = $state<string[]>([]);
  let geladen = false;
  let dokument = $state.raw<PdfDokument | null>(null);
  onDestroy(() => {
    if (dokument) void pdfSchliessen(dokument);
    zeilen.forEach((z) => z.bild && URL.revokeObjectURL(z.bild));
  });
  let grossOffen = $state(false);
  let grossIndex = $state(0);
  const grosse = $derived(
    dokument
      ? Array.from({ length: dokument.numPages }, (_, i) => ({
          dokument: dokument!,
          nummer: i + 1,
          schluessel: String(i),
        }))
      : [],
  );

  $effect(() => {
    const erste = gruppe[0];
    if (!erste || geladen) return;
    geladen = true;
    const monate = quellMonate;
    void (async () => {
      const datei = await dateiLesen(await db(), erste.aufbereitet ?? erste.original);
      if (!datei) return;
      const dok = await pdfOeffnen(new Uint8Array(await datei.arrayBuffer()));
      const liste: typeof zeilen = [];
      for (let n = 1; n <= dok.numPages; n++) {
        const fund = monatFinden(await seitenStuecke(dok, n));
        liste.push({ seite: n - 1, fund, bild: await miniatur(dok, n, 120) });
      }
      dokument = dok;
      zeilen = liste;
      werte = monateVorbelegen(
        liste.map((z) => z.fund),
        monate,
      );
    })();
  });

  const keinFund = $derived(zeilen.length > 0 && zeilen.every((z) => !z.fund));
  const auswahl = $derived.by(() => {
    const alle = [...quellMonate, ...werte.filter(Boolean)].sort();
    const neuester = alle.at(-1);
    if (!neuester) return [];
    const umfeld = Array.from({ length: 6 }, (_, n) => monatPlus(neuester, -n));
    return [...new Set([...umfeld, ...alle])].sort().reverse();
  });
  const zuordnung = $derived(seitenJeMonat(werte));
  const ohneSeite = $derived(quellMonate.filter((m) => !zuordnung.some((z) => z.monat === m)));

  async function aufteilenRoh() {
    if (!zuordnung.length) return;
    const verbindung = await db();
    const stand = await seitenAufteilen(verbindung, gruppe, zuordnung);
    await neuLaden();
    abschliessen(basis);
    rueckgaengigAnbieten({
      text: t('aufteilen.erledigt'),
      seite: basis,
      ausfuehren: async () => {
        // Frisch holen: iOS beendet Verbindungen, wenn die App im Hintergrund war.
        await versionenZurueck(await db(), stand);
        await neuLaden();
      },
    });
  }
  const aufteilen = einmal(aufteilenRoh);
</script>

<main class="seite">
  <div class="kopf"><Zurueck href="#{basis}" text={t('allgemein.abbrechen')} /></div>
  <div class="block">
    <h1 class="display">{t('aufteilen.titel')}</h1>
    <p class="lead">
      {#if keinFund}
        {gruppe[0]?.dateiname
          ? t('aufteilen.leadOhne', { name: gruppe[0].dateiname })
          : t('aufteilen.leadOhneName')}
      {:else if gruppe[0]?.dateiname}
        {t('aufteilen.lead', { name: gruppe[0].dateiname })}
      {:else}
        {t('aufteilen.leadOhneDatei')}
      {/if}
    </p>
  </div>
  {#if keinFund}
    <div class="block"><Notiz>{t('aufteilen.bittePruefen')}</Notiz></div>
  {/if}
  <div class="block">
    <SeitenMonate
      {zeilen}
      bind:werte
      monate={auswahl}
      ansehen={(seite) => {
        grossIndex = seite;
        grossOffen = true;
      }}
    />
  </div>
  <div class="block">
    <p class="klein">{t('unterlage.seitenGross')}</p>
    {#each ohneSeite as m (m)}
      <p>
        <b>{t('aufteilen.ohneSeite', { monat: monatName(m) })}</b>
        {t('aufteilen.ohneSeiteSatz')}
      </p>
    {:else}
      <p>{t('aufteilen.folge')}</p>
    {/each}
  </div>
</main>

{#if grosse.length}
  <SeitenAnsicht bind:offen={grossOffen} seiten={grosse} bind:index={grossIndex}>
    {#snippet fuss(schluessel)}
      {@const seite = Number(schluessel)}
      <label class="seiten-monat">
        <span>{t('hochladen.monatDerSeite')}</span>
        <select bind:value={werte[seite]}>
          {#each auswahl as m (m)}
            <option value={m}>{monatName(m)}</option>
          {/each}
          <option value="">{t('aufteilen.nichtInMappe')}</option>
        </select>
      </label>
    {/snippet}
  </SeitenAnsicht>
{/if}

<Aktionsleiste
  text={t('aufteilen.knopf')}
  zusatz={t('aufteilen.monate', { anzahl: zuordnung.length })}
  grund={zuordnung.length ? undefined : t('aufteilen.grund')}
  onclick={aufteilen}
/>

<style>
  .klein {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0
      max(calc(140px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf,
  .block {
    padding: 0 var(--space-4);
  }

  .block {
    margin-top: 14px;
  }

  p {
    margin: 0 0 6px;
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
  }
</style>
