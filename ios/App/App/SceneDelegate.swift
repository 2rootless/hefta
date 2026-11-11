import UIKit
import Capacitor
import SafariServices

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
            imBrowserZeigen(probe.url)
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

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
