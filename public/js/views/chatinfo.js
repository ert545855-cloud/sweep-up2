import { icon } from '../icons.js';
import {
  state, api, esc, avatar, toast, blockUser, unmatchUser, reportUser, lastSeen, sheet,
} from '../core.js';
import { startCall } from '../calls.js';
import { pickPeople } from './groupnew.js';

export default async function chatinfo(view, chatId) {
  const d = await api(`/chats/${chatId}`);
  const back = `#/chat/${chatId}`;
  if (!d.isGroup) {
    const u = await api(`/users/${d.other.id}`);
    view.innerHTML = `<header class="topbar"><a class="ib" href="${back}" aria-label="Geri">${icon('back')}</a><div class="center">Kişi bilgisi</div><span class="ib"></span></header>
      <section class="profile-hero"><div class="av-wrap"><img class="av" src="${esc(u.avatar)}" alt=""></div><h2>${esc(u.name)}</h2><div class="handle">@${esc(u.username)} · ${esc(lastSeen(u))}</div>${u.bio ? `<p class="bio">${esc(u.bio)}</p>` : ''}</section>
      <div class="profile-btns" style="margin-top:14px"><button class="btn vc">${icon('phone')} Sesli</button><button class="btn vv">${icon('video')} Görüntülü</button><a class="btn" href="#/u/${esc(u.username)}">${icon('person')} Profil</a></div>
      <div class="group">
        <button class="it clr">${icon('trash')}<span class="grow">Sohbeti temizle<div class="sub">Mesajlar sadece senden silinir</div></span></button>
        ${u.matched ? `<button class="it um">${icon('x')}<span class="grow">Eşleşmeyi kaldır<div class="sub">Sohbetiniz ikiniz için de silinir</div></span></button>` : ''}
      </div>
      <div class="group">
        <button class="it danger bl">${icon('block')}Engelle</button>
        <button class="it danger rp">${icon('flag')}Şikayet et</button>
      </div>`;
    view.querySelector('.vc').onclick = () => startCall(chatId, d.other, false);
    view.querySelector('.vv').onclick = () => startCall(chatId, d.other, true);
    view.querySelector('.clr').onclick = async () => {
      if (!confirm('Bu sohbetteki tüm mesajlar senin için silinsin mi?')) return;
      await api(`/chats/${chatId}`, { method: 'DELETE' }); toast('Sohbet temizlendi.'); location.hash = back;
    };
    view.querySelector('.um')?.addEventListener('click', async () => { if (await unmatchUser(u)) location.hash = '#/chats'; });
    view.querySelector('.bl').onclick = async () => { if (await blockUser(u)) location.hash = '#/chats'; };
    view.querySelector('.rp').onclick = () => reportUser(u);
    return null;
  }

  const isAdmin = d.admins.includes(state.me.id);
  const paint = (g) => {
    view.innerHTML = `<header class="topbar"><a class="ib" href="${back}" aria-label="Geri">${icon('back')}</a><div class="center">Grup bilgisi</div><span class="ib"></span></header>
      <section class="profile-hero"><div class="av-wrap"><img class="av" src="${esc(g.other.avatar)}" alt=""></div><h2>${esc(g.name)}</h2><div class="handle">${g.members.length} üye</div>
        <button class="btn sm ren" style="margin-top:8px">${icon('edit')} Adı değiştir</button></section>
      <div class="section-t"><span>Üyeler</span>${isAdmin || true ? '<button class="add">Kişi ekle</button>' : ''}</div>
      <div class="ml">${g.members.map((m) => `<div class="list-item">${avatar(m, 44)}<a class="grow" href="#/u/${esc(m.username)}"><div class="b">${esc(m.id === state.me.id ? 'Sen' : m.name)}</div><div class="sub">${g.admins.includes(m.id) ? 'Yönetici · ' : ''}@${esc(m.username)}</div></a>
        ${isAdmin && m.id !== state.me.id ? `<button class="btn sm outline rm" data-id="${esc(m.id)}">Çıkar</button>` : ''}</div>`).join('')}</div>
      <div class="group" style="margin-top:16px"><button class="it danger lv">${icon('logout')}Gruptan ayrıl</button></div>`;
    view.querySelector('.ren').onclick = () => {
      sheet('Grup adı', `<form class="form"><input class="field" name="n" value="${esc(g.name)}" maxlength="50"><button class="btn primary block">Kaydet</button></form>`, {
        onMount(sh, close) {
          const f = sh.querySelector('form');
          f.onsubmit = async (e) => { e.preventDefault(); try { paint(await api(`/groups/${chatId}`, { method: 'PATCH', body: { name: f.n.value } })); close(); } catch (er) { toast(er.message); } };
        },
      });
    };
    view.querySelector('.add').onclick = () => pickPeople('Gruba ekle', new Set(g.members.map((m) => m.id)), async (ids) => {
      try { paint(await api(`/groups/${chatId}/members`, { body: { userIds: ids } })); toast('Eklendi.'); } catch (er) { toast(er.message); }
    });
    view.querySelectorAll('.rm').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('Bu kişi gruptan çıkarılsın mı?')) return;
        await api(`/groups/${chatId}/members/${b.dataset.id}`, { method: 'DELETE' });
        paint(await api(`/chats/${chatId}`));
      };
    });
    view.querySelector('.lv').onclick = async () => {
      if (!confirm('Gruptan ayrılmak istiyor musun?')) return;
      await api(`/groups/${chatId}/members/${state.me.id}`, { method: 'DELETE' });
      location.hash = '#/chats';
    };
  };
  paint(d);
  return null;
}
