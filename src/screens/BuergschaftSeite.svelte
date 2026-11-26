<script lang="ts">
  // Bürgschaftserklärung in der App (W63; PC205, Abschnitt 3; DP135, Abschnitt 2): vier Teile auf dem Formblatt wie
  // die Selbstauskunft, 1 Wer bürgt, 2 Für wen und Vermieter, 3 Wohnung und Mietvertrag, 4 Höchstbetrag und Art.
  // Oben der Stand mit „Als PDF ansehen“, unten „Weiter“ mit dem nächsten Teil (K9). Änderungen werden sofort am
  // Heft gespeichert (U11); „Zurück“ und „Fertig“ führen dorthin, woher man kam (W39). Namen kommen aus dem Haushalt
  // (U7). Nötig sind nur Höchstbetrag und Art (E112); Ort, Datum und Unterschrift bleiben für die Hand (U10). Das PDF
  // hat zwei Blätter; Blatt 2 bleibt bei der Person, die bürgt, und kommt nie in die Mappe. Ein Scan von Blatt 1 kommt
  // als Unterlage zur Person, für dieses Heft (DP49 Punkt 5).
  import { tick, untrack } from 'svelte';
  import { ansichtVon, daten, db, neuLaden } from '../app/daten.svelte';
  import { pdfZeigen } from '../app/pdfFenster.svelte';
  import { einstieg, gehe, route, zumEinstieg } from '../app/router.svelte';
  import { adresseZeilen } from '../domain/adresse';
  import { betragAus, betragText, type BuergschaftsArt } from '../domain/buergschaft';
  import {
    angabenAusEingabe,
    BUERGSCHAFT_FORMULAR,
    buergschaftKnopf,
    buergschaftStand,
    eingabeFuer,
    entwurfAus,
    teilZusammenfassung,
    type BuergschaftEingabe,
    type BuergschaftTeil,
  } from '../domain/buergschaftEingabe';
  import { namensteil } from '../domain/dateiname';
  import { nameImPdf, nameText } from '../domain/namen';
  import { rollenAnzeige } from '../domain/regelkatalog';
  import AnschriftFelder from '../formblatt/AnschriftFelder.svelte';
  import FormFeld from '../formblatt/FormFeld.svelte';
  import FormTeil from '../formblatt/FormTeil.svelte';
  import { aufzaehlung, fehlendeFelder } from '../formblatt/formblatt';
  import { t, tagZusammen, tIn } from '../i18n';
  import { heftAendern, personAendern } from '../storage/speicher';
  import { browserZurueck } from '../ui/browserZurueck';
  import UebernehmenKasten from '../ui/UebernehmenKasten.svelte';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import { einstiegText } from '../ui/einstieg';
  import { erklaerungHeft } from '../ui/erklaerungHeft.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  // PC213/PC214 (E385, E-Bürge): Ohne Heft gehört der Entwurf der Person (`buergschaftOhneHeft`); ohne Haushalt steht
  // sie auf dem Sammelplatz. „Für wen“ tippt man dann von Hand, vorbelegt mit den Personen ohne Haushalt im Vertrag.
  let { personId, heftId }: { personId: string; heftId?: string } = $props();

  const id = $props.id();
  const ans = $derived((void daten.ansicht, void daten.ohne, ansichtVon(personId)));
  const ohne = $derived(!!ans?.haushalt.ohneHaushalt);
  const mitglied = $derived(ans?.mitglieder.find((m) => m.person.id === personId) ?? null);
  const heft = $derived(heftId ? (daten.hefte.find((h) => h.id === heftId) ?? null) : null);
  const vertrag = $derived(
    (ans?.mitglieder ?? []).filter(
      (m) => m.zugehoerigkeit.rolle !== 'buerge' && !m.zugehoerigkeit.herausgenommenAm,
    ),
  );
  /** Der gespeicherte Entwurf: am Heft, sonst an der Person (erscheint im Heft, sobald es eins gibt). */
  const entwurf = $derived(
    heft?.buergschaften?.[personId] ?? mitglied?.person.buergschaftOhneHeft ?? null,
  );
  const rufname = $derived(mitglied ? mitglied.person.rufname || mitglied.person.vorname : '');
  const an = $derived(vertrag.length > 1 ? 'ihr' : 'du');
  const name = $derived(mitglied ? nameText(nameImPdf(mitglied.person)) : '');

  let eingabe = $state<BuergschaftEingabe>(
    untrack(() =>
      eingabeFuer(entwurf, {
        mieterNamen: ohne ? vertrag.map((v) => nameText(nameImPdf(v.person))) : undefined,
        anschrift: mitglied?.person.kontakt.anschriftTeile ?? null,
        anschriftText: mitglied?.person.kontakt.anschrift ?? null,
        vermieterName: heft?.angaben?.anbieter ?? null,
        wohnungZeilen: heft ? adresseZeilen(heft.adresse) : [],
        einzug: heft?.einzug ?? null,
      }),
    ),
  );
  let betragEingabe = $state(untrack(() => betragText(eingabe.hoechstbetrag)));
  const mieter = $derived(
    ohne
      ? (eingabe.mieterNamen ?? []).map((n) => n.trim()).filter(Boolean)
      : vertrag.map((v) => nameText(nameImPdf(v.person))),
  );

  const werte = $derived({ e: eingabe, name, mieter });
  const stand = $derived(buergschaftStand(werte));
  const fertig = $derived(stand.every((s) => s.fertig));
  // Beim ersten Öffnen ist der erste Teil auf, der noch nicht ganz ausgefüllt ist; mit gespeichertem Entwurf sind alle
  // zu, wie auf der Seite der Selbstauskunft.
  let offen = $state<BuergschaftTeil | null>(
    untrack(() =>
      entwurf
        ? null
        : (buergschaftStand({ e: eingabe, name, mieter }).find((s) => !s.fertig || !s.voll)?.id ??
          null),
    ),
  );
  const knopf = $derived(buergschaftKnopf(stand, offen));
  const fehltNamen = $derived(
    fehlendeFelder(BUERGSCHAFT_FORMULAR, werte).map((f) =>
      t(f.id === 'art' ? 'buergschaft.fehltArt' : 'buergschaft.fehltBetrag'),
    ),
  );

  let wurzel = $state<HTMLDivElement>();

  async function oeffnen(teil: BuergschaftTeil | null) {
    offen = teil;
    await tick();
    const neu = wurzel?.querySelector<HTMLElement>('section.offen');
    neu?.scrollIntoView({ block: 'nearest' });
    return neu;
  }

  /** Fokus ins erste leere Feld des Teils, sonst ins erste Feld oder den ersten Knopf (K9, DP96). */
  function erstesLeeres(teil: HTMLElement | null | undefined) {
    if (!teil) return;
    const felder = [...teil.querySelectorAll<HTMLInputElement>('input')];
    (
      felder.find((f) => !f.value.trim()) ??
      felder[0] ??
      teil.querySelector<HTMLElement>('[role="radio"]')
    )?.focus();
  }

  function fehlendenOeffnen() {
    const ziel = stand.find((s) => !s.fertig)?.id ?? null;
    void oeffnen(ziel).then((teil) => {
      if (eingabe.hoechstbetrag) teil?.querySelector<HTMLElement>('[role="radio"]')?.focus();
      else erstesLeeres(teil);
    });
  }

  // ---------- Sofort speichern (U11), wie die Selbstauskunft ----------
  let letzter = untrack(() => JSON.stringify(eingabe));
  let zeitgeber: ReturnType<typeof setTimeout> | undefined;
  async function speichern() {
    const jetzt = JSON.stringify(eingabe);
    if (jetzt === letzter || !mitglied) return;
    letzter = jetzt;
    const verbindung = await db();
    const neu = entwurfAus(eingabe, new Date().toISOString());
    if (heftId) {
      const alt = (await verbindung.get('hefte', heftId))?.buergschaften ?? {};
      await heftAendern(verbindung, heftId, { buergschaften: { ...alt, [personId]: neu } });
    } else await personAendern(verbindung, personId, { buergschaftOhneHeft: neu });
    await neuLaden();
  }
  $effect(() => {
    void JSON.stringify(eingabe);
    clearTimeout(zeitgeber);
    zeitgeber = setTimeout(() => void speichern(), 400);
    return () => clearTimeout(zeitgeber);
  });

  // ---------- W39: zurück dorthin, woher man kam ----------
  const ablauf = $derived(
    heftId ? `/buergschaft/${personId}/${heftId}` : `/buergschaft/${personId}`,
  );
  const browser = browserZurueck();
  const sonst = $derived(
    heftId ? `/heft/${heftId}` : ohne ? browser.href.replace(/^#/, '') : `/person/${personId}`,
  );
  const einstiegPfad = $derived((void route.pfad, einstieg(ablauf)));
  const zurueckText = $derived(
    !heftId && ohne && !einstiegPfad ? browser.text : einstiegText(einstiegPfad ?? sonst, ans),
  );

  // ---------- PDF ----------
  let baut = $state(false);
  let bauFehler = $state(false);
  let datei = $state.raw<{ schluessel: string; datei: File } | null>(null);

  async function pdfDatei(): Promise<File | null> {
    await speichern();
    const angaben = angabenAusEingabe($state.snapshot(werte) as typeof werte);
    const schluessel = JSON.stringify(angaben);
    if (datei?.schluessel === schluessel) return datei.datei;
    baut = true;
    bauFehler = false;
    try {
      const [{ buergschaftBauen }, { pdfSchriftenLaden }] = await Promise.all([
        import('../pdf/buergschaft'),
        import('../pdf/schriften'),
      ]);
      const erg = await buergschaftBauen(
        angaben,
        await pdfSchriftenLaden(ans?.haushalt.mappeAussehen?.schrift),
      );
      const teil = namensteil(angaben.buerge.name);
      const neu = new File(
        [erg.bytes.slice()],
        `${['Buergschaftserklaerung', teil].filter(Boolean).join('_')}.pdf`,
        { type: 'application/pdf' },
      );
      datei = { schluessel, datei: neu };
      return neu;
    } catch {
      bauFehler = true;
      return null;
    } finally {
      baut = false;
    }
  }

  async function ansehen() {
    const d = await pdfDatei();
    if (d) pdfZeigen(d);
  }

  async function teilenKlick() {
    const d = await pdfDatei();
    if (!d) return;
    const { teilen } = await import('../ui/mappeErstellen');
    await teilen([d]);
  }

  let uebernommen = $state<{ namen: string; anzahl: number; ansprech: string | null } | null>(null);

  async function hinzufuegen() {
    if (!heftId) return;
    await speichern();
    erklaerungHeft.personId = personId;
    erklaerungHeft.heftId = heftId;
    gehe(`/unterlage/${personId}/buergschaftserklaerung`);
  }

  // ---------- Texte ----------
  const TAG = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  function tagText(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? TAG.format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : iso;
  }
  const ARTEN: BuergschaftsArt[] = ['ausfall', 'selbstschuldnerisch'];
  const artName = (art: BuergschaftsArt) =>
    t(art === 'ausfall' ? 'buergschaft.ausfall' : 'buergschaft.selbst');
  function artSatz(art: BuergschaftsArt): string {
    return tIn(an, art === 'ausfall' ? 'buergschaft.ausfallSatz' : 'buergschaft.selbstSatz', {
      name: rufname,
    });
  }
  function standText(s: { fertig: boolean; voll: boolean }): string {
    if (!s.fertig) return t('buergschaft.esFehlt', { liste: aufzaehlung(fehltNamen) });
    return s.voll ? '' : t('buergschaft.freiwilligStand');
  }
  function zusammenfassung(s: { id: BuergschaftTeil; fertig: boolean; voll: boolean }): string {
    const text = teilZusammenfassung(
      s.id,
      werte,
      { ausfall: artName('ausfall'), selbstschuldnerisch: artName('selbstschuldnerisch') },
      tagText,
    );
    if (!s.fertig) return standText(s);
    return text || standText(s);
  }

  const geaendert = $derived.by(() => {
    const iso = entwurf?.geaendert;
    return iso
      ? tagZusammen(
          new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(new Date(iso)),
        )
      : '';
  });
  const zielName = $derived(
    knopf.art === 'weiter' ? t(`buergschaft.teil.${knopf.ziel}`) : undefined,
  );
  const zielKurz = $derived(
    knopf.art === 'weiter' ? t(`buergschaft.teilKurz.${knopf.ziel}`) : undefined,
  );
</script>

{#snippet jaNeinVertrag()}
  <div class="frage">
    <b id="{id}-vertrag">{t('buergschaft.mietvertrag')}</b>
    <div class="segmente" role="radiogroup" aria-labelledby="{id}-vertrag">
      {#each ['unterschrieben', 'nochNicht'] as const as wert (wert)}
        <button
          type="button"
          class="chip"
          role="radio"
          aria-checked={eingabe.vertrag === wert}
          onclick={() => (eingabe.vertrag = wert)}
          >{t(
            wert === 'unterschrieben' ? 'buergschaft.schonUnterschrieben' : 'buergschaft.nochNicht',
          )}</button
        >
      {/each}
    </div>
  </div>
{/snippet}

<main class="seite">
  <div class="kopf">
    <Zurueck
      href="#{einstiegPfad ?? sonst}"
      text={zurueckText}
      onclick={() => {
        void speichern();
        zumEinstieg(ablauf, sonst);
      }}
    />
  </div>
  {#if !mitglied || (!heft && heftId)}
    <p>{t('personSeite.nichtGefunden')}</p>
  {:else}
    <div class="titelblock">
      <h1 class="display">{t('buergschaft.titel')}</h1>
      <p class="lead">{t('buergschaft.leadSeite', { name: rufname })}</p>
      {#if ohne}<p class="haushalt-satz">{t('ohneHaushalt.kopf')}</p>{/if}
    </div>

    <!-- Stand oben wie in der Selbstauskunft (U1, U12): Blatt, Stand, „Als PDF ansehen“. -->
    <div class="bogen">
      <span class="blatt" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      <div class="tx">
        <b>{fertig ? t('buergschaft.pdfFertig') : t('selbstauskunft.pdfOffen')}</b>
        {#if geaendert}<small>{t('selbstauskunft.zuletzt', { datum: geaendert })}</small>{/if}
        {#if fertig}
          <button type="button" class="textlink" onclick={() => void ansehen()}
            >{t('selbstauskunft.pdfAnsehen')}</button
          >
          <button type="button" class="textlink" onclick={() => void teilenKlick()}
            >{t('buergschaft.teilen')}</button
          >
        {/if}
      </div>
    </div>
    {#if baut}<p class="hinweis" role="status">{t('selbstauskunft.pdfLaedt')}</p>{/if}
    {#if bauFehler}<p class="fehler" role="alert">
        <span class="warnzeichen" aria-hidden="true">!</span><span
          >{t('buergschaft.fehlerBau')}</span
        >
      </p>{/if}

    <div class="akkordeon formblatt" bind:this={wurzel}>
      {#each stand as s, i (s.id)}
        <FormTeil
          nummer={i + 1}
          titel={t(`buergschaft.teil.${s.id}`)}
          offen={offen === s.id}
          fertig={s.fertig && s.voll}
          kopfId="{id}-{s.id}"
          stand={standText(s)}
          zusammenfassung={zusammenfassung(s)}
          oeffnen={() => void oeffnen(s.id)}
        >
          {#if s.id === 'wer'}
            <!-- U7: der Name aus dem Haushalt; ändern lässt er sich auf der Seite der Person. -->
            <p class="name-zeile">
              <b>{name}</b> <small>{rollenAnzeige('buerge')}</small>
            </p>
            <AnschriftFelder
              bind:anschrift={eingabe.anschrift}
              titel={t('buergschaft.anschrift')}
              satz={t('buergschaft.werSatz')}
              datenFeld="buerge-anschrift"
            />
          {:else if s.id === 'fuerWen' && ohne}
            <!-- E-Bürge: ohne Haushalt die Namen von Hand, vorbelegt mit den Personen ohne Haushalt im Vertrag. -->
            {#each eingabe.mieterNamen ?? [], i (i)}
              <FormFeld
                etikett={t('buergschaft.mieterNummer', { nummer: i + 1 })}
                bind:wert={eingabe.mieterNamen![i]!}
                satz={i === 0 ? t('buergschaft.alleImVertrag') : undefined}
                feld={{ autocomplete: 'name' }}
              />
            {/each}
            <button
              type="button"
              class="textlink"
              onclick={() => (eingabe.mieterNamen = [...(eingabe.mieterNamen ?? []), ''])}
              >{t('buergschaft.weitererMieter')}</button
            >
            <FormFeld
              etikett={t('buergschaft.vermieter')}
              bind:wert={eingabe.vermieterName}
              satz={t('buergschaft.vermieterSatz')}
            />
            <AnschriftFelder
              bind:anschrift={eingabe.vermieterAnschrift}
              titel={t('buergschaft.vermieterAnschrift')}
              satz={t('buergschaft.vermieterAnschriftSatz')}
              datenFeld="vermieter-anschrift"
            />
          {:else if s.id === 'fuerWen'}
            <ul class="mieter">
              {#each vertrag as m (m.person.id)}
                <li>
                  <span
                    class="zeichen"
                    style:background="var(--person-{m.zugehoerigkeit.farbe})"
                    aria-hidden="true"
                  ></span>
                  <b>{nameText(nameImPdf(m.person))}</b>
                  <small>{rollenAnzeige(m.zugehoerigkeit.rolle)}</small>
                </li>
              {/each}
            </ul>
            <p class="satz w30" data-w30="feld">{t('buergschaft.alleImVertrag')}</p>
            <FormFeld
              etikett={t('buergschaft.vermieter')}
              bind:wert={eingabe.vermieterName}
              satz={t('buergschaft.vermieterSatz')}
              feld={{ placeholder: t('buergschaft.platzFirma'), autocomplete: 'off' }}
            />
            <AnschriftFelder
              bind:anschrift={eingabe.vermieterAnschrift}
              titel={t('buergschaft.vermieterAnschrift')}
              satz={t('buergschaft.vermieterAnschriftSatz')}
              datenFeld="vermieter-anschrift"
            />
          {:else if s.id === 'wohnung'}
            <AnschriftFelder
              bind:anschrift={eingabe.wohnung}
              titel={t('buergschaft.wohnungAnschrift')}
              satz={t('buergschaft.wohnungAnschriftSatz')}
              datenFeld="wohnung"
            />
            <FormFeld
              etikett={t('buergschaft.lage')}
              bind:wert={eingabe.lage}
              satz={t('buergschaft.lageSatz')}
              feld={{ placeholder: t('buergschaft.platzLage'), autocomplete: 'off' }}
            />
            {@render jaNeinVertrag()}
            <FormFeld
              etikett={eingabe.vertrag === 'unterschrieben'
                ? t('buergschaft.vertragVom')
                : t('buergschaft.einzugZum')}
              bind:wert={eingabe.vertragTag}
              satz={eingabe.vertrag === 'unterschrieben'
                ? t('buergschaft.vertragSatz')
                : t('buergschaft.einzugSatz')}
              feld={{ type: 'date' }}
            />
          {:else}
            <label class="eingabe betrag">
              {t('buergschaft.hoechstbetrag')}
              <span class="betrag-feld">
                <input
                  inputmode="numeric"
                  autocomplete="off"
                  data-feld="hoechstbetrag"
                  aria-describedby="{id}-bis"
                  bind:value={betragEingabe}
                  oninput={() => (eingabe.hoechstbetrag = betragAus(betragEingabe))}
                  onblur={() => (betragEingabe = betragText(eingabe.hoechstbetrag))}
                />
                <span class="euro" aria-hidden="true">{t('buergschaft.euro')}</span>
              </span>
            </label>
            <p class="satz w30" id="{id}-bis" data-w30="feld">
              {t('buergschaft.bisZu', { name: rufname })}
            </p>
            <div class="frage">
              <b id="{id}-art">{t('buergschaft.art')}</b>
              <div class="arten" role="radiogroup" aria-labelledby="{id}-art">
                {#each ARTEN as art (art)}
                  <button
                    type="button"
                    class="art"
                    role="radio"
                    aria-checked={eingabe.art === art}
                    onclick={() => (eingabe.art = art)}
                  >
                    <span class="kreis" aria-hidden="true"></span>
                    <span class="tx">
                      <b>{artName(art)}</b>
                      <small>{artSatz(art)}</small>
                    </span>
                  </button>
                {/each}
              </div>
            </div>
            <!-- DP136, Abschnitt 3; U10: Was nicht ins Formular gehört, kommt von Hand aufs Papier. -->
            <p class="satz">{t('buergschaft.unterschriftSatz')}</p>
          {/if}
        </FormTeil>
      {/each}
    </div>

    {#if ohne}
      <!-- PC213: verbinden wie die Selbstauskunft; wer hier bürgt, bürgt (DP148, Schritt 3). -->
      <section class="danach">
        <UebernehmenKasten
          ohne={daten.ohne}
          fertig={(r) => {
            uebernommen = r;
          }}
        />
      </section>
    {/if}
    {#if uebernommen}
      <div class="kasten erledigt" role="status">
        <p>
          {t('ohneHaushalt.gehoert', { namen: uebernommen.namen, anzahl: uebernommen.anzahl })}
          {#if uebernommen.ansprech}{t('ohneHaushalt.ansprech', {
              name: uebernommen.ansprech,
            })}{/if}
        </p>
        <a class="textlink" href="#/haushalt">{t('ohneHaushalt.zumHaushalt')}</a>
      </div>
    {/if}
    {#if fertig && !ohne && heftId}
      <section class="danach">
        <h2>{t('buergschaft.danach')}</h2>
        <div class="zeilen">
          <button type="button" class="zeile" onclick={() => void hinzufuegen()}>
            <span class="sym" aria-hidden="true"><Symbol name="buergschaft" groesse={20} /></span>
            <span class="tx">
              <b>{t('buergschaft.hinzufuegen')}</b>
              <small>{t('buergschaft.hinzufuegenSatz', { name: rufname })}</small>
            </span>
            <span class="pfeil" aria-hidden="true"><Symbol name="weiter" groesse={16} /></span>
          </button>
        </div>
      </section>
    {/if}
  {/if}
</main>
{#if mitglied && (heft || !heftId)}
  <!-- Eine Leiste für alle Fälle wie in der Selbstauskunft: Nur Text und Ziel wechseln (W8). -->
  <Aktionsleiste
    text={knopf.art === 'weiter'
      ? t('selbstauskunft.weiterKnopf')
      : t('selbstauskunft.fertigKnopf')}
    unterzeile={knopf.art === 'weiter' ? zielKurz : undefined}
    ansage={knopf.art === 'weiter'
      ? t('selbstauskunft.weiterAnsage', { teil: zielName ?? '' })
      : undefined}
    grund={knopf.art === 'blass'
      ? t('buergschaft.esFehlt', { liste: aufzaehlung(fehltNamen) })
      : undefined}
    grundOben
    fokusHalten={knopf.art === 'weiter'}
    beiGrund={fehlendenOeffnen}
    onclick={async () => {
      if (knopf.art === 'weiter') {
        void oeffnen(knopf.ziel).then(erstesLeeres);
        return;
      }
      await speichern();
      zumEinstieg(ablauf, sonst);
    }}
  />
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

  .lead {
    margin: 8px 0 0;
    color: var(--ink-muted);
  }

  .bogen {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: var(--space-5);
    padding: 16px;
    border-radius: 20px;
    background: var(--surface);
  }

  .blatt {
    display: grid;
    align-content: start;
    gap: 5px;
    flex-shrink: 0;
    width: 54px;
    height: 76px;
    padding: 9px 7px;
    border-radius: 4px;
    background: #fff;
    box-shadow: 0 2px 8px rgb(25 26 44 / 0.15);
  }

  .blatt i {
    display: block;
    height: 2px;
    border-radius: 1px;
    background: var(--track);
  }

  .blatt i:first-child {
    width: 70%;
    height: 4px;
    background: #26221e;
  }

  .tx {
    display: grid;
    flex: 1;
    min-width: 0;
    justify-items: start;
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

  .hinweis {
    margin: 8px 0 0;
    font-size: calc(14 * var(--px));
    color: var(--ink-muted);
  }

  .akkordeon {
    display: grid;
    gap: 12px;
    margin-top: 12px;
  }

  .name-zeile {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    margin: 0;
  }

  .name-zeile b,
  .mieter b {
    font-size: calc(15 * var(--px));
    font-weight: 650;
  }

  .name-zeile small,
  .mieter small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .mieter {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .mieter li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    min-height: var(--tap-target);
    padding: 12px 0;
  }

  .mieter li + li {
    border-top: 1px solid var(--track);
  }

  .zeichen {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }

  .satz {
    margin: -4px 0 0;
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    color: var(--ink-muted);
  }

  .frage {
    display: grid;
    gap: 8px;
  }

  .frage > b {
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .segmente {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .segmente .chip {
    padding: 0 14px;
    font-size: calc(15 * var(--px));
  }

  .betrag-feld {
    position: relative;
    display: block;
  }

  .betrag-feld input {
    padding-right: 64px;
    font-size: calc(20 * var(--px));
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .euro {
    position: absolute;
    top: 50%;
    right: 16px;
    transform: translateY(-50%);
    color: var(--ink-muted);
    font-size: calc(15 * var(--px));
    font-weight: 600;
    pointer-events: none;
  }

  .arten {
    display: grid;
  }

  .art {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    min-height: var(--tap-target);
    padding: 12px 0;
    border: 0;
    background: none;
    color: var(--ink);
    text-align: left;
    font: inherit;
    cursor: pointer;
  }

  .art + .art {
    border-top: 1px solid var(--track);
  }

  .kreis {
    flex: none;
    width: 22px;
    height: 22px;
    margin-top: 1px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1.5px var(--ink-muted);
  }

  .art[aria-checked='true'] .kreis {
    box-shadow:
      inset 0 0 0 1.5px var(--ink),
      inset 0 0 0 5px var(--surface),
      inset 0 0 0 11px var(--ink);
  }

  .art .tx {
    gap: 2px;
  }

  .art .tx b {
    font-size: calc(15 * var(--px));
    font-weight: 650;
  }

  .fehler {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin: 8px var(--space-1) 0;
    color: var(--fehler);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    font-weight: 600;
  }

  .warnzeichen {
    display: grid;
    flex: none;
    place-items: center;
    width: 16px;
    height: 16px;
    margin-top: 1px;
    border-radius: 8px;
    background: var(--fehler);
    color: var(--surface);
    font-size: calc(11 * var(--px));
    font-weight: 800;
    line-height: 1;
  }

  .danach {
    margin-top: var(--space-5);
  }

  .danach h2 {
    margin: 0 var(--space-1) 8px;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 650;
  }

  .zeilen {
    padding: 4px 14px;
    border-radius: 20px;
    background: var(--surface);
  }

  .zeile {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 10px 0;
    border: 0;
    background: none;
    color: var(--ink);
    text-align: left;
    font: inherit;
    cursor: pointer;
  }

  .sym,
  .pfeil {
    display: inline-flex;
    flex: none;
    color: var(--ink);
  }

  .pfeil {
    color: var(--ink-muted);
  }
</style>
