# SwipeUp mağaza sürümleri

Uygulama zaten çalışan bir web uygulaması (PWA). Mağaza sürümleri bu siteyi yerel bir kabuk içinde açar; her yeni yayın (Render) mağaza güncellemesi gerekmeden telefonlara da gelir. Kabuğu yeniden yüklemek yalnızca simge, ad, izinler ya da sürüm numarası değişince gerekir.

Hazır olanlar:

| Ne | Nerede |
| --- | --- |
| Android paket ayarları (Trusted Web Activity) | `store/android/twa-manifest.json` |
| iOS kabuk ayarları (Capacitor) | `store/ios/capacitor.config.json` |
| Alan adı doğrulaması | Sunucu `/.well-known/assetlinks.json` ve `/.well-known/apple-app-site-association` adreslerini ortam değişkenlerinden üretir |
| Uygulamaya girmeden hesap silme sayfası | `https://swipeup-hh1f.onrender.com/hesap-silme` (Google Play bunu ister) |
| Gizlilik politikası | `https://swipeup-hh1f.onrender.com/#/legal/gizlilik` |
| Mağaza metinleri | `store/listing.md` |

Uygulama içinde hesap silme (Ayarlar → Hesabımı sil), fotoğraf denetimi, şikayet ve engelleme zaten var; tanışma uygulamaları için mağazalar bunları arar.

## 1. Hesaplar

- **Google Play Console**: tek seferlik 25 $. Kişisel hesapla açarsan ilk yayından önce en az **12 test kullanıcısıyla 14 gün kapalı test** zorunlu. Şirket (kurumsal) hesabında bu kural yok ama D-U-N-S numarası istenir.
- **Apple Developer Program**: yıllık 99 $. Şirket adına açmak için D-U-N-S numarası gerekir. iOS paketini derlemek için bir Mac ve Xcode şart.

## 2. Android (Google Play)

Bilgisayarında Node.js ve Java 17 kurulu olmalı.

```bash
npm i -g @bubblewrap/cli
mkdir swipeup-android && cd swipeup-android
cp ../store/android/twa-manifest.json .
bubblewrap update          # ayarlardan Android projesini üretir; imza anahtarını ilk seferde oluşturur
bubblewrap build           # app-release-bundle.aab dosyasını üretir
```

- İlk çalıştırmada oluşan `android.keystore` dosyasını ve şifresini **kaybetme**; güncellemeler bu anahtarla imzalanır. Git’e koyma.
- `app-release-bundle.aab` dosyasını Play Console’a yükle. Play App Signing’i açık bırak.
- Play Console → **Uygulama bütünlüğü → Uygulama imzalama** sayfasındaki **SHA-256** parmak izini kopyala ve Render’da ortam değişkeni olarak ekle:
  - `ANDROID_SHA256` = parmak izi (birden fazlaysa virgülle; yerel anahtarınkini de ekleyebilirsin)
  - `ANDROID_PACKAGE` = `app.swipeup.twa` (paket adını değiştirdiysen onu yaz)
- Doğrulama: `https://swipeup-hh1f.onrender.com/.well-known/assetlinks.json` parmak izini göstermeli. Göstermezse uygulamanın üstünde tarayıcı adres çubuğu görünür.

Play Console’da doldurulacaklar: içerik derecelendirme anketi (tanışma, kullanıcılar arası sohbet, canlı yayın, sanal jeton satın alma), hedef kitle **18+**, veri güvenliği formu (aşağıda), gizlilik politikası adresi, hesap silme adresi.

## 3. iOS (App Store)

Mac’te:

```bash
mkdir swipeup-ios && cd swipeup-ios
npm init -y && npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/push-notifications
mkdir www && echo '<!doctype html><title>SwipeUp</title>' > www/index.html
cp ../store/ios/capacitor.config.json .
npx cap add ios && npx cap sync ios
npx cap open ios           # Xcode açılır
```

Xcode’da: Bundle ID `app.swipeup.ios`, ekibini seç, **Push Notifications** ve **Associated Domains** (`applinks:swipeup-hh1f.onrender.com`) yeteneklerini ekle, `Info.plist`’e kamera, mikrofon, fotoğraf ve konum izin açıklamalarını Türkçe yaz. Sonra Product → Archive → App Store Connect’e yükle.

Render’a ekle: `APPLE_TEAM_ID` (Apple geliştirici takım kimliğin) ve `IOS_BUNDLE` (`app.swipeup.ios`).

**Dikkat:** Apple, yalnızca bir web sitesini saran uygulamaları sık sık reddeder (Kural 4.2). Onay şansını artırmak için kabuğa en azından yerel bildirim (yukarıdaki eklenti) eklenmeli; gerekirse kamera ve paylaşım gibi yerel eklentiler de eklenir. Ret gelirse gerekçeye göre düzeltip yeniden göndeririz.

## 4. Veri güvenliği / gizlilik formu için özet

Uygulamanın topladıkları (formu doldururken kodla ve gizlilik politikasıyla karşılaştır):

- Hesap bilgileri: ad, kullanıcı adı, e-posta, doğum tarihi
- Fotoğraf ve videolar (profil, gönderi, hikâye, Reels, sohbet)
- Mesajlar ve sesli/görüntülü arama (arama sesi ve görüntüsü cihazlar arasında doğrudan ya da bir aktarma sunucusu üzerinden gider, saklanmaz)
- Yaklaşık konum (yalnızca izin verilirse, ~1 km yuvarlanmış)
- Satın alma geçmişi (jeton), uygulama içi etkileşimler
- Kamera ve mikrofon: canlı yayın, karaoke, aramalar, oyun sesli sohbeti (kayıt yalnızca kullanıcı paylaşırsa saklanır)
- Üçüncü taraflarla paylaşım olarak belirtilmesi gerekenler: yüklenen fotoğraflar denetim için Sightengine’e, fal için gönderilen fincan fotoğrafları Google Gemini’ye, GIF aramaları GIPHY’ye, müzik aramaları Spotify’a gider

## 5. Sürüm güncelleme

Web tarafındaki her değişiklik Render’a gidince telefonlara da gelir. Kabuğu yeniden yüklemen gereken durumlar: simge ya da ad değişikliği, yeni izin, `appVersionCode` (Android) ya da build numarası (iOS) artırılması gereken mağaza istekleri.
