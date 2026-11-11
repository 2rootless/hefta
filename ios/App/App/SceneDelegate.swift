import UIKit
import Capacitor
import SafariServices
import WebKit
import Network
import UniformTypeIdentifiers

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
            switch probe.url.host {
            case "fenster": fensterZeigen(probe.url)
            case "vorschau": vorschauZeigen()
            default: imBrowserZeigen(probe.url)
            }
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

    /// Probe 3 (E73): unsichtbare Vorschau mit Messung (`heftaprobe://vorschau`).
    private func vorschauZeigen() {
        guard let oben = window?.rootViewController else { return }
        var sicht = oben
        while let darueber = sicht.presentedViewController { sicht = darueber }
        let blatt = ProbeVorschau()
        blatt.modalPresentationStyle = .pageSheet
        if let b = blatt.sheetPresentationController {
            b.detents = [.large()]
            b.prefersGrabberVisible = true
        }
        sicht.present(blatt, animated: true)
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

/// Probe 3 (E73): Hefta lädt eine eingefügte Seite unsichtbar, genau einmal, mit den Regeln des Fensters
/// (nicht dauerhafter Speicher, keine Brücke, Lesen in der Skriptwelt `.defaultClient`). Gemessen werden
/// Ladezeiten, Vorschau-Angaben, das erste große Bild und Cookie-Banner. Dazu prüft die Probe das stille
/// Erkennen eines Links (`detectPatterns`) und den Einfügen-Knopf von iOS (`UIPasteControl`).
/// Alles bleibt im Speicher, bis das Blatt geschlossen wird; nichts wird verschickt.
final class ProbeVorschau: UIViewController, WKNavigationDelegate, UITextFieldDelegate {
    private let adresse = UITextField()
    private let erkannt = UILabel()
    private let stand = UILabel()
    private let bild = UIImageView()
    private var web: WKWebView?
    private var laeufe: [[String: Any]] = []
    private var lauf: [String: Any] = [:]
    private var stillErkannt: String?
    private var beginn = Date()
    private var abfrage: Timer?
    private var grenze: Timer?
    private var abgeschlossen = true
    private let netz = NWPathMonitor()
    private var netzArt = "unbekannt"

    private func ms() -> Int { Int(Date().timeIntervalSince(beginn) * 1000) }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        pasteConfiguration = UIPasteConfiguration(acceptableTypeIdentifiers: [UTType.url.identifier, UTType.plainText.identifier])

        adresse.placeholder = "Link einfügen"
        adresse.borderStyle = .roundedRect
        adresse.keyboardType = .URL
        adresse.autocapitalizationType = .none
        adresse.autocorrectionType = .no
        adresse.clearButtonMode = .whileEditing
        adresse.returnKeyType = .go
        adresse.delegate = self
        erkannt.font = .preferredFont(forTextStyle: .footnote)
        erkannt.textColor = .secondaryLabel
        erkannt.numberOfLines = 0
        stand.font = .preferredFont(forTextStyle: .body)
        stand.numberOfLines = 0
        stand.text = "Link einfügen. Hefta lädt die Seite unsichtbar und misst."
        bild.contentMode = .scaleAspectFill
        bild.clipsToBounds = true
        bild.layer.cornerRadius = 12
        bild.backgroundColor = .secondarySystemBackground

        let fertig = UIButton(type: .system)
        fertig.setTitle("Fertig", for: .normal)
        fertig.addTarget(self, action: #selector(fertigGetippt), for: .touchUpInside)
        let protokoll = UIButton(type: .system)
        protokoll.setTitle("Protokoll ansehen", for: .normal)
        protokoll.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        protokoll.backgroundColor = .label
        protokoll.setTitleColor(.systemBackground, for: .normal)
        protokoll.layer.cornerRadius = 22
        protokoll.addTarget(self, action: #selector(protokollGetippt), for: .touchUpInside)

        let kopf = UIStackView(arrangedSubviews: [adresse, fertig])
        kopf.spacing = 8
        var teile: [UIView] = [kopf]
        if #available(iOS 16.0, *) {
            let konf = UIPasteControl.Configuration()
            konf.displayMode = .iconAndLabel
            konf.cornerStyle = .capsule
            konf.baseForegroundColor = .systemBackground
            konf.baseBackgroundColor = .label
            let knopf = UIPasteControl(configuration: konf)
            knopf.target = self
            knopf.heightAnchor.constraint(equalToConstant: 44).isActive = true
            teile.append(UIStackView(arrangedSubviews: [knopf, UIView()]))
        }
        teile += [erkannt, stand, bild, UIView(), protokoll]
        let stapel = UIStackView(arrangedSubviews: teile)
        stapel.axis = .vertical
        stapel.spacing = 12
        stapel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stapel)
        let rand = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            stapel.topAnchor.constraint(equalTo: rand.topAnchor, constant: 16),
            stapel.leadingAnchor.constraint(equalTo: rand.leadingAnchor, constant: 16),
            stapel.trailingAnchor.constraint(equalTo: rand.trailingAnchor, constant: -16),
            stapel.bottomAnchor.constraint(equalTo: rand.bottomAnchor, constant: -8),
            adresse.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            bild.heightAnchor.constraint(equalToConstant: 200),
            protokoll.heightAnchor.constraint(equalToConstant: 48),
        ])

        netz.pathUpdateHandler = { [weak self] weg in
            var art = weg.usesInterfaceType(.wifi) ? "WLAN" : (weg.usesInterfaceType(.cellular) ? "Mobilfunk" : "anderes")
            if weg.status != .satisfied { art = "kein Netz" }
            if weg.isConstrained { art += ", Datensparmodus" }
            DispatchQueue.main.async { self?.netzArt = art }
        }
        netz.start(queue: .main)
        NotificationCenter.default.addObserver(self, selector: #selector(zwischenablagePruefen), name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        zwischenablagePruefen()
    }

    deinit { netz.cancel() }

    /// Still prüfen, ob wohl ein Link in der Zwischenablage liegt. Liest den Inhalt nicht.
    @objc private func zwischenablagePruefen() {
        UIPasteboard.general.detectPatterns(for: [.probableWebURL]) { [weak self] ergebnis in
            DispatchQueue.main.async {
                guard let self else { return }
                var satz: String
                switch ergebnis {
                case .success(let muster):
                    satz = muster.contains(.probableWebURL) ? "Still geprüft: Link in der Zwischenablage." : "Still geprüft: kein Link in der Zwischenablage."
                case .failure:
                    satz = "Still geprüft: Zwischenablage leer."
                }
                if #available(iOS 16.0, *) {} else { satz += " Einfügen-Knopf von iOS erst ab iOS 16." }
                self.erkannt.text = satz
                self.stillErkannt = satz
            }
        }
    }

    override func paste(itemProviders: [NSItemProvider]) {
        guard let anbieter = itemProviders.first else { return }
        let weg = "Einfügen-Knopf von iOS"
        if anbieter.canLoadObject(ofClass: URL.self) {
            _ = anbieter.loadObject(ofClass: URL.self) { [weak self] url, _ in
                DispatchQueue.main.async { if let url { self?.starten(url, weg: weg) } }
            }
        } else if anbieter.canLoadObject(ofClass: String.self) {
            _ = anbieter.loadObject(ofClass: String.self) { [weak self] text, _ in
                DispatchQueue.main.async {
                    guard let self, let ziel = self.linkAus(text ?? "") else { return }
                    self.starten(ziel, weg: weg)
                }
            }
        }
    }

    private func linkAus(_ roh: String) -> URL? {
        var text = roh.trimmingCharacters(in: .whitespacesAndNewlines)
        if let fund = text.range(of: "https://[^\\s]+", options: .regularExpression) { text = String(text[fund]) }
        else if !text.isEmpty && !text.hasPrefix("http") { text = "https://" + text }
        return URL(string: text)
    }

    func textFieldShouldReturn(_ feld: UITextField) -> Bool {
        feld.resignFirstResponder()
        if let ziel = linkAus(feld.text ?? "") { starten(ziel, weg: "Textfeld") }
        return true
    }

    private func starten(_ ziel: URL, weg: String) {
        guard ziel.scheme == "https" else { stand.text = "Nur https-Adressen."; return }
        if !abgeschlossen { abschliessen("abgelöst durch neuen Link") }
        adresse.text = ziel.absoluteString
        bild.image = nil
        abgeschlossen = false
        lauf = ["nr": laeufe.count + 1, "link": ziel.absoluteString, "eingefuegtUeber": weg, "netz": netzArt,
                "linkStillErkannt": stillErkannt ?? "nicht geprüft"]
        stand.text = "Lädt unsichtbar …"
        let einstellung = WKWebViewConfiguration()
        einstellung.websiteDataStore = .nonPersistent()
        let w = WKWebView(frame: CGRect(x: -3000, y: 0, width: 390, height: 844), configuration: einstellung)
        w.navigationDelegate = self
        view.addSubview(w)
        web = w
        beginn = Date()
        w.load(URLRequest(url: ziel))
        abfrage = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in self?.bereitPruefen() }
        grenze = Timer.scheduledTimer(withTimeInterval: 15, repeats: false) { [weak self] _ in
            guard let self, !self.abgeschlossen else { return }
            self.lesen(als: "beiAbbruch") { [weak self] in self?.abschliessen("nach 15 s abgebrochen") }
        }
    }

    private func bereitPruefen() {
        guard let web, !abgeschlossen, lauf["msAufgebaut"] == nil, lauf["msErsteAntwort"] != nil else { return }
        web.callAsyncJavaScript("return document.readyState", arguments: [:], in: nil, in: .defaultClient) { [weak self] ergebnis in
            guard let self, !self.abgeschlossen, self.lauf["msAufgebaut"] == nil,
                  case .success(let wert) = ergebnis, let zustand = wert as? String, zustand != "loading" else { return }
            self.lauf["msAufgebaut"] = self.ms()
            self.lesen(als: "beiAufgebaut") { [weak self] in
                guard let self, !self.abgeschlossen else { return }
                self.stand.text = "Aufgebaut nach \(self.lauf["msAufgebaut"].map { "\($0)" } ?? "?") ms, lädt weiter …"
            }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if navigationResponse.isForMainFrame && !abgeschlossen {
            lauf["msErsteAntwort"] = ms()
            if let http = navigationResponse.response as? HTTPURLResponse { lauf["httpStatus"] = http.statusCode }
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        if !abgeschlossen && lauf["msErsteAntwort"] == nil { lauf["msErsteAntwort"] = ms() }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !abgeschlossen, lauf["msGeladen"] == nil else { return }
        lauf["msGeladen"] = ms()
        lauf["endAdresse"] = webView.url?.absoluteString ?? ""
        // Kurz warten, damit ein Cookie-Banner erscheinen kann.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            guard let self, !self.abgeschlossen else { return }
            self.lesen(als: "beiGeladen") { [weak self] in self?.bildLaden() }
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        guard !abgeschlossen else { return }
        lauf["fehler"] = error.localizedDescription
        abschliessen("Fehler")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard !abgeschlossen else { return }
        lauf["fehler"] = error.localizedDescription
        abschliessen("Fehler")
    }

    private func lesen(als schluessel: String, danach: @escaping () -> Void) {
        guard let web else { danach(); return }
        let skript = """
        const meta = (n) => document.querySelector('meta[property="' + n + '"],meta[name="' + n + '"]')?.getAttribute('content') || null;
        const vw = innerWidth, vh = innerHeight;
        let gross = null, flaeche = 0;
        for (const i of document.images) { const r = i.getBoundingClientRect(); const f = r.width * r.height;
          if (r.width >= vw * 0.5 && r.height >= 120 && f > flaeche) { flaeche = f;
            gross = { src: (i.currentSrc || i.src || '').slice(0, 300), breite: i.naturalWidth, hoehe: i.naturalHeight, geladen: i.complete, oben: Math.round(r.top + scrollY) }; } }
        const worte = /cookie|einwillig|zustimm|akzeptier|datenschutzeinstellung|consent|privatsph/i;
        let banner = null, n = 0;
        for (const el of document.querySelectorAll('body *')) { if (++n > 6000) break;
          const s = getComputedStyle(el);
          if ((s.position === 'fixed' || s.position === 'sticky') && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0') {
            const r = el.getBoundingClientRect(); const anteil = Math.min(1, Math.max(0, r.width * r.height) / (vw * vh));
            if (anteil > 0.15 && (worte.test((el.innerText || '').slice(0, 3000)) || el.shadowRoot || el.tagName === 'IFRAME')) {
              banner = { anteilProzent: Math.round(anteil * 100), art: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''), text: (el.innerText || '').slice(0, 120) }; break; } } }
        const cmp = [...document.querySelectorAll('script[src],iframe[src]')].map(e => e.src)
          .filter(s => /usercentrics|onetrust|sourcepoint|consentmanager|cookiebot|didomi|trustarc|cmp|consent/i.test(s))
          .map(s => { try { return new URL(s).host; } catch (e) { return s.slice(0, 60); } });
        const text = document.body ? document.body.innerText : '';
        const nav = performance.getEntriesByType('navigation')[0];
        const zeiten = nav ? { antwort: Math.round(nav.responseStart), aufgebaut: Math.round(nav.domContentLoadedEventEnd), geladen: Math.round(nav.loadEventEnd),
          status: nav.responseStatus ?? null, kB: Math.round((nav.transferSize || 0) / 1024) } : null;
        return { zustand: document.readyState, titel: document.title, h1: (document.querySelector('h1')?.innerText || '').slice(0, 160),
          ogTitle: meta('og:title'), ogImage: meta('og:image'), ogBeschreibung: (meta('og:description') || '').slice(0, 100) || null,
          twitterImage: meta('twitter:image'), erstesGrossesBild: gross, cookieBanner: banner, einwilligungsDienste: [...new Set(cmp)],
          bilderZahl: document.images.length, seitenZeiten: zeiten, textLaenge: text.length,
          preisLesbar: /\\d[\\d.]*(,\\d+)?\\s*€/.test(text), flaecheLesbar: /\\d+([.,]\\d+)?\\s*(m²|qm)/i.test(text),
          menschPruefung: /kein roboter|not a robot|sind sie ein mensch|captcha|access denied|zugriff verweigert/i.test(text.slice(0, 5000)) };
        """
        web.callAsyncJavaScript(skript, arguments: [:], in: nil, in: .defaultClient) { [weak self] ergebnis in
            guard let self else { return }
            switch ergebnis {
            case .success(let wert): self.lauf[schluessel] = wert
            case .failure(let fehler): self.lauf[schluessel] = ["fehler": fehler.localizedDescription]
            }
            danach()
        }
    }

    /// Lädt das Vorschaubild (og:image, sonst das erste große Bild) und misst Zeit und Größe.
    private func bildLaden() {
        guard !abgeschlossen else { return }
        let gelesen = (lauf["beiGeladen"] as? [String: Any]) ?? (lauf["beiAufgebaut"] as? [String: Any]) ?? [:]
        let og = gelesen["ogImage"] as? String
        let gross = (gelesen["erstesGrossesBild"] as? [String: Any])?["src"] as? String
        guard let quelle = og ?? gross, let ziel = URL(string: quelle, relativeTo: web?.url)?.absoluteURL else {
            lauf["vorschaubild"] = "keins gefunden"
            abschliessen("fertig")
            return
        }
        let start = Date()
        URLSession(configuration: .ephemeral).dataTask(with: ziel) { [weak self] daten, antwort, fehler in
            DispatchQueue.main.async {
                guard let self, !self.abgeschlossen else { return }
                var info: [String: Any] = ["quelle": og != nil ? "og:image" : "erstes großes Bild",
                                           "ms": Int(Date().timeIntervalSince(start) * 1000)]
                if let daten, let b = UIImage(data: daten) {
                    self.bild.image = b
                    info["kB"] = daten.count / 1024
                    info["pixel"] = "\(Int(b.size.width * b.scale)) × \(Int(b.size.height * b.scale))"
                } else {
                    info["fehler"] = fehler?.localizedDescription ?? "kein Bild (HTTP \((antwort as? HTTPURLResponse)?.statusCode ?? 0))"
                }
                self.lauf["vorschaubild"] = info
                self.abschliessen("fertig")
            }
        }.resume()
    }

    private func abschliessen(_ wie: String) {
        guard !abgeschlossen else { return }
        abgeschlossen = true
        abfrage?.invalidate()
        grenze?.invalidate()
        web?.stopLoading()
        web?.removeFromSuperview()
        web = nil
        lauf["ende"] = wie
        lauf["msGesamt"] = ms()
        laeufe.append(lauf)
        let g = (lauf["beiGeladen"] as? [String: Any]) ?? (lauf["beiAufgebaut"] as? [String: Any]) ?? [:]
        let titel = (g["ogTitle"] as? String) ?? (g["h1"] as? String) ?? (g["titel"] as? String) ?? "–"
        let banner = g["cookieBanner"] is [String: Any] ? "ja" : "nein"
        let aufgebaut = lauf["msAufgebaut"].map { "\($0)" } ?? "–"
        let geladen = lauf["msGeladen"].map { "\($0)" } ?? "–"
        stand.text = "Lauf \(laeufe.count): \(wie) · \(netzArt)\nAufgebaut: \(aufgebaut) ms · geladen: \(geladen) ms\nTitel: \(titel)\nVorschaubild: \(bild.image != nil ? "ja" : "nein") · Cookie-Banner: \(banner)"
    }

    @objc private func fertigGetippt() {
        abschliessen("geschlossen")
        dismiss(animated: true)
    }

    @objc private func protokollGetippt() {
        let alles: [String: Any] = [
            "probe": "Hefta Probe 3 · Vorschau (E73)",
            "zeit": ISO8601DateFormatter().string(from: Date()),
            "ios": UIDevice.current.systemVersion,
            "laeufe": laeufe,
        ]
        let daten = (try? JSONSerialization.data(withJSONObject: alles, options: [.prettyPrinted, .sortedKeys])) ?? Data()
        present(ProbeProtokoll(text: String(data: daten, encoding: .utf8) ?? "{}"), animated: true)
    }
}
