// Service Worker von Hefta. Wird beim Build mit Version und Dateiliste befüllt.
// Lädt ausschließlich Dateien vom eigenen Host. Eine neue Version wartet,
// bis der Nutzer „Aktualisieren“ tippt (Nachricht 'aktualisieren').
/// <reference lib="webworker" />

const VERSION = '__VERSION__';
/** @type {string[]} */
const DATEIEN = /** @type {string[]} */ (/** @type {unknown} */ ('__DATEIEN__'));
const CACHE = `hefta-${VERSION}`;

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' })))),
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== CACHE && name !== 'kalender') await caches.delete(name);
      }
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener('message', (event) => {
  if (event.data === 'aktualisieren') void sw.skipWaiting();
  if (event.data === 'version') event.source?.postMessage({ version: VERSION });
});

sw.addEventListener('fetch', (event) => {
  const anfrage = event.request;
  const url = new URL(anfrage.url);
  if (anfrage.method !== 'GET' || url.origin !== sw.location.origin) return;

  // Die Lizenztexte sind eine Datei, keine Seite der App: nicht zwischenspeichern, nicht umleiten.
  if (url.pathname.endsWith('/lizenzen.txt')) return;
  // Der Ratgeber ebenso: eine eigene Seite, die App darf sich nicht davorschieben.
  if (
    url.pathname.includes('/was-darf-der-vermieter-verlangen') ||
    url.pathname.includes('/datenschutz/') ||
    url.pathname.includes('/ratgeber/') ||
    // Die Seite der Rückmeldung für Links von außen (E54).
    url.pathname.includes('/rueckmeldung/')
  )
    return;

  // Version 2, Kalender: Die Seite legt eine .ics-Datei hier ab und öffnet sie. So sieht iOS eine
  // echte Antwort vom Typ text/calendar, ohne dass etwas ans Netz geht.
  if (url.pathname.endsWith('.ics')) {
    event.respondWith(
      caches
        .match(anfrage, { cacheName: 'kalender' })
        .then((treffer) => treffer ?? new Response(null, { status: 404 })),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (anfrage.mode === 'navigate') {
        const shell = await cache.match('./');
        if (shell) return shell;
      }
      // ignoreVary: Module-Skripte kommen mit Origin-Kopf, die vorab gecachten Antworten ohne.
      const treffer = await cache.match(anfrage, { ignoreSearch: true, ignoreVary: true });
      return treffer ?? fetch(anfrage);
    })(),
  );
});
