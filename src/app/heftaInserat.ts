import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { istIosApp } from './plattform';

// Neues Heft aus dem Link (B23 Bildschirm 1 und 2), nur in der App für iPhone
// (ios/App/App/HeftaNativPlugin.swift, `HeftaInseratPlugin`): der Einsetzen-Knopf von iOS an fester
// Stelle, das stille Prüfen der Zwischenablage, die Vorschau aus genau einem unsichtbaren Laden (E72)
// und „Ganze Seite ansehen“. Im Browser gibt es das nicht; dort bleibt der Weg über den Text.

/** Was die unsichtbare Vorschau gelesen hat. `bild` ist ein verkleinertes Foto als Daten-Adresse. */
export interface InseratGelesen {
  zustand: 'ok' | 'zeit' | 'netz' | 'fehler';
  url?: string;
  titel?: string;
  h1?: string;
  ogTitle?: string | null;
  text?: string;
  bild?: string;
  bildHoch?: boolean;
  http?: number;
}

export interface HeftaInseratPlugin {
  /** Legt den Knopf an diese Stelle (CSS-Pixel); `geht: false` vor iOS 16. */
  knopf(o: {
    x: number;
    y: number;
    breite: number;
    hoehe: number;
    verzoegerung?: number;
  }): Promise<{ geht: boolean }>;
  knopfWeg(): Promise<void>;
  /** Still geprüft, ohne die Zwischenablage zu lesen. */
  ablage(): Promise<{ link: boolean; inhalt: boolean }>;
  vorschau(o: { url: string }): Promise<InseratGelesen>;
  vorschauAbbrechen(): Promise<void>;
  seite(o: { url: string }): Promise<void>;
  addListener(
    ereignis: 'eingesetzt',
    tun: (d: { url?: string; text?: string; leer?: boolean }) => void,
  ): Promise<PluginListenerHandle>;
}

let plugin: HeftaInseratPlugin | null = null;

/**
 * Das Plugin, oder null im Browser. Browsertests setzen `window.__heftaInseratTest` als Ersatz, so lässt
 * sich der Weg der App ohne iPhone durchspielen.
 */
export function heftaInserat(): HeftaInseratPlugin | null {
  const ersatz = (window as unknown as { __heftaInseratTest?: HeftaInseratPlugin })
    .__heftaInseratTest;
  if (ersatz) return ersatz;
  if (!istIosApp()) return null;
  plugin ??= registerPlugin<HeftaInseratPlugin>('HeftaInserat');
  return plugin;
}

/** Der erste Link in einem eingesetzten Text (WG-Gesucht kopiert Titel und Link, E75). */
export function linkAus(text: string): string | null {
  const fund = text.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  if (fund) return fund.replace(/[).,;:!?»“”]+$/, '');
  const roh = text.trim();
  if (/^[\w-]+(\.[\w-]+)+\/\S*$/.test(roh)) return `https://${roh}`;
  return null;
}

/** Führt der Link zu einer Trefferliste statt zu einem Inserat (B23 Bildschirm 5)? */
export function istTrefferliste(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const pfad = u.pathname.toLowerCase();
    if (host.endsWith('immobilienscout24.de')) return !/\/expose\/\d+/.test(pfad);
    if (host.endsWith('immowelt.de')) return !/\/(expose|projekte\/expose)\//.test(pfad);
    if (host.endsWith('kleinanzeigen.de')) return !/^\/s-anzeige\//.test(pfad);
    if (host.endsWith('wg-gesucht.de')) return !/(^\/|\.)\d{6,}\.html$/.test(pfad);
    return false;
  } catch {
    return false;
  }
}

/** Die Nummer des Inserats aus dem Link (B23: „ImmoScout24 · Inserat 148392017“). */
export function inseratNummer(url: string): string | null {
  try {
    return new URL(url).pathname.match(/(\d{6,})/)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Gleiche Inserate erkennen (E56): Adresse ohne Anfrage, Anker und Schrägstrich am Ende. */
export function linkSchluessel(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}
