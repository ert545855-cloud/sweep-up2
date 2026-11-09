// Dil seçeneği: arayüz metinleri ekrana gelirken seçilen dile çevrilir (Türkçe varsayılan).
// Sözlükte olmayan metin olduğu gibi kalır; kullanıcı içerikleri (gönderi, mesaj) çevrilmez.
export const LANGS = [['tr', 'Türkçe', '🇹🇷'], ['en', 'English', '🇬🇧']];
let lang = 'tr';
try { lang = localStorage.getItem('su_lang') || 'tr'; } catch {}
export const getLang = () => lang;
let dict = null; let pats = [];
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const SKIP = 'script,style,textarea,.mwrap .msg,.cap,.ctext,.bio,.tp-t,.post-h .u,.n,.u,.vw-h b,.pq-quote,.cmt,.stk,.ov,.genel .bubble,[data-noi18n]';

function tr(s) {
  if (!dict || !s) return null;
  const k = norm(s);
  if (!k || !/[a-zçğıöşü]/i.test(k)) return null;
  if (dict[k] != null) return dict[k];
  for (const [re, fn] of pats) { const m = k.match(re); if (m) return typeof fn === 'function' ? fn(...m) : k.replace(re, fn); }
  return null;
}
export const t = (s) => (lang === 'tr' ? s : tr(s) ?? s);

function fixText(n) {
  const v = n.nodeValue; const out = tr(v);
  if (out == null || out === norm(v)) return;
  const lead = v.match(/^\s*/)[0]; const trail = v.match(/\s*$/)[0];
  n.nodeValue = lead + out + trail;
}
function fixEl(el) {
  for (const a of ['placeholder', 'aria-label', 'title']) {
    const v = el.getAttribute?.(a); if (!v) continue;
    const out = tr(v); if (out != null) el.setAttribute(a, out);
  }
}
function walk(root) {
  if (root.nodeType === 3) { if (!root.parentElement?.closest(SKIP)) fixText(root); return; }
  if (root.nodeType !== 1 || root.closest?.(SKIP)) return;
  fixEl(root);
  root.querySelectorAll?.('[placeholder],[aria-label],[title]').forEach(fixEl);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  let n; while ((n = w.nextNode())) fixText(n);
}

export async function initI18n() {
  if (lang === 'tr') return;
  try {
    const m = await import(`/i18n/${lang}.js`);
    dict = m.default; pats = m.patterns || [];
  } catch (e) { console.warn('[i18n]', e); return; }
  document.documentElement.lang = lang;
  walk(document.body);
  const mo = new MutationObserver((list) => {
    for (const r of list) {
      if (r.type === 'characterData') { if (!r.target.parentElement?.closest(SKIP)) fixText(r.target); continue; }
      if (r.type === 'attributes') { fixEl(r.target); continue; }
      r.addedNodes.forEach(walk);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title'] });
  const orig = window.confirm.bind(window);
  window.confirm = (s) => orig(t(String(s)));
}
export function setLang(l) {
  try { localStorage.setItem('su_lang', l); } catch {}
  location.reload();
}
