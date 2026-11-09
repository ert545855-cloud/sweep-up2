// Şarkıyı Tahmin Et
import { quizTable } from '../quizview.js';

export default function sarki(view, id) {
  return quizTable(view, id, {
    game: 'sarki', title: 'Şarkıyı Tahmin Et', emoji: '🎵', theme: 'pk-music', unit: 'Şarkı', music: true,
    cats: [['karisik', 'Karışık'], ['pop', 'Türkçe pop'], ['rap', 'Türkçe rap'], ['rock', 'Türkçe rock'], ['nostalji', '90’lar ve 2000’ler'], ['yabanci', 'Yabancı hitler']],
    rules: `<p><b>Oynanış:</b> 10 şarkı çalar. Her şarkı için 20 saniyen var; dört seçenekten çalan şarkıyı bul.</p>
      <p><b>Puan:</b> Doğru cevap 50 puan, ne kadar hızlı bilirsen 50 puana kadar ek puan.</p>
      <p><b>Ses:</b> Telefonun sessizdeyse şarkıyı duyamayabilirsin. Ses gelmezse “Dinlemek için dokun”a bas.</p>
      <p><b>Tek başına:</b> Arkadaşın yoksa boş yerlere bot oturur, hemen başlarsın.</p>`,
  });
}
