export const STUDIO_NAME = "Oslo Pilates";

/** Replace with the studio WhatsApp number in E.164, digits only. */
export const WHATSAPP_E164 = "905551112233";

export function getExtensionWhatsAppUrl(studentName: string) {
  const text = `Merhaba Oslo Pilates, paketimi uzatmak istiyorum. (${studentName})`;
  return `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(text)}`;
}

export function getAvailabilityAnnouncement(slots: { time: string; spots: number }[]) {
  const lines = slots.map(
    (slot) => `${slot.time} ${slot.spots} kişilik`,
  );
  return [
    "Merhaba",
    ...lines,
    "Müsaitlik var. Katılmak isteyen olursa lütfen iletişime geçelim",
  ].join("\n");
}

export function getAvailabilityWhatsAppUrl(slots: { time: string; spots: number }[]) {
  return `https://wa.me/?text=${encodeURIComponent(getAvailabilityAnnouncement(slots))}`;
}

export const WELCOME_WHATSAPP_TEXT =
  `Oslo’ya hoş geldiniz, aramıza katıldığınız için çok mutluyuz :)

Size stüdyoyu rahatça kullanmanız için birkaç küçük not bırakıyoruz:

Ders gününüz ve saatiniz sizinle birlikte netleşiyor; o yüzden iade veya saat değişikliği yapamıyoruz.
Haftada 2 gün geliyorsanız 8’li, 3 gün geliyorsanız 12’li paket alıyoruz.
Her pakette 1 kez erteleme hakkınız var. Gelemeyecekseniz lütfen en az 1 gün önce yazın; geç kalırsa o dersi telafi edemiyoruz.
Ertelediğiniz dersi bir daha erteleyemiyoruz, paket bitmeden kullanmanız yeterli.
Ödemeyi kayıt sırasında alıyoruz.
Derse 1 havlu getirmenizi rica ederiz. Paketinizde 1 ders kalınca devam edip etmeyeceğinizi de bize söylemeniz çok işimize yarar.

Sizi stüdyoda görmek için sabırsızlanıyoruz. Sevgiler, Oslo Pilates Co.`;

export function toWhatsAppDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length >= 11) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return "";
}

export function getWelcomeWhatsAppUrl(phone: string) {
  const digits = toWhatsAppDigits(phone);
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(WELCOME_WHATSAPP_TEXT)}`;
}
