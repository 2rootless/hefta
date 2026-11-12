import Capacitor
import Network
import UIKit
import UniformTypeIdentifiers
import WebKit

/// Eigene Gerätefunktionen der App: PDFs von anderen Apps empfangen und Dateien über den
/// Sichern-Dialog des Systems ablegen. Die Daten bleiben außerdem aus dem iCloud-Backup heraus.
@objc(HeftaNativPlugin)
public class HeftaNativPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "HeftaNativPlugin"
    public let jsName = "HeftaNativ"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "alsDateiSichern", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "backupWaehlen", returnType: CAPPluginReturnPromise)
    ]

    private var sichernAufruf: CAPPluginCall?
    private var waehlenAufruf: CAPPluginCall?

    override public func load() {
        ausDemBackupNehmen()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(geoeffnet(_:)),
            name: .capacitorOpenURL,
            object: nil
        )
    }

    /// Unterlagen liegen im Speicher der Web-Ansicht; sie sollen das Gerät nicht verlassen.
    private func ausDemBackupNehmen() {
        let dateien = FileManager.default
        guard var ordner = dateien.urls(for: .libraryDirectory, in: .userDomainMask).first?
            .appendingPathComponent("WebKit", isDirectory: true) else { return }
        try? dateien.createDirectory(at: ordner, withIntermediateDirectories: true)
        var werte = URLResourceValues()
        werte.isExcludedFromBackup = true
        try? ordner.setResourceValues(werte)
    }

    @objc private func geoeffnet(_ meldung: Notification) {
        guard let werte = meldung.object as? [String: Any],
              let url = werte["url"] as? URL,
              url.isFileURL else { return }
        annehmen(url)
    }

    private func annehmen(_ url: URL) {
        let zugriff = url.startAccessingSecurityScopedResource()
        defer {
            if zugriff { url.stopAccessingSecurityScopedResource() }
        }
        let dateien = FileManager.default
        guard let caches = dateien.urls(for: .cachesDirectory, in: .userDomainMask).first else { return }
        let ordner = caches.appendingPathComponent("eingang", isDirectory: true)
        let ziel = ordner.appendingPathComponent(url.lastPathComponent)
        do {
            try dateien.createDirectory(at: ordner, withIntermediateDirectories: true)
            try? dateien.removeItem(at: ziel)
            try dateien.copyItem(at: url, to: ziel)
            notifyListeners(
                "eingang",
                data: ["dateien": [["uri": ziel.absoluteString, "name": url.lastPathComponent]]],
                retainUntilConsumed: true
            )
        } catch {
            CAPLog.print("HeftaNativ: Datei nicht angenommen: \(error.localizedDescription)")
        }
        // iOS legt beim „Öffnen in“ eine Kopie unter Documents/Inbox ab; die wird nicht mehr gebraucht.
        if url.path.contains("/Documents/Inbox/") {
            try? dateien.removeItem(at: url)
        }
    }

    @objc func alsDateiSichern(_ call: CAPPluginCall) {
        guard let text = call.getString("uri"), let url = URL(string: text) else {
            call.reject("uri fehlt")
            return
        }
        DispatchQueue.main.async {
            self.sichernAufruf = call
            let dialog = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
            dialog.delegate = self
            self.bridge?.viewController?.present(dialog, animated: true)
        }
    }

    /// Aufgabe 53: Auswahl nur für Hefta-Backups (de.hefta.backup). Die Auswahl der Web-Ansicht bietet
    /// sonst Fotos, Kamera und alle Dateien an (TestFlight, 7.11.).
    @objc func backupWaehlen(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.waehlenAufruf = call
            let typ = UTType(exportedAs: "de.hefta.backup")
            let dialog = UIDocumentPickerViewController(forOpeningContentTypes: [typ], asCopy: true)
            dialog.allowsMultipleSelection = false
            dialog.delegate = self
            self.bridge?.viewController?.present(dialog, animated: true)
        }
    }

    public func documentPicker(
        _ controller: UIDocumentPickerViewController,
        didPickDocumentsAt urls: [URL]
    ) {
        if let call = waehlenAufruf {
            waehlenAufruf = nil
            guard let url = urls.first else {
                call.resolve([:])
                return
            }
            call.resolve(["uri": url.absoluteString, "name": url.lastPathComponent])
            return
        }
        sichernAufruf?.resolve(["gesichert": true])
        sichernAufruf = nil
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        if let call = waehlenAufruf {
            waehlenAufruf = nil
            call.resolve([:])
            return
        }
        sichernAufruf?.resolve(["gesichert": false])
        sichernAufruf = nil
    }
}

