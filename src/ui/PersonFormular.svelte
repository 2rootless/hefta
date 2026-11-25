<script lang="ts" module>
  import type { AusbildungArt, Bezeichnung, Lebenssituation } from '../domain/modell';

  export interface PersonEingabe {
    vorname: string;
    nachname: string;
    /** Leer: aus dem Vornamen vorbelegt. */
    rufname: string;
    /** Nur wenn das PDF den Namen nicht schreiben kann (K8). */
    nameMappe?: { vorname: string; nachname: string } | null;
    bezeichnung: Bezeichnung | null;
    lebenssituation: Lebenssituation;
    ausbildungArt?: AusbildungArt | null;
    /** DP74 C3: hat keinen Nachnamen (nur unter „… ändern“). */
    ohneNachname?: boolean;
    /** DP47 G5: weitere Lebenslagen, in Reihenfolge. */
    weitereLagen?: {
      id: string;
      situation: Lebenssituation;
      ausbildungArt?: AusbildungArt | null;
    }[];
    /**
     * L8: Wurde die erste Lebenslage entfernt, rückt die zweite nach oben. Hier steht ihre Kennung, damit
     * ihre Angaben (Beruf, Arbeitgeber, Netto) beim Speichern mitkommen.
     */
    ersteAus?: string | null;
  }
</script>

