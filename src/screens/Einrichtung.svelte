<script lang="ts">
  // Einrichtung Schritt 1 „Wer bist du?“ (design/einrichtung-rutsch-navigation.md, Abschnitt 1):
  // sofort mit dem Namen los, darunter Bezeichnung und Einkommen (vorbelegt „Angestellt“).
  // „Weiter“ legt den Haushalt mit der ersten Person an (oder ändert sie) und führt zu Schritt 2.
  import { daten, db, gehe, neuLaden } from '../app/daten.svelte';
  import { t } from '../i18n';
  import {
    einstellungenAendern,
    haushaltAendern,
    haushaltAnlegen,
    personAendern,
    zugehoerigkeitAendern,
  } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import { rufnameFolgt } from '../domain/modell';
  import { lateinFehlt, nameMappeAus } from '../domain/namen';
  import PersonFormular, { type PersonEingabe } from '../ui/PersonFormular.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  const erste = $derived(
    daten.ansicht?.mitglieder.find((m) => m.zugehoerigkeit.rolle === 'hauptmieter'),
  );
  let werte = $state<PersonEingabe>({
    vorname: '',
    nachname: '',
    rufname: '',
    bezeichnung: null,
    lebenssituation: 'angestellt',
  });
  // Zurück aus Schritt 2: Angaben der ersten Person vorbelegen.
  let vorbelegt = false;
  $effect(() => {
    if (erste && !vorbelegt) {
      vorbelegt = true;
      werte = {
        vorname: erste.person.vorname,
        nachname: erste.person.nachname,
        rufname: erste.person.rufname,
        nameMappe: erste.person.nameMappe ?? null,
        bezeichnung: erste.zugehoerigkeit.bezeichnung,
        lebenssituation: erste.person.lebenssituation ?? 'angestellt',
        ausbildungArt: erste.person.ausbildungArt ?? null,
      };
    }
  });

  let speichert = $state(false);
  const grund = $derived(
    !werte.vorname.trim()
      ? t('einrichtung.erste.grundName')
      : lateinFehlt(werte)
        ? t('personSeite.grundLatein')
        : !werte.bezeichnung
          ? t('einrichtung.erste.grundBezeichnung')
          : undefined,
  );

  async function weiter() {
    if (grund || speichert || !werte.bezeichnung) return;
    speichert = true;
    const verbindung = await db();
    const angaben = {
      vorname: werte.vorname.trim(),
      nachname: werte.nachname.trim(),
      rufname: werte.rufname.trim(),
      nameMappe: nameMappeAus(werte),
      bezeichnung: werte.bezeichnung,
      lebenssituation: werte.lebenssituation,
      ausbildungArt: werte.ausbildungArt ?? null,
    };
    if (erste) {
      const { bezeichnung, ...person } = angaben;
      await personAendern(verbindung, erste.person.id, {
        ...person,
        rufname: rufnameFolgt(erste.person.vorname, person.vorname, person.rufname),
      });
      await zugehoerigkeitAendern(verbindung, erste.zugehoerigkeit.id, { bezeichnung });
    } else {
      const neu = await haushaltAnlegen(verbindung, {
        kinder: 0,
        weitereErwachsene: 0,
        personen: [{ ...angaben, rolle: 'hauptmieter' }],
      });
      // Angefangen, bis Schritt 2 fertig ist (B26): Bricht man ab, zeigt der Tab „Mappe“ den Stand.
      await haushaltAendern(verbindung, neu.id, { einrichtungOffen: true });
      // Dauerhaften Speicher anfragen, sobald es etwas zu bewahren gibt.
      try {
        await navigator.storage?.persist?.();
      } catch {
        // Nicht jeder Browser kann das; das Backup bleibt die Absicherung.
      }
      await einstellungenAendern(verbindung, { speicherAngefragt: true });
    }
    await neuLaden();
    speichert = false;
    gehe('/einrichtung/2');
  }
</script>

<main class="seite">
  <div class="kopf">
    <Zurueck href="#/" text={t('allgemein.zurueck')} />
    <span class="zaehler">{t('allgemein.schrittVon', { schritt: 1, gesamt: 2 })}</span>
  </div>
  <div class="titelblock">
    <h1 class="display frage">{t('einrichtung.erste.titel')}</h1>
    <p class="lead">{t('einrichtung.erste.lead')}</p>
  </div>
  <div class="inhalt">
    <PersonFormular
      bind:werte
      rolle="hauptmieter"
      du
      gespeichert={erste?.person}
      gespeicherteTypen={(daten.ansicht?.dokumente ?? [])
        .filter((d) => d.personId === erste?.person.id)
        .filter((d) => daten.ansicht?.versionen.some((v) => v.dokumentId === d.id))
        .map((d) => d.typ)}
    />
  </div>
</main>
<Aktionsleiste text={t('einrichtung.erste.knopf')} {grund} onclick={weiter} />

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) var(--space-4)
      max(calc(140px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: var(--tap-target);
    padding-right: var(--space-2);
  }

  .zaehler {
    font-size: calc(14 * var(--px));
    font-weight: 600;
    color: var(--ink-muted);
  }

  .titelblock {
    padding: 6px var(--space-1) 0;
  }

  .frage {
    margin-top: 10px;
    text-wrap: balance;
  }

  .inhalt {
    margin-top: var(--space-5);
  }
</style>
