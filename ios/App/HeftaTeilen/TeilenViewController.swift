import UIKit
import UniformTypeIdentifiers

/// Teilen an Hefta (E81, B23 `quelle=teilen`): Wer in einer Portal-App oder in Safari auf „Teilen“ und dann
/// auf Hefta tippt, landet direkt in der Vorschau von Hefta. Die Erweiterung liest nur, was die App übergibt
/// (Adresse oder Text), sucht darin den ersten Link (E75: WG-Gesucht teilt Titel mit Link) und öffnet Hefta
/// mit `hefta://teilen?link=…`. Sie lädt nichts, speichert nichts und schickt nichts weg; gelesen wird das
/// Inserat erst in der App, genau einmal (E72).
final class TeilenViewController: UIViewController {
    private let satz = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        satz.font = .preferredFont(forTextStyle: .body)
        satz.adjustsFontForContentSizeCategory = true
        satz.numberOfLines = 0
        satz.textAlignment = .center
        let fertig = UIButton(type: .system)
        fertig.setTitle("Fertig", for: .normal)
        fertig.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        fertig.addTarget(self, action: #selector(fertigGetippt), for: .touchUpInside)
        let stapel = UIStackView(arrangedSubviews: [satz, fertig])
        stapel.axis = .vertical
        stapel.spacing = 16
        stapel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stapel)
        let rand = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            stapel.centerYAnchor.constraint(equalTo: rand.centerYAnchor),
            stapel.leadingAnchor.constraint(equalTo: rand.leadingAnchor, constant: 24),
            stapel.trailingAnchor.constraint(equalTo: rand.trailingAnchor, constant: -24),
            fertig.heightAnchor.constraint(greaterThanOrEqualToConstant: 44)
        ])
        stapel.isHidden = true
        linkSuchen { [weak self] link in
            guard let self else { return }
            if let link, self.heftaOeffnen(link) {
                self.extensionContext?.completeRequest(returningItems: nil)
            } else {
                // Kein Link oder Hefta ließ sich nicht öffnen: ein Satz statt eines stillen Abbruchs.
                self.satz.text = link == nil
                    ? "Hefta hat darin keinen Link gefunden."
                    : "Hefta ließ sich nicht öffnen. Kopier den Link und setz ihn in Hefta ein."
                stapel.isHidden = false
            }
        }
    }

    /// Erst eine Adresse, sonst der erste Link im geteilten Text.
    private func linkSuchen(_ fertig: @escaping (URL?) -> Void) {
        let elemente = extensionContext?.inputItems as? [NSExtensionItem] ?? []
        let anbieter = elemente.flatMap { $0.attachments ?? [] }
        let texte = elemente.compactMap { $0.attributedContentText?.string }
        let gruppe = DispatchGroup()
        var adresse: URL?
        var gelesen: [String] = texte
        for a in anbieter {
            if a.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                gruppe.enter()
                _ = a.loadObject(ofClass: URL.self) { url, _ in
                    DispatchQueue.main.async {
                        if adresse == nil, let url, url.scheme == "https" || url.scheme == "http" { adresse = url }
                        gruppe.leave()
                    }
                }
            } else if a.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                gruppe.enter()
                _ = a.loadObject(ofClass: String.self) { text, _ in
                    DispatchQueue.main.async {
                        if let text { gelesen.append(text) }
                        gruppe.leave()
                    }
                }
            }
        }
        gruppe.notify(queue: .main) {
            fertig(adresse ?? gelesen.lazy.compactMap(TeilenViewController.ersterLink).first)
        }
    }

    static func ersterLink(_ text: String) -> URL? {
        guard let fund = text.range(of: #"https?://[^\s<>"']+"#, options: .regularExpression) else { return nil }
        var link = String(text[fund])
        while let letztes = link.last, ").,;:!?»“”".contains(letztes) { link.removeLast() }
        return URL(string: link)
    }

    /// Öffnet Hefta über den Weg der App selbst (Responder-Kette bis zur UIApplication).
    private func heftaOeffnen(_ link: URL) -> Bool {
        var teile = URLComponents()
        teile.scheme = "hefta"
        teile.host = "teilen"
        teile.queryItems = [URLQueryItem(name: "link", value: link.absoluteString)]
        guard let ziel = teile.url else { return false }
        // In Erweiterungen ist `UIApplication.open` gesperrt (APPLICATION_EXTENSION_API_ONLY). Die App erreicht
        // man über die Responder-Kette und ruft `openURL:options:completionHandler:` über die Laufzeit auf;
        // das ältere `openURL:` tut seit iOS 18 nichts mehr.
        let auswahl = NSSelectorFromString("openURL:options:completionHandler:")
        typealias Oeffnen = @convention(c) (AnyObject, Selector, NSURL, NSDictionary, AnyObject?) -> Void
        var glied: UIResponder? = self
        while let jetzt = glied {
            if jetzt is UIApplication, let methode = class_getInstanceMethod(type(of: jetzt), auswahl) {
                let oeffnen = unsafeBitCast(method_getImplementation(methode), to: Oeffnen.self)
                oeffnen(jetzt, auswahl, ziel as NSURL, NSDictionary(), nil)
                return true
            }
            glied = jetzt.next
        }
        return false
    }

    @objc private func fertigGetippt() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
