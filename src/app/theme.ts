// Hell oder Dunkel (design/README.md, Farbe): folgt der Systemeinstellung, außer man wählt in den
// Einstellungen fest „Hell“ oder „Dunkel“ (Auftraggeber, 12.11.). Die Wahl gilt nur auf diesem Gerät und
// liegt im Browser-Speicher, damit sie schon vor dem Laden der Datenbank greift; fehlt der Speicher
// (privates Surfen), gilt das System. In der App auf dem iPhone setzt Hefta die Wahl auch für das
// Fenster, damit Statusleiste und Systemfenster mitgehen.

export type Aussehen = 'system' | 'hell' | 'dunkel';

const SCHLUESSEL = 'hefta-aussehen';
const dunkelImSystem = () => window.matchMedia('(prefers-color-scheme: dark)');
/** Ohne Browser-Speicher: die Wahl bis zum nächsten Start. */
let ohneSpeicher: Aussehen | null = null;

export function aussehenWahl(): Aussehen {
  try {
    const w = localStorage.getItem(SCHLUESSEL);
    return w === 'hell' || w === 'dunkel' ? w : 'system';
  } catch {
    return ohneSpeicher ?? 'system';
  }
}

function anwenden(): void {
  const wahl = aussehenWahl();
  const dunkel = wahl === 'dunkel' || (wahl === 'system' && dunkelImSystem().matches);
  const wurzel = document.documentElement;
  wurzel.dataset.theme = dunkel ? 'dark' : 'light';
  // Felder des Browsers (Datum, Uhrzeit) passen sich mit an.
  wurzel.style.colorScheme = wahl === 'system' ? '' : dunkel ? 'dark' : 'light';
}

async function fensterSetzen(wahl: Aussehen): Promise<void> {
  const { istIosApp } = await import('./plattform');
  if (!istIosApp()) return;
  const { HeftaNativ } = await import('./heftaNativ');
  await HeftaNativ.aussehen({ stil: wahl }).catch(() => {});
}

export function aussehenSetzen(wahl: Aussehen): void {
  try {
    if (wahl === 'system') localStorage.removeItem(SCHLUESSEL);
    else localStorage.setItem(SCHLUESSEL, wahl);
  } catch {
    ohneSpeicher = wahl;
  }
  anwenden();
  void fensterSetzen(wahl);
}

export function themaFolgen(): void {
  anwenden();
  dunkelImSystem().addEventListener('change', anwenden);
  const wahl = aussehenWahl();
  if (wahl !== 'system') void fensterSetzen(wahl);
}