<script lang="ts">
  // Felder einer Person (design/einrichtung-rutsch-navigation.md, Schritt 1 und Formulare):
  // Vor- und Nachname, „Wir nennen dich Max. Ändern“, Bezeichnung als drei Knöpfe,
  // Einkommen als Auswahl, vorbelegt mit „Angestellt“. Kann das PDF den Namen nicht schreiben, fragt
  // es nach dem Namen in lateinischen Buchstaben (design/person-und-haushalt.md, K8).
  import { rufnameAus, rufnameFolgt, type Rolle } from '../domain/modell';
  import { imPdfSchreibbar } from '../domain/namen';
  import {
    einkommenWechsel,
    rollenText,
    situationOptionen,
    situationText,
  } from '../domain/regelkatalog';
  import { t } from '../i18n';
  import Notiz from './Notiz.svelte';
  import Sheet from './Sheet.svelte';
  import Symbol from './Symbol.svelte';
  import { genitiv } from './texte';

  let {
    werte = $bindable(),
    rolle,
    du = false,
    fokus = true,
    teil = 'alles',
    nachName,
    rollenWahl,
    gespeichert,
    gespeicherteTypen = [],
    nachnameWahl = false,
  }: {
    werte: PersonEingabe;
    rolle: Rolle;
    du?: boolean;
    fokus?: boolean;
    /** Nur die Angaben im Haushalt (Bezeichnung) oder nur die zur Person (design/person-und-haushalt.md). */
    teil?: 'alles' | 'haushalt' | 'person';
    /** Platz unter dem Nachnamen, z. B. für den Namensabgleich. */
    nachName?: import('svelte').Snippet;
    /** Wahl „Im Mietvertrag“ oder „Bürgschaft“ (HA1), über der Bezeichnung. */
    rollenWahl?: import('svelte').Snippet;
    /** Stand vor dem Ändern: Ändert sich die Lebenslage, steht darunter, was das bedeutet (HA2). */
    gespeichert?: Pick<import('../domain/modell').Person, 'lebenssituation' | 'ausbildungArt'>;
    gespeicherteTypen?: string[];
    /** DP74 C3: das Kästchen „… hat keinen Nachnamen“ unter dem Nachnamen. */
    nachnameWahl?: boolean;
  } = $props();

  const optionen = situationOptionen();
  let rufnameOffen = $state(!!werte.rufname && werte.rufname !== rufnameAus(werte.vorname));
  const rufname = $derived(werte.rufname.trim() || rufnameAus(werte.vorname));
  const bezeichnungen: Bezeichnung[] = ['maennlich', 'weiblich', 'neutral'];
  // W57 (Übergang bis zur neuen Bedienung, PD171): Im Vertrag gibt es kein Rollenwort mehr, also auch keine Form zu
  // wählen; es gilt „neutral“. Die Wahl steht nur für Bürgen („Bürge“, „Bürgin“, „Neutral“).
  $effect(() => {
    if (rolle !== 'buerge' && !werte.bezeichnung) werte.bezeichnung = 'neutral';
  });
  const id = $props.id();
  const wechsel = $derived(
    gespeichert ? einkommenWechsel(rolle, gespeichert, werte, gespeicherteTypen) : null,
  );
  const lateinNoetig = $derived(!imPdfSchreibbar(`${werte.vorname} ${werte.nachname}`));

  // ---------- DP47 G5: mehrere Lebenslagen ----------
  const wertVon = (situation: Lebenssituation, art?: AusbildungArt | null) =>
    art ? `${situation}:${art}` : situation;
  const weitere = $derived(werte.weitereLagen ?? []);
  const ersteText = $derived(situationText(werte.lebenssituation, werte.ausbildungArt));
  let dazuOffen = $state(false);
  let wahl = $state<string | null>(null);
  /** Was dazukommen kann: jede Lage einmal, „Angestellt“ auch ein zweites Mal (zwei Arbeitgeber). */
  const dazuOptionen = $derived(
    optionen
      .filter(
        (o) =>
          o.situation === 'angestellt' ||
          ![
            wertVon(werte.lebenssituation, werte.ausbildungArt),
            ...weitere.map((l) => wertVon(l.situation, l.ausbildungArt)),
          ].includes(o.wert),
      )
      .map((o) => {
        const schonAngestellt =
          o.situation === 'angestellt' &&
          (werte.lebenssituation === 'angestellt' ||
            weitere.some((l) => l.situation === 'angestellt'));
        return {
          ...o,
          unter: schonAngestellt
            ? t('lagen.nochArbeitgeber')
            : t(`lagen.nachweis.${o.art ?? o.situation}` as Parameters<typeof t>[0]),
        };
      }),
  );

  function dazunehmen() {
    const o = optionen.find((x) => x.wert === wahl);
    if (!o) return;
    werte.weitereLagen = [
      ...weitere,
      { id: crypto.randomUUID(), situation: o.situation, ausbildungArt: o.art },
    ];
    wahl = null;
    dazuOffen = false;
  }

  function lageAendern(i: number, wert: string) {
    const o = optionen.find((x) => x.wert === wert);
    if (!o) return;
    werte.weitereLagen = weitere.map((l, j) =>
      j === i ? { ...l, situation: o.situation, ausbildungArt: o.art } : l,
    );
  }

  /** „Entfernen“: eine weitere Lage fällt weg; bei der ersten rückt die zweite nach (L8). */
  function entfernen(i: number | 'erste') {
    if (i === 'erste') {
      const [zweite, ...rest] = weitere;
      if (!zweite) return;
      werte.lebenssituation = zweite.situation;
      werte.ausbildungArt = zweite.ausbildungArt ?? null;
      werte.ersteAus = zweite.id;
      werte.weitereLagen = rest;
      return;
    }
    werte.weitereLagen = weitere.filter((_, j) => j !== i);
  }

  function lateinAendern(teil: 'vorname' | 'nachname', text: string) {
    werte.nameMappe = {
      vorname: werte.nameMappe?.vorname ?? '',
      nachname: werte.nameMappe?.nachname ?? '',
      [teil]: text,
    };
  }

  // Der Rufname zeigt den neuen Vornamen, sobald man ihn ändert, außer er wurde eigens gewählt.
  let vornameVorher = '';
  function vornameTippen() {
    werte.rufname = rufnameFolgt(vornameVorher, werte.vorname, werte.rufname);
    vornameVorher = werte.vorname;
  }

  // DP74 C3: Mit Haken ist der Nachname leer; ein schon getippter bleibt bis „Speichern“ und kommt zurück, wenn der
  // Haken wegfällt.
  let nachnameGetippt = '';
  function ohneNachnameSetzen(an: boolean) {
    if (an) {
      nachnameGetippt = werte.nachname;
      werte.nachname = '';
    } else werte.nachname = nachnameGetippt;
    werte.ohneNachname = an;
  }

  function fokussieren(element: HTMLInputElement) {
    if (fokus) element.focus();
  }
