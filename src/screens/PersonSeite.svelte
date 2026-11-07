<script lang="ts">
  // Eigene Seite zum Hinzufügen und Ändern einer Person (Entscheidung F; design/person-und-haushalt.md).
  // Hinzufügen: gibt es Herausgenommene, zuerst „Schon in Hefta“ (K1); beim Eintippen ein Namensabgleich
  // (K1b); eine bekannte Person kommt nach einer Bestätigung mit allen Unterlagen dazu (K2).
  // Ändern: zwei Abschnitte, „In eurem Haushalt · gilt nur hier“ und „Über Lea · gilt überall“ (K3b).
  import { ueberTastatur } from '../ui/ueberTastatur';
  import { einmal } from '../ui/einmal';
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { abschliessen, zurueckGehen } from '../app/router.svelte';
  import { rufnameFolgt, type Rolle } from '../domain/modell';
  import { gleicherName, lateinFehlt, nameMappeAus } from '../domain/namen';
  import {
    dokumenttyp,
    listenText,
    personStand,
    situationText,
    rollenText,
  } from '../domain/regelkatalog';
  import { t, tagZusammen } from '../i18n';
  import {
    mitgliedHerausnehmen,
    mitgliedHinzufuegen,
    mitgliedZurueckholen,
    personAendern,
    rolleWechseln,
    farbeSetzen,
    zugehoerigkeitAendern,
    type Mitglied,
  } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import Eintragen from '../ui/Eintragen.svelte';
  import Notiz from '../ui/Notiz.svelte';
  import FarbWahl from '../ui/FarbWahl.svelte';
  import PersonFormular, { type PersonEingabe } from '../ui/PersonFormular.svelte';
  import Symbol from '../ui/Symbol.svelte';

  let {
    neueRolle = null,
    personId = null,
    zurueckZu,
  }: {
    neueRolle?: Extract<Rolle, 'mitmieter' | 'buerge'> | null;
    personId?: string | null;
    zurueckZu: string;
  } = $props();

  const mitglied = $derived(
    personId ? daten.ansicht?.mitglieder.find((m) => m.person.id === personId) : undefined,
  );
  // HA1: „Im Mietvertrag“ oder „Bürgschaft“; gespeichert wird erst mit „Speichern“.
  const bisher = $derived(mitglied?.zugehoerigkeit.rolle ?? null);
  let buergeWahl = $state<boolean | null>(null);
  const rolle = $derived<Rolle>(
    !bisher
      ? (neueRolle ?? 'mitmieter')
      : buergeWahl === null || buergeWahl === (bisher === 'buerge')
        ? bisher
        : buergeWahl
          ? 'buerge'
          : 'mitmieter',
  );
  const imVertrag = $derived(
    (daten.ansicht?.mitglieder ?? []).filter((m) => m.zugehoerigkeit.rolle !== 'buerge'),
  );
  let alleinHinweis = $state(false);

  function rolleWaehlen(buerge: boolean) {
    alleinHinweis = buerge && bisher !== 'buerge' && imVertrag.length === 1;
    if (!alleinHinweis) buergeWahl = buerge;
  }
  const bekannte = $derived(daten.ansicht?.herausgenommen ?? []);

  // Hinzufügen: Auswahl (K1), Formular (K1/K1b) oder Bestätigung einer bekannten Person (K2).
  let schritt = $state<'auswahl' | 'formular' | 'bekannt'>('formular');
  let gewaehlt = $state<Mitglied | null>(null);
  let gestartet = false;
  $effect(() => {
    if (gestartet || !daten.geladen || personId) return;
    gestartet = true;
    if (bekannte.length) schritt = 'auswahl';
  });

  let werte = $state<PersonEingabe>({
    vorname: '',
    nachname: '',
    rufname: '',
    bezeichnung: null,
    lebenssituation: 'angestellt',
  });
  let farbe = $state(1);
  // Wer sonst im Haushalt welche Farbe hat (PF1).
  const vergebeneFarben = $derived(
    (daten.ansicht?.mitglieder ?? [])
      .filter((m) => m.person.id !== personId)
      .map((m) => ({
        farbe: m.zugehoerigkeit.farbe,
        name: m.person.rufname || m.person.vorname,
      })),
  );
  let vorbelegt = false;
  $effect(() => {
    if (mitglied && !vorbelegt) {
      vorbelegt = true;
      farbe = mitglied.zugehoerigkeit.farbe;
      werte = {
        vorname: mitglied.person.vorname,
        nachname: mitglied.person.nachname,
        rufname: mitglied.person.rufname,
        nameMappe: mitglied.person.nameMappe ?? null,
        bezeichnung: mitglied.zugehoerigkeit.bezeichnung,
        lebenssituation: mitglied.person.lebenssituation ?? 'angestellt',
        ausbildungArt: mitglied.person.ausbildungArt ?? null,
      };
    }
  });

  // Die Folgen stehen vor dem Speichern da (HA1).
  const folgen = $derived.by(() => {
    if (!mitglied || !bisher || rolle === bisher) return null;
    const name = mitglied.person.rufname || mitglied.person.vorname;
    const form = { weiblich: 'weiblich', maennlich: 'maennlich', neutral: 'neutral' }[
      werte.bezeichnung ?? 'neutral'
    ] as 'weiblich' | 'maennlich' | 'neutral';
    const p = {
      weiblich: { Ihre: 'Ihre', ihre: 'ihre', ihrer: 'ihrer' },
      maennlich: { Ihre: 'Seine', ihre: 'seine', ihrer: 'seiner' },
      neutral: { Ihre: 'Die', ihre: 'die', ihrer: 'der' },
    }[form];
    if (rolle === 'buerge') {
      const naechste = imVertrag.find(
        (m) => m.zugehoerigkeit.rolle === 'mitmieter' && m.person.id !== mitglied.person.id,
      );
      return {
        titel: t('personSeite.folgen.buergeTitel', { name }),
        liste: [
          t('personSeite.folgen.buergeKarte', p),
          t('personSeite.folgen.buergeErklaerung'),
          t('personSeite.folgen.buergeAngaben', p),
          ...(bisher === 'hauptmieter' && naechste
            ? [
                t('personSeite.folgen.neueErste', {
                  name: naechste.person.rufname || naechste.person.vorname,
                  rolle: rollenText('hauptmieter', naechste.zugehoerigkeit.bezeichnung),
                }),
              ]
            : []),
        ],
      };
    }
    const letzte = imVertrag.at(-1);
    const erklaerung = unterlagenVon(mitglied.person.id).some(
      (d) => d.typ === 'buergschaftserklaerung',
    );
    return {
      titel: t('personSeite.folgen.vertragTitel', { name }),
      liste: [
        t('personSeite.folgen.vertragKarte', {
          ...p,
          nach: letzte ? letzte.person.rufname || letzte.person.vorname : '',
        }),
        erklaerung
          ? t('personSeite.folgen.vertragErklaerungDa')
          : t('personSeite.folgen.vertragErklaerung'),
        t('personSeite.folgen.vertragAngaben', p),
      ],
    };
  });

  /** Unterlagen, die eine Person schon hat (Dokumente mit mindestens einer Version). */
  function unterlagenVon(id: string) {
    const ansicht = daten.ansicht;
    if (!ansicht) return [];
    return ansicht.dokumente.filter(
      (d) => d.personId === id && ansicht.versionen.some((v) => v.dokumentId === d.id),
    );
  }

  function tagMonat(iso: string | null | undefined): string {
    if (!iso) return '';
    return tagZusammen(
      new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(new Date(iso)),
    );
  }

  const treffer = $derived(
    !personId && schritt === 'formular'
      ? bekannte.find((b) => gleicherName(werte, b.person))
      : undefined,
  );

  function waehlen(m: Mitglied) {
    gewaehlt = m;
    werte = { ...werte, bezeichnung: m.zugehoerigkeit.bezeichnung };
    schritt = 'bekannt';
    window.scrollTo(0, 0);
  }

  // Was mitkommt, und ob danach gleich etwas offen ist (K2).
  const mitkommend = $derived.by(() => {
    if (!gewaehlt || !daten.ansicht) return null;
    const docs = unterlagenVon(gewaehlt.person.id);
    const namen = [
      ...(gewaehlt.person.selbstauskunft ? ['selbstauskunft'] : []),
      ...docs.map((d) => d.typ),
    ]
      .map((id) => dokumenttyp(id))
      .filter((x) => !!x)
      .map((x) => listenText(x!));
    const stand = personStand(
      gewaehlt.person,
      { rolle, farbe: 1, bezeichnung: werte.bezeichnung ?? 'neutral' },
      daten.ansicht.dokumente,
      daten.ansicht.versionen,
    );
    const offen = stand.unterlagen.filter((u) => u.status === 'bald' || u.status === 'fehlt');
    return { namen: [...new Set(namen)], offen: offen.length };
  });

  const titel = $derived(
    mitglied
      ? t('personSeite.titelAendern', { name: mitglied.person.vorname })
      : schritt === 'bekannt' && gewaehlt
        ? t('personSeite.kommtDazu', { name: gewaehlt.person.vorname })
        : rolle === 'buerge'
          ? t('personSeite.titelBuerge')
          : t('personSeite.titelMitmieter'),
  );
  const lead = $derived(
    mitglied
      ? ''
      : schritt === 'bekannt'
        ? t('personSeite.kommtDazuLead')
        : rolle === 'buerge'
          ? t('personSeite.leadBuerge')
          : t('personSeite.leadMitmieter'),
  );
  const grund = $derived(
    schritt !== 'bekannt' && !werte.vorname.trim()
      ? t('personSeite.grundName')
      : schritt !== 'bekannt' && lateinFehlt(werte)
        ? t('personSeite.grundLatein')
        : !werte.bezeichnung
          ? t('einrichtung.erste.grundBezeichnung')
          : undefined,
  );

  let speichert = $state(false);

  async function speichern() {
    if (grund || speichert || !werte.bezeichnung || !daten.ansicht) return;
    speichert = true;
    const verbindung = await db();
    if (schritt === 'bekannt' && gewaehlt) {
      await mitgliedZurueckholen(verbindung, gewaehlt.zugehoerigkeit.id, {
        rolle,
        bezeichnung: werte.bezeichnung,
      });
    } else {
      const angaben = {
        vorname: werte.vorname.trim(),
        nachname: werte.nachname.trim(),
        rufname: werte.rufname.trim(),
        nameMappe: nameMappeAus(werte),
        lebenssituation: werte.lebenssituation,
        ausbildungArt: werte.ausbildungArt ?? null,
      };
      if (mitglied) {
        await personAendern(verbindung, mitglied.person.id, {
          ...angaben,
          rufname: rufnameFolgt(mitglied.person.vorname, angaben.vorname, angaben.rufname),
        });
        await zugehoerigkeitAendern(verbindung, mitglied.zugehoerigkeit.id, {
          bezeichnung: werte.bezeichnung,
        });
        await farbeSetzen(verbindung, mitglied.zugehoerigkeit.id, farbe);
        if (rolle !== mitglied.zugehoerigkeit.rolle)
          await rolleWechseln(verbindung, mitglied.zugehoerigkeit.id, rolle);
      } else {
        await mitgliedHinzufuegen(verbindung, daten.ansicht.haushalt.id, {
          ...angaben,
          bezeichnung: werte.bezeichnung,
          rolle,
        });
      }
    }
    await neuLaden();
    abschliessen(zurueckZu);
  }

  async function herausnehmenRoh() {
    if (!mitglied) return;
    await mitgliedHerausnehmen(await db(), mitglied.zugehoerigkeit.id);
    await neuLaden();
    abschliessen(zurueckZu.startsWith('/person/') ? '/haushalt' : zurueckZu);
  }
  const herausnehmen = einmal(herausnehmenRoh);

  function zurueck(e: MouseEvent) {
    // Aus der Bestätigung zurück zur Auswahl, sonst die Seite verlassen, wie mit der Wischgeste.
    e.preventDefault();
    if (schritt === 'bekannt') {
      schritt = bekannte.length ? 'auswahl' : 'formular';
      gewaehlt = null;
    } else zurueckGehen(zurueckZu);
  }
