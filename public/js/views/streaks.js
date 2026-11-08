// Seriler: günlük giriş serisi ve sohbet serileri (🔥)
import { icon } from '../icons.js';
import { api, esc, toast, state, avatar, nm, emit, on, needCoins } from '../core.js';

export default async function streaks(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button><div class="center">Seriler</div><a class="ib soft" href="#/gorevler" aria-label="Görevler">${icon('check')}</a></header><div class="srs"><div class="spinner"></div></div>`;
  const box = view.querySelector('.srs');
  let d;
  const msList = (ms, cur) => Object.entries(ms).map(([k, v]) => [+k, v]).sort((a, b) => a[0] - b[0]).map(([k, v]) => `<span class="stk-ms ${cur >= k ? 'done' : ''}"><b>${k}. gün</b><small>${icon('coin')} ${v}</small></span>`).join('');
  const paint = () => {
    const l = d.login;
    box.innerHTML = `<section class="stk-hero">
        <div class="stk-flame ${l.today ? 'on' : ''}"><span>🔥</span><b>${l.count}</b></div>
        <div class="grow"><b>${l.count ? `${l.count} günlük giriş serin` : 'Serine bugün başla'}</b>
          <small>${l.today ? 'Bugünü kaptın! Yarın da uğra, seri büyüsün.' : 'Her gün uygulamaya uğra, serin büyüsün.'} En uzun serin: <b>${l.best}</b> gün.</small></div>
      </section>
      <div class="stk-row">${msList(d.loginMilestones, l.count)}</div>
      <div class="stk-frz"><span class="em">🧊</span><div class="grow"><b>Seri koruyucu · ${l.freezes}/${d.maxFreezes}</b><small>Bir gün giremezsen serin bozulmaz. Tanesi ${d.freezeCoins} jeton.</small></div>
        <button class="btn sm ${l.freezes >= d.maxFreezes ? '' : 'primary'} frz" ${l.freezes >= d.maxFreezes ? 'disabled' : ''}>${icon('coin')} Al</button></div>
      <div class="section-t"><span>Sohbet serilerin</span></div>
      <p class="muted stk-help">Bir sohbette ikiniz de her gün en az bir mesaj yazınca yanınızda 🔥 sayaç büyür. Bir gün atlarsanız seri sıfırlanır. ${Object.entries(d.milestones).slice(0, 3).map(([k, v]) => `${k}. günde ${v}`).join(', ')} jeton ikinize de hediye!</p>
      ${d.chats.length ? d.chats.map((c) => `<a class="list-item stk-it" href="#/chat/${esc(c.chatId)}">${avatar(c.other, 48, { dot: false })}
          <div class="grow"><div class="b">${nm(c.other)}</div><div class="sub">${c.done ? '✅ Bugün ikiniz de yazdınız' : c.iWrote ? `⏳ Sen yazdın, ${esc(c.other.name.split(' ')[0])} bekleniyor` : '⏳ Bugün henüz yazmadın, seriyi koru!'}</div></div>
          <span class="streak-chip big ${c.done ? '' : 'risk'}">🔥 ${c.count}</span></a>`).join('')
    : `<div class="empty" style="padding:24px 16px"><div class="big">🔥</div><h2>Henüz serin yok</h2>Eşleştiğin biriyle iki gün üst üste yazışınca ilk serin başlar.<p><a class="btn primary" href="#/chats">Mesajlara git</a></p></div>`}
      <p class="muted" style="font-size:12.5px;margin:16px 16px 30px">Günler Türkiye saatiyle gece 00:00’da değişir. Akşam saatlerinde bitmek üzere olan serilerin için sana hatırlatma göndeririz.</p>`;
  };
  const load = async () => { d = await api('/streaks'); paint(); };
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('.frz'); if (!b) return;
    if (!confirm(`Seri koruyucu ${d.freezeCoins} jeton. Alınsın mı?`)) return;
    b.disabled = true;
    try { const r = await api('/streaks/freeze', { body: {} }); d.login = r.login; state.me.coins = r.coins; emit('me', state.me); toast('🧊 Seri koruyucu eklendi.'); paint(); } catch (er) { if (/jeton/i.test(er.message)) needCoins(er.message); else toast(er.message); b.disabled = false; }
  });
  await load();
  const off = on('streak', () => load().catch(() => {}));
  return off;
}