</script>

<div class="formular">
  {#if teil !== 'haushalt'}
    <!-- DP49 Punkt 8 (W30): Satz je Angabe, für den Namen oben im Block (wie die Sätze unter der Teil-Überschrift).
         Darunter bleiben Nachname, „kein Nachname“ und Rufname so dicht wie in DP74 (NN9). -->
    <p class="hinweis w30 oben" data-w30="gruppe">{t('angabeSatz.name')}</p>
    <label class="eingabe">
      {t('personSeite.vorname')}
      <input
        bind:value={werte.vorname}
        onfocus={() => (vornameVorher = werte.vorname)}
        oninput={vornameTippen}
        autocomplete="given-name"
        enterkeyhint="next"
        use:fokussieren
      />
    </label>
    <label class="eingabe">
      {t('personSeite.nachname')}
      <input
        bind:value={werte.nachname}
        autocomplete="family-name"
        enterkeyhint="done"
        readonly={nachnameWahl && !!werte.ohneNachname}
        placeholder={nachnameWahl && werte.ohneNachname ? t('personSeite.keinNachname') : undefined}
        class:ohne={nachnameWahl && !!werte.ohneNachname}
      />
    </label>
    {#if nachnameWahl}
      <label class="ohne-nachname">
        <input
          type="checkbox"
          checked={!!werte.ohneNachname}
          onchange={(e) => ohneNachnameSetzen(e.currentTarget.checked)}
          aria-describedby="{id}-ohne"
        />
        <span class="kaestchen" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14"
            ><path
              d="M2.5 7.4l3 3 6-6.6"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg
          >
        </span>
        <span class="ohne-text"
          >{werte.vorname.trim()
            ? t('personSeite.ohneNachname', { name: rufname })
            : t('personSeite.ohneNachnameOhneName')}</span
        >
      </label>
      <p class="ohne-satz" id="{id}-ohne">{t('personSeite.ohneNachnameSatz')}</p>
    {/if}
    {@render nachName?.()}
    {#if rufname}
      {#if rufnameOffen}
        <label class="eingabe">
          {t('personSeite.rufname')}
          <input
            bind:value={werte.rufname}
            placeholder={rufnameAus(werte.vorname)}
            autocomplete="nickname"
          />
        </label>
      {:else}
        <p class="rufname">
          {du
            ? t('personSeite.rufnameSatz', { name: rufname })
            : t('personSeite.rufnameSatzAndere', { name: rufname })}
          <button type="button" class="textlink" onclick={() => (rufnameOffen = true)}
            >{t('personSeite.rufnameAendern')}<span class="visually-hidden">
              {t('personSeite.rufname')}</span
            ></button
          >
        </p>
      {/if}
    {/if}
    {#if lateinNoetig}
      <Notiz>
        <p>
          <b>{t('personSeite.lateinTitel')}</b>
          {du ? t('personSeite.lateinFrage') : t('personSeite.lateinFrageAndere')}
        </p>
      </Notiz>
      <label class="eingabe">
        {t('personSeite.lateinVorname')}
        <input
          value={werte.nameMappe?.vorname ?? ''}
          oninput={(e) => lateinAendern('vorname', e.currentTarget.value)}
          placeholder={t('personSeite.lateinBeispielVorname')}
          autocomplete="off"
          enterkeyhint="next"
        />
      </label>
      <label class="eingabe">
        {t('personSeite.lateinNachname')}
        <input
          value={werte.nameMappe?.nachname ?? ''}
          oninput={(e) => lateinAendern('nachname', e.currentTarget.value)}
          placeholder={t('personSeite.lateinBeispielNachname')}
          autocomplete="off"
          enterkeyhint="done"
        />
      </label>
      <p class="hinweis">{t('personSeite.lateinBleibt')}</p>
    {/if}
  {/if}
  {#if teil !== 'person'}
    {@render rollenWahl?.()}
  {/if}
  {#if teil !== 'person' && rolle === 'buerge'}
    <fieldset class="feld">
      <!-- W57: Die Wahl betrifft nur die Form für Bürgen; die Rolle selbst wechselt man über die Ziele. -->
      <legend>{t('personSeite.bezeichnung')}</legend>
      <div class="segmente" role="radiogroup">
        {#each bezeichnungen as b (b)}
          <button
            type="button"
            class="chip"
            role="radio"
            aria-checked={werte.bezeichnung === b}
            onclick={() => (werte.bezeichnung = b)}
            >{b === 'neutral' ? t('personSeite.neutral') : rollenText(rolle, b)}</button
          >
        {/each}
      </div>
    </fieldset>
  {/if}
  {#if teil !== 'person'}
    <p class="hinweis w30" data-w30="feld">{t('angabeSatz.rolle')}</p>
  {/if}

  {#if teil !== 'haushalt'}
    <label class="eingabe" for="{id}-einkommen">
      {du ? t('personSeite.einkommenDu') : t('personSeite.einkommen')}
    </label>
    <div class="lage-zeile">
      <div class="auswahl">
        <select
          id="{id}-einkommen"
          value={werte.ausbildungArt
            ? `${werte.lebenssituation}:${werte.ausbildungArt}`
            : werte.lebenssituation}
          onchange={(e) => {
            const o = optionen.find((x) => x.wert === e.currentTarget.value);
            if (!o) return;
            werte.lebenssituation = o.situation;
            werte.ausbildungArt = o.art;
          }}
          aria-describedby={wechsel ? undefined : `${id}-hinweis`}
        >
          <!-- Ältere Daten: noch nicht gesagt, ob Studium oder Ausbildung. -->
          {#if werte.lebenssituation === 'studierend_azubi' && !werte.ausbildungArt}
            <option value="studierend_azubi">{situationText('studierend_azubi')}</option>
          {/if}
          {#each optionen as o (o.wert)}
            <option value={o.wert}>{o.text}</option>
          {/each}
        </select>
      </div>
      {#if weitere.length}
        <button
          type="button"
          class="entfernen"
          aria-label={t('lagen.entfernenName', { lage: ersteText })}
          onclick={() => entfernen('erste')}>{t('lagen.entfernen')}</button
        >
      {/if}
    </div>
    {#each weitere as lage, i (lage.id)}
      <label class="eingabe dazu-label" for="{id}-lage-{i}">{t('lagen.dazuLabel')}</label>
      <div class="lage-zeile">
        <div class="auswahl">
          <select
            id="{id}-lage-{i}"
            value={wertVon(lage.situation, lage.ausbildungArt)}
            onchange={(e) => lageAendern(i, e.currentTarget.value)}
          >
            {#each optionen as o (o.wert)}
              <option value={o.wert}>{o.text}</option>
            {/each}
          </select>
        </div>
        <button
          type="button"
          class="entfernen"
          aria-label={t('lagen.entfernenName', {
            lage: situationText(lage.situation, lage.ausbildungArt),
          })}
          onclick={() => entfernen(i)}>{t('lagen.entfernen')}</button
        >
      </div>
    {/each}
    <button type="button" class="dazu-knopf" onclick={() => (dazuOffen = true)}>
      <Symbol name="plus" groesse={16} />
      {weitere.length ? t('lagen.nochEine') : t('lagen.dazu')}
    </button>
    {#if wechsel}
      <!-- DP63c F2: hebt nur hervor, was sich ändert; keine Warnung. -->
      <Notiz>
        <p>
          <b>{t('personSeite.wechselStatt', { statt: wechsel.statt })}</b>
          {t('personSeite.wechselBraucht', { name: rufname, braucht: wechsel.braucht })}
          {wechsel.bleibt ?? ''}
        </p>
      </Notiz>
    {:else}
      <!-- DP47 G5 mit DP49 Punkt 8 (W30): mit weiteren Lagen deren Satz, sonst der Satz je Angabe. -->
      <p class="hinweis" id="{id}-hinweis">
        {weitere.length ? t('lagen.hinweisMehr') : t('angabeSatz.lebenslage')}
      </p>
    {/if}
    <Sheet bind:offen={dazuOffen} titel={t('lagen.titel')}>
      <p class="frage">{t('lagen.frage', { name: rufname, lage: ersteText })}</p>
      <div class="wahl-liste" role="radiogroup" aria-label={t('lagen.titel')}>
        {#each dazuOptionen as o (o.wert)}
          <button
            type="button"
            class="wahl-zeile"
            role="radio"
            aria-checked={wahl === o.wert}
            onclick={() => (wahl = o.wert)}
          >
            <span class="kreis" aria-hidden="true"></span>
            <span class="wahl-text"><b>{o.text}</b><small>{o.unter}</small></span>
          </button>
        {/each}
      </div>
      <p class="hinweis">{t('lagen.satz', { name: genitiv(rufname) })}</p>
      <button type="button" class="knopf-dazu" disabled={!wahl} onclick={dazunehmen}
        >{t('lagen.knopf')}</button
      >
    </Sheet>
  {/if}
</div>

<style>
  .formular {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }

  .eingabe input {
    min-height: 48px;
    border-radius: 14px;
  }

  /* PC79 (C33), DP47b K2 (M1): Satz und „Ändern“ halten Abstand wie Nachbarn, mindestens 8 px. */
  .rufname {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    margin: -4px 0 0;
    font-size: calc(14 * var(--px));
    color: var(--ink-muted);
  }

  .rufname .textlink {
    font-size: calc(14 * var(--px));
  }

  .feld {
    margin: 0;
    padding: 0;
    border: 0;
    /* DP119 (2.1.1): wie .rollen in PersonSeite; ein Fieldset wächst sonst mit seinem Inhalt. */
    min-width: 0;
  }

  legend {
    margin-bottom: var(--space-2);
    padding: 0;
    font-size: calc(14 * var(--px));
    font-weight: 700;
  }

  /* PC79 (C33): Chips mit 8 px Abstand, nicht 6. */
  .segmente {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .segmente .chip {
    padding: 0 14px;
    font-size: calc(15 * var(--px));
  }

  .auswahl {
    position: relative;
    margin-top: -8px;
  }

  select {
    width: 100%;
    min-height: 48px;
    padding: 0 40px 0 14px;
    /* DP33 A4: weiche Fläche ohne Linie. */
    border: 0;
    border-radius: 14px;
    background: var(--weich);
    color: var(--ink);
    font-size: calc(16 * var(--px));
    font-weight: 600;
    appearance: none;
  }

  /* DP33 A4: Fokus 2 px Tinte innen. */
  /* PC73 (W33): der Ring der Knöpfe (3 px mit Abstand); der Rand innen gehört allein der Nachfrage. */
  select:focus-visible {
    outline: 3px solid var(--ink);
    outline-offset: 2px;
    box-shadow: 0 0 0 2px var(--surface);
  }

  .auswahl::after {
    content: '';
    position: absolute;
    right: 18px;
    top: 50%;
    width: 8px;
    height: 8px;
    border-right: 2.2px solid var(--ink);
    border-bottom: 2.2px solid var(--ink);
    transform: translateY(-70%) rotate(45deg);
    pointer-events: none;
  }

  /* DP74 C3, Abschnitt 1: Zeile 44 px, Kästchen 24 px in --radius-sm, Rand 1,5 px --control-border; gesetzt Tinte mit
     Haken in --surface; Lücke 12 px; Satz 13 px, 36 px eingerückt. Abstände 8 (Feld zur Zeile), 4 (Zeile zum Satz),
     8 (Satz zur nächsten Zeile); das Raster des Formulars ist 12 px, darum die Ausgleiche. Fokus als Ring wie bei
     Knöpfen, nie als Tintenrand innen (W33). */
  .ohne-nachname {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    margin-top: -4px;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  /* Das Feld liegt unsichtbar genau über dem Kästchen: Tippen trifft es, Vorleser und Tastatur finden es. */
  .ohne-nachname input {
    position: absolute;
    top: 50%;
    left: 0;
    width: 24px;
    height: 24px;
    margin: -12px 0 0;
    opacity: 0;
    cursor: pointer;
    z-index: 1;
  }
  .kaestchen {
    flex: none;
    display: grid;
    place-items: center;
    box-sizing: border-box;
    width: 24px;
    height: 24px;
    border: 1.5px solid var(--control-border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--surface);
    pointer-events: none;
  }
  .kaestchen svg {
    opacity: 0;
  }
  .ohne-nachname input:checked + .kaestchen {
    border-color: var(--ink);
    background: var(--ink);
  }
  .ohne-nachname input:checked + .kaestchen svg {
    opacity: 1;
  }
  .ohne-nachname input:focus-visible + .kaestchen {
    outline: 3px solid var(--ink);
    outline-offset: 2px;
    box-shadow: 0 0 0 2px var(--surface);
  }
  .ohne-satz {
    margin: -8px 0 0 36px;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }
  .eingabe input.ohne::placeholder {
    color: var(--ink-muted);
    opacity: 1;
  }
  .eingabe input {
    transition: color var(--bw-blende);
  }

  .hinweis.oben {
    margin: 0;
  }

  /* DP47 G5: Feld mit „Entfernen“. In schmaler Breite rutscht „Entfernen“ in eine eigene Zeile, rechts
     (DP47b K2). */
  .lage-zeile {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0 8px;
    margin-top: -8px;
  }

  .lage-zeile .auswahl {
    flex: 1 1 200px;
    margin-top: 0;
  }

  .entfernen,
  .dazu-knopf {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: var(--tap-target);
    padding: 0 4px;
    border: 0;
    background: none;
    font-size: calc(15 * var(--px));
    font-weight: 600;
    cursor: pointer;
  }

  .entfernen {
    color: var(--ink-muted);
  }

  .dazu-knopf {
    justify-self: start;
    margin-top: -4px;
    color: var(--ink);
  }

  .dazu-label {
    margin-top: 4px;
  }

  .frage {
    margin: 0 0 12px;
    color: var(--ink-muted);
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .wahl-liste {
    display: grid;
    border-radius: 16px;
    background: var(--surface);
  }

  .wahl-zeile {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-height: 56px;
    padding: 12px 16px;
    border: 0;
    background: none;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .wahl-zeile + .wahl-zeile {
    border-top: 1px solid var(--line);
  }

  .kreis {
    flex: none;
    width: 20px;
    height: 20px;
    margin-top: 1px;
    border-radius: 10px;
    box-shadow: inset 0 0 0 2px var(--ink-muted);
  }

  .wahl-zeile[aria-checked='true'] .kreis {
    box-shadow: inset 0 0 0 6px var(--ink);
  }

  .wahl-text {
    display: grid;
    gap: 2px;
  }

  .wahl-text b {
    font-weight: 600;
  }

  .wahl-text small {
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .knopf-dazu {
    width: 100%;
    min-height: 56px;
    margin-top: 16px;
    border: 0;
    border-radius: 28px;
    background: var(--action);
    color: var(--on-action);
    font-size: calc(17 * var(--px));
    font-weight: 700;
    cursor: pointer;
  }

  .knopf-dazu:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* W30-Regel: Satz zu einer einzelnen Wahl 8 px darunter (Abstand im Formular 12 px). */
  .hinweis[data-w30='feld'] {
    margin-top: -4px;
  }

  .hinweis {
    margin: -6px 0 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }
</style>
