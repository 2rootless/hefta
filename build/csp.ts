// Eine Quelle für die Content-Security-Policy: Meta-Tag im HTML und HTTP-Header beim Hosting.
// connect-src erlaubt den eigenen Ursprung und genau eine fremde Adresse: den Empfang der
// Rückmeldung (E54, E57), den die App nur nach „Abschicken“ in der Rückfrage aufruft.
const gemeinsam = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' https://hefta.de/api/rueckmeldung",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
];

/** Für das Meta-Tag; frame-ancestors wirkt nur als Header. */
export const cspMeta = gemeinsam.join('; ');

/** Für den HTTP-Header beim Hosting. */
export const cspHeader = [...gemeinsam, "frame-ancestors 'none'"].join('; ');

// Die Vermieter-Seite hat eine eigene Adresse und verbietet sich jede Verbindung, auch dem Worker von
// PDF.js: Der bekommt seine Regel aus den Kopfzeilen seiner eigenen Datei, darum gilt sie für /*.
const vermieter = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'none'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
];

export const vermieterCspMeta = vermieter.join('; ');
export const vermieterHeadersFile = `/*
  Content-Security-Policy: ${[...vermieter, "frame-ancestors 'none'"].join('; ')}
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  Cross-Origin-Opener-Policy: same-origin
  Permissions-Policy: geolocation=(), microphone=(), payment=(), usb=(), interest-cohort=()
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

export const headersFile = `/*
  Content-Security-Policy: ${cspHeader}
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  Cross-Origin-Opener-Policy: same-origin
  Permissions-Policy: geolocation=(), microphone=(), payment=(), usb=(), interest-cohort=()

/index.html
  Cache-Control: no-cache

/
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-cache

/manifest.webmanifest
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