// MARK: - Neues Heft aus dem Link (B23 Bildschirm 1 und 2, E72 bis E76)

/// Der Weg „Link einsetzen → Vorschau → einlesen“ in der App:
/// - `knopf`: legt den Einsetzen-Knopf von iOS (`UIPasteControl`, ab iOS 16) an eine feste Stelle über
///   die Web-Ansicht. Die Seite meldet die Stelle in CSS-Pixeln; der Kopf mit dem Knopf scrollt nie
///   (Antwort j). Der Knopf blendet nach dem Aufschlagen knapp ein und ist weg, solange die Tastatur
///   offen ist (E74). Er nimmt Adresse und Text an; die Seite sucht im Text den ersten Link (E75).
/// - `ablage`: prüft still, ob wohl ein Link in der Zwischenablage liegt, ohne sie zu lesen.
/// - `vorschau`: lädt das Inserat genau einmal unsichtbar (E72), mit eigenem, nicht dauerhaftem
///   Speicher, ohne Brücke von der Seite zu Hefta, gelesen in der Skriptwelt `.defaultClient`.
///   Regeln aus Probe 3: Prüfseite von ImmoScout24 abwarten, 8 s Grenze, Bild nur oben und keine Karte
///   oder Platzhalter, das erste Foto der Galerie vor `og:image`.
/// - `seite`: „Ganze Seite ansehen“ in einem eigenen Fenster mit denselben Regeln.
@objc(HeftaInseratPlugin)
public class HeftaInseratPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HeftaInseratPlugin"
    public let jsName = "HeftaInserat"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "knopf", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "knopfWeg", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ablage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "vorschau", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "vorschauAbbrechen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seite", returnType: CAPPluginReturnPromise)
    ]

    /// Farben aus `design/tokens.css`: hell Tinte auf Grund, dunkel umgekehrt (B23, Frage 6.3).
    private static let tinte = UIColor { merkmale in
        merkmale.userInterfaceStyle == .dark
            ? UIColor(red: 0xf3 / 255, green: 0xed / 255, blue: 0xe4 / 255, alpha: 1)
            : UIColor(red: 0x26 / 255, green: 0x22 / 255, blue: 0x1e / 255, alpha: 1)
    }
    private static let grund = UIColor { merkmale in
        merkmale.userInterfaceStyle == .dark
            ? UIColor(red: 0x1b / 255, green: 0x18 / 255, blue: 0x14 / 255, alpha: 1)
            : UIColor(red: 0xfa / 255, green: 0xf6 / 255, blue: 0xef / 255, alpha: 1)
    }

    private var knopfAnsicht: UIView?
    private let empfaenger = EinsetzenEmpfaenger(frame: .zero)
    private var tastaturOffen = false
    private var laden: InseratLaden?
    private let netz = NWPathMonitor()
    private var netzDa = true

    override public func load() {
        empfaenger.weiter = { [weak self] daten in
            self?.notifyListeners("eingesetzt", data: daten)
        }
        NotificationCenter.default.addObserver(self, selector: #selector(tastaturKommt),
                                               name: UIResponder.keyboardWillShowNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(tastaturGeht),
                                               name: UIResponder.keyboardWillHideNotification, object: nil)
        netz.pathUpdateHandler = { [weak self] weg in
            DispatchQueue.main.async { self?.netzDa = weg.status == .satisfied }
        }
        netz.start(queue: .main)
    }

    @objc func knopf(_ call: CAPPluginCall) {
        let x = call.getDouble("x") ?? 0
        let y = call.getDouble("y") ?? 0
        let breite = call.getDouble("breite") ?? 0
        let hoehe = call.getDouble("hoehe") ?? 0
        let verzoegerung = (call.getDouble("verzoegerung") ?? 0) / 1000
        DispatchQueue.main.async {
            guard #available(iOS 16.0, *),
                  let web = self.bridge?.webView,
                  let oben = web.superview else {
                call.resolve(["geht": false])
                return
            }
            let knopf: UIPasteControl
            if let vorhanden = self.knopfAnsicht as? UIPasteControl {
                knopf = vorhanden
            } else {
                let konf = UIPasteControl.Configuration()
                konf.displayMode = .iconAndLabel
                konf.cornerStyle = .capsule
                konf.baseForegroundColor = HeftaInseratPlugin.grund
                konf.baseBackgroundColor = HeftaInseratPlugin.tinte
                knopf = UIPasteControl(configuration: konf)
                if self.empfaenger.superview == nil { oben.addSubview(self.empfaenger) }
                knopf.target = self.empfaenger
                knopf.alpha = 0
                knopf.isHidden = self.tastaturOffen
                oben.addSubview(knopf)
                self.knopfAnsicht = knopf
                UIView.animate(withDuration: 0.15, delay: verzoegerung,
                               options: [.curveEaseOut, .allowUserInteraction]) { knopf.alpha = 1 }
            }
            // CSS-Pixel der Web-Ansicht sind Punkte; umgerechnet in die Lage über der Web-Ansicht.
            let ursprung = web.convert(CGPoint(x: x, y: y), to: oben)
            knopf.frame = CGRect(x: ursprung.x, y: ursprung.y, width: breite, height: hoehe)
            call.resolve(["geht": true])
        }
    }

    @objc func knopfWeg(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.knopfAnsicht?.removeFromSuperview()
            self.knopfAnsicht = nil
            call.resolve()
        }
    }

    @objc private func tastaturKommt() {
        tastaturOffen = true
        knopfAnsicht?.isHidden = true
    }

    @objc private func tastaturGeht() {
        tastaturOffen = false
        knopfAnsicht?.isHidden = false
    }

    /// Still prüfen: Liegt wohl ein Link in der Zwischenablage, liegt überhaupt etwas darin? Liest nichts.
    @objc func ablage(_ call: CAPPluginCall) {
        let tafel = UIPasteboard.general
        let inhalt = tafel.hasStrings || tafel.hasURLs
        guard inhalt else {
            call.resolve(["link": false, "inhalt": false])
            return
        }
        tafel.detectPatterns(for: [.probableWebURL]) { ergebnis in
            var link = false
            if case .success(let muster) = ergebnis { link = muster.contains(.probableWebURL) }
            call.resolve(["link": link, "inhalt": true])
        }
    }

    @objc func vorschau(_ call: CAPPluginCall) {
        guard let text = call.getString("url"), let ziel = URL(string: text), ziel.scheme == "https" else {
            call.resolve(["zustand": "fehler"])
            return
        }
        DispatchQueue.main.async {
            self.laden?.abbrechen()
            guard self.netzDa else {
                call.resolve(["zustand": "netz"])
                return
            }
            guard let ansicht = self.bridge?.viewController?.view else {
                call.resolve(["zustand": "fehler"])
                return
            }
            self.laden = InseratLaden(ziel: ziel, in: ansicht) { [weak self] ergebnis in
                self?.laden = nil
                call.resolve(ergebnis)
            }
        }
    }

    @objc func vorschauAbbrechen(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.laden?.abbrechen()
            self.laden = nil
            call.resolve()
        }
    }

    @objc func seite(_ call: CAPPluginCall) {
        guard let text = call.getString("url"), let ziel = URL(string: text), ziel.scheme == "https" else {
            call.reject("url fehlt")
            return
        }
        DispatchQueue.main.async {
            guard var sicht = self.bridge?.viewController else {
                call.reject("keine Ansicht")
                return
            }
            while let darueber = sicht.presentedViewController { sicht = darueber }
            let fuehrung = UINavigationController(rootViewController: SeitenFenster(ziel: ziel))
            fuehrung.modalPresentationStyle = .pageSheet
            if let blatt = fuehrung.sheetPresentationController {
                blatt.detents = [.large()]
                blatt.prefersGrabberVisible = true
            }
            sicht.present(fuehrung, animated: true)
            call.resolve()
        }
    }
}

