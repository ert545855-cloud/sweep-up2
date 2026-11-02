# Sweep Up

Instagram görünümünde, Tinder gibi kaydırmalı, tamamen çevrimiçi bir sosyal uygulama.

- **Keşfet (kaydır):** Kartı sağa kaydır beğen, sola geç, yukarı süper beğeni. Karşılıklı beğenide eşleşme ekranı açılır ve sohbet başlar.
- **Reels:** Tam ekran dikey video akışı, çift dokunarak beğen, yorum, paylaş, kaydet, takip et.
- **Canlı yayın:** Kameradan WebRTC ile yayın; izleyici sayısı, canlı yorumlar ve kalpler. Takipçilere bildirim gider.
- **Mesajlar:** WhatsApp tarzı gerçek zamanlı sohbet; yazıyor göstergesi, çevrimiçi / son görülme, tek-çift-mavi tik, fotoğraf ve video gönderme.
- **Akış ve profil:** Gönderi paylaşma, beğeni, yorum, takip, keşfet ızgarası, kaydedilenler.
- **Bildirimler:** Uygulama açıkken üstte banner, kapalıyken Web Push (Android / masaüstü; iPhone'da ana ekrana eklenmiş PWA).

## Teknoloji

Node.js · Express · Socket.IO · WebRTC · Web Push (VAPID) · PostgreSQL (yoksa yerel JSON dosyası) · derleme adımı olmayan PWA arayüzü.

## Yerelde çalıştırma

```bash
npm install
npm start          # http://localhost:3000
```

`DATABASE_URL` verilmezse veriler `data/` klasöründe tutulur.

## Ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| `DATABASE_URL` | PostgreSQL bağlantısı. Medya dahil her şey burada saklanır. |
| `JWT_SECRET` | İsteğe bağlı. Verilmezse otomatik üretilip veritabanında saklanır. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | İsteğe bağlı. Verilmezse otomatik üretilip saklanır. |
| `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | İsteğe bağlı TURN sunucusu; mobil veri gibi kısıtlı ağlarda canlı yayın bağlantısını güçlendirir. |

## Render'da yayınlama

Repodaki `render.yaml` bir web servisi ve ücretsiz bir PostgreSQL veritabanı tanımlar. Render panelinde **New → Blueprint** ile bu repoyu seçmek yeterli.

İlk açılışta örnek hesaplar ve içerik eklenir; örnek hesaplar sağa kaydırıldığında çoğunlukla geri beğenip mesaj atar, böylece eşleşme ve sohbet hemen denenebilir.
