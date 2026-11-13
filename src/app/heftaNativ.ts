import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

// Eigener Baustein der App (android/.../HeftaNativPlugin.java, ios/App/App/HeftaNativPlugin.swift):
// Sichern-Dialog des Systems und PDFs, die andere Apps an Hefta schicken.

export interface EmpfangeneDatei {
  uri: string;
  name: string;
}

export interface HeftaNativPlugin {
  alsDateiSichern(optionen: {
    uri: string;
    name: string;
    typ: string;
  }): Promise<{ gesichert: boolean }>;
  /** Nur iOS: Auswahl, die nur Hefta-Backups anbietet. Leer, wenn abgebrochen. */
  backupWaehlen(): Promise<{ uri?: string; name?: string }>;
  /** Nur iOS: das Kalenderfenster des Systems mit einem Termin (Zeile 9). */
  termin(o: {
    titel: string;
    /** Beginn in Millisekunden seit 1970. */
    start: number;
    dauerMin: number;
    /** Erinnerungen, je in Minuten vor dem Beginn. */
    erinnerungenMin: number[];
    ort?: string;
    notiz?: string;
  }): Promise<{ gesichert: boolean; erlaubt: boolean }>;
  /** Nur iOS: Aussehen des Fensters, damit Statusleiste und Systemfenster mitgehen. */
  aussehen(o: { stil: 'system' | 'hell' | 'dunkel' }): Promise<void>;
  /** Nur iOS: das eigene Mailfenster mit Anhängen (Zeile 8). */
  mail(o: {
    an?: string;
    betreff: string;
    text: string;
    anhaenge: { uri: string; name: string; typ: string }[];
  }): Promise<{
    status: 'gesendet' | 'gespeichert' | 'fehlgeschlagen' | 'abgebrochen' | 'keinKonto';
  }>;
  /** Nur iOS: Teilen-Blatt, das Mail-Apps den Betreff mitgibt (ohne Konto in Apple Mail). */
  teilen(o: { dateien: string[]; text?: string; betreff: string }): Promise<{ geteilt: boolean }>;
  /** Nur iOS: Erinnerungen neu planen (Zeile 9). `erlaubt`: Mitteilungen sind erlaubt. */
  erinnerungenSetzen(o: {
    liste: { nummer: number; am: number; titel: string; text: string; ziel: string }[];
  }): Promise<{ erlaubt: boolean }>;
  addListener(
    ereignis: 'erinnerung',
    aufruf: (daten: { ziel: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    ereignis: 'eingang',
    aufruf: (daten: { dateien: EmpfangeneDatei[] }) => void,
  ): Promise<PluginListenerHandle>;
}

export const HeftaNativ = registerPlugin<HeftaNativPlugin>('HeftaNativ');
