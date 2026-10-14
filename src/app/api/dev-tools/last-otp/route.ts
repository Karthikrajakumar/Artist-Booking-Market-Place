import { NextRequest, NextResponse } from "next/server";
import { smsAdapter } from "@/server/providers/sms/fake";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ error: "Missing 'phone' query parameter." }, { status: 400 });
  }

  const code = smsAdapter.getLastOtp(phone);
  if (!code) {
    return NextResponse.json({ error: "No OTP found for phone." }, { status: 404 });
  }

  return NextResponse.json({ phone, code });
}
