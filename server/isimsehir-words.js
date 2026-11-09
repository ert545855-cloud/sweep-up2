// İsim Şehir sözlüğü: sözlükte olan cevap kendiliğinden geçerli sayılır,
// olmayan cevap ancak diğer oyuncuların yarısı onaylarsa geçer.
const W = {
  ulke: `Afganistan, Almanya, Amerika, ABD, Amerika Birleşik Devletleri, Andorra, Angola, Antigua ve Barbuda, Arjantin, Arnavutluk, Avustralya, Avusturya, Azerbaycan,
    Bahamalar, Bahreyn, Bangladeş, Barbados, Belarus, Beyaz Rusya, Belçika, Belize, Benin, Bhutan, Butan, Birleşik Arap Emirlikleri, BAE, Bolivya, Bosna Hersek, Bosna, Botsvana, Brezilya, Brunei, Bulgaristan, Burkina Faso, Burundi, Birleşik Krallık,
    Cezayir, Cibuti, Çad, Çek Cumhuriyeti, Çekya, Çin, Çekoslovakya, Danimarka, Doğu Timor, Dominik Cumhuriyeti, Dominika,
    Ekvador, Ekvator Ginesi, El Salvador, Endonezya, Eritre, Ermenistan, Estonya, Esvatini, Etiyopya, Fas, Fiji, Fildişi Sahili, Filipinler, Filistin, Finlandiya, Fransa,
    Gabon, Gambiya, Gana, Gine, Gine Bissau, Grenada, Guatemala, Guyana, Güney Afrika, Güney Kore, Güney Sudan, Gürcistan, Galler, Grönland,
    Haiti, Hırvatistan, Hindistan, Hollanda, Honduras, Irak, İngiltere, İran, İrlanda, İspanya, İsrail, İsveç, İsviçre, İtalya, İzlanda, İskoçya,
    Jamaika, Japonya, Kamboçya, Kamerun, Kanada, Karadağ, Katar, Kazakistan, Kenya, Kıbrıs, KKTC, Kuzey Kıbrıs, Kırgızistan, Kiribati, Kolombiya, Komorlar, Kongo, Kongo Demokratik Cumhuriyeti, Kosova, Kosta Rika, Kuveyt, Kuzey Kore, Kuzey Makedonya, Makedonya, Küba,
    Laos, Lesotho, Letonya, Liberya, Libya, Lihtenştayn, Litvanya, Lübnan, Lüksemburg,
    Macaristan, Madagaskar, Malavi, Maldivler, Malezya, Mali, Malta, Marşal Adaları, Meksika, Mısır, Mikronezya, Moğolistan, Moldova, Monako, Moritanya, Morityus, Mozambik, Myanmar, Burma,
    Namibya, Nauru, Nepal, Nijer, Nijerya, Nikaragua, Norveç, Orta Afrika Cumhuriyeti, Özbekistan,
    Pakistan, Palau, Panama, Papua Yeni Gine, Paraguay, Peru, Polonya, Portekiz, Romanya, Ruanda, Rusya,
    Saint Kitts ve Nevis, Saint Lucia, Saint Vincent ve Grenadinler, Samoa, San Marino, Sao Tome ve Principe, Senegal, Seyşeller, Sırbistan, Sierra Leone, Singapur, Slovakya, Slovenya, Solomon Adaları, Somali, Sri Lanka, Sudan, Surinam, Suriye, Suudi Arabistan, Svaziland, Sovyetler Birliği,
    Şili, Tacikistan, Tanzanya, Tayland, Tayvan, Togo, Tonga, Trinidad ve Tobago, Tunus, Tuvalu, Türkiye, Türkmenistan,
    Uganda, Ukrayna, Umman, Uruguay, Ürdün, Vanuatu, Vatikan, Venezuela, Vietnam, Yemen, Yeni Zelanda, Yeşil Burun Adaları, Yunanistan, Yugoslavya, Zambiya, Zimbabve`,

  sehir: `Adana, Adıyaman, Afyon, Afyonkarahisar, Ağrı, Aksaray, Amasya, Ankara, Antalya, Ardahan, Artvin, Aydın, Balıkesir, Bartın, Batman, Bayburt, Bilecik, Bingöl, Bitlis, Bolu, Burdur, Bursa,
    Çanakkale, Çankırı, Çorum, Denizli, Diyarbakır, Düzce, Edirne, Elazığ, Erzincan, Erzurum, Eskişehir, Gaziantep, Antep, Giresun, Gümüşhane, Hakkari, Hatay, Antakya, Iğdır, Isparta, İstanbul, İzmir,
    Kahramanmaraş, Maraş, Karabük, Karaman, Kars, Kastamonu, Kayseri, Kırıkkale, Kırklareli, Kırşehir, Kilis, Kocaeli, İzmit, Konya, Kütahya, Malatya, Manisa, Mardin, Mersin, İçel, Muğla, Muş,
    Nevşehir, Niğde, Ordu, Osmaniye, Rize, Sakarya, Adapazarı, Samsun, Siirt, Sinop, Sivas, Şanlıurfa, Urfa, Şırnak, Tekirdağ, Tokat, Trabzon, Tunceli, Dersim, Uşak, Van, Yalova, Yozgat, Zonguldak,
    Alanya, Bodrum, Fethiye, Marmaris, Kuşadası, Çeşme, Didim, Ayvalık, Edremit, Bandırma, İnegöl, Gebze, Ereğli, Akçakoca, Safranbolu, Ödemiş, Bergama, Nazilli, Söke, Salihli, Akhisar, Turgutlu,
    Tarsus, Silifke, Anamur, Erdemli, Manavgat, Kemer, Kaş, Side, Serik, Kumluca, Ürgüp, Göreme, Avanos, Polatlı, Beypazarı, Kızılcahamam, Ünye, Fatsa, Bafra, Çarşamba, Terme, Tatvan, Doğubayazıt, Patnos,
    Siverek, Viranşehir, Birecik, Halfeti, Suruç, Akçakale, Harran, Kozan, Ceyhan, Dörtyol, İskenderun, Kırıkhan, Reyhanlı, Samandağ, Arsuz, Kadirli, Elbistan, Afşin, Göksun, Pazarcık, Nizip, İslahiye,
    Midyat, Kızıltepe, Nusaybin, Cizre, Silopi, Hopa, Yusufeli, Arhavi, Borçka, Şavşat, Of, Akçaabat, Sürmene, Maçka, Ardeşen, Çayeli, Pazar, Fındıklı, Merzifon, Suluova, Zile, Turhal, Erbaa, Niksar,
    Lüleburgaz, Çorlu, Çerkezköy, Malkara, Şarköy, Keşan, Uzunköprü, Gelibolu, Biga, Çan, Burhaniye, Gönen, Susurluk, Mudanya, Gemlik, İznik, Orhangazi, Karacabey, Mustafakemalpaşa, Karamürsel, Gölcük, Körfez, Darıca,
    Bozüyük, Söğüt, Tavşanlı, Simav, Gediz, Emirdağ, Sandıklı, Bolvadin, Dinar, Eğirdir, Yalvaç, Seydişehir, Akşehir, Ilgın, Beyşehir, Cihanbeyli, Karapınar, Kulu, Develi, Yahyalı, Bünyan, Talas,
    Datça, Köyceğiz, Dalaman, Ortaca, Milas, Yatağan, Tavas, Acıpayam, Çivril, Sarayköy, Buldan, Adilcevaz, Ahlat, Erciş, Gevaş, Kahta, Besni, Gölbaşı, Bismil, Ergani, Silvan, Çermik, Lice,
    Malazgirt, Varto, Bulanık, Hınıs, Oltu, Horasan, Pasinler, İspir, Aşkale, Tortum, Sarıkamış, Kağızman, Posof, Göle, Görele, Tirebolu, Espiye, Bulancak, Şebinkarahisar, Kelkit, Şiran, Torul,
    Kemah, Refahiye, Tercan, Divriği, Zara, Suşehri, Şarkışla, Gemerek, Yıldızeli, Sorgun, Boğazlıyan, Sungurlu, Osmancık, İskilip, Alaca, Tosya, Taşköprü, İnebolu, Cide, Abana, Boyabat, Gerze, Ayancık,
    Devrek, Çaycuma, Alaplı, Amasra, Mengen, Gerede, Mudurnu, Göynük, Hendek, Akyazı, Karasu, Geyve, Pamukova, Sapanca, Kartepe, Altınova, Çınarcık, Termal, Avşa, Marmara Ereğlisi, Saray,
    Kadıköy, Üsküdar, Beşiktaş, Şişli, Beyoğlu, Fatih, Bakırköy, Pendik, Kartal, Maltepe, Ataşehir, Ümraniye, Esenyurt, Avcılar, Beylikdüzü, Büyükçekmece, Silivri, Sarıyer, Eyüp, Eyüpsultan, Zeytinburnu,
    Bağcılar, Bahçelievler, Küçükçekmece, Sultangazi, Gaziosmanpaşa, Esenler, Güngören, Tuzla, Çekmeköy, Sancaktepe, Sultanbeyli, Şile, Beykoz, Kağıthane, Bayrampaşa, Başakşehir, Arnavutköy, Çatalca, Adalar,
    Çankaya, Keçiören, Yenimahalle, Mamak, Etimesgut, Sincan, Altındağ, Pursaklar, Kahramankazan, Elmadağ, Çubuk, Haymana, Nallıhan, Ayaş, Karşıyaka, Bornova, Buca, Konak, Bayraklı, Çiğli, Gaziemir,
    Karabağlar, Menemen, Torbalı, Urla, Seferihisar, Foça, Dikili, Tire, Bayındır, Kemalpaşa, Aliağa, Selçuk, Kınık, Kiraz, Nilüfer, Osmangazi, Yıldırım, Meram, Selçuklu, Karatay, Seyhan, Yüreğir, Çukurova,
    Muratpaşa, Konyaaltı, Kepez, Lara, Şahinbey, Şehitkamil, Melikgazi, Kocasinan, Tepebaşı, Odunpazarı, Pamukkale, Merkezefendi, Atakum, İlkadım, Canik, Ortahisar, Yakutiye, Palandöken, Battalgazi, Yeşilyurt,
    Londra, Paris, Berlin, Roma, Madrid, Barselona, Lizbon, Viyana, Prag, Budapeşte, Varşova, Moskova, Kiev, Kyiv, Atina, Selanik, Sofya, Bükreş, Belgrad, Saraybosna, Üsküp, Tiran, Zagreb, Lübliyana, Bratislava,
    Brüksel, Amsterdam, Lahey, Rotterdam, Kopenhag, Oslo, Stockholm, Helsinki, Reykjavik, Dublin, Edinburg, Manchester, Liverpool, Birmingham, Münih, Hamburg, Frankfurt, Köln, Stuttgart, Dortmund, Düsseldorf,
    Milano, Napoli, Venedik, Floransa, Torino, Cenevre, Zürih, Bern, Lyon, Marsilya, Nice, Sevilla, Valensiya, Porto, Salzburg, Krakov, Odessa, Kazan, Soçi, Saint Petersburg, Petersburg, Minsk, Riga, Vilnius, Tallinn,
    New York, Los Angeles, Chicago, Washington, Boston, Miami, San Francisco, Las Vegas, Houston, Dallas, Seattle, Detroit, Atlanta, Toronto, Montreal, Vancouver, Ottava, Meksiko, Havana,
    Rio de Janeiro, Sao Paulo, Brasilia, Buenos Aires, Santiago, Lima, Bogota, Karakas, Quito, Montevideo, Kahire, İskenderiye, Kazablanka, Rabat, Marakeş, Tunus, Cezayir, Trablus, Bingazi, Hartum, Nairobi,
    Lagos, Abuja, Akra, Dakar, Johannesburg, Cape Town, Kinşasa, Addis Ababa, Bağdat, Musul, Erbil, Kerkük, Basra, Tahran, Tebriz, İsfahan, Şam, Halep, Beyrut, Amman, Kudüs, Tel Aviv, Riyad, Cidde, Mekke, Medine,
    Doha, Dubai, Abu Dabi, Maskat, Sana, Bakü, Gence, Nahçıvan, Tiflis, Batum, Erivan, Taşkent, Semerkant, Buhara, Astana, Almatı, Bişkek, Duşanbe, Aşkabat, Kabil, İslamabad, Karaçi, Lahor,
    Delhi, Yeni Delhi, Mumbai, Bombay, Kalküta, Bangalor, Katmandu, Dakka, Kolombo, Bangkok, Hanoi, Ho Chi Minh, Kuala Lumpur, Cakarta, Manila, Pekin, Şanghay, Hong Kong, Makao, Tokyo, Osaka, Kyoto, Hiroşima,
    Seul, Busan, Pyongyang, Taipei, Ulan Batur, Sidney, Melbourne, Kanberra, Brisbane, Perth, Auckland, Wellington, Lefkoşa, Girne, Gazimağusa, Mağusa, Güzelyurt, Larnaka, Limasol, Baf`,

  hayvan: `Aslan, Arslan, Ayı, At, Arı, Ahtapot, Akrep, Antilop, Alabalık, Akbaba, Albatros, Armadillo, Ateşböceği, Ağustosböceği, Atmaca, Alageyik, Anakonda, Aygır, Alpaka, Ahu, Akdoğan, Ayıbalığı, Akya, Aksolotl,
    Balık, Baykuş, Boğa, Bukalemun, Bıldırcın, Balina, Böcek, Bit, Bülbül, Buzağı, Bizon, Babun, Baştankara, Balıkçıl, Barbunya, Boa, Bufalo, Bağa, Beçtavuğu, Ballıbababöceği, Balarısı, Balporsuğu, Barakuda, Beyazbalina, Bonito, Bit,
    Ceylan, Civciv, Cırcırböceği, Caretta, Cücemaymun, Çakal, Çita, Çekirge, Çipura, Çıyan, Çiyan, Çulluk, Çaylak, Çalıkuşu, Çinekop, Çaprazgaga, Çöl faresi, Çöl tilkisi,
    Deve, Devekuşu, Domuz, Dana, Dinozor, Doğan, Denizatı, Denizanası, Denizyıldızı, Denizkaplumbağası, Dağkeçisi, Dingo, Dodo, Dülgerbalığı, Dilbalığı, Denizaslanı, Denizineği, Denizkestanesi,
    Eşek, Engerek, Eşekarısı, Emu, Erkeç, Ekinkargası, Ebabil, Ejderbalığı,
    Fil, Fare, Fok, Flamingo, Firavunfaresi, Fındıkfaresi, Fenerbalığı, Fırtınakuşu, Fino,
    Geyik, Goril, Güvercin, Gergedan, Güve, Gugukkuşu, Gelincik, Gecekuşu, Gümüşbalığı, Gerbil, Gibon, Gnu, Gazal, Gribalina, Ginedomuzu, Gökkuzgun, Gümüşmartı, Gece kelebeği,
    Hamsi, Horoz, Hindi, Hamster, Hipopotam, Hamamböceği, Hüthüt, Husky, Hanos, Hörgüçlüdeve,
    Istakoz, Ispinoz, Iguana, İguana, İnek, İmpala, İstavrit, İskorpit, İbibik, İpekböceği, İt, İğnebalığı, İspinoz, İshakkuşu, İnci kefali,
    Jaguar, Jakal,
    Kedi, Köpek, Kartal, Kaplan, Kurt, Koyun, Keçi, Kaplumbağa, Kanguru, Karga, Kaz, Kelebek, Koala, Kunduz, Kirpi, Kertenkele, Kobra, Kalkan, Karınca, Kene, Kurbağa, Kuğu, Kumru, Kırlangıç, Keklik, Koç, Kuzu,
    Kısrak, Köpekbalığı, Kalamar, Karides, Kefal, Kılıçbalığı, Kakadu, Kanarya, Kolibri, Karleoparı, Karabatak, Kokarca, Körfare, Kırkayak, Kuzgun, Kaşalot, Kurbağa, Katır,
    Leylek, Levrek, Lama, Leopar, Lemur, Lüfer, Lori, Lağımfaresi,
    Maymun, Manda, Midye, Martı, Mandril, Mamut, Mors, Mercan, Mürekkepbalığı, Mezgit, Mersinbalığı, Mamba, Mirket, Misksığırı, Mavibalina, Muhabbetkuşu, Mandalina ördeği, Manta,
    Narval, Nandu, Niltimsahı, Nilgau,
    Orangutan, Okapi, Orkinos, Oklukirpi, Oğlak, Oselot, Ornitorenk, Orfoz, Ördek, Öküz, Örümcek, Ötleğen, Ördekgagalı, Örümcekmaymunu,
    Panda, Papağan, Penguen, Pelikan, Puma, Panter, Palamut, Pire, Porsuk, Piton, Pisibalığı, Pirana, Pars, Puhu, Pekinez, Pony, Pavurya,
    Rakun, Rengeyiği, Ringa, Rottweiler, Rhesus,
    Sincap, Serçe, Sinek, Sazan, Sardalya, Somon, Sülün, Sansar, Sırtlan, Sığır, Salyangoz, Semender, Sivrisinek, Susamuru, Sümüklüböcek, Sığırcık, Saksağan, Sinekkuşu, Sülük, Samur, Sarıasma, Sakarmeke, Skunk,
    Şempanze, Şahin, Şebek, Şivava, Şişeburunluyunus,
    Tavşan, Tavuk, Timsah, Tilki, Tırtıl, Turna, Tonbalığı, Tarlafaresi, Tazı, Tay, Toykuşu, Tukan, Tapir, Tarantula, Tatarcık, Tekir, Tosbağa, Tavuskuşu, Tahtakurusu,
    Uğurböceği, Uskumru, Üveyik,
    Vaşak, Vatoz, Vahşikedi, Vampiryarasa, Vizon, Vankedisi, Vombat,
    Yunus, Yılan, Yarasa, Yengeç, Yak, Yabandomuzu, Yabankeçisi, Yalıçapkını, Yusufçuk, Yabanördeği, Yersincabı, Yabanarısı, Yağmurkurdu, Yılanbalığı, Yaban kedisi,
    Zürafa, Zebra, Zargana, Zebu, Zerdeva`,

  bitki: `Ayçiçeği, Ananas, Armut, Ahududu, Avokado, Ardıç, Akasya, Ayva, Arpa, Asma, Adaçayı, Anason, Alıç, Ayrıkotu, Aloe vera, Aloe, Atkestanesi, Ahlat, Afyon, Aslanağzı, Akçaağaç, Aynısefa, Ağaççileği,
    Biber, Bezelye, Begonya, Böğürtlen, Badem, Buğday, Börülce, Brokoli, Bamya, Bakla, Biberiye, Ballıbaba, Bambu, Begonvil, Bergamot, Brüksel lahanası, Barbunya, Balkabağı, Bodurçam, Böğürtlen,
    Ceviz, Cennetelması, Civanperçemi, Cezayirmenekşesi, Ciğerotu, Cehri,
    Çilek, Çam, Çınar, Çuhaçiçeği, Çay, Çavdar, Çobanpüskülü, Çiğdem, Çöreotu, Çemen, Çaltı, Çamfıstığı, Çitlembik, Çördük,
    Dut, Defne, Domates, Dereotu, Dişbudak, Devedikeni, Dağçileği, Dulavratotu, Dalya, Dolmalık biber,
    Elma, Erik, Enginar, Ebegümeci, Ekinezya, Erguvan, Eğreltiotu, Ekmekağacı, Ejderağacı,
    Fındık, Fasulye, Fesleğen, Frenküzümü, Fıstık, Fulya, Fıstıkçamı, Frezya, Filkulağı, Fesleğen,
    Gül, Greyfurt, Gelincik, Ginkgo, Gürgen, Gardenya, Glayöl, Gladyol, Guava, Göknar, Gazanya, Gülhatmi,
    Havuç, Hurma, Hindiba, Hardal, Haşhaş, Hercaimenekşe, Hanımeli, Hünnap, Hıyar, Hindistancevizi, Hatmi, Hodan, Hibiskus, Hezaren,
    Ihlamur, Isırgan, Isırganotu, Ispanak, Ilgın, İncir, İğde, İris, İtburnu, İnciçiçeği, İsot, İpekağacı,
    Japongülü, Jasmin,
    Kiraz, Kayısı, Karpuz, Kavun, Kabak, Karanfil, Kavak, Kestane, Kivi, Karnabahar, Kereviz, Kekik, Kaktüs, Kardelen, Kuşkonmaz, Kızılcık, Kuşburnu, Kişniş, Kakao, Kahve, Kenevir, Kamış, Kasımpatı, Kına,
    Kayın, Kızılağaç, Keçiboynuzu, Kantaron, Karalahana, Kudretnarı, Kumkat, Kuşüzümü, Kızılçam, Karaağaç, Karamuk, Kırmızıbiber,
    Lale, Limon, Lahana, Leylak, Ladin, Lavanta, Liçi, Lotus, Limonotu, Lüfa,
    Muz, Mısır, Mandalina, Menekşe, Mantar, Marul, Maydanoz, Mercimek, Mürver, Manolya, Mimoza, Mango, Muşmula, Morsalkım, Melisa, Meşe, Mersin, Mazı, Mahlep, Mineçiçeği, Margarit, Morlahana, Maş fasulyesi,
    Nar, Nane, Nergis, Nohut, Nilüfer, Nektarin, Narenciye, Nesrin,
    Orkide, Ortanca, Okaliptüs, Oğulotu, Ormangülü, Ölmezçiçek, Ökseotu,
    Patates, Patlıcan, Pırasa, Portakal, Papatya, Pamuk, Pancar, Pirinç, Pazı, Petunya, Palmiye, Pelinotu, Pırnal, Pitaya, Papaya, Paşakılıcı, Pelemir, Pıtrak,
    Reyhan, Roka, Rezene, Ravent, Ramazangülü,
    Sarımsak, Soğan, Salatalık, Semizotu, Sardunya, Sümbül, Sedir, Söğüt, Servi, Selvi, Susam, Soya, Sakızağacı, Sumak, Salep, Safran, Siklamen, Sarmaşık, Sinameki, Sukabağı, Sorgum, Sakız, Saparna,
    Şeftali, Şebboy, Şakayık, Şalgam, Şekerkamışı, Şekerpancarı, Şimşir, Şevketibostan, Şerbetçiotu, Şamfıstığı,
    Turp, Turunç, Tere, Tarçın, Tütün, Taflan, Tarhun, Tavşankulağı, Tespihağacı, Trabzonhurması, Topinambur, Tatlı patates,
    Uyuzotu, Üzüm, Üvez, Üçgül, Üzerlik,
    Vişne, Vanilya, Venüs sinekkapanı, Vadizambağı,
    Yulaf, Yabanmersini, Yasemin, Yonca, Yerfıstığı, Yerelması, Yenidünya, Yeşilfasulye, Yosun, Yılbaşıçiçeği, Yabangülü, Yediveren, Yalancıakasya, Yabanmersini,
    Zeytin, Zambak, Zencefil, Zerdali, Zakkum, Zerdeçal, Zinya, Zahter`,

  esya: `Ayna, Anahtar, Ayakkabı, Askı, Abajur, Avize, Atlet, Ataç, Araba, Aspiratör, Anten, Ajanda, Akvaryum, Alyans, Ayraç, Aplik, Ahize, Altlık, Ampul, Atkı, Asa, Anahtarlık, Ağırlık, Akü, Armonika, Akordeon,
    Bardak, Bıçak, Battaniye, Bavul, Bilgisayar, Bisiklet, Buzdolabı, Bilezik, Boya, Bant, Balta, Baston, Beşik, Bileklik, Broş, Bluz, Bere, Bot, Boncuk, Buhurdanlık, Bilye, Bidon, Biberon, Bornoz,
    Bulaşık makinesi, Büfe, Bez, Bebek arabası, Balon, Bardak altlığı, Bağlama, Buji,
    Cetvel, Cüzdan, Ceket, Cezve, Cımbız, Cep telefonu, Cam, Cıvata,
    Çanta, Çatal, Çaydanlık, Çorap, Çekiç, Çerçeve, Çadır, Çamaşır makinesi, Çivi, Çakmak, Çekmece, Çömlek, Çuval, Çan, Çalar saat, Çarşaf, Çakı, Çapa, Çekyat, Çini, Çubuk, Çamaşır mandalı, Çay bardağı,
    Dolap, Defter, Dürbün, Davul, Dikiş makinesi, Duvar saati, Dergi, Delgeç, Demlik, Dosya, Duş başlığı, Dikiş iğnesi, Dart, Dondurucu, Döşek, Deterjan, Dikiz aynası, Dinamo, Dümen,
    Eldiven, Etek, Elbise, Ekran, Eşarp, Emzik, Eğe, Ekmek bıçağı, Etajer, Eyer, Eşofman, Ekmek kızartma makinesi,
    Fincan, Fırın, Fırça, Fener, Fotoğraf makinesi, Fular, Fanus, Faraş, Flüt, Fermuar, Forma, Fiş, Fıçı, Fes, Fitil, Fön makinesi, Fotokopi makinesi, Futbol topu, Filtre, Fritöz,
    Gözlük, Gömlek, Gitar, Güneş gözlüğü, Gerdanlık, Gramofon, Gazete, Güğüm, Gaz ocağı, Gelinlik, Gergef, Gong, Gemi, Gönye,
    Halı, Havlu, Hortum, Hesap makinesi, Hoparlör, Harita, Heykel, Hırka, Hamak, Hasır, Hançer, Halter, Heybe, Havan, Hulahop, Hediye kutusu, Hurç,
    Izgara, Istaka, Iskarpin, Işıldak, Ispatula, İğne, İp, İplik, İbrik, İskemle, İnci, İskarpin, İçlik, İlaç kutusu,
    Kalem, Kitap, Kaşık, Kupa, Kova, Koltuk, Kanepe, Kamera, Kulaklık, Kemer, Küpe, Kolye, Kazak, Kapı, Klavye, Kumanda, Kibrit, Kilit, Kürek, Kazma, Kalemlik, Kurdele, Kepçe, Kevgir, Kase, Kavanoz, Kumbara,
    Kask, Kravat, Kayak, Keman, Kanun, Kaval, Kemençe, Kum saati, Kilim, Konsol, Kitaplık, Kaykay, Kurşun kalem, Kırbaç, Kafes, Kazan, Kızak, Kürsü, Kumaş, Kepenk, Kese, Kol saati, Kurutma makinesi, Kombi,
    Lamba, Leğen, Lastik, Lavabo, Laptop, Lambader, Lüle, Limonluk,
    Masa, Makas, Mum, Mendil, Mikrofon, Mikser, Matara, Mont, Mayo, Mangal, Mıknatıs, Makara, Merdiven, Metre, Mürekkep, Minder, Mektup, Mücevher, Mandal, Maşa, Matkap, Mızıka, Monitör, Mouse, Mızrak, Motor, Mutfak robotu,
    Nargile, Nazar boncuğu, Not defteri, Nevresim, Nal, Nalın, Neşter, Nişan yüzüğü,
    Oklava, Ocak, Oyuncak, Oje, Orak, Ok, Olta, Otomobil, Oturak, Önlük, Örtü, Örgü şişi, Ölçü kabı,
    Perde, Pantolon, Priz, Pense, Pil, Paspas, Piyano, Parfüm, Peçete, Patik, Pijama, Pusula, Puf, Pul, Pipet, Pipo, Plak, Pergel, Paraşüt, Portmanto, Poşet, Panjur, Palto, Pasaport, Pikap, Pinpon topu, Puzzle,
    Radyo, Raket, Raf, Ruj, Rende, Rimel, Rozet, Radyatör, Robot süpürge, Rahle, Rüzgarlık, Resim, Roman,
    Saat, Sandalye, Sehpa, Silgi, Süpürge, Sürahi, Sepet, Sabun, Saksı, Sünger, Spatula, Sopa, Sırt çantası, Süzgeç, Sandık, Soba, Sabunluk, Sapan, Saz, Sürgü, Salıncak, Sabahlık, Semer, Saç kurutma makinesi,
    Saç tokası, Sandal, Sim, Sürme, Sakız, Sargı bezi, Sim kart, Seccade, Sedye,
    Şemsiye, Şapka, Şişe, Şal, Şömine, Şezlong, Şarj aleti, Şırınga, Şekerlik, Şamdan, Şilte, Şort, Şiş, Şalvar, Şarj kablosu,
    Tabak, Tava, Tencere, Tarak, Televizyon, Telefon, Terlik, Tabure, Termos, Tornavida, Testere, Toka, Top, Tepsi, Tuzluk, Teleskop, Tüfek, Tablet, Tişört, Tül, Tüp, Terazi, Tırnak makası, Tasma, Tuval, Tef, Tencere,
    Taç, Tahta, Tel, Tülbent, Tespih, Takvim, Tanbur, Tekne,
    Uçurtma, Ukulele, Uçak, Ud, Uydu anteni, USB bellek, Ütü, Ütü masası, Üniforma, Üçayak,
    Vazo, Valiz, Vantilatör, Vida, Vitrin, Viyola, Viyolonsel, Vestiyer, Varil, Vinç,
    Yastık, Yorgan, Yüzük, Yatak, Yelek, Yaba, Yazıcı, Yelpaze, Yemek masası, Yay, Yular, Yoyo, Yağmurluk, Yapboz, Yazı tahtası, Yemeni, Yazma,
    Zarf, Zil, Zımba, Zincir, Zar, Zımpara, Zurna, Zıpkın, Zigon sehpa`,

  isim: `Ahmet, Ali, Ayşe, Aylin, Ayla, Ahu, Arda, Aslı, Aslan, Alp, Alper, Ata, Atakan, Ayhan, Aydın, Ayten, Asya, Azra, Ada, Ahsen, Akif, Abdullah, Adem, Adnan, Afra, Ajda, Alara, Alya, Aras, Arzu, Asena,
    Aybüke, Aydan, Aysel, Ayberk, Aybars, Ayaz, Aynur, Atilla, Aziz, Alican, Altan, Anıl, Arif, Armağan, Ateş, Atlas, Ayça, Aysun, Aytaç, Aysu, Ayşegül, Ayşenur, Aleyna, Aydoğan, Abdurrahman, Ahmet Can, Ayfer, Ayşen,
    Barış, Burak, Berk, Berkay, Bora, Buse, Burcu, Büşra, Begüm, Bahar, Banu, Başak, Belgin, Belma, Berna, Betül, Beyza, Bilal, Bilge, Birgül, Bülent, Burhan, Batuhan, Baran, Bekir, Berrak, Berat, Bengü, Beril,
    Birsen, Bulut, Buğra, Burçin, Bünyamin, Bayram, Baki, Bedirhan, Bedia, Berfin, Bahadır, Barbaros, Berkan, Birol, Bennu, Bihter,
    Cem, Can, Cansu, Ceren, Cemre, Canan, Cengiz, Cihan, Cüneyt, Cemil, Cemal, Ceyda, Ceylan, Cevdet, Cihat, Coşkun, Cumali, Ceyhun, Canberk, Cansın, Cennet, Cahit, Cansel, Celal, Celil, Cemile, Cenk, Cahide,
    Çağla, Çağrı, Çağan, Çağatay, Çiğdem, Çınar, Çisem, Çetin, Çağdaş, Çiçek, Çelik, Çilem, Çağıl, Çağlar, Çağhan,
    Deniz, Defne, Duygu, Derya, Dilek, Damla, Doğa, Doruk, Doğan, Dursun, Demet, Didem, Dilara, Derin, Dilan, Davut, Doğukan, Durmuş, Döndü, Dudu, Dilay, Deren, Demir, Dilber, Dicle, Dila, Dündar, Duru, Dilşad,
    Emre, Elif, Ebru, Ece, Eda, Ege, Emine, Esra, Ezgi, Erkan, Eren, Engin, Emir, Elçin, Elvan, Emel, Esin, Esma, Eylül, Ekin, Enes, Erdem, Erol, Ertan, Ertuğrul, Esat, Evren, Eymen, Ela, Elanur, Erdal, Erhan,
    Ercan, Ersin, Emrah, Ender, Esengül, Ebrar, Ecrin, Elçin, Erva, Emirhan, Ertuğ, Evrim, Ezel,
    Fatma, Fatih, Furkan, Ferhat, Fikret, Filiz, Fulya, Funda, Feyza, Fadime, Fahri, Faruk, Ferda, Feride, Ferit, Fethi, Fevzi, Figen, Fırat, Fidan, Fuat, Fazıl, Fahriye, Fikriye, Feyyaz, Fehmi, Fatoş,
    Gizem, Gül, Gülay, Gökhan, Gökçe, Gamze, Gaye, Gonca, Gökay, Gökmen, Göksel, Gülsüm, Gülşen, Günay, Güler, Gürkan, Güven, Gülizar, Gülten, Gülnur, Gülcan, Gülsen, Gülden, Güneş, Görkem, Gani, Galip, Gülbahar,
    Hakan, Hasan, Hüseyin, Hatice, Halil, Hande, Hilal, Hülya, Hale, Harun, Haluk, Hamza, Hayri, Hazal, Helin, Hira, Hümeyra, Hikmet, Hilmi, Hulusi, Handan, Hacer, Havva, Hayriye, Hüsnü, Habib, Hakkı, Hamit, Hidayet,
    Irmak, Işık, Işıl, Işın, Ilgaz, Ilgın, Ilay, İbrahim, İsmail, İlker, İlknur, İrem, İpek, İlayda, İlhan, İsmet, İdil, İnci, İlkay, İrfan, İsa, İskender, İlyas, İzzet, İclal, İkra, İlke, İnan, İnal, İzel, İlhami,
    Kemal, Kaan, Kerem, Kübra, Kader, Kadir, Kenan, Koray, Kubilay, Kudret, Kevser, Kezban, Kıvanç, Kıymet, Kamil, Kazım, Kerim, Kutay, Kumru, Kardelen, Kağan, Kayra, Kuzey, Kaya, Korhan, Kurtuluş, Köksal, Kıvılcım,
    Leyla, Levent, Lale, Lütfi, Lütfiye, Latife, Lamia, Lara, Lina, Lerzan, Leman, Lokman, Lütfü, Leyla Nur,
    Mehmet, Mustafa, Murat, Merve, Melek, Melis, Meltem, Mert, Mine, Mahmut, Mehtap, Melike, Meryem, Metin, Mithat, Muhammed, Muhammet, Mücahit, Müge, Münevver, Musa, Mümin, Mutlu, Makbule, Medine, Melda,
    Mazlum, Mesut, Mevlüt, Miraç, Muammer, Mukaddes, Müjde, Melisa, Mira, Mina, Mahir, Malik, Meral, Mehmet Ali, Muharrem, Mükerrem,
    Nur, Nihan, Nazlı, Nesrin, Nilay, Nil, Necla, Nalan, Nevin, Nermin, Nihat, Nuri, Nail, Necati, Necmettin, Nedim, Nejat, Neslihan, Nida, Nilüfer, Nisa, Nurcan, Nurhan, Nursel, Nurten, Nuray, Nurettin, Nazım, Namık,
    Naz, Naciye, Nehir, Nevzat, Nusret, Nebahat,
    Oğuz, Onur, Okan, Orhan, Osman, Oya, Ozan, Oktay, Oğuzhan, Orçun, Olcay, Oylum, Onat, Orkun, Oral, Okay, Ömer, Özge, Özlem, Özgür, Özkan, Ömür, Özcan, Özden, Öykü, Özgün, Özay, Öznur, Öner, Özer, Ödül, Ömer Faruk,
    Pınar, Pelin, Pakize, Perihan, Pervin, Polat, Pembe, Perran, Peri, Poyraz, Pamir, Pars, Petek,
    Rabia, Recep, Rıza, Rukiye, Rümeysa, Ramazan, Rahmi, Rasim, Reşat, Rüya, Reyhan, Remzi, Rıdvan, Rüstem, Rengin, Rana, Raşit, Refik, Rojda, Rüzgar, Reha, Rahim, Ruhi,
    Selin, Sevgi, Selim, Serkan, Sinan, Seda, Sena, Serap, Sibel, Sedef, Sema, Semra, Sevda, Sevim, Sinem, Songül, Sultan, Sami, Savaş, Selçuk, Semih, Serdar, Sertaç, Sezer, Sezgin, Sait, Salih, Sadık, Saadet,
    Saliha, Selda, Selma, Sevil, Seyit, Seher, Sude, Su, Sümeyye, Süleyman, Suat, Sedat, Serpil, Seren, Sevinç, Sıla, Simge, Seçil, Sencer, Senem, Saim,
    Şule, Şeyma, Şükrü, Şahin, Şenol, Şerife, Şebnem, Şeref, Şevket, Şevval, Şaban, Şafak, Şenay, Şengül, Şermin, Şükriye, Şahika, Şirin, Şimal, Şeyda, Şahan, Şakir,
    Tuğba, Tolga, Tuba, Tarık, Taner, Tamer, Tayfun, Tülay, Tuncay, Turgut, Tuna, Tunç, Tülin, Türkan, Tuğçe, Tuğrul, Taylan, Tekin, Tevfik, Timur, Toprak, Tuana, Tunahan, Tuncer, Tahir, Talha, Tansu, Teoman, Tülay,
    Umut, Uğur, Ufuk, Ulaş, Utku, Uğurcan, Ulvi, Umay, Ural, Uygar, Uras, Ulviye, Ümit, Ümran, Ülkü, Ülker, Ümmühan, Ünal, Üzeyir, Ünsal, Ülfet,
    Volkan, Veli, Vedat, Vildan, Vahit, Vural, Vasfiye, Veysel, Vecdi, Vehbi, Vesile, Vuslat, Vahide,
    Yusuf, Yasin, Yasemin, Yağmur, Yıldız, Yeliz, Yunus, Yavuz, Yılmaz, Yücel, Yeşim, Yaşar, Yiğit, Yaren, Yağız, Yalçın, Yüksel, Yunus Emre, Yaprak, Yonca, Yelda, Yalın, Yıldıray, Yakup, Yahya, Yeter,
    Zeynep, Zehra, Zafer, Zerrin, Zeki, Zübeyde, Zuhal, Zülfü, Zekiye, Zeliha, Ziya, Zümrüt, Zühal, Zekai, Zerda, Zeren, Zelal, Zekeriya, Zeycan`,
};

