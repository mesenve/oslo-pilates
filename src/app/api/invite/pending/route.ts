import { NextResponse } from "next/server";

const message = "Toplu davet gönderimi kapalıdır. Davetler öğrenci detayından tek tek gönderilir.";

export async function GET() {
  return NextResponse.json({ error: message }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: message }, { status: 410 });
}
