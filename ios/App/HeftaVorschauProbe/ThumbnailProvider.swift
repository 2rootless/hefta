import QuickLookThumbnailing
import UIKit
import os

// Probe zu W45 (PC158, DP97), nur auf dem Zweig probe-vision, nie in einem Bau für den Store.
// Zeichnet Designs magentafarbenes Testbild in die volle contextSize, ohne 3 : 4 zu erzwingen. Darüber steht, was iOS
// angefragt hat (maximumSize, minimumSize, scale) und ob am Kopf der Datei ein Passwort erkannt wurde. So steht das
// Protokoll auf jedem Bildschirmfoto; dazu geht jede Anfrage ins Systemprotokoll („W45-Probe“).
class ThumbnailProvider: QLThumbnailProvider {
  private let protokoll = Logger(subsystem: "de.hefta.app.vorschaubild", category: "W45-Probe")

  /// Ein Backup mit Passwort beginnt mit „HEFTABAK“ (src/storage/backup.ts), eines ohne ist ein ZIP („PK“).
  static func kopf(_ url: URL) -> String {
    guard let datei = try? FileHandle(forReadingFrom: url) else { return "Kopf nicht lesbar" }
    defer { try? datei.close() }
    let bytes = (try? datei.read(upToCount: 8)) ?? Data()
    if bytes == Data("HEFTABAK".utf8) { return "mit Passwort" }
    if bytes.starts(with: Data([0x50, 0x4B, 0x03, 0x04])) { return "ohne Passwort" }
    return "Kopf unbekannt"
  }

  override func provideThumbnail(
    for request: QLFileThumbnailRequest,
    _ handler: @escaping (QLThumbnailReply?, Error?) -> Void
  ) {
    let groesse = request.maximumSize
    let klein = request.minimumSize
    let skala = request.scale
    let kopf = Self.kopf(request.fileURL)
    let zeile1 = String(format: "%.0f×%.0f", groesse.width, groesse.height)
    let zeile2 = String(
      format: "@%.0fx min %.0f×%.0f", skala, klein.width, klein.height)
    protokoll.notice(
      "W45-Probe max \(zeile1, privacy: .public) \(zeile2, privacy: .public) \(kopf, privacy: .public)")

    let bild = UIImage(
      named: "probe-testbild-3x4", in: Bundle(for: ThumbnailProvider.self), compatibleWith: nil)
    let antwort = QLThumbnailReply(contextSize: groesse, currentContextDrawing: { () -> Bool in
      let flaeche = CGRect(origin: .zero, size: groesse)
      if let bild {
        bild.draw(in: flaeche)
      } else {
        UIColor.magenta.setFill()
        UIRectFill(flaeche)
      }
      // Die Zahlen so groß wie möglich: Auch in der Liste (etwa 44 pt) sollen sie auf dem Bildschirmfoto lesbar sein.
      let kante = min(groesse.width, groesse.height)
      let gross = UIFont.systemFont(ofSize: max(kante / 5.5, 6), weight: .bold)
      let mittel = UIFont.systemFont(ofSize: max(kante / 11, 4), weight: .semibold)
      let tinte = UIColor(red: 0.149, green: 0.133, blue: 0.118, alpha: 1)
      let mitte = NSMutableParagraphStyle()
      mitte.alignment = .center
      let text = NSMutableAttributedString(
        string: zeile1 + "\n",
        attributes: [.font: gross, .foregroundColor: tinte, .paragraphStyle: mitte])
      text.append(
        NSAttributedString(
          string: zeile2 + "\n" + kopf,
          attributes: [.font: mittel, .foregroundColor: tinte, .paragraphStyle: mitte]))
      let hoehe = text.boundingRect(
        with: CGSize(width: groesse.width, height: .greatestFiniteMagnitude),
        options: [.usesLineFragmentOrigin], context: nil
      ).height
      // Ein heller Streifen hinter dem Text, damit er auf der gestrichelten Linie lesbar bleibt.
      let streifen = CGRect(
        x: 0, y: (groesse.height - hoehe) / 2 + kante * 0.12, width: groesse.width, height: hoehe)
      UIColor(white: 1, alpha: 0.85).setFill()
      UIRectFill(streifen.insetBy(dx: 0, dy: -kante * 0.02))
      text.draw(with: streifen, options: [.usesLineFragmentOrigin], context: nil)
      return true
    })
    handler(antwort, nil)
  }
}
