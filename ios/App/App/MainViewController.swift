import Capacitor
import UIKit

/// Meldet die eigenen Bausteine bei Capacitor an.
class MainViewController: CAPBridgeViewController {
    /// Grund aus `design/tokens.css`, hell und dunkel: Er steht hinter der Seite, wo sie nicht hinreicht,
    /// etwa über der Tastatur (TestFlight 12.11.: dort war eine weiße Fläche).
    private static let grund = UIColor { merkmale in
        merkmale.userInterfaceStyle == .dark
            ? UIColor(red: 0x1b / 255, green: 0x18 / 255, blue: 0x14 / 255, alpha: 1)
            : UIColor(red: 0xfa / 255, green: 0xf6 / 255, blue: 0xef / 255, alpha: 1)
    }

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HeftaNativPlugin())
        bridge?.registerPluginInstance(HeftaInseratPlugin())
        // Vom linken Rand wischen geht zurück, wie in anderen Apps. Hefta führt jeden Bildschirm als
        // Eintrag im Verlauf (#/…), darum kennt die Ansicht den Weg zurück.
        webView?.allowsBackForwardNavigationGestures = true
        view.backgroundColor = MainViewController.grund
        webView?.isOpaque = false
        webView?.backgroundColor = MainViewController.grund
        webView?.scrollView.backgroundColor = MainViewController.grund
    }
}
