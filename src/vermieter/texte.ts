import texte from '../i18n/vermieter.de.json';

// Texte der Vermieter-Seite. Gesiezt (T9), darum getrennt von den Texten der App.
export type TextId = keyof typeof texte;

export function t(id: TextId, werte: Record<string, string | number> = {}): string {
  return texte[id].replace(/\{(\w+)\}/g, (_, name: string) => String(werte[name] ?? ''));
}
