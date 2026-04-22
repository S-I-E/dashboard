"use server"

import prisma from "@/lib/config/db"
import PermissionsService from "@/lib/services/permissions"
import { getAuthSession } from "@/lib/api-utils"
import { fileService } from "@/lib/services/file"
import { LegalInstrumentStatus, ProjectStatus } from "@prisma/client"
import { Prisma } from "@prisma/client"
import type { LegalInstrumentAnswers, LegalInstrumentFieldSpec, LegalInstrumentAnswerValue } from "@/types/legal-instrument"
import {
  legalInstrumentListValidator,
  legalInstrumentWithTemplateValidator,
  legalInstrumentInstanceWithVersionValidator,
  GetLegalInstrumentsResponse,
  GetLegalInstrumentByIdResponse,
  UpdateLegalInstrumentResponse,
  PreviewLegalInstrumentResponse,
  SaveLegalInstrumentAnswersResponse,
  CheckExistingLegalInstrumentResponse,
} from "./types"

import { randomUUID } from "crypto"

export type UpdateLegalInstrumentPayload = {
  fileKey?: string
  fieldsJson?: LegalInstrumentFieldSpec[]
}

export async function getLegalInstruments(): Promise<GetLegalInstrumentsResponse> {
  const session = await getAuthSession()
  if (!session?.user?.id) throw new Error("Unauthorized")

  await PermissionsService.authorize(session.user.id, { slug: "legal_instruments.manage" })

  return prisma.legalInstrument.findMany({
    ...legalInstrumentListValidator,
  })
}

export async function getLegalInstrumentById(id: string): Promise<GetLegalInstrumentByIdResponse> {
  const session = await getAuthSession()
  if (!session?.user?.id) throw new Error("Unauthorized")

  await PermissionsService.authorize(session.user.id, { slug: "legal_instruments.manage" })

  return prisma.legalInstrument.findUnique({
    where: { id },
    ...legalInstrumentWithTemplateValidator,
  })
}

export async function updateLegalInstrument(id: string, data: UpdateLegalInstrumentPayload): Promise<UpdateLegalInstrumentResponse> {
  const session = await getAuthSession()
  if (!session?.user?.id) throw new Error("Unauthorized")

  await PermissionsService.authorize(session.user.id, { slug: "legal_instruments.manage" })

  const instrument = await prisma.legalInstrument.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      fieldsJson: true,
      templateFileId: true,
    },
  })

  if (!instrument) throw new Error("not_found")

  let templateFileId = instrument.templateFileId
  if (data.fileKey) {
    const fileRecord = await fileService.createFileFromS3(data.fileKey)
    templateFileId = fileRecord.id
  }

  const fieldsJson = (data.fieldsJson ?? ((instrument.fieldsJson as unknown) as LegalInstrumentFieldSpec[] | undefined)) as unknown as Prisma.InputJsonValue | undefined

  if (!templateFileId) {
    throw new Error("no_template")
  }
  if (!fieldsJson) {
    throw new Error("no_fields")
  }

  await prisma.legalInstrument.update({
    where: { id },
    data: {
      templateFileId,
      fieldsJson,
      revisionKey: randomUUID(),
    },
  })

  const updated = await prisma.legalInstrument.findUnique({
    where: { id },
    ...legalInstrumentWithTemplateValidator,
  })

  if (!updated) throw new Error("not_found")
  return updated
}

export async function previewLegalInstrument(
  id: string,
  fieldsJson: LegalInstrumentFieldSpec[],
  sampleValues: Record<string, LegalInstrumentAnswerValue>
): Promise<PreviewLegalInstrumentResponse> {
  const session = await getAuthSession()
  if (!session?.user?.id) throw new Error("Unauthorized")

  await PermissionsService.authorize(session.user.id, { slug: "legal_instruments.manage" })

  const li = await prisma.legalInstrument.findUnique({
    where: { id },
    include: { templateFile: true },
  })

  if (!li) throw new Error("not_found")
  if (!li.templateFile) {
    throw new Error("no_template")
  }

  // Only support text templates for preview
  let text = ""
  try {
    const fileStream = await fileService.getFileStream(li.templateFile.key)
    if (fileStream.Body) {
      text = await fileStream.Body.transformToString()
    }
  } catch (error) {
    console.error("Error fetching file content:", error)
    throw new Error("failed_to_fetch_template")
  }

  const sample = sampleValues || {}
  const fields = fieldsJson || ((li.fieldsJson as unknown) as LegalInstrumentFieldSpec[]) || []
  let preview = text
  for (const f of fields) {
    const nameKey = f.name
    const idKey = f.id
    const val = sample[nameKey] ?? sample[idKey] ?? `{${nameKey}}`
    // support both {{name}} and {name} as used historically, and also fallback to id placeholders
    preview = preview.split(`{{${nameKey}}}`).join(String(val))
    preview = preview.split(`{${nameKey}}`).join(String(val))
    if (idKey) {
      preview = preview.split(`{{${idKey}}}`).join(String(val))
      preview = preview.split(`{${idKey}}`).join(String(val))
    }
  }

  return { preview }
}

