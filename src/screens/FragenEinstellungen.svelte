<script lang="ts">
  // „Fragen für die Besichtigung“ in den Einstellungen (DP50 Punkt 10, Unterseite): Jede Frage von Hefta hat
  // einen Schalter; an heißt, sie steht im Heft. Ausgeschaltet steht sie in keinem Heft mehr, eine dort schon
  // notierte Antwort bleibt (DP50, offene Frage 1). Darunter die eigenen Fragen des Geräts (Planung 10i) mit
  // „···“ zum Ändern und Löschen und „+ Eigene Frage“.
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { THEMEN, tierFrage, type Thema } from '../domain/besichtigungsFragen';
  import { t, zahlwort, type TextSchluessel } from '../i18n';
  import type { Einstellungen } from '../domain/modell';
  import { einstellungenAendern, einstellungenLaden } from '../storage/speicher';
  import SchalterZeile from '../ui/SchalterZeile.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';
  import { passend, TITEL } from '../ui/passend';

  /** Drei Fragen sind zu sehen, der Rest klappt auf. */
  const SICHTBAR = 3;

  const ansicht = $derived(daten.ansicht);
  const hh = $derived(ansicht?.haushalt ?? null);
  // Ohne Haushalt „du“ (E369, hebt E74.4 auf), sonst „ihr“ ab zwei Personen ohne Bürgen.
  const ihr = $derived(
    !!ansicht && ansicht.mitglieder.filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length > 1,
  );

  function frageText(th: Thema): string {
    if (th === 'ablauf') return t(ihr ? 'fragen.frage.ablaufUns' : 'fragen.frage.ablaufMir');
    if (th === 'haustiere') {
      const tier = hh?.haustiere === 'ja' ? tierFrage(hh.haustiereText) : null;
      if (tier)
        return t(tier.art === 'ein' ? 'fragen.frage.haustiereEin' : 'fragen.frage.haustiereMehr', {
          tier: tier.tier,
        });
    }
    return t(`fragen.frage.${th}` as TextSchluessel);
  }

  const aus = $derived(new Set(daten.einstellungen?.fragenAus ?? []));
  const auchNeuAus = $derived(
    new Set((daten.einstellungen?.ausgeblendeteFragen ?? []).map((a) => a.thema)),
  );
  const istAn = (th: Thema) => !aus.has(th) && !auchNeuAus.has(th);

  let alleOffen = $state(false);
  const sichtbar = $derived(alleOffen ? THEMEN : THEMEN.slice(0, SICHTBAR));
  const weitere = $derived(
    zahlwort(THEMEN.length - SICHTBAR).replace(/^./, (c) => c.toLocaleUpperCase('de')),
  );

  // Nacheinander und immer auf dem gespeicherten Stand: Zwei schnelle Tipps lasen sonst denselben alten Stand,
  // und der zweite überschrieb den ersten (gefunden in WebKit).
  let kette = Promise.resolve();
  function aendern(neu: (e: Einstellungen) => Partial<Omit<Einstellungen, 'id'>>) {
    kette = kette.then(async () => {
      const d = await db();
      await einstellungenAendern(d, neu(await einstellungenLaden(d)));
      await stillLaden();
    });
    return kette;
  }

  function umschalten(th: Thema) {
    const an = istAn(th);
    return aendern((e) =>
      an
        ? { fragenAus: [...new Set([...(e.fragenAus ?? []), th])] }
        : {
            // Einschalten bringt sie zurück (E5), auch wenn sie im Heft „auch in neuen Heften“ ausgeblendet war.
            fragenAus: (e.fragenAus ?? []).filter((x) => x !== th),
            ausgeblendeteFragen: (e.ausgeblendeteFragen ?? []).filter((a) => a.thema !== th),
          },
    );
  }

  // Eigene Fragen des Geräts.
  const eigene = $derived(daten.einstellungen?.eigeneFragen ?? []);
  let neuOffen = $state(false);
  let neuText = $state('');
  let neuFeld = $state<HTMLInputElement | null>(null);
  $effect(() => {
    if (neuOffen) neuFeld?.focus();
  });

  const gleich = (a: string, b: string) =>
    a.trim().toLocaleLowerCase('de') === b.trim().toLocaleLowerCase('de');

  async function hinzufuegen() {
    const text = neuText.trim();
    if (!text) return;
    neuText = '';
    neuOffen = false;
    await aendern((e) => {
      const liste = e.eigeneFragen ?? [];
      return { eigeneFragen: liste.some((f) => gleich(f, text)) ? liste : [...liste, text] };
    });
  }

  // Bearbeitet wird eine Frage über ihren alten Wortlaut, nicht über die Stelle in der Liste.
  let bearbeiten = $state<{ alt: string; text: string } | null>(null);
  let blattOffen = $state(false);
  function oeffnen(index: number) {
    const alt = eigene[index] ?? '';
    bearbeiten = { alt, text: alt };
    blattOffen = true;
  }
  async function uebernehmen() {
    if (!bearbeiten) return;
    const { alt, text } = $state.snapshot(bearbeiten);
    blattOffen = false;
    await aendern((e) => ({
      eigeneFragen: (e.eigeneFragen ?? []).flatMap((f) =>
        f === alt ? (text.trim() ? [text.trim()] : []) : [f],
      ),
    }));
  }
  async function loeschen() {
    if (!bearbeiten) return;
    const alt = bearbeiten.alt;
    blattOffen = false;
    await aendern((e) => ({ eigeneFragen: (e.eigeneFragen ?? []).filter((f) => f !== alt) }));
  }
</script>

