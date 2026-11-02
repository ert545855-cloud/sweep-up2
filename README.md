# SwipeUp

Kaydırarak tanış, reels izle, hikaye paylaş, canlı yayın aç, mesajlaş ve ara. Tamamen gerçek zamanlı bir sosyal uygulama.

- **Keşfet (kaydır):** Kartı sağa kaydır beğen, sola geç, yukarı süper beğeni. Karşılıklı beğenide eşleşme ekranı açılır ve sohbet başlar.
- **Seni beğenenler ve filtreler:** Kimlerin sağa kaydırdığını gör; yaş aralığı, uzaklık ve cinsiyete göre filtrele.
- **Hikayeler:** 24 saatte kaybolan fotoğraf/video, görüntüleyenler listesi, hikayeye mesajla yanıt.
- **Reels:** Tam ekran dikey video akışı, çift dokunarak beğen, yorum, paylaş, kaydet, takip et.
- **Canlı yayın:** Kameradan WebRTC ile yayın; izleyici sayısı, canlı yorumlar ve kalpler. Takipçilere ve eşleşmelere bildirim gider.
- **Mesajlar:** Gerçek zamanlı sohbet; yazıyor göstergesi, çevrimiçi / son görülme, tek-çift-mavi tik, fotoğraf, video ve sesli mesaj. Mesajı sağa kaydırıp yanıtla, uzun basıp emoji tepkisi ver ya da herkesten sil.
- **Sesli ve görüntülü arama:** Birebir WebRTC araması, gelen arama ekranı ve push bildirimi, cevapsız arama kaydı.
- **Grup sohbetleri:** Grup kur, kişi ekle/çıkar, adını değiştir, ayrıl.
- **Güvenlik:** Engelle, şikayet et, eşleşmeyi kaldır; giriş denemesi sınırı; e-posta kodu ya da kurtarma koduyla şifre sıfırlama.
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
| `KEEP_ALIVE` | `0` verilirse sunucu kendini uyanık tutmaz. |

## Render'da yayınlama

Repodaki `render.yaml` bir web servisi ve ücretsiz bir Key Value deposu tanımlar. Render panelinde **New → Blueprint** ile bu repoyu seçmek yeterli.

Uygulamada örnek hesap yoktur; listelerde sadece gerçek üyeler görünür.
