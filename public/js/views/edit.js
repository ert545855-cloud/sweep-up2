import { icon } from '../icons.js';
import {
  state, api, esc, toast, pickFile, compressImage, uploadFile,
} from '../core.js';

export default function edit(view) {
  const me = state.me;
  let avatarUrl = me.avatar;
  let photos = [...(me.photos || [])];
  const first = !me.bio && !me.age && !photos.length;

  view.innerHTML = `<header class="topbar bordered">
      <button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/me')" aria-label="Geri">${icon('back')}</button>
      <div class="center">${first ? 'Profilini oluştur' : 'Profili düzenle'}</div>
      <button class="link save" style="padding:0 6px">Kaydet</button>
    </header>
    <form class="form">
      <div class="avatar-edit"><img class="av" src="${esc(avatarUrl)}" alt=""><button type="button" class="link av-btn">Profil fotoğrafını değiştir</button></div>
      ${first ? '<p class="muted" style="margin:0;text-align:center">Kaydırma kartında görünecek bilgileri doldur; eşleşme şansın artar.</p>' : ''}
      <label>Ad<input class="field" name="name" value="${esc(me.name)}" maxlength="40"></label>
      <label>Kullanıcı adı<input class="field" name="username" value="${esc(me.username)}" autocapitalize="none" maxlength="24"></label>
      <label>Biyografi<textarea class="field" name="bio" maxlength="150" rows="3" placeholder="Kendinden kısaca bahset">${esc(me.bio || '')}</textarea></label>
      <div class="two">
        <label>Yaş<input class="field" name="age" type="number" min="18" max="99" inputmode="numeric" value="${esc(me.age || '')}" ${me.birthdate ? 'readonly title="Doğum tarihinden hesaplanır"' : ''}></label>
        <label>Şehir<input class="field" name="city" value="${esc(me.city || '')}" maxlength="40"></label>
      </div>
      <div class="two">
        <label>Cinsiyet<select class="field" name="gender">
          <option value="">Belirtme</option><option value="k" ${me.gender === 'k' ? 'selected' : ''}>Kadın</option><option value="e" ${me.gender === 'e' ? 'selected' : ''}>Erkek</option><option value="d" ${me.gender === 'd' ? 'selected' : ''}>Diğer</option></select></label>
        <label>Kaydırmada göster<select class="field" name="lookingFor">
          <option value="all">Herkes</option><option value="k" ${me.lookingFor === 'k' ? 'selected' : ''}>Kadınlar</option><option value="e" ${me.lookingFor === 'e' ? 'selected' : ''}>Erkekler</option></select></label>
      </div>
      <label>İlgi alanları<input class="field" name="interests" value="${esc((me.interests || []).join(', '))}" placeholder="Müzik, Kahve, Seyahat"></label>
      <div><div class="b" style="font-size:13px;margin-bottom:6px">Kaydırma fotoğrafları</div><div class="photos-edit"></div></div>
      <button class="btn primary block">Kaydet</button>
    </form>`;

  const f = view.querySelector('form');
  const pe = view.querySelector('.photos-edit');
  const paintPhotos = () => {
    pe.innerHTML = photos.map((p, i) => `<div><img src="${esc(p)}" alt=""><button type="button" class="rm" data-i="${i}" aria-label="Fotoğrafı kaldır">${icon('close')}</button></div>`).join('')
      + (photos.length < 6 ? `<button type="button" class="add-ph" aria-label="Fotoğraf ekle">${icon('plus')}</button>` : '');
  };
  paintPhotos();
  pe.onclick = async (e) => {
    const rm = e.target.closest('.rm');
    if (rm) { photos.splice(+rm.dataset.i, 1); paintPhotos(); return; }
    if (e.target.closest('.add-ph')) {
      const file = await pickFile('image/*'); if (!file) return;
      try { const up = await uploadFile(await compressImage(file)); photos.push(up.url); paintPhotos(); } catch (er) { toast(er.message); }
    }
  };
  view.querySelector('.av-btn').onclick = async () => {
    const file = await pickFile('image/*'); if (!file) return;
    try {
      const up = await uploadFile(await compressImage(file, 640));
      avatarUrl = up.url; view.querySelector('.avatar-edit img').src = avatarUrl;
    } catch (er) { toast(er.message); }
  };

  const save = async (e) => {
    e?.preventDefault();
    try {
      const u = await api('/me', {
        method: 'PATCH',
        body: {
          name: f.name.value, username: f.username.value, bio: f.bio.value, ...(me.birthdate ? {} : { age: f.age.value || null }),
          city: f.city.value, gender: f.gender.value || null, lookingFor: f.lookingFor.value,
          interests: f.interests.value.split(',').map((s) => s.trim()).filter(Boolean),
          photos, avatar: avatarUrl,
        },
      });
      Object.assign(state.me, u);
      toast('Profil kaydedildi.');
      location.hash = first ? '#/swipe' : '#/me';
    } catch (er) { toast(er.message); }
  };
  f.onsubmit = save;
  view.querySelector('.save').onclick = save;
  return null;
}
