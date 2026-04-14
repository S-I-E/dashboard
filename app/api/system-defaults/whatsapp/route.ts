import { NextResponse } from "next/server"
import prisma from "@/lib/config/db"

export async function GET() {
  try {
    const entry = await prisma.systemDefaults.findUnique({ where: { slug: "legal_support_whatsapp" } })
    const value = entry?.value ?? process.env.NEXT_PUBLIC_LEGAL_SUPPORT_PHONE ?? null
    return NextResponse.json({ phone: value })
  } catch (err) {
    console.error("Failed to fetch system default whatsapp:", err)
    return NextResponse.json({ phone: null }, { status: 500 })
  }
}
