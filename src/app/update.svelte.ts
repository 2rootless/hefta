// Service Worker anmelden und „Neue Version verfügbar“ melden, statt still auszutauschen.

export const update = $state({ verfuegbar: false });

let wartend: ServiceWorker | null = null;
let aktualisierungAngefordert = false;

// Lief beim Start schon eine Version? Nur dann ist ein neuer Service Worker ein Update.
// Beim allerersten Start übernimmt er still (WebKit meldet „installed“ teils erst nach der Übernahme).
let hatteVersion = false;

/** Auf der Übersicht ohne offenes Blatt geht nichts verloren: Hier darf neu gestartet werden (G3). */
function ruhigerMoment(): boolean {
  const pfad = window.location.hash.replace(/^#/, '') || '/';
  return pfad === '/' && !document.querySelector('dialog[open]');
}

function melden(worker: ServiceWorker | null): void {
  if (!worker || !hatteVersion) return;
  wartend = worker;
  update.verfuegbar = true;
}

export async function serviceWorkerAnmelden(): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  hatteVersion = !!navigator.serviceWorker.controller;

  const registrierung = await navigator.serviceWorker.register('./sw.js', { scope: './' });
  melden(registrierung.waiting);
  if (wartend && ruhigerMoment()) aktualisieren();

  registrierung.addEventListener('updatefound', () => {
    // Ab jetzt ist eine Version aktiv; jede weitere ist ein Update.
    if (navigator.serviceWorker.controller) hatteVersion = true;
    const neu = registrierung.installing;
    neu?.addEventListener('statechange', () => {
      if (neu.state === 'installed') melden(neu);
    });
  });

  // Nur nach „Aktualisieren“ neu laden. Beim allerersten Start übernimmt der Service Worker
  // ebenfalls die Steuerung; dann darf die Seite nicht ungefragt neu laden.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!aktualisierungAngefordert) return;
    aktualisierungAngefordert = false;
    window.location.reload();
  });

  // Beim Zurückkehren in die App: Auf dem iPhone läuft eine Web-App oft einfach weiter, „das nächste
  // Öffnen“ ist also dieser Moment. Steht eine neue Version bereit, startet sie jetzt; sonst nach
  // einer fragen (nur beim eigenen Host).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (wartend && ruhigerMoment()) aktualisieren();
    else void registrierung.update().catch(() => {});
  });
}

export function aktualisieren(): void {
  aktualisierungAngefordert = true;
  wartend?.postMessage('aktualisieren');
}
