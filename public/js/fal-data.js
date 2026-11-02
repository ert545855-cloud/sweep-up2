// Fal isteği formlarında kullanılan sabitler. Yorumları Falcı Teyze kendisi yazar.

export function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    rnd,
    some: (arr, k) => { const c = [...arr]; const out = []; while (out.length < k && c.length) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return out; },
  };
}

export const FAL_TYPES = {
  kahve: { em: '☕️', name: 'Kahve falı' },
  tarot: { em: '🔮', name: 'Tarot falı' },
  burc: { em: '✨', name: 'Burç yorumu' },
  uyum: { em: '💞', name: 'Aşk uyumu' },
};

// Büyük Arkana: [numara, ad, simge]
export const TAROT = [
  ['0', 'Deli', '🃏'], ['I', 'Büyücü', '🪄'], ['II', 'Azize', '🌙'], ['III', 'İmparatoriçe', '🌸'],
  ['IV', 'İmparator', '🏛️'], ['V', 'Aziz', '📜'], ['VI', 'Aşıklar', '💞'], ['VII', 'Savaş Arabası', '🏇'],
  ['VIII', 'Güç', '🦁'], ['IX', 'Ermiş', '🏮'], ['X', 'Kader Çarkı', '🎡'], ['XI', 'Adalet', '⚖️'],
  ['XII', 'Asılan Adam', '🙃'], ['XIII', 'Dönüşüm', '🦋'], ['XIV', 'Denge', '🏺'], ['XV', 'Şeytan', '⛓️'],
  ['XVI', 'Kule', '🗼'], ['XVII', 'Yıldız', '⭐'], ['XVIII', 'Ay', '🌕'], ['XIX', 'Güneş', '☀️'],
  ['XX', 'Mahkeme', '📯'], ['XXI', 'Dünya', '🌍'],
];
export const TAROT_POS = ['Geçmiş', 'Şimdi', 'Gelecek'];

export const ZODIAC = [
  ['koc', 'Koç', '♈', '21 Mart – 19 Nisan'], ['boga', 'Boğa', '♉', '20 Nisan – 20 Mayıs'],
  ['ikizler', 'İkizler', '♊', '21 Mayıs – 20 Haziran'], ['yengec', 'Yengeç', '♋', '21 Haziran – 22 Temmuz'],
  ['aslan', 'Aslan', '♌', '23 Temmuz – 22 Ağustos'], ['basak', 'Başak', '♍', '23 Ağustos – 22 Eylül'],
  ['terazi', 'Terazi', '♎', '23 Eylül – 22 Ekim'], ['akrep', 'Akrep', '♏', '23 Ekim – 21 Kasım'],
  ['yay', 'Yay', '♐', '22 Kasım – 21 Aralık'], ['oglak', 'Oğlak', '♑', '22 Aralık – 19 Ocak'],
  ['kova', 'Kova', '♒', '20 Ocak – 18 Şubat'], ['balik', 'Balık', '♓', '19 Şubat – 20 Mart'],
];
export const zodiacOf = (id) => ZODIAC.find((z) => z[0] === id) || null;
