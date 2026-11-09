// Bilgi Yarışması (tek başına botlarla ya da 8 kişiye kadar): 10 soru, hızlı ve doğru cevap kazanır. Soru bankası elle hazırlanmıştır.
const BANK = require('../quiz-bank');
const quiz = require('../quizcore');

const CATS = [['karisik', 'Karışık'], ['genel', 'Genel kültür'], ['tarih', 'Tarih'], ['cografya', 'Coğrafya'], ['bilim', 'Bilim'], ['spor', 'Spor'], ['sanat', 'Sanat ve edebiyat'], ['ekran', 'Sinema ve müzik']];
const ALL = BANK.map(([cat, text, ...opts], i) => ({ id: `b${i}`, cat, text, opts }));

module.exports = (kit) => quiz(kit, {
  key: 'bilgi', name: 'Bilgi Yarışması', emoji: '🧠', cats: CATS, count: 10, qMs: 15000, preMs: 2200, aMs: 4000,
  botMin: 3000, botMax: 12000, botAcc: 0.55, joker: true,
  load(t, cat, used) {
    let pool = ALL.filter((q) => cat === 'karisik' || q.cat === cat);
    let fresh = pool.filter((q) => !used.has(q.id));
    if (fresh.length < 10) { pool.forEach((q) => used.delete(q.id)); fresh = pool; }
    return kit.shuffle(fresh.slice()).slice(0, 10).map((q) => {
      const order = kit.shuffle([0, 1, 2, 3]);
      return { id: q.id, text: q.text, opts: order.map((i) => ({ t: q.opts[i] })), correct: order.indexOf(0), info: { cat: CATS.find(([k]) => k === q.cat)?.[1] } };
    });
  },
});
