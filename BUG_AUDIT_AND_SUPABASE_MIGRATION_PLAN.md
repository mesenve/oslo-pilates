# Oslo Pilates — Bug Denetimi ve Veri Saklama Geçiş Planı

> Durum: Denetim tamamlandı; Supabase şeması/RLS ve veri aktarımı uygulanıyor. Bu doküman geliştirme kontrol listesi olarak korunur.

**15 Eylül 2026 aktarım notu:** Canlı Blob verisi 49 kayıt olarak doğrulandı; aynı öğrencinin eski ve düzeltilmiş e-posta ile oluşturulmuş iki kaydı tek kayda indirildi. Sonuçta Supabase’e 48 öğrenci, 548 ders satırı, 24 özel grup, 4 erteleme talebi, 45 davet ve 10 yoklama işareti aktarıldı. Yetim öğrenci/seans/davet ve yinelenen e-posta kontrolleri temiz geçti.

## 1. Ece Hoca’nın kaydetme/düzenleme akışı neden bozuluyor?

### Mevcut akış

1. Uygulama açıldığında `src/lib/store.ts` içindeki başlangıç state’i yüklenir.
2. Tarayıcıda `oslo-pilates-demo-v13` anahtarı varsa, uygulama bu JSON’u önce okur. Bu, tarayıcının son bildiği öğrenci, seans, grup ve erteleme kopyasıdır.
3. Kullanıcı hoca veya admin olarak oturum açınca `StudioProvider`, `/api/studio` üzerinden canlı snapshot’ı ister.
4. Canlı cevap geldikten sonra state birleştirilir ve `enableStudioSnapshotPersistence()` çağrılır.
5. Öğrenci kaydetme/düzenleme, önce React state’ini ve `localStorage` kopyasını değiştirir.
6. Hoca/admin oturumu aktifse aynı anda `/api/studio` adresine bütün snapshot gönderilir:

   - öğrenciler
   - arşiv öğrencileri
   - seanslar
   - erteleme talepleri
   - özel gruplar

7. Sunucu bu snapshot’ı canlı veri alanına yazar. Kayıt işlemi kullanıcıya sunucu cevabı beklenmeden tamamlanmış gibi görünür.

### BLOB ile tarayıcı kopyasının ilişkisi

Tarayıcı ve BLOB iki ayrı katmandır:

```text
Tarayıcı localStorage
        ↓  (kaydetme isteği)
Next.js /api/studio
        ↓
Netlify Blobs: oslo-pilates-studio / snapshot:current
```

`localStorage` kalıcı ana veri tabanı değildir; hızlı açılış ve geçici çevrimdışı görünüm için kullanılan istemci kopyasıdır. Fakat mevcut uygulamada bu kopya, kaydetme isteğinin kaynağı da olduğu için eski bir tarayıcı verisi canlı veriyi etkileyebilmektedir.

Netlify Blobs ise sunucudaki canlı ana kayıttır. Ancak bu kayıtta tablo, satır, transaction, sürüm ve satır bazlı çakışma çözümü yoktur. Uygulama tek bir büyük JSON snapshot’ı okuyup tekrar yazmaktadır.

### Önceki öğrencilerin ezilmesi nasıl oluştu?

Örnek:

```text
09:00  A bilgisayarı canlı veriyi okur: 48 öğrenci
09:05  B bilgisayarı canlı veriyi okur: 48 öğrenci
09:10  A yeni öğrenciyi ekler: 49 öğrenci
09:11  B, hâlâ eski 48 öğrencilik kopyasıyla Meral’i düzenler
09:11  B bütün snapshot’ı gönderir
09:11  Sunucu B’nin eski listesini kabul ederse A’nın yeni kaydı ve aradaki değişiklikler ezilir
```

