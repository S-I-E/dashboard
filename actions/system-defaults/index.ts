"use server"

import { getSystemDefault } from "@/lib/services/defaults"

export async function getSystemDefaultValue(slug: string): Promise<string | null> {
  const def = await getSystemDefault(slug)
  return def?.value ?? null
}

export async function getSystemDefaultId(slug: string): Promise<string | undefined> {
  return await getSystemDefault(slug).then((d) => d?.referenceId ?? d?.value)
}

export async function getLegalSupportWhatsApp(): Promise<string | null> {
  const v = await getSystemDefaultValue("legal_support_whatsapp")
  return v
}
