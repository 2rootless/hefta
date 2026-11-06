<script lang="ts">
  // Datum eintragen, ändern, entfernen (design/nachtraeglich-ordnen.md, OR9, OR9b). Das Datum ist
  // freiwillig: Es lässt sich jederzeit wieder entfernen, sofort und mit „Rückgängig“.
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { abschliessen } from '../app/router.svelte';
  import { einmal } from '../ui/einmal';
  import { rueckgaengigAnbieten } from '../app/rueckgaengig.svelte';
  import { aktuelleVersionen, tagAus } from '../domain/fristen';
  import { eintragenText, listenText, ohneTrennstellen, personStand } from '../domain/regelkatalog';
  import { t } from '../i18n';
  import { istGescannt, pdfOeffnen, pdfSchliessen, type PdfDokument } from '../pdf/pdfjs';
  import { dateiLesen, versionDatumSetzen } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import DatumAuswahl from '../ui/DatumAuswahl.svelte';
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  import { satzForm } from '../ui/texte';
  import Zurueck from '../ui/Zurueck.svelte';

  let {
    personId,
    typId,
    versionId = null,
  }: { personId: string; typId: string; versionId?: string | null } = $props();

  const stand = $derived.by(() => {
    const m = daten.ansicht?.mitglieder.find((x) => x.person.id === personId);
    return m && daten.ansicht
      ? personStand(
          m.person,
          m.zugehoerigkeit,
          daten.ansicht.dokumente,
          daten.ansicht.versionen,
          undefined,
          haushaltsAngabenAus(daten.ansicht),
        )
      : null;
  });
  const u = $derived(
    stand?.unterlagen.find((x) => x.typ.id === typId) ??
      stand?.nichtMehrNoetig.find((x) => x.typ.id === typId) ??
      null,
  );
  const version = $derived.by(() => {
    if (!u) return null;
    const aktuell = aktuelleVersionen(u.versionen, u.typ.serie, u.typ.jeVariante);
    return (
      u.versionen.find((v) => v.id === versionId) ??
      aktuell.find((v) => !v.ausstellungsdatum) ??
      aktuell[0] ??
      null
    );
  });
  const basis = $derived(`/unterlage/${personId}/${typId}`);
  const form = $derived(satzForm(u?.typ ?? {}));
  const name = $derived(stand ? stand.person.rufname || stand.person.vorname : '');

  let tag = $state('');
  let tagVon = '';
  $effect(() => {
    if (version && tagVon !== version.id) {
      tagVon = version.id;
      tag = version.ausstellungsdatum ?? '';
    }
  });

  let seiten = $state.raw<{ dokument: PdfDokument; nummer: number; schluessel: string }[]>([]);
  let gescannt = $state(false);
  let auswahlOffen = $state(false);
  $effect(() => {
    const id = version ? (version.aufbereitet ?? version.original) : null;
    const auswahl = version?.seiten;
    if (!id) return;
    let vorbei = false;
    let dokument: PdfDokument | null = null;
    void (async () => {
      try {
        const datei = await dateiLesen(await db(), id);
        if (!datei || vorbei) return;
        dokument = await pdfOeffnen(new Uint8Array(await datei.arrayBuffer()));
        if (vorbei) return void pdfSchliessen(dokument);
        const dok = dokument;
        const nummern = auswahl?.length
          ? auswahl.map((s) => s + 1)
          : Array.from({ length: dok.numPages }, (_, n) => n + 1);
        seiten = nummern.map((nummer) => ({ dokument: dok, nummer, schluessel: String(nummer) }));
        gescannt = await istGescannt(dok);
      } catch {
        // Datei nicht lesbar: Das Feld geht trotzdem.
      }
    })();
    return () => {
      vorbei = true;
      if (dokument) void pdfSchliessen(dokument);
    };
  });

  function fokussieren(feld: HTMLInputElement) {
    if (!tag) requestAnimationFrame(() => feld.focus());
  }

  async function speichernRoh() {
    if (!version || !tag) return;
    await versionDatumSetzen(await db(), version.id, tag);
    await neuLaden();
    abschliessen(basis);
  }
  const speichern = einmal(speichernRoh);

  async function entfernenRoh() {
    if (!version) return;
    const id = version.id;
    const vorher = version.ausstellungsdatum;
    await versionDatumSetzen(await db(), id, null);
    await neuLaden();
    abschliessen(basis);
    rueckgaengigAnbieten({
      text: t('unterlage.datumEntfernt'),
      seite: basis,
      ausfuehren: async () => {
        await versionDatumSetzen(await db(), id, vorher);
        await neuLaden();
      },
    });
  }
  const entfernen = einmal(entfernenRoh);
</script>

<main class="seite">
  <div class="kopf">
    <Zurueck href="#{basis}" text={t('allgemein.abbrechen')} />
  </div>
  {#if !u || !version}
    <p class="leer">{t('person.nichtGefunden')}</p>
  {:else}
    <div class="titelblock">
      <h1 class="display">{t('unterlage.datumFrage', form)}</h1>
      <p class="lead">
        {t('unterlage.datumFuer', {
          unterlage: ohneTrennstellen(eintragenText(u.typ) || listenText(u.typ)),
          name,
        })}
      </p>
    </div>
    <div class="block">
      <label class="eingabe">
        {t('unterlage.ausgestelltAm')}
        <input type="date" bind:value={tag} max={tagAus(new Date())} use:fokussieren />
      </label>
      <div class="wege">
        <button type="button" class="chip" onclick={() => (tag = tagAus(new Date()))}
          >{t('hochladen.heute')}</button
        >
        {#if seiten.length}
          <button type="button" class="chip" onclick={() => (auswahlOffen = true)}
            >{gescannt ? t('hochladen.aufSeite') : t('hochladen.imDokument')}</button
          >
        {/if}
      </div>
      <p class="klein">{t('unterlage.datumSatz', form)}</p>
      {#if version.ausstellungsdatum}
        <button type="button" class="textlink entfernen" onclick={entfernen}
          >{t('unterlage.datumEntfernen')}</button
        >
        <p class="klein">{t('unterlage.datumEntfernenSatz', form)}</p>
      {/if}
    </div>
    <DatumAuswahl
      bind:offen={auswahlOffen}
      {seiten}
      vorschlag={tag}
      beimDatum={(wert) => {
        tag = wert;
        auswahlOffen = false;
      }}
      beimKeinen={() => (auswahlOffen = false)}
    />
  {/if}
</main>

{#if u && version}
  <Aktionsleiste
    text={t('allgemein.speichern')}
    grund={tag ? undefined : t('ansicht.datumFehlt')}
    onclick={speichern}
  />
{/if}

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0
      max(calc(140px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf,
  .titelblock,
  .block,
  .leer {
    padding: 0 var(--space-5);
  }

  .titelblock {
    margin-top: 10px;
  }

  .block {
    margin-top: 20px;
  }

  .wege {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .wege .chip {
    padding: 0 16px;
    font-size: calc(14 * var(--px));
  }

  .klein {
    margin: 8px 0 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  .entfernen {
    margin-top: 20px;
  }
</style>
