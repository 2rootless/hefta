import { describe, expect, it } from 'vitest';
import { jpegHatMetadaten, jpegMetadatenEntfernen, jpegMitTestExif } from './jpegMetadaten';

/** Kleinstes JPEG-Gerüst: SOI, APP0, DQT, SOS mit Datenbytes, EOI. Für die Segment-Logik genügt das. */
function gerüst(extra: number[][] = []): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const dqt = [0xff, 0xdb, 0x00, 0x04, 0x00, 0x01];
  const sos = [0xff, 0xda, 0x00, 0x04, 0x01, 0x00, 0x12, 0x34, 0xff, 0x00, 0x56];
  return new Uint8Array([0xff, 0xd8, ...app0, ...extra.flat(), ...dqt, ...sos, 0xff, 0xd9]);
}

function text(t: string): number[] {
  return [...new TextEncoder().encode(t)];
}

function segment(marker: number, inhalt: number[]): number[] {
  const laenge = inhalt.length + 2;
  return [0xff, marker, laenge >> 8, laenge & 0xff, ...inhalt];
}

describe('JPEG-Metadaten', () => {
  it('erkennt und entfernt EXIF mit GPS', () => {
    const mitExif = jpegMitTestExif(gerüst(), 6);
    expect(jpegHatMetadaten(mitExif)).toBe(true);
    const sauber = jpegMetadatenEntfernen(mitExif);
    expect(jpegHatMetadaten(sauber)).toBe(false);
    expect(sauber).toEqual(gerüst());
  });

  it('entfernt XMP, IPTC und Kommentare, behält ICC-Profil und Adobe-Segment', () => {
    const icc = segment(0xe2, text('ICC_PROFILE\0abc'));
    const adobe = segment(0xee, text('Adobe-xyz'));
    const datei = gerüst([
      segment(0xe1, text('http://ns.adobe.com/xap/1.0/\0<gps/>')),
      segment(0xed, text('Photoshop 3.0\0')),
      segment(0xfe, text('Aufgenommen in Hamburg')),
      icc,
      adobe,
    ]);
    expect(jpegHatMetadaten(datei)).toBe(true);
    const sauber = jpegMetadatenEntfernen(datei);
    expect(jpegHatMetadaten(sauber)).toBe(false);
    expect(sauber).toEqual(gerüst([icc, adobe]));
    expect(new TextDecoder().decode(sauber)).not.toContain('Hamburg');
  });

  it('lässt die Bilddaten nach dem Scan unverändert', () => {
    const datei = gerüst();
    expect(jpegMetadatenEntfernen(datei)).toEqual(datei);
  });

  it('lehnt Nicht-JPEG-Dateien ab', () => {
    expect(() => jpegMetadatenEntfernen(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toThrow();
  });
});
