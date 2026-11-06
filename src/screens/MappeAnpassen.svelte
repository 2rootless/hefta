<script lang="ts">
  // Mappe anpassen (X8): Ausgabe, Dateiname (Endung fest daneben), Bestandteile. Gilt nur für diese
  // Bewerbung. Dazu der Satz fürs Deckblatt (im Deckblatt-Entwurf vorgesehen, hier eintragbar).
  import { onDestroy, onMount, untrack } from 'svelte';
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { zurueckGehen } from '../app/router.svelte';
  import { namensteil } from '../domain/dateiname';
  import {
    bitteSatzAus,
    einstellungenNachLaden,
    standardEinstellungen,
    type ExportEinstellungen,
  } from '../domain/export';
  import {
    AUSSEHEN_STANDARD,
    type Bewerbung,
    type MappenAkzent,
    type MappenAussehen,
    type MappenFlaeche,
    type MappenSchrift,
  } from '../domain/modell';
  import { t } from '../i18n';
  import { AKZENTE, druckTon, flaechenTon, flaecheVon, PERSONENFARBEN } from '../pdf/mappe';
  import type { PdfDokument } from '../pdf/pdfjs';
  import {
    bewerbungLaden,
    bewerbungSpeichern,
    farbeSetzen,
    haushaltAendern,
  } from '../storage/speicher';
  import FarbWahl from '../ui/FarbWahl.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import { passend, TITEL } from '../ui/passend';
  import Schalter from '../ui/Schalter.svelte';
  import { staendeAus, standardDateiname } from '../ui/mappeDaten';
  import { bauSchluessel, gebauteMappen } from '../ui/mappeSpeicher';
  import type { AussehenVorschau } from '../ui/mappeVorschau';
  import SeitenAnsicht from '../ui/SeitenAnsicht.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  let bewerbung = $state<Bewerbung | null>(null);
  let e = $state<ExportEinstellungen>(standardEinstellungen());
  let name = $state('');
  let geladen = $state(false);
  // Die Bitte steht auf dem Deckblatt: Ohne Deckblatt und bei Einzeldateien geht sie nicht, die Wahl bleibt.
  const bitteGeht = $derived(e.deckblatt && e.ausgabe !== 'einzeln');

  onMount(async () => {
    if (!daten.ansicht) return;
    bewerbung = await bewerbungLaden(await db(), daten.ansicht.haushalt.id);
    e = einstellungenNachLaden(bewerbung?.export, $state.snapshot(e));
    name =
      e.dateiname ||
      standardDateiname(staendeAus(daten.ansicht), bewerbung?.adresse ?? '').replace(/\.pdf$/, '');
    geladen = true;
  });

  // Aussehen der Mappe (AM1 bis AM3): gehört zum Haushalt, gilt für alle Bewerbungen, kommt ins Backup.
  let aussehen = $state<MappenAussehen>(daten.ansicht?.haushalt.mappeAussehen ?? AUSSEHEN_STANDARD);
  let vorschau = $state.raw<AussehenVorschau | null>(null);
  const fertigeVorschauen: Record<string, AussehenVorschau> = {};
  let vorschauLauf = 0;
  let vorschauFehler = $state(false);
  const staende = $derived(daten.ansicht ? staendeAus(daten.ansicht) : []);
  const allein = $derived(staende.filter((s) => s.rolle !== 'buerge').length === 1);
  const beispielSatz = $derived(
    allein ? t('mappe.aussehen.beispielDu') : t('mappe.aussehen.beispielIhr'),
  );
  // Der Knopf hat einen eigenen Namen: Was im Kasten steht, muss darin vorkommen.
  const vorschauName = $derived(
    [
      `${allein ? t('mappe.aussehen.grossDu') : t('mappe.aussehen.grossIhr')}.`,
      vorschau?.beispiel ? beispielSatz : '',
      e.fusszeile ? '' : t('mappe.aussehen.kopfAus'),
      e.deckblatt ? '' : t('mappe.aussehen.deckAus'),
    ]
      .filter(Boolean)
      .join(' '),
  );

  async function vorschauHolen() {
    if (!daten.ansicht) return;
    const wahl = $state.snapshot(aussehen);
    const schluessel = `${wahl.art}-${wahl.akzent ?? ''}-${wahl.schrift ?? ''}-${wahl.kompakt ?? ''}-${wahl.flaeche ?? ''}`;
    const lauf = ++vorschauLauf;
    let fertig = fertigeVorschauen[schluessel];
    if (!fertig) {
      try {
        const { vorschauBauen } = await import('../ui/mappeVorschau');
        fertig = await vorschauBauen(
          await db(),
          daten.ansicht,
          bewerbung,
          $state.snapshot(e),
          wahl,
        );
        fertigeVorschauen[schluessel] = fertig;
      } catch {
        // Ohne Vorschau bleibt die Wahl möglich; „wird erstellt“ darf nicht stehen bleiben.
        if (lauf === vorschauLauf) vorschauFehler = true;
        return;
      }
    }
    // Während es lief, kann schon etwas anderes gewählt sein: Dann gilt das Neuere.
    if (lauf === vorschauLauf) {
      vorschau = fertig;
      vorschauFehler = false;
    }
  }

  $effect(() => {
    void aussehen.art;
    void aussehen.akzent;
    void aussehen.schrift;
    void aussehen.kompakt;
    void aussehen.flaeche;
    if (geladen) untrack(() => void vorschauHolen());
  });

  async function aussehenWaehlen(wahl: MappenAussehen) {
    // Die Art ist eine Wahl, Schrift, Kompakt und Fläche sind andere: Sie bleiben beim Wechsel erhalten.
    // Auch die Akzentfarbe bleibt: Die Fläche kann sie nutzen, wenn die Art längst eine andere ist.
    const neu: MappenAussehen = { ...wahl };
    const schrift = wahl.schrift ?? aussehen.schrift;
    const kompakt = wahl.kompakt ?? aussehen.kompakt;
    const flaecheWahl = wahl.flaeche ?? aussehen.flaeche;
    const akzent = wahl.akzent ?? aussehen.akzent;
    if (schrift) neu.schrift = schrift;
    if (kompakt !== undefined) neu.kompakt = kompakt;
    if (flaecheWahl) neu.flaeche = flaecheWahl;
    if (akzent) neu.akzent = akzent;
    aussehen = neu;
    if (!daten.ansicht) return;
    await haushaltAendern(await db(), daten.ansicht.haushalt.id, {
      mappeAussehen: $state.snapshot(neu),
    });
    await neuLaden();
  }

  const SCHRIFTEN: MappenSchrift[] = ['archivo', 'source_serif', 'plex_sans'];
  const FLAECHEN: MappenFlaeche[] = ['personen', 'akzent', 'grau', 'keine'];
  const hauptStand = $derived(staende.find((s) => s.rolle === 'hauptmieter') ?? staende[0]);
  const flaechenPunkt = (id: MappenFlaeche) =>
    flaechenTon(
      id,
      aussehen.akzent,
      hauptStand && PERSONENFARBEN[(hauptStand.farbe - 1) % PERSONENFARBEN.length],
    ) ?? '#ffffff';
  // Was „Kompakt“ gerade bewirkt, aus dem letzten Bau dieser Wahl; ohne ihn der allgemeine Satz.
  const gebaut = $derived(
    daten.ansicht && geladen
      ? gebauteMappen.holen(bauSchluessel(daten.ansicht, bewerbung, $state.snapshot(e)))
      : undefined,
  );
  const kompaktText = $derived.by(() => {
    if (gebaut?.deckSeiten === undefined) return t('mappe.aussehen.kompaktUnter');
    if (gebaut.deckSeiten === 1) {
      return (gebaut.deckMassstab ?? 1) < 1
        ? t('mappe.aussehen.kompaktWirkt')
        : t('mappe.aussehen.kompaktUnnoetig');
    }
    return gebaut.kompaktHilft ? t('mappe.aussehen.kompaktHilft') : t('mappe.aussehen.kompaktNein');
  });

  // Farbe einer Person gleich hier ändern: Vorher wusste man nicht, wozu sie einmal dient.
  let farbeOffen = $state(false);
  let farbePerson = $state<string | null>(null);
  const farbeMitglied = $derived(
    daten.ansicht?.mitglieder.find((m) => m.person.id === farbePerson) ?? null,
  );
  const andereFarben = $derived(
    (daten.ansicht?.mitglieder ?? [])
      .filter((m) => m.person.id !== farbePerson)
      .map((m) => ({
        farbe: m.zugehoerigkeit.farbe,
        name: m.person.rufname || m.person.vorname,
      })),
  );
  const alteVorschauen: AussehenVorschau[] = [];
  async function farbeWaehlen(farbe: number) {
    if (!farbeMitglied) return;
    await farbeSetzen(await db(), farbeMitglied.zugehoerigkeit.id, farbe);
    await neuLaden();
    // Die Bilder stehen noch, bis die neuen da sind; freigegeben werden sie beim Verlassen.
    for (const k of Object.keys(fertigeVorschauen)) {
      alteVorschauen.push(fertigeVorschauen[k]!);
      delete fertigeVorschauen[k];
    }
    void vorschauHolen().catch(() => {});
  }

  // Tipp auf die Vorschau: die ganze Mappe groß, in derselben Ansicht wie sonst die PDF.
  let grossOffen = $state(false);
  let grossIndex = $state(0);
  let grossDok = $state.raw<PdfDokument | null>(null);
  let grossLaedt = $state(false);
  let grossFehler = $state(false);
  let verlassen = false;
  const grosseSeiten = $derived(
    grossDok
      ? Array.from({ length: grossDok.numPages }, (_, i) => ({
          dokument: grossDok!,
          nummer: i + 1,
          schluessel: String(i),
        }))
      : [],
  );
  async function grossZeigen() {
    if (!vorschau || !daten.ansicht || grossLaedt) return;
    grossLaedt = true;
    grossFehler = false;
    try {
      const { ganzeMappe } = await import('../ui/mappeVorschau');
      const { pdfOeffnen, pdfSchliessen } = await import('../pdf/pdfjs');
      const bytes = await ganzeMappe(
        await db(),
        daten.ansicht,
        bewerbung,
        $state.snapshot(e),
        $state.snapshot(aussehen),
      );
      if (verlassen) return;
      if (grossDok) void pdfSchliessen(grossDok);
      grossDok = await pdfOeffnen(bytes);
      grossIndex = 0;
      grossOffen = true;
    } catch {
      grossFehler = true;
    } finally {
      grossLaedt = false;
    }
  }

  onDestroy(() => {
    verlassen = true;
    vorschauLauf++;
    for (const v of [...Object.values(fertigeVorschauen), ...alteVorschauen]) {
      URL.revokeObjectURL(v.kopf);
      URL.revokeObjectURL(v.deck);
    }
    const dok = grossDok;
    if (dok) void import('../pdf/pdfjs').then(({ pdfSchliessen }) => pdfSchliessen(dok));
  });

  /** Farbe aus Daten: Inline-Stile im HTML verbietet die CSP, CSSOM ist erlaubt. */
  function flaeche(element: HTMLElement, farbe: string) {
    element.style.setProperty('--ton', farbe);
    return { update: (neu: string) => element.style.setProperty('--ton', neu) };
  }

  async function speichern() {
    if (!daten.ansicht || !geladen) return;
    const sauber = name
      .split('_')
      .map((teil) => namensteil(teil))
      .filter(Boolean)
      .join('_');
    const standard = standardDateiname(staendeAus(daten.ansicht), bewerbung?.adresse ?? '').replace(
      /\.pdf$/,
      '',
    );
    e.dateiname = sauber && sauber !== standard ? sauber : '';
    bewerbung = await bewerbungSpeichern(await db(), daten.ansicht.haushalt.id, {
      export: $state.snapshot(e),
    });
  }

  $effect(() => {
    void JSON.stringify([
      e.ausgabe,
      e.deckblatt,
      e.inhaltsverzeichnis,
      e.fusszeile,
      e.unterschrift,
      e.hinweis,
      e.bitte,
    ]);
    void speichern();
  });
