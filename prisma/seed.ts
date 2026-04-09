import { PrismaClient } from "@prisma/client"
import { seedLegalInstruments } from "./seeds/legal-instruments"
import { seedPermissions } from "./seeds/permissions"
import { seedSystemDefaults } from "./seeds/system-defaults"
import { seedDevTestUsers } from "./seeds/dev-test-users"
import { seedDevProjects } from "./seeds/dev-projects"
import { seedAdminUsers } from "./seeds/admin"

const prisma = new PrismaClient({})

const devSeeds = [
  seedLegalInstruments,
  seedPermissions,
  seedAdminUsers,
  seedDevTestUsers,
  seedDevProjects,
  seedSystemDefaults, // alweys last
]

const prodSeeds = [
  seedLegalInstruments,
  seedPermissions,
  seedAdminUsers,
  seedSystemDefaults, // alweys last
]

function chooseSeeds(arg: string): Array<(prisma: PrismaClient) => Promise<unknown>> {
  if (arg === "prod" || arg === "production") return prodSeeds
  return devSeeds
}

async function main() {
  const arg = (process.argv[2] || process.env.SEED_ENV || "dev").toLowerCase()
  console.log(`Start ${arg} seeding...`)

  const seeds = chooseSeeds(arg)

  for (const seedFn of seeds) {
    await seedFn(prisma)
  }

  console.log("Seeding finished.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
