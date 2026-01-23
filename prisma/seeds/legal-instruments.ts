import { PrismaClient, LegalInstrumentType } from "@prisma/client"
import { readFileSync } from "node:fs"
import { join } from "node:path"

export async function seedLegalInstruments(prisma: PrismaClient) {
  console.log("Seeding Legal Instruments...")

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000"

  const pdfPath = join(process.cwd(), "public", "test-files", "template.pdf")
  const docxPath = join(process.cwd(), "public", "test-files", "template.docx")

  const pdfSize = readFileSync(pdfPath).length
  const docxSize = readFileSync(docxPath).length

  let pdfFile = await prisma.file.findFirst({ where: { key: "local/test-files/template.pdf" } })
  if (!pdfFile) {
    pdfFile = await prisma.file.create({
      data: {
        key: "local/test-files/template.pdf",
        url: `${baseUrl}/test-files/template.pdf`,
        bucket: "local",
        filename: "template.pdf",
        contentType: "application/pdf",
        size: pdfSize,
      },
    })
  }

  let docxFile = await prisma.file.findFirst({ where: { key: "local/test-files/template.docx" } })
  if (!docxFile) {
    docxFile = await prisma.file.create({
      data: {
        key: "local/test-files/template.docx",
        url: `${baseUrl}/test-files/template.docx`,
        bucket: "local",
        filename: "template.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: docxSize,
      },
    })
  }

  const defaultFieldsJson = [
    { id: "contract_party_name", name: "contract_party_name", type: "text", label: "Nome da parte contratante", required: true },
    { id: "contract_party_email", name: "contract_party_email", type: "email", label: "E-mail da parte contratante", required: false },
    { id: "contract_party_cpf", name: "contract_party_cpf", type: "cpf", label: "CPF da parte contratante", required: true },
    { id: "contract_party_cnpj", name: "contract_party_cnpj", type: "cnpj", label: "CNPJ (se aplicável)", required: false },
    { id: "validity_start", name: "validity_start", type: "date", label: "Início da vigência", required: true },
    { id: "validity_end", name: "validity_end", type: "date", label: "Fim da vigência", required: false },
    { id: "contract_value", name: "contract_value", type: "currency", label: "Valor do contrato (R$)", required: true },
    { id: "object", name: "object", type: "textarea", label: "Objeto / descrição", required: false },
    { id: "installments", name: "installments", type: "number", label: "Quantidade de parcelas", required: false },
  ]

  const instruments = [
    { name: "PDI", description: "Convênio de PD&I", type: LegalInstrumentType.PDI_AGREEMENT },
    { name: "Contrato", description: "Contrato de Serviços Técnicos", type: LegalInstrumentType.SERVICE_CONTRACT },
    { name: "APPDI", description: "APPDI com aporte privado", type: LegalInstrumentType.APPDI_PRIVATE },
    { name: "APPDI", description: "APPDI sem aporte", type: LegalInstrumentType.APPDI_NO_FUNDING },
    { name: "Cooperação", description: "Acordo / Termo de Cooperação", type: LegalInstrumentType.COOP_AGREEMENT },
    { name: "NDA", description: "NDA/Termo de Confidencialidade", type: LegalInstrumentType.NDA },
    { name: "Transferência", description: "Licenciamento/Transferência de Tecnologia", type: LegalInstrumentType.TECH_TRANSFER },
    { name: "Avaliação", description: "Rever escopo/enquadramento (Fluxo não encontrou classificação adequada)", type: LegalInstrumentType.REVIEW_SCOPE },
  ]

  for (const instrument of instruments) {
    const existing = await prisma.legalInstrument.findUnique({
      where: { type: instrument.type },
      select: { id: true },
    })

    if (existing) {
      const version = await prisma.legalInstrumentVersion.findFirst({
        where: { legalInstrumentId: existing.id },
      })
      if (!version) {
        const templateFileId = instrument.type === LegalInstrumentType.NDA ? docxFile.id : pdfFile.id
        await prisma.legalInstrumentVersion.create({
          data: {
            legalInstrumentId: existing.id,
            version: 1,
            revisionKey: crypto.randomUUID(),
            type: instrument.type,
            fieldsJson: defaultFieldsJson as any,
            templateFileId,
          },
        })
      }
      continue
    }

    const templateFileId = instrument.type === LegalInstrumentType.NDA ? docxFile.id : pdfFile.id

    await prisma.legalInstrument.create({
      data: {
        name: instrument.name,
        description: instrument.description,
        type: instrument.type,
        fieldsJson: defaultFieldsJson as any,
        templateFileId,
        versions: {
          create: {
            version: 1,
            revisionKey: crypto.randomUUID(),
            type: instrument.type,
            fieldsJson: defaultFieldsJson as any,
            templateFileId,
          },
        },
      },
    })
  }
}
