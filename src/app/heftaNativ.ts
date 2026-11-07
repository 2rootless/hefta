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
  addListener(
    ereignis: 'eingang',
    aufruf: (daten: { dateien: EmpfangeneDatei[] }) => void,
  ): Promise<PluginListenerHandle>;
}

export const HeftaNativ = registerPlugin<HeftaNativPlugin>('HeftaNativ');