/// Ziel des Einsetzen-Knopfs: nimmt Adresse oder Text an und gibt sie an die Seite weiter.
final class EinsetzenEmpfaenger: UIView {
    var weiter: (([String: Any]) -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        isHidden = true
        isUserInteractionEnabled = false
        pasteConfiguration = UIPasteConfiguration(
            acceptableTypeIdentifiers: [UTType.url.identifier, UTType.plainText.identifier])
    }

    required init?(coder: NSCoder) { nil }

    override func paste(itemProviders: [NSItemProvider]) {
        guard let anbieter = itemProviders.first else { return }
        if anbieter.canLoadObject(ofClass: URL.self) {
            _ = anbieter.loadObject(ofClass: URL.self) { [weak self] url, _ in
                DispatchQueue.main.async {
                    if let url {
                        self?.weiter?(["url": url.absoluteString])
                    } else {
                        self?.weiter?(["leer": true])
                    }
                }
            }
        } else if anbieter.canLoadObject(ofClass: String.self) {
            _ = anbieter.loadObject(ofClass: String.self) { [weak self] text, _ in
                DispatchQueue.main.async { self?.weiter?(["text": text ?? ""]) }
            }
        } else {
            weiter?(["leer": true])
        }
    }
}

/// Lädt ein Inserat genau einmal unsichtbar und liest es (E72, Regeln aus Probe 3).
final class InseratLaden: NSObject, WKNavigationDelegate {
    private static let grenze: TimeInterval = 8
    private let fertig: ([String: Any]) -> Void
    private var web: WKWebView?
    private var uhr: Timer?
    private var vorbei = false
    private var http: Int?
    private var liest = false

