import { icon } from '../icons.js';
import { esc, state, sheet } from '../core.js';

const UPDATED = '11 Kasım 2026';

// Yönetim panelinden girilen iletişim bilgileri (/api/config → legal)
function contact() {
  const l = state.config?.legal || {};
  const who = l.company ? esc(l.company) : 'SwipeUp';
  const mail = l.email ? `<a class="link" href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : 'uygulama içindeki şikayet/itiraz formları';
  const addr = l.address ? `, adres: ${esc(l.address)}` : '';
  return { who, mail, addr };
}


// Hizmet sağlayıcılar: ne için, hangi veri, nerede
const PROV = [
  ['Render (Render Services, Inc.)', 'Uygulama sunucusu', 'Uygulamaya gelen tüm istekler', 'Almanya (Frankfurt)'],
  ['Supabase (AWS)', 'Veritabanı ve dosya saklama', 'Hesap, profil, paylaşım, mesaj ve dosyalar', 'Almanya (Frankfurt)'],
  ['Cloudflare', 'Güvenli bağlantı ve saldırı koruması', 'IP adresi, istek bilgileri', 'Küresel'],
  ['Sightengine', 'Fotoğraf denetimi (çıplaklık, şiddet)', 'Yüklenen fotoğraflar', 'Fransa (AB)'],
  ['Google (Gemini API)', 'Fal yorum taslağı (yalnızca açık rızayla)', 'Fal notu, fincan fotoğrafları, burç / kart bilgisi', 'ABD ve diğer'],
  ['Google, Apple', 'Google / Apple ile giriş (seçersen)', 'Kimlik numarası, e-posta, ad', 'ABD'],
  ['Google, Apple, Mozilla', 'Anlık bildirim iletimi', 'Bildirim içeriği, cihaz bildirim adresi', 'ABD ve diğer'],
  ['Metered (Open Relay)', 'Sesli / görüntülü arama aktarma', 'Şifreli arama trafiği, IP adresi', 'Küresel'],
  ['Spotify', 'Müzik arama ve önizleme', 'Arama kelimesi', 'İsveç, ABD'],
  ['GIPHY', 'GIF arama', 'Arama kelimesi', 'ABD'],
  ['OpenStreetMap, Overpass', 'Harita ve yakındaki mekanlar', 'Yaklaşık konum (yalnızca bu özellikleri kullanırsan)', 'Almanya ve AB'],
];
const PROVIDERS = `<div class="legal-tbl"><table><thead><tr><th>Sağlayıcı</th><th>Ne için</th><th>Hangi veri</th><th>Nerede</th></tr></thead><tbody>${PROV.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

export const DOCS = {
  gizlilik: {
    title: 'Gizlilik politikası',
    body: () => {
      const c = contact();
      return `
<p>Bu politika, ${c.who} (“SwipeUp”, “biz”) olarak SwipeUp uygulamasını kullanırken hangi kişisel verilerini neden ve nasıl işlediğimizi anlatır.</p>
<h3>Topladığımız veriler</h3>
<ul>
<li><b>Hesap bilgileri:</b> kullanıcı adı, ad, doğum tarihi, (isteğe bağlı) e-posta, şifrenin geri döndürülemez özeti; Google / Apple ile girersen bu hesabın kimlik numarası ve e-posta adresi.</li>
<li><b>Profil bilgileri:</b> fotoğraflar, biyografi, yaş, şehir, cinsiyet, ilgi alanları, burç.</li>
<li><b>Paylaştıkların:</b> gönderiler, vitrin videoları, hikayeler, yorumlar, beğeniler, mesajlar, sesli mesajlar, fal istekleri.</li>
<li><b>Konum:</b> yalnızca açık rıza verirsen, yaklaşık 1 km hassasiyetle yuvarlanmış olarak; rızanı geri alınca silinir. Sohbette kendi isteğinle paylaştığın konum o mesajda saklanır.</li>
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
<li>Sana bildirim göndermek (kapatabilirsin); kampanya ve tanıtım bildirimlerini yalnızca izin verirsen göndeririz.</li>
<li>Google ya da Apple ile girişi seçersen, bu hesaptan gelen kimlik numarası ve e-posta adresiyle seni tanımak.</li>
</ul>
<h3>Kimler görebilir</h3>
<p>Profilin ve herkese açık paylaşımların diğer üyelere görünür. Gizli hesap açarsan gönderi ve hikayelerini sadece onayladığın takipçiler görür. Mesajların yalnızca sohbetteki kişilere iletilir; sohbette gönderdiğin fotoğraf, video ve sesli mesajlar süreli, imzalı bağlantılarla yalnızca sohbetteki kişilere açılır; yönetim ekibi yalnızca bir şikayet ya da otomatik moderasyon kaydı olduğunda ilgili mesajı görebilir. Verilerini satmayız ve reklam amacıyla üçüncü kişilerle paylaşmayız.</p>
<h3>Hizmet sağlayıcılar ve yurt dışına aktarım</h3>
<p>Uygulamayı sunabilmek için aşağıdaki hizmet sağlayıcılardan yararlanıyoruz. Verilerin yalnızca ilgili hizmetin gerektirdiği kadarıyla bu sağlayıcılara iletilir. Sunucuları Türkiye dışında olduğundan bu iletim <b>yurt dışına aktarım</b> sayılır ve KVKK m.9’a uygun olarak (standart sözleşme gibi uygun güvencelerle ya da senin açık rızanla) yapılır.</p>
${PROVIDERS}
<p>Telefonundaki tarayıcı da bazı içerikleri doğrudan sağlayıcıdan yükler (harita karoları, GIF’ler, müzik önizlemeleri, yazı tipi, varsayılan profil çizimi); bu sırada IP adresin ilgili sağlayıcıya ulaşır.</p>
<h3>Saklama süreleri</h3>
<ul>
<li><b>Hesap ve profil bilgileri, paylaşımlar, mesajlar:</b> hesabın açık olduğu sürece. Hesabını sildiğinde profilin, paylaşımların, eşleşmelerin, mesajların ve yüklediğin dosyalar silinir.</li>
<li><b>Hikayeler:</b> 24 saat (arşive aldıkların 30 gün). <b>Kaybolan mesajlar:</b> seçtiğin süre.</li>
<li><b>Ödeme ve jeton kayıtları:</b> vergi ve ticaret mevzuatı gereği 10 yıl.</li>
<li><b>Şikayet, moderasyon ve destek kayıtları:</b> kapanıştan sonra 2 yıl.</li>
<li><b>İşlem güvenliği kayıtları (IP, giriş zamanları):</b> en fazla 2 yıl.</li>
<li><b>Açık rıza kayıtların:</b> rızanı ispat edebilmek için, rıza geri alınsa da zamanaşımı süresince.</li>
</ul>
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
<li>Açık rıza (m.5/1): yalnızca isteğe bağlı işlemeler için; kampanya bildirimleri, konum, fal fotoğraflarının yapay zekayla yorumlanması. Ayrıntılar <a class="link" href="#/legal/riza">açık rıza metni</a>nde. Rıza vermemen üyeliğini ve diğer özellikleri etkilemez; Ayarlar → İzinlerim’den istediğin an geri alabilirsin.</li>
</ul>
<h3>Aktarım</h3>
<p>Kişisel verilerin; hizmetin sunulması amacıyla barındırma, veritabanı, içerik dağıtımı, fotoğraf denetimi, bildirim, arama aktarma, yapay zeka ve giriş hizmeti aldığımız sağlayıcılara aktarılır. Bu sağlayıcıların sunucuları yurt dışında (Almanya, Fransa, ABD ve diğer ülkeler) olduğundan aktarım KVKK m.9 kapsamında yurt dışına aktarımdır ve Kurul’un belirlediği standart sözleşmeler gibi uygun güvencelerle, istisnai durumlarda açık rızana dayanarak yapılır. Sağlayıcıların listesi <a class="link" href="#/legal/gizlilik">Gizlilik Politikası</a>’ndadır. Yasal zorunluluk halinde yetkili kamu kurum ve kuruluşlarına bilgi verilebilir.</p>
<h3>Toplama yöntemi</h3>
<p>Veriler, uygulamayı kullanırken senin girdiğin bilgiler ve kullanım sırasında otomatik olarak oluşan kayıtlar yoluyla elektronik ortamda toplanır.</p>
<h3>Hakların (KVKK m.11)</h3>
<p>Verilerinin işlenip işlenmediğini öğrenme, bilgi talep etme, amacını öğrenme, aktarıldığı kişileri bilme, düzeltilmesini, silinmesini ya da yok edilmesini isteme, otomatik analiz sonucu aleyhine bir sonuca itiraz etme ve zararın giderilmesini talep etme haklarına sahipsin. Verilerinin kopyasını Ayarlar → Verilerimi indir ile alabilir, hesabını Ayarlar → Hesabımı sil ile kalıcı olarak silebilirsin. Diğer başvurular için: ${c.mail}${c.addr}. Başvurun en geç 30 gün içinde ücretsiz yanıtlanır; yanıtı yeterli bulmazsan Kişisel Verileri Koruma Kurulu’na şikayette bulunabilirsin.</p>
<p class="muted">Bu metin bilgilendirme amaçlıdır; okuman için onay vermen gerekmez.</p>`;
    },
  },
  riza: {
    title: 'Açık rıza metni',
    body: () => {
      const c = contact();
      return `
<p>Aşağıdaki işlemeler SwipeUp’ı kullanmak için <b>zorunlu değildir</b>. Her biri için ayrı ayrı, kendi isteğinle izin verirsin; vermezsen uygulamanın geri kalanını aynen kullanırsın. Verdiğin izinleri istediğin an Ayarlar → İzinlerim’den geri alabilirsin; geri alma, o ana kadar yapılmış işlemleri etkilemez.</p>
<h3>1. Kampanya ve yenilik bildirimleri</h3>
<p>Kampanya, indirim, etkinlik ve yeni özelliklerle ilgili anlık bildirim ve (e-posta adresin varsa) e-posta gönderebilmemiz için ad, kullanıcı adı, e-posta ve bildirim aboneliğin işlenir. İzin vermezsen yalnızca hesabın ve güvenliğinle ilgili zorunlu bildirimler gelir.</p>
<h3>2. Konum</h3>
<p>Yakınındaki kişileri ve uzaklığı gösterebilmek için cihazından alınan konumun yaklaşık 1 km hassasiyetle yuvarlanarak saklanır. Tam konumun saklanmaz; diğer kullanıcılara yalnızca kilometre cinsinden uzaklık gösterilir. İzni geri alınca kayıtlı konumun silinir.</p>
<h3>3. Fal fotoğraflarının yapay zekayla yorumlanması (yurt dışına aktarım)</h3>
<p>Fal isteğinde gönderdiğin fincan fotoğrafları, notun ve burç / kart bilgin, yorum taslağı hazırlanması için Google’ın yapay zeka hizmetine (Gemini API, sunucuları ABD ve diğer ülkelerde) aktarılır. Adın, kullanıcı adın ve iletişim bilgilerin gönderilmez. Yurt dışındaki bu ülkelerde Türkiye’deki ile aynı düzeyde koruma bulunmayabilir; Google’ın verileri kendi koşullarına göre işleyebileceği gibi riskler vardır. İzin vermezsen falına Falcı Teyze kendisi bakar.</p>
<h3>Kayıt ve başvuru</h3>
<p>Verdiğin ya da geri aldığın her iznin tarihi kayıt altına alınır. Sorular ve başvurular için: ${c.mail}${c.addr}.</p>`;
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
  view.innerHTML = `<header class="topbar bordered"><button class="ib" data-back="#/" aria-label="Geri">${icon('back')}</button><div class="center">${esc(d.title)}</div><span class="ib"></span></header>
    <div style="padding:6px 18px 40px">${legalHtml(doc)}
    <div class="legal-nav">${Object.entries(DOCS).filter(([k]) => k !== doc).map(([k, x]) => `<a class="chip" href="#/legal/${k}">${esc(x.title)}</a>`).join('')}</div></div>`;
  return null;
}
