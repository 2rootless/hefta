// W49: Größe der Mappe beim Mailen. 15,0 MB zeigt den Satz, 14,9 MB nicht; Gegenproben rot.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { MAIL_GRENZE, groesseWieDateien, mailZuGross } from './mailGroesse';

describe('W49: Größe beim Mailen', () => {
  it('1 MB = 1 000 000 Byte, wie „Dateien“ am iPhone', () => {
    expect(groesseWieDateien(640_000)).toBe('640 KB');
    expect(groesseWieDateien(8_200_000)).toBe('8,2 MB');
    expect(groesseWieDateien(1_000_000)).toBe('1,0 MB');
    // Gegenprobe: mit 1024 wären 8 200 000 Byte nur 7,8 MB.
    expect(groesseWieDateien(8_200_000)).not.toBe('7,8 MB');
  });

  it('15,0 MB zeigt den Satz, 14,9 MB nicht', () => {
    expect(MAIL_GRENZE).toBe(15_000_000);
    expect(groesseWieDateien(15_000_000)).toBe('15,0 MB');
    expect(mailZuGross(15_000_000)).toBe(true);
    expect(groesseWieDateien(14_900_000)).toBe('14,9 MB');
    expect(mailZuGross(14_900_000)).toBe(false);
  });

  it('Gegenprobe: kleine Mappe ohne Satz; nie „15,0 MB“ ohne Satz', () => {
    expect(mailZuGross(2_000_000)).toBe(false);
    expect(mailZuGross(14_999_999)).toBe(false);
    // Abgeschnitten, nicht gerundet: knapp unter der Grenze steht „14,9 MB“.
    expect(groesseWieDateien(14_999_999)).toBe('14,9 MB');
  });

  it('Satz und Knopf nach Design, als Hinweis in Grau ohne Warnzeichen (W5, W32)', () => {
    expect(t('bewerben.mailGross')).toBe('Für manche Postfächer kann das zu groß sein.');
    expect(t('bewerben.kleinerMachen')).toBe('Kleiner machen ›');
    const seite = readFileSync('src/screens/BewerbenSeite.svelte', 'utf-8');
    const block = seite.slice(seite.indexOf('<!-- W49'), seite.indexOf("t('bewerben.mappeBaut')"));
    expect(block).toContain('class="hinweis mailgross"');
    expect(block.replace(/<!--[^]*?-->/g, '')).not.toMatch(/warnzeichen|Warnzeichen|fehler/);
    // Nur im Schritt „per Mail“.
    expect(seite).toContain(
      "{#if weg === 'mail' && mappe && !mappeBaut && mailZuGross(mappe.groesse)}",
    );
  });
});