Bu uygulamada mevcut koruma yalnızca gelen toplam öğrenci sayısı mevcut sayıdan **iki veya daha fazla azsa** isteği reddediyor. Liste aynı büyüklükteyse eski kayıt hâlâ kabul edilebiliyor. Liste yalnızca bir öğrenci eksikse de istek kabul edilebiliyor. Bu nedenle mevcut koruma gerçek bir çakışma çözümü değil, kaba bir hasar önleme filtresidir.

Ek olarak:

- `setStudioState` sunucu isteğini `await` etmiyor.
- 409/500 hataları çoğu state değişiminde kullanıcıya gösterilmiyor.
- Form, sunucu kaydı kesinleşmeden detay sayfasına yönlendiriyor.
- Periyodik canlı senkronizasyon eski veya yeni veriyi tekrar state’e yazabiliyor.
- Aynı anda iki hoca/admin işlem yaptığında son yazan bütün snapshot’ı değiştirebiliyor.

Bu yüzden Ece Hoca’nın ekranında “kaydetmiş gibi” görünen bilgi tarayıcıda doğru, canlıda eski olabilir; başka bir bilgisayar açıldığında eski kayıtlar geri gelmiş gibi görünür.

## 2. Veriler şu anda nereye kaydediliyor?

### Canlı ortam

| Veri | Saklama alanı | Anahtar biçimi |
|---|---|---|
| Öğrenciler, arşiv, seanslar, gruplar, erteleme talepleri | Netlify Blobs | `oslo-pilates-studio / snapshot:current` |
| Yoklama işaretleri | Netlify Blobs | `oslo-pilates-attendance / mark:<sessionId>` |
| Davet ve aktivasyon kaydı | Netlify Blobs | `oslo-pilates-invites / token:<token>` |
| Öğrenci-davet indeksi | Netlify Blobs | `oslo-pilates-invites / student:<studentId>` |
| E-posta gönderimi | Resend API | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |

### Yerel fallback ve tarayıcı kopyası

- Yerel sunucu fallback’i: `.data/studio.json`, `.data/attendance.json`, `.data/invites.json`
- Tarayıcı kopyası: `localStorage` içinde `oslo-pilates-demo-v13`
- Giriş hatırlama bilgisi: ayrıca tarayıcı `localStorage`’ında

README hâlâ verilerin yalnızca `localStorage`’da tutulduğunu söylüyor; bu güncel canlı mimariyi doğru anlatmıyor ve ekip için ayrıca bir dokümantasyon hatasıdır.

## 3. Supabase’e geçmek iyi bir çözüm mü?

Evet. Bu uygulamanın veri modeli için Supabase PostgreSQL + Supabase Auth, Netlify Blobs’tan daha uygun bir ana veri katmanı olur.

### Neden daha uygun?

- Öğrenci, seans, grup, yoklama ve erteleme talebi ayrı tablolarda tutulabilir.
- Her öğrenci tek bir `id` ile güncellenir; bütün snapshot’ın üzerine yazılması gerekmez.
- PostgreSQL transaction’ları ile öğrenci + seans değişikliği birlikte kaydedilebilir.
- Unique constraint ile e-posta ve öğrenci kimliği tekrarları veritabanında engellenebilir.
- Foreign key’ler yetim seans ve yetim davet kayıtlarını azaltır.
- Row Level Security ile Ece, Elif ve Delfin’in hangi öğrencileri görebileceği veritabanında da zorlanır.
- Realtime gerekiyorsa yoklama ve talepler hoca ekranına güncellenebilir.
- Supabase Auth öğrenci/hoca oturumlarını mevcut elle imzalanan cookie akışından daha sağlam yönetebilir.
- Sorgu, filtreleme, son kayıt tarihi ve raporlama kolaylaşır.

Supabase’in güncel Next.js yaklaşımı cookie tabanlı SSR Auth ve RLS kullanıyor. Yeni public tabloların Data API’ye otomatik açılmayacağı güncel politika değişikliği nedeniyle tablolar ayrıca açıkça expose edilmeli; her exposed tabloda RLS etkinleştirilmeli. Yetkilendirme `user_metadata` gibi kullanıcı tarafından değiştirilebilir alanlara değil, güvenilir uygulama metadata’sına veya ilişkisel tablolara dayanmalı.

