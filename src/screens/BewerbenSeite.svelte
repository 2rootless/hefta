<script lang="ts">
  import { tick } from 'svelte';
  import { telefonFuerMappe } from '../domain/telefon';
  import { heftOrt, zurueckZumHeft } from '../domain/heftKarte';
  // Bewerben in einer Minute (Zeile 8, B23 `s=bewerben`, B12a, Planung 11i): Weg wählen (Portal, Mail,
  // Website), dann vier Schritte als Angebot: Anschreiben, was das Inserat wissen will, Mappe, Abschicken.
  // Jeder Schritt lässt sich überspringen. Hefta verschickt nichts selbst; es merkt sich, was hinausging,
  // und fragt danach einmal „Stimmt der Stand?“ im Heft, wenn es das Absenden nicht sicher weiß.
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { zurueckGehen } from '../app/router.svelte';
  import { adresseZeilen } from '../domain/adresse';
  import {
    anschreibenText,
    betreffWohnung,
    bewerbungsText,
    einzugText,
    wegVorschlag,
    werZiehtEin,
    type BewerbungsWeg,
  } from '../domain/bewerben';
  import { ansichtFuerHeft } from '../domain/buergschaft';
  import { spurAn, spurEintragen } from '../domain/datenspur';
  import { deckZeilen } from '../domain/deckZeilen';
  import {
    bloecke,
    ohneUnterlagen,
    standardEinstellungen,
    type ExportEinstellungen,
  } from '../domain/export';
  import type { HeftEreignisse } from '../domain/modell';
  import { angabenWerte, erkennen } from '../domain/nachricht';
  import { listenText, ohneTrennstellen } from '../domain/regelkatalog';
  import { haushaltFuerHeft } from '../domain/haushaltUnterlagen';
  import { tagAus } from '../domain/fristen';
  import { einziehend } from '../domain/selbstauskunft';
  import { t, type TextSchluessel } from '../i18n';
  import { groesseWieDateien, mailZuGross } from '../domain/mailGroesse';
  import { heftAendern } from '../storage/speicher';
  import {
    mailMitMappe,
    mappeHaengtNichtAn,
    mappeTeilen,
    textKopieren,
  } from '../ui/bewerbenSenden';
  import { unterlagenZahl, type MappenErgebnis } from '../ui/mappeErstellen';
  import { staendeAus } from '../ui/mappeDaten';
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';
  import UnlesbarBlatt from '../ui/UnlesbarBlatt.svelte';
  import type { UnlesbareDatei } from '../pdf/bewerbung';
  import { unlesbarMerken } from '../app/unlesbar.svelte';

  let { id }: { id: string } = $props();

  const heft = $derived(daten.hefte.find((h) => h.id === id) ?? null);
  // DP49 Punkt 5: Die Mappe dieses Hefts nimmt die Bürgschaftserklärung für dieses Heft.
  const ansicht = $derived(daten.ansicht ? ansichtFuerHeft(daten.ansicht, id) : null);
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

  // Schritt 3: Mappe. Vorgabe „Nur, was verlangt ist“ (E49), „Alles mitschicken“ ist einen Tipp entfernt.
  let alles = $state(false);
  // PC126 K5 (DP83 a): „Diesmal weglassen“ gilt für diesen Besuch; die Unterlage bleibt in Hefta.
  let weggelassen = $state<{ personId: string; typ: string }[]>([]);
  // W49: „Kleiner machen ›“ verkleinert Scans und Bilder für diesen Besuch (X6c), wie in „Mappe erstellen“.
  let kleiner = $state(false);
  const einstellungen = $derived<ExportEinstellungen>(
    ohneUnterlagen(
      {
        ...standardEinstellungen(),
        ...(heft?.export ?? {}),
        ...(alles ? { modus: 'alles' as const } : {}),
        ...(kleiner ? { kleiner: true } : {}),
      },
      ansicht ? staendeAus(ansicht, heute) : [],
      weggelassen,
    ),
  );
  // Schritt 1: Anschreiben. „Ändern“ macht daraus einen eigenen Text für diesen Besuch.
  // W37: Die Bausteine wählt die Kennung des Hefts; „Andere Fassung“ zählt alle eins weiter, für diesen Besuch.
  let versatz = $state(0);
  const vorschlag = $derived(
    anschreibenText({
      wir: ihr,
      anbieter: heft?.angaben?.anbieter,
      strasse,
      einzug: heft?.einzug ?? '',
      heute,
      weg: weg ?? 'mail',
      // PC126 K5: Nach „Diesmal weglassen“ (oder mit eigener Auswahl) liegen nicht die üblichen Unterlagen bei.
      eigeneAuswahl: einstellungen.modus === 'eigene_auswahl',
      heftId: heft?.id,
      versatz,
      inserat: !!(heft?.inseratText?.trim() || heft?.link),
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
        schluss: vorschlag.schluss,
        gruss: vorschlag.gruss,
        angaben,
        name: person ? `${person.vorname} ${person.nachname}`.trim() : '',
        telefon: (person && telefonFuerMappe(person.kontakt)?.anzeige) ?? '',
        mail: person?.kontakt.email ?? '',
      }),
  );

  const unterlagen = $derived.by(() => {
    if (!ansicht) return [];
    const namen: string[] = [];
    // DP45 G1 (W28): Was das Heft vom Haushalt auswählt, steht vor den Personen.
    for (const h of haushaltFuerHeft(
      ansicht.haushaltDokumente,
      ansicht.versionen,
      heft,
      tagAus(heute),
    ))
      namen.push(
        h.typ === 'wbs' ? t('haushaltUnterlagen.wbs') : t('haushaltUnterlagen.mitgliedschaft'),
      );
    for (const b of bloecke(staendeAus(ansicht, heute), einstellungen))
      for (const teil of b.teile) {
        const name =
          b.person.rolle === 'buerge' && teil.stand.typ.id === 'buergschaftserklaerung'
            ? t('bewerben.buergschaftVon', {
                name: b.person.person.rufname || b.person.person.vorname,
              })
            : // DP70 K1-3 (2.0.1): Die weichen Trennstellen bleiben, damit lange Wörter bei großem Zoom umbrechen.
              listenText(teil.stand.typ);
        if (!namen.some((n) => ohneTrennstellen(n) === ohneTrennstellen(name))) namen.push(name);
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
          // DP45 G1 (W28): Sozialwohnung, dann mit dem Schein des Haushalts.
          sozialwohnung: heft.sozialwohnung,
          wbsAbgelaufenMit: heft.wbsAbgelaufenMit,
          genossenschaft: heft.genossenschaft,
        },
        $state.snapshot(einstellungen) as ExportEinstellungen,
      );
      gebautFuer = schluessel;
      unlesbarMerken(mappe.unlesbar.map((u) => u.datei));
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
          // PC95 N3: so viele wie „Was beiliegt“ auf dem Deckblatt, nicht die Arten der Liste oben.
          unterlagen: unterlagenZahl(m),
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

  // W37 (PD101 U2): die Straße wie im Heft, ohne Straße „in“ und der Ort, ohne beides nur „die Wohnung“.
  const imBetreff = $derived(heft ? betreffWohnung(strasse, heftOrt(heft)) : '');
  const betreff = $derived(
    imBetreff ? t('bewerben.betreff', { wohnung: imBetreff }) : t('bewerben.betreffOhne'),
  );

  // PC81 B2 (QA3): Im Browser ohne Teilen von Dateien steht gleich oben, dass ihr die Mappe selbst anhängt.
  const ohneAnhang = mappeHaengtNichtAn();

  // PC126 K5: Lässt sich eine Datei nicht öffnen, öffnet sich keine Mail und nichts wird geteilt, bis gewählt ist.
  let blattDatei = $state<UnlesbareDatei | null>(null);
  let blattOffen = $state(false);
  // PC132 (DP84 U4, U5): Nach „Diesmal weglassen“ geht es mit „Mail“ bzw. „Teilen“ weiter, mit der Mappe ohne die
  // Unterlage; der Satz der Mail folgt der eigenen Auswahl.
  let wartend: (() => Promise<void>) | null = null;
  function angehalten(m: MappenErgebnis, weiter: () => Promise<void>): boolean {
    const erste = m.unlesbar[0];
    if (!erste) return false;
    blattDatei = erste;
    blattOffen = true;
    wartend = weiter;
    return true;
  }
  async function weglassen(d: UnlesbareDatei) {
    if (!d.personId || !d.typ) return;
    weggelassen = [...weggelassen, { personId: d.personId, typ: d.typ }];
    const weiter = wartend;
    wartend = null;
    await tick();
    await weiter?.();
  }

  async function mail() {
    meldung = '';
    const m = await mappeHolen();
    if (!m || angehalten(m, mail)) return;
    const a = await mailMitMappe({ an: erkannt.mail, betreff, text, dateien: m.dateien });
    if (a === 'abgebrochen') return;
    // PC81 B2: Steht der Satz schon oben, wiederholt ihn die Meldung nicht.
    if (a === 'anhangSelbst' && !ohneAnhang) meldung = t('bewerben.anhangSelbst');
    await beworbenMerken('mail', a === 'gesendet', m);
    // PC8 A6: Nach dem Senden zurück ins Heft; dort steht „Beworben“ oder der Vorschlag dazu. Nur wenn
    // ihr die Mappe noch selbst anhängen müsst, bleibt der Hinweis dazu hier stehen.
    if (a !== 'anhangSelbst') zurueckGehen(`/heft/${id}`);
  }

  async function kopieren(was: string, inhalt: string, merken: boolean) {
    meldung = (await textKopieren(inhalt)) ? t('bewerben.kopiert') : t('bewerben.nichtKopiert');
    if (merken && weg) await beworbenMerken(weg, false);
    void was;
  }

  async function teilen() {
    meldung = '';
    const m = await mappeHolen();
    if (!m || !weg || angehalten(m, teilen)) return;
    const r = await mappeTeilen(m.dateien, weg);
    // PC31: WhatsApp, Dateien, Drucken … zählen nie als Bewerbung; dann bleibt alles, wie es war.
    if (r.wertung === 'nichts') return;
    await beworbenMerken(weg, r.wertung === 'gesendet', m, r.ueber);
    zurueckGehen(`/heft/${id}`);
  }

  const SCHRITTE = ['anschreiben', 'angaben', 'mappe', 'abschicken'] as const;
  // Planung 12z: mit Leerzeichen vor und nach dem Punkt; als Wert, sonst kürzt Svelte die Leerzeichen.
  const TRENNER = ' · ';
</script>

{#snippet kopf(nr: number)}
  {@const schritt = SCHRITTE[nr - 1]!}
  <h2 class="schritt" id="schritt-{schritt}">
    <!-- Nummer und Titel als Einheit. PC20 (B8): „Diesen Schritt auslassen“ entfällt. -->
    <span class="titelzeile"
      ><span class="nr" aria-hidden="true">{nr}</span><span>{t(`bewerben.schritt.${schritt}`)}</span
      ></span
    >
  </h2>
{/snippet}

<main class="seite">
  <header class="kopf">
    <Zurueck href={`#/heft/${id}`} text={zurueckZumHeft(heft) ?? t('termin.zurueck')} />
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
          : ohneAnhang
            ? t('bewerben.anhangSelbst')
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
        <!-- PC8 B4: „Kopieren“ oben am Text, den er kopiert; der Text selbst ist markierbar. -->
        <div class="mt-kopf">
          <button
            class="mini"
            type="button"
            aria-label={t('bewerben.kopierenLabel', { was: t('bewerben.anschreibenLabel') })}
            onclick={() => kopieren('text', text, weg === 'portal')}
            ><Symbol name="kopieren" groesse={16} /><span>{t('bewerben.kopieren')}</span></button
          >
        </div>
        <p class="mt">{text}</p>
        <div class="mt-fuss">
          <button class="mini" type="button" onclick={() => (aendert = true)}
            >{t('bewerben.aendern')}</button
          >
          <!-- W37: Was ihr selbst geändert habt, bleibt; dann gibt es keine andere Fassung mehr. -->
          {#if eigenerText === null}
            <button class="mini" type="button" onclick={() => versatz++}
              >{t('bewerben.andereFassung')}</button
            >
          {/if}
        </div>
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
            })}{#if weg === 'mail'}, <span class="mailgroesse"
                >{groesseWieDateien(mappe.groesse)}</span
              >{/if}{/if}</small
        >
        <button class="mini" type="button" onclick={() => (alles = !alles)}
          >{t(alles ? 'bewerben.nurVerlangtMitschicken' : 'bewerben.allesMitschicken')}</button
        >
      </div>
      {#if weg === 'mail' && mappe && !mappeBaut && mailZuGross(mappe.groesse)}
        <!-- W49: ein Hinweis in Grau, keine Warnung (W5): kein Bernstein, kein Warnzeichen. -->
        <p class="hinweis mailgross">
          {t('bewerben.mailGross')}{#if !kleiner}
            <button class="textknopf" type="button" onclick={() => (kleiner = true)}
              >{t('bewerben.kleinerMachen')}</button
            >{/if}
        </p>
      {/if}
      {#if mappeBaut}<p class="hinweis" role="status">{t('bewerben.mappeBaut')}</p>{/if}
      {#if mappeFehler}<p class="hinweis" role="alert">{t('bewerben.mappeFehler')}</p>{/if}
    </div>

    {@render kopf(4)}
    <div class="cta">
      {#if weg === 'mail'}
        <button class="btn" type="button" onclick={mail}
          ><Symbol name="mail" groesse={20} />{t(
            ohneAnhang ? 'bewerben.mappeLadenMailOeffnen' : 'bewerben.mailOeffnen',
          )}</button
        >
      {:else if weg === 'portal'}
        <button class="btn" type="button" onclick={teilen}
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

<UnlesbarBlatt bind:offen={blattOffen} datei={blattDatei} {weglassen} />

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
    /* B28b (DP21 Abschnitt 4): Flächen ohne Rahmen, gewählt in Tinte. */
    border: 0;
    border-radius: var(--radius-full);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: calc(15 * var(--px));
    font-weight: 600;
    cursor: pointer;
  }

  .chip.on {
    background: var(--action);
    color: var(--on-action);
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
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    margin: 26px 2px 8px;
    font-size: calc(16 * var(--px));
    font-weight: 650;
  }

  .titelzeile {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 10px;
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

  /* Die vier Schritte als weiche Flächen ohne Linie (DP21). */
  .blatt {
    padding: 4px 16px;
    border-radius: 20px;
    background: var(--surface);
  }

  .mt-kopf {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .mt-fuss {
    display: flex;
    flex-wrap: wrap;
    column-gap: 24px;
  }

  .mt {
    margin: 10px 0 4px;
    line-height: 1.45;
    white-space: pre-line;
    -webkit-touch-callout: default;
    -webkit-user-select: text;
    user-select: text;
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

  /* W49: Textknopf in Tinte im grauen Satz, mit Tippfläche ab 44 px. */
  .textknopf {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }

  .mailgroesse {
    white-space: nowrap;
  }

  .mini {
    /* DP35 R3: Aktion in Tinte; Rot nur für Zurück und Warnungen. */
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
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

  /* „Mappe teilen“ als weiche Fläche statt Rahmen (DP21). */
  .btn.zweit {
    background: var(--surface);
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
