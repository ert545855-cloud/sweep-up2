// Bilgi Yarışması
import { quizTable } from '../quizview.js';

export default function bilgi(view, id) {
  return quizTable(view, id, {
    game: 'bilgi', title: 'Bilgi Yarışması', emoji: '🧠', theme: 'pk-quiz', unit: 'Soru', joker: true,
    cats: [['karisik', 'Karışık'], ['genel', 'Genel kültür'], ['tarih', 'Tarih'], ['cografya', 'Coğrafya'], ['bilim', 'Bilim'], ['spor', 'Spor'], ['sanat', 'Sanat ve edebiyat'], ['ekran', 'Sinema ve müzik']],
    rules: `<p><b>Oynanış:</b> 10 soru gelir, her soru için 15 saniyen var. Dört şıktan doğrusunu seç.</p>
      <p><b>Puan:</b> Doğru cevap 50 puan, ne kadar hızlı cevaplarsan 50 puana kadar ek puan. Yanlış cevap 0.</p>
      <p><b>Joker:</b> Her oyunda bir kez 50:50 jokerini kullanıp iki yanlış şıkkı eleyebilirsin.</p>
      <p><b>Tek başına:</b> Arkadaşın yoksa boş yerlere bot oturur, hemen başlarsın.</p>`,
  });
}
