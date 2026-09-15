"use client";

import { Button, Card, EmptyState, Badge } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { formatLongDate } from "@/lib/dates";
import Link from "next/link";
import { useState } from "react";

export default function NotificationsPage() {
  const { visibleStudents, reviewRenewal } = useStudio();
  const requests = visibleStudents.filter((student) => student.renewalRequest?.status === "pending");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-5">
      <header><h1 className="font-serif text-3xl">Bildirimler</h1><p className="mt-1 text-sm text-muted">Yenileme ve diğer öğrenci talepleri burada toplanır.</p></header>
      {requests.length === 0 ? <EmptyState>Bekleyen bildirim yok.</EmptyState> : requests.map((student) => {
        const request = student.renewalRequest!;
        return <Card key={student.id} className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="font-serif text-xl">{student.name}</p><p className="text-sm text-muted">Yenileme talebi · {formatLongDate(request.createdAt.slice(0, 10))}</p>{request.requestedStartDate ? <p className="mt-1 text-sm">Tercih edilen başlangıç: {formatLongDate(request.requestedStartDate)}</p> : <p className="mt-1 text-sm text-muted">Başlangıç tarihi belirtilmedi.</p>}</div><Badge tone="warning">Bekliyor</Badge></div>
          <div className="flex flex-wrap gap-2"><Link href={`/admin/ogrenciler/${student.id}`}><Button variant="secondary">Öğrenciyi aç</Button></Link><Button onClick={() => void reviewRenewal(student.id, "approved").then((result) => result.error && setError(result.error))}>Talebi kabul et</Button><Button variant="danger" onClick={() => void reviewRenewal(student.id, "rejected").then((result) => result.error && setError(result.error))}>Reddet</Button></div>
        </Card>;
      })}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
