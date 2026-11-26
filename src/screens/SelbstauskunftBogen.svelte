<script lang="ts">
  // E111 „Der Bogen selbst“ (DP134; PC205, Abschnitt 2; PC208, Schritt 4): die Selbstauskunft im Browser, ohne Haushalt.
  // Ein Blatt je Person im Mietvertrag, mit Reitern; HAUSHALT ist in allen Bögen gleich, mit dem Wohnberechtigungsschein
  // (W28). Was man einträgt, bleibt in diesem Browser (W11), bis man es löscht oder in einen Haushalt übernimmt (E366).
  // Das PDF ist der Bogen der App ohne Rolle, Lebenslage und Frage 3 (DP134, Abschnitt 4).
  import { onMount, tick } from 'svelte';
  import { daten, neuLaden, db } from '../app/daten.svelte';
  import { gehe } from '../app/router.svelte';
  import {
    bogenFarbe,
    fehltImBogen,
    fehltSatz,
    leerePerson,
    leereSelbstauskuenfte,
    nameVon,
    personAusBogen,
    type SelbstauskunftBoegen,
  } from '../domain/bogen';
  import { neueId } from '../domain/modell';
  import BogenAbschnitt from '../formblatt/bogen/BogenAbschnitt.svelte';
  import BogenAnschrift from '../formblatt/bogen/BogenAnschrift.svelte';
  import BogenBlatt from '../formblatt/bogen/BogenBlatt.svelte';
  import BogenFeld from '../formblatt/bogen/BogenFeld.svelte';
  import BogenJaNein from '../formblatt/bogen/BogenJaNein.svelte';
  import BogenSeite from '../formblatt/bogen/BogenSeite.svelte';
  import BogenZaehler from '../formblatt/bogen/BogenZaehler.svelte';
  import { t } from '../i18n';
  import {
    einstellungenAendern,
    haushaltAendern,
    haushaltAnlegen,
    personAendern,
  } from '../storage/speicher';
  import { boegenLaden, boegenSetzen } from '../ui/boegenSpeicher';
  import { bogenZurueck } from '../ui/bogenZurueck';

  let b = $state<SelbstauskunftBoegen | null>(null);
  let aktiv = $state(0);
  let breit = $state(false);
  let letzter = '';

  onMount(() => {
    const m = matchMedia('(min-width: 2400px)');
    breit = m.matches;
    const wechsel = () => (breit = m.matches);
    m.addEventListener('change', wechsel);
    void boegenLaden().then((g) => {
      b = g.selbstauskunft ?? leereSelbstauskuenfte(neueId());
      letzter = JSON.stringify(b);
    });
    return () => m.removeEventListener('change', wechsel);
  });

  // Sofort speichern, wie in der App, nur hier im Browser.
  let zeitgeber: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const jetzt = JSON.stringify(b);
    if (!b || jetzt === letzter) return;
    clearTimeout(zeitgeber);
    zeitgeber = setTimeout(() => {
      letzter = jetzt;
      void boegenSetzen('selbstauskunft', $state.snapshot(b) as SelbstauskunftBoegen);
    }, 400);
    return () => clearTimeout(zeitgeber);
  });

  const mehr = $derived((b?.personen.length ?? 0) > 1);
  const paar = $derived(mehr && breit);
  const du = $derived(!mehr);
  const grund = $derived(b ? fehltSatz(b) : null);
  const zurueck = bogenZurueck();

  function personDazu() {
    if (!b) return;
    b.personen.push(leerePerson(neueId(), bogenFarbe(b.personen.map((p) => p.farbe))));
    b.hh.erwachsene = Math.max(b.hh.erwachsene, b.personen.length);
    aktiv = b.personen.length - 1;
    void tick().then(() =>
      document.querySelector<HTMLInputElement>('section.blatt input')?.focus(),
    );
  }

  function personWeg(i: number) {
    if (!b || b.personen.length < 2) return;
    b.personen.splice(i, 1);
    aktiv = Math.min(aktiv, b.personen.length - 1);
  }

  let baut = $state(false);
  let fehler = $state(false);
  async function pdfErstellen() {
    if (!b) return;
    if (grund) {
      const i = b.personen.findIndex((p) => fehltImBogen(p).length);
      aktiv = Math.max(0, i);
      await tick();
      const blatt = document.querySelectorAll<HTMLElement>('section.blatt')[paar ? i : 0];
      const leer = [...(blatt?.querySelectorAll<HTMLInputElement>('input') ?? [])].find(
        (x) => !x.value.trim(),
      );
      (leer ?? blatt?.querySelector<HTMLElement>('[role="radio"]'))?.focus();
      return;
    }
    baut = true;
    fehler = false;
    try {
      const [{ bogenPdfBauen }, { pdfSchriftenLaden }, { teilen }] = await Promise.all([
        import('../pdf/bogenPdf'),
        import('../pdf/schriften'),
        import('../ui/mappeErstellen'),
      ]);
      const dateien = await bogenPdfBauen(
        $state.snapshot(b) as SelbstauskunftBoegen,
        await pdfSchriftenLaden(),
      );
      await teilen(
        dateien.map((d) => new File([d.bytes.slice()], d.name, { type: 'application/pdf' })),
      );
    } catch {
      fehler = true;
    } finally {
      baut = false;
    }
  }

  // ---------- Übernehmen (E366): die erste Person wird Ansprechperson ----------
  let uebernehmenOffen = $state(false);
  async function uebernehmen() {
    if (!b) return;
    const s = $state.snapshot(b) as SelbstauskunftBoegen;
    const verbindung = await db();
    const haushalt = await haushaltAnlegen(verbindung, {
      kinder: s.hh.kinder,
      weitereErwachsene: Math.max(0, s.hh.erwachsene - s.personen.length),
      personen: s.personen.map((p) => ({
        farbe: p.farbe,
        vorname: p.vorname.trim(),
        nachname: p.nachname.trim(),
        bezeichnung: 'neutral',
        rolle: 'vertrag',
        lebenssituation: null,
      })),
    });
    const zuege = (await verbindung.getAll('zugehoerigkeiten'))
      .filter((z) => z.haushaltId === haushalt.id)
      .sort((x, y) => x.reihenfolge - y.reihenfolge);
    const jetzt = new Date().toISOString();
    for (const [i, z] of zuege.entries()) {
      const p = personAusBogen(s.personen[i]!, s.hh, jetzt);
      await personAendern(verbindung, z.personId, {
        kontakt: p.kontakt,
        beruf: p.beruf,
        arbeitgeber: p.arbeitgeber,
        nettoeinkommen: p.nettoeinkommen,
        selbstauskunft: p.selbstauskunft!,
      });
    }
    await haushaltAendern(verbindung, haushalt.id, {
      haustiere: s.hh.haustiere,
      ort: s.hh.ort.trim(),
      ...(s.hh.wbs ? { wbsAngabe: s.hh.wbs } : {}),
    });
    await einstellungenAendern(verbindung, { aktiverHaushalt: haushalt.id });
    await boegenSetzen('selbstauskunft', undefined);
    letzter = JSON.stringify(null);
    await neuLaden();
    gehe('/');
  }

  let loeschenFrage = $state(false);
  async function allesLoeschen() {
    await boegenSetzen('selbstauskunft', undefined);
    b = leereSelbstauskuenfte(neueId());
    letzter = JSON.stringify(b);
    aktiv = 0;
    loeschenFrage = false;
    window.scrollTo(0, 0);
  }

  const erste = $derived(b?.personen[0]?.vorname.trim() ?? '');
