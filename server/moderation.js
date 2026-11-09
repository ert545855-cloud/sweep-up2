// Basit otomatik moderasyon: herkese açık metinlerde küfürü maskeler,
// mesajlarda hakaret/tehdit içeriğini yönetim paneline bildirir.

// Kök kelimeler (Türkçe ekler alabilir). "p" = kelimenin başında aranır, "w" = tam kelime.
const PROFANITY = [
  ['amk', 'w'], ['aq', 'w'], ['amq', 'w'], ['amına', 'p'], ['amina', 'p'], ['amcık', 'p'], ['amcik', 'p'],
  ['orospu', 'p'], ['oç', 'w'], ['piç', 'p'], ['siktir', 'p'], ['sikerim', 'p'], ['sikeyim', 'p'], ['sikik', 'p'], ['siktiğim', 'p'],
  ['yarrak', 'p'], ['yarak', 'w'], ['götveren', 'p'], ['göt', 'w'], ['pezevenk', 'p'], ['kahpe', 'p'], ['ibne', 'p'], ['puşt', 'p'],
  ['yavşak', 'p'], ['şerefsiz', 'p'], ['gavat', 'p'], ['kaltak', 'p'], ['sürtük', 'p'], ['dürzü', 'p'], ['ananı', 'p'], ['bacını', 'p'],
];
const INSULT = [['gerizekalı', 'p'], ['salak', 'p'], ['aptal', 'p'], ['mal', 'w'], ['dangalak', 'p'], ['beyinsiz', 'p'], ['ezik', 'w']];
const THREAT = [
  'öldürürüm', 'öldüreceğim', 'geberteceğim', 'gebertirim', 'seni bulurum', 'evini biliyorum', 'canını yakarım',
  'tecavüz', 'bıçaklarım', 'vururum', 'kafanı keserim', 'intikam alacağım', 'adresini biliyorum',
];

const L = 'a-zçğıöşü0-9';
const norm = (s) => s.toLocaleLowerCase('tr-TR')
  .replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/0/g, 'o').replace(/4|@/g, 'a').replace(/\$|5/g, 's').replace(/7/g, 't');
const build = (list) => list.map(([w, mode]) => new RegExp(`(^|[^${L}])(${w}${mode === 'p' ? `[${L}]*` : ''})(?=$|[^${L}])`, 'giu'));
const PROF_RE = build(PROFANITY);
const INS_RE = build(INSULT);

function findSpans(text, res) {
  const n = norm(text);
  const spans = [];
  for (const re of res) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(n))) { spans.push([m.index + m[1].length, m.index + m[1].length + m[2].length]); if (!m[0]) re.lastIndex++; }
  }
  return spans;
}

// Herkese açık metinler (yorum, açıklama, biyografi, canlı yorum) için
function mask(text) {
  if (!text) return text;
  const spans = findSpans(text, PROF_RE);
  if (!spans.length) return text;
  const chars = [...text];
  // norm() uzunluğu korur (tek karakter eşlemeleri), bu yüzden indeksler aynı
  spans.forEach(([a, b]) => { for (let i = a + 1; i < b && i < chars.length; i++) chars[i] = '*'; });
  return chars.join('');
}

// Mesajlar için: işaretlenmesi gerekiyorsa sebep döndürür
function flag(text) {
  if (!text) return null;
  const n = norm(text);
  const threat = THREAT.find((t) => n.includes(t));
  if (threat) return { level: 'high', reason: 'Tehdit içeriği', word: threat };
  const prof = findSpans(text, PROF_RE).length;
  const ins = findSpans(text, INS_RE).length;
  if (prof >= 2 || (prof && ins)) return { level: 'medium', reason: 'Ağır küfür / hakaret' };
  return null;
}

// Gönderilmeden önce "Emin misin?" uyarısı için: tek bir küfür/hakaret bile yeterli
function warn(text) {
  if (!text) return null;
  const f = flag(text);
  if (f) return f;
  const n = norm(text);
  const prof = findSpans(text, PROF_RE).length;
  const ins = findSpans(text, INS_RE).length;
  if (prof || ins) return { level: 'low', reason: prof ? 'Küfür içeriyor' : 'Hakaret içeriyor' };
  if (THREAT.some((t) => n.includes(t))) return { level: 'high', reason: 'Tehdit içeriği' };
  return null;
}

module.exports = { mask, flag, warn };
