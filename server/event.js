// Süreli etkinlik temaları ve takvimi (Cadılar Bayramı, Yılbaşı, Sevgililer Günü).
// Panelden düzenlenebilir; panelde hiç kayıt yoksa yerleşik takvim kullanılır.
// Bir etkinlik bitince sıradaki başlar; arada uygulama normal temaya döner.
const EVENTS = {
  halloween: { name: 'Cadılar Bayramı' },
  yilbasi: { name: 'Yılbaşı' },
  sevgililer: { name: 'Sevgililer Günü' },
};

const tr = (s) => Date.parse(`${s}+03:00`);
const DEFAULT_LIST = [
  { kind: 'halloween', start: tr('2026-11-03T00:00:00'), end: tr('2026-11-10T00:00:00') },
  { kind: 'yilbasi', start: tr('2026-11-15T00:00:00'), end: tr('2027-01-03T00:00:00') },
  { kind: 'sevgililer', start: tr('2027-02-07T00:00:00'), end: tr('2027-02-16T00:00:00') },
];

const clean = (list) => (Array.isArray(list) ? list : [])
  .map((e) => ({ kind: String(e.kind || ''), start: +e.start || 0, end: +e.end || 0 }))
  .filter((e) => EVENTS[e.kind] && e.end > e.start)
  .sort((a, b) => a.start - b.start)
  .slice(0, 30);

// Takvim (eski tek etkinlik kaydını da okur)
function list(store) {
  const doc = store.get('settings', 'event');
  if (!doc) return { list: DEFAULT_LIST, builtIn: true };
  if (Array.isArray(doc.list)) return { list: clean(doc.list), builtIn: false };
  return { list: clean(doc.kind && doc.kind !== 'none' ? [doc] : []), builtIn: false };
}

const out = (e) => ({ id: e.kind, name: EVENTS[e.kind].name, start: e.start, end: e.end });

// Uygulamaya gönderilen: şu an açık olan; yoksa sıradaki (istemci başlangıcı bekler)
function current(store, at = Date.now()) {
  const l = list(store).list;
  const live = l.find((e) => e.start <= at && at < e.end);
  if (live) return out(live);
  const next = l.find((e) => e.start > at);
  return next ? out(next) : null;
}

module.exports = { EVENTS, DEFAULT_LIST, list, clean, current };
