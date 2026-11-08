import Capacitor

/// Meldet den eigenen Baustein bei Capacitor an.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HeftaNativPlugin())
        // Vom linken Rand wischen geht zurück, wie in anderen Apps. Hefta führt jeden Bildschirm als
        // Eintrag im Verlauf (#/…), darum kennt die Ansicht den Weg zurück.
        webView?.allowsBackForwardNavigationGestures = true
    }
}
