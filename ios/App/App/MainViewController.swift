import Capacitor

/// Meldet den eigenen Baustein bei Capacitor an.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HeftaNativPlugin())
    }
}
