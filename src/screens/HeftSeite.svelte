<script lang="ts">
  import { route } from '../app/router.svelte';
  import { wechselArt } from '../ui/wechsel';
  import { haushaltsNetto } from '../domain/netto';
  // Ein Heft (B21 Fassung 4), erster Stand: Umschlag mit Titel, Adresse,
  // Eckdaten und Quelle, die Leiste „Stand x von 4“, die Besichtigung, Notizen und der Abgleich mit den
  // Wünschen. Fragen für die Besichtigung, Fotos und „Was hinausging“ kommen mit Schritt 8 und 9.
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { istApp } from '../app/plattform';
  import { erinnerungenMoeglich, mitteilungen } from '../app/erinnerungen.svelte';
  import { eckdaten, heftAdresseKurz, heftTitel, tagKurz, terminKurz } from '../domain/heftKarte';
  import {
    ergebnisSetzen,
    hervorholen,
    stand,
    standFragen,
    standNummer,
    terminVorbei,
  } from '../domain/heftStand';
  import { homescreenFragen } from '../ui/homescreen';
  import type { HeftEreignisse, SpurEintrag } from '../domain/modell';
  import { namenListe } from '../domain/datenspur';
  import { tageBis } from '../domain/tageslinie';
  import { abweichungen, urteile } from '../domain/urteile';
  import { t, type TextSchluessel } from '../i18n';
  import { wohnungAus } from '../lesen/angaben';
  import { lageAnwenden } from '../domain/lage';
  import { plzTabelle } from '../ui/plz.svelte';
  import { einstellungenAendern, heftAendern } from '../storage/speicher';
  import Rueckmeldung from '../ui/Rueckmeldung.svelte';
  import { passend } from '../ui/passend';
  import { untrack } from 'svelte';
  import TabLeiste from '../ui/TabLeiste.svelte';
  import { inDenKalender } from '../ui/kalenderEintrag';
  import BesichtigungsFragen from '../ui/BesichtigungsFragen.svelte';
  import HeftFotos from '../ui/HeftFotos.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import TerminKarte from '../ui/TerminKarte.svelte';
  import UrteilZeichen from '../ui/UrteilZeichen.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  let { id }: { id: string } = $props();

  const heft = $derived(daten.hefte.find((h) => h.id === id) ?? null);
  const jetzt = new Date();
  const ihr = $derived(
    // Ohne Haushalt „ihr“ (E74.4, Design 12.11.), sonst ab zwei Personen ohne Bürgen.
    !daten.ansicht ||
      daten.ansicht.mitglieder.filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length > 1,
  );

  const st = $derived(heft ? stand(heft.ereignisse, jetzt) : 'gemerkt');
  const nummer = $derived(standNummer(st));

  const alleUrteile = $derived.by(() => {
    const a = heft?.angaben;
    const hh = daten.ansicht?.haushalt;
    if (!a || !hh?.wuensche) return null;
    // Lage aus den Postleitzahlen (E46, E50), sobald die Tabelle geladen ist.
    const l = lageAnwenden(wohnungAus(a), heft!.adresse, hh.wuensche, plzTabelle());
    return urteile(l.w, l.wu, {
      netto: haushaltsNetto(hh, daten.ansicht?.mitglieder ?? []),
      grenze: hh.mietgrenze ?? null,
      ihr,
    });
  });
  const abgleich = $derived(alleUrteile ? abweichungen(alleUrteile) : null);

  // Zeile 9: Kalender, Ergebnis und „Wieder hervorholen“ direkt im Heft.
  // Ohne Haushalt führt „Wer zieht ein?“ in die Einrichtung, wie der Tab „Mappe“.
  const haushaltZiel = $derived(
    homescreenFragen(daten.einstellungen) ? '#/homescreen/einrichtung' : '#/einrichtung',
  );

  // Moment der Rückmeldung (B19, Zeile 9b): nur, wenn er beim Öffnen des Hefts noch offen war. So bleibt
  // er nach einer Antwort stehen und zeigt „Danke“, kommt danach aber nie wieder.
  const momentDa = untrack(
    () =>
      !daten.einstellungen?.rueckmeldungMomentFertig &&
      !daten.einstellungen?.rueckmeldung?.geholfen,
  );
  $effect(() => {
    if (
      daten.einstellungen?.rueckmeldung?.geholfen &&
      !daten.einstellungen.rueckmeldungMomentFertig
    )
      void momentFertig(false);
  });
  async function momentFertig(sofortWeg = true) {
    await einstellungenAendern(await db(), { rueckmeldungMomentFertig: true });
    await stillLaden();
    if (sofortWeg) momentWeg = true;
  }
  let momentWeg = $state(false);

  /** „Mail an Herrn Kraus“, „Über ImmoScout24“, „Löschbitte an …“: die erste Zeile eines Eintrags. */
  function spurKopf(e: SpurEintrag): string {
    if (e.art === 'loeschbitte')
      return e.an ? t('heft.spurLoeschbitte', { an: e.an }) : t('heft.spurLoeschbitteOhne');
    if (e.art === 'nachfrage')
      return e.an ? t('heft.spurNachfrage', { an: e.an }) : t('heft.spurNachfrageOhne');
    if (e.weg === 'mail') return e.an ? t('heft.spurMail', { an: e.an }) : t('heft.spurMailOhne');
    if (e.weg === 'portal')
      return e.an ? t('heft.spurPortal', { an: e.an }) : t('heft.spurPortalOhne');
    if (e.weg === 'website') return t('heft.spurWebsite');
    return t('heft.spurSonst');
  }

  const TITEL_STUFEN = ['25px/28px', '22px/25px', '20px/23px', '18px/21px', '16px/19px'];

  // Hefta erinnert selbst: in der App, Schalter an, Mitteilungen nicht verboten.
  const leiseBescheid = $derived(
    erinnerungenMoeglich() &&
      daten.einstellungen?.erinnerungBesichtigungen !== false &&
      mitteilungen.erlaubt !== false,
  );

  let kalenderMeldung = $state('');
  async function kalender() {
    if (!heft) return;
    kalenderMeldung = '';
    const a = await inDenKalender(heft, heftTitel(heft).text);
    // Vermerk für „Termin entfernen“: Dann steht dort der Satz zum Kalender (Planung 12t).
    if (
      (a === 'gesichert' || a === 'datei') &&
      heft.ereignisse.termin &&
      !heft.ereignisse.termin.imKalender
    )
      await ereignisse({
        ...heft.ereignisse,
        termin: { ...heft.ereignisse.termin, imKalender: true },
      });
    kalenderMeldung =
      a === 'gesichert'
        ? t('heft.kalenderGesichert')
        : a === 'nicht_erlaubt'
          ? t('heft.kalenderNein')
          : a === 'datei' && !istApp()
            ? t('heft.kalenderDatei')
            : '';
  }

  async function ereignisse(neu: HeftEreignisse) {
    if (!heft) return;
    // Ohne Proxys von Svelte: IndexedDB kann sie nicht kopieren.
    await heftAendern(await db(), heft.id, { ereignisse: $state.snapshot(neu) });
    await stillLaden();
  }

  const ergebnisWort = $derived.by(() => {
    const e = heft?.ereignisse;
    if (!e) return '';
    const datum = tagKurz(e.ergebnis?.am ?? e.abgelegtAm ?? new Date().toISOString());
    if (e.ergebnis?.art === 'zusage') return t('heft.zusageAm', { datum });
    if (e.ergebnis?.art === 'absage') return t('heft.absageAm', { datum });
    if (e.ergebnis?.art === 'nicht_mehr') return t('heft.dagegenAm', { datum });
    return t('heft.abgelegtAm', { datum });
  });

  const beworbenWort = $derived.by(() => {
    const am = heft?.ereignisse.beworben?.am;
    if (!am) return '';
    const tage = -tageBis(am, jetzt);
    if (tage <= 0) return t('heft.beworbenHeute');
    return t(tage === 1 ? 'heft.beworbenTag' : 'heft.beworbenTage', { datum: tagKurz(am), tage });
  });

  let notiz = $state('');
  let notizVon = $state<string | null>(null);
  $effect(() => {
    // Beim Öffnen eines anderen Hefts die gespeicherte Notiz übernehmen, sonst nicht überschreiben.
    if (heft && notizVon !== heft.id) {
      notiz = heft.notiz;
      notizVon = heft.id;
    }
  });

  async function notizSichern() {
    if (!heft || notiz === heft.notiz) return;
    await heftAendern(await db(), heft.id, { notiz });
    await stillLaden();
  }