### BLOB tamamen gereksiz mi?

Hayır, ama ana veritabanı olarak kullanılmamalı.

Netlify Blobs şu işler için hâlâ kullanılabilir:

- küçük, geçici cache’ler
- oluşturulmuş dosyalar veya export’lar
- idempotency kayıtları
- nadiren okunan yapılandırma

Bu uygulamada öğrenci ve seansların tamamını tek JSON olarak tutmak için uygun değil. Çünkü relational sorgu, transaction, conflict detection, audit log ve satır bazlı yetki ihtiyacı var.

### Önerilen hedef mimari

```text
Next.js API / Server Actions
          ↓
Supabase Auth + PostgreSQL + RLS
          ↓
İsteğe bağlı Supabase Realtime

Resend: yalnızca e-posta gönderimi
Netlify: yalnızca hosting/deployment
Netlify Blobs: ana veri değil, opsiyonel cache/export
```

### Geçiş kararı

Supabase’e geçişi öneriyorum; fakat doğrudan canlı veriyi taşıyarak başlanmamalı. Güvenli sıra:

1. Şema ve rol/ilişki modeli tasarlanmalı.
2. RLS politikaları yazılmalı ve test edilmeli.
3. Mevcut BLOB snapshot’ı salt-okunur şekilde export edilip normalize edilmeli.
4. Duplicate öğrenci/e-posta kayıtları kullanıcı onayıyla eşleştirilmeli.
5. Staging ortamında çift yazma veya kontrollü shadow read yapılmalı.
6. Yoklama, erteleme ve öğrenci düzenleme akışları tek tek Supabase’e alınmalı.
7. Doğrulama tamamlanınca BLOB yazma kapatılmalı.

## 4. Buggy akışlar ve geliştirme prompt’ları

### 1. Snapshot çakışması öğrenci listesini ezebiliyor — Kritik

**Sorun:** Eski tarayıcı kopyası, güncel canlı snapshot’ın tamamını değiştirebiliyor. Mevcut sayı filtresi gerçek sürüm kontrolü değil.

**Çözüm:** Öğrenci bazlı güncelleme, `version`/`updatedAt` kontrolü ve transaction kullanılmalı. Çakışmada kayıt reddedilip güncel veri yeniden yüklenmeli.

**Geliştirme prompt’u:**

> `POST /api/studio` tam snapshot yazmak yerine öğrenci, seans, grup ve erteleme değişikliklerini atomik kaynak bazlı endpoint’lere ayır. Her kaynak için version veya updatedAt kontrolü uygula. Eski istemci sürümüyle gelen isteği 409 döndür, veriyi ezme ve kullanıcıya güncel veriyi yeniden yükleme seçeneği göster.

### 2. Kaydetme başarısız olsa bile başarı gibi görünüyor — Kritik

**Sorun:** `setStudioState` içindeki fetch beklenmiyor; form sunucu cevabı gelmeden yönlendiriliyor.

**Geliştirme prompt’u:**

> Öğrenci ekleme ve düzenleme işlemlerini async yap. Sunucu 2xx dönmeden başarı callback’i çalışmasın. 409, 401, 403 ve 500 yanıtlarını Türkçe ve alan bazlı hata olarak göster; başarısız istekte form verisini koru.

### 3. Ağ hatasında eski veri sessizce gösteriliyor — Yüksek

**Sorun:** Senkronizasyon hataları çoğunlukla sessizce yakalanıyor; kullanıcı eski tarayıcı verisini güncel sanabiliyor.

**Geliştirme prompt’u:**

