import Foundation
import UIKit
import Capacitor
import UserNotifications

// Uygulama bildirimleri (Apple Push Notification service). Web bildirimleri iPhone'da "from swipeup" ibaresiyle gelir;
// buradan alınan cihaz jetonuyla sunucu (server/apns.js) bildirimi doğrudan uygulamaya gönderir.
// Web tarafı: window.Capacitor.Plugins.NativePush (bkz. depo kökünde public/js/push.js)
//   status()   → { permission: "granted" | "denied" | "prompt" }
//   register() → izin ister (ilk kez), { token, env } döner; env: Xcode'dan çalıştırılan (Debug) yapıda "sandbox", TestFlight / App Store'da "production"
//   setBadge({ count }) → uygulama simgesindeki kırmızı sayı (0 = kaldırılır); okunmamış bildirim + mesaj sayısı
//   olay "tap" → { url } : bildirime dokunulunca açılacak sayfa
// Çalışması için Signing & Capabilities'te "Push Notifications" yeteneği gerekir (App.entitlements → aps-environment; ücretli ekip).
// Capacitor köprüsü açılınca bildirim temsilcisini kendi yönlendiricisine (NotificationRouter) alır; uzak bildirimleri
// oradan pushNotificationHandler olarak bu sınıf karşılar. Köprü kurulmadan önceki an için AppDelegate de temsilci olarak atar.
final class PushHub: NSObject, UNUserNotificationCenterDelegate, NotificationHandlerProtocol {
    static let shared = PushHub()
    weak var plugin: NativePushPlugin?
    var pendingTap: [String: Any]?           // uygulama kapalıyken dokunulan bildirim: web hazır olunca iletilir
    private var waiting: [CAPPluginCall] = []  // jeton bekleyen register() çağrıları
    private(set) var lastToken: String?

    static var env: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }

    func wait(_ call: CAPPluginCall) {
        if let t = lastToken { call.resolve(["token": t, "env": PushHub.env]); return }
        waiting.append(call)
    }

    func didRegister(_ deviceToken: Data) {
        let t = deviceToken.map { String(format: "%02x", $0) }.joined()
        lastToken = t
        let calls = waiting; waiting = []
        calls.forEach { $0.resolve(["token": t, "env": PushHub.env]) }
    }

    func didFail(_ error: Error) {
        let calls = waiting; waiting = []
        calls.forEach { $0.reject("Bildirim kaydı yapılamadı: \(error.localizedDescription)", "REGISTER_FAILED") }
    }

    // Uygulama açıkken gelen bildirim de üstte gösterilsin
    func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        return [.banner, .list, .sound]
    }

    // Bildirime dokunuldu: ilgili sayfayı web tarafına bildir
    func didReceive(response: UNNotificationResponse) {
        let info = response.notification.request.content.userInfo
        var data: [String: Any] = ["url": (info["url"] as? String) ?? "/#/notifications"]
        if let uid = info["uid"] as? String { data["uid"] = uid }
        if let p = plugin { p.emitTap(data) } else { pendingTap = data }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler(willPresent(notification: notification))
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        didReceive(response: response)
        completionHandler()
    }
}

@objc(NativePushPlugin)
public class NativePushPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativePushPlugin"
    public let jsName = "NativePush"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBadge", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        PushHub.shared.plugin = self
        bridge?.notificationRouter.pushNotificationHandler = PushHub.shared
        if let tap = PushHub.shared.pendingTap { PushHub.shared.pendingTap = nil; emitTap(tap) }
    }

    func emitTap(_ data: [String: Any]) {
        // Dinleyici henüz eklenmemişse (sayfa yükleniyor) olay saklanır, ilk dinleyiciye verilir
        notifyListeners("tap", data: data, retainUntilConsumed: true)
    }

    private static func name(_ s: UNAuthorizationStatus) -> String {
        switch s {
        case .authorized, .provisional, .ephemeral: return "granted"
        case .denied: return "denied"
        default: return "prompt"
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { s in
            call.resolve(["permission": NativePushPlugin.name(s.authorizationStatus)])
        }
    }

    // Simgedeki sayı: sunucu bildirimle birlikte (aps.badge) yazar; uygulama açıkken okununca web tarafı günceller
    @objc func setBadge(_ call: CAPPluginCall) {
        let n = max(0, call.getInt("count") ?? 0)
        DispatchQueue.main.async {
            if #available(iOS 16.0, *) {
                UNUserNotificationCenter.current().setBadgeCount(n) { _ in call.resolve() }
            } else {
                UIApplication.shared.applicationIconBadgeNumber = n
                call.resolve()
            }
        }
    }

    @objc func register(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { s in
            let go = {
                DispatchQueue.main.async {
                    PushHub.shared.wait(call)
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
            switch s.authorizationStatus {
            case .denied:
                call.reject("Bildirim izni kapalı. Ayarlar → SwipeUp → Bildirimler'den açabilirsin.", "DENIED")
            case .notDetermined:
                center.requestAuthorization(options: [.alert, .sound, .badge]) { ok, _ in
                    if ok { go() } else { call.reject("Bildirim izni verilmedi.", "DENIED") }
                }
            default:
                go()
            }
        }
    }
}
