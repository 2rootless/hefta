import { describe, expect, it } from 'vitest';
import { teilenWerten, teilenZiel } from './teilenZiel';

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

describe('Zählt das Teilen als Bewerbung (PC31)', () => {
  const GMAIL = 'com.google.Gmail.ShareExtension';
  const PROTON = 'ch.protonmail.protonmail.share';

  it('Gmail mit „fertig“ gilt als gesendet, abgebrochen als nichts', () => {
    expect(teilenWerten(GMAIL, true, 'mail')).toBe('gesendet');
    expect(teilenWerten(GMAIL, false, 'mail')).toBe('nichts');
  });

  it('Proton Mail und andere Mail-Apps fragen nach, auch beim Weg „Portal“', () => {
    expect(teilenWerten(PROTON, true, 'mail')).toBe('unsicher');
    expect(teilenWerten('com.apple.UIKit.activity.Mail', true, 'portal')).toBe('unsicher');
    expect(teilenWerten(PROTON, true, 'website')).toBe('nichts');
  });

  it('WhatsApp, Dateien, Proton Drive, AirDrop, Drucken zählen nie', () => {
    for (const k of [
      'net.whatsapp.WhatsApp.ShareExtension',
      'com.apple.DocumentManagerUICore.SaveToFiles',
      'ch.protonmail.drive.share',
      'com.apple.UIKit.activity.AirDrop',
      'com.apple.UIKit.activity.Print',
      'com.apple.UIKit.activity.Message',
    ])
      for (const weg of ['mail', 'portal', 'website'] as const)
        expect(teilenWerten(k, true, weg), `${k} ${weg}`).toBe('nichts');
    expect(teilenZiel('ch.protonmail.drive.share')).toBe('Proton Drive');
  });

  it('Portal-App beim Weg „Portal“ fragt nach; Unbekanntes nur beim Weg „Mail“', () => {
    expect(teilenWerten('de.is24.ios.share', true, 'portal')).toBe('unsicher');
    expect(teilenWerten('com.beispiel.irgendwas', true, 'mail')).toBe('unsicher');
    expect(teilenWerten('com.beispiel.irgendwas', true, 'portal')).toBe('nichts');
    expect(teilenWerten(null, true, 'mail')).toBe('unsicher');
    expect(teilenWerten(null, true, 'website')).toBe('nichts');
  });
});