</script>

<main class="seite">
  <div class="kopf"><Zurueck href="#/mappe" text={t('mappe.titel')} /></div>
  <div class="titelblock">
    <h1 class="display frage" use:passend={TITEL}>{t('mappe.anpassen')}</h1>
    <p class="lead">{t('mappe.anpassenSeite.lead')}</p>
  </div>

  <section>
    <h2>{t('mappe.anpassenSeite.ausgabe')}</h2>
    <div class="segmente" role="radiogroup" aria-label={t('mappe.anpassenSeite.ausgabe')}>
      {#each ['eine', 'einzeln'] as const as a (a)}
        <button
          type="button"
          class="chip"
          role="radio"
          aria-checked={e.ausgabe === a}
          onclick={() => (e.ausgabe = a)}
          >{a === 'eine' ? t('mappe.eine') : t('mappe.einzeln')}</button
        >
      {/each}
    </div>
    <p class="hinweis">{t('mappe.anpassenSeite.ausgabeHinweis')}</p>
  </section>

  <section>
    <h2>{t('mappe.dateiname')}</h2>
    <label class="name">
      <span class="visually-hidden">{t('mappe.dateiname')}</span>
      <input bind:value={name} onchange={speichern} autocomplete="off" spellcheck="false" />
      <span class="endung" aria-hidden="true">.pdf</span>
    </label>
    <p class="hinweis">{t('mappe.anpassenSeite.dateinameHinweis')}</p>
  </section>

  <section>
    <h2>{t('mappe.aussehen.titel')}</h2>
    {#if vorschau}
      <button
        type="button"
        class="vorschau"
        aria-label={vorschauName}
        aria-busy={grossLaedt}
        onclick={grossZeigen}
      >
        {#if vorschau.beispiel}
          <span class="unter beispiel">{beispielSatz}</span>
        {/if}
        <span class="bild">
          <img src={vorschau.kopf} alt="" />
          <span class="unter"
            >{e.fusszeile
              ? t('mappe.aussehen.kopf', { name: vorschau.rufname })
              : t('mappe.aussehen.kopfAus')}</span
          >
        </span>
        <span class="bild">
          <img src={vorschau.deck} alt="" />
          <span class="unter"
            >{grossLaedt
              ? t('mappe.aussehen.grossLaedt')
              : e.deckblatt
                ? t('mappe.aussehen.deck')
                : `${t('mappe.aussehen.deckAus')} ${t('mappe.aussehen.tippGanz')}`}</span
          >
        </span>
      </button>
      <p class="visually-hidden" role="status">
        {grossLaedt ? t('mappe.aussehen.grossLaedt') : ''}
      </p>
      {#if grossFehler}
        <p class="hinweis" role="alert">{t('mappe.aussehen.grossFehler')}</p>
      {/if}
    {:else if vorschauFehler}
      <p class="hinweis" role="status">{t('mappe.aussehen.keineVorschau')}</p>
    {:else}
      <p class="hinweis" role="status">{t('mappe.aussehen.laedt')}</p>
    {/if}
    <div class="arten" role="radiogroup" aria-label={t('mappe.aussehen.titel')}>
      <button
        type="button"
        class="modus"
        class:an={aussehen.art === 'schlicht'}
        role="radio"
        aria-checked={aussehen.art === 'schlicht'}
        onclick={() => aussehenWaehlen({ art: 'schlicht' })}
      >
        <span class="punkt" aria-hidden="true"></span>
        <span class="tx">
          <b>{t('mappe.aussehen.schlicht')}</b>
          <small>{t('mappe.aussehen.schlichtSatz')}</small>
        </span>
      </button>
      <button
        type="button"
        class="modus"
        class:an={aussehen.art === 'einefarbe'}
        role="radio"
        aria-checked={aussehen.art === 'einefarbe'}
        onclick={() => aussehenWaehlen({ art: 'einefarbe', akzent: aussehen.akzent ?? 'tanne' })}
      >
        <span class="punkt" aria-hidden="true"></span>
        <span class="tx">
          <b>{t('mappe.aussehen.eineFarbe')}</b>
          <small>{t('mappe.aussehen.eineFarbeSatz')}</small>
        </span>
      </button>
      {#if aussehen.art === 'einefarbe'}
        <div class="akzente" role="radiogroup" aria-label={t('mappe.aussehen.farbe')}>
          {#each Object.entries(AKZENTE) as [id, farbe] (id)}
            <button
              type="button"
              class="akzent"
              role="radio"
              aria-checked={aussehen.akzent === id}
              onclick={() => aussehenWaehlen({ art: 'einefarbe', akzent: id as MappenAkzent })}
            >
              <i use:flaeche={farbe}></i>{t(`mappe.aussehen.akzent.${id as MappenAkzent}`)}
            </button>
          {/each}
        </div>
      {/if}
      <button
        type="button"
        class="modus"
        class:an={aussehen.art === 'personen'}
        role="radio"
        aria-checked={aussehen.art === 'personen'}
        onclick={() => aussehenWaehlen({ art: 'personen' })}
      >
        <span class="punkt" aria-hidden="true"></span>
        <span class="tx">
          <b>{t('mappe.aussehen.personen')} <span class="etikett">{t('mappe.empfohlen')}</span></b>
          <small>{t('mappe.aussehen.personenSatz')}</small>
        </span>
      </button>
      {#if aussehen.art === 'personen'}
        <div class="personen">
          <div class="reihe">
            {#each staende as s (s.person.id)}
              <button
                type="button"
                class="person-farbe"
                aria-label={t('mappe.aussehen.farbeVon', {
                  name: s.person.rufname || s.person.vorname,
                })}
                onclick={() => {
                  farbePerson = s.person.id;
                  farbeOffen = true;
                }}
              >
                <i
                  class:umriss={s.rolle === 'buerge'}
                  use:flaeche={druckTon(PERSONENFARBEN[(s.farbe - 1) % PERSONENFARBEN.length]!)}
                ></i>{s.person.rufname || s.person.vorname}
              </button>
            {/each}
          </div>
          <p>{t('mappe.aussehen.personenHinweis')}</p>
        </div>
      {/if}
    </div>
    <p class="hinweis">{t('mappe.aussehen.gilt')}</p>
  </section>

  <section>
    <h2>{t('mappe.aussehen.schrift')}</h2>
    <div class="schriften" role="radiogroup" aria-label={t('mappe.aussehen.schrift')}>
      {#each SCHRIFTEN as id (id)}
        <button
          type="button"
          class="chip schrift-{id}"
          role="radio"
          aria-checked={(aussehen.schrift ?? 'archivo') === id}
          onclick={() => aussehenWaehlen({ ...aussehen, schrift: id })}
          >{t(`mappe.aussehen.schriftName.${id}`)}</button
        >
      {/each}
    </div>
    <p class="hinweis">{t('mappe.aussehen.schriftHinweis')}</p>
  </section>

  <section>
    <h2>{t('mappe.aussehen.flaeche')}</h2>
    <div class="schriften" role="radiogroup" aria-label={t('mappe.aussehen.flaeche')}>
      {#each FLAECHEN as id (id)}
        <button
          type="button"
          class="chip mit-punkt"
          role="radio"
          aria-checked={flaecheVon(aussehen) === id}
          onclick={() => aussehenWaehlen({ ...aussehen, flaeche: id })}
        >
          <i class:keine={id === 'keine'} use:flaeche={flaechenPunkt(id)}></i>
          {t(`mappe.aussehen.flaecheName.${id}`)}
        </button>
      {/each}
    </div>
    <p class="hinweis">{t('mappe.aussehen.flaecheHinweis')}</p>
  </section>

  <section>
    <h2>{t('mappe.deckblatt')}</h2>
    <ul class="kasten">
      <li>
        <span class="tx"><b>{t('mappe.aussehen.kompakt')}</b><small>{kompaktText}</small></span>
        <Schalter
          an={!!aussehen.kompakt}
          label={t('mappe.aussehen.kompakt')}
          onclick={() => aussehenWaehlen({ ...aussehen, kompakt: !aussehen.kompakt })}
        />
      </li>
    </ul>
  </section>

  <section>
    <h2>{t('mappe.anpassenSeite.bestandteile')}</h2>
    <ul class="kasten">
      <li>
        <span class="tx"><b>{t('mappe.deckblatt')}</b></span>
        <Schalter
          an={e.deckblatt}
          label={t('mappe.deckblatt')}
          onclick={() => (e.deckblatt = !e.deckblatt)}
        />
      </li>
      <li>
        <span class="tx"
          ><b>{t('mappe.inhalt')}</b><small>{t('mappe.anpassenSeite.inhaltHinweis')}</small></span
        >
        <Schalter
          an={e.deckblatt && e.inhaltsverzeichnis}
          gesperrt={!e.deckblatt}
          label={t('mappe.inhalt')}
          onclick={() => (e.inhaltsverzeichnis = !e.inhaltsverzeichnis)}
        />
      </li>
      <li>
        <span class="tx"
          ><b>{t('mappe.anpassenSeite.hinweis')}</b><small
            >{t('mappe.anpassenSeite.hinweisUnter')}</small
          ></span
        >
        <Schalter
          an={e.deckblatt && e.hinweis !== false}
          gesperrt={!e.deckblatt}
          label={t('mappe.anpassenSeite.hinweis')}
          onclick={() => (e.hinweis = e.hinweis === false)}
        />
      </li>
      <li>
        <span class="tx">
          <b>{t('mappe.anpassenSeite.bitte')}</b>
          {#if !bitteGeht}
            <small>{t('mappe.anpassenSeite.bitteSperre')}</small>
          {:else if e.bitte}
            <small class="bitte-satz">„{bitteSatzAus(bewerbung)}“</small>
            <a class="textlink" href="#/mappe/anpassen/bitte"
              >{t('mappe.anpassenSeite.bitteAendern')}</a
            >
          {:else}
            <small
              >{allein
                ? t('mappe.anpassenSeite.bitteUnterDu')
                : t('mappe.anpassenSeite.bitteUnter')}</small
            >
          {/if}
        </span>
        <Schalter
          an={bitteGeht && !!e.bitte}
          gesperrt={!bitteGeht}
          label={t('mappe.anpassenSeite.bitte')}
          onclick={() => (e.bitte = !e.bitte)}
        />
      </li>
      <li>
        <span class="tx"
          ><b>{t('mappe.anpassenSeite.fusszeile')}</b><small
            >{t('mappe.anpassenSeite.fusszeileHinweis')}</small
          ></span
        >
        <Schalter
          an={e.fusszeile}
          label={t('mappe.anpassenSeite.fusszeile')}
          onclick={() => (e.fusszeile = !e.fusszeile)}
        />
      </li>
      <li>
        <span class="tx"
          ><b>{t('mappe.anpassenSeite.unterschrift')}</b><small
            >{t('mappe.anpassenSeite.unterschriftHinweis')}</small
          ></span
        >
        <Schalter
          an={!!e.unterschrift}
          label={t('mappe.anpassenSeite.unterschrift')}
          onclick={() => (e.unterschrift = !e.unterschrift)}
        />
      </li>
    </ul>
  </section>
</main>
<Aktionsleiste
  text={t('mappe.anpassenSeite.fertig')}
  onclick={async () => {
    await speichern();
    zurueckGehen('/mappe');
  }}
/>

{#if grosseSeiten.length}
  <SeitenAnsicht bind:offen={grossOffen} seiten={grosseSeiten} bind:index={grossIndex} />
{/if}

<Sheet
  bind:offen={farbeOffen}
  titel={farbeMitglied
    ? t('mappe.aussehen.farbeVon', {
        name: farbeMitglied.person.rufname || farbeMitglied.person.vorname,
      })
    : ''}
>
  {#if farbeMitglied}
    {#key farbePerson}
      <FarbWahl
        farbe={farbeMitglied.zugehoerigkeit.farbe}
        ursprung={farbeMitglied.zugehoerigkeit.farbe}
        vergeben={andereFarben}
        beimWaehlen={(f) => void farbeWaehlen(f)}
      />
    {/key}
  {/if}
</Sheet>

<style>
  .person-farbe {
    gap: 6px;
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-target);
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .vorschau {
    display: grid;
    width: 100%;
    gap: 12px;
    margin-bottom: 12px;
    padding: 12px;
    border: 0;
    border-radius: 16px;
    background: var(--track);
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .bild {
    display: block;
  }

  .bild img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 3px;
    background: #fff;
    box-shadow: 0 1px 3px rgba(25, 26, 44, 0.25);
  }

  .unter {
    display: block;
    margin-top: 6px;
    color: var(--ink-muted);
    font-size: calc(12 * var(--px));
    line-height: calc(16 * var(--px));
  }

  .beispiel {
    margin-top: 0;
    color: var(--ink);
    font-weight: 700;
  }

  .schriften {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-target);
    padding: 0 14px;
    border-radius: 22px;
    border: 1.5px solid var(--ink-muted);
    background: var(--surface);
    color: var(--ink);
    font-size: calc(15 * var(--px));
    white-space: nowrap;
  }
  .chip[aria-checked='true'] {
    border: 2.5px solid var(--ink);
    font-weight: 700;
  }
  .mit-punkt {
    gap: 8px;
  }
  .mit-punkt i {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--ton);
  }
  .mit-punkt i.keine {
    border: 1.5px solid var(--ink-muted);
  }
  /* Jeder Chip in einer Schrift seiner Art; die PDF-Schriften selbst lädt die App nur fürs PDF. */
  .schrift-source_serif {
    font-family: Georgia, 'Times New Roman', serif;
  }
  .schrift-plex_sans {
    font-family: 'Helvetica Neue', Arial, sans-serif;
  }
  .arten {
    display: grid;
    gap: 8px;
  }

  .akzente {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 4px 44px;
  }

  .akzent {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: var(--tap-target);
    padding: 0 14px 0 8px;
    border: 1.5px solid var(--control-border);
    border-radius: 22px;
    background: var(--surface);
    color: var(--ink);
    font-size: calc(14 * var(--px));
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
  }

  .akzent[aria-checked='true'] {
    border: 2.5px solid var(--ink);
  }

  .akzent i {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--ton);
  }

  .personen {
    margin: 0 0 4px 44px;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }

  .personen p {
    margin: 0;
  }

  .reihe {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin-bottom: 4px;
    color: var(--ink);
    font-weight: 700;
  }

  .reihe i {
    flex-shrink: 0;
    width: 12px;
    height: 12px;
    background: var(--ton);
  }

  .reihe i.umriss {
    background: none;
    box-shadow: inset 0 0 0 2px var(--ton);
  }

  .etikett {
    padding: 0 7px;
    border: 1.5px solid currentColor;
    border-radius: 10px;
    font-size: calc(11 * var(--px));
    line-height: calc(16 * var(--px));
    font-weight: 700;
  }

  .modus {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    padding: 14px 16px;
    border: 2px solid transparent;
    border-radius: 18px;
    background: var(--surface);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .modus.an {
    border-color: var(--ink);
  }

  .punkt {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    margin-top: 1px;
    border: 2px solid var(--ink);
    border-radius: 50%;
  }

  .modus.an .punkt::after {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--ink);
  }

  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0
      max(calc(140px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    min-height: var(--tap-target);
    padding: 0 var(--space-5) 0 12px;
  }

  .titelblock {
    padding: 6px var(--space-5) 0;
  }

  .frage {
    margin-top: 10px;
  }

  section {
    margin: 22px var(--space-4) 0;
  }

  h2 {
    margin: 0 var(--space-1) 8px;
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 800;
  }

  .hinweis {
    margin: 8px var(--space-1) 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .segmente {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .segmente .chip {
    padding: 0 16px;
    font-size: calc(15 * var(--px));
  }

  .name {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 48px;
    padding: 0 14px;
    border: 1.5px solid var(--control-border);
    border-radius: 14px;
    background: var(--surface);
  }

  .name:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .name input {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(15 * var(--px));
    text-overflow: ellipsis;
    outline: none;
  }

  .endung {
    flex-shrink: 0;
    color: var(--ink-muted);
  }

  .kasten {
    margin: 0;
    padding: 4px 16px;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
  }

  .kasten li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 8px 0;
  }

  .kasten li + li {
    border-top: 1px solid var(--track);
  }

  .bitte-satz {
    color: var(--ink);
  }

  .tx {
    display: grid;
    flex: 1;
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
</style>
