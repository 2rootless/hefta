import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Handbuch, Abschnitt 5: Swift hat die Werte der Bewegung als Konstanten, die dieser Test gegen
// design/tokens.css prüft (3.22 Einsetzen-Knopf von iOS: `kurz` mit `weich`).
describe('Bewegung in Swift = Tokens', () => {
  const swift = readFileSync('ios/App/App/HeftaNativPlugin.swift', 'utf8');
  const tokens = readFileSync('design/tokens.css', 'utf8');
  const token = (n: string) => new RegExp(`--bw-${n}: ([^;]+);`).exec(tokens)?.[1]?.trim();

  it('kurz: dieselbe Dauer', () => {
    const ms = parseFloat(token('kurz')!);
    const s = Number(/static let bwKurz: TimeInterval = ([\d.]+)/.exec(swift)?.[1]);
    expect(s * 1000).toBe(ms);
  });

  it('weich: dieselbe Kurve (ease-out = cubic-bezier(0, 0, 0.58, 1))', () => {
    expect(token('weich')).toBe('ease-out');
    expect(swift).toMatch(/bwWeich1 = CGPoint\(x: 0, y: 0\)/);
    expect(swift).toMatch(/bwWeich2 = CGPoint\(x: 0\.58, y: 1\)/);
  });

  it('keine Dauer mehr als Zahl im Aufruf', () => {
    expect(swift).not.toMatch(/UIView\.animate\(withDuration: 0\.\d+/);
  });
});
