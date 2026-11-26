<script lang="ts">
  // Bereich „Selbstauskünfte“ (Entwurf A5, Wunsch des Auftraggebers): oben, was für den ganzen Haushalt
  // gilt (einmal ändern genügt), darunter je Person ihr Stand. Erreichbar über „Euer Haushalt“.
  // PC213/PC214 (E385, Weg A): Mit `ohne` dieselbe Liste für Personen ohne Haushalt (`#/selbstauskunft` im Browser):
  // mit „Weitere Person hinzufügen“, „Wer einzieht“ als Zähler (E-B1), PDF als eine Datei oder je Person (DP134) und
  // „In einen Haushalt übernehmen“ (DP148). Leer gibt es die Liste nicht: Dann fragt die Seite, für wen sie ist.
  import { daten, db, gehe, neuLaden } from '../app/daten.svelte';
  import type { JaNein } from '../domain/selbstauskunft';
  import { einziehend, einziehendText, fehlendeAngaben } from '../domain/selbstauskunft';
  import { rollenAnzeige } from '../domain/regelkatalog';
  import { t, tagZusammen } from '../i18n';
  import { haushaltAendern } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';
  import { browserZurueck } from '../ui/browserZurueck';
  import HaushaltZaehler from '../ui/HaushaltZaehler.svelte';
  import PersonOhneAnlegen from '../ui/PersonOhneAnlegen.svelte';
  import UebernehmenKasten from '../ui/UebernehmenKasten.svelte';

  let { ohne = false }: { ohne?: boolean } = $props();

  const ansicht = $derived(ohne ? daten.ohne : daten.ansicht);
  const zurueck = $derived(
    ohne
      ? browserZurueck()
      : { href: '#/haushalt', text: t('einrichtung.haushalt.titelBearbeiten') },
  );

  // Nach dem Übernehmen (DP148, Schritt 5): wer jetzt zum Haushalt gehört und wer Ansprechperson ist.
  let uebernommen = $state<{ namen: string; anzahl: number; ansprech: string | null } | null>(null);

  // PDF ohne Haushalt: eine Datei für alle oder je Person eine (DP134, Abschnitt 4).
  let pdfArt = $state<'eine' | 'je'>('eine');
  let pdfLaeuft = $state(false);
  let pdfFehler = $state(false);
  async function pdfErstellen() {
    if (!ansicht || pdfLaeuft) return;
    pdfLaeuft = true;
    pdfFehler = false;
    try {
      const [{ selbstauskuenfteDateien }, { teilen }] = await Promise.all([
        import('../ui/selbstauskunftPdf'),
        import('../ui/mappeErstellen'),
      ]);
      await teilen(await selbstauskuenfteDateien(ansicht, pdfArt));
    } catch {
      pdfFehler = true;
    } finally {
      pdfLaeuft = false;
    }
  }
  const hh = $derived(haushaltsAngabenAus(ansicht));
  const vertragsZahl = $derived(
    (ansicht?.mitglieder ?? []).filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length,
  );
  const wer = $derived(
    ansicht ? einziehend(vertragsZahl, ansicht.haushalt) : { erwachsene: 0, kinder: 0 },
  );

  const personen = $derived(
    (ansicht?.mitglieder ?? []).map((m) => {
      const fehlt = fehlendeAngaben(m.person, m.zugehoerigkeit.rolle, hh).filter(
        (f) => f !== 'haustiere' && f !== 'ort',
      );
      const fragen = fehlt.filter((f) => ['insolvenz', 'raeumungstitel'].includes(f)).length;
      const status = !fehlt.length
        ? t('selbstauskunft.zuletzt', { datum: tagMonat(m.person.updatedAt) })
        : fragen === fehlt.length && m.person.selbstauskunft
          ? t('selbstauskuenfte.fragenOffen', { anzahl: fragen })
          : t('selbstauskuenfte.fehltNoch');
      return { m, fertig: !fehlt.length, status };
    }),
  );
  const offen = $derived(personen.filter((p) => !p.fertig).length);
  const fertigZahl = $derived(personen.filter((p) => p.fertig).length);

  function tagMonat(iso: string): string {
    return tagZusammen(
      new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(new Date(iso)),
    );
  }

  let bearbeiten = $state<'haustiere' | 'ort' | null>(null);
  let ort = $state('');
  let tiereText = $state('');
  $effect(() => {
    if (bearbeiten === 'ort') ort = hh.ort;
    if (bearbeiten === 'haustiere') tiereText = hh.haustiereText;
  });

  async function haushaltSetzen(teil: {
    haustiere?: JaNein;
    haustiereText?: string;
    ort?: string;
  }) {
    if (!ansicht) return;
    await haushaltAendern(await db(), ansicht.haushalt.id, {
      haustiere: hh.haustiere,
      haustiereText: hh.haustiereText,
      ort: hh.ort,
      ...teil,
    });
    await neuLaden();
  }

  function fehlendeAusfuellen() {
    const erste = personen.find((p) => !p.fertig);
    if (erste) gehe(`/selbstauskunft/${erste.m.person.id}/bereich`);
  }
