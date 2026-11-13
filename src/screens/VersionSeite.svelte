<script lang="ts">
  // Eine einzelne Version (design/unterlage-warum-haushalt.md, UL4). Löschen wirkt sofort, mit
  // „Rückgängig“ (design/nachtraeglich-ordnen.md, OR7b).
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { abschliessen } from '../app/router.svelte';
  import { einmal } from '../ui/einmal';
  import { aktuelleVersionen } from '../domain/fristen';
  import { pruefhinweise } from '../domain/pruefhinweise';
  import { listenText, personStand } from '../domain/regelkatalog';
  import { haushaltStaende } from '../ui/pruefDaten';
  import PruefKasten from '../ui/PruefKasten.svelte';
  import { t } from '../i18n';
  import { rueckgaengigAnbieten } from '../app/rueckgaengig.svelte';
  import { dateiLesen, versionLoeschen, versionenZurueck } from '../storage/speicher';
  import Symbol from '../ui/Symbol.svelte';
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  import { dateiZeile, originalName, seitenZahl, versionTitel } from '../ui/versionInfo';
  import VersionSeiten from '../ui/VersionSeiten.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  let { personId, typId, versionId }: { personId: string; typId: string; versionId: string } =
    $props();

  const mitglied = $derived(daten.ansicht?.mitglieder.find((m) => m.person.id === personId));
  const stand = $derived(
    mitglied && daten.ansicht
      ? personStand(
          mitglied.person,
          mitglied.zugehoerigkeit,
          daten.ansicht.dokumente,
          daten.ansicht.versionen,
          undefined,
          haushaltsAngabenAus(daten.ansicht),
        )
      : null,
  );
  const u = $derived(
    stand?.unterlagen.find((x) => x.typ.id === typId) ??
      stand?.nichtMehrNoetig.find((x) => x.typ.id === typId) ??
      null,
  );
  const v = $derived(u?.versionen.find((x) => x.id === versionId) ?? null);
  const inMappe = $derived(
    !!u &&
      !!v &&
      !stand?.nichtMehrNoetig.includes(u) &&
      u.typ.etikett !== 'meist_unnoetig' &&
      aktuelleVersionen(u.versionen, u.typ.serie, u.typ.jeVariante).some((x) => x.id === v.id),
  );
  const basis = $derived(`/unterlage/${personId}/${typId}`);
  // PH2: was diesen Monat betrifft, steht auch hier.
  const pruefHinweis = $derived.by(() => {
    const h = pruefhinweise(haushaltStaende(daten.ansicht)).get(`${personId}/${typId}`);
    return h && h.version.id === versionId && ['monat', 'monatDoppelt', 'leer'].includes(h.art)
      ? h
      : null;
  });

  let anzahl = $state<number | null>(null);
  $effect(() => {
    if (v) void seitenZahl(v).then((zahl) => (anzahl = zahl));
  });

  async function originalSichernRoh() {
    if (!u || !v) return;
    const blob = await dateiLesen(await db(), v.original);
    if (!blob) return;
    const datei = new File([blob], originalName(v, u.typ), { type: 'application/pdf' });
    const { teilen } = await import('../ui/mappeErstellen');
    await teilen([datei]);
  }
  const originalSichern = einmal(originalSichernRoh);

  async function wegdamitRoh() {
    if (!v) return;
    const titel = versionTitel(v);
    const verbindung = await db();
    const geloescht = await versionLoeschen(verbindung, v.id);
    await neuLaden();
    abschliessen(basis);
    rueckgaengigAnbieten({
      text: t('unterlage.geloescht', { titel }),
      seite: basis,
      ausfuehren: async () => {
        // Frisch holen: iOS beendet Verbindungen, wenn die App im Hintergrund war.
        await versionenZurueck(await db(), geloescht);
        await neuLaden();
      },
    });
  }
  const wegdamit = einmal(wegdamitRoh);
</script>

<main class="seite">
  <div class="kopf">
    <Zurueck href="#{basis}" text={u ? listenText(u.typ) : t('allgemein.zurueck')} />
  </div>

  {#if !u || !v}
    <p class="leer">{t('person.nichtGefunden')}</p>
  {:else}
    <div class="titelblock">
      <h1 class="display frage">{versionTitel(v)}</h1>
      <p class="lead">
        {inMappe ? t('unterlage.versionMappe') : t('unterlage.versionNichtMappe')}
      </p>
    </div>
    {#if pruefHinweis}
      <section>
        <PruefKasten
          hinweis={pruefHinweis}
          rufname={stand?.person.rufname || stand?.person.vorname || ''}
          aufMonatsSeite
          ohneLoesung={pruefHinweis.art === 'monatDoppelt'}
        />
      </section>
    {/if}
    <section>
      <div class="karte-weiss">
        <VersionSeiten version={v} />
        <p class="datei">
          {dateiZeile(v, anzahl)}{#if anzahl || v.dateiname}.{/if}
          {t('unterlage.seitenGross')}
        </p>
      </div>
    </section>
    <section>
      <button type="button" class="zeile" onclick={originalSichern}>
        <span class="tx">
          <b>{t('unterlage.originalSichern')}</b>
          <small>{t('unterlage.originalSatz')}</small>
        </span>
        <Symbol name="weiter" groesse={20} />
      </button>
    </section>
    <section class="links">
      <a class="textlink" href="#{basis}/version/{versionId}/seiten">{t('seiten.titel')}</a>
      <button type="button" class="textlink" onclick={wegdamit}
        >{t('unterlage.versionLoeschenLink')}</button
      >
    </section>
  {/if}
</main>

<style>
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 0 18px;
  }

  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0
      calc(var(--leiste-hoehe, 0px) + 40px + env(safe-area-inset-bottom));
  }

  .kopf {
    display: flex;
    align-items: center;
    min-height: var(--tap-target);
    padding: 0 var(--space-4);
  }

  .leer {
    margin: var(--space-5) var(--space-4);
  }

  .titelblock {
    margin: 8px var(--space-5) 0;
  }

  section {
    margin: 14px var(--space-4) 0;
  }

  .karte-weiss {
    display: grid;
    gap: 8px;
    padding: 14px 16px;
    border-radius: 20px;
    background: var(--surface);
  }

  .datei {
    margin: 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }

  .zeile {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 8px 16px;
    border: 0;
    border-radius: 20px;
    background: var(--surface);
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .tx {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .tx b {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 700;
  }

  .tx small {
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    color: var(--ink-muted);
  }
</style>
