import type { Page } from '@playwright/test';

// W11 (Wunschliste Fassung 16, „Daten auf Hefta-Art“): Keine Anfrage an einen Dienst enthält Name, Mail,
// Telefon, Adresse oder Unterlagen. Diese Hilfe sammelt jede Anfrage einer Seite mit Adresse und Inhalt und
// sucht darin die Werte, die nie hinausgehen dürfen.

/** Eine beobachtete Anfrage: Adresse, Art und Inhalt (auch binär, als Latin-1 gelesen). */
export interface Anfrage {
  url: string;
  methode: string;
  inhalt: string;
}

/** Sammelt ab jetzt jede Anfrage der Seite. Lokale Adressen (blob:, data:) gehen nie aus dem Gerät. */
export function anfragenSammeln(page: Page): Anfrage[] {
  const liste: Anfrage[] = [];
  page.on('request', (r) => {
    if (/^(blob|data):/.test(r.url())) return;
    liste.push({
      url: r.url(),
      methode: r.method(),
      inhalt: r.postDataBuffer()?.toString('latin1') ?? '',
    });
  });
  return liste;
}

/** Wie ein Wert in einer Anfrage stehen könnte: wörtlich, URL-kodiert, als UTF-8-Bytes, mit Leerzeichen als +. */
function formen(wert: string): string[] {
  const kodiert = encodeURIComponent(wert);
  return [
    wert,
    kodiert,
    kodiert.replace(/%20/g, '+'),
    Buffer.from(wert, 'utf8').toString('latin1'),
    JSON.stringify(wert).slice(1, -1),
  ].map((f) => f.toLowerCase());
}

/**
 * Anfragen, in deren Adresse oder Inhalt einer der Werte steht, als „METHODE url: Wert“. Leer heißt: Kein
 * Name, keine Mail, kein Telefon, keine Adresse und kein Inhalt einer Unterlage ist hinausgegangen.
 */
export function verboteneAnfragen(anfragen: Anfrage[], werte: string[]): string[] {
  const treffer: string[] = [];
  for (const a of anfragen) {
    const text = `${a.url}\n${a.inhalt}`.toLowerCase();
    for (const wert of werte)
      if (formen(wert).some((f) => text.includes(f)))
        treffer.push(`${a.methode} ${a.url}: ${wert}`);
  }
  return treffer;
}