export async function saveLegalInstrumentAnswers(
  instanceId: string,
  answers: LegalInstrumentAnswers
): Promise<SaveLegalInstrumentAnswersResponse> {
  const session = await getAuthSession()
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Fetch instance with version + template file
  const instance = await prisma.legalInstrumentInstance.findUnique({
    where: { id: instanceId },
    include: {
      project: {
        select: {
          status: true,
        },
      },
      legalInstrumentVersion: {
        include: { templateFile: true },
      },
    },
  })

  if (!instance) throw new Error("Instance not found")

  if (instance.project.status === ProjectStatus.UNDER_REVIEW || instance.project.status === ProjectStatus.APPROVED) {
    throw new Error("project_locked")
  }

  let filledFileId: string | undefined = undefined

  // Determine status based on answers completeness
  const fields = ((instance.legalInstrumentVersion.fieldsJson as unknown) as LegalInstrumentFieldSpec[]) || []
  const requiredFields = fields.filter((f) => f.required)
  const allRequiredFilled = requiredFields.every((f) => {
    const val = answers[f.id]
    return val !== undefined && val !== null && String(val).trim() !== ""
  })

  // Check if any fields have been filled
  const anyFieldFilled = fields.some((f) => {
    const val = answers[f.id]
    return val !== undefined && val !== null && String(val).trim() !== ""
  })

  let newStatus: LegalInstrumentStatus
  if (allRequiredFilled) {
    newStatus = LegalInstrumentStatus.FILLED
  } else if (anyFieldFilled) {
    newStatus = LegalInstrumentStatus.PARTIAL
  } else {
    newStatus = LegalInstrumentStatus.PENDING
  }

  // If we have a template file, generate the filled version
  if (instance.legalInstrumentVersion.templateFile && allRequiredFilled) {
    try {
      // Get template content
      const fileStream = await fileService.getFileStream(instance.legalInstrumentVersion.templateFile.key)
      if (fileStream.Body) {
        let content = await fileStream.Body.transformToString()

        // Replace placeholders
        for (const field of fields) {
          const answerValue = answers[field.id] ?? answers[field.name]
          if (answerValue !== undefined && answerValue !== null) {
            // prefer replacing by name placeholders ({{name}}), but keep id placeholders for backward compatibility
            if (field.name) content = content.split(`{{${field.name}}}`).join(String(answerValue))
            if (field.id) content = content.split(`{{${field.id}}}`).join(String(answerValue))
          }
        }

        // Upload generated file
        const newFilename = `filled_${instance.legalInstrumentVersion.templateFile.filename}`
        const newFile = await fileService.uploadFile(
          content,
          newFilename,
          "text/plain",
          "legal-instruments/filled"
        )
        filledFileId = newFile.id
      }
    } catch (error) {
      console.error("Error generating filled file:", error)
    }
  }

  return prisma.legalInstrumentInstance.update({
    where: { id: instanceId },
    data: {
      answers,
      filledFileId,
      status: newStatus,
    },
    ...legalInstrumentInstanceWithVersionValidator,
  })
}

export async function checkExistingLegalInstrument(projectSlug: string): Promise<CheckExistingLegalInstrumentResponse> {
  const session = await getAuthSession()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { legalInstrumentInstance: { select: { id: true } } },
  })

  if (!project) throw new Error("Project not found")

  return { exists: !!project.legalInstrumentInstance }
}