</script>

{#snippet abschnitt(titelText: string, hinweis: string)}
  <div class="abschnitt-kopf">
    <h2>{titelText}</h2>
    <small>{hinweis}</small>
  </div>
{/snippet}

<main class="seite">
  <div class="kopf">
    <a class="zurueck" href="#{zurueckZu}" onclick={zurueck}
      ><Symbol name="zurueck" groesse={20} />{schritt === 'bekannt'
        ? t('personSeite.zurueck')
        : t('personSeite.abbrechen')}</a
    >
  </div>
  {#if personId && !mitglied}
    <p>{t('personSeite.nichtGefunden')}</p>
  {:else}
    <div class="titelblock">
      <h1 class="display frage">{titel}</h1>
      {#if lead}<p class="lead">{lead}</p>{/if}
    </div>

    {#if mitglied}
      <!-- K3b: zwei Abschnitte -->
      <section class="teil">
        {@render abschnitt(t('personSeite.inEuremHaushalt'), t('personSeite.giltNurHier'))}
        <div class="kasten">
          <PersonFormular bind:werte {rolle} teil="haushalt" fokus={false}>
            {#snippet rollenWahl()}
              <fieldset class="rollen">
                <legend>{t('personSeite.rolle')}</legend>
                <div class="segmente" role="radiogroup">
                  <button
                    type="button"
                    class="chip"
                    role="radio"
                    aria-checked={rolle !== 'buerge'}
                    onclick={() => rolleWaehlen(false)}>{t('personSeite.imVertrag')}</button
                  >
                  <button
                    type="button"
                    class="chip"
                    role="radio"
                    aria-checked={rolle === 'buerge'}
                    onclick={() => rolleWaehlen(true)}>{t('personSeite.buergschaft')}</button
                  >
                </div>
              </fieldset>
            {/snippet}
          </PersonFormular>
          {#if alleinHinweis}
            <Notiz stark><p role="status">{t('personSeite.folgen.allein')}</p></Notiz>
          {:else if folgen}
            <Notiz stark>
              <p class="folgen-titel" role="status"><b>{folgen.titel}</b></p>
              <ul class="folgen">
                {#each folgen.liste as punkt, i (i)}<li>{punkt}</li>{/each}
              </ul>
            </Notiz>
          {:else}
            <p class="satz">{t(`personSeite.rolleSatz.${rolle}`)}</p>
          {/if}
          {#if rolle !== 'hauptmieter'}
            <button type="button" class="textlink links" onclick={herausnehmen}
              >{t('personSeite.ausHaushaltNehmen')}</button
            >
          {/if}
        </div>
      </section>
      <section class="teil">
        {@render abschnitt(
          t('personSeite.ueber', { name: mitglied.person.vorname }),
          t('personSeite.giltUeberall'),
        )}
        <div class="kasten">
          <PersonFormular
            bind:werte
            {rolle}
            teil="person"
            fokus={false}
            gespeichert={mitglied.person}
            gespeicherteTypen={unterlagenVon(mitglied.person.id).map((d) => d.typ)}
          />
          <FarbWahl
            bind:farbe
            ursprung={mitglied.zugehoerigkeit.farbe}
            vergeben={vergebeneFarben}
          />
        </div>
      </section>
      {#if rolle !== 'hauptmieter'}
        <a class="textlink ganz" href="#/person-loeschen/{mitglied.person.id}"
          >{t('personSeite.ganzLoeschenLink', { name: mitglied.person.vorname })}</a
        >
      {/if}
    {:else if schritt === 'auswahl'}
      <!-- K1: Schon in Hefta -->
      <section class="teil">
        <h2 class="liste-titel">{t('personSeite.schonInMappe')}</h2>
        <ul class="kasten bekannte">
          {#each bekannte as b (b.person.id)}
            {@const zahl = unterlagenVon(b.person.id).length}
            <li>
              <button type="button" class="bekannt" onclick={() => waehlen(b)}>
                <span class="kreis farbe-{b.zugehoerigkeit.farbe}" aria-hidden="true"
                  >{b.person.vorname.slice(0, 1)}</span
                >
                <span class="tx">
                  <b>{b.person.vorname} {b.person.nachname}</b>
                  <small
                    >{t('personSeite.herausgenommenAm', {
                      datum: tagMonat(b.zugehoerigkeit.herausgenommenAm),
                    })} · {t('personSeite.unterlagenZahl', { anzahl: zahl })}</small
                  >
                </span>
                <Symbol name="weiter" groesse={20} />
              </button>
            </li>
          {/each}
        </ul>
        <p class="satz">{t('personSeite.mitAllen')}</p>
      </section>
      <div class="neu">
        <Eintragen
          unterlage={t('personSeite.neuAnlegen')}
          grund={t('personSeite.neuAnlegenHinweis')}
          onclick={() => (schritt = 'formular')}
        />
      </div>
    {:else if schritt === 'bekannt' && gewaehlt && mitkommend}
      <!-- K2: Bestätigung -->
      <div class="kasten oben">
        <div class="zeile">
          <b>{gewaehlt.person.vorname} {gewaehlt.person.nachname}</b>
          <small
            >{[
              gewaehlt.person.lebenssituation
                ? situationText(gewaehlt.person.lebenssituation, gewaehlt.person.ausbildungArt)
                : '',
              gewaehlt.person.kontakt.email || gewaehlt.person.kontakt.telefon,
            ]
              .filter(Boolean)
              .join(' · ')}</small
          >
        </div>
        <div class="zeile">
          <b
            >{mitkommend.namen.length
              ? t('personSeite.kommenMit', { anzahl: mitkommend.namen.length })
              : t('personSeite.keineUnterlagen')}</b
          >
          {#if mitkommend.namen.length}<small>{mitkommend.namen.join(', ')}</small>{/if}
        </div>
      </div>
      <section class="teil">
        {@render abschnitt(t('personSeite.inEuremHaushalt'), t('personSeite.giltNurHier'))}
        <div class="kasten">
          <PersonFormular bind:werte {rolle} teil="haushalt" fokus={false} />
        </div>
      </section>
      {#if mitkommend.offen}
        <p class="info">
          <Symbol name="info" groesse={20} /><span
            >{t('personSeite.offenHinweis', { anzahl: mitkommend.offen })}</span
          >
        </p>
      {/if}
    {:else}
      <!-- Formular, mit Namensabgleich (K1b) -->
      <div class="inhalt">
        <PersonFormular bind:werte {rolle} fokus>
          {#snippet nachName()}
            {#if treffer}
              {@const zahl = unterlagenVon(treffer.person.id).length}
              <div class="abgleich" role="status" use:ueberTastatur>
                <span class="kreis farbe-{treffer.zugehoerigkeit.farbe}" aria-hidden="true"
                  >{treffer.person.vorname.slice(0, 1)}</span
                >
                <p>
                  <b>{treffer.person.vorname} {treffer.person.nachname}</b>
                  {t('personSeite.abgleich', {
                    zahl: t('personSeite.unterlagenZahl', { anzahl: zahl }),
                  })}
                </p>
                <button type="button" class="nehmen" onclick={() => waehlen(treffer)}
                  >{t('personSeite.abgleichNehmen')}</button
                >
              </div>
              <p class="satz">{t('personSeite.abgleichAnders')}</p>
            {/if}
          {/snippet}
        </PersonFormular>
      </div>
    {/if}
  {/if}
</main>
{#if mitglied || schritt !== 'auswahl'}
  <Aktionsleiste
    text={mitglied ? t('personSeite.speichern') : t('personSeite.hinzufuegen')}
    {grund}
    onclick={speichern}
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

  .zurueck {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: var(--tap-target);
    color: var(--ink);
    font-size: calc(15 * var(--px));
    font-weight: 700;
    text-decoration: none;
  }

  .titelblock {
    padding: 6px var(--space-1) 0;
  }

  .frage {
    margin-top: 10px;
    text-wrap: balance;
  }

  .inhalt {
    display: grid;
    gap: var(--space-4);
    margin-top: var(--space-5);
  }

  .teil {
    margin-top: var(--space-5);
  }

  .rollen {
    margin: 0;
    padding: 0;
    border: 0;
  }

  .rollen legend {
    margin-bottom: var(--space-2);
    padding: 0;
    font-size: calc(14 * var(--px));
    font-weight: 700;
  }

  .folgen-titel {
    margin: 0;
  }

  .folgen {
    margin: 6px 0 0;
    padding-left: 18px;
  }

  .folgen li + li {
    margin-top: 4px;
  }

  .abschnitt-kopf {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin: 0 var(--space-1) 8px;
  }

  .abschnitt-kopf h2,
  .liste-titel {
    margin: 0;
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 800;
  }

  .liste-titel {
    margin: 0 var(--space-1) 8px;
  }

  .abschnitt-kopf small {
    font-size: calc(13 * var(--px));
    color: var(--ink-muted);
  }

  .kasten {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 14px;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
  }

  .oben {
    margin-top: var(--space-5);
  }

  .satz {
    margin: 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .teil > .satz {
    margin: 10px var(--space-1) 0;
  }

  .links {
    justify-self: start;
  }

  .ganz {
    display: flex;
    align-items: center;
    width: max-content;
    min-height: var(--tap-target);
    margin: var(--space-5) auto 0;
  }

  .bekannte {
    gap: 0;
    padding: 4px 14px;
  }

  .bekannte li + li {
    border-top: 1px solid var(--track);
  }

  .bekannt {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 60px;
    padding: 8px 0;
    border: 0;
    background: none;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .tx {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .tx b,
  .zeile b {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .tx small,
  .zeile small {
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
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

  .neu {
    margin-top: var(--space-4);
    --on-person: var(--ink);
    --on-person-muted: var(--ink-muted);
    --slot-fill: var(--ground);
  }

  .zeile {
    display: grid;
  }

  .zeile + .zeile {
    padding-top: var(--space-3);
    border-top: 1px solid var(--track);
  }

  .info {
    display: flex;
    gap: 10px;
    margin: var(--space-4) 0 0;
    padding: 14px;
    border-radius: 16px;
    background: var(--surface);
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .info :global(svg) {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .abgleich {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border: 2px solid var(--ink);
    border-radius: 16px;
    background: var(--surface);
  }

  .abgleich p {
    flex: 1 1 min(11em, calc(100% - 42px));
    min-width: 0;
    margin: 0;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }

  .nehmen {
    flex-shrink: 0;
    margin-left: auto;
    min-height: var(--tap-target);
    padding: 0 16px;
    border: 0;
    border-radius: var(--radius-full);
    background: var(--action);
    color: var(--on-action);
    font-size: calc(15 * var(--px));
    font-weight: 800;
    cursor: pointer;
  }
</style>