    /// Liest in der eigenen Skriptwelt: Adresse, Titel, Überschrift, `og:`-Angaben, Text und das erste
    /// große Foto im oberen Bereich (keine Karte, kein Platzhalter, kein Logo).
    private static let lesen = #"""
    const meta = (n) => document.querySelector('meta[property="' + n + '"],meta[name="' + n + '"]')?.getAttribute('content') || null;
    const vw = innerWidth, vh = innerHeight;
    const kein = /map|karte|staticmap|tile|openstreetmap|mapbox|placeholder|platzhalter|logo|avatar|icon|sprite|banner/i;
    let bild = null;
    for (const i of document.images) {
      const r = i.getBoundingClientRect();
      if (r.top + scrollY > vh * 1.2 || r.width < vw * 0.5 || r.height < 120) continue;
      const src = i.currentSrc || i.src || '';
      if (!src || src.startsWith('data:') || /\.svg(\?|$)/i.test(src) || kein.test(src) || kein.test(i.alt || '')) continue;
      bild = { src, breite: i.naturalWidth, hoehe: i.naturalHeight };
      break;
    }
    const h1 = ((document.querySelector('h1') || {}).innerText || '').trim().slice(0, 300);
    const text = document.body ? document.body.innerText : '';
    return { url: document.URL, titel: document.title || '', h1, ogTitle: meta('og:title'), ogImage: meta('og:image'),
      bild, text: text.slice(0, 300000), bereit: document.readyState };
    """#

    init(ziel: URL, in ansicht: UIView, fertig: @escaping ([String: Any]) -> Void) {
        self.fertig = fertig
        super.init()
        let einstellung = WKWebViewConfiguration()
        einstellung.websiteDataStore = .nonPersistent()
        let w = WKWebView(frame: CGRect(x: -4000, y: 0, width: 390, height: 844), configuration: einstellung)
        w.navigationDelegate = self
        w.isUserInteractionEnabled = false
        ansicht.addSubview(w)
        web = w
        w.load(URLRequest(url: ziel))
        uhr = Timer.scheduledTimer(withTimeInterval: InseratLaden.grenze, repeats: false) { [weak self] _ in
            self?.zeitUm()
        }
    }

    func abbrechen() {
        guard !vorbei else { return }
        vorbei = true
        aufraeumen()
    }

    private func aufraeumen() {
        uhr?.invalidate()
        web?.stopLoading()
        web?.removeFromSuperview()
        web = nil
    }

    private func ende(_ ergebnis: [String: Any]) {
        guard !vorbei else { return }
        vorbei = true
        aufraeumen()
        var alles = ergebnis
        if let http { alles["http"] = http }
        fertig(alles)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if navigationResponse.isForMainFrame, let antwort = navigationResponse.response as? HTTPURLResponse {
            http = antwort.statusCode
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Kurz warten, bis Skripte der Seite die Galerie aufgebaut haben.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in self?.versuchen() }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        fehler(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) {
        fehler(error)
    }

    private func fehler(_ error: Error) {
        let code = (error as NSError).code
        if code == NSURLErrorCancelled { return }
        let netz = [NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost,
                    NSURLErrorCannotFindHost, NSURLErrorCannotConnectToHost, NSURLErrorDNSLookupFailed,
                    NSURLErrorDataNotAllowed, NSURLErrorInternationalRoamingOff]
        ende(["zustand": netz.contains(code) ? "netz" : "fehler"])
    }

    /// Prüfseite von ImmoScout24 („Ich bin kein Roboter“, „Gleich geht’s weiter“): warten, bis die Seite
    /// von selbst weiterleitet. Das ist dasselbe Laden mit einer Weiterleitung (Antwort k).
    private static func istPruefseite(_ gelesen: [String: Any]) -> Bool {
        let titel = (gelesen["titel"] as? String ?? "").lowercased()
        let h1 = (gelesen["h1"] as? String ?? "").lowercased()
        return titel.contains("kein roboter") || h1.contains("gleich geht")
    }

    private func versuchen() {
        guard !vorbei, !liest, let web else { return }
        liest = true
        web.callAsyncJavaScript(InseratLaden.lesen, arguments: [:], in: nil, in: .defaultClient) { [weak self] ergebnis in
            guard let self, !self.vorbei else { return }
            self.liest = false
            guard case .success(let wert) = ergebnis, let gelesen = wert as? [String: Any],
                  !InseratLaden.istPruefseite(gelesen) else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in self?.versuchen() }
                return
            }
            self.bildHolen(gelesen)
        }
    }

    /// Nach 8 s: lesen, was da ist, damit „Trotzdem einlesen“ etwas hat.
    private func zeitUm() {
        guard !vorbei, let web else { return }
        web.callAsyncJavaScript(InseratLaden.lesen, arguments: [:], in: nil, in: .defaultClient) { [weak self] ergebnis in
            guard let self, !self.vorbei else { return }
            var alles: [String: Any] = [:]
            if case .success(let wert) = ergebnis, let gelesen = wert as? [String: Any],
               !InseratLaden.istPruefseite(gelesen) {
                alles = gelesen
                alles.removeValue(forKey: "bild")
            }
            alles["zustand"] = "zeit"
            self.ende(alles)
        }
    }

    /// Das erste Foto der Galerie, sonst `og:image`; verkleinert und als Daten an die Seite, denn die
    /// Seite von Hefta lädt nichts aus dem Netz.
    private func bildHolen(_ gelesen: [String: Any]) {
        var alles = gelesen
        alles["zustand"] = "ok"
        let basis = URL(string: gelesen["url"] as? String ?? "")
        let galerie = (gelesen["bild"] as? [String: Any])?["src"] as? String
        let og = gelesen["ogImage"] as? String
        alles.removeValue(forKey: "bild")
        guard let quelle = galerie ?? og,
              let ziel = URL(string: quelle, relativeTo: basis)?.absoluteURL,
              ziel.scheme == "https" else {
            ende(alles)
            return
        }
        var anfrage = URLRequest(url: ziel)
        anfrage.timeoutInterval = 4
        URLSession(configuration: .ephemeral).dataTask(with: anfrage) { [weak self] daten, _, _ in
            DispatchQueue.main.async {
                guard let self, !self.vorbei else { return }
                if let daten, let foto = UIImage(data: daten), let klein = InseratLaden.verkleinert(foto) {
                    alles["bild"] = "data:image/jpeg;base64," + klein.base64EncodedString()
                    alles["bildHoch"] = foto.size.height > foto.size.width
                }
                self.ende(alles)
            }
        }.resume()
    }

    private static func verkleinert(_ foto: UIImage) -> Data? {
        let faktor = min(1, 1200 / max(foto.size.width, 1))
        let groesse = CGSize(width: foto.size.width * faktor, height: foto.size.height * faktor)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let bild = UIGraphicsImageRenderer(size: groesse, format: format).image { _ in
            foto.draw(in: CGRect(origin: .zero, size: groesse))
        }
        return bild.jpegData(compressionQuality: 0.75)
    }
}

/// „Ganze Seite ansehen“: das Inserat in einem eigenen Fenster, mit eigenem, nicht dauerhaftem Speicher
/// und ohne Brücke zu Hefta. Hefta liest hier nichts.
final class SeitenFenster: UIViewController {
    private let ziel: URL

    init(ziel: URL) {
        self.ziel = ziel
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { nil }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let einstellung = WKWebViewConfiguration()
        einstellung.websiteDataStore = .nonPersistent()
        let web = WKWebView(frame: .zero, configuration: einstellung)
        web.allowsBackForwardNavigationGestures = true
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            web.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        navigationItem.title = ziel.host
        navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .done, target: self,
                                                            action: #selector(fertigGetippt))
        web.load(URLRequest(url: ziel))
    }

    @objc private func fertigGetippt() { dismiss(animated: true) }
}
