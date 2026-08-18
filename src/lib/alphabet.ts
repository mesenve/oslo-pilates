export const TURKISH_LETTERS = [
  "A",
  "B",
  "C",
  "Ç",
  "D",
  "E",
  "F",
  "G",
  "Ğ",
  "H",
  "I",
  "İ",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "Ö",
  "P",
  "R",
  "S",
  "Ş",
  "T",
  "U",
  "Ü",
  "V",
  "Y",
  "Z",
] as const;

export type TurkishLetter = (typeof TURKISH_LETTERS)[number];

export function firstLetter(name: string): TurkishLetter {
  const raw = name.trim().charAt(0).toLocaleUpperCase("tr-TR");
  return (TURKISH_LETTERS as readonly string[]).includes(raw)
    ? (raw as TurkishLetter)
    : "A";
}

export function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
