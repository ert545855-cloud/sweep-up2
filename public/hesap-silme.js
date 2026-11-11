// Hesap silme talebi formu (sayfa içi betik kullanılmaz: güvenlik kuralı)
const f = document.getElementById('f'); const m = document.getElementById('m');
f.addEventListener('submit', async (e) => {
  e.preventDefault(); const b = f.querySelector('button'); m.className = 'msg'; m.textContent = '';
  const body = { username: f.username.value.trim(), contact: f.contact.value.trim(), reason: f.reason.value.trim() };
  if (body.username.length < 2 || body.contact.length < 5) { m.className = 'msg err'; m.textContent = 'Kullanıcı adını ve sana ulaşabileceğimiz bir telefon ya da e-posta yaz.'; return; }
  b.disabled = true;
  try {
    const r = await fetch('/api/public/delete-request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Talep gönderilemedi. Biraz sonra tekrar dene.');
    f.reset(); m.className = 'msg ok'; m.textContent = 'Talebin alındı. Bu kullanıcı adıyla bir hesap varsa destek ekibi seninle iletişime geçecek.';
  } catch (er) { m.className = 'msg err'; m.textContent = er.message; }
  b.disabled = false;
});
