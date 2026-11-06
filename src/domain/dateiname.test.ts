import { describe, expect, it } from 'vitest';
import { monatAusDateiname, namensteil, selbstauskunftDateiname } from './dateiname';

describe('Dateinamen', () => {
  it('schreibt Umlaute aus und lässt nur Buchstaben, Ziffern und Bindestrich', () => {
    expect(namensteil('Müßig-Öztürk')).toBe('Muessig-Oeztuerk');
    expect(namensteil('von Hohenstein')).toBe('von-Hohenstein');
    expect(namensteil('José')).toBe('Jose');
  });

  it('Selbstauskunft mit Nachname und Vorname', () => {
    expect(selbstauskunftDateiname({ vorname: 'Lea', nachname: 'Mustermann' })).toBe(
      'Selbstauskunft_Mustermann_Lea.pdf',
    );
  });
});

describe('Namen aus anderen Sprachen', () => {
  it('verlieren keine Buchstaben', () => {
    expect(namensteil('Łukasz Głowacki')).toBe('Lukasz-Glowacki');
    expect(namensteil('Đặng Thị')).toBe('Dang-Thi');
    expect(namensteil('Søren Brønsted')).toBe('Soren-Bronsted');
    expect(namensteil('Wiśniewski')).toBe('Wisniewski');
    expect(namensteil('Çağlar Yıldız')).toBe('Caglar-Yildiz');
  });
});

describe('monatAusDateiname', () => {
  const heute = new Date(2026, 10, 6);
  it('erkennt Jahr und Monat in Ziffern', () => {
    expect(monatAusDateiname('Gehalt_2026-09.pdf', heute)).toBe('2026-09');
    expect(monatAusDateiname('Abrechnung 09.2026.pdf', heute)).toBe('2026-09');
    expect(monatAusDateiname('lohn_202608.pdf', heute)).toBe('2026-08');
    expect(monatAusDateiname('scan_20260715.pdf', heute)).toBe('2026-07');
  });
  it('erkennt Monatsnamen, ohne Jahr den letzten solchen Monat', () => {
    expect(monatAusDateiname('Verdienstabrechnung September.pdf', heute)).toBe('2026-09');
    expect(monatAusDateiname('Gehalt Dezember.pdf', heute)).toBe('2025-12');
    expect(monatAusDateiname('Lohn_Okt_2026.pdf', heute)).toBe('2026-10');
    expect(monatAusDateiname('Payslip March 25.pdf', heute)).toBe('2025-03');
  });
  it('rät nicht', () => {
    expect(monatAusDateiname('IMG_2041.pdf', heute)).toBeNull();
    expect(monatAusDateiname('Dokument.pdf', heute)).toBeNull();
    expect(monatAusDateiname('Gehalt Martin Maier.pdf', heute)).toBeNull();
    expect(monatAusDateiname('Juni-Abrechnung-Mustermann.pdf', heute)).toBe('2026-06');
  });
});
