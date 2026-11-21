import QuickLookThumbnailing
import UIKit

// W45 (DP102, Endfassung): das Vorschaubild einer Backup-Datei in „Dateien“ und im Teilen-Blatt.
// Eine Kachel aus Karton mit Rand, darauf das Backup-Zeichen „ein Blatt“ in Tinte; bei erkanntem Passwort dazu die
// Plakette mit dem Schloss. Nur Tinte, Karton und Rand (W5, W38), auch in der dunklen Darstellung.
// Die Maße stehen in den Vorlagen design/dp102/svg/w45-<ohne|mit>-<klein|gross|teilen>.svg; der Test
// src/app/vorschaubild.test.ts prüft, dass die Zahlen hier dieselben sind.
final class ThumbnailProvider: QLThumbnailProvider {
  // Farben aus DP102: Tinte #26221e, Karton #efe3cf, Rand #7a7166.
  static let tinte = UIColor(red: 0x26 / 255.0, green: 0x22 / 255.0, blue: 0x1e / 255.0, alpha: 1)
  static let karton = UIColor(red: 0xef / 255.0, green: 0xe3 / 255.0, blue: 0xcf / 255.0, alpha: 1)
  static let rand = UIColor(red: 0x7a / 255.0, green: 0x71 / 255.0, blue: 0x66 / 255.0, alpha: 1)

  /// Ein Backup mit Passwort beginnt mit „HEFTABAK“ (src/storage/backup.ts). Gelesen werden nur die ersten
  /// 8 Bytes, nie der Inhalt: Das Bild zeigt keine Zahl und nichts aus dem Backup (BK5, W10).
  static func mitPasswort(_ url: URL) -> Bool {
    guard let datei = try? FileHandle(forReadingFrom: url) else { return false }
    defer { try? datei.close() }
    let kopf = (try? datei.read(upToCount: 8)) ?? Data()
    return kopf == Data("HEFTABAK".utf8)
  }

  /// Lage im Quadrat 100: Blatt und Schloss im 32er-Raster, verschoben und vergrößert wie in den Vorlagen.
  struct Lage {
    let blatt: (x: CGFloat, y: CGFloat, s: CGFloat)
    let plakette: (x: CGFloat, y: CGFloat, r: CGFloat)?
    let schloss: (x: CGFloat, y: CGFloat, s: CGFloat)?
  }

  /// „klein“ für Liste und Symbole (84 × 84), „groß“ für Infos (369 × 369); das Teilen-Blatt nimmt „klein“.
  static func lage(mitPasswort: Bool, gross: Bool) -> Lage {
    if !mitPasswort {
      // w45-ohne-*: 70 breit, mittig. Ohne Passwort weder Schloss noch Plakette (BQ5).
      return Lage(blatt: (x: 15.00, y: 14.12, s: 2.1875), plakette: nil, schloss: nil)
    }
    if gross {
      // w45-mit-gross: Blatt wie ohne Passwort, Plakette kleiner und weiter in der Ecke (BQ15).
      return Lage(blatt: (x: 15.00, y: 14.12, s: 2.1875), plakette: (x: 76, y: 76, r: 15),
        schloss: (x: 65.88, y: 64.61, s: 0.6328))
    }
    // w45-mit-klein und w45-mit-teilen: Blatt 62 breit bei (44, 45), Plakette Radius 19.
    return Lage(blatt: (x: 13.00, y: 13.23, s: 1.9375), plakette: (x: 73, y: 73, r: 19),
      schloss: (x: 60.17, y: 58.57, s: 0.8016))
  }

  /// Ab dieser Kante gilt „groß“: Infos fragen 369 an, Liste und Symbole 84.
  static let grossAb: CGFloat = 200

  /// Pfad „ein Blatt“: M20.6 22.2V17.2L16 13.2l-4.6 4v10.6h11c1.7 0 3-1.3 3-3V10.4L20 5H9.5c-1.7 0-3 1.3-3 3v14.8
  static func blatt() -> UIBezierPath {
    let p = UIBezierPath()
    p.move(to: CGPoint(x: 20.6, y: 22.2))
    p.addLine(to: CGPoint(x: 20.6, y: 17.2))
    p.addLine(to: CGPoint(x: 16, y: 13.2))
    p.addLine(to: CGPoint(x: 11.4, y: 17.2))
    p.addLine(to: CGPoint(x: 11.4, y: 27.8))
    p.addLine(to: CGPoint(x: 22.4, y: 27.8))
    p.addCurve(
      to: CGPoint(x: 25.4, y: 24.8), controlPoint1: CGPoint(x: 24.1, y: 27.8),
      controlPoint2: CGPoint(x: 25.4, y: 26.5))
    p.addLine(to: CGPoint(x: 25.4, y: 10.4))
    p.addLine(to: CGPoint(x: 20, y: 5))
    p.addLine(to: CGPoint(x: 9.5, y: 5))
    p.addCurve(
      to: CGPoint(x: 6.5, y: 8), controlPoint1: CGPoint(x: 7.8, y: 5),
      controlPoint2: CGPoint(x: 6.5, y: 6.3))
    p.addLine(to: CGPoint(x: 6.5, y: 22.8))
    return p
  }