> Canlı snapshot alınamazsa demo/eski localStorage verisini sessizce güncel gibi gösterme. Son başarılı senkronizasyon zamanını, bağlantı durumunu ve Yeniden dene aksiyonunu göster; kritik ekranlarda düzenleme butonlarını geçici olarak kilitle.

### 4. Aynı sayıda eski snapshot yine de güncel veriyi ezebiliyor — Kritik

**Sorun:** Liste boyutu aynıysa mevcut koruma çalışmıyor.

**Geliştirme prompt’u:**

> Snapshot uzunluğu yerine immutable revision veya ETag tabanlı compare-and-swap uygula. Her yazmada beklenen revision zorunlu olsun; uyuşmazlıkta veri yazılmasın ve merge ekranı açılsın.

### 5. Öğrenci erteleme talebi canlıya kaydedilmiyor — Kritik

**Sorun:** `requestPostpone` yalnızca client state’i değiştiriyor; öğrenci rolü için kalıcı API kaydı yok.

**Geliştirme prompt’u:**

> Öğrenci erteleme talebi için POST `/api/postpone` endpoint’i oluştur. Oturumdaki öğrenci kimliğini kullan, client’tan gelen öğrenci kimliğine güvenme, talebi veritabanına yaz ve hocanın pending ekranında görünmesini sağla.

### 6. Erteleme için 24 saat kuralı yalnızca istemcide — Kritik

**Sorun:** 24 saat kontrolü sunucu tarafından zorlanmıyor ve saat dilimi ortama göre değişebiliyor.

**Geliştirme prompt’u:**

> Erteleme uygunluğunu sunucuda Europe/Istanbul saat diliminde hesapla. Ders başlangıç tarih-saatini gerçek timezone ile üret; 24 saatten az kalmışsa isteği reddet ve kullanıcıya kalan süreyi göster.

### 7. Erteleme checkbox’ı hak hesabına katılmıyor — Yüksek

**Sorun:** `postponeLessonUsed` kaydediliyor ama kalan hak hesabı bu alanı okumuyor.

**Geliştirme prompt’u:**

> `postponeLessonUsed` alanını kaldır veya tek bir hak hesaplama modeline dahil et. Checkbox işaretlendiğinde ilgili ayın kalan hakkını tutarlı biçimde güncelle; ekran, API ve rapor aynı hesaplayıcıyı kullansın.

### 8. Yeni öğrencinin aylık erteleme hakkı boş değerle 0 oluyor — Yüksek

**Sorun:** Boş input `Number("") === 0` olarak kaydediliyor; arayüz varsayılanı 1 söylüyor.

**Geliştirme prompt’u:**

> Aylık erteleme alanında boş değeri 1 olarak normalize et. Minimum, maksimum ve integer doğrulamasını hem formda hem API’de yap; kaydetmeden önce oluşan değeri kullanıcıya göster.

### 9. Aktif öğrencinin e-postası değiştirilince giriş kopuyor — Kritik

**Sorun:** Aktif öğrencinin e-postası değişiyor ancak davet/şifre hesabı yeni e-postaya taşınmıyor.

**Geliştirme prompt’u:**

> Aktif öğrencinin e-posta değişikliğini hesap kimliğiyle birlikte transaction içinde güncelle. Yeni e-posta doğrulaması yap; hesabı geçici olarak doğrulama bekliyor durumuna al veya güvenli hesap taşıma akışı uygula.

### 10. Eğitmen öğrenci eklediğinde davet maili yetki hatası veriyor — Yüksek

**Sorun:** Davet POST endpoint’i yalnızca super admin rolünü kabul ediyor; hoca kendi öğrencisine davet gönderemiyor.

**Geliştirme prompt’u:**

> Davet gönderiminde eğitmenin yalnızca kendisine atanmış öğrenci için işlem yapmasına izin ver. API’de sahiplik kontrolü uygula; super admin tüm öğrencileri, eğitmen yalnızca yetkili olduğu öğrencileri yönetebilsin.