<main class="seite">
  <div class="kopf"><Zurueck href="#/einstellungen" text={t('einstellungen.titel')} /></div>
  <div class="titelblock">
    <h1 use:passend={TITEL} class="display">{t('fragen.titel')}</h1>
    <p class="lead">{t('fragenEinstellungen.satz')}</p>
  </div>

  <section class="fe-abschnitt" aria-labelledby="g-von-hefta">
    <h2 class="fe-kopf" id="g-von-hefta">{t('fragenEinstellungen.vonApp')}</h2>
    <ul class="zeilen" id="fragen-hefta">
      {#each sichtbar as th (th)}
        <li>
          <SchalterZeile
            an={istAn(th)}
            titel={frageText(th)}
            schlicht
            onclick={() => void umschalten(th)}
          />
        </li>
      {/each}
      <li>
        <button
          type="button"
          class="listenzeile"
          aria-expanded={alleOffen}
          aria-controls="fragen-hefta"
          onclick={() => (alleOffen = !alleOffen)}
        >
          <span class="tx"
            ><b
              >{alleOffen
                ? t('fragenEinstellungen.weniger')
                : t('fragenEinstellungen.weitere', { Zahl: weitere })}</b
            ></span
          >
          <span class="pfeil" aria-hidden="true"
            ><Symbol name={alleOffen ? 'auf' : 'weiter'} groesse={20} /></span
          >
        </button>
      </li>
    </ul>
  </section>

  <section class="fe-abschnitt" aria-labelledby="g-eigene">
    <h2 class="fe-kopf" id="g-eigene">{t('fragenEinstellungen.eigene')}</h2>
    <ul class="zeilen">
      {#each eigene as f, i (`${i}:${f}`)}
        <li>
          <div class="listenzeile">
            <span class="tx"><b class="frage">{f}</b></span>
            <button
              type="button"
              class="mehr"
              aria-label={t('fragenEinstellungen.aendernLabel', { frage: f })}
              onclick={() => oeffnen(i)}>···</button
            >
          </div>
        </li>
      {/each}
      <li>
        {#if neuOffen}
          <form
            class="neu"
            onsubmit={(e) => {
              e.preventDefault();
              void hinzufuegen();
            }}
          >
            <label class="visually-hidden" for="neue-frage"
              >{t('fragenEinstellungen.eigeneFrage')}</label
            >
            <input id="neue-frage" bind:this={neuFeld} bind:value={neuText} maxlength="200" />
            <button type="submit" class="hinzu">{t('fragenEinstellungen.hinzufuegen')}</button>
          </form>
        {:else}
          <button type="button" class="listenzeile plus" onclick={() => (neuOffen = true)}>
            <span class="plus-zeichen" aria-hidden="true"><Symbol name="plus" groesse={16} /></span>
            <span class="tx"><b>{t('fragenEinstellungen.eigeneFrage')}</b></span>
          </button>
        {/if}
      </li>
    </ul>
    <p class="unten">{t('fragenEinstellungen.unten')}</p>
  </section>
</main>

<Sheet bind:offen={blattOffen} titel={t('fragenEinstellungen.aendern')}>
  {#if bearbeiten}
    <label class="visually-hidden" for="frage-aendern">{t('fragenEinstellungen.eigeneFrage')}</label
    >
    <input id="frage-aendern" class="blatt-feld" bind:value={bearbeiten.text} maxlength="200" />
    <button type="button" class="blatt-haupt" onclick={() => void uebernehmen()}
      >{t('fragenEinstellungen.uebernehmen')}</button
    >
    <button type="button" class="blatt-leise" onclick={() => void loeschen()}
      >{t('fragenEinstellungen.loeschen')}</button
    >
  {/if}
</Sheet>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0 calc(48px + env(safe-area-inset-bottom));
  }

  .kopf {
    min-height: var(--tap-target);
    padding: 0 var(--space-5) 0 12px;
  }

  .titelblock {
    padding: 16px var(--space-5) 0;
  }

  .lead {
    margin: 8px 0 0;
    color: var(--ink-muted);
    font-size: calc(15 * var(--px));
    line-height: 1.4;
  }

  .fe-abschnitt {
    margin: 24px var(--space-4) 0;
  }

  /* Ü1: Großbuchstaben mit 18 px Zeilenabstand, auch wenn sie umbrechen. */
  .fe-kopf {
    margin: 0 4px 8px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  button.listenzeile {
    width: 100%;
  }

  .frage {
    font-weight: 500;
  }

  /* „···“: Tippfläche 44 px, mittig wie Pfeile und Schalter. */
  .mehr {
    display: grid;
    flex: none;
    place-items: center;
    width: var(--tap-target);
    height: var(--tap-target);
    margin-right: -10px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink-muted);
    font: inherit;
    font-size: calc(18 * var(--px));
    font-weight: 700;
    letter-spacing: 0.08em;
    cursor: pointer;
  }

  .plus {
    gap: 12px;
  }

  .plus-zeichen {
    display: inline-flex;
    flex: none;
  }

  .neu {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 16px;
  }

  .neu input {
    flex: 1 1 12em;
    min-width: 0;
  }

  .hinzu,
  .blatt-haupt {
    min-height: var(--tap-target);
    padding: 0 18px;
    border: 0;
    border-radius: var(--radius-full);
    background: var(--action);
    color: var(--on-action);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .unten {
    margin: 12px 4px 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  .blatt-feld {
    display: block;
    width: 100%;
    margin: 0 0 16px;
  }

  .blatt-haupt {
    width: 100%;
    min-height: 54px;
  }

  .blatt-leise {
    display: block;
    width: 100%;
    min-height: var(--tap-target);
    margin-top: 8px;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
</style>
