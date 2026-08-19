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
  "Oslo'ya hoşgeldin! Stüdyomuzla ilgili ufak bir bilgilendirme metni.";

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
