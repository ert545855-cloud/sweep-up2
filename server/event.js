// Süreli etkinlik temaları (ör. Cadılar Bayramı haftası).
// Panelden değiştirilebilir; panelde hiç ayar yoksa yerleşik takvim kullanılır.
// Bitiş zamanı geçince uygulama kendiliğinden normal temaya döner.
const EVENTS = {
  halloween: { name: 'Cadılar Bayramı' },
};

const DEFAULT = {
  kind: 'halloween',
  start: Date.parse('2026-11-03T00:00:00+03:00'),
  end: Date.parse('2026-11-10T00:00:00+03:00'),
};

function settings(store) {
  return store.get('settings', 'event') || { id: 'event', ...DEFAULT, builtIn: true };
}

// Uygulamaya gönderilen hâli: bitmemiş etkinlik (başlamamışsa istemci başlangıcı bekler)
function current(store) {
  const e = settings(store);
  if (!EVENTS[e.kind] || !(e.end > Date.now()) || !(e.end > e.start)) return null;
  return { id: e.kind, name: EVENTS[e.kind].name, start: e.start, end: e.end };
}

module.exports = { EVENTS, DEFAULT, settings, current };
