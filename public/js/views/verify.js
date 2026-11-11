import { icon } from '../icons.js';
import {
  api, esc, toast, state, compressImage, uploadFile, pickFile,
} from '../core.js';

// Selfie için ön kamerayı aç; desteklenmezse dosya seçiciye düş
async function captureSelfie() {
  if (!navigator.mediaDevices?.getUserMedia) return pickFile('image/*', 'user');
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'cam-ov';
    ov.innerHTML = `<video autoplay playsinline muted></video><div class="cam-bar"><button class="x" aria-label="Kapat">${icon('close')}</button><button class="shot" aria-label="Fotoğraf çek"></button><span style="width:44px"></span></div>`;
    document.body.append(ov);
    const v = ov.querySelector('video');
    let stream;
    const done = (f) => { stream?.getTracks().forEach((t) => t.stop()); ov.remove(); resolve(f); };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1080 } }, audio: false })
      .then((s) => { stream = s; v.srcObject = s; })
      .catch(() => { done(null); pickFile('image/*', 'user').then(resolve); });
    ov.querySelector('.x').onclick = () => done(null);
    ov.querySelector('.shot').onclick = () => {
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      const g = c.getContext('2d');
      g.translate(c.width, 0); g.scale(-1, 1); // ayna görüntüsü
      g.drawImage(v, 0, 0);
      c.toBlob((b) => done(b ? new File([b], 'selfie.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.88);
    };
  });
}

export default async function verify(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" data-back="#/me" aria-label="Geri">${icon('back')}</button><div class="center">Profil doğrulama</div><span class="ib"></span></header>
    <div class="verify"><div class="spinner"></div></div>`;
  const box = view.querySelector('.verify');
  const v = await api('/verify');
  const head = `<div class="vt-badge">${icon('verified')}</div>`;
  if (v.verified) {
    box.innerHTML = `${head}<h2>Profilin doğrulandı</h2><p class="muted">Adının yanındaki mavi tik, fotoğraflarının sana ait olduğunu gösterir.</p><a class="btn primary block" href="#/me">Profilime git</a>`;
    return null;
  }
  if (v.last?.status === 'pending') {
    box.innerHTML = `${head}<h2>İnceleniyor</h2><p class="muted">Selfien ekibimize ulaştı. Onaylandığında bildirim alacaksın; genellikle 24 saat içinde sonuçlanır.</p><a class="btn block" href="#/me">Tamam</a>`;
    return null;
  }
  let file = null;
  const paint = () => {
    box.innerHTML = `${head}<h2>Mavi tik al</h2>
      <p class="muted">Gerçek kişi olduğunu göstermek için aşağıdaki pozu vererek bir selfie çek. Selfie herkese açık olmaz, sadece yönetim ekibi profil fotoğraflarınla karşılaştırır.</p>
      ${v.last?.status === 'rejected' ? `<div class="note-box bad">Önceki başvurun onaylanmadı${v.last.note ? `: ${esc(v.last.note)}` : '.'} Yeni pozla tekrar dene.</div>` : ''}
      <div class="pose"><span class="em">${v.pose.em}</span><b>${esc(v.pose.text)}</b><small>Yüzün net görünsün, gözlük ve maske olmasın.</small></div>
      ${file ? `<img class="selfie" src="${URL.createObjectURL(file)}" alt="Selfie önizleme">` : ''}
      ${!state.me.photos?.length && String(state.me.avatar || '').includes('dicebear') ? '<div class="note-box">Önce profiline kendi fotoğrafını ekle; karşılaştırma için gerekli. <a class="link" href="#/edit">Profili düzenle</a></div>' : ''}
      <button class="btn ${file ? '' : 'primary'} block shoot">${icon('camera')} ${file ? 'Tekrar çek' : 'Selfie çek'}</button>
      ${file ? '<button class="btn primary block send">Doğrulamaya gönder</button>' : ''}`;
    box.querySelector('.shoot').onclick = async () => { const f = await captureSelfie(); if (f) { file = f; paint(); } };
    box.querySelector('.send')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        const up = await uploadFile(await compressImage(file, 1280));
        await api('/verify', { body: { selfie: up.url } });
        toast('Başvurun alındı.');
        verify(view);
      } catch (er) { toast(er.message); e.target.disabled = false; }
    });
  };
  paint();
  return null;
}
