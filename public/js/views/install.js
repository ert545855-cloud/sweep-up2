import { icon } from '../icons.js';
import { guideHtml, wireGuide, isIOS } from '../install.js';

export default function install(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" data-back="#/" aria-label="Geri">${icon('back')}</button><div class="center">Telefona yükle</div><span class="ib"></span></header>
    <div class="ins-page">
      <div class="ins-head big"><img src="/icons/icon-512.png" alt=""><div><b>SwipeUp’ı ${isIOS() ? 'iPhone’a' : 'telefonuna'} yükle</b><span>App Store gerekmez, ücretsiz. Uygulama gibi tam ekran açılır, bildirim alırsın ve her yeni sürümde kendini günceller.</span></div></div>
      <div class="ins-body">${guideHtml()}</div>
      <div class="ins-why"><div>${icon('bell')}<span>Mesaj, eşleşme ve arama bildirimleri</span></div><div>${icon('flame')}<span>Tam ekran, adres çubuğu yok</span></div><div>${icon('download')}<span>Yer kaplamaz, hep güncel</span></div></div>
    </div>`;
  wireGuide(view, () => install(view));
  return null;
}
