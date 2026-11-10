// Uygulama içi gezinme sırası. Bir sayfadan "çıkarken" (ör. oyun masasından kalkınca) yeni geçmiş kaydı
// eklemek yerine önceki sayfaya dönülür; böylece geri tuşu az önce çıkılan sayfaya dönüp döngüye girmez.
let cur = 0; const hashes = []; let replacing = false; let ready = false;
const here = () => location.hash || '#/';

function sync() {
  const st = history.state;
  if (st && typeof st.navI === 'number' && !replacing) cur = st.navI; // geri / ileri ile gelinen kayıt
  else {
    if (!replacing) cur += 1; // yeni kayıt
    try { history.replaceState({ ...(st && typeof st === 'object' ? st : {}), navI: cur }, ''); } catch { /* yoksay */ }
    hashes.length = cur;
  }
  replacing = false; hashes[cur] = here();
}

export function initNav() {
  if (ready) return; ready = true;
  const st = history.state;
  if (st && typeof st.navI === 'number') cur = st.navI;
  else { cur = 0; try { history.replaceState({ ...(st && typeof st === 'object' ? st : {}), navI: 0 }, ''); } catch { /* yoksay */ } }
  hashes[cur] = here();
  window.addEventListener('hashchange', sync);
}

// Bu sayfadan çık ve hedefe git: hedef zaten bir önceki sayfaysa geri dön, değilse bu kaydın yerine geç
export function leaveTo(target) {
  if (here() === target) return;
  if (ready && cur > 0 && hashes[cur - 1] === target) { history.back(); return; }
  replacing = true; location.replace(target);
}
