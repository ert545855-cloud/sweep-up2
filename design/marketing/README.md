# SwipeUp pazarlama görselleri

Bu klasördeki dosyalar uygulamanın içindeki tasarımlardan üretilir ve Canva / Picsart'taki tanıtım işlerine girdi olarak kullanılır. Uygulama bunları sunmaz (`public/` dışında).

- `ikon-*.png` — Figma'da çizilen etkileşim ikonları (`public/img/eg/*.svg`), 512 px, şeffaf arka plan.
- `kart-*.jpg` — uygulamanın "Hikayende paylaş" kartları (`drawCard`, `public/js/engage.js`), 1080×1920.

İkonları ve kart arka planlarını yeniden üretmek için: `node scripts/build-eg-icons.mjs`.
