// Kubische Kurve für den Pfad im Band der Personenansicht (Entwurf 3-person.png).

export type Punkt = [number, number];
export type Kurve = [Punkt, Punkt, Punkt, Punkt];

export function punktAuf(k: Kurve, t: number): Punkt {
  const u = 1 - t;
  const [a, b, c, d] = k;
  return [
    u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0],
    u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1],
  ];
}

export function pfadD(k: Kurve): string {
  const z = (p: Punkt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  return `M${z(k[0])} C${z(k[1])}, ${z(k[2])}, ${z(k[3])}`;
}
