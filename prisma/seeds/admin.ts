import { PrismaClient } from "../client"
import type { User } from "@prisma/client"

type UserSeed = {
  name: string
  email: string
  roleSlug: string
  query?: (prisma: PrismaClient) => Promise<{ roleId?: string }>
}

export async function seedAdminUsers(prisma: PrismaClient) {
  console.log("Seeding Admin Users...")

  const seeds: UserSeed[] = [
    {
      name: "admin",
      email: "admin@ufr.edu.br",
      roleSlug: "admin",
      query: async (p) => {
        const r = await p.role.findFirst({ where: { slug: "admin" }, select: { id: true } })
        return { roleId: r?.id }
      },
    },
  ]

  const created: User[] = []

  for (const s of seeds) {
    const { roleId } = (s.query ? await s.query(prisma) : { roleId: undefined }) || {}

    if (!roleId) {
      console.log(`Role for ${s.email} (${s.roleSlug}) not found; skipping user creation.`)
      continue
    }

    const existing = await prisma.user.findUnique({ where: { email: s.email } })
    if (existing) {
      created.push(existing)
      continue
    }

    const user = await prisma.user.create({
      data: {
        name: s.name,
        email: s.email,
        emailVerified: new Date(),
        firstAccess: false,
        userRoles: {
          create: {
            roleId,
          },
        },
      },
    })

    created.push(user)
  }

  return created
}
