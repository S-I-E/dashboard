import { PrismaClient, LegalInstrumentType, Prisma } from "@prisma/client"
import { existsSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

export async function seedLegalInstruments(prisma: PrismaClient) {
  console.log("Seeding Legal Instruments...")

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000"

  const generatedDir = join(process.cwd(), "templates", "legal_instruments", "generated")
  const fallbackDocxPath = join(process.cwd(), "public", "test-files", "template.docx")

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

  const templateByType: Record<LegalInstrumentType, string> = {
    [LegalInstrumentType.PDI_AGREEMENT]: "modelo_de_acordo_com_aporte_de_recurso_template.docx",
    [LegalInstrumentType.SERVICE_CONTRACT]: "modelo_contrato_servico_tecnico_apoio_template.docx",
    [LegalInstrumentType.APPDI_PRIVATE]: "modelo_de_acordo_com_aporte_de_recurso_template.docx",
    [LegalInstrumentType.APPDI_NO_FUNDING]: "modelo_de_acordo_sem_aporte_de_recurso_template.docx",
    [LegalInstrumentType.COOP_AGREEMENT]: "modelo_anexo_ii_minuta_acordo_de_cooperacao_template.docx",
    [LegalInstrumentType.NDA]: "modelo_2026_acordo_de_confidencialidade_nda_ufr_template.docx",
    [LegalInstrumentType.TECH_TRANSFER]: "modelo_contrato_transferencia_patente_template.docx",
    [LegalInstrumentType.REVIEW_SCOPE]: "modelo_checklist_para_acordo_de_parceria_template.docx",
  }

  async function ensureLocalTemplateFile(filename: string) {
    const docxPath = existsSync(join(generatedDir, filename)) ? join(generatedDir, filename) : fallbackDocxPath
    const key = `local/templates/legal_instruments/${filename}`
    const existing = await prisma.file.findFirst({ where: { key } })
    const size = statSync(docxPath).size

    if (existing) {
      return prisma.file.update({
        where: { id: existing.id },
        data: {
          url: `${baseUrl}/templates/legal_instruments/generated/${encodeURIComponent(filename)}`,
          filename,
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size,
        },
      })
    }

    return prisma.file.create({
      data: {
        key,
        url: `${baseUrl}/templates/legal_instruments/generated/${encodeURIComponent(filename)}`,
        bucket: "local",
        filename,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size,
      },
    })
  }

  function readTemplateFields(filename: string) {
    const jsonName = filename.replace(/\.docx$/i, ".json")
    const jsonPath = join(generatedDir, jsonName)
    const cleanJsonPath = join(generatedDir, 'clean', jsonName)
    if (!existsSync(jsonPath)) return defaultFieldsJson

    try {
      const raw = readFileSync(jsonPath, "utf-8")
      const parsed = JSON.parse(raw) as { fields?: unknown }
      if (Array.isArray(parsed.fields) && parsed.fields.length > 0) return parsed.fields
      // if generated JSON exists but has no fields, try clean folder JSON
      if (existsSync(cleanJsonPath)) {
        try {
          const raw2 = readFileSync(cleanJsonPath, 'utf-8')
          const parsed2 = JSON.parse(raw2) as { fields?: unknown }
          if (Array.isArray(parsed2.fields) && parsed2.fields.length > 0) return parsed2.fields
        } catch {
          // ignore and fallback
        }
      }
      return defaultFieldsJson
    } catch {
      return defaultFieldsJson
    }
  }

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
    const templateFilename = templateByType[instrument.type]
    const file = await ensureLocalTemplateFile(templateFilename)
    const fieldsJson = readTemplateFields(templateFilename)

    await prisma.legalInstrument.upsert({
      where: { type: instrument.type },
      create: {
        name: instrument.name,
        description: instrument.description,
        type: instrument.type,
        fieldsJson: fieldsJson as Prisma.InputJsonValue,
        templateFileId: file.id,
      },
      update: {
        name: instrument.name,
        description: instrument.description,
        fieldsJson: fieldsJson as Prisma.InputJsonValue,
        templateFileId: file.id,
      },
    })
  }
}
