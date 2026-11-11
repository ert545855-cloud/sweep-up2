# SwipeUp mağaza sürümleri

Uygulama zaten çalışan bir web uygulaması (PWA). Mağaza sürümleri bu siteyi yerel bir kabuk içinde açar; her yeni yayın (Render) mağaza güncellemesi gerekmeden telefonlara da gelir. Kabuğu yeniden yüklemek yalnızca simge, ad, izinler ya da sürüm numarası değişince gerekir.

Hazır olanlar:

| Ne | Nerede |
| --- | --- |
| Android paket ayarları (Trusted Web Activity) | `store/android/twa-manifest.json` |
| iOS kabuk ayarları (Capacitor) | `store/ios/capacitor.config.json` |
| Alan adı doğrulaması | Sunucu `/.well-known/assetlinks.json` ve `/.well-known/apple-app-site-association` adreslerini ortam değişkenlerinden üretir |
| Uygulamaya girmeden hesap silme sayfası | `https://swipeup-hh1f.onrender.com/hesap-silme` (Google Play bunu ister) |
| Gizlilik politikası | `https://swipeup-hh1f.onrender.com/gizlilik` |
| KVKK aydınlatma metni | `https://swipeup-hh1f.onrender.com/kvkk` |
| Açık rıza metni | `https://swipeup-hh1f.onrender.com/acik-riza` |
| Kullanım koşulları | `https://swipeup-hh1f.onrender.com/kosullar` |
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
- Üçüncü taraflarla paylaşım olarak belirtilmesi gerekenler: yüklenen fotoğraflar denetim için Sightengine’e, fal için gönderilen fincan fotoğrafları (yalnızca açık rızayla) Google Gemini’ye, GIF aramaları GIPHY’ye, müzik aramaları Spotify’a gider; Google / Apple ile giriş seçilirse kimlik numarası ve e-posta o sağlayıcıdan alınır
- İsteğe bağlı (açık rızalı) olanlar: kampanya bildirimleri, konum, fal fotoğraflarının yapay zekayla yorumlanması; hepsi Ayarlar → İzinlerim’den geri alınabilir
- Hesap silme: uygulama içinde Ayarlar → Hesabımı sil; web’de `https://swipeup-hh1f.onrender.com/hesap-silme`. Silinince profil, paylaşımlar, mesajlar ve yüklenen dosyalar silinir; ödeme kayıtları yasal süre (10 yıl) saklanır
- Veriler aktarım sırasında şifrelenir (HTTPS); sohbet dosyaları süreli imzalı bağlantılarla yalnızca sohbetteki kişilere açılır

## 4.1 KVKK: uygulama dışında yapılması gerekenler

- **Yurt dışına aktarım (KVKK m.9):** Sunucular Almanya’da (Render, Supabase / AWS Frankfurt); fotoğraf denetimi Fransa’da (Sightengine); yapay zeka, giriş ve bildirim hizmetleri ABD’de (Google, Apple). Her sağlayıcıyla Kurul’un yayımladığı **standart sözleşme** imzalanmalı ve imzadan sonra **5 iş günü içinde** Kurul’a (standartsozlesme.kvkk.gov.tr) bildirilmelidir. Sözleşme metni değiştirilemez.
- **VERBİS:** Kayıt yükümlülüğü çalışan sayısı ve ciroya göre değişir; muhasebeci / hukukçuyla kontrol et.
- **Veri sorumlusu bilgileri:** Yönetim paneli → Ayarlar → Yasal bilgiler’e şirket unvanı, adres ve başvuru e-postasını gir; metinlerde otomatik görünür.
- **Ticari ileti onayı:** Kampanya bildirimleri yalnızca izin verenlere gider (yönetim → Bildirim gönder → “Kampanya / tanıtım bildirimi”). E-posta / SMS ile kampanya gönderilecekse İYS kaydı gerekir.

## 5. Sürüm güncelleme

Web tarafındaki her değişiklik Render’a gidince telefonlara da gelir. Kabuğu yeniden yüklemen gereken durumlar: simge ya da ad değişikliği, yeni izin, `appVersionCode` (Android) ya da build numarası (iOS) artırılması gereken mağaza istekleri.
