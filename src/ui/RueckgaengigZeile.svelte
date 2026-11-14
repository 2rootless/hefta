<script lang="ts">
  import { verbindungPruefen } from '../app/daten.svelte';
  import { rueck, rueckgaengigAnbieten, rueckgaengigVergessen } from '../app/rueckgaengig.svelte';
  import { t } from '../i18n';

  async function zurueck() {
    const eintrag = rueck.eintrag;
    if (!eintrag) return;
    rueckgaengigVergessen();
    try {
      await eintrag.ausfuehren();
    } catch {
      // Es bleibt beim Angebot: Meist hilft ein zweiter Versuch mit frischer Verbindung.
      await verbindungPruefen();
      rueckgaengigAnbieten({ ...eintrag, text: t('allgemein.rueckgaengigFehler') });
    }
  }

  // PC23 B5: Nach unten wischen schließt die Leiste, statt zu warten. Die Leiste folgt dem Finger, ab
  // 40 px nach unten ist sie weg; sonst springt sie zurück.
  let start: { y: number; id: number } | null = null;
  let weg = $state(0);
  function runter(e: PointerEvent) {
    if ((e.target as Element).closest('button')) return;
    start = { y: e.clientY, id: e.pointerId };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function ziehen(e: PointerEvent) {
    if (start && e.pointerId === start.id) weg = Math.max(0, e.clientY - start.y);
  }
  function los(e: PointerEvent) {
    if (!start || e.pointerId !== start.id) return;
    start = null;
    if (weg > 40) rueckgaengigVergessen();
    weg = 0;
  }
</script>

<div
  class="zeile"
  role="status"
  style:transform={weg ? `translateY(${weg}px)` : undefined}
  style:opacity={weg ? Math.max(0.3, 1 - weg / 120) : undefined}
  onpointerdown={runter}
  onpointermove={ziehen}
  onpointerup={los}
  onpointercancel={los}
>
  <span>{rueck.eintrag?.text}</span>
  <button type="button" onclick={zurueck}>{t('allgemein.rueckgaengig')}</button>
</div>

<style>
  .zeile {
    touch-action: pan-x;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px 10px;
    min-height: 52px;
    margin-bottom: 10px;
    padding: 4px 6px 4px 16px;
    border-radius: 16px;
    background: var(--action);
    color: var(--on-action);
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
  }

  span {
    flex: 1 1 150px;
    min-width: 0;
    padding: 8px 0;
  }

  button {
    min-height: var(--tap-target);
    margin-left: auto;
    padding: 0 12px;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 4px;
    cursor: pointer;
  }
</style>
