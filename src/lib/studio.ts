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
