import { Card } from "@/components/ui";
import { STUDIO_NAME } from "@/lib/studio";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-dvh px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#f48fb1] via-[#ec407a] to-accent px-8 py-10 text-white shadow-[0_18px_40px_rgba(194,24,91,0.28)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/80">
            Stüdyo sitesi
          </p>
          <h1 className="mt-3 font-serif text-5xl">{STUDIO_NAME}</h1>
          <p className="mt-3 max-w-xl text-white/85">
            Öğrenci veya hoca kartından panele gir.
          </p>
        </section>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <EntryCard
            title="Hoca girişi"
            body="Öğrenciler, takvim ve talepler."
            href="/giris?rol=admin"
            image="/kediler/hoca.png"
            imageAlt="Pilates hocası kedi"
          />
          <EntryCard
            title="Öğrenci girişi"
            body="Program, yoklama ve erteleme."
            href="/giris?rol=ogrenci"
            image="/kediler/ogrenci.png"
            imageAlt="Pilates öğrencisi kedi"
          />
        </div>
      </div>
    </div>
  );
}

function EntryCard({
  title,
  body,
  href,
  image,
  imageAlt,
}: {
  title: string;
  body: string;
  href: string;
  image: string;
  imageAlt: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="h-full p-6 transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(194,24,91,0.14)]">
        <Image
          src={image}
          alt={imageAlt}
          width={1024}
          height={1024}
          className="mx-auto h-auto w-full max-h-72 object-contain"
          priority
        />
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Panele gir
        </p>
        <h2 className="mt-2 font-serif text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <span className="mt-4 inline-flex text-sm font-medium text-accent">
          Devam et →
        </span>
      </Card>
    </Link>
  );
}
