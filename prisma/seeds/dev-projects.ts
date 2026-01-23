import { PrismaClient, ProjectStatus, LegalInstrumentStatus, LegalInstrumentType } from "../client"

export async function seedDevProjects(prisma: PrismaClient) {
  console.log("Seeding Dev Projects for 'teste'...")

  const user = await prisma.user.findUnique({
    where: { email: "teste@ufr.edu.br" },
  })

  if (!user) {
    console.error("User 'teste@ufr.edu.br' not found. Skipping dev projects.")
    return
  }

  const instrumentVersion = await prisma.legalInstrumentVersion.findFirst()
  if (!instrumentVersion) {
    console.error("No LegalInstrumentVersion found. Skipping dev projects.")
    return
  }

  const projectStatuses = Object.values(ProjectStatus)
  const now = new Date()

  for (let i = 1; i <= 30; i++) {
    const status = projectStatuses[Math.floor(Math.random() * projectStatuses.length)]
    const daysAgo = Math.floor(Math.random() * 180) // Last 6 months
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)

    const instrumentTypes = Object.values(LegalInstrumentType)
    const proposedInstrumentType = instrumentTypes[Math.floor(Math.random() * instrumentTypes.length)]

    // Some projects have submittedAt, others don't (if DRAFT)
    const submittedAt = status !== ProjectStatus.DRAFT ? new Date(createdAt.getTime() + 1000 * 60 * 60 * 2) : null

    let approvalOpinion = null
    if (status === ProjectStatus.APPROVED) {
      approvalOpinion = `Projeto ${i} aprovado após análise técnica e jurídica detalhada. Atende a todos os requisitos.`
    } else if (status === ProjectStatus.REJECTED) {
      approvalOpinion = `Projeto ${i} rejeitado devido à falta de clareza nos objetivos e cronograma inviável.`
    }

    const data = {
      slug: `teste-${i.toString().padStart(2, "0")}`,
      title: `Projeto de Pesquisa ${i.toString().padStart(2, "0")}`,
      objectives: `Objetivos detalhados para o projeto ${i}. Este é um projeto gerado automaticamente para testes.`,
      justification: `Justificativa técnica para a execução do projeto ${i}.`,
      scope: `Escopo de atuação e limites do projeto ${i}.`,
      status,
      userId: user.id,
      createdAt,
      submittedAt,
      proposedInstrumentType,
      approvalOpinion,
      classificationAnswers: {
        q1: "yes",
        q2: "no",
        details: `Specific answers for project ${i}`,
      },
      legalInstrumentInstance: {
        create: {
          legalInstrumentVersionId: instrumentVersion.id,
          status: LegalInstrumentStatus.PENDING,
          answers: {},
        },
      },
    }

    await prisma.project.upsert({
      where: { slug: `teste-${i.toString().padStart(2, "0")}` },
      create: data,
      update: { slug: `teste-${i.toString().padStart(2, "0")}` },
    })
  }

  console.log("30 Development Projects seeded.")
}