</script>

<!-- Öffnen eines Hefts: das Scharnier am Umschlag (`auf`, B21), der Rest folgt (Design 12.11.). -->
<main class="seite" class:auf={wechselArt(route.von, route.pfad, route.richtung) === 'heft'}>
  <header class="kopf">
    <Zurueck href="#/wohnungen" text={t('heft.zurueck')} />
  </header>

  {#if !heft}
    <p class="fehlt">{t('heft.fehlt')}</p>
  {:else}
    {@const titel = heftTitel(heft)}
    {@const eck = eckdaten(heft)}
    {@const kommt = st === 'besichtigung'}
    <section class="umschlag" class:kommt class:abgelegt={st === 'abgelegt'}>
      <!-- Lange Wörter nie mitten im Wort trennen: lieber kleinere Schrift (Prüfkatalog C2). -->
      <h1 use:passend={TITEL_STUFEN}>{titel.text}</h1>
      {#if !titel.strasse}<p class="adr">{heftAdresseKurz(heft)}</p>{/if}
      <a class="merk" href={`#/heft/${heft.id}/merkmal`}
        >{t(
          heft.angaben?.merkmal
            ? 'heft.merkmalEigen'
            : heft.angaben?.titel
              ? 'heft.merkmalInserat'
              : 'heft.merkmalKeins',
        )} · <u>{t('heft.aendern')}</u></a
      >
      {#if eck}<p class="eck">{eck}</p>{/if}
      <p class="quelle">
        {heft.angaben?.portal
          ? t('heft.gefunden', {
              portal: heft.angaben.portal,
              datum: tagKurz(heft.createdAt),
            })
          : t('heft.gefundenAm', { datum: tagKurz(heft.createdAt) })}
        {#if heft.link}
          · <a href={heft.link} target="_blank" rel="noopener noreferrer"
            >{t('heft.inseratOeffnen')}</a
          >
        {/if}
      </p>
    </section>

    <section class="stand" class:kommt>
      <div
        class="standleiste"
        class:abgelegt={st === 'abgelegt'}
        role="img"
        aria-label={t('heft.standLabel', { stand: t(`heft.stand.${st}` as TextSchluessel) })}
      >
        <b>{t(`heft.stand.${st}` as TextSchluessel)}</b>
        <small>{t('heft.standVon', { nummer })}</small>
        <span class="seg" aria-hidden="true">
          {#each [1, 2, 3, 4] as n (n)}<i class:d={n < nummer} class:c={n === nummer}></i>{/each}
        </span>
      </div>
      {#if heft.ereignisse.termin && st === 'besichtigung'}
        <TerminKarte {heft} {jetzt} titel={false} />
        {#if terminVorbei(heft.ereignisse, jetzt)}
          {@const datum = terminKurz(heft.ereignisse.termin.am, false)}
          <div class="nx">
            <!-- „Fr, 6. Nov. Wie …“, aber „Fr, 6. Mai. Wie …“: kein Punkt doppelt. -->
            <b>{t('heft.besichtigt', { datum, punkt: datum.endsWith('.') ? '' : '.' })}</b>
            <p>{t(ihr ? 'ergebnis.satzIhr' : 'ergebnis.satzDu')}</p>
            <div class="knopfreihe">
              <button
                class="knopf haupt"
                type="button"
                onclick={() => ereignisse(ergebnisSetzen(heft.ereignisse, 'zusage', new Date()))}
                >{t('ergebnis.zusage')}</button
              >
              <button
                class="knopf"
                type="button"
                onclick={() => ereignisse(ergebnisSetzen(heft.ereignisse, 'absage', new Date()))}
                >{t('ergebnis.absage')}</button
              >
              <button
                class="knopf"
                type="button"
                onclick={() =>
                  ereignisse(ergebnisSetzen(heft.ereignisse, 'nicht_mehr', new Date()))}
                >{t(ihr ? 'ergebnis.nichtMehrIhr' : 'ergebnis.nichtMehrDu')}</button
              >
            </div>
          </div>
        {:else}
          <div class="vb">
            <button class="vz" type="button" onclick={kalender}>
              <span class="vi"><Symbol name="kalender" groesse={20} /></span>
              <b>{t('heft.inDenKalender')}</b>
              <Symbol name="weiter" groesse={16} />
            </button>
          </div>
          {#if kalenderMeldung}<p class="meldung" role="status">{kalenderMeldung}</p>{/if}
        {/if}
        <a class="leis" href={`#/heft/${heft.id}/termin`}>{t('heft.terminAendern')}</a>
      {:else if st === 'beworben'}
        <div class="nx">
          <b>{beworbenWort}</b>
          <!-- E90.2: „sagt Hefta leise Bescheid“ nur, wo Hefta wirklich erinnert. -->
          <p>
            {t(
              leiseBescheid
                ? ihr
                  ? 'heft.beworbenSatzLeiseIhr'
                  : 'heft.beworbenSatzLeiseDu'
                : ihr
                  ? 'heft.beworbenSatzIhr'
                  : 'heft.beworbenSatzDu',
            )}
          </p>
          <a class="knopf breit" href={`#/heft/${heft.id}/termin`}
            ><Symbol name="kalender" groesse={20} />{t('heft.terminEintragen')}</a
          >
        </div>
      {:else if st === 'keine_antwort'}
        <!-- B18: Nachfassen, um Löschung bitten oder ablegen, das geht im Heft. -->
        <div class="nx">
          <b>{beworbenWort}</b>
          <p>{t('heft.keineAntwortSatz')}</p>
          {#if heft.ereignisse.nachgefasstAm}
            <p>{t('heft.nachgefasstAm', { datum: tagKurz(heft.ereignisse.nachgefasstAm) })}</p>
          {/if}
          {#if heft.ereignisse.loeschbitteAm}
            <p>{t('heft.loeschbitteAm', { datum: tagKurz(heft.ereignisse.loeschbitteAm) })}</p>
          {/if}
          <div class="knopfreihe">
            <a class="knopf" href={`#/heft/${heft.id}/nachfassen`}>{t('heft.nachfassen')}</a>
            {#if !heft.ereignisse.loeschbitteAm}
              <a class="knopf" href={`#/heft/${heft.id}/loeschbitte`}
                >{t('heft.loeschbitteSchreiben')}</a
              >
            {/if}
            <button
              class="knopf"
              type="button"
              onclick={() =>
                ereignisse({ ...heft.ereignisse, abgelegtAm: new Date().toISOString() })}
              >{t('heft.ablegen')}</button
            >
          </div>
        </div>
      {:else if st === 'abgelegt'}
        <div class="nx">
          <b>{ergebnisWort}</b>
          <p>{t('heft.abgelegtSatz')}</p>
          {#if heft.ereignisse.loeschbitteAm}
            <p>{t('heft.loeschbitteAm', { datum: tagKurz(heft.ereignisse.loeschbitteAm) })}</p>
          {:else if heft.ereignisse.beworben}
            <!-- B18: Wer sich beworben hat, kann auch aus „Abgelegt“ um Löschung bitten. -->
            <p>{t(ihr ? 'heft.unterlagenNochIhr' : 'heft.unterlagenNochDu')}</p>
            <a class="leis" href={`#/heft/${heft.id}/loeschbitte`}
              >{t('heft.loeschbitteSchreiben')}</a
            >
          {/if}
          <button
            class="leis"
            type="button"
            onclick={() => ereignisse(hervorholen(heft.ereignisse))}>{t('heft.hervorholen')}</button
          >
        </div>
        {#if momentDa && !momentWeg && (heft.ereignisse.ergebnis?.art === 'zusage' || heft.ereignisse.ergebnis?.art === 'absage')}
          <!-- B19-10 bis 15: der eine Moment, gleich unter dem Ergebnis, einmal je Gerät. -->
          <div class="moment">
            <Rueckmeldung fragen={['geholfen']} />
            <button class="leis" type="button" onclick={() => momentFertig()}
              >{t('rueckmeldung.nichtMehrFragen')}</button
            >
          </div>
        {/if}
      {:else if standFragen(heft.ereignisse) && heft.ereignisse.beworben}
        <!-- „Stimmt der Stand?“ (B16, B21): einmal, wenn etwas hinausging, Hefta das Absenden aber nicht
             sicher weiß. -->
        {@const b = heft.ereignisse.beworben}
        {@const tag = tagKurz(b.am)}
        <div class="nx vorschlag">
          <small class="vk">{t('heft.vorschlag')}</small>
          <b>{t('heft.vorschlagBeworben')}</b>
          <p>
            {t(
              b.weg === 'portal'
                ? ihr
                  ? 'heft.vorschlagPortalIhr'
                  : 'heft.vorschlagPortalDu'
                : b.weg === 'website'
                  ? ihr
                    ? 'heft.vorschlagWebsiteIhr'
                    : 'heft.vorschlagWebsiteDu'
                  : ihr
                    ? 'heft.vorschlagMailIhr'
                    : 'heft.vorschlagMailDu',
              { tag },
            )}
          </p>
          <div class="knopfreihe">
            <button
              class="knopf haupt"
              type="button"
              onclick={() =>
                ereignisse({
                  ...heft.ereignisse,
                  beworben: { ...b, sicher: true },
                  gefragtAm: new Date().toISOString(),
                })}>{t('heft.jaBeworben')}</button
            >
            <button
              class="knopf"
              type="button"
              onclick={() =>
                ereignisse({ ...heft.ereignisse, gefragtAm: new Date().toISOString() })}
              >{t('heft.nochNicht')}</button
            >
          </div>
          <p class="fein">{t(ihr ? 'heft.nurEinmalIhr' : 'heft.nurEinmalDu')}</p>
        </div>
      {:else if st === 'gemerkt'}
        <!-- Als Nächstes: bewerben (B21); ohne Haushalt erst „Wer zieht ein?“. -->
        <div class="nx">
          <b>{t('heft.naechstesBewerben')}</b>
          {#if daten.ansicht}
            <p>{t(ihr ? 'heft.naechstesSatzIhr' : 'heft.naechstesSatzDu')}</p>
            <a class="knopf haupt breit" href={`#/heft/${heft.id}/bewerben`}
              >{t('heft.jetztBewerben')}</a
            >
          {:else}
            <p>{t(ihr ? 'heft.ohneHaushaltSatzIhr' : 'heft.ohneHaushaltSatzDu')}</p>
            <a class="knopf haupt breit" href={haushaltZiel}
              ><Symbol name="person" groesse={20} />{t('heft.werZiehtEin')}</a
            >
          {/if}
        </div>
      {/if}
      <a class="leis selbst" href={`#/heft/${heft.id}/stand`}>{t('heft.standSelbst')}</a>
    </section>

    {#if heft.ereignisse.termin}
      <!-- Fragen für die Besichtigung (E52): ab dem Termin, danach mit den Antworten. -->
      <BesichtigungsFragen {heft} urteile={alleUrteile ?? []} {ihr} />
    {/if}

    <section class="teil">
      <h2 class="fnh"><label for="notiz">{t('heft.notizen')}</label></h2>
      <textarea
        id="notiz"
        rows="3"
        placeholder={t(ihr ? 'heft.notizIhr' : 'heft.notizDu')}
        bind:value={notiz}
        onblur={notizSichern}></textarea>
    </section>

    <!-- B21: Fotos der Besichtigung unter den Notizen, nur auf dem Gerät. -->
    <HeftFotos {heft} />

    {#if heft.spur?.length}
      <!-- Datenspur (B21 „Was hinausging“): neueste zuerst, nur auf dem Gerät. -->
      <section class="teil spur">
        <h2>{t('heft.spurTitel')}</h2>
        <ul>
          {#each [...heft.spur].reverse() as e (e.am + e.art)}
            <li>
              <b>{tagKurz(e.am)} · {spurKopf(e)}</b>
              {#if e.art === 'mappe'}
                <small
                  >{[
                    t('heft.spurMappe', { fassung: e.fassung ?? 1 }),
                    e.unterlagen ? t('heft.spurUnterlagen', { anzahl: e.unterlagen }) : '',
                    e.seiten ? t('heft.spurSeiten', { anzahl: e.seiten }) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}</small
                >
                {#if e.ueber}
                  <small>{t('heft.spurUeber', { ziel: e.ueber })}</small>
                {/if}
                {#if e.personen?.length}
                  <small>{t('heft.spurPersonen', { namen: namenListe(e.personen) })}</small>
                {/if}
              {:else if e.art === 'loeschbitte'}
                <small>{t('heft.spurGeloescht')}</small>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if abgleich}
      <section class="teil">
        <h2>{t(ihr ? 'heft.wuenscheIhr' : 'heft.wuenscheDu')}</h2>
        <ul class="abw">
          {#each abgleich as z, i (i)}
            <li class={z.art}>
              {#if z.art === 'nicht' || z.art === 'knapp' || z.art === 'offen' || z.art === 'passt'}
                <UrteilZeichen art={z.art} groesse={16} /><span><b>{z.wort}:</b> {z.text}</span>
              {:else}
                <UrteilZeichen art="passt" groesse={16} /><span>{z.text}</span>
              {/if}
            </li>
          {/each}
        </ul>
        <a class="wlink" href="#/wuensche">{t('wuensche.aendern')}</a>
      </section>
    {:else if daten.ansicht}
      <section class="teil">
        <h2>{t(ihr ? 'heft.wuenscheIhr' : 'heft.wuenscheDu')}</h2>
        <p class="ohne">{t(ihr ? 'wuensche.ohneIhr' : 'wuensche.ohneDu')}</p>
        <a class="wlink" href="#/wuensche">{t('wuensche.festlegen')}</a>
      </section>
    {/if}
  {/if}
</main>
<TabLeiste aktiv="wohnungen" />

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: env(safe-area-inset-top) var(--space-4) calc(var(--tabs-hoehe, 72px) + 24px);
  }

  .kopf {
    --on-zurueck: var(--accent-text);
    display: flex;
    align-items: center;
    min-height: 52px;
    padding: 4px 0;
  }

  .fehlt {
    color: var(--ink-muted);
  }

  /* Umschlag (B16, B21 Fassung 4): Karte mit Rücken; der Rücken in der Terminfarbe, solange eine
     Besichtigung ansteht, abgelegt leise. */
  .auf > .umschlag {
    transform-origin: left center;
    animation: bw-scharnier var(--bw-aufschlagen) var(--bw-ziel) backwards;
  }

  .auf > :not(.umschlag, .kopf) {
    animation: bw-folgen var(--bw-mittel) var(--bw-ziel) var(--bw-takt) backwards;
  }

  .umschlag {
    margin-top: 6px;
    padding: 0 0 14px;
    border: 1px solid var(--line);
    border-left: 5px solid var(--accent);
    border-radius: 10px 16px 16px 10px;
    background: var(--surface);
    box-shadow:
      4px 4px 0 -1px var(--surface),
      4px 4px 0 0 var(--line);
  }

  .umschlag.kommt {
    border-left-color: var(--termin);
  }

  .umschlag.abgelegt {
    border-left-color: var(--ink-quiet);
  }

  .umschlag > * {
    margin-right: 16px;
    margin-left: 16px;
  }

  .umschlag h1 {
    margin-top: 14px;
    margin-bottom: 0;
    font-size: calc(25 * var(--px));
    font-weight: 700;
    font-stretch: 108%;
    line-height: 1.12;
    letter-spacing: -0.01em;
    text-wrap: balance;
  }

  .adr {
    margin-top: 2px;
    margin-bottom: 0;
    font-size: calc(14 * var(--px));
  }

  .merk {
    display: block;
    min-height: 44px;
    padding: 12px 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: 1.5;
    text-decoration: none;
  }

  .merk u {
    margin-left: 4px;
    color: var(--accent-text);
    text-underline-offset: 0.2em;
  }

  .eck {
    margin-top: 0;
    margin-bottom: 2px;
    color: var(--ink-muted);
  }

  .quelle {
    margin-top: 2px;
    margin-bottom: 0;
    color: var(--ink-quiet);
    font-size: calc(12 * var(--px));
  }

  .quelle a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: inherit;
    text-decoration: underline;
  }

  /* Stand (B16 `x-stand`): eigene Karte; steht eine Besichtigung an, Überschrift und laufender Abschnitt
     in der Terminfarbe (B21 Fassung 4 `x8-kommt`). */
  .stand {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 18px;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
  }

  .standleiste {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 10px;
  }

  .standleiste b {
    font-size: calc(20 * var(--px));
    font-weight: 700;
    font-stretch: 108%;
    line-height: 1.2;
  }

  .kommt .standleiste b {
    color: var(--termin);
  }

  .standleiste small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .seg {
    display: grid;
    flex-basis: 100%;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    margin-top: 8px;
  }

  .seg i {
    height: 6px;
    border: 1.4px solid var(--ink-quiet);
    border-radius: 3px;
  }

  .seg i.d {
    border-color: var(--ink);
    background: var(--ink);
  }

  .seg i.c {
    border-color: var(--accent);
    background: var(--accent);
  }

  .kommt .seg i.c {
    border-color: var(--termin);
    background: var(--termin);
  }

  .standleiste.abgelegt .seg i.c,
  .standleiste.abgelegt .seg i.d {
    border-color: var(--ink-quiet);
    background: var(--ink-quiet);
  }

  /* Zeile 9 (B21 Fassung 4): Hinweis zum Stand, „In den Kalender“ als Zeile, leise Links darunter. */
  .nx > b {
    display: block;
    font-size: calc(17 * var(--px));
    line-height: 1.3;
  }

  .nx p {
    margin: 4px 0 12px;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }

  /* Knöpfe bleiben einzeilig; die Reihe bricht um (Prüfkatalog C18). */
  /* Weniger Rand, damit „Löschbitte schreiben“ bei 320 px mit 130 % in eine Zeile passt (C18); bei
     200 % darf es umbrechen, statt aus der Karte zu ragen (C24). */
  .knopfreihe .knopf {
    padding: 0 10px;
    font-size: calc(14 * var(--px));
  }

  .knopfreihe {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .knopf {
    display: inline-flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    padding: 0 18px;
    border: 1.5px solid var(--ink);
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-weight: 650;
    text-decoration: none;
    cursor: pointer;
  }

  .knopf.breit {
    width: 100%;
    /* Einzeilig auch bei 320 px mit großer Schrift (Prüfkatalog C18): weniger Rand statt Umbruch. */
    padding: 0 10px;
    white-space: nowrap;
  }

  .knopf.haupt {
    border-color: var(--action);
    background: var(--action);
    color: var(--on-action);
  }

  /* „Hefta schlägt vor: Beworben“ (B21 `x-vs`): Kasten mit Etikett, darunter der feine Satz. */
  .vorschlag {
    padding: 12px 14px;
    border: 1px solid var(--line-strong);
    border-radius: 14px;
    background: var(--ground);
  }

  .vk {
    display: block;
    margin-bottom: 2px;
    color: var(--ink-muted);
    font-size: calc(12 * var(--px));
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .fein {
    margin: 10px 0 0 !important;
    font-size: calc(13 * var(--px)) !important;
  }

  .vb {
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .vz {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 52px;
    padding: 10px 14px;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(15 * var(--px));
    line-height: 1.35;
    text-align: left;
    cursor: pointer;
  }

  .vz b {
    flex: 1;
    min-width: 0;
  }

  .vi {
    display: flex;
    flex: none;
    color: var(--termin);
  }

  .vz > :global(svg:last-child) {
    color: var(--ink-quiet);
  }

  .meldung {
    margin: -6px 2px 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }

  .leis {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 44px;
    margin: -8px 0 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent-text);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }

  .nx .leis {
    margin-top: 0;
  }

  /* B19: auf einem Blatt ohne eigene Farbe, gleich unter dem Ergebnis. */
  .moment {
    margin-top: 12px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
  }

  .moment .leis {
    margin-top: 0;
  }

  .leis.selbst {
    margin-top: 0;
    padding-top: 4px;
    border-top: 1px solid var(--line);
  }

  .wlink {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--accent-text);
    font-weight: 650;
    text-decoration: none;
  }

  .ohne {
    margin: 0;
    color: var(--ink-muted);
  }

  .teil {
    margin-top: 26px;
  }

  .spur ul {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
    list-style: none;
  }

  .spur li {
    display: grid;
    gap: 2px;
  }

  .spur li + li {
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }

  .spur b {
    font-size: calc(15 * var(--px));
  }

  .spur small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .teil h2 {
    margin: 0 2px 8px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    font-weight: 650;
    line-height: 1.2;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 88px;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    resize: vertical;
  }

  .abw {
    margin: 0;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
    list-style: none;
  }

  .abw li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 4px 0;
    line-height: 1.4;
  }

  .abw li :global(svg) {
    margin-top: 3px;
  }

  .abw li.sonst,
  .abw li.alles {
    color: var(--ink-muted);
  }
</style>
