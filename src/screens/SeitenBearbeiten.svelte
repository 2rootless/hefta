<script lang="ts">
  // Seiten einer Version (design/nachtraeglich-ordnen.md, OR4 bis OR6): je Seite „Nicht in die Mappe“,
  // „Verschieben“, „Löschen“. Die Reihenfolge bleibt wie in der Datei.
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { abschliessen, zurueckGehen } from '../app/router.svelte';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import { einmal } from '../ui/einmal';
  import { rueckgaengigAnbieten } from '../app/rueckgaengig.svelte';
  import { aktuelleVersionen, monatAus } from '../domain/fristen';
  import type { DateiVersion } from '../domain/modell';
  import {
    eintragenText,
    listenText,
    ohneTrennstellen,
    personStand,
    rollenText,
    type Dokumenttyp,
    type UnterlagenStand,
  } from '../domain/regelkatalog';
  import {
    dateiVon,
    eigeneSeiten,
    kommtInMappe,
    letzteInMappe,
    seiteHeraus,
    seiteUmschalten,
  } from '../domain/seitenVersion';
  import { t } from '../i18n';
  import { miniatur, pdfOeffnen, pdfSchliessen, type PdfDokument } from '../pdf/pdfjs';
  import {
    dateiLesen,
    versionenAendern,
    versionenZurueck,
    type VersionenStand,
  } from '../storage/speicher';
  import SeitenAnsicht from '../ui/SeitenAnsicht.svelte';
  import { seiteVerschieben, type VerschiebeZiel } from '../ui/seitenAktionen';
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  import Sheet from '../ui/Sheet.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import { tagKurz } from '../ui/texte';
  import { monatJahr, monatKuerzel, seitenZahl, versionTitel } from '../ui/versionInfo';
  import WischZeile from '../ui/WischZeile.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  let { personId, typId, versionId }: { personId: string; typId: string; versionId: string } =
    $props();

  const staende = $derived(
    daten.ansicht
      ? daten.ansicht.mitglieder.map((m) =>
          personStand(
            m.person,
            m.zugehoerigkeit,
            daten.ansicht!.dokumente,
            daten.ansicht!.versionen,
            undefined,
            haushaltsAngabenAus(daten.ansicht),
          ),
        )
      : [],
  );
  const stand = $derived(staende.find((s) => s.person.id === personId) ?? null);
  const u = $derived(
    stand?.unterlagen.find((x) => x.typ.id === typId) ??
      stand?.nichtMehrNoetig.find((x) => x.typ.id === typId) ??
      null,
  );
  const v = $derived(u?.versionen.find((x) => x.id === versionId) ?? null);
  const alle = $derived(daten.ansicht?.versionen ?? []);
  const name = $derived(stand ? stand.person.rufname || stand.person.vorname : '');
  const basis = $derived(`/unterlage/${personId}/${typId}`);
  const hier = $derived(`${basis}/version/${versionId}/seiten`);
  const istAktuell = $derived(
    !!u && !!v && !u.typ.serie && aktuelleVersionen(u.versionen).some((x) => x.id === v.id),
  );
  const zurueck = $derived(istAktuell ? basis : `${basis}/version/${versionId}`);

  let dokument = $state.raw<PdfDokument | null>(null);
  let bilder = $state<Record<number, string>>({});
  const dateiId = $derived(v ? dateiVon(v) : null);
  $effect(() => {
    const id = dateiId;
    if (!id) return;
    let vorbei = false;
    let dok: PdfDokument | null = null;
    const urls: string[] = [];
    void (async () => {
      try {
        const datei = await dateiLesen(await db(), id);
        if (!datei || vorbei) return;
        dok = await pdfOeffnen(new Uint8Array(await datei.arrayBuffer()));
        if (vorbei) return void pdfSchliessen(dok);
        dokument = dok;
        bilder = {};
        for (let n = 1; n <= dok.numPages && !vorbei; n++) {
          const url = await miniatur(dok, n, 120);
          if (vorbei) return URL.revokeObjectURL(url);
          urls.push(url);
          bilder[n - 1] = url;
        }
      } catch {
        // Seite verlassen oder Datei nicht lesbar: Die Liste bleibt ohne Bilder benutzbar.
      }
    })();
    return () => {
      vorbei = true;
      dokument = null;
      urls.forEach((url) => URL.revokeObjectURL(url));
      if (dok) void pdfSchliessen(dok);
    };
  });

  const eigene = $derived(v && dokument ? eigeneSeiten(v, dokument.numPages, alle) : []);
  const inMappe = $derived(v ? eigene.filter((s) => kommtInMappe(v, s)).length : 0);
  const unterlage = $derived(
    u && v
      ? `${ohneTrennstellen(eintragenText(u.typ) || listenText(u.typ))} ${
          v.abrechnungsmonat
            ? monatJahr(v.abrechnungsmonat)
            : v.ausstellungsdatum
              ? t('seiten.vom', { datum: tagKurz(v.ausstellungsdatum) })
              : t('seiten.ohneDatum')
        }`
      : '',
  );

  // Groß ansehen
  let grossOffen = $state(false);
  let grossIndex = $state(0);
  const grosse = $derived(
    dokument
      ? eigene.map((s) => ({ dokument: dokument!, nummer: s + 1, schluessel: String(s) }))
      : [],
  );

  // Blatt zu einer Seite
  let blatt = $state<number | null>(null);
  let blattOffen = $state(false);
  let schritt = $state<'aktionen' | 'wohin' | 'person'>('aktionen');
  let zielPerson = $state<string | null>(null);
  let andererMonat = $state('');
  let zahlen = $state<Record<string, number | null>>({});

  function oeffnen(seite: number) {
    blatt = seite;
    schritt = 'aktionen';
    zielPerson = null;
    andererMonat = '';
    blattOffen = true;
  }

  const seitenName = (seite: number) => t('aufteilen.seite', { nummer: seite + 1 });
  function nameVon(id: string): string {
    const m = daten.ansicht?.mitglieder.find((x) => x.person.id === id);
    return m ? m.person.rufname || m.person.vorname : '';
  }

  function anbieten(text: string, stand: VersionenStand, seite: string) {
    rueckgaengigAnbieten({
      text,
      seite,
      ausfuehren: async () => {
        await versionenZurueck(await db(), stand);
        await neuLaden();
      },
    });
  }

  async function umschaltenRoh(seite: number) {
    if (!v) return;
    await versionenAendern(await db(), { schreiben: [seiteUmschalten(v, eigene, seite)] });
    blattOffen = false;
    await neuLaden();
  }
  const umschalten = einmal(umschaltenRoh);

  async function loeschenRoh(seite: number) {
    if (!v) return;
    const titel = versionTitel(v);
    const rest = seiteHeraus(v, eigene, seite);
    const stand = await versionenAendern(await db(), {
      schreiben: rest ? [rest] : [],
      loeschen: rest ? [] : [v.id],
    });
    blattOffen = false;
    await neuLaden();
    // Keine Seite mehr: Die Version ist weg, es geht zurück zur Unterlage.
    if (!rest) abschliessen(basis);
    anbieten(
      rest
        ? t('seiten.geloescht', { seite: seitenName(seite) })
        : t('unterlage.geloescht', { titel }),
      stand,
      rest ? hier : basis,
    );
  }
  const loeschen = einmal(loeschenRoh);

  async function verschiebenRoh(ziel: VerschiebeZiel) {
    if (!v || blatt === null) return;
    const seite = blatt;
    const stand = await seiteVerschieben(v, eigene, seite, ziel, alle);
    const wohin =
      ziel.art === 'version'
        ? versionTitel(ziel.version)
        : ziel.art === 'monat'
          ? monatJahr(ziel.monat)
          : ziel.personId === personId
            ? ohneTrennstellen(listenText(ziel.typ))
            : `${nameVon(ziel.personId)}: ${ohneTrennstellen(listenText(ziel.typ))}`;
    blattOffen = false;
    await neuLaden();
    // Zurück in die Liste: Dort sieht man, wo die Seite jetzt liegt.
    abschliessen(basis);
    anbieten(t('seiten.verschoben', { seite: seitenName(seite), ziel: wohin }), stand, basis);
  }
  const verschieben = einmal(verschiebenRoh);

  // Wohin? Andere Monate bzw. Versionen, andere Unterlagen, andere Personen.
  const andereVersionen = $derived(
    u
      ? u.versionen
          .filter((x) => x.id !== versionId)
          .slice()
          .sort(neuesteZuerst)
      : [],
  );
  function neuesteZuerst(a: DateiVersion, b: DateiVersion) {
    return (b.abrechnungsmonat ?? b.createdAt).localeCompare(a.abrechnungsmonat ?? a.createdAt);
  }
  $effect(() => {
    if (schritt !== 'wohin') return;
    for (const x of andereVersionen) {
      if (x.id in zahlen) continue;
      zahlen[x.id] = null;
      void seitenZahl(x).then((anzahl) => (zahlen[x.id] = anzahl));
    }
  });
  const andereUnterlagen = (personenId: string, ohne?: string) =>
    (staende.find((s) => s.person.id === personenId)?.unterlagen ?? []).filter(
      (x) => !x.typ.inAppErstellt && x.typ.id !== ohne,
    );
  // Der Stand folgt dem Etikett wie in der Personenansicht: „Fehlt noch“ nur bei „Üblich“ (OR6).
  function zielStand(x: UnterlagenStand): string {
    if (x.versionen.length) return t('seiten.alsNeue');
    if (x.typ.etikett === 'ueblich') return t('person.standFehlt');
    return x.typ.etikett === 'kann_helfen'
      ? t('seiten.nochNichtDabei')
      : t('seiten.nochNichtGespeichert');
  }
  const anderePersonen = $derived(staende.filter((s) => s.person.id !== personId));
  const personZiel = $derived(staende.find((s) => s.person.id === zielPerson) ?? null);
  const zielUnterlagen = $derived(zielPerson ? andereUnterlagen(zielPerson) : []);
  const unterlageWahl = (typ: Dokumenttyp, personenId: string) =>
    verschieben({ art: 'unterlage', personId: personenId, typ });