</script>

{#snippet lasche(i: number, ausgewaehlt: boolean)}
  {@const p = b!.personen[i]!}
  <button
    type="button"
    class="lasche"
    role="tab"
    aria-selected={ausgewaehlt}
    onclick={() => (aktiv = i)}
  >
    <span class="zeichen" style:background="var(--person-{p.farbe})" aria-hidden="true"
      >{(p.vorname.trim() || '?')[0]}</span
    ><b>{p.vorname.trim() || t('bogen.neuePerson')}</b>
  </button>
{/snippet}

{#snippet blatt(i: number)}
  {@const p = b!.personen[i]!}
  <BogenBlatt
    titel={t('bogen.selbstauskunftVon')}
    bind:vorname={p.vorname}
    bind:nachname={p.nachname}
    satz={t('bogen.satzName')}
    name={t('bogen.blattName', { name: nameVon(p) || t('bogen.neu') })}
  >
    {#snippet reiter()}
      {#if mehr}
        <div class="reiter" role="tablist" aria-label={t('bogen.boegen')}>
          {#if paar}
            {@render lasche(i, true)}
          {:else}
            {#each b!.personen as q, k (q.id)}{@render lasche(k, k === aktiv)}{/each}
          {/if}
          {#if !paar || i === b!.personen.length - 1}
            <button type="button" class="lasche neu" onclick={personDazu}
              >{t('bogen.plusPerson')}</button
            >
          {/if}
        </div>
      {/if}
    {/snippet}
    <BogenAbschnitt titel={t('bogen.zurPerson')} />
    <BogenAnschrift bind:anschrift={p.anschrift} />
    <BogenFeld
      etikett={t('selbstauskunft.telefon')}
      bind:wert={p.telefon}
      feld={{ inputmode: 'tel', autocomplete: 'tel' }}
    />
    <BogenFeld
      etikett={t('selbstauskunft.email')}
      bind:wert={p.email}
      satz={t('bogen.satzKontakt')}
      feld={{ inputmode: 'email', autocomplete: 'email' }}
    />
    <BogenAbschnitt titel={t('bogen.berufEinkommen')} />
    <div class="zwei text">
      <div><BogenFeld etikett={t('bogen.beruf')} bind:wert={p.beruf} /></div>
      <div><BogenFeld etikett={t('bogen.arbeitgeber')} bind:wert={p.arbeitgeber} /></div>
    </div>
    <p class="satz w30" data-w30="gruppe">{t('bogen.satzBeruf')}</p>
    <BogenFeld
      etikett={t('bogen.netto')}
      bind:wert={p.netto}
      satz={t('bogen.satzNetto')}
      feld={{ inputmode: 'decimal' }}
    />
    <BogenAbschnitt titel={t('bogen.fragen')} />
    <BogenJaNein
      frage={!mehr
        ? t('bogen.frage1')
        : p.vorname.trim()
          ? t('bogen.frage1Name', { name: p.vorname.trim() })
          : t('bogen.frage1Ohne')}
      name={t('bogen.frage1Gruppe')}
      bind:wert={p.insolvenz}
    />
    <BogenJaNein
      frage={!mehr
        ? t('bogen.frage2')
        : p.vorname.trim()
          ? t('bogen.frage2Name', { name: p.vorname.trim() })
          : t('bogen.frage2Ohne')}
      name={t('bogen.frage2Gruppe')}
      bind:wert={p.raeumungstitel}
    />
    <p class="satz w30" data-w30="gruppe">{t('bogen.satzInsolvenz')}</p>
    <p class="spaeter">{t('bogen.frage3')}</p>
    <BogenAbschnitt titel={t('bogen.haushalt')} gleich={mehr ? t('bogen.gleich') : undefined} />
    <p class="l">{t('bogen.werEinzieht')}</p>
    <div class="zwei">
      <BogenZaehler
        etikett={t('bogen.erwachsene')}
        bind:wert={b!.hh.erwachsene}
        min={b!.personen.length}
      />
      <BogenZaehler etikett={t('bogen.kinder')} bind:wert={b!.hh.kinder} />
    </div>
    <p class="satz w30" data-w30="gruppe">{t('angabeSatz.einziehen')}</p>
    <BogenJaNein
      frage={du ? t('bogen.haustiereDu') : t('bogen.haustiereIhr')}
      name={t('bogen.haustiere')}
      bind:wert={b!.hh.haustiere}
    />
    <p class="satz w30" data-w30="frage">{t('angabeSatz.haustiere')}</p>
    <BogenJaNein frage={t('bogen.wbs')} name={t('bogen.wbsGruppe')} bind:wert={b!.hh.wbs} fett />
    <p class="satz w30" data-w30="frage">{t('bogen.satzWbs')}</p>
    <BogenFeld
      etikett={t('bogen.ortUnterschrift')}
      bind:wert={b!.hh.ort}
      feld={{ placeholder: t('bogen.ort') }}
    />
    <p class="unterschrift"><span class="linie" aria-hidden="true"></span>{t('bogen.ortDatum')}</p>
    {#if mehr}
      <button type="button" class="leise weg" onclick={() => personWeg(i)}
        >{p.vorname.trim()
          ? t('bogen.bogenWeg', { name: p.vorname.trim() })
          : t('bogen.bogenWegOhne')}</button
      >
    {/if}
  </BogenBlatt>
{/snippet}

{#snippet wahl()}
  {#if mehr && b}
    <h2 class="kopf">{t('bogen.alsPdf')}</h2>
    <div class="wahl" role="radiogroup" aria-label={t('bogen.alsPdfName')}>
      <button
        type="button"
        role="radio"
        aria-checked={b.pdf === 'eine'}
        onclick={() => (b!.pdf = 'eine')}
      >
        <span class="stapel" aria-hidden="true"
          ><i style="left:8px;top:0"></i><i style="left:2px;top:6px"></i></span
        >
        <span
          ><b>{t('bogen.eine')}</b><span>{t('bogen.eineSatz', { anzahl: b.personen.length })}</span
          ></span
        >
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={b.pdf === 'je'}
        onclick={() => (b!.pdf = 'je')}
      >
        <span class="stapel" aria-hidden="true"
          ><i style="left:0;top:4px;width:18px;height:26px"></i><i
            style="left:22px;top:4px;width:18px;height:26px"
          ></i></span
        >
        <span
          ><b>{t('bogen.je')}</b><span>{t('bogen.jeSatz', { anzahl: b.personen.length })}</span
          ></span
        >
      </button>
    </div>
  {/if}
{/snippet}

{#snippet stand()}
  {#if b}
    <h2 class="kopf">{mehr ? t('bogen.boegenKopf') : t('bogen.bogenKopf')}</h2>
    <ul class="stand">
      {#each b.personen as p (p.id)}
        {@const n = fehltImBogen(p).length}
        <li>
          <span class="zeichen" style:background="var(--person-{p.farbe})" aria-hidden="true"
            >{(p.vorname.trim() || '?')[0]}</span
          >
          <span class="t"
            ><b>{nameVon(p) || t('bogen.ohneNamen')}</b><span class="u"
              >{n ? t('bogen.offen', { anzahl: n }) : t('bogen.fertigSeite')}</span
            ></span
          >
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

{#snippet uebernahme()}
  {#if b && !grund}
    <h2 class="kopf">{t('bogen.ganzeBewerbungen')}</h2>
    <div class="karte">
      <b>{t('bogen.uebernehmenTitel')}</b>
      <p class="satz gross">{t('bogen.uebernehmenSatz')}</p>
      {#if uebernehmenOffen}
        <div class="kasten">
          <b>{mehr ? t('bogen.wennIhr') : t('bogen.wennDu')}</b>
          <ul>
            <li>
              {mehr
                ? t('bogen.imVertragMehr', {
                    namen: b.personen.map((p) => p.vorname.trim()).join(' und '),
                    erste,
                  })
                : t('bogen.imVertragEine', { name: erste })}
            </li>
            {#if b.hh.kinder}<li>{t('bogen.kinderZiehen', { anzahl: b.hh.kinder })}</li>{/if}
            {#if b.hh.wbs === 'ja'}<li>{t('bogen.wbsKommt')}</li>{/if}
            <li>{mehr ? t('bogen.gehenMitMehr') : t('bogen.gehtMit')}</li>
            <!-- DP145, F3: Gibt es schon einen Haushalt, sagt ein Satz, dass er bleibt (W10). -->
            {#if daten.ansicht}<li>
                {mehr ? t('bogen.neuerHaushaltIhr') : t('bogen.neuerHaushaltDu')}
              </li>{/if}
          </ul>
        </div>
        <div class="knoepfe">
          <button type="button" class="zweit" onclick={() => void uebernehmen()}
            >{t('bogen.uebernehmen')}</button
          >
          <button type="button" class="leise" onclick={() => (uebernehmenOffen = false)}
            >{t('allgemein.abbrechen')}</button
          >
        </div>
      {:else}
        <div class="knoepfe">
          <button type="button" class="zweit" onclick={() => (uebernehmenOffen = true)}
            >{t('bogen.haushaltAnlegen')}</button
          >
        </div>
      {/if}
    </div>
  {/if}
  {#if b}
    <p class="satz bleibt">{du ? t('bogen.bleibtDu') : t('bogen.bleibtIhr')}</p>
    {#if loeschenFrage}
      <p class="satz">{t('bogen.loeschenFrage')}</p>
      <div class="knoepfe">
        <button type="button" class="zweit" onclick={() => void allesLoeschen()}
          >{t('selbstauskunft.loeschen')}</button
        >
        <button type="button" class="leise" onclick={() => (loeschenFrage = false)}
          >{t('allgemein.abbrechen')}</button
        >
      </div>
    {:else}
      <button type="button" class="leise" onclick={() => (loeschenFrage = true)}
        >{t('bogen.allesLoeschen')}</button
      >
    {/if}
  {/if}
{/snippet}

{#if b}
  <BogenSeite
    titel={t('selbstauskunft.titel')}
    satz={du ? t('bogen.subDu') : t('bogen.subIhr')}
    {zurueck}
    {paar}
    haupt={{
      text: t('buergschaft.erstellen'),
      unterzeile: !mehr
        ? t('bogen.eineSeite')
        : b.pdf === 'eine'
          ? t('bogen.eineDatei', { anzahl: b.personen.length })
          : t('bogen.jeDatei', { anzahl: b.personen.length }),
      grund,
      onclick: () => void pdfErstellen(),
    }}
  >
    {#if paar}
      <div class="bogen-reihe">
        {#each b.personen as p, i (p.id)}<div class="blatt-huelle">{@render blatt(i)}</div>{/each}
      </div>
    {:else}
      <div class="aktiv-blatt">{@render blatt(mehr ? aktiv : 0)}</div>
      {#if !mehr}
        <button type="button" class="darunter" onclick={personDazu}>
          <b>{t('bogen.weiterePerson')}</b><span>{t('bogen.weiterePersonSatz')}</span>
        </button>
      {:else}
        <div class="nachher" aria-hidden="true"></div>
      {/if}
    {/if}
    {#if baut}<p class="satz" role="status">{t('buergschaft.baut')}</p>{/if}
    {#if fehler}<p class="satz" role="alert">{t('buergschaft.fehlerBau')}</p>{/if}
    {#snippet unten()}{@render wahl()}{@render uebernahme()}{/snippet}
    {#snippet pult()}{@render stand()}{@render wahl()}{/snippet}
    {#snippet pultUnten()}{@render uebernahme()}{/snippet}
  </BogenSeite>
{/if}

<style>
  .reiter {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 24px;
    align-items: flex-end;
  }

  .lasche {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    max-width: 100%;
    padding: 4px 16px 4px 8px;
    border: 0;
    border-radius: 16px 16px 0 0;
    background: var(--track);
    color: var(--ink);
    font: inherit;
    font-weight: 700;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    cursor: pointer;
  }

  .lasche[aria-selected='true'] {
    background: var(--surface);
    box-shadow: 0 -1px 0 var(--line-strong);
  }

  .lasche.neu {
    border: 1.5px dashed var(--line-strong);
    border-bottom: 0;
    background: none;
    color: var(--ink-muted);
    padding-left: 16px;
  }

  .lasche b {
    min-width: 0;
    overflow-wrap: break-word;
  }

  .lasche:focus-visible,
  .darunter:focus-visible,
  .wahl button:focus-visible,
  .zweit:focus-visible,
  .leise:focus-visible {
    outline: none;
    box-shadow: 0 3px 0 0 var(--ink);
  }

  .zeichen {
    display: grid;
    flex: none;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    color: #26221e;
    font-size: calc(13 * var(--px));
    font-weight: 700;
  }

  .zwei {
    display: flex;
    flex-wrap: wrap;
    gap: 0 16px;
  }

  .zwei > :global(*) {
    flex: 1 1 calc(120 * var(--px));
    min-width: 0;
  }

  /* DP145, B7: Unter 480 px stehen Beruf und Arbeitgeber untereinander; nebeneinander schnitten lange Namen ab. */
  @media (max-width: 479px) {
    .zwei.text {
      flex-direction: column;
    }
  }

  .satz {
    margin: 4px 0 0;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }

  .satz.gross {
    font-size: calc(15 * var(--px));
  }

  .l {
    margin: 16px 0 8px;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 700;
    color: var(--ink-muted);
  }

  .spaeter {
    margin: 0;
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }

  .unterschrift {
    width: min(240px, 100%);
    margin: 48px 0 0;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }

  .linie {
    display: block;
    border-top: 1px solid var(--ink);
    margin-bottom: 4px;
  }

  .weg {
    margin-top: 16px;
  }

  .darunter {
    display: block;
    width: 100%;
    margin-top: -4px;
    padding: 16px;
    border: 0;
    border-radius: 0 0 6px 6px;
    background: var(--track);
    color: var(--ink);
    text-align: left;
    font: inherit;
    cursor: pointer;
  }

  .darunter b {
    display: block;
  }

  .darunter span {
    display: block;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }

  .nachher {
    height: 8px;
    margin: 16px 8px 0;
    border-radius: 0 0 6px 6px;
    background: var(--surface);
  }

  .kopf {
    margin: 24px 0 0;
    font-size: calc(12 * var(--px));
    line-height: calc(16 * var(--px));
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--ink-muted);
    text-transform: uppercase;
  }

  .wahl {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }

  .wahl button {
    display: flex;
    align-items: center;
    gap: 16px;
    min-height: 72px;
    padding: 12px 16px;
    border: 1.5px solid transparent;
    border-radius: 20px;
    background: var(--surface);
    color: var(--ink);
    text-align: left;
    font: inherit;
    cursor: pointer;
  }

  .wahl button[aria-checked='true'] {
    border-color: var(--ink);
  }

  .wahl b {
    display: block;
  }

  .wahl span span {
    display: block;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }

  .stapel {
    position: relative;
    flex: none;
    width: 40px;
    height: 44px;
  }

  .stapel i {
    position: absolute;
    width: 28px;
    height: 36px;
    border: 1.5px solid var(--ink);
    border-radius: 4px;
    background: var(--surface);
  }

  .stand {
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
    border-radius: 20px;
    background: var(--surface);
  }

  .stand li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 8px 16px;
  }

  .stand li + li {
    border-top: 1px solid var(--line);
  }

  .stand .t {
    flex: 1;
    min-width: 0;
  }

  .stand b {
    display: block;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    overflow-wrap: break-word;
  }

  .stand .u {
    display: block;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }

  .karte {
    margin-top: 12px;
    padding: 16px;
    border-radius: 20px;
    background: var(--surface);
  }

  .kasten {
    margin-top: 12px;
    padding: 16px;
    border-radius: 20px;
    background: var(--track);
  }

  .kasten ul {
    margin: 8px 0 0;
    padding-left: 20px;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .kasten li + li {
    margin-top: 4px;
  }

  .knoepfe {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: center;
    margin-top: 16px;
  }

  .zweit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 20px;
    border: 1.5px solid var(--ink);
    border-radius: 999px;
    background: none;
    color: var(--ink);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .leise {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink-muted);
    font: inherit;
    font-size: calc(15 * var(--px));
    text-decoration: underline;
    text-underline-offset: 4px;
    cursor: pointer;
  }

  .bleibt {
    margin-top: 16px;
  }
</style>
