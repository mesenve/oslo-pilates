"use client";

import { PasswordField } from "@/components/form-fields";
import { Button, Card } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { fetchInviteByToken, type InviteLookup } from "@/lib/invite-client";
import { findStudentByInviteToken, isInviteValid } from "@/lib/student-auth";
import { STUDIO_NAME } from "@/lib/studio";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

export default function DavetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
          Yükleniyor…
        </div>
      }
    >
      <DavetForm />
    </Suspense>
  );
}

function DavetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const { students, activateStudentInvite } = useStudio();
  const localStudent = token ? findStudentByInviteToken(students, token) : undefined;
  const [inviteLookup, setInviteLookup] = useState<InviteLookup | null>(null);
  const [lookupError, setLookupError] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) {
      setInviteLookup({ found: false, expired: false, active: false });
      return;
    }

    let cancelled = false;
    setLookupError(false);
    setInviteLookup(null);

    fetchInviteByToken(token)
      .then((result) => {
        if (!cancelled) setInviteLookup(result);
      })
      .catch(() => {
        if (!cancelled) setLookupError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const studentName =
    inviteLookup?.student?.name ?? localStudent?.name ?? "";
  const isActive =
    inviteLookup?.active === true || localStudent?.accountStatus === "active";
  const isExpired =
    inviteLookup?.found === true
      ? inviteLookup.expired
      : localStudent
        ? !isInviteValid(localStudent)
        : false;
  const isValidInvite =
    inviteLookup?.found === true
      ? !inviteLookup.expired && !inviteLookup.active
      : Boolean(localStudent && isInviteValid(localStudent));
  const showInvalid =
    !token ||
    lookupError ||
    (inviteLookup !== null &&
      !inviteLookup.found &&
      !localStudent &&
      inviteLookup !== null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await activateStudentInvite(token, password, confirmPassword);
    if (result.error) {
      setPending(false);
      setError(result.error);
      return;
    }
    router.replace("/ogrenci");
  }

  if (!token) {
    return (
      <InviteShell>
        <InvalidInvite />
      </InviteShell>
    );
  }

  if (inviteLookup === null && !lookupError) {
    return (
      <InviteShell>
        <p className="text-center text-sm text-muted">Davet kontrol ediliyor…</p>
      </InviteShell>
    );
  }

  if (showInvalid) {
    return (
      <InviteShell>
        <InvalidInvite />
      </InviteShell>
    );
  }

  if (isActive) {
    return (
      <InviteShell>
        <div className="space-y-3 text-center">
          <h1 className="font-serif text-2xl">Hesabın zaten aktif</h1>
          <p className="text-sm text-muted">
            Merhaba {studentName}, üyeliğin daha önce tamamlanmış.
          </p>
          <Link href="/giris" className="inline-flex text-sm font-medium text-accent">
            Giriş yap →
          </Link>
        </div>
      </InviteShell>
    );
  }

  if (isExpired) {
    return (
      <InviteShell>
        <div className="space-y-3 text-center">
          <h1 className="font-serif text-2xl">Davet süresi dolmuş</h1>
          <p className="text-sm text-muted">
            Merhaba {studentName}, linkin süresi dolmuş. Eğitmeninden yeni davet
            linki isteyebilirsin.
          </p>
          <Link href="/giris" className="inline-flex text-sm font-medium text-accent">
            Giriş sayfasına dön →
          </Link>
        </div>
      </InviteShell>
    );
  }

  if (!isValidInvite) {
    return (
      <InviteShell>
        <InvalidInvite />
      </InviteShell>
    );
  }

  return (
    <InviteShell>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="text-center">
          <h1 className="font-serif text-2xl">{STUDIO_NAME}&apos;e Hoşgeldin!</h1>
          <p className="mt-2 text-sm text-muted">
            Merhaba {studentName}, üyelik adımını tamamlamak için şifreni belirle.
          </p>
        </div>
        <PasswordField
          id="password"
          label="Şifre"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={6}
          required
        />
        <PasswordField
          id="confirm-password"
          label="Şifre tekrar"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          minLength={6}
          required
        />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Hesap oluşturuluyor…" : "Hesabımı oluştur"}
        </Button>
      </form>
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/giris" className="mb-5 block text-center">
          <p className="font-serif text-3xl">{STUDIO_NAME}</p>
        </Link>
        <Card className="p-6">
          <Image
            src="/giris/sun.png"
            alt=""
            aria-hidden
            width={1024}
            height={1024}
            className="mx-auto mb-4 h-32 w-auto object-contain"
            priority
          />
          {children}
        </Card>
      </div>
    </div>
  );
}

function InvalidInvite() {
  return (
    <div className="space-y-3 text-center">
      <h1 className="font-serif text-2xl">Davet linki geçersiz</h1>
      <p className="text-sm text-muted">
        Link hatalı veya süresi dolmuş olabilir. Stüdyondan yeni davet isteyebilirsin.
      </p>
      <Link href="/giris" className="inline-flex text-sm font-medium text-accent">
        Giriş sayfasına dön →
      </Link>
    </div>
  );
}
