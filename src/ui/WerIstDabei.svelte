<script lang="ts">
  // Wer ist dabei, Langform (E25, design/wer-ist-dabei.md): drei Gruppen nach dem Mietvertrag, Namen oder
  // Zählungen darunter, keine Summe. Für Backup erstellen, Backup einspielen und „Alles löschen“.
  import { werIstDabeiLang } from '../domain/mappeWoerter';
  import type { Bestand } from '../storage/sicherung';

  let { bestand }: { bestand: Bestand } = $props();

  const gruppen = $derived(
    werIstDabeiLang({
      vertrag: bestand.vertragNamen,
      kinder: bestand.kinder,
      weitere: bestand.weitere,
      buergen: bestand.buergenNamen,
    }),
  );
</script>

<dl class="wer">
  {#each gruppen as g (g.titel)}
    <dt>{g.titel}</dt>
    {#each g.eintraege as e, i (i)}<dd>{e}</dd>{/each}
  {/each}
</dl>

<style>
  .wer {
    margin: 2px 0 0;
  }

  dt {
    margin-top: 6px;
    color: var(--ink-muted);
    font-size: 14px;
    font-weight: 700;
  }

  dt:first-child {
    margin-top: 0;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
</style>
