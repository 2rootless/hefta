import { describe, expect, it } from 'vitest';
import { teilenZiel } from './teilenZiel';

describe('Ziel beim Teilen', () => {
  it('nennt bekannte Apps unter iOS und Android', () => {
    expect(teilenZiel('com.apple.UIKit.activity.Mail')).toBe('Mail');
    expect(teilenZiel('net.whatsapp.WhatsApp.ShareExtension')).toBe('WhatsApp');
    expect(teilenZiel('com.whatsapp')).toBe('WhatsApp');
    expect(teilenZiel('com.google.Gmail.ShareExtension')).toBe('Gmail');
    expect(teilenZiel('com.google.android.gm')).toBe('Gmail');
    expect(teilenZiel('ch.protonmail.protonmail.share')).toBe('Proton Mail');
    expect(teilenZiel('com.apple.DocumentManagerUICore.SaveToFiles')).toBe('Dateien');
  });

  it('lässt Unbekanntes leer', () => {
    expect(teilenZiel('com.beispiel.irgendwas')).toBe('');
    expect(teilenZiel(undefined)).toBe('');
  });
});
