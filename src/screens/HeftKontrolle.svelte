<script lang="ts">
  import { haushaltsNetto } from '../domain/netto';
  // „Letzte Kontrolle“ (B23 Bildschirm 4, gilt für den Weg über den Link und über den Text, Nachricht
  // 12b): oben die Zusammenfassung des Abgleichs, dann die Gruppen Miete, Wohnung, Bewerbung. Jede Angabe
  // eine Zeile: Bezeichnung klein über dem Wert, darunter das Urteil mit Grund. Ohne Wünsche fällt nur
  // der Abgleich weg. Eine Zeile antippen ändert sie. Über der festen Leiste der Satz „Tippt auf …“, in
  // der Leiste nur „Heft anlegen“; erst dann wird gespeichert (Lesesatz B23, E72).
  // Beträge (E78): genau wie im Inserat, mit Cent, wenn es sie nennt; gerechnet gerundet mit „ca.“.
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { abschliessen, abschliessenMit, route } from '../app/router.svelte';
  import { WECHSEL_HOECHSTENS_MS, wechselArt } from '../ui/wechsel';
  import { onMount, untrack } from 'svelte';
  import { heftTitel } from '../domain/heftKarte';
  import type { HeftAngaben } from '../domain/modell';
  import { monatVorher, urteile, type Urteil } from '../domain/urteile';
  import { t, type TextSchluessel } from '../i18n';
  import { wohnungAus } from '../lesen/angaben';
  import { lageAnwenden } from '../domain/lage';
  import { plzTabelle } from '../ui/plz.svelte';
  import { datum as datumLesen, zahl } from '../lesen/leser';
  import { heftAnlegen } from '../storage/speicher';
  import Hauptbutton from '../ui/Hauptbutton.svelte';
  import { entwurf, entwurfVergessen, hatEckdaten, zuletzt } from '../ui/neuesHeft.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import UrteilZeichen from '../ui/UrteilZeichen.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  const NB = ' ';
  // PC8 A5: wie im Heft fällt die Bewegung der Gruppen nach ihrer Dauer sicher weg.
  let werte = $state(untrack(() => wechselArt(route.von, route.pfad, route.richtung) === 'werte'));
  onMount(() => {
    if (!werte) return;
    const ende = () => (werte = false);
    const uhr = setTimeout(ende, WECHSEL_HOECHSTENS_MS);
    document.addEventListener('visibilitychange', ende);
    return () => {
      clearTimeout(uhr);
      document.removeEventListener('visibilitychange', ende);
    };
  });

  const ihr = $derived(
    // Ohne Haushalt „ihr“ (E74.4, Design 12.11.), sonst ab zwei Personen ohne Bürgen.
    !daten.ansicht ||
      daten.ansicht.mitglieder.filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length > 1,
  );
  const a = $derived(entwurf.angaben);
  const hh = $derived(daten.ansicht?.haushalt ?? null);
  const wu = $derived(hh?.wuensche ?? null);

  const u = $derived.by((): Urteil[] => {
    if (!a || !wu) return [];
    const l = lageAnwenden(wohnungAus(a), entwurf.adresse, wu, plzTabelle());
    return urteile(l.w, l.wu, {
      netto: hh ? haushaltsNetto(hh, daten.ansicht?.mitglieder ?? []) : null,
      grenze: hh?.mietgrenze ?? null,
      ihr,
    });
  });
  const urteilVon = (k: Urteil['kriterium']) => u.find((x) => x.kriterium === k) ?? null;
  const namen = (art: Urteil['art']) =>
    u.filter((x) => x.art === art && x.kriterium !== 'Anteil am Einkommen').map((x) => x.kriterium);
  const abweichend = $derived(namen('nicht').length + namen('knapp').length);

  /** Genau wie im Inserat: ganze Euro ohne Komma, sonst mit zwei Stellen. */
  const eur = (n: number) =>
    `${new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n)}${NB}€`;
  const zahlText = (n: number) =>
    new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n);
  // Tag und Monat bleiben zusammen (Prüfkatalog C23), das Jahr darf umbrechen.
  const tag = (d: string) =>
    new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })
      .format(new Date(`${d}T12:00`))
      .replace(/^(\d+\.) /, `$1${NB}`);

  type Art = 'geld' | 'zahl' | 'flaeche' | 'datum' | 'text' | 'adresse' | 'wahl';
  type Schluessel = keyof HeftAngaben | 'adresse';
  interface Zeile {
    schluessel: Schluessel;
    name: string;
    art: Art;
    wert: string | null;
    /** Fehlt der Wert: „Eintragen · nicht gefunden“ oder nur ein Strich (Angaben, die oft fehlen). */
    fehlt?: 'eintragen' | 'strich';
    urteil?: Urteil | null;
    /** Hinweis mit (i), ohne Urteil (Staffel oder Index). */
    hinweis?: string;
    wahl?: { wert: string; text: string }[];
  }

  const TIERE: Record<string, TextSchluessel> = {
    erlaubt: 'neuesHeft.tiereErlaubt',
    anfrage: 'neuesHeft.tiereAnfrage',
    nicht: 'neuesHeft.tiereNicht',
  };
  const MIETART: Record<string, TextSchluessel> = {
    index: 'neuesHeft.indexmiete',
    staffel: 'neuesHeft.staffelmiete',
    fest: 'neuesHeft.keineMietart',
  };

  function wertVon(k: keyof HeftAngaben, art: Art, quelle = a): string | null {
    const v = quelle?.[k];
    if (v === null || v === undefined || v === '') return null;
    if (art === 'geld')
      return k === 'warm' && quelle?.warmCa
        ? `ca.${NB}${eur(Math.round(v as number))}`
        : eur(v as number);
    if (art === 'flaeche')
      return `${quelle?.flaecheCa ? `ca.${NB}` : ''}${zahlText(v as number)}${NB}m²`;
    if (art === 'zahl') return zahlText(v as number);
    if (art === 'datum') return tag(v as string);
    if (k === 'tiere') return t(TIERE[v as string]!);
    if (k === 'mietart') return t(MIETART[v as string]!);
    return String(v);
  }

  /**
   * Wie Hefta die Angabe gelesen hat, zum Zurücksetzen (Auftraggeber, 12.11.); undefined, wenn es nichts
   * Gelesenes gibt.
   */
  function gelesenWert(z: Zeile): string | null | undefined {
    const g = entwurf.gelesenAngaben;
    if (!g) return undefined;
    if (z.art === 'adresse')
      return entwurf.gelesenAdresse.trim()
        ? entwurf.gelesenAdresse.trim().replace('\n', ', ')
        : (g.stadtteil ?? null);
    return wertVon(z.schluessel as keyof HeftAngaben, z.art, g);
  }

  function zuruecksetzen(z: Zeile) {
    const g = entwurf.gelesenAngaben;
    if (!g || !entwurf.angaben) return;
    if (z.art === 'adresse') entwurf.adresse = entwurf.gelesenAdresse;
    else {
      const k = z.schluessel as keyof HeftAngaben;
      (entwurf.angaben as unknown as Record<string, unknown>)[k] = g[k] ?? null;
      if (k === 'warm') entwurf.angaben.warmCa = g.warmCa;
      if (k === 'flaeche') entwurf.angaben.flaecheCa = g.flaecheCa;
    }
  }

  const miete = $derived<Zeile[]>([
    {
      schluessel: 'warm',
      name: t('neuesHeft.warm'),
      art: 'geld',
      wert: wertVon('warm', 'geld'),
      fehlt: 'eintragen',
      urteil: urteilVon('Warmmiete'),
    },
    {
      schluessel: 'kalt',
      name: t('neuesHeft.kalt'),
      art: 'geld',
      wert: wertVon('kalt', 'geld'),
      fehlt: 'eintragen',
    },
    {
      schluessel: 'nebenkosten',
      name: t('neuesHeft.nk'),
      art: 'geld',
      wert: wertVon('nebenkosten', 'geld'),
      fehlt: 'eintragen',
    },
    {
      schluessel: 'heizkosten',
      name: t('neuesHeft.heiz'),
      art: 'geld',
      wert: wertVon('heizkosten', 'geld'),
      fehlt: 'eintragen',
    },
    {
      schluessel: 'kaution',
      name: t('neuesHeft.kaution'),
      art: 'geld',
      wert: wertVon('kaution', 'geld'),
      fehlt: 'eintragen',
    },
    ...(a?.mietart
      ? [
          {
            schluessel: 'mietart' as const,
            name: t('neuesHeft.staffel'),
            art: 'wahl' as const,
            wert: wertVon('mietart', 'wahl'),
            // Planung 12d: „feste Miete“ bleibt als Zeile stehen, damit man zurück zur Auswahl kommt;
            // der Hinweis gilt nur für Index- und Staffelmiete.
            hinweis:
              a.mietart === 'fest'
                ? undefined
                : t(a.mietart === 'index' ? 'neuesHeft.indexHinweis' : 'neuesHeft.staffelHinweis'),
            wahl: [
              { wert: 'index', text: t('neuesHeft.indexmiete') },
              { wert: 'staffel', text: t('neuesHeft.staffelmiete') },
              { wert: 'fest', text: t('neuesHeft.keineMietart') },
            ],
          },
        ]
      : []),
  ]);
  const wohnung = $derived<Zeile[]>([
    {
      schluessel: 'zimmer',
      name: t('neuesHeft.zimmer'),
      art: 'zahl',
      wert: wertVon('zimmer', 'zahl'),
      fehlt: 'eintragen',
      urteil: urteilVon('Zimmer'),
    },
    {
      schluessel: 'flaeche',
      name: t('neuesHeft.flaeche'),
      art: 'flaeche',
      wert: wertVon('flaeche', 'flaeche'),
      fehlt: 'eintragen',
      urteil: urteilVon('Fläche'),
    },
    {
      schluessel: 'adresse',
      name: t('neuesHeft.lage'),
      art: 'adresse',
      wert: entwurf.adresse.trim()
        ? entwurf.adresse.trim().replace('\n', ', ')
        : (a?.stadtteil ?? null),
      fehlt: 'eintragen',
      urteil: urteilVon('Lage'),
    },
    {
      schluessel: 'einzug',
      name: t('neuesHeft.einzug'),
      art: 'datum',
      wert: wertVon('einzug', 'datum'),
      fehlt: 'strich',
      urteil: urteilVon('Einzug'),
    },
    {
      schluessel: 'befristung',
      name: t('neuesHeft.befristung'),
      art: 'text',
      wert: wertVon('befristung', 'text'),
      fehlt: 'strich',
      urteil: urteilVon('Befristung'),
    },
    {
      schluessel: 'tiere',
      name: t('neuesHeft.haustiere'),
      art: 'wahl',
      wert: wertVon('tiere', 'wahl'),
      fehlt: 'strich',
      urteil: urteilVon('Haustiere'),
      wahl: [
        { wert: 'erlaubt', text: t('neuesHeft.tiereErlaubt') },
        { wert: 'anfrage', text: t('neuesHeft.tiereAnfrage') },
        { wert: 'nicht', text: t('neuesHeft.tiereNicht') },
        { wert: '', text: '–' },
      ],
    },
  ]);
  const bewerbung = $derived<Zeile[]>([
    {
      schluessel: 'anbieter',
      name: t('neuesHeft.anbieter'),
      art: 'text',
      wert: wertVon('anbieter', 'text'),
      fehlt: 'strich',
    },
  ]);

  /** Der Grund hinter dem Urteil (Wortlaute B23): „über eurem Höchstwert von 1.200 €“ usw. */
  function grund(z: Zeile): string {
    const ur = z.urteil;
    if (!ur || !wu) return '';
    if (!z.wert) return ur.art === 'offen' ? t('neuesHeft.grundFehlt') : '';
    if (ur.art === 'passt') return '';
    if (ur.art === 'offen')
      return z.schluessel === 'adresse' && !entwurf.adresse.trim()
        ? t('neuesHeft.grundStadtteil')
        : '';
    switch (ur.kriterium) {
      case 'Warmmiete':
        return t(ihr ? 'neuesHeft.grundWarmIhr' : 'neuesHeft.grundWarmDu', {
          betrag: eur(wu.warmBis ?? 0),
        });
      case 'Fläche':
        return t('neuesHeft.grundAb', { wert: `${zahlText(wu.flaecheAb ?? 0)}${NB}m²` });
      case 'Zimmer':
        return t('neuesHeft.grundZimmer', { wert: zahlText(wu.zimmerAb ?? 0) });
      case 'Befristung':
        return t(ihr ? 'neuesHeft.grundUnbefristetIhr' : 'neuesHeft.grundUnbefristetDu');
      case 'Einzug': {
        const e = a?.einzug ?? '';
        if (e > (wu.einzugBis ?? '9999-12-31')) return t('neuesHeft.grundSpaet');
        return e >= monatVorher(wu.einzugVon ?? '0000-01-01')
          ? t('neuesHeft.grundFrueh')
          : t('neuesHeft.grundZuFrueh');
      }
      default:
        return '';
    }
  }

  const ARTEN = ['nicht', 'knapp', 'offen'] as const;
  const URTEIL_WORT: Record<string, TextSchluessel> = {
    passt: 'neuesHeft.urteilPasst',
    knapp: 'neuesHeft.urteilKnapp',
    nicht: 'neuesHeft.urteilNicht',
    offen: 'neuesHeft.urteilOffen',
  };
  const zeigtUrteil = (z: Zeile) =>
    !!z.urteil && ['passt', 'knapp', 'nicht', 'offen'].includes(z.urteil.art);

  const titel = $derived(a ? heftTitel({ adresse: entwurf.adresse, angaben: a }).text : '');
  /** Die Nummer des Inserats aus dem Link, wie in B23 („ImmoScout24 · Inserat 148392017“). */
  const nummer = $derived.by(() => {
    try {
      return new URL(entwurf.link.trim()).pathname.match(/(\d{6,})/)?.[1] ?? null;
    } catch {
      return null;
    }
  });

  let offen = $state<string | null>(null);
  let eingabe = $state('');
  let eingabe2 = $state('');

  function oeffnen(z: Zeile) {
    offen = z.schluessel;
    if (z.art === 'adresse') {
      const [s = '', o = ''] = entwurf.adresse.split('\n');
      eingabe = s;
      eingabe2 = o;
    } else if (z.art === 'datum') eingabe = (a?.einzug as string | null) ?? '';
    else {
      const v = a?.[z.schluessel as keyof HeftAngaben];
      eingabe =
        v === null || v === undefined ? '' : typeof v === 'number' ? zahlText(v) : String(v);
    }
  }

  /** „Unbefristet“ mit großem Anfang (Tastatur am iPhone) oder „keine“ meint dasselbe (PC8 A4). */
  function befristungText(w: string): string | null {
    if (!w) return null;
    return /^(un\s*befristet|keine(\s+befristung)?|nein|ohne)$/i.test(w) ? 'unbefristet' : w;
  }

  function uebernehmen(z: Zeile, form?: HTMLFormElement) {
    if (!entwurf.angaben) return;
    // PC8 A3: Das Datumsfeld von iOS meldet die Wahl nicht immer als Eingabe. Darum gilt, was beim Tipp
    // auf „Fertig“ in den Feldern steht.
    const felder = form ? [...form.querySelectorAll<HTMLInputElement>('input, select')] : [];
    if (felder[0]) eingabe = felder[0].value;
    if (felder[1]) eingabe2 = felder[1].value;
    const w = eingabe.trim();
    const angaben = entwurf.angaben as unknown as Record<string, unknown>;
    if (z.art === 'adresse') {
      entwurf.adresse = w || eingabe2.trim() ? `${w}\n${eingabe2.trim()}` : '';
    } else if (z.schluessel === 'befristung') {
      angaben.befristung = befristungText(w);
    } else if (z.art === 'text' || z.art === 'wahl') {
      angaben[z.schluessel] = w || null;
    } else if (z.art === 'datum') {
      entwurf.angaben.einzug = /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : (datumLesen(w) ?? null);
    } else {
      const n = w ? zahl(w.replace(/[€m²\s]/g, '').replace(/^ca\./, '')) : null;
      angaben[z.schluessel] = n;
      if (z.schluessel === 'warm') entwurf.angaben.warmCa = false;
      if (z.schluessel === 'flaeche') entwurf.angaben.flaecheCa = false;
    }
    offen = null;
  }

  let speichert = $state(false);
  async function anlegen() {
    if (!entwurf.angaben || speichert) return;
    speichert = true;
    const heft = await heftAnlegen(await db(), {
      haushaltId: hh?.id ?? null,
      adresse: entwurf.adresse,
      link: entwurf.link.trim() || null,
      quelle: entwurf.angaben.portal ?? '',
      inseratText: entwurf.text,
      angaben: $state.snapshot(entwurf.angaben),
    });
    await stillLaden();
    entwurfVergessen();
    zuletzt.heftId = heft.id;
    abschliessenMit('/wohnungen', `/heft/${heft.id}`, '/wohnung-neu');
  }
