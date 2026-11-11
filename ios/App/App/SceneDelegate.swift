import UIKit
import Capacitor
import SafariServices
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let probe = URLContexts.first(where: { $0.url.scheme == "heftaprobe" }) {
            if probe.url.host == "fenster" { fensterZeigen(probe.url) } else { imBrowserZeigen(probe.url) }
            return
        }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    /// Teilen-Probe (E62, Frage aus B20 Fassung 2): öffnet eine Seite in Safari in Hefta
    /// (SFSafariViewController). Dort zeigt sich, ob das Teilen-Menü Hefta selbst anbietet und ob die
    /// Probe den Text der Seite bekommt. Das Schema `heftaprobe` gibt es nur in Testbauten mit Probe;
    /// im Bau für den Store fehlt es in der Info.plist, dann kommt dieser Weg nie an.
    /// Aufruf: heftaprobe://browser?url=https%3A%2F%2F… ; ohne Adresse die Startseite von ImmoScout24.
    private func imBrowserZeigen(_ aufruf: URL) {
        let teile = URLComponents(url: aufruf, resolvingAgainstBaseURL: false)
        let angegeben = teile?.queryItems?.first(where: { $0.name == "url" })?.value
        guard let ziel = URL(string: angegeben ?? "https://www.immobilienscout24.de/"),
              ziel.scheme == "https",
              let oben = window?.rootViewController else { return }
        var sicht = oben
        while let darueber = sicht.presentedViewController { sicht = darueber }
        sicht.present(SFSafariViewController(url: ziel), animated: true)
    }

    /// Teilen-Probe, Prüfauftrag E68: das eigene Fenster (`heftaprobe://fenster`, mit `?url=…` direkt).
    private func fensterZeigen(_ aufruf: URL) {
        let teile = URLComponents(url: aufruf, resolvingAgainstBaseURL: false)
        let angegeben = teile?.queryItems?.first(where: { $0.name == "url" })?.value
        guard let oben = window?.rootViewController else { return }
        var sicht = oben
        while let darueber = sicht.presentedViewController { sicht = darueber }
        let fenster = ProbeFenster(start: angegeben.flatMap { URL(string: $0) })
        fenster.modalPresentationStyle = .pageSheet
        if let blatt = fenster.sheetPresentationController {
            blatt.detents = [.large()]
            blatt.prefersGrabberVisible = true
        }
        sicht.present(fenster, animated: true)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// Teilen-Probe, Prüfauftrag E68: Hefta öffnet eine Seite in einem eigenen Fenster (WKWebView) als Blatt.
/// Regeln wie im Konzept: eigener, nicht dauerhafter Speicher; keine Brücke von der Seite zu Hefta (kein
/// Message-Handler, kein eingefügtes Skript); Hefta lädt nichts im Hintergrund und folgt keinem Link von
/// selbst. Gelesen wird nur die offene Seite und nur nach dem Tipp auf „An Hefta“, in einer eigenen
/// Skriptwelt, die die Skripte der Seite nicht sehen. Das Ergebnis bleibt im Protokoll auf dem Gerät.
final class ProbeFenster: UIViewController, WKNavigationDelegate, UITextFieldDelegate {
    private let start: URL?
    private let adresse = UITextField()
    private let art = UISegmentedControl(items: ["Fenster", "wie Safari"])
    private let stand = UILabel()
    private var web: WKWebView!
    private var verlauf: [String] = []

    init(start: URL?) {
        self.start = start
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { nil }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        adresse.placeholder = "Link einfügen oder Adresse"
        adresse.borderStyle = .roundedRect
        adresse.keyboardType = .URL
        adresse.autocapitalizationType = .none
        adresse.autocorrectionType = .no
        adresse.clearButtonMode = .whileEditing
        adresse.returnKeyType = .go
        adresse.delegate = self
        art.selectedSegmentIndex = 0
        art.addTarget(self, action: #selector(artGewechselt), for: .valueChanged)
        stand.font = .preferredFont(forTextStyle: .footnote)
        stand.textColor = .secondaryLabel
        stand.numberOfLines = 2
        stand.text = "Eigenes Fenster · nichts wird gespeichert"

        let fertig = UIButton(type: .system)
        fertig.setTitle("Fertig", for: .normal)
        fertig.addTarget(self, action: #selector(fertigGetippt), for: .touchUpInside)
        let anHefta = UIButton(type: .system)
        anHefta.setTitle("An Hefta", for: .normal)
        anHefta.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        anHefta.backgroundColor = .label
        anHefta.setTitleColor(.systemBackground, for: .normal)
        anHefta.layer.cornerRadius = 22
        anHefta.addTarget(self, action: #selector(anHeftaGetippt), for: .touchUpInside)

        web = neuesWeb()
        let kopf = UIStackView(arrangedSubviews: [adresse, fertig])
        kopf.spacing = 8
        let stapel = UIStackView(arrangedSubviews: [kopf, art, web, stand, anHefta])
        stapel.axis = .vertical
        stapel.spacing = 8
        stapel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stapel)
        let rand = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            stapel.topAnchor.constraint(equalTo: rand.topAnchor, constant: 16),
            stapel.leadingAnchor.constraint(equalTo: rand.leadingAnchor, constant: 12),
            stapel.trailingAnchor.constraint(equalTo: rand.trailingAnchor, constant: -12),
            stapel.bottomAnchor.constraint(equalTo: rand.bottomAnchor, constant: -8),
            anHefta.heightAnchor.constraint(equalToConstant: 48),
            adresse.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
        ])
        if let start { laden(start) }
    }

    private func neuesWeb() -> WKWebView {
        let einstellung = WKWebViewConfiguration()
        einstellung.websiteDataStore = .nonPersistent()
        if art.selectedSegmentIndex == 1 {
            // Wie Safari ausgeben: Manche Portale zeigen eingebetteten Browsern eine schlechtere Ansicht.
            einstellung.applicationNameForUserAgent = "Version/18.0 Mobile/15E148 Safari/604.1"
        }
        let w = WKWebView(frame: .zero, configuration: einstellung)
        w.navigationDelegate = self
        w.allowsBackForwardNavigationGestures = true
        return w
    }

    private func laden(_ ziel: URL) {
        guard ziel.scheme == "https" else {
            stand.text = "Nur https-Adressen."
            return
        }
        adresse.text = ziel.absoluteString
        web.load(URLRequest(url: ziel))
    }

    func textFieldShouldReturn(_ feld: UITextField) -> Bool {
        feld.resignFirstResponder()
        var text = (feld.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        // Aus einem geteilten Text den ersten Link nehmen.
        if let fund = text.range(of: "https://[^\\s]+", options: .regularExpression) { text = String(text[fund]) }
        else if !text.isEmpty && !text.hasPrefix("http") { text = "https://" + text }
        if let ziel = URL(string: text) { laden(ziel) }
        return true
    }

    @objc private func artGewechselt() {
        let alt = web.url
        let stapel = web.superview as? UIStackView
        let platz = stapel?.arrangedSubviews.firstIndex(of: web) ?? 2
        web.removeFromSuperview()
        web = neuesWeb()
        stapel?.insertArrangedSubview(web, at: platz)
        if let alt { laden(alt) }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let ziel = webView.url?.absoluteString ?? ""
        verlauf.append(ziel)
        adresse.text = ziel
        stand.text = "Geladen: \(webView.title ?? "")"
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        stand.text = "Fehler: \(error.localizedDescription)"
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        stand.text = "Fehler: \(error.localizedDescription)"
    }

    @objc private func fertigGetippt() { dismiss(animated: true) }

    /// Liest erst jetzt die offene Seite: Adresse, Titel, sichtbarer Text, Lage als Zahlen (wie die
    /// Vorverarbeitung beim Teilen aus Safari). In der Skriptwelt `.defaultClient`, getrennt von der Seite.
    @objc private func anHeftaGetippt() {
        let lesen = """
        const funde = [];
        const merke = (quelle, lat, lon) => { const a = parseFloat(lat), o = parseFloat(lon);
          if (isNaN(a) || isNaN(o) || a < 47 || a > 55.2 || o < 5.5 || o > 15.5) return;
          if (funde.length < 20) funde.push({ quelle, lat: a, lon: o }); };
        const geo = (x, t) => { if (!x || typeof x !== 'object' || t > 8) return;
          if (x.latitude !== undefined && x.longitude !== undefined) merke('json-ld', x.latitude, x.longitude);
          for (const k in x) geo(x[k], t + 1); };
        for (const s of document.querySelectorAll('script[type="application/ld+json"]')) { try { geo(JSON.parse(s.textContent), 0); } catch (e) {} }
        const meta = (n) => document.querySelector('meta[property="' + n + '"],meta[name="' + n + '"]')?.getAttribute('content');
        merke('meta-place', meta('place:location:latitude'), meta('place:location:longitude'));
        merke('meta-og', meta('og:latitude'), meta('og:longitude'));
        for (const el of [...document.querySelectorAll('[data-lat],[data-latitude]')].slice(0, 20))
          merke('data-attribut', el.getAttribute('data-lat') || el.getAttribute('data-latitude'), el.getAttribute('data-lng') || el.getAttribute('data-lon') || el.getAttribute('data-longitude'));
        const muster = /["']?(lat|latitude)["']?\\s*[:=]\\s*["']?(-?\\d{1,2}\\.\\d{3,})["']?[^{}]{0,80}?["']?(lng|lon|long|longitude)["']?\\s*[:=]\\s*["']?(-?\\d{1,3}\\.\\d{3,})/g;
        for (const s of document.querySelectorAll('script:not([src])')) { const t = s.textContent || ''; if (t.length > 2000000) continue; let m; muster.lastIndex = 0;
          while ((m = muster.exec(t)) !== null && funde.length < 20) merke('skript', m[2], m[4]); }
        return { url: document.URL, titel: document.title, sprache: document.documentElement.lang || '',
          text: document.body ? document.body.innerText : '', orte: funde,
          browser: navigator.userAgent, cookies: document.cookie.length };
        """
        web.callAsyncJavaScript(lesen, arguments: [:], in: nil, in: .defaultClient) { [weak self] ergebnis in
            guard let self else { return }
            var alles: [String: Any] = [
                "probe": "Hefta Teilen-Probe 2 · eigenes Fenster (E68)",
                "zeit": ISO8601DateFormatter().string(from: Date()),
                "ios": UIDevice.current.systemVersion,
                "art": self.art.selectedSegmentIndex == 1 ? "wie Safari" : "Fenster",
                "verlauf": self.verlauf,
            ]
            switch ergebnis {
            case .success(let wert): alles["seite"] = wert
            case .failure(let fehler): alles["fehler"] = fehler.localizedDescription
            }
            let daten = (try? JSONSerialization.data(withJSONObject: alles, options: [.prettyPrinted, .sortedKeys])) ?? Data()
            self.present(ProbeProtokoll(text: String(data: daten, encoding: .utf8) ?? "{}"), animated: true)
        }
    }
}

/// Zeigt das Protokoll des Fensters zum Kopieren. Nichts wird gespeichert oder verschickt.
final class ProbeProtokoll: UIViewController {
    private let text: String
    init(text: String) {
        self.text = text
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { nil }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let ansicht = UITextView()
        ansicht.isEditable = false
        ansicht.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        ansicht.text = text
        let kopieren = UIButton(type: .system)
        kopieren.setTitle("Kopieren", for: .normal)
        kopieren.addTarget(self, action: #selector(kopierenGetippt), for: .touchUpInside)
        let stapel = UIStackView(arrangedSubviews: [kopieren, ansicht])
        stapel.axis = .vertical
        stapel.spacing = 8
        stapel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stapel)
        let rand = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            stapel.topAnchor.constraint(equalTo: rand.topAnchor, constant: 16),
            stapel.leadingAnchor.constraint(equalTo: rand.leadingAnchor, constant: 12),
            stapel.trailingAnchor.constraint(equalTo: rand.trailingAnchor, constant: -12),
            stapel.bottomAnchor.constraint(equalTo: rand.bottomAnchor, constant: -8),
            kopieren.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    @objc private func kopierenGetippt() {
        UIPasteboard.general.string = text
    }
}