### 11. Öğrenci localStorage şifresiyle sunucu oturumu olmadan giriş yapabiliyor — Kritik

**Sorun:** Client, localStorage’daki şifreyle API’ye gitmeden kullanıcıyı giriş yapmış sayabiliyor; sonraki sunucu işlemleri 403 olabilir.

**Geliştirme prompt’u:**

> Gerçek öğrenci girişi her zaman sunucu Auth endpoint’inden veya Supabase Auth’tan geçsin. LocalStorage yalnızca e-posta hatırlamak için kullanılsın; şifre ve kullanıcı yetkisi istemciden doğrulanmasın.

### 12. Yoklama reddi sonradan tekrar bekliyor görünebilir — Yüksek

**Sorun:** `attend_pending` → `upcoming` düşüşü rank kontrolü nedeniyle senkronizasyonda uygulanmıyor.

**Geliştirme prompt’u:**

> Yoklama durum geçişlerini açık bir state machine olarak tanımla. Reddetme olayını zaman damgasıyla kaydet; daha yeni bir `upcoming` reddi eski `attend_pending` kaydını geçersiz kılabilsin.

### 13. Yoklama API’sinde eğitmen sahiplik kontrolü eksik — Kritik

**Sorun:** `/api/attendance` eğitmenin ilgili öğrenciye yetkisini doğrulamadan işaret yazabiliyor.

**Geliştirme prompt’u:**

> Attendance POST içinde gerçek session, student ve instructor ilişkisini sunucudan yükle. `canManageStudent` benzeri kontrolü API’de zorunlu kıl; client’tan gelen studentId ve groupId alanlarını yetki kaynağı kabul etme.

### 14. Eğitmenin “ertelendi” işareti talep kaydından kopuyor — Yüksek

**Sorun:** Seans durumu yazılıyor fakat ilgili postpone request her zaman kalıcı olarak oluşturulmuyor.

**Geliştirme prompt’u:**

> Eğitmen ertelemesi için session status ve postpone request’i tek transaction’da kaydet. Yeniden açılışta seans, hak hesabı ve erteleme geçmişi aynı kaynaktan üretilecek şekilde modeli sadeleştir.

### 15. İki eşzamanlı kayıt son yazanla diğerini ezebiliyor — Kritik

**Sorun:** BLOB üzerinde transaction veya satır bazlı kilit yok.

**Geliştirme prompt’u:**

> Öğrenci, seans ve talepleri ayrı Supabase tablolarına taşı. Güncellemede transaction, unique constraint ve revision kontrolü kullan; aynı kayda iki eşzamanlı değişiklikte otomatik ezme yapma.

### 16. Özel gruplar gün seçme sırasına göre çoğalabiliyor — Orta

**Sorun:** Günler aynı olsa bile farklı seçim sırası farklı groupId üretebiliyor.

**Geliştirme prompt’u:**

> Özel program ID’si üretmeden önce günleri Pazartesi-Pazar kanonik sırasına göre sırala ve saat formatını normalize et. Aynı gün/saat kombinasyonunda mevcut grubu yeniden kullan.

### 17. Arşivden geri yüklemede özel grup kaybolabiliyor — Orta

**Sorun:** Restore akışı `customGroup` kaydını add/update akışı gibi eklemiyor.

**Geliştirme prompt’u:**

> Öğrenci restore, create ve update işlemlerinin özel grup oluşturma mantığını ortaklaştır. Restore sırasında grup yoksa transaction içinde oluştur; seanslar aynı groupId’ye bağlansın.

### 18. Geçmiş dersler otomatik gelmiş sayılabiliyor — Yüksek

**Sorun:** Paket başlangıcı geçmişteyse geçmiş seanslar otomatik `attended` üretiliyor.

**Geliştirme prompt’u:**

> Geçmiş seansları varsayılan olarak otomatik attended yapma. Geçmiş dersleri “işlenmemiş” statüsüyle üret veya kayıt formunda “geçmiş dersleri geldi say” seçimini açıkça kullanıcıya sor.

