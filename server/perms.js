// Yönetici yetkileri: Sahip her şeyi yapar; Moderatör'e yetkiler tek tek verilir.
const PERMS = [
  ['users', 'Kullanıcıları görüntüle', 'Topluluk'],
  ['users_ban', 'Yasakla, askıya al, uyar, yasak kaldır', 'Topluluk'],
  ['users_edit', 'Jeton/üyelik tanımla, şifre sıfırla, rol ver, hesap sil', 'Topluluk'],
  ['reports', 'Şikayetler', 'Topluluk'],
  ['appeals', 'İtirazlar', 'Topluluk'],
  ['flags', 'Moderasyon (otomatik tespitler)', 'Topluluk'],
  ['verify', 'Profil doğrulama', 'Topluluk'],
  ['support', 'Destek talepleri', 'Topluluk'],
  ['tags', 'Özel etiketler', 'Topluluk'],
  ['content', 'İçerik ve medya (silme dahil)', 'Topluluk'],
  ['orders', 'Siparişler ve ödeme onayı', 'Para'],
  ['payouts', 'Kazanç ödemeleri', 'Para'],
  ['market', 'Store', 'Para'],
  ['promos', 'Reklamlar', 'Para'],
  ['erp', 'Şirket yönetimi (muhasebe, fatura, personel)', 'Para'],
  ['fal', 'Fal ve yapay zeka', 'Uygulama'],
  ['announce', 'Bildirim gönder', 'Uygulama'],
  ['quests', 'Görevler ve hediye çarkı', 'Uygulama'],
  ['growth', 'Büyüme panosu', 'Uygulama'],
  ['settings', 'Ayarlar (fiyatlar, etkinlikler, odalar)', 'Uygulama'],
  ['maintenance', 'Bakım modu', 'Uygulama'],
  ['notes', 'Notlar', 'Panel'],
  ['audit', 'İşlem kaydı', 'Panel'],
  ['database', 'Veritabanı ve yedek', 'Panel'],
];
const ALL = PERMS.map((p) => p[0]);
const MOD_DEFAULT = ['users', 'users_ban', 'reports', 'appeals', 'flags', 'verify', 'support', 'content', 'notes'];
// eski "admin" rolündekiler: sahibe özel olmayan her şey
const LEGACY = ALL.filter((p) => !['erp', 'database', 'maintenance', 'settings'].includes(p));

const PREFIX = {
  admins: 'owner', announcements: 'announce', appeals: 'appeals', audit: 'audit', content: 'content', media: 'content', database: 'database',
  economy: 'settings', event: 'settings', legal: 'settings', rooms: 'settings', fal: 'fal', falai: 'fal', flags: 'flags', growth: 'growth',
  ledger: 'erp', erp: 'erp', maintenance: 'maintenance', market: 'market', notes: 'notes', orders: 'orders', payouts: 'payouts', promos: 'promos',
  quests: 'quests', wheel: 'quests', reports: 'reports', support: 'support', tags: 'tags', verifications: 'verify',
};
const FREE = new Set(['login', 'me', 'overview', 'push']);

// İstek için gereken yetki (null: herkes)
function needPerm(method, url) {
  const parts = String(url || '').split('?')[0].replace(/^\/api\/admin\/?/, '').split('/');
  const head = parts[0] || '';
  if (FREE.has(head)) return null;
  if (head === 'admins' && method === 'GET') return null;
  if (head === 'users') {
    if (method === 'GET') return 'users';
    const act = parts[2] || '';
    if (['ban', 'unban', 'warn'].includes(act)) return 'users_ban';
    if (act === 'settle') return 'payouts';
    if (act === 'tags') return 'tags';
    return 'users_edit';
  }
  return PREFIX[head] || 'owner';
}
const permsOf = (a) => {
  if (!a) return [];
  if (a.role === 'owner') return [...ALL, 'owner'];
  if (Array.isArray(a.perms)) return a.perms.filter((p) => ALL.includes(p));
  return a.role === 'moderator' ? MOD_DEFAULT : LEGACY;
};
module.exports = { PERMS, ALL, MOD_DEFAULT, needPerm, permsOf };
