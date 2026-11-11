import PDFKit
import UIKit
import UniformTypeIdentifiers
import Vision

/// Teilen-Probe (Aufgabe 60, Realprobe): Hefta erscheint im Teilen-Menü und schreibt mit, was eine App
/// beim Teilen übergibt: jedes Element, jeden Anhang, jede Art, in der ein Anhang vorliegt, und deren Inhalt.
/// Bei PDFs liest sie den Text, bei Bildern erkennt sie Text auf dem Gerät, aus Safari holt sie den Text der
/// Seite. Nichts wird gespeichert oder verschickt: Das Protokoll verlässt die Probe nur, wenn man es kopiert
/// oder als Datei sichert. An die App gibt die Probe nichts weiter.
final class ProbeViewController: UIViewController {
    private let textAnsicht = UITextView()
    private let hinweis = UILabel()
    private let sammler = Sammler()
    private var protokoll = ""

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        aufbauen()
        einsammeln()
    }

    // MARK: Ansicht

    private func aufbauen() {
        let titel = UILabel()
        titel.text = "Hefta · Teilen-Probe"
        titel.font = .preferredFont(forTextStyle: .headline)
        hinweis.text = "Liest, was die App übergibt …"
        hinweis.font = .preferredFont(forTextStyle: .subheadline)
        hinweis.textColor = .secondaryLabel
        hinweis.numberOfLines = 0

        let knoepfe = UIStackView(arrangedSubviews: [
            knopf("Kopieren", #selector(kopierenGetippt)),
            knopf("Als Datei", #selector(sichernGetippt)),
            knopf("Fertig", #selector(fertigGetippt)),
        ])
        knoepfe.axis = .horizontal
        knoepfe.distribution = .fillEqually
        knoepfe.spacing = 8

        textAnsicht.isEditable = false
        textAnsicht.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        textAnsicht.backgroundColor = .secondarySystemBackground
        textAnsicht.layer.cornerRadius = 8

        let stapel = UIStackView(arrangedSubviews: [titel, hinweis, knoepfe, textAnsicht])
        stapel.axis = .vertical
        stapel.spacing = 10
        stapel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stapel)
        let rand = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            stapel.topAnchor.constraint(equalTo: rand.topAnchor, constant: 16),
            stapel.leadingAnchor.constraint(equalTo: rand.leadingAnchor, constant: 16),
            stapel.trailingAnchor.constraint(equalTo: rand.trailingAnchor, constant: -16),
            stapel.bottomAnchor.constraint(equalTo: rand.bottomAnchor, constant: -16),
            knoepfe.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
        ])
    }

    private func knopf(_ titel: String, _ aktion: Selector) -> UIButton {
        let k = UIButton(type: .system)
        k.setTitle(titel, for: .normal)
        k.titleLabel?.font = .preferredFont(forTextStyle: .body)
        k.titleLabel?.adjustsFontSizeToFitWidth = true
        k.backgroundColor = .tertiarySystemFill
        k.layer.cornerRadius = 10
        k.addTarget(self, action: aktion, for: .touchUpInside)
        return k
    }

    // MARK: Einsammeln

    private func einsammeln() {
        let elemente = extensionContext?.inputItems as? [NSExtensionItem] ?? []
        let gruppe = DispatchGroup()
        let kopf: [String: Any] = [
            "probe": "Hefta Teilen-Probe 2",
            "zeit": ISO8601DateFormatter().string(from: Date()),
            "ios": UIDevice.current.systemVersion,
            "elemente": elemente.count,
        ]
        for (i, element) in elemente.enumerated() {
            var angaben: [String: Any] = ["anhaenge": element.attachments?.count ?? 0]
            if let t = element.attributedTitle?.string { angaben["titel"] = t }
            if let t = element.attributedContentText?.string { angaben["inhalt"] = t }
            if let info = element.userInfo {
                angaben["userInfoSchluessel"] = info.keys.map { String(describing: $0) }.sorted()
            }
            sammler.setzen("e\(i)", angaben)
            for (j, anbieter) in (element.attachments ?? []).enumerated() {
                let typen = anbieter.registeredTypeIdentifiers
                sammler.setzen("e\(i).a\(j).typen", typen)
                if let name = anbieter.suggestedName { sammler.setzen("e\(i).a\(j).name", name) }
                for typ in typen {
                    gruppe.enter()
                    let sammler = self.sammler
                    anbieter.loadItem(forTypeIdentifier: typ, options: nil) { wert, fehler in
                        sammler.setzen("e\(i).a\(j).\(typ)", Beschreiber.beschreiben(wert, fehler: fehler))
                        gruppe.leave()
                    }
                }
            }
        }
        gruppe.notify(queue: .main) { [weak self] in
            self?.zeigen(kopf)
        }
    }

    private func zeigen(_ kopf: [String: Any]) {
        var alles = kopf
        alles["inhalt"] = sammler.alle()
        let daten =
            (try? JSONSerialization.data(withJSONObject: alles, options: [.prettyPrinted, .sortedKeys]))
            ?? Data()
        protokoll = String(data: daten, encoding: .utf8) ?? "{}"
        textAnsicht.text = protokoll
        hinweis.text =
            "Fertig gelesen. Kopiere das Protokoll und füge es im Chat ein, oder sichere es als Datei. Schreib dazu, aus welcher App du geteilt hast."
    }

    // MARK: Knöpfe

    @objc private func kopierenGetippt() {
        UIPasteboard.general.string = protokoll
        hinweis.text = "Kopiert. Füge es im Chat ein und schreib dazu, aus welcher App."
    }

    @objc private func sichernGetippt() {
        let name = "hefta-probe-\(Int(Date().timeIntervalSince1970)).json"
        let ziel = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        do {
            try protokoll.write(to: ziel, atomically: true, encoding: .utf8)
        } catch {
            hinweis.text = "Sichern ging nicht: \(error.localizedDescription)"
            return
        }
        let dialog = UIDocumentPickerViewController(forExporting: [ziel], asCopy: true)
        present(dialog, animated: true)
    }

    @objc private func fertigGetippt() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}

