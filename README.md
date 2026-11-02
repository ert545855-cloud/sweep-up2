# SwipeUp

Kaydırarak tanış, reels izle, hikaye paylaş, canlı yayın aç, mesajlaş ve ara. Tamamen gerçek zamanlı bir sosyal uygulama.

- **Keşfet (kaydır):** Kartı sağa kaydır beğen, sola geç, yukarı süper beğeni. Karşılıklı beğenide eşleşme ekranı açılır ve sohbet başlar.
- **Seni beğenenler ve filtreler:** Kimlerin sağa kaydırdığını gör; yaş aralığı, uzaklık ve cinsiyete göre filtrele.
- **Hikayeler:** 24 saatte kaybolan fotoğraf/video, görüntüleyenler listesi, hikayeye mesajla yanıt.
- **Dalga:** Tam ekran dikey video akışı (SwipeUp’a özgü kısa videolar), çift dokunarak beğen, yorum, paylaş, kaydet, takip et.
- **Canlı yayın:** Kameradan WebRTC ile yayın; izleyici sayısı, canlı yorumlar ve kalpler. Takipçilere ve eşleşmelere bildirim gider.
- **Mesajlar:** Gerçek zamanlı sohbet; yazıyor göstergesi, çevrimiçi / son görülme, tek-çift-mavi tik, fotoğraf, video ve sesli mesaj. Mesajı sağa kaydırıp yanıtla, uzun basıp emoji tepkisi ver ya da herkesten sil.
- **Sesli ve görüntülü arama:** Birebir WebRTC araması, gelen arama ekranı ve push bildirimi, cevapsız arama kaydı.
- **Grup sohbetleri:** Grup kur, kişi ekle/çıkar, adını değiştir, ayrıl.
- **Güvenlik:** Engelle, şikayet et, eşleşmeyi kaldır; giriş denemesi sınırı; e-posta kodu ya da kurtarma koduyla şifre sıfırlama.
- **Temalar:** Gün batımı (açık/koyu), Pembe rüya, Gece moru ve Altın. Seçilen tema hesapta saklanır, her cihazda aynı görünür.
- **Fal:** Kahve falı (fincan fotoğrafları), tarot, burç yorumu ve aşk uyumu istekleri **Falcı Teyze** hesabının mesaj kutusuna düşer; cevabı o hesaptan bir kişi yazar (yazı ya da sesli mesaj). Falcı Teyze'nin "Fal kuyruğu" ekranında bekleyen ve cevaplanan istekler listelenir.
- **Yönetim paneli (`/admin`):** Ayrı giriş ve ayrı yönetici verisiyle (gelir-gider, notlar, duyurular, işlem kaydı) çalışır, uygulama verisini okur ve uygulamaya etki eder: kullanıcıları uyarma, askıya alma, yasaklama, şikayetleri sonuçlandırma, itirazları kabul/ret, içerik kaldırma, herkese duyuru, fal istatistikleri, gelir-gider takibi ve CSV dışa aktarma.
- **SwipeUp+ ve jeton:** Ücretsiz üyelikte günlük beğeni/süper beğeni sınırı; SwipeUp+ ile sınırsız beğeni, seni beğenenleri görme, geri alma, günde 5 süper beğeni ve haftada 1 ücretsiz boost. Jetonla boost, canlı yayın hediyeleri ve ücretli fal. Ödemeler havale/EFT siparişiyle alınır: kullanıcı sipariş kodunu açıklamaya yazar, yönetim panelinde onaylanınca ürün anında tanımlanır ve gelir olarak kaydedilir.
- **Canlı yayın hediyeleri:** İzleyiciler jetonla hediye gönderir; yayıncının payı "Kazançlarım"a eklenir, 100 ₺ olunca IBAN'a ödeme talebi açılır.
- **Gizlilik:** Gizli hesap (takip isteği onayı), son görülmeyi gizleme, okundu bilgisini kapatma, kaydırma destesinde görünmeme.
- **Hikaye çıkartmaları:** Metin, anket (sonuçlar canlı), soru kutusu (yanıtlar sahibine), müzik ve @bahsetme.
- **Gönderiler:** 10 fotoğrafa kadar kaydırmalı gönderi, fotoğraf filtreleri, #etiket sayfaları ve @bahsetme bildirimleri.
- **Dalga düzenleme:** Kırpma, hız (0.5x–2x), filtre ve kendi müziğini ekleme (oynatırken uygulanır).
- **Mesajlar:** Kaybolan mesajlar (1 saat / 24 saat / 7 gün) ve haritalı konum paylaşma.
- **Otomatik moderasyon:** Yorum, açıklama, biyografi ve canlı yorumlardaki küfürler yıldızlanır; mesajlardaki tehdit ve ağır hakaretler yönetim paneline düşer.
- **Güven ve yasal:** Kayıtta doğum tarihi zorunlu (18 yaş altı kabul edilmez), selfie + poz ile mavi tik doğrulaması, gizlilik politikası, kullanım koşulları, KVKK aydınlatma metni, topluluk kuralları, uygulama içinden hesap silme ve "verilerimi indir".
- **Genel sohbet:** Tüm üyelerin aynı odada konuştuğu herkese açık sohbet; çevrimiçi sayısı, yanıtlama, emoji tepkisi, fotoğraf, @bahsetme, şikayet. Küfürler yıldızlanır, tehditler yönetim paneline düşer.
- **Müzik (Spotify):** Hikaye ve dalgalara Spotify kataloğundan şarkı eklenir (kapak, sanatçı, "Spotify'da aç"). 30 sn önizleme sesi Spotify vermiyorsa iTunes önizlemesinden eşlenir. `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` yoksa arama iTunes ile çalışır.
- **Efektler:** Canlı, Siyah Beyaz, Noir, Sıcak, Soğuk, Altın saat, Vintage, Retro, Soluk, Pastel, Pembe, Dram, Sinema, Gece, Neon; gönderilerde, hikayelerde, dalgalarda ve canlı yayında (yayıncının seçtiği efekt izleyicilerde de görünür). Önizlemede sağa-sola kaydırarak değişir.
- **Bildirimler:** Uygulama açıkken üstte banner, kapalıyken Web Push (Android / masaüstü; iPhone'da ana ekrana eklenmiş uygulama).

## Teknoloji

Node.js · Express · Socket.IO · WebRTC (Open Relay TURN) · Web Push (VAPID) · Render Key Value / PostgreSQL (ikisi de yoksa yerel JSON dosyası) · derleme adımı olmayan PWA arayüzü.

## Yerelde çalıştırma

```bash
npm install
npm start          # http://localhost:3000
```

`DATABASE_URL` verilmezse veriler `data/` klasöründe tutulur.

## Ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| `DATABASE_URL` | PostgreSQL bağlantısı. Varsa her şey (medya dahil) burada saklanır. |
| `REDIS_URL` | Render Key Value bağlantısı. Hesaplar, mesajlar ve küçük medya burada saklanır; güncellemelerde silinmez. |
| `REDIS_MEDIA_BUDGET_MB` | Key Value'da medyaya ayrılan alan (varsayılan 14 MB). Dolunca medya sunucu diskine yazılır. |
| `JWT_SECRET` | İsteğe bağlı. Verilmezse otomatik üretilip veritabanında saklanır. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | İsteğe bağlı. Verilmezse otomatik üretilip saklanır. |
| `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | İsteğe bağlı kendi TURN sunucun. Verilmezse metered.ca Open Relay (ücretsiz) kullanılır. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Şifre sıfırlama kodlarını Gmail ile göndermek için. Yoksa kurtarma kodu kullanılır. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Gmail yerine başka bir e-posta sağlayıcısı. |
| `CANONICAL_URL` | Bu sunucuya gelen istekleri verilen adrese yönlendirir (eski adresler için). |
| `FALCI_PASSWORD` | Falcı Teyze hesabının (`falciteyze`) şifresi. Hesap ilk açılışta oluşturulur; şifre uygulamadan değiştirilirse bu değer artık uygulanmaz. |
| `ADMIN_PASSWORD` | Yönetim panelindeki `admin` hesabının ilk şifresi. Panelden değiştirilirse bu değer artık uygulanmaz. |
| `KEEP_ALIVE` | `0` verilirse sunucu kendini uyanık tutmaz. |

### Veritabanı (Supabase)
Veriler Supabase PostgreSQL'de, `swipeup` şemasında (`docs` ve `media` tabloları) tutulur; şema Data API'ye açık değildir, sunucu ayrı bir `swipeup_app` rolüyle bağlanır.
- `DATABASE_URL`: Supabase bağlantı adresi (pooler, oturum modu 5432). `DATABASE_URL_FALLBACKS`: boşlukla ayrılmış yedek adresler, sırayla denenir.
- `PG_SCHEMA=swipeup`
- Tablo boşken ilk açılışta `REDIS_URL`'deki tüm veri ve medya otomatik taşınır (`MIGRATE_FROM_REDIS=0` ile kapatılır). PostgreSQL'e ulaşılamazsa uygulama Key Value ile çalışmaya devam eder.
- Yönetim paneli → Veritabanı: bağlantı durumu, kullanılan alan, tablolar ve JSON yedek indirme.

## Render'da yayınlama

Repodaki `render.yaml` bir web servisi ve ücretsiz bir Key Value deposu tanımlar. Render panelinde **New → Blueprint** ile bu repoyu seçmek yeterli.

Uygulamada örnek hesap yoktur; listelerde sadece gerçek üyeler görünür.
