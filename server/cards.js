// İskambil yardımcıları (Pişti, Batak)
const SUITS = ['S', 'H', 'D', 'C']; // maça, kupa, karo, sinek
const SUIT_TR = { S: 'maça', H: 'kupa', D: 'karo', C: 'sinek' };
const RANK_TR = { 1: 'As', 11: 'Vale', 12: 'Kız', 13: 'Papaz' };
function deck() { const d = []; for (const s of SUITS) for (let r = 1; r <= 13; r++) d.push({ id: `${s}${r}`, s, r }); return d; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const name = (c) => `${SUIT_TR[c.s]} ${RANK_TR[c.r] || c.r}`;
const hi = (r) => (r === 1 ? 14 : r); // As en büyük
const sortHand = (h, trump) => h.sort((a, b) => (a.s === b.s ? hi(a.r) - hi(b.r) : (a.s === trump) - (b.s === trump) || SUITS.indexOf(a.s) - SUITS.indexOf(b.s)));
module.exports = { SUITS, SUIT_TR, deck, shuffle, name, hi, sortHand };
