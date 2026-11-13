<script lang="ts">
  // Bewerben in einer Minute (Zeile 8, B23 `s=bewerben`, B12a, Planung 11i): Weg wählen (Portal, Mail,
  // Website), dann vier Schritte als Angebot: Anschreiben, was das Inserat wissen will, Mappe, Abschicken.
  // Jeder Schritt lässt sich überspringen. Hefta verschickt nichts selbst; es merkt sich, was hinausging,
  // und fragt danach einmal „Stimmt der Stand?“ im Heft, wenn es das Absenden nicht sicher weiß.
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { adresseZeilen } from '../domain/adresse';
  import {
    anschreibenText,
    bewerbungsText,
    einzugText,
    wegVorschlag,
    werZiehtEin,
    type BewerbungsWeg,
  } from '../domain/bewerben';
  import { spurAn, spurEintragen } from '../domain/datenspur';
  import { deckZeilen } from '../domain/deckZeilen';
  import { bloecke, standardEinstellungen, type ExportEinstellungen } from '../domain/export';
  import type { HeftEreignisse } from '../domain/modell';
  import { angabenWerte, erkennen } from '../domain/nachricht';
  import { listenText, ohneTrennstellen } from '../domain/regelkatalog';
  import { einziehend } from '../domain/selbstauskunft';
  import { t, type TextSchluessel } from '../i18n';
  import { heftAendern } from '../storage/speicher';
  import { mailMitMappe, mappeTeilen, textKopieren } from '../ui/bewerbenSenden';
  import type { MappenErgebnis } from '../ui/mappeErstellen';
  import { staendeAus } from '../ui/mappeDaten';
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  let { id }: { id: string } = $props();

  const heft = $derived(daten.hefte.find((h) => h.id === id) ?? null);
  const ansicht = $derived(daten.ansicht);
  const aktive = $derived(
    (ansicht?.mitglieder ?? []).filter((m) => !m.zugehoerigkeit.herausgenommenAm),
  );
  const vertrag = $derived(aktive.filter((m) => m.zugehoerigkeit.rolle !== 'buerge'));
  const buergen = $derived(aktive.filter((m) => m.zugehoerigkeit.rolle === 'buerge'));
  // Ohne Haushalt „ihr“ (E74.4), sonst ab zwei Personen ohne Bürgen.
  const ihr = $derived(!ansicht || vertrag.length > 1);
  const person = $derived(vertrag[0]?.person ?? null);
  const heute = new Date();

  let weg = $state<BewerbungsWeg | null>(null);
  $effect(() => {
    if (heft && weg === null)
      weg = wegVorschlag({ inseratText: heft.inseratText, angaben: heft.angaben });
  });
  const erkannt = $derived(erkennen(heft?.inseratText ?? ''));
  const strasse = $derived(
    (adresseZeilen(heft?.adresse ?? '')[0] ?? '').replace(/\u00a0/g, ' ').trim(),
  );

  // Schritt 1: Anschreiben. „Ändern“ macht daraus einen eigenen Text für diesen Besuch.
  const vorschlag = $derived(
    anschreibenText({
      wir: ihr,
      anbieter: heft?.angaben?.anbieter,
      strasse,
      einzug: heft?.einzug ?? '',
      heute,
    }),
  );
  let eigenerText = $state<string | null>(null);
  let aendert = $state(false);

  // Schritt 2: was das Inserat wissen will. Immer, wer einzieht; dazu Einzug und Haustiere, wenn
  // bekannt, und was das Inserat erbittet (Beruf, Einkommen, Anschrift).
  const angaben = $derived.by(() => {
    if (!ansicht || !person) return [];
    const kinder = ansicht.haushalt.kinder;
    const werte = angabenWerte(
      person,
      einziehend(vertrag.length, ansicht.haushalt),
      haushaltsAngabenAus(ansicht),
      heft?.einzug ?? '',
    );
    const zeilen: { label: string; wert: string }[] = [];
    if (heft?.einzug?.trim())
      zeilen.push({ label: t('bewerben.einzug'), wert: einzugText(heft.einzug, heute) });
    zeilen.push({
      label: t('bewerben.werEinzieht'),
      wert: werZiehtEin({
        vertrag: vertrag.length,
        kinder,
        weitere: ansicht.haushalt.weitereErwachsene,
        buergen: buergen.length,
      }),
    });
    if (werte.haustiere) zeilen.push({ label: t('bewerben.haustiere'), wert: werte.haustiere });
    for (const [aid, label] of [
      ['beruf', 'bewerben.beruf'],
      ['einkommen', 'bewerben.einkommen'],
      ['adresse', 'bewerben.anschrift'],
    ] as const)
      if (erkannt.angaben.includes(aid) && werte[aid])
        zeilen.push({ label: t(label as TextSchluessel), wert: werte[aid] });
    return zeilen;
  });

  const text = $derived(
    eigenerText ??
      bewerbungsText({
        anrede: vorschlag.anrede,
        text: vorschlag.text,
        angaben,
        name: person ? `${person.vorname} ${person.nachname}`.trim() : '',
        telefon: person?.kontakt.telefon ?? '',
        mail: person?.kontakt.email ?? '',
      }),
  );

  // Schritt 3: Mappe. Vorgabe „Nur, was verlangt ist“ (E49), „Alles mitschicken“ ist einen Tipp entfernt.
  let alles = $state(false);
  const einstellungen = $derived<ExportEinstellungen>({
    ...standardEinstellungen(),
    ...(heft?.export ?? {}),
    ...(alles ? { modus: 'alles' as const } : {}),
  });
  const unterlagen = $derived.by(() => {
    if (!ansicht) return [];
    const namen: string[] = [];
    for (const b of bloecke(staendeAus(ansicht, heute), einstellungen))
      for (const teil of b.teile) {
        const name =
          b.person.rolle === 'buerge' && teil.stand.typ.id === 'buergschaftserklaerung'
            ? t('bewerben.buergschaftVon', {
                name: b.person.person.rufname || b.person.person.vorname,
              })
            : ohneTrennstellen(listenText(teil.stand.typ));
        if (!namen.includes(name)) namen.push(name);
      }
    return namen;
  });

  let mappe = $state.raw<MappenErgebnis | null>(null);
  let mappeBaut = $state(false);
  let mappeFehler = $state(false);
  let gebautFuer = '';
  async function mappeHolen(): Promise<MappenErgebnis | null> {
    if (!ansicht || !heft) return null;
    const schluessel = JSON.stringify(einstellungen);
    if (mappe && gebautFuer === schluessel) return mappe;
    mappeBaut = true;
    mappeFehler = false;
    try {
      const { mappeGebaut } = await import('../ui/mappeErstellen');
      mappe = await mappeGebaut(
        await db(),
        ansicht,
        {
          adresse: heft.adresse,
          satz: heft.satz,
          bitteSatz: heft.bitteSatz,
          // B14, E39: Inserat, Einzug und Fassung aufs Deckblatt.
          ...deckZeilen($state.snapshot(heft), heute),
        },
        $state.snapshot(einstellungen) as ExportEinstellungen,
      );
      gebautFuer = schluessel;
      return mappe;
    } catch {
      mappeFehler = true;
      return null;
    } finally {
      mappeBaut = false;
    }
  }
  $effect(() => {
    // Die Seitenzahl gleich zeigen; die Mappe kommt danach aus dem Zwischenspeicher.
    void JSON.stringify(einstellungen);
    void mappeHolen();
  });

  // Schritt 4: Abschicken. Danach steht das Heft auf „Beworben“, aber nur sicher, wenn das System es meldet.
  let meldung = $state('');
  async function beworbenMerken(w: BewerbungsWeg, sicher: boolean, m?: MappenErgebnis, ueber = '') {
    if (!heft) return;
    const e = heft.ereignisse;
    // Datenspur (B21 „Was hinausging“): nur, wenn die Mappe wirklich mitging.
    const spur = m
      ? spurEintragen($state.snapshot(heft.spur), {
          am: new Date().toISOString(),
          art: 'mappe',
          weg: w,
          an: spurAn({
            anbieter: heft.angaben?.anbieter,
            mail: erkannt.mail,
            portal: heft.angaben?.portal ?? heft.quelle,
            weg: w,
          }),
          unterlagen: unterlagen.length,
          seiten: m.seiten,
          personen: aktive.map((p) => p.person.rufname || p.person.vorname),
          ...(ueber ? { ueber } : {}),
        })
      : undefined;
    if (e.beworben?.sicher && !sicher) {
      if (spur) {
        await heftAendern(await db(), heft.id, { spur });
        await stillLaden();
      }
      return;
    }
    const neu: HeftEreignisse = {
      ...e,
      beworben: { am: new Date().toISOString(), weg: w, sicher },
      // Hinausgegangen ist etwas Neues: „Stimmt der Stand?“ darf wieder einmal fragen.
      gefragtAm: sicher ? e.gefragtAm : null,
    };
    await heftAendern(await db(), heft.id, {
      ereignisse: $state.snapshot(neu),
      ...(spur ? { spur } : {}),
    });
    await stillLaden();
  }

  const betreff = $derived(
    strasse ? t('bewerben.betreff', { wohnung: strasse }) : t('bewerben.betreffOhne'),
  );

  async function mail() {
    meldung = '';
    const m = await mappeHolen();
    if (!m) return;
    const a = await mailMitMappe({ an: erkannt.mail, betreff, text, dateien: m.dateien });
    if (a === 'abgebrochen') return;
    if (a === 'anhangSelbst') meldung = t('bewerben.anhangSelbst');
    await beworbenMerken('mail', a === 'gesendet', m);
  }

  async function kopieren(was: string, inhalt: string, merken: boolean) {
    meldung = (await textKopieren(inhalt)) ? t('bewerben.kopiert') : t('bewerben.nichtKopiert');
    if (merken && weg) await beworbenMerken(weg, false);
    void was;
  }

  async function teilen() {
    meldung = '';
    const m = await mappeHolen();
    if (!m || !weg) return;
    const r = await mappeTeilen(m.dateien);
    if (r.geteilt) await beworbenMerken(weg, false, m, r.ueber);
  }

  function springen(nach: string) {
    document.getElementById(nach)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  const SCHRITTE = ['anschreiben', 'angaben', 'mappe', 'abschicken'] as const;
  // Planung 12z: mit Leerzeichen vor und nach dem Punkt; als Wert, sonst kürzt Svelte die Leerzeichen.
  const TRENNER = ' · ';
</script>

{#snippet kopf(nr: number)}
  {@const schritt = SCHRITTE[nr - 1]!}
  <h2 class="schritt" id="schritt-{schritt}">
    <span class="nr" aria-hidden="true">{nr}</span>{t(`bewerben.schritt.${schritt}`)}
    {#if nr < 4}
      <button
        class="ueber"
        type="button"
        aria-label={t('bewerben.ueberspringenLabel', { schritt: t(`bewerben.schritt.${schritt}`) })}
        onclick={() => springen(`schritt-${SCHRITTE[nr]}`)}>{t('bewerben.ueberspringen')}</button
      >
    {/if}
  </h2>
{/snippet}

<main class="seite">
  <header class="kopf">
    <Zurueck href={`#/heft/${id}`} text={strasse || t('termin.zurueck')} />
  </header>

  {#if !heft}
    <p class="sub">{t('heft.fehlt')}</p>
  {:else if !ansicht}
    <p class="sub">{t('bewerben.ohneHaushalt')}</p>
  {:else}
    <h1 class="h2">{t('bewerben.titel')}</h1>
    <p class="sub">{t('bewerben.sub')}</p>

    <div class="wege" role="group" aria-label={t('bewerben.wegeLabel')}>
      {#each ['portal', 'mail', 'website'] as const as w (w)}
        <button
          class="chip"
          class:on={weg === w}
          type="button"
          aria-pressed={weg === w}
          onclick={() => {
            weg = w;
            meldung = '';
          }}>{t(`bewerben.weg.${w}`)}</button
        >
      {/each}
    </div>
    <p class="klein">
      {weg === 'portal'
        ? t(ihr ? 'bewerben.satzPortalIhr' : 'bewerben.satzPortalDu')
        : weg === 'website'
          ? t('bewerben.satzWebsite')
          : t('bewerben.satzMail')}
    </p>

    {@render kopf(1)}
    <div class="blatt mailblatt">
      {#if aendert}
        <textarea
          rows="12"
          aria-label={t('bewerben.anschreibenLabel')}
          value={text}
          oninput={(e) => (eigenerText = (e.currentTarget as HTMLTextAreaElement).value)}
        ></textarea>
        <button class="mini" type="button" onclick={() => (aendert = false)}
          >{t('bewerben.fertig')}</button
        >
      {:else}
        <p class="mt">{text}</p>
        <button class="mini" type="button" onclick={() => (aendert = true)}
          >{t('bewerben.aendern')}</button
        >
      {/if}
    </div>

    {@render kopf(2)}
    <div class="blatt">
      {#each angaben as a (a.label)}
        <div class="wz">
          <span class="l">{a.label}</span><span class="v">{a.wert}</span>
          {#if weg === 'website'}
            <button
              class="mini"
              type="button"
              aria-label={t('bewerben.kopierenLabel', { was: a.label })}
              onclick={() => kopieren(a.label, a.wert, true)}
              ><Symbol name="kopieren" groesse={16} /><span>{t('bewerben.kopieren')}</span></button
            >
          {/if}
        </div>
      {/each}
    </div>

    {@render kopf(3)}
    <div class="blatt">
      {#each unterlagen as u (u)}
        <div class="mp"><Symbol name="datei" groesse={20} /><span>{u}</span></div>
      {/each}
      <div class="mpf">
        <small
          >{t(
            alles ? 'bewerben.alles' : 'bewerben.nurVerlangt',
          )}{#if mappe && !mappeBaut}{TRENNER}{t('bewerben.seiten', {
              anzahl: mappe.seiten,
            })}{/if}</small
        >
        <button class="mini" type="button" onclick={() => (alles = !alles)}
          >{t(alles ? 'bewerben.nurVerlangtMitschicken' : 'bewerben.allesMitschicken')}</button
        >
      </div>
      {#if mappeBaut}<p class="hinweis" role="status">{t('bewerben.mappeBaut')}</p>{/if}
      {#if mappeFehler}<p class="hinweis" role="alert">{t('bewerben.mappeFehler')}</p>{/if}
    </div>

    {@render kopf(4)}
    <div class="cta">
      {#if weg === 'mail'}
        <button class="btn" type="button" onclick={mail}
          ><Symbol name="mail" groesse={20} />{t('bewerben.mailOeffnen')}</button
        >
      {:else if weg === 'portal'}
        <button class="btn" type="button" onclick={() => kopieren('text', text, true)}
          ><Symbol name="kopieren" groesse={20} />{t('bewerben.textKopieren')}</button
        >
        <button class="btn zweit" type="button" onclick={teilen}
          ><Symbol name="hochladen" groesse={20} />{t('bewerben.mappeTeilen')}</button
        >
      {:else}
        {#if heft.link}
          <a class="btn" href={heft.link} target="_blank" rel="noopener noreferrer"
            ><Symbol name="weiter" groesse={20} />{t('bewerben.websiteOeffnen')}</a
          >
        {:else}
          <p class="hinweis">{t('bewerben.ohneLink')}</p>
        {/if}
        <button class="btn zweit" type="button" onclick={teilen}
          ><Symbol name="hochladen" groesse={20} />{t('bewerben.mappeTeilen')}</button
        >
      {/if}
      {#if meldung}<p class="meldung" role="status">{meldung}</p>{/if}
      <small>{t(ihr ? 'bewerben.versprechenIhr' : 'bewerben.versprechenDu')}</small>
    </div>
  {/if}
</main>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: env(safe-area-inset-top) var(--space-4) 32px;
  }

  .kopf {
    --on-zurueck: var(--accent-text);
    display: flex;
    align-items: center;
    min-height: 52px;
    padding: 4px 0;
  }

  h1 {
    margin: 6px 0 6px;
  }

  .sub {
    margin: 0 0 14px;
    color: var(--ink-muted);
  }

  .wege {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 16px;
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius-full);
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(15 * var(--px));
    font-weight: 600;
    cursor: pointer;
  }

  .chip.on {
    border-color: var(--ink);
    background: var(--surface);
  }

  .klein,
  .hinweis {
    margin: 10px 2px 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: 1.4;
  }

  .schritt {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 26px 2px 8px;
    font-size: calc(16 * var(--px));
    font-weight: 650;
  }

  .nr {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--ink);
    color: var(--ground);
    font-size: calc(13 * var(--px));
  }

  .ueber {
    min-height: 44px;
    margin-left: auto;
    padding: 0 2px;
    border: 0;
    background: none;
    color: var(--ink-muted);
    font: inherit;
    font-size: calc(13 * var(--px));
    font-weight: 500;
    cursor: pointer;
  }

  .blatt {
    padding: 4px 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .mt {
    margin: 10px 0 4px;
    line-height: 1.45;
    white-space: pre-line;
  }

  textarea {
    box-sizing: border-box;
    width: 100%;
    margin-top: 10px;
    padding: 10px 12px;
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    background: var(--ground);
    color: var(--ink);
    font: inherit;
    line-height: 1.45;
    resize: vertical;
  }

  .mini {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent-text);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 600;
    cursor: pointer;
  }

  .wz {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
  }

  .wz:last-child {
    border-bottom: 0;
  }

  .wz .l {
    flex: 0 0 110px;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }

  .wz .v {
    flex: 1 1 160px;
    min-width: 0;
  }

  .wz .mini {
    margin-left: auto;
    min-height: 36px;
  }

  .mp {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    border-bottom: 1px solid var(--line);
  }

  .mp :global(svg) {
    flex: none;
    color: var(--ink-muted);
  }

  .mpf {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0 12px;
    padding-top: 4px;
  }

  .mpf small {
    color: var(--ink-muted);
    font-size: calc(13.5 * var(--px));
  }

  .cta {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 54px;
    padding: 0 20px;
    border: 0;
    border-radius: var(--radius-full);
    background: var(--action);
    color: var(--on-action);
    font: inherit;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  .btn.zweit {
    border: 1.5px solid var(--ink);
    background: transparent;
    color: var(--ink);
  }

  .cta small {
    color: var(--ink-muted);
    font-size: calc(13.5 * var(--px));
    text-align: center;
  }

  .meldung {
    margin: 0;
    color: var(--ink);
    font-size: calc(14 * var(--px));
    text-align: center;
  }
</style>
