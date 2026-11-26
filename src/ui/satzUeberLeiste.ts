// DP150 C5: Bekommt ein Feld im Prüfzustand (W33) den Fokus, steht auch sein Satz (`aria-describedby`, etwa „Eine
// Postleitzahl in Deutschland hat fünf Ziffern. Stimmt sie so?“) über der Leiste, mit 16 px Luft. Der Browser
// scrollt von sich aus nur das Feld in den Blick; den Rest scrollt diese Funktion nach.

const LUFT = 16;

/** Oberkante der sichtbaren Leiste unten, sonst die Unterkante des Fensters. */
function grenzeUnten(): number {
  // Die Leiste steht fest (position: fixed); `offsetParent` ist bei ihr immer null, darum Größe und Sichtbarkeit.
  const leiste = [...document.querySelectorAll<HTMLElement>('.leiste')].find((l) => {
    const r = l.getBoundingClientRect();
    return (
      r.height > 0 && r.top < window.innerHeight && getComputedStyle(l).visibility !== 'hidden'
    );
  });
  return (leiste ? leiste.getBoundingClientRect().top : window.innerHeight) - LUFT;
}

export function satzUeberLeiste(e: FocusEvent): void {
  const feld = e.target;
  if (!(feld instanceof HTMLElement) || !feld.classList.contains('pruefzustand')) return;
  requestAnimationFrame(() => {
    const saetze = (feld.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id))
      .filter((s): s is HTMLElement => !!s);
    const unten = Math.max(
      feld.getBoundingClientRect().bottom,
      ...saetze.map((s) => s.getBoundingClientRect().bottom),
    );
    const zuTief = unten - grenzeUnten();
    if (zuTief > 0) window.scrollBy(0, Math.ceil(zuTief));
  });
}