/// Sammelt die Ergebnisse der Anhänge, die in beliebiger Reihenfolge und auf beliebigen Threads ankommen.
final class Sammler {
    private var werte: [String: Any] = [:]
    private let schloss = NSLock()

    func setzen(_ schluessel: String, _ wert: Any) {
        schloss.lock()
        werte[schluessel] = wert
        schloss.unlock()
    }

    func alle() -> [String: Any] {
        schloss.lock()
        defer { schloss.unlock() }
        return werte
    }
}

/// Macht aus dem, was iOS übergibt, eine lesbare Beschreibung, nur aus Text und Zahlen (für JSON).
enum Beschreiber {
    static let grenze = 40_000

    static func beschreiben(_ wert: NSSecureCoding?, fehler: Error?) -> [String: Any] {
        if let fehler = fehler { return ["fehler": fehler.localizedDescription] }
        guard let wert = wert else { return ["leer": true] }
        if let url = wert as? URL { return url.isFileURL ? datei(url) : ["link": url.absoluteString] }
        if let text = wert as? String { return ["text": kuerzen(text), "zeichen": text.count] }
        if let text = wert as? NSAttributedString {
            return ["text": kuerzen(text.string), "zeichen": text.length]
        }
        if let bild = wert as? UIImage { return bildBeschreiben(bild) }
        if let daten = wert as? Data { return datenBeschreiben(daten) }
        if let woerterbuch = wert as? NSDictionary {
            if let seite = woerterbuch[NSExtensionJavaScriptPreprocessingResultsKey] as? [String: Any] {
                var aus: [String: Any] = [:]
                for (k, v) in seite { aus[k] = kuerzen((v as? String) ?? String(describing: v)) }
                return ["safariSeite": aus]
            }
            return ["woerterbuch": kuerzen(woerterbuch.description)]
        }
        return [
            "art": String(describing: type(of: wert)),
            "beschreibung": kuerzen(String(describing: wert)),
        ]
    }

    static func datei(_ url: URL) -> [String: Any] {
        let zugriff = url.startAccessingSecurityScopedResource()
        defer { if zugriff { url.stopAccessingSecurityScopedResource() } }
        var aus: [String: Any] = ["datei": url.lastPathComponent]
        aus["bytes"] = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        let endung = url.pathExtension.lowercased()
        if endung == "pdf", let pdf = PDFDocument(url: url) {
            aus.merge(pdfBeschreiben(pdf)) { a, _ in a }
        } else if ["png", "jpg", "jpeg", "heic", "gif", "webp", "tif", "tiff"].contains(endung),
            let bild = UIImage(contentsOfFile: url.path)
        {
            aus.merge(bildBeschreiben(bild)) { a, _ in a }
        } else if ["txt", "html", "htm", "json", "csv", "vcf", "eml"].contains(endung),
            let text = try? String(contentsOf: url, encoding: .utf8)
        {
            aus["text"] = kuerzen(text)
        }
        return aus
    }

    static func pdfBeschreiben(_ pdf: PDFDocument) -> [String: Any] {
        let text = pdf.string ?? ""
        return ["pdfSeiten": pdf.pageCount, "pdfText": kuerzen(text), "pdfTextZeichen": text.count]
    }

    /// Texterkennung auf dem Gerät (Vision), Deutsch und Englisch.
    static func bildBeschreiben(_ bild: UIImage) -> [String: Any] {
        var aus: [String: Any] = [
            "bildBreite": Int(bild.size.width * bild.scale),
            "bildHoehe": Int(bild.size.height * bild.scale),
        ]
        if let cg = bild.cgImage {
            let anfrage = VNRecognizeTextRequest()
            anfrage.recognitionLevel = .accurate
            anfrage.usesLanguageCorrection = true
            anfrage.recognitionLanguages = ["de-DE", "en-US"]
            try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([anfrage])
            let zeilen = (anfrage.results ?? []).compactMap { $0.topCandidates(1).first?.string }
            aus["texterkennung"] = kuerzen(zeilen.joined(separator: "\n"))
        }
        return aus
    }

    static func datenBeschreiben(_ daten: Data) -> [String: Any] {
        var aus: [String: Any] = ["bytes": daten.count]
        if let pdf = PDFDocument(data: daten) {
            aus.merge(pdfBeschreiben(pdf)) { a, _ in a }
        } else if let bild = UIImage(data: daten) {
            aus.merge(bildBeschreiben(bild)) { a, _ in a }
        } else if let text = String(data: daten, encoding: .utf8) {
            aus["text"] = kuerzen(text)
        }
        return aus
    }

    static func kuerzen(_ text: String) -> String {
        text.count > grenze ? String(text.prefix(grenze)) + " …[gekürzt]" : text
    }
}