  /// Pfad „Schloss“: M6.5 15V24.6c0 3.6 3.2 5 9.5 5s9.5-1.4 9.5-5V15H20.6V11a4.6 4.6 0 0 0-9.2 0V19.2l4.6 3.4
  static func schloss() -> UIBezierPath {
    let p = UIBezierPath()
    p.move(to: CGPoint(x: 6.5, y: 15))
    p.addLine(to: CGPoint(x: 6.5, y: 24.6))
    p.addCurve(
      to: CGPoint(x: 16, y: 29.6), controlPoint1: CGPoint(x: 6.5, y: 28.2),
      controlPoint2: CGPoint(x: 9.7, y: 29.6))
    p.addCurve(
      to: CGPoint(x: 25.5, y: 24.6), controlPoint1: CGPoint(x: 22.3, y: 29.6),
      controlPoint2: CGPoint(x: 25.5, y: 28.2))
    p.addLine(to: CGPoint(x: 25.5, y: 15))
    p.addLine(to: CGPoint(x: 20.6, y: 15))
    p.addLine(to: CGPoint(x: 20.6, y: 11))
    // Der Bügel: ein Halbkreis über die Mitte (16, 11) nach links, oben herum (SVG „a4.6 4.6 0 0 0-9.2 0“).
    p.addArc(
      withCenter: CGPoint(x: 16, y: 11), radius: 4.6, startAngle: 0, endAngle: .pi, clockwise: false)
    p.addLine(to: CGPoint(x: 11.4, y: 19.2))
    p.addLine(to: CGPoint(x: 16, y: 22.6))
    return p
  }

  static func strich(_ p: UIBezierPath, farbe: UIColor) {
    p.lineWidth = 3.2
    p.lineCapStyle = .round
    p.lineJoinStyle = .round
    farbe.setStroke()
    p.stroke()
  }

  /// Zeichnet die Kachel in ein Quadrat mit der Seite min(Breite, Höhe), mittig; außerhalb bleibt alles
  /// durchsichtig (DP102, Abschnitt 2). So schneidet iOS beim Teilen (300 × 600) nichts ab (BQ11).
  static func zeichnen(in ctx: CGContext, groesse: CGSize, mitPasswort: Bool) {
    let seite = min(groesse.width, groesse.height)
    let gross = groesse.width == groesse.height && seite >= grossAb
    let l = lage(mitPasswort: mitPasswort, gross: gross)
    ctx.saveGState()
    ctx.translateBy(x: (groesse.width - seite) / 2, y: (groesse.height - seite) / 2)
    ctx.scaleBy(x: seite / 100, y: seite / 100)

    // Kachel: x=6 y=6 88 × 88, Rundung 18; Karton mit Rand 2.
    let kachel = UIBezierPath(roundedRect: CGRect(x: 6, y: 6, width: 88, height: 88), cornerRadius: 18)
    karton.setFill()
    kachel.fill()
    kachel.lineWidth = 2
    rand.setStroke()
    kachel.stroke()

    ctx.saveGState()
    ctx.translateBy(x: l.blatt.x, y: l.blatt.y)
    ctx.scaleBy(x: l.blatt.s, y: l.blatt.s)
    strich(blatt(), farbe: tinte)
    ctx.restoreGState()

    if let pl = l.plakette, let sc = l.schloss {
      let kreis = UIBezierPath(
        arcCenter: CGPoint(x: pl.x, y: pl.y), radius: pl.r, startAngle: 0, endAngle: 2 * .pi,
        clockwise: true)
      tinte.setFill()
      kreis.fill()
      kreis.lineWidth = 2.5
      karton.setStroke()
      kreis.stroke()
      ctx.saveGState()
      ctx.translateBy(x: sc.x, y: sc.y)
      ctx.scaleBy(x: sc.s, y: sc.s)
      strich(schloss(), farbe: karton)
      ctx.restoreGState()
    }
    ctx.restoreGState()
  }

  override func provideThumbnail(
    for request: QLFileThumbnailRequest,
    _ handler: @escaping (QLThumbnailReply?, Error?) -> Void
  ) {
    let groesse = request.maximumSize
    let passwort = Self.mitPasswort(request.fileURL)
    let antwort = QLThumbnailReply(contextSize: groesse, currentContextDrawing: { () -> Bool in
      guard let ctx = UIGraphicsGetCurrentContext() else { return false }
      Self.zeichnen(in: ctx, groesse: groesse, mitPasswort: passwort)
      return true
    })
    handler(antwort, nil)
  }
}