const fold = (s) => String(s || '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr-TR')
  .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[âà]/g, 'a').replace(/[îì]/g, 'i').replace(/[ûù]/g, 'u')
  .replace(/[^a-z0-9]/g, '');
// kategori -> (sadeleştirilmiş yazım -> sözlükteki yazım)
const MAPS = Object.fromEntries(Object.entries(W).map(([k, v]) => [k, new Map(v.split(',').map((x) => x.trim()).filter(Boolean).map((x) => [fold(x), x]).filter(([f]) => f.length >= 2))]));

// Küçük yazım hatalarına (uzun kelimelerde 1 harf) tolerans
function near(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0; let j = 0; let e = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++e > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return e + (a.length - i) + (b.length - j) <= 1;
}
// Sözlükteki karşılığı (doğru Türkçe yazımıyla) ya da null
function match(cat, word) {
  const map = MAPS[cat]; if (!map) return null;
  const w = fold(word); if (w.length < 2) return null;
  if (map.has(w)) return map.get(w);
  if (w.length >= 6) { for (const [x, orig] of map) if (x[0] === w[0] && near(w, x)) return orig; }
  return null;
}
const known = (cat, word) => !!match(cat, word);
const words = (cat) => (W[cat] || '').split(',').map((x) => x.trim()).filter(Boolean);
module.exports = { known, match, fold, words, size: () => Object.fromEntries(Object.entries(MAPS).map(([k, m]) => [k, m.size])) };