### 19. Yeni kayıt modalı aynı daveti birden fazla mail gönderebilir — Yüksek

**Sorun:** Modal effect’i öğrenci veya seans nesnesi değiştiğinde tekrar tetiklenebilir.

**Geliştirme prompt’u:**

> Davet gönderimini token bazlı idempotent yap. Modal içinde tek seferlik gönderim kilidi kullan; aynı token için ikinci e-posta gönderilmesini engelle ve gönderim sonucunu sunucudan oku.

### 20. Davet kaydı ile e-posta sonucu ayrışıyor — Orta

**Sorun:** Davet önce kaydediliyor, Resend çağrısı sonra yapılıyor. Mail başarısızken davet mevcut kalıyor.

**Geliştirme prompt’u:**

> Davet kaydına `mailStatus` ve `lastAttemptAt` alanları ekle. `pending`, `sent`, `failed` durumlarını göster; retry aynı davet kaydını kullansın ve yeni token üretmesin.

### 21. Öğrenci şifreleri düz metin saklanıyor — Kritik güvenlik

**Sorun:** Davet blob’larında parola düz metin tutuluyor; localStorage da parola barındırabiliyor.

**Geliştirme prompt’u:**

> Öğrenci parolalarını Argon2id veya scrypt ile hashle. API ve snapshot yanıtlarından parolaları tamamen çıkar. Eski düz metin parolaları tek kullanımlık güvenli migration ile dönüştür ve sonrasında sil.

### 22. Davet token’ı tahmin edilebilir — Yüksek güvenlik

**Sorun:** Token `Date.now()` ve `Math.random()` ile üretiliyor.

**Geliştirme prompt’u:**

> Davet token’ını yalnızca sunucuda `crypto.randomUUID()` veya `randomBytes` ile üret. Token için expiry, tek kullanımlık aktivasyon ve rate limit uygula; token değerini log’lara yazma.

### 23. API öğrenci parola alanını istemciye sızdırabilir — Kritik güvenlik

**Sorun:** Studio GET yalnızca `staffPasswords` alanını çıkarıyor; `studentPasswords` varsa response’a dahil olabilir.

**Geliştirme prompt’u:**

> API response DTO’larını whitelist mantığıyla oluştur. `staffPasswords`, `studentPasswords`, invite password ve token alanları hiçbir rol için snapshot response’a dahil edilmesin. Yanıt sözleşmesi için otomatik test ekle.

### 24. Davet ve kalıcı silme akışları yetim kayıt bırakabiliyor — Orta/Yüksek

**Sorun:** Invite kaydı yazılırken eski token önce siliniyor; sonraki yazma başarısız olursa davet kaybolabiliyor. Kalıcı silmede token/index temizliği garanti değil.

**Geliştirme prompt’u:**

> Davet oluşturma, yenileme, aktivasyon ve kalıcı silme işlemlerini atomik/idempotent tasarla. Önce yeni kaydı güvenli şekilde yaz, index’i güncelle, eski kaydı yalnızca başarıdan sonra temizle. Öğrenci silinince invite token ve index için cascade cleanup uygula.

## 5. Önceliklendirme

İlk geliştirme dalgası:

1. Snapshot çakışması ve kaydetme sonucunun beklenmesi
2. Öğrenci erteleme API’si ve 24 saat sunucu doğrulaması
3. Attendance API sahiplik kontrolü ve reddetme state machine’i
4. Öğrenci girişinin localStorage bypass’ından çıkarılması
5. Düz metin parola/token güvenlik düzeltmeleri
6. E-posta değişikliğinde hesap taşıma
7. Supabase şema + Auth + RLS staging kurulumu

Bu maddeler çözülmeden yeni özellik eklemek, aynı veri kaybı ve “ekranda kaydoldu ama canlıda yok” sorunlarını tekrar üretme riski taşır.