</script>

{#snippet zeileZiel(
  titel: string,
  sub: string,
  klick: () => void,
  marke?: string,
  sofort?: boolean,
)}
  <li>
    <button type="button" class="ziel" onclick={klick}>
      {#if marke}<span class="monat" aria-hidden="true">{marke}</span>{/if}
      <span class="tx"
        ><b>{titel}</b>{#if sub}<small>{sub}</small>{/if}</span
      >
      <!-- Der Pfeil sagt: Hier kommt noch ein Schritt. Was sofort wirkt, hat keinen (OR5). -->
      {#if !sofort}<Symbol name="weiter" groesse={18} />{/if}
    </button>
  </li>
{/snippet}

<main class="seite">
  <div class="kopf">
    <Zurueck href="#{zurueck}" text={v ? versionTitel(v) : t('person.zurueck')} />
  </div>
  {#if !u || !v}
    <p class="leer">{t('person.nichtGefunden')}</p>
  {:else}
    <div class="titelblock">
      <h1 class="display">{t('seiten.titel')}</h1>
      <p class="lead">
        {t('seiten.lead', { unterlage, name })}
        {#if eigene.length === 1}{t('seiten.standEine')}{:else if eigene.length}{t('seiten.stand', {
            drin: inMappe,
            gesamt: eigene.length,
          })}{/if}
      </p>
    </div>
    <ul class="liste">
      {#each eigene as seite, i (seite)}
        {@const drin = kommtInMappe(v, seite)}
        <li>
          <WischZeile beimLoeschen={() => loeschen(seite)}>
            <div class="zeile" class:aus={!drin}>
              <button
                type="button"
                class="gross"
                aria-label={t('seiten.grossAnsehen', { nummer: seite + 1 })}
                onclick={() => {
                  grossIndex = i;
                  grossOffen = true;
                }}
              >
                {#if bilder[seite]}<img src={bilder[seite]} alt="" />{:else}<span class="platz"
                  ></span>{/if}
              </button>
              <span class="tx">
                <b>{seitenName(seite)}</b>
                <small>{drin ? t('seiten.kommtRein') : t('seiten.nichtDrin')}</small>
              </span>
              <button
                type="button"
                class="mehr"
                aria-label={t('seiten.aktionen', { nummer: seite + 1 })}
                onclick={() => oeffnen(seite)}
              >
                <span aria-hidden="true">⋯</span>
              </button>
            </div>
          </WischZeile>
        </li>
      {/each}
    </ul>
    <p class="klein">{t('seiten.tipp')}</p>
  {/if}
</main>

{#if v && u}
  <Aktionsleiste text={t('allgemein.fertig')} onclick={() => zurueckGehen(zurueck)} />
{/if}

{#if v && u && blatt !== null}
  <Sheet
    bind:offen={blattOffen}
    titel={schritt === 'aktionen'
      ? seitenName(blatt)
      : t('seiten.wohin', { seite: seitenName(blatt) })}
    kreuz
    titelFokus
  >
    {#if schritt === 'aktionen'}
      <p class="unter">{unterlage}</p>
      <ul class="aktionen">
        {#if kommtInMappe(v, blatt)}
          {#if letzteInMappe(v, eigene, blatt)}
            <li class="still">{t('seiten.letzteInMappe')}</li>
          {:else}
            {@render zeileZiel(
              t('seiten.nichtInMappe'),
              t('seiten.bleibtHier'),
              () => umschalten(blatt!),
              undefined,
              true,
            )}
          {/if}
        {:else}
          {@render zeileZiel(
            t('seiten.inMappe'),
            t('seiten.kommtRein'),
            () => umschalten(blatt!),
            undefined,
            true,
          )}
        {/if}
        {@render zeileZiel(t('seiten.verschieben'), t('seiten.verschiebenSatz'), () => {
          schritt = 'wohin';
        })}
        {@render zeileZiel(
          t('allgemein.loeschen'),
          t('seiten.nurKopie'),
          () => loeschen(blatt!),
          undefined,
          true,
        )}
      </ul>
    {:else if schritt === 'wohin'}
      <p class="unter">{t('seiten.lead', { unterlage, name })}</p>
      {#if andereVersionen.length || u.typ.serie}
        <h2>
          {t('seiten.gruppeGleich', { unterlage: ohneTrennstellen(listenText(u.typ)), name })}
        </h2>
        <ul class="aktionen">
          {#each andereVersionen as x (x.id)}
            {@render zeileZiel(
              versionTitel(x),
              zahlen[x.id] ? t('unterlage.seitenZahl', { anzahl: zahlen[x.id]! }) : '',
              () => verschieben({ art: 'version', version: x }),
              x.abrechnungsmonat ? monatKuerzel(x.abrechnungsmonat) : undefined,
            )}
          {/each}
          {#if u.typ.serie}
            <li>
              <label class="eingabe monat-feld">
                {t('seiten.andererMonat')}
                <input type="month" bind:value={andererMonat} max={monatAus(new Date())} />
              </label>
              {#if andererMonat}
                <button
                  type="button"
                  class="textlink"
                  onclick={() => verschieben({ art: 'monat', monat: andererMonat })}
                  >{t('seiten.dorthin')}</button
                >
              {/if}
            </li>
          {/if}
        </ul>
      {/if}
      {#if andereUnterlagen(personId, typId).length}
        <h2>{t('seiten.gruppeAndere', { name })}</h2>
        <ul class="aktionen">
          {#each andereUnterlagen(personId, typId) as x (x.typ.id)}
            {@render zeileZiel(ohneTrennstellen(listenText(x.typ)), zielStand(x), () =>
              unterlageWahl(x.typ, personId),
            )}
          {/each}
        </ul>
      {/if}
      {#if anderePersonen.length}
        <h2>{t('seiten.gruppePerson')}</h2>
        <ul class="aktionen">
          {#each anderePersonen as s (s.person.id)}
            {@render zeileZiel(
              s.person.rufname || s.person.vorname,
              rollenText(s.rolle, s.bezeichnung),
              () => {
                zielPerson = s.person.id;
                schritt = 'person';
              },
            )}
          {/each}
        </ul>
      {/if}
    {:else if personZiel}
      <h2>
        {t('seiten.unterlageVon', { name: personZiel.person.rufname || personZiel.person.vorname })}
      </h2>
      <ul class="aktionen">
        {#each zielUnterlagen as x (x.typ.id)}
          {@render zeileZiel(ohneTrennstellen(listenText(x.typ)), zielStand(x), () =>
            unterlageWahl(x.typ, personZiel!.person.id),
          )}
        {/each}
      </ul>
    {/if}
  </Sheet>
{/if}

{#if grosse.length}
  <SeitenAnsicht bind:offen={grossOffen} seiten={grosse} bind:index={grossIndex} />
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
  .leer {
    padding: 0 var(--space-5);
  }

  .titelblock {
    margin-top: 10px;
  }

  .liste {
    margin: 18px var(--space-4) 0;
    padding: 0;
    overflow: hidden;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
  }

  .liste li + li {
    border-top: 1px solid var(--line);
  }

  .zeile {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 96px;
    padding: 10px 12px 10px 16px;
  }

  .gross {
    flex-shrink: 0;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }

  img,
  .platz {
    display: block;
    width: 56px;
    height: 76px;
    border-radius: 5px;
    background: #fff;
    box-shadow: 0 1px 3px rgba(25, 26, 44, 0.22);
    object-fit: contain;
  }

  .aus img,
  .aus .platz {
    opacity: 0.45;
  }

  .tx {
    flex: 1 1 110px;
    min-width: 0;
  }

  .tx b {
    display: block;
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .aus .tx b {
    color: var(--ink-muted);
  }

  .tx small {
    display: block;
    margin-top: 2px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  .mehr {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 22px;
    background: none;
    color: inherit;
    font-size: 22px;
    font-weight: 800;
    cursor: pointer;
  }

  .klein {
    margin: 10px var(--space-5) 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  .unter {
    margin: 4px 0 0;
    color: var(--ink-muted);
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
  }

  h2 {
    margin: 20px 0 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    font-weight: 800;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }

  .aktionen {
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
  }

  .aktionen li + li {
    border-top: 1px solid var(--line);
  }

  .still {
    padding: 12px 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }

  .ziel {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 12px;
    min-height: 56px;
    padding: 8px 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .monat {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--track);
    font-size: calc(12 * var(--px));
    font-weight: 800;
  }

  .monat-feld {
    display: block;
    padding: 10px 0;
  }
</style>
