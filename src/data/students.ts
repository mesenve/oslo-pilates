import { sortByName } from "@/lib/alphabet";
import { addDays, startOfWeekMonday, toISODate } from "@/lib/dates";
import type { AdminUser, PaymentStatus, Student } from "@/types/studio";

const currentMonday = startOfWeekMonday();
const packageStart = addDays(currentMonday, -21);
const packageEnd = addDays(currentMonday, 4);

export const DEMO_ACCOUNTS = {
  student: { email: "merve@oslo", password: "pilates" },
  admin: { email: "admin@oslo", password: "studio" },
} as const;

export function getStudents(): Student[] {
  return STUDENTS;
}

export function getStudentById(id: string): Student | undefined {
  return STUDENTS.find((student) => student.id === id);
}

export function getStudentByEmail(email: string): Student | undefined {
  return STUDENTS.find(
    (student) => student.email.toLowerCase() === email.toLowerCase(),
  );
}

export function getAdminUser(): AdminUser {
  return ADMIN;
}

const GROUP_IDS = [
  "pzt-car-cum-0915",
  "pzt-car-cum-1000",
  "pzt-car-1200",
  "pzt-per-1900",
  "sal-per-1100",
  "sal-per-1800",
  "sal-1900-cum-2000",
  "sal-per-2100",
] as const;

const PAYMENTS: PaymentStatus[] = ["paid", "paid", "pending", "overdue"];

const NOTES = [
  "Düzenli devam ediyor.",
  "Yeni kayıt, ilk ay.",
  "Akşam saati tercih ediyor.",
  "Sakatlık sonrası yavaş tempo.",
  "Paket yenileme konuşulacak.",
];

/** Demo giriş ve örnek erteleme senaryoları için sabit kayıtlar. */
const FEATURED: Student[] = [
  {
    id: "stu-merve",
    name: "Merve Şenver",
    email: "merve@oslo",
    phone: "0532 111 22 33",
    groupId: "pzt-car-cum-1000",
    note: "Son haftası. Paket uzatma konuşulacak.",
    measurements: {
      weightKg: 58,
      heightCm: 168,
      waistCm: 68,
      hipCm: 95,
      chestCm: 86,
    },
    package: {
      totalSessions: 12,
      remainingSessions: 3,
      startDate: toISODate(packageStart),
      endDate: toISODate(packageEnd),
      paymentStatus: "paid",
      isLastWeek: true,
    },
    monthlyPostponeLimit: 1,
  },
  {
    id: "stu-elif",
    name: "Elif Kaya",
    email: "elif@oslo",
    phone: "0533 222 33 44",
    groupId: "sal-per-1100",
    note: "İş seyahati nedeniyle erteleme talebi gönderdi.",
    measurements: {
      weightKg: 62,
      heightCm: 165,
      waistCm: 71,
      hipCm: 98,
      chestCm: 88,
    },
    package: {
      totalSessions: 8,
      remainingSessions: 6,
      startDate: toISODate(packageStart),
      endDate: toISODate(packageEnd),
      paymentStatus: "pending",
      isLastWeek: false,
    },
    monthlyPostponeLimit: 1,
  },
  {
    id: "stu-deniz",
    name: "Deniz Arslan",
    email: "deniz@oslo",
    phone: "0534 333 44 55",
    groupId: "sal-per-1800",
    note: "Ödeme gecikmesi hatırlatılacak.",
    measurements: {
      weightKg: 74,
      heightCm: 178,
      waistCm: 82,
      hipCm: 96,
      chestCm: 94,
    },
    package: {
      totalSessions: 8,
      remainingSessions: 2,
      startDate: toISODate(packageStart),
      endDate: toISODate(packageEnd),
      paymentStatus: "overdue",
      isLastWeek: false,
    },
    monthlyPostponeLimit: 1,
  },
  {
    id: "stu-ayse",
    name: "Ayşe Demir",
    email: "ayse@oslo",
    phone: "0535 444 55 66",
    groupId: "pzt-car-cum-0915",
    note: "Sabah grubu, düzenli devam ediyor.",
    measurements: {
      weightKg: 55,
      heightCm: 162,
      waistCm: 64,
      hipCm: 92,
      chestCm: 84,
    },
    package: {
      totalSessions: 12,
      remainingSessions: 8,
      startDate: toISODate(packageStart),
      endDate: toISODate(packageEnd),
      paymentStatus: "paid",
      isLastWeek: false,
    },
    monthlyPostponeLimit: 1,
  },
];

const DUMMY_NAMES = [
  "Ada Yılmaz",
  "Ahmet Koç",
  "Asya Aydın",
  "Banu Çelik",
  "Berk Özkan",
  "Büşra Acar",
  "Canan Eren",
  "Cem Yıldız",
  "Çağla Şahin",
  "Çiğdem Aksoy",
  "Derya Polat",
  "Ece Güneş",
  "Emre Aslan",
  "Fatma Öztürk",
  "Fırat Demir",
  "Gamze Kılıç",
  "Gökhan Aras",
  "Hale Sönmez",
  "Hakan Uçar",
  "Işıl Baran",
  "İpek Yaman",
  "İrem Koç",
  "Jale Ersoy",
  "Kardelen Aslan",
  "Kerem Uysal",
  "Lale Çetin",
  "Leyla Akın",
  "Melis Doğan",
  "Nazlı Erdem",
  "Nilay Korkmaz",
  "Oya Tekin",
  "Onur Şen",
  "Özge Kaplan",
  "Ömer Çakır",
  "Pınar Avcı",
  "Pelin Sarı",
  "Rana Güler",
  "Selin Yavuz",
  "Şebnem Kaya",
  "Zeynep Acar",
  "Tuğçe Demirtaş",
  "Tuna Ergin",
  "Umut Kaya",
  "Ülkü Yıldırım",
  "Vildan Öz",
  "Yağmur Keskin",
] as const;

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ş", "s")
    .replaceAll("ü", "u")
    .replaceAll(" ", "-");
}

function dummyStudent(name: string, index: number): Student {
  const slug = slugify(name);
  const first = slug.split("-")[0] ?? slug;
  const remaining = 3 + (index % 8);
  const total = remaining > 8 ? 12 : 8;
  return {
    id: `stu-${slug}`,
    name,
    email: `${first}@oslo`,
    phone: `053${2 + (index % 8)} ${String(500 + index).padStart(3, "0")} ${String(10 + index).padStart(2, "0")} ${String(20 + index).padStart(2, "0")}`,
    groupId: GROUP_IDS[index % GROUP_IDS.length],
    note: NOTES[index % NOTES.length],
    measurements: {
      weightKg: 52 + (index % 24),
      heightCm: 158 + (index % 22),
      waistCm: 62 + (index % 18),
      hipCm: 88 + (index % 14),
      chestCm: 80 + (index % 16),
    },
    package: {
      totalSessions: total,
      remainingSessions: remaining,
      startDate: toISODate(packageStart),
      endDate: toISODate(packageEnd),
      paymentStatus: PAYMENTS[index % PAYMENTS.length],
      isLastWeek: remaining <= 3,
    },
    monthlyPostponeLimit: 1,
  };
}

const STUDENTS: Student[] = sortByName([
  ...FEATURED,
  ...DUMMY_NAMES.map(dummyStudent),
]);

const ADMIN: AdminUser = {
  id: "admin-1",
  name: "Oslo Hoca",
  email: "admin@oslo",
};
