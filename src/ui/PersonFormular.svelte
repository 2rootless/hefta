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
  const id = $props.id();
  const wechsel = $derived(
    gespeichert ? einkommenWechsel(rolle, gespeichert, werte, gespeicherteTypen) : null,
  );
  const lateinNoetig = $derived(!imPdfSchreibbar(`${werte.vorname} ${werte.nachname}`));

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
    <fieldset class="feld">
      <legend
        >{teil === 'haushalt' && !rollenWahl
          ? t('personSeite.rolle')
          : t('personSeite.bezeichnung')}</legend
      >
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

  {#if teil !== 'haushalt'}
    <label class="eingabe" for="{id}-einkommen">
      {du ? t('personSeite.einkommenDu') : t('personSeite.einkommen')}
    </label>
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
    {#if wechsel}
      <Notiz stark>
        <p>
          <b>{t('personSeite.wechselStatt', { statt: wechsel.statt })}</b>
          {t('personSeite.wechselBraucht', { name: rufname, braucht: wechsel.braucht })}
          {wechsel.bleibt ?? ''}
        </p>
      </Notiz>
    {:else}
      <p class="hinweis" id="{id}-hinweis">{t('personSeite.einkommenHinweis')}</p>
    {/if}
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

  .rufname {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
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
  }

  legend {
    margin-bottom: var(--space-2);
    padding: 0;
    font-size: calc(14 * var(--px));
    font-weight: 700;
  }

  .segmente {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
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
  select:focus-visible {
    outline: 0;
    box-shadow: inset 0 0 0 2px var(--ink);
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

  .hinweis {
    margin: -6px 0 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }
</style>
