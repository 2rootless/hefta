<script lang="ts">
  import { zurueckZumHeft } from '../domain/heftKarte';
  // Löschbitte und „Kurz nachfragen“ (B18 `s=loeschbitte`, `s=nachfassen`; Zeile 9): eine kurze Mail mit
  // Betreff und Text, die man vor dem Öffnen ändern kann. Hefta verschickt nichts selbst; es merkt sich,
  // dass die Mail geöffnet wurde. Ob der Vermieter gelöscht hat, kann Hefta nicht wissen.
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { abschliessen } from '../app/router.svelte';
  import { adresseZeilen } from '../domain/adresse';
  import { loeschbitteText, nachfassText } from '../domain/bewerben';
  import { spurAn, spurEintragen } from '../domain/datenspur';
  import { erkennen } from '../domain/nachricht';
  import { t } from '../i18n';
  import { heftAendern } from '../storage/speicher';
  import { mailOhneAnhang } from '../ui/bewerbenSenden';
  import Hauptbutton from '../ui/Hauptbutton.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  let { id, art }: { id: string; art: 'loeschbitte' | 'nachfassen' } = $props();

  const heft = $derived(daten.hefte.find((h) => h.id === id) ?? null);
  const vertrag = $derived(
    (daten.ansicht?.mitglieder ?? []).filter(
      (m) => !m.zugehoerigkeit.herausgenommenAm && m.zugehoerigkeit.rolle !== 'buerge',
    ),
  );
  // Ohne Haushalt „ihr“ (E74.4), sonst ab zwei Personen im Vertrag.
  const ihr = $derived(!daten.ansicht || vertrag.length > 1);
  const an = $derived(erkennen(heft?.inseratText ?? '').mail);

  const vorschlag = $derived.by(() => {
    if (!heft) return { betreff: '', text: '' };
    const auftrag = {
      wir: ihr,
      anbieter: heft.angaben?.anbieter,
      strasse: (adresseZeilen(heft.adresse)[0] ?? '').replace(/\u00a0/g, ' ').trim(),
      beworbenAm: heft.ereignisse.beworben?.am ?? null,
      namen: vertrag.map((m) => `${m.person.vorname} ${m.person.nachname}`.trim()),
      heute: new Date(),
    };
    return art === 'loeschbitte' ? loeschbitteText(auftrag) : nachfassText(auftrag);
  });

  // Einmal vorbelegt; danach gehört der Text dem Nutzer.
  let betreff = $state('');
  let text = $state('');
  let von = $state<string | null>(null);
  $effect(() => {
    if (heft && von !== `${heft.id}/${art}`) {
      von = `${heft.id}/${art}`;
      betreff = vorschlag.betreff;
      text = vorschlag.text;
    }
  });

  async function oeffnen() {
    if (!heft) return;
    const ergebnis = await mailOhneAnhang({ an, betreff, text });
    if (ergebnis === 'abgebrochen') return;
    const am = new Date().toISOString();
    const e = $state.snapshot(heft.ereignisse);
    // E100: Sicher nur, wenn das Mailfenster „gesendet“ meldet; sonst fragt Hefta einmal im Heft.
    if (ergebnis !== 'gesendet') {
      await heftAendern(await db(), heft.id, {
        ereignisse:
          art === 'loeschbitte' ? { ...e, loeschbitteOffen: am } : { ...e, nachfrageOffen: am },
      });
      await stillLaden();
      abschliessen(`/heft/${heft.id}`);
      return;
    }
    await heftAendern(await db(), heft.id, {
      ereignisse: art === 'loeschbitte' ? { ...e, loeschbitteAm: am } : { ...e, nachgefasstAm: am },
      // Datenspur: auch diese Mail ging mit euren Namen hinaus.
      spur: spurEintragen($state.snapshot(heft.spur), {
        am,
        art: art === 'loeschbitte' ? 'loeschbitte' : 'nachfrage',
        weg: 'mail',
        an: spurAn({ anbieter: heft.angaben?.anbieter, mail: an, portal: null, weg: 'mail' }),
      }),
    });
    await stillLaden();
    abschliessen(`/heft/${heft.id}`);
  }
</script>

<main class="seite">
  <header class="kopf">
    <Zurueck href={`#/heft/${id}`} text={zurueckZumHeft(heft) ?? t('heftMail.zurueck')} />
  </header>

  {#if !heft}
    <p class="sub">{t('heft.fehlt')}</p>
  {:else}
    <h1 class="h2">
      {t(art === 'loeschbitte' ? 'heftMail.titelLoeschbitte' : 'heftMail.titelNachfassen')}
    </h1>
    <p class="sub">
      {t(
        art === 'loeschbitte'
          ? ihr
            ? 'heftMail.subLoeschbitteIhr'
            : 'heftMail.subLoeschbitteDu'
          : ihr
            ? 'heftMail.subNachfassenIhr'
            : 'heftMail.subNachfassenDu',
      )}
    </p>

    <h2 class="h3">{t('heftMail.an')}</h2>
    <p class="an">{an ?? t('heftMail.anFehlt')}</p>

    <h2 class="h3"><label for="nachricht-betreff">{t('heftMail.betreff')}</label></h2>
    <div class="feld">
      <!-- Zwei Zeilen: Ein langer Betreff bricht um, statt aus dem Feld zu ragen (Prüfkatalog C15). -->
      <textarea id="nachricht-betreff" class="betreff" rows="2" bind:value={betreff}></textarea>
    </div>

    <h2 class="h3"><label for="nachricht-text">{t('heftMail.text')}</label></h2>
    <div class="feld gross">
      <textarea id="nachricht-text" rows="11" bind:value={text}></textarea>
    </div>

    <div class="cta">
      <Hauptbutton text={t('heftMail.mailOeffnen')} onclick={oeffnen} />
      <p class="selbst">{t('heftMail.selbst')}</p>
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
    margin: 0 0 8px;
    color: var(--ink-muted);
  }

  .h3 {
    margin: 22px 0 8px;
    font-size: calc(16 * var(--px));
    font-weight: 650;
  }

  .an {
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--ink-muted);
  }

  .feld {
    display: flex;
    align-items: center;
    min-height: 52px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .feld:focus-within {
    border-color: var(--ink);
  }

  .feld textarea {
    flex: 1;
    min-width: 0;
    padding: 12px 0;
    border: 0;
    outline: 0;
    background: none;
    color: var(--ink);
    font: inherit;
  }

  .feld .betreff {
    resize: none;
    font-weight: 600;
  }

  .feld textarea {
    resize: vertical;
    line-height: 1.45;
  }

  .cta {
    position: sticky;
    bottom: 0;
    z-index: 2;
    margin: 24px calc(-1 * var(--space-4)) 0;
    padding: 12px var(--space-4) calc(env(safe-area-inset-bottom) + 16px);
    background: var(--ground);
    box-shadow: 0 -14px 14px -2px var(--ground);
  }

  .selbst {
    margin: 8px 0 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    text-align: center;
  }
</style>
