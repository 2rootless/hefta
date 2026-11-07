import Capacitor
import UIKit

/// Eigene Gerätefunktionen der App: PDFs von anderen Apps empfangen und Dateien über den
/// Sichern-Dialog des Systems ablegen. Die Daten bleiben außerdem aus dem iCloud-Backup heraus.
@objc(HeftaNativPlugin)
public class HeftaNativPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "HeftaNativPlugin"
    public let jsName = "HeftaNativ"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "alsDateiSichern", returnType: CAPPluginReturnPromise)
    ]

    private var sichernAufruf: CAPPluginCall?

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

    public func documentPicker(
        _ controller: UIDocumentPickerViewController,
        didPickDocumentsAt urls: [URL]
    ) {
        sichernAufruf?.resolve(["gesichert": true])
        sichernAufruf = nil
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        sichernAufruf?.resolve(["gesichert": false])
        sichernAufruf = nil
    }
}