</script>

<main class="seite">
  <div class="kopf">
    <Zurueck href={zurueck.href} text={zurueck.text} />
  </div>
  {#if uebernommen}
    <div class="kasten erledigt" role="status">
      <p>
        {t('ohneHaushalt.gehoert', { namen: uebernommen.namen, anzahl: uebernommen.anzahl })}
        {#if uebernommen.ansprech}{t('ohneHaushalt.ansprech', { name: uebernommen.ansprech })}{/if}
      </p>
      <a class="textlink" href="#/haushalt">{t('ohneHaushalt.zumHaushalt')}</a>
    </div>
  {/if}
  {#if ohne && !ansicht}
    <div class="titelblock">
      <h1 class="display frage">{t('ohneHaushalt.startTitel')}</h1>
      <p class="lead">{t('ohneHaushalt.startLead')}</p>
      <p class="haushalt-satz">{t('ohneHaushalt.kopf')}</p>
    </div>
    <section>
      <PersonOhneAnlegen
        knopf={t('ohneHaushalt.weiter')}
        fertig={(personId) => gehe(`/selbstauskunft/${personId}/bereich`)}
      />
    </section>
  {:else if ansicht}
    <div class="titelblock">
      <h1 class="display frage">{t('selbstauskuenfte.titel')}</h1>
      <p class="lead">
        {t('selbstauskuenfte.lead', { fertig: fertigZahl, gesamt: personen.length })}
      </p>
      {#if ohne}<p class="haushalt-satz">{t('ohneHaushalt.kopf')}</p>{/if}
    </div>

    <section>
      <h2>{ohne ? t('ohneHaushalt.fuerAlle') : t('selbstauskuenfte.haushalt')}</h2>
      <ul class="kasten">
        {#if ohne}
          <!-- E-B1: Ohne Haushalt fragt die Liste selbst, wer einzieht (Musterbogen B.1). -->
          <li class="zaehler-zeile">
            <HaushaltZaehler
              haushaltId={ansicht.haushalt.id}
              vertrag={vertragsZahl}
              weitere={ansicht.haushalt.weitereErwachsene}
              kinder={ansicht.haushalt.kinder}
            />
          </li>
        {:else}
          <li class="zeile">
            <span class="tx">
              <b>{t('selbstauskuenfte.ziehenEin')}</b>
              <small>{t('selbstauskuenfte.ziehenEinWert', { text: einziehendText(wer) })}</small>
            </span>
          </li>
        {/if}
        <li>
          {#if bearbeiten === 'haustiere'}
            <div class="bearbeiten">
              <b>{t('selbstauskunft.haustiereIhr')}</b>
              <small>{t('angabeSatz.haustiere')}</small>
              <div class="jn" role="radiogroup" aria-label={t('selbstauskunft.haustiereIhr')}>
                {#each ['ja', 'nein'] as const as w (w)}
                  <button
                    type="button"
                    class="chip"
                    role="radio"
                    aria-checked={hh.haustiere === w}
                    onclick={() => haushaltSetzen({ haustiere: w })}
                    >{t(`selbstauskunft.${w}`)}</button
                  >
                {/each}
              </div>
              {#if hh.haustiere === 'ja'}
                <label class="eingabe">
                  {t('selbstauskunft.haustiereWelche')}
                  <input
                    bind:value={tiereText}
                    onchange={() => haushaltSetzen({ haustiereText: tiereText.trim() })}
                  />
                </label>
              {/if}
              <button type="button" class="textlink" onclick={() => (bearbeiten = null)}
                >{t('selbstauskuenfte.fertig')}</button
              >
            </div>
          {:else}
            <button type="button" class="zeile knopf" onclick={() => (bearbeiten = 'haustiere')}>
              <span class="tx">
                <b>{t('selbstauskuenfte.haustiere')}</b>
                <small
                  >{hh.haustiere === null
                    ? t('selbstauskuenfte.nochOffen')
                    : hh.haustiere === 'ja'
                      ? [t('selbstauskunft.ja'), hh.haustiereText].filter(Boolean).join(', ')
                      : t('selbstauskunft.nein')}</small
                >
              </span>
              <Symbol name="weiter" groesse={20} />
            </button>
          {/if}
        </li>
        <li>
          {#if bearbeiten === 'ort'}
            <div class="bearbeiten">
              <label class="eingabe">
                {t('selbstauskunft.ortUnterschrift')}
                <input
                  bind:value={ort}
                  placeholder={t('selbstauskunft.ortBeispiel')}
                  autocomplete="address-level2"
                  onchange={() => haushaltSetzen({ ort: ort.trim() })}
                />
              </label>
              <button
                type="button"
                class="textlink"
                onclick={async () => {
                  await haushaltSetzen({ ort: ort.trim() });
                  bearbeiten = null;
                }}>{t('selbstauskuenfte.fertig')}</button
              >
            </div>
          {:else}
            <button type="button" class="zeile knopf" onclick={() => (bearbeiten = 'ort')}>
              <span class="tx">
                <b>{t('selbstauskuenfte.ort')}</b>
                <small>{hh.ort.trim() || t('selbstauskuenfte.nochOffen')}</small>
              </span>
              <Symbol name="weiter" groesse={20} />
            </button>
          {/if}
        </li>
      </ul>
      <p class="hinweis">{t('selbstauskuenfte.gleich')}</p>
    </section>

    <section>
      <h2>{t('selbstauskuenfte.jePerson')}</h2>
      <ul class="kasten">
        {#each personen as p (p.m.person.id)}
          <li>
            <a class="zeile knopf" href="#/selbstauskunft/{p.m.person.id}/bereich">
              <span
                class="kreis farbe-{p.m.zugehoerigkeit.farbe}"
                class:zusatz={p.m.zugehoerigkeit.rolle === 'buerge'}
                aria-hidden="true">{p.m.person.vorname.slice(0, 1)}</span
              >
              <span class="tx">
                <b
                  >{p.m.person.vorname}
                  <!-- Ohne Haushalt gibt es noch keine Rolle (E-Rolle); nur wer bürgt, steht so da. -->
                  {#if !ohne || p.m.zugehoerigkeit.rolle === 'buerge'}<span class="rolle"
                      >{rollenAnzeige(p.m.zugehoerigkeit.rolle)}</span
                    >{/if}</b
                >
                <small>{p.status}</small>
              </span>
              {#if p.fertig}
                <span class="fertig"
                  ><Symbol name="haken" groesse={16} />{t('selbstauskuenfte.fertig')}</span
                >
              {:else}
                <Symbol name="weiter" groesse={20} />
              {/if}
            </a>
          </li>
        {/each}
      </ul>
      {#if ohne}
        <details class="weitere">
          <summary>{t('ohneHaushalt.weitere')}</summary>
          <PersonOhneAnlegen
            knopf={t('ohneHaushalt.weitere')}
            fertig={(personId) => gehe(`/selbstauskunft/${personId}/bereich`)}
          />
        </details>
      {/if}
    </section>
    {#if ohne}
      {#if personen.length > 1}
        <section>
          <fieldset class="pdf-art">
            <legend>{t('ohneHaushalt.pdf')}</legend>
            <label class="wahl">
              <input type="radio" name="pdf-art" value="eine" bind:group={pdfArt} />
              <span>{t('ohneHaushalt.pdfEine')}</span>
            </label>
            <label class="wahl">
              <input type="radio" name="pdf-art" value="je" bind:group={pdfArt} />
              <span>{t('ohneHaushalt.pdfJe')}</span>
            </label>
          </fieldset>
        </section>
      {/if}
      {#if pdfLaeuft}<p class="hinweis" role="status">{t('ohneHaushalt.pdfLaedt')}</p>{/if}
      {#if pdfFehler}<p class="hinweis" role="alert">{t('ohneHaushalt.pdfFehler')}</p>{/if}
      <section>
        <UebernehmenKasten ohne={ansicht} fertig={(r) => (uebernommen = r)} />
      </section>
    {/if}
  {/if}
</main>
{#if ohne && !ansicht}
  <!-- Nichts zu tun, bis jemand angelegt ist. -->
{:else if ohne}
  {#if offen}
    <Aktionsleiste
      text={t('selbstauskuenfte.ausfuellen')}
      zusatz={t('selbstauskuenfte.offenZusatz', { anzahl: offen })}
      onclick={fehlendeAusfuellen}
    />
  {:else}
    <Aktionsleiste text={t('ohneHaushalt.pdf')} onclick={pdfErstellen} />
  {/if}
{:else if offen}
  <Aktionsleiste
    text={t('selbstauskuenfte.ausfuellen')}
    zusatz={t('selbstauskuenfte.offenZusatz', { anzahl: offen })}
    onclick={fehlendeAusfuellen}
  />
{:else}
  <Aktionsleiste text={t('selbstauskuenfte.allesFertig')} href="#/haushalt" />
{/if}

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) var(--space-4)
      max(calc(140px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    min-height: var(--tap-target);
  }

  .haushalt-satz {
    margin: 8px 0 0;
    color: var(--ink-muted);
    font-size: calc(15 * var(--px));
  }

  .zaehler-zeile {
    padding: 8px var(--space-4, 16px);
  }

  .weitere {
    margin-top: 12px;
  }

  .weitere summary {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 0 var(--space-1);
    font-weight: 700;
    cursor: pointer;
  }

  .pdf-art {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0 var(--space-1);
    border: 0;
  }

  .pdf-art legend {
    margin-bottom: 4px;
    padding: 0;
    font-size: calc(17 * var(--px));
    font-weight: 800;
  }

  .wahl {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    cursor: pointer;
  }

  .wahl input {
    width: 22px;
    height: 22px;
    margin: 0;
    accent-color: var(--ink);
  }

  .erledigt {
    display: grid;
    gap: 6px;
    margin-top: 12px;
    padding: 16px;
  }

  .erledigt p {
    margin: 0;
  }

  .titelblock {
    padding: 6px var(--space-1) 0;
  }

  .frage {
    margin-top: 10px;
  }

  section {
    margin-top: var(--space-6);
  }

  h2 {
    margin: 0 var(--space-1) 8px;
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 800;
  }

  .kasten {
    margin: 0;
    padding: 4px 16px;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
  }

  .kasten > li + li {
    border-top: 1px solid var(--track);
  }

  /* Reicht die Breite nicht, steht der Stand rechtsbündig unter dem Text (C21). */
  .zeile {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    width: 100%;
    min-height: 60px;
    padding: 8px 0;
    color: var(--ink);
    text-decoration: none;
  }

  .knopf {
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .tx {
    display: grid;
    flex: 1 1 min(10em, calc(100% - 74px));
    min-width: 0;
  }

  .tx b {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .tx small {
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .rolle {
    margin-left: 4px;
    font-size: calc(13 * var(--px));
    font-weight: 500;
  }

  .fertig {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    margin-left: auto;
    font-size: calc(13 * var(--px));
    font-weight: 700;
  }

  .kreis {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--farbe);
    color: var(--on-person);
    font-weight: 800;
  }

  .kreis.zusatz {
    border: 2px solid var(--farbe);
    background: var(--surface);
    color: var(--ink);
  }

  .farbe-1 {
    --farbe: var(--person-1);
  }
  .farbe-2 {
    --farbe: var(--person-2);
  }
  .farbe-3 {
    --farbe: var(--person-3);
  }
  .farbe-4 {
    --farbe: var(--person-4);
  }

  .farbe-5 {
    --farbe: var(--person-5);
  }

  .farbe-6 {
    --farbe: var(--person-6);
  }

  .hinweis {
    margin: 6px var(--space-1) 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .bearbeiten {
    display: grid;
    gap: 8px;
    padding: 12px 0;
  }

  .bearbeiten small {
    font-size: calc(13 * var(--px));
    color: var(--ink-muted);
  }

  .bearbeiten .textlink {
    justify-self: start;
  }

  .jn {
    display: flex;
    gap: 8px;
  }

  .jn .chip {
    min-width: 76px;
    padding: 0 14px;
    font-size: calc(15 * var(--px));
  }

  .eingabe input {
    min-height: 48px;
    border-radius: 14px;
  }
</style>