</script>

{#snippet liste(zeilen: Zeile[], i: number)}
  <div class="liste" style:--i={i}>
    {#each zeilen as z (z.schluessel)}
      {#if offen === z.schluessel}
        <form
          class="z offen-z"
          onsubmit={(e) => {
            e.preventDefault();
            uebernehmen(z, e.currentTarget);
          }}
        >
          <label class="l" for={`f-${z.schluessel}`}>{z.name}</label>
          {#if z.art === 'adresse'}
            <input
              id={`f-${z.schluessel}`}
              placeholder={t('neuesHeft.strasse')}
              bind:value={eingabe}
            />
            <input
              aria-label={t('neuesHeft.plzOrt')}
              placeholder={t('neuesHeft.plzOrt')}
              bind:value={eingabe2}
            />
          {:else if z.art === 'datum'}
            <input
              id={`f-${z.schluessel}`}
              type="date"
              bind:value={eingabe}
              onchange={(e) => (eingabe = e.currentTarget.value)}
            />
          {:else if z.art === 'wahl'}
            <select id={`f-${z.schluessel}`} bind:value={eingabe}>
              {#each z.wahl ?? [] as w (w.wert)}
                <option value={w.wert}>{w.text}</option>
              {/each}
            </select>
          {:else}
            <input
              id={`f-${z.schluessel}`}
              inputmode={z.art === 'text' ? 'text' : 'decimal'}
              bind:value={eingabe}
            />
          {/if}
          <button class="fertig" type="submit">{t('neuesHeft.fertig')}</button>
        </form>
      {:else}
        {@const g = grund(z)}
        <button
          class={`z ${z.urteil && zeigtUrteil(z) ? z.urteil.art : ''}`}
          type="button"
          onclick={() => oeffnen(z)}
        >
          <span class="l">{z.name}</span>
          {#if z.wert}
            <span class="v">{z.wert}</span>
          {:else if z.fehlt === 'eintragen'}
            <span class="v ein">{t('neuesHeft.eintragen')}</span>
          {:else}
            <span class="v">–</span>
          {/if}
          {#if z.hinweis}
            <span class="g"><Symbol name="info" groesse={16} /><span>{z.hinweis}</span></span>
          {:else if z.urteil && zeigtUrteil(z)}
            <span class="g">
              <UrteilZeichen art={z.urteil.art as 'passt'} /><span
                ><b class={z.urteil.art}>{t(URTEIL_WORT[z.urteil.art]!)}</b
                >{#if g}{` · ${g}`}{/if}</span
              >
            </span>
          {:else if !z.wert && z.fehlt === 'eintragen'}
            <span class="g">
              <UrteilZeichen art="offen" /><span>{t('neuesHeft.nichtGefunden')}</span>
            </span>
          {/if}
          <span class="p"><Symbol name="weiter" groesse={16} /></span>
        </button>
        {@const gw = gelesenWert(z)}
        {#if gw !== undefined && gw !== z.wert}
          <div class="gelesen">
            <!-- Wortlaute des Designs (12.11.): Wert aus dem Inserat, nicht gefunden, oder gerechnet (E78). -->
            <span
              >{gw === null
                ? t('neuesHeft.imInseratFehlt')
                : z.schluessel === 'warm' && entwurf.gelesenAngaben?.warmCa
                  ? t('neuesHeft.gerechnetWar', { wert: gw })
                  : t('neuesHeft.gelesenWar', { wert: gw })}</span
            >
            <button type="button" onclick={() => zuruecksetzen(z)}
              >{t('neuesHeft.zuruecksetzen')}</button
            >
          </div>
        {/if}
      {/if}
    {/each}
  </div>
{/snippet}

<!-- Vorschau → Kontrolle wie `werte` aus B18 (Design 12.11.): Kopf steht, die Gruppen folgen versetzt. -->
<main class="seite" class:werte>
  <header class="kopf">
    <!-- B23: „Abbrechen“ beendet den ganzen Ablauf und führt zur Übersicht; nichts ist gespeichert. -->
    <Zurueck
      href="#/wohnungen"
      text={t('neuesHeft.abbrechen')}
      onclick={() => {
        entwurfVergessen();
        abschliessen('/wohnungen');
      }}
    />
  </header>

  {#if !a}
    <p class="sub">{t('neuesHeft.ohneText')}</p>
  {:else}
    {#if a.portal}
      <p class="quelle">
        <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true"
          ><path
            d="M13.5 18.5a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-1.5 1.5M18.5 13.5a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l1.5-1.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
        ><span
          >{a.portal}{#if nummer}{` · ${t('neuesHeft.inserat')} ${nummer}`}{/if}</span
        >
      </p>
    {/if}
    <h1 class="h2">{t('neuesHeft.kontrolle')}</h1>
    <p class="sub">{titel}</p>

    {#if !hatEckdaten(a)}
      <p class="zus keine">{t('neuesHeft.keineEckdaten')}</p>
    {:else if u.length}
      <div class="zus">
        <p class="zh">
          {abweichend
            ? t(ihr ? 'neuesHeft.weichtAb' : 'neuesHeft.weichtAbDu', { anzahl: abweichend })
            : t(ihr ? 'neuesHeft.passtIhr' : 'neuesHeft.passtDu')}
        </p>
        {#if namen('nicht').length || namen('knapp').length || namen('offen').length}
          <ul>
            {#each ARTEN as art (art)}
              {#if namen(art).length}
                <li>
                  <UrteilZeichen {art} /><span
                    ><b>{t(URTEIL_WORT[art]!)}:</b> {namen(art).join(', ')}</span
                  >
                </li>
              {/if}
            {/each}
          </ul>
          {#if abweichend && namen('passt').length}<p class="zf">
              {t('neuesHeft.sonstPasst')}
            </p>{/if}
        {/if}
      </div>
    {:else if hh && !wu}
      <!-- PC8 A2: der Hinweis nur, wenn keine Wünsche gesetzt sind, nie neben dem Abgleich. -->
      <div class="zus">
        <p class="zf">{t(ihr ? 'wuensche.ohneIhr' : 'wuensche.ohneDu')}</p>
        <a class="wlink" href="#/wuensche">{t('wuensche.festlegen')}</a>
      </div>
    {/if}

    <h2 class="gr" style:--i={1}>{t('neuesHeft.gruppeMiete')}</h2>
    {@render liste(miete, 1)}

    <h2 class="gr" style:--i={2}>{t('neuesHeft.gruppeWohnung')}</h2>
    {@render liste(wohnung, 2)}

    <h2 class="gr" style:--i={3}>{t('neuesHeft.gruppeBewerbung')}</h2>
    {@render liste(bewerbung, 3)}

    <p class="tipp">{t(ihr ? 'neuesHeft.tippHinweisIhr' : 'neuesHeft.tippHinweisDu')}</p>

    <div class="cta">
      <Hauptbutton text={t('neuesHeft.anlegen')} onclick={anlegen} />
    </div>
  {/if}
</main>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: env(safe-area-inset-top) var(--space-4) 0;
  }

  .kopf {
    display: flex;
    align-items: center;
    min-height: 52px;
    padding: 4px 0;
    --on-zurueck: var(--accent-text);
  }

  .quelle {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 2px 0 0;
    color: var(--ink-quiet);
    font-size: calc(12 * var(--px));
  }

  .quelle svg {
    flex: none;
  }

  h1 {
    margin: 6px 0 4px;
  }

  .sub {
    margin: 0 0 12px;
    color: var(--ink-muted);
  }

  .zus {
    margin: 0 0 4px;
    padding: 12px 14px 6px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .zus.keine {
    padding-bottom: 12px;
    border-style: dashed;
    color: var(--ink-muted);
  }

  .zh {
    margin: 0 0 6px;
    font-weight: 650;
  }

  .zus ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .zus li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 4px 0;
    font-size: calc(14 * var(--px));
    line-height: 1.35;
  }

  .zus li :global(svg) {
    margin-top: 2px;
  }

  .zf {
    margin: 0 0 6px;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }

  .wlink {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--accent-text);
    font-weight: 650;
    text-decoration: none;
  }

  /* Gruppen folgen mit `bw-hoch`, `mittel`, `ziel`, je `takt` versetzt; höchstens die ersten vier. */
  .werte :is(.zus, .gr, .liste) {
    animation: bw-hoch var(--bw-mittel) var(--bw-ziel) backwards;
    animation-delay: calc(var(--bw-takt) * min(var(--i, 0), 3));
  }

  .gr {
    margin: 26px 2px 8px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    font-weight: 650;
    line-height: 1.2;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .liste {
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .z {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'l p' 'v p' 'g p';
    align-items: center;
    column-gap: 10px;
    width: 100%;
    min-height: 56px;
    padding: 10px 12px 10px 14px;
    border: 0;
    border-top: 1px solid var(--line);
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .z:first-child {
    border-top: 0;
  }

  .z.nicht {
    box-shadow: inset 3px 0 0 var(--ink);
  }

  .z.knapp {
    box-shadow: inset 3px 0 0 var(--knapp-text);
  }

  .l {
    grid-area: l;
    color: var(--ink-muted);
    font-size: calc(12 * var(--px));
  }

  .v {
    grid-area: v;
    min-width: 0;
    font-size: calc(16 * var(--px));
    font-weight: 650;
    overflow-wrap: anywhere;
  }

  .v.ein {
    color: var(--accent-text);
  }

  .g {
    grid-area: g;
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-top: 4px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: 1.35;
  }

  .g :global(svg) {
    flex: none;
    margin-top: 1px;
  }

  .g b {
    color: var(--ink);
    font-weight: 650;
  }

  .g b.passt {
    color: var(--passt-text);
  }

  .g b.knapp {
    color: var(--knapp-text);
  }

  .p {
    grid-area: p;
    display: flex;
    color: var(--ink-quiet);
  }

  /* Geänderte Angabe: wie gelesen, mit „Zurücksetzen“ (Auftraggeber, 12.11.). */
  .gelesen {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 12px;
    padding: 0 12px 6px 14px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .gelesen button {
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .offen-z {
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: default;
  }

  .offen-z input,
  .offen-z select {
    box-sizing: border-box;
    width: 100%;
    min-height: 48px;
    padding: 10px 12px;
    border: 1px solid var(--control-border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
  }

  .fertig {
    align-self: flex-end;
    min-height: 44px;
    padding: 0 18px;
    border: 0;
    border-radius: var(--radius-full);
    background: var(--action);
    color: var(--on-action);
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }

  .tipp {
    margin: 12px 2px 28px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  /* Feste Leiste (B23 Fassung 2): Grund in der Farbe der Seite, volle Breite, 14 px Übergang nach oben;
     ganz unten liegt die letzte Zeile frei, weil die Leiste dort an ihrem Platz im Fluss steht. */
  .cta {
    position: sticky;
    bottom: 0;
    z-index: 2;
    margin: 0 calc(-1 * var(--space-4));
    padding: 12px var(--space-4) calc(env(safe-area-inset-bottom) + 16px);
    background: var(--ground);
    box-shadow: 0 -14px 14px -2px var(--ground);
  }
</style>
