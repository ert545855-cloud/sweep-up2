import { icon } from '../icons.js';
import { esc, state, sheet } from '../core.js';

const UPDATED = '2 Kasım 2026';

// Yönetim panelinden girilen iletişim bilgileri (/api/config → legal)
function contact() {
  const l = state.config?.legal || {};
  const who = l.company ? esc(l.company) : 'SwipeUp';
  const mail = l.email ? `<a class="link" href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : 'uygulama içindeki şikayet/itiraz formları';
  const addr = l.address ? `, adres: ${esc(l.address)}` : '';
  return { who, mail, addr };
}

export const DOCS = {
  gizlilik: {
    title: 'Gizlilik politikası',
    body: () => {
      const c = contact();
      return `
<p>Bu politika, ${c.who} (“SwipeUp”, “biz”) olarak SwipeUp uygulamasını kullanırken hangi kişisel verilerini neden ve nasıl işlediğimizi anlatır.</p>
<h3>Topladığımız veriler</h3>
<ul>
<li><b>Hesap bilgileri:</b> kullanıcı adı, ad, doğum tarihi, (isteğe bağlı) e-posta, şifrenin geri döndürülemez özeti.</li>
<li><b>Profil bilgileri:</b> fotoğraflar, biyografi, yaş, şehir, cinsiyet, ilgi alanları, burç.</li>
<li><b>Paylaştıkların:</b> gönderiler, vitrin videoları, hikayeler, yorumlar, beğeniler, mesajlar, sesli mesajlar, fal istekleri.</li>
<li><b>Konum:</b> yalnızca izin verirsen, yaklaşık 1 km hassasiyetle yuvarlanmış olarak; sohbette paylaştığın konum o mesajda saklanır.</li>
<li><b>Doğrulama selfiesi:</b> mavi tik için gönderdiğin fotoğraf; yalnızca yönetim ekibi inceler.</li>
<li><b>Ödeme kayıtları:</b> sipariş kodu, tutar, havale/EFT gönderen adı. Kart bilgisi toplamayız.</li>
<li><b>Teknik veriler:</b> IP adresi ve tarayıcıda oluşturulan rastgele bir cihaz kimliği (spam ve sahte hesapları önlemek için), bildirim aboneliği, son görülme zamanı, uygulamayı hangi gün kullandığın (istatistik için).</li>
</ul>
<h3>Neden işliyoruz</h3>
<ul>
<li>Hesabını oluşturmak ve uygulamanın temel özelliklerini (eşleşme, mesajlaşma, akış, canlı yayın, arama) sunmak.</li>
<li>18 yaş sınırını uygulamak, sahte hesapları ve dolandırıcılığı önlemek.</li>
<li>Topluluk güvenliği: şikayetleri incelemek, hakaret ve tehdit içeren mesajları otomatik olarak işaretleyip yönetim ekibine iletmek.</li>
<li>Satın aldığın jeton ve üyelikleri tanımlamak, yasal muhasebe yükümlülüklerini yerine getirmek.</li>
<li>Sana bildirim göndermek (kapatabilirsin).</li>
</ul>
<h3>Kimler görebilir</h3>
<p>Profilin ve herkese açık paylaşımların diğer üyelere görünür. Gizli hesap açarsan gönderi ve hikayelerini sadece onayladığın takipçiler görür. Mesajların yalnızca sohbetteki kişilere iletilir; yönetim ekibi yalnızca bir şikayet ya da otomatik moderasyon kaydı olduğunda ilgili mesajı görebilir. Verilerini satmayız ve reklam amacıyla üçüncü kişilerle paylaşmayız.</p>
<h3>Hizmet sağlayıcılar</h3>
<p>Uygulama bulut sunucularda barındırılır; anlık bildirimler tarayıcı/işletim sistemi bildirim servisleri üzerinden, sesli ve görüntülü aramalar ise gerektiğinde bir aktarma (TURN) sunucusu üzerinden iletilir. Fal isteklerinde yorum hazırlamak için fal notun, burç ve kart bilgilerin ve fincan fotoğrafların Google’ın yapay zeka hizmetine (Gemini API) gönderilir; adın, kullanıcı adın ve iletişim bilgilerin gönderilmez. Bu sağlayıcılar yurt dışında bulunabilir.</p>
<h3>Saklama süresi</h3>
<p>Verilerini hesabın açık olduğu sürece saklarız. Hikayeler 24 saat sonra, kaybolan mesajlar seçtiğin süre sonunda silinir. Hesabını sildiğinde profilin, paylaşımların, eşleşmelerin ve mesajların kalıcı olarak silinir; yasal olarak saklamamız gereken ödeme kayıtları ilgili süre boyunca tutulur.</p>
<h3>Hakların</h3>
<p>Ayarlar bölümünden verilerinin bir kopyasını indirebilir, profilini düzenleyebilir ve hesabını silebilirsin. Diğer talepler için: ${c.mail}${c.addr}.</p>
<p>Ayrıntılar için <a class="link" href="#/legal/kvkk">KVKK aydınlatma metni</a>ne bakabilirsin.</p>`;
    },
  },
  kosullar: {
    title: 'Kullanım koşulları',
    body: () => `
<p>SwipeUp’ı kullanarak aşağıdaki koşulları kabul etmiş olursun.</p>
<h3>1. Yaş sınırı</h3>
<p>SwipeUp yalnızca <b>18 yaş ve üzeri</b> kişiler içindir. Kayıt sırasında doğru doğum tarihi vermek zorundasın. 18 yaşından küçük olduğu anlaşılan hesaplar kapatılır.</p>
<h3>2. Hesabın</h3>
<p>Hesabının güvenliğinden sen sorumlusun. Başkasının kimliğine bürünmek, sahte profil açmak ve hesabını başkasına devretmek yasaktır.</p>
<h3>3. İçerik</h3>
<p>Paylaştığın içeriğin sorumluluğu sana aittir. Paylaştığın içeriğin hakkı sende kalır; uygulamada gösterilebilmesi için SwipeUp’a sınırlı, ücretsiz bir kullanım izni vermiş olursun. Telif hakkı sana ait olmayan müzik, fotoğraf ve videoları izinsiz paylaşma.</p>
<h3>4. Yasaklı davranışlar</h3>
<p>Taciz, tehdit, nefret söylemi, çıplaklık ve cinsel içerik, şiddet, dolandırıcılık, spam, reşit olmayanlarla ilgili her türlü uygunsuz içerik ve yasa dışı faaliyetler yasaktır. Ayrıntılar <a class="link" href="#/legal/kurallar">topluluk kuralları</a>ndadır.</p>
<h3>5. Moderasyon</h3>
<p>Kurallara aykırı içerikleri kaldırabilir, hesapları uyarabilir, geçici olarak askıya alabilir ya da kapatabiliriz. Bir karara itiraz etmek için uygulamadaki itiraz formunu kullanabilirsin.</p>
<h3>6. Jeton ve SwipeUp+</h3>
<ul>
<li>Jetonlar yalnızca uygulama içinde (canlı yayın hediyeleri, fal, boost) kullanılır; nakde çevrilemez ve başkasına devredilemez.</li>
<li>Havale/EFT ile verilen siparişler, ödeme hesabımıza ulaşıp onaylandığında hesabına tanımlanır.</li>
<li>Kullanılmış jetonlar ve başlamış üyelik süreleri iade edilmez; yasal cayma hakkın saklıdır. Hatalı ödemeler için bizimle iletişime geç.</li>
<li>Yayıncıların hediye kazançları, belirlenen alt sınırı geçtiğinde ödeme talebiyle IBAN’a gönderilir.</li>
</ul>
<h3>7. Buluşmalar ve güvenlik</h3>
<p>Tanıştığın kişilerle ilgili kimlik doğrulaması yapmayız (mavi tik yalnızca fotoğrafın sahibine ait olduğunu gösterir). İlk buluşmaları kalabalık yerlerde yap, kişisel bilgilerini ve paranı paylaşma.</p>
<h3>8. Sorumluluğun sınırı</h3>
<p>Uygulama “olduğu gibi” sunulur. Kesintisiz çalışacağını garanti etmeyiz; kullanıcılar arasındaki iletişim ve buluşmalardan doğan zararlardan, yasal olarak izin verilen ölçüde sorumlu değiliz.</p>
<h3>9. Değişiklikler</h3>
<p>Bu koşulları güncelleyebiliriz; önemli değişiklikleri uygulama içinden duyururuz.</p>`,
  },
  kvkk: {
    title: 'KVKK aydınlatma metni',
    body: () => {
      const c = contact();
      return `
<p>6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca, veri sorumlusu sıfatıyla ${c.who} olarak seni bilgilendiriyoruz.</p>
<h3>İşlenen veriler</h3>
<p>Kimlik (ad, kullanıcı adı, doğum tarihi), iletişim (e-posta), görsel kayıt (profil fotoğrafları, doğrulama selfiesi, paylaşımlar), konum (izin verirsen, yaklaşık), işlem güvenliği (IP, oturum bilgisi), müşteri işlem (sipariş, jeton hareketleri) ve iletişim içerikleri (mesajlar).</p>
<h3>Amaçlar ve hukuki sebepler</h3>
<ul>
<li>Üyelik sözleşmesinin kurulması ve ifası (KVKK m.5/2-c).</li>
<li>Hukuki yükümlülüklerin yerine getirilmesi; 18 yaş kontrolü, muhasebe kayıtları (m.5/2-ç).</li>
<li>Bir hakkın tesisi, kullanılması veya korunması; şikayet ve itiraz süreçleri (m.5/2-e).</li>
<li>Meşru menfaat; dolandırıcılık ve kötüye kullanımın önlenmesi, otomatik moderasyon (m.5/2-f).</li>
<li>Açık rıza; isteğe bağlı konum paylaşımı ve anlık bildirimler (m.5/1).</li>
</ul>
<h3>Aktarım</h3>
<p>Veriler; barındırma, bildirim ve arama aktarma hizmeti aldığımız, sunucuları yurt dışında olabilen hizmet sağlayıcılara yalnızca hizmetin sunulması amacıyla ve KVKK m.9’a uygun olarak aktarılabilir; yetkili kamu kurumlarına yasal zorunluluk halinde bilgi verilebilir.</p>
<h3>Toplama yöntemi</h3>
<p>Veriler, uygulamayı kullanırken senin girdiğin bilgiler ve kullanım sırasında otomatik olarak oluşan kayıtlar yoluyla elektronik ortamda toplanır.</p>
<h3>Hakların (KVKK m.11)</h3>
<p>Verilerinin işlenip işlenmediğini öğrenme, bilgi talep etme, amacını öğrenme, aktarıldığı kişileri bilme, düzeltilmesini, silinmesini ya da yok edilmesini isteme, otomatik analiz sonucu aleyhine bir sonuca itiraz etme ve zararın giderilmesini talep etme haklarına sahipsin. Verilerinin kopyasını Ayarlar → Verilerimi indir ile alabilir, hesabını Ayarlar → Hesabımı sil ile silebilirsin. Diğer başvurular için: ${c.mail}${c.addr}.</p>`;
    },
  },
  kurallar: {
    title: 'Topluluk kuralları',
    body: () => `
<p>SwipeUp herkesin kendini güvende hissettiği bir yer olsun diye bu kurallar var.</p>
<ul>
<li><b>Kendin ol.</b> Gerçek fotoğraflarını kullan, başkası gibi davranma.</li>
<li><b>Saygılı ol.</b> Hakaret, aşağılama, taciz ve tehdit yok. Mesajlardaki ağır küfür ve tehditler otomatik olarak işaretlenip ekibimize iletilir.</li>
<li><b>Hayır, hayırdır.</b> İlgilenmeyen birine ısrarla yazma.</li>
<li><b>Çıplaklık ve cinsel içerik yok.</b> Rahatsız edici, şiddet içeren veya yasa dışı içerik paylaşma.</li>
<li><b>Reşit olmayanlar yok.</b> 18 yaşından küçük biri olabileceğini düşündüğün hesapları bildir.</li>
<li><b>Para isteme, dolandırma.</b> Kimseden para, hediye kartı ya da yatırım isteme; isteyenleri bildir.</li>
<li><b>Spam yok.</b> Reklam, link yağmuru ve otomatik hesaplar yasaktır.</li>
<li><b>Telif haklarına saygı.</b> Hakkı sana ait olmayan içerikleri paylaşma.</li>
</ul>
<p>Kuralları çiğneyen içerikler kaldırılır; hesaplar uyarılır, askıya alınır ya da kapatılır. Bir profili veya içeriği <b>Şikayet et</b> ile bildirebilirsin; kimin bildirdiği gizli tutulur.</p>`,
  },
};

export function legalHtml(doc) {
  const d = DOCS[doc] || DOCS.gizlilik;
  return `<article class="legal"><p class="muted" style="font-size:13px">Son güncelleme: ${UPDATED}</p>${d.body()}</article>`;
}

export function legalSheet(doc) {
  sheet(DOCS[doc]?.title || 'Belge', `<div style="padding:0 18px 20px">${legalHtml(doc)}</div>`);
}

export default function legal(view, doc) {
  const d = DOCS[doc] || DOCS.gizlilik;
  view.innerHTML = `<header class="topbar bordered"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button><div class="center">${esc(d.title)}</div><span class="ib"></span></header>
    <div style="padding:6px 18px 40px">${legalHtml(doc)}
    <div class="legal-nav">${Object.entries(DOCS).filter(([k]) => k !== doc).map(([k, x]) => `<a class="chip" href="#/legal/${k}">${esc(x.title)}</a>`).join('')}</div></div>`;
  return null;
}
