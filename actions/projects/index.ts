"use server"

import { prisma } from "@/lib/config/db"
import { revalidatePath } from "next/cache"
import { generateUniqueSlug } from "@/lib/utils/slug"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/config/auth"
import { APP_ERRORS } from "@/lib/errors"
import { ResourceMembersType, Project, ProjectStatus, LegalInstrumentStatus, LegalInstrumentType } from "@prisma/client"
import { Prisma } from "@prisma/client"
import PermissionsService from "@/lib/services/permissions"
import { notifyAdminsOfNewSubmission, notifyUserOfApproval, notifyUserOfRejection } from "@/lib/services/email"
import { NotificationService } from "@/lib/services/notification"
import { logProjectAction } from "@/lib/services/audit"
import type { ProjectClassificationResult } from "@/types/legal-instrument"
import { projectWithRelationsValidator, projectWithBasicRelationsValidator, projectsForApprovalValidator, GetProjectBySlugResponse, GetAllProjectsResponse, GetProjectsForApprovalResponse, GetProjectsForApprovalFilters, CreateLegalInstrumentResult, legalInstrumentInstanceForProjectValidator, ProjectViewerContext, GetProjectApprovalStatsResponse, GetUserProjectStatsResponse } from "./types"

export async function getProjectBySlug(slug: string): Promise<GetProjectBySlugResponse> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    throw new Error("Unauthorized")
  }

  const project: GetProjectBySlugResponse = await prisma.project.findUnique({
    where: { slug: slug },
    ...projectWithRelationsValidator,
  })

  if (!project) {
    return null
  }

  if (project.userId == session.user.id) {
    return project
  }

  const canViewResource = await PermissionsService.can(session.user.id, {
    slug: "projects.view",
    referenceTable: ResourceMembersType.Project,
    referenceId: project.id,
  })

  if (canViewResource) {
    return project
  }

  const canApprove = await PermissionsService.can(session.user.id, { slug: "projects.approve" })

  if (canApprove) {
    return project
  }

  return null
}

export async function createProject(formData: FormData): Promise<Project> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) throw new Error("Unauthorized")

  await PermissionsService.authorize(session.user.id, { slug: "projects.create" })

  const titulo = String(formData.get("titulo") || "").trim()
  const objetivos = String(formData.get("objetivos") || "").trim()
  const justificativa = String(formData.get("justificativa") || "").trim()
  const abrangencia = String(formData.get("abrangencia") || "").trim()

  if (!titulo || !objetivos || !justificativa || !abrangencia) {
    throw new Error(APP_ERRORS.GENERIC_ERROR.code)
  }

  const slug = await generateUniqueSlug(titulo)

  return prisma.project.create({
    data: {
      title: titulo,
      slug,
      objectives: objetivos,
      justification: justificativa,
      scope: abrangencia,
      userId: session.user.id,
    },
  })
}

export async function createLegalInstrument(slug: string, result: ProjectClassificationResult): Promise<CreateLegalInstrumentResult> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return { success: false, error: "Unauthorized" }

    const type = result.type as LegalInstrumentType

    const legalInstrument = await prisma.legalInstrument.findUnique({
      where: { type },
      select: {
        id: true,
        type: true,
        revisionKey: true,
        fieldsJson: true,
        templateFileId: true,
      },
    })

    if (!legalInstrument) return { success: false, error: APP_ERRORS.PROJECT_CREATE_LEGAL_INSTRUMENTS.code }

    const project = await prisma.project.findUnique({
      where: { slug: slug },
      select: { id: true, legalInstrumentInstance: { select: { id: true } } },
    })
    if (!project) return { success: false, error: APP_ERRORS.PROJECT_CREATE_LEGAL_INSTRUMENTS.code }

    if (project.legalInstrumentInstance) {
      return { success: false, error: APP_ERRORS.PROJECT_CREATE_LEGAL_INSTRUMENTS.code }
    }

    const createdInstance = await prisma.$transaction(
      async (prismaTx) => {
        const existingVersion = await prismaTx.legalInstrumentVersion.findUnique({
          where: {
            legalInstrumentId_revisionKey: {
              legalInstrumentId: legalInstrument.id,
              revisionKey: legalInstrument.revisionKey,
            },
          },
          select: { id: true },
        })

        let legalInstrumentVersionId = existingVersion?.id

        if (!legalInstrumentVersionId) {
          const latest = await prismaTx.legalInstrumentVersion.findFirst({
            where: { legalInstrumentId: legalInstrument.id },
            orderBy: { version: "desc" },
            select: { version: true },
          })

          const nextVersion = (latest?.version ?? 0) + 1

          const createdVersion = await prismaTx.legalInstrumentVersion.create({
            data: {
              legalInstrumentId: legalInstrument.id,
              version: nextVersion,
              revisionKey: legalInstrument.revisionKey,
              type: legalInstrument.type,
              fieldsJson: legalInstrument.fieldsJson as unknown as Prisma.InputJsonValue,
              templateFileId: legalInstrument.templateFileId,
            },
            select: { id: true },
          })

          legalInstrumentVersionId = createdVersion.id
        }

        const instance = await prismaTx.legalInstrumentInstance.create({
          data: {
            projectId: project.id,
            legalInstrumentVersionId,
            projectClassificationAnswers: (result.history ?? []) as unknown as Prisma.InputJsonValue,
          },
        })

        const full = await prismaTx.legalInstrumentInstance.findUnique({
          where: { id: instance.id },
          ...legalInstrumentInstanceForProjectValidator,
        })

        if (!full) {
          throw new Error("failed_to_load_instance")
        }

        return full
      },
      {
        timeout: 10000,
        isolationLevel: "Serializable",
      }
    )

    return { success: true, error: null, created: createdInstance }
  } catch (error) {
    console.error("Error creating legal instrument:", error)
    return { success: false, error: APP_ERRORS.GENERIC_ERROR.code }
  }
}

export async function getAllProjects(): Promise<GetAllProjectsResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return []

  const canViewAll = await PermissionsService.can(session.user.id, { slug: "projects.view.all" })

  if (canViewAll) {
    const projects = await prisma.project.findMany({
      ...projectWithBasicRelationsValidator,
      orderBy: { updatedAt: "desc" },
    })

    return projects
  }

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    ...projectWithBasicRelationsValidator,
    orderBy: { updatedAt: "desc" },
  })

  return projects
}

export async function getProjectLegalInstrument(slug: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) throw new Error("Unauthorized")

  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      legalInstrumentInstance: {
        include: {
          project: {
            select: {
              status: true,
            },
          },
          filledFile: true,
          legalInstrumentVersion: {
            include: {
              legalInstrument: true,
              templateFile: true,
            },
          },
        },
      },
    },
  })

  if (!project) return null

  return project.legalInstrumentInstance
}

export async function updateProject(slug: string, formData: FormData): Promise<Project> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) throw new Error("Unauthorized")

  const titulo = String(formData.get("titulo") || "").trim()
  const objetivos = String(formData.get("objetivos") || "").trim()
  const justificativa = String(formData.get("justificativa") || "").trim()
  const abrangencia = String(formData.get("abrangencia") || "").trim()

  if (!titulo || !objetivos || !justificativa || !abrangencia) {
    throw new Error(APP_ERRORS.GENERIC_ERROR.code)
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, userId: true, status: true, title: true, objectives: true, justification: true, scope: true },
  })

  if (!project) throw new Error("Project not found")
  if (project.status !== ProjectStatus.DRAFT && project.status !== (ProjectStatus as any).RETURNED) {
    throw new Error("Only projects in DRAFT or RETURNED status can be edited")
  }

  if (project.userId !== session.user.id) {
    throw new Error("Unauthorized access to project")
  }

  const updated = await prisma.project.update({
    where: { slug },
    data: {
      title: titulo,
      objectives: objetivos,
      justification: justificativa,
      scope: abrangencia,
    },
  })

  revalidatePath(`/admin/projetos/${slug}/review`)
  revalidatePath("/admin/projetos")

  return updated
}

export async function getProjectViewerContext(slug: string): Promise<ProjectViewerContext> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true, userId: true } })
  if (!project) {
    throw new Error("Project not found")
  }

  const isOwner = project.userId === session.user.id

  const isResourceMember = await prisma.resourceMembers.findFirst({
    where: {
      userId: session.user.id,
      referenceTable: ResourceMembersType.Project,
      referenceId: project.id,
    },
    select: { id: true },
  })

  const canApprove = await PermissionsService.can(session.user.id, { slug: "projects.approve" })

  const mode: ProjectViewerContext["mode"] = isOwner ? "owner" : isResourceMember ? "resource" : canApprove ? "approver" : "other"

  return {
    mode,
    allowActions: isOwner || !!isResourceMember,
  }
}

export async function submitProjectForApproval(slug: string): Promise<Project> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Unauthorized")

  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      legalInstrumentInstance: {
        select: { status: true },
      },
      workPlan: true,
    },
  })

  if (!project) throw new Error("Project not found")
  if (project.userId !== session.user.id) {
    throw new Error("Unauthorized - only project creator can submit for approval")
  }

  // Validate that project is in DRAFT or RETURNED status
  if (project.status !== ProjectStatus.DRAFT && project.status !== (ProjectStatus as any).RETURNED) {
    throw new Error("Project cannot be submitted in its current status")
  }

  // Validate dependencies
  if (!project.legalInstrumentInstance) {
    throw new Error("Project must have a legal instrument before submission")
  }

  const status = project.legalInstrumentInstance.status || LegalInstrumentStatus.PENDING
  if (status !== LegalInstrumentStatus.FILLED) {
    throw new Error("Legal instrument must be filled before submission")
  }

  if (!project.workPlan) {
    throw new Error("Project must have a work plan before submission")
  }

  const updated = await prisma.project.update({
    where: { slug },
    data: {
      status: "PENDING_REVIEW",
      submittedAt: new Date(),
      statusUpdatedAt: new Date(),
    },
  })

  // Notify approvers and log audit
  try {
    const full = await prisma.project.findUnique({
      where: { slug },
      include: { user: { select: { name: true } } },
    })

    if (full) {
      // 1. Notify General Admins
      await NotificationService.notifyAdminsOfNewSubmission({ id: full.id, title: full.title, slug: full.slug!, user: { name: full.user?.name } })

      // 2. Notify Previous Reviewer (Granular)
      // If the project was returned and has a reviewer assigned, notify them specifically
      if (project.status === (ProjectStatus as any).RETURNED && project.reviewStartedBy) {
        await NotificationService.notifyUser(project.reviewStartedBy, "Projeto Reenviado", `O projeto "${full.title}" foi corrigido e reenviado para análise.`, `/admin/projetos/${full.slug}/review`, {
          key: "PROJECT_SUBMITTED",
          vars: {
            projectTitle: full.title,
            submitterName: full.user?.name || "Usuário",
            reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/projetos/${full.slug}/review`,
          },
        })
      }

      // Smart Audit: Calculate Diff if resubmitting
      let diff = undefined
      if (project.status === (ProjectStatus as any).RETURNED) {
        const lastReturn = await prisma.projectAudit.findFirst({
          where: { projectId: full.id, action: "RETURNED" },
          orderBy: { createdAt: "desc" },
        })

        if (lastReturn?.changeDetails && (lastReturn.changeDetails as any).snapshot) {
          const snapshot = (lastReturn.changeDetails as any).snapshot
          const current = {
            title: full.title,
            objectives: full.objectives,
            justification: full.justification,
            scope: full.scope,
          }

          const calculatedDiff: Record<string, { from: string; to: string }> = {}
          if (snapshot.title !== current.title) calculatedDiff.title = { from: snapshot.title, to: current.title }
          if (snapshot.objectives !== current.objectives) calculatedDiff.objectives = { from: snapshot.objectives, to: current.objectives }
          if (snapshot.justification !== current.justification) calculatedDiff.justification = { from: snapshot.justification, to: current.justification }
          if (snapshot.scope !== current.scope) calculatedDiff.scope = { from: snapshot.scope, to: current.scope }

          if (Object.keys(calculatedDiff).length > 0) {
            diff = calculatedDiff
          }
        }
      }

      await logProjectAction(full.id, "SUBMITTED", session.user.id, { fromStatus: project.status, toStatus: "PENDING_REVIEW", diff })
    }
  } catch (e) {
    console.error("notify/log submitProjectForApproval error", e)
  }

  return updated
}

export async function startProjectReview(slug: string): Promise<Project> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Verify reviewer has permission
  await PermissionsService.authorize(session.user.id, { slug: "projects.approve" })

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, status: true },
  })

  if (!project) throw new Error("Project not found")

  if (project.status !== ProjectStatus.PENDING_REVIEW) {
    throw new Error("Only projects pending review can be started")
  }

  const updated = await prisma.project.update({
    where: { slug },
    data: {
      status: "UNDER_REVIEW",
      reviewStartedAt: new Date(),
      reviewStartedBy: session.user.id,
      statusUpdatedAt: new Date(),
    },
  })

  // Log audit
  try {
    await logProjectAction(project.id, "REVIEW_STARTED", session.user.id, {
      fromStatus: "PENDING_REVIEW",
      toStatus: "UNDER_REVIEW",
    })
  } catch (e) {
    console.error("log startProjectReview error", e)
  }

  revalidatePath(`/admin/projetos/${slug}/review`)
  revalidatePath("/admin/projetos")

  return updated
}

export async function approveProject(slug: string, opinion?: string): Promise<Project> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Verify approver has permission
  await PermissionsService.authorize(session.user.id, { slug: "projects.approve" })

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, status: true, userId: true, reviewStartedBy: true },
  })

  if (!project) throw new Error("Project not found")

  if (!opinion || opinion.trim().length === 0) {
    throw new Error("O parecer técnico é obrigatório para aprovação")
  }

  if (project.status !== ProjectStatus.UNDER_REVIEW) {
    throw new Error("Only projects under review can be approved")
  }

  // Business Rule: Prevent self-approval
  if (project.userId === session.user.id) {
    throw new Error("You cannot approve your own project")
  }

  // Business Rule: Reviewer exclusivity
  // Only the person who started the review can approve it, unless there is no reviewer explicitly set (legacy compat)
  if (project.reviewStartedBy && project.reviewStartedBy !== session.user.id) {
    throw new Error("This project is under review by another administrator")
  }

  const updated = await prisma.project.update({
    where: { slug },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy: session.user.id,
      approvalOpinion: opinion,
      statusUpdatedAt: new Date(),
    },
  })

  // Notify user and log audit
  try {
    const full = await prisma.project.findUnique({
      where: { slug },
      include: { user: { select: { email: true } } },
    })
    if (full) {
      await NotificationService.notifyUserOfApproval({ title: full.title, slug: full.slug!, userId: full.userId, user: { email: full.user?.email } }, { name: session.user.name }, opinion)
      await logProjectAction(full.id, "APPROVED", session.user.id, { opinion, toStatus: "APPROVED" })
    }
  } catch (e) {
    console.error("notify/log approveProject error", e)
  }

  revalidatePath(`/admin/projetos/${slug}/review`)
  revalidatePath("/admin/projetos")

  return updated
}

export async function rejectProject(slug: string, reason: string): Promise<Project> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Verify approver has permission
  await PermissionsService.authorize(session.user.id, { slug: "projects.approve" })

  if (!reason || reason.trim().length === 0) {
    throw new Error("Rejection reason is required")
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, status: true, reviewStartedBy: true, userId: true },
  })

  if (!project) throw new Error("Project not found")

  if (project.status !== ProjectStatus.UNDER_REVIEW) {
    throw new Error("Only projects under review can be rejected")
  }

  // Business Rule: Reviewer exclusivity
  if (project.reviewStartedBy && project.reviewStartedBy !== session.user.id) {
    throw new Error("This project is under review by another administrator")
  }

  const updated = await prisma.project.update({
    where: { slug },
    data: {
      status: "REJECTED",
      rejectionReason: reason,
      statusUpdatedAt: new Date(),
    },
  })

  // Notify user and log audit
  try {
    const full = await prisma.project.findUnique({
      where: { slug },
      include: { user: { select: { email: true } } },
    })
    if (full) {
      await NotificationService.notifyUserOfRejection({ title: full.title, slug: full.slug!, userId: full.userId, user: { email: full.user?.email } }, reason, { name: session.user.name })
      await logProjectAction(full.id, "REJECTED", session.user.id, { reason, toStatus: "REJECTED" })
    }
  } catch (e) {
    console.error("notify/log rejectProject error", e)
  }

  revalidatePath(`/admin/projetos/${slug}/review`)
  revalidatePath("/admin/projetos")

  return updated
}

export async function requestProjectAdjustments(slug: string, reason: string): Promise<Project> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Verify approver has permission
  await PermissionsService.authorize(session.user.id, { slug: "projects.approve" })

  if (!reason || reason.trim().length === 0) {
    throw new Error("Reason for adjustments is required")
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, status: true, reviewStartedBy: true, userId: true, title: true, objectives: true, justification: true, scope: true },
  })

  if (!project) throw new Error("Project not found")

  if (project.status !== ProjectStatus.UNDER_REVIEW) {
    throw new Error("Somente projetos em analise podem ser retornados para ajustes")
  }

  // Business Rule: Reviewer exclusivity
  if (project.reviewStartedBy && project.reviewStartedBy !== session.user.id) {
    throw new Error("This project is under review by another administrator")
  }

  const updated = await prisma.project.update({
    where: { slug },
    data: {
      status: ProjectStatus.RETURNED,
      returnReason: reason,
      statusUpdatedAt: new Date(),
    },
  })

  // Notify user and log audit
  try {
    const full = await prisma.project.findUnique({
      where: { slug },
      include: { user: { select: { email: true, name: true } } },
    })
    if (full) {
      await NotificationService.notifyUserOfAdjustments({ title: full.title, slug: full.slug!, userId: full.userId, user: { email: full.user?.email } }, reason, { name: session.user.name })

      // Smart Audit: Snapshot current state to compare later
      const snapshot = {
        title: project.title,
        objectives: project.objectives,
        justification: project.justification,
        scope: project.scope,
      }

      await logProjectAction(full.id, "RETURNED", session.user.id, { reason, toStatus: ProjectStatus.RETURNED, snapshot })
    }
  } catch (e) {
    console.error("notify/log requestProjectAdjustments error", e)
  }

  revalidatePath(`/admin/projetos/${slug}/review`)
  revalidatePath("/admin/projetos")

  return updated
}

const STATUS_SORT_ORDER: Record<string, number> = {
  [ProjectStatus.APPROVED]: 1,
  [ProjectStatus.UNDER_REVIEW]: 2,
  [ProjectStatus.PENDING_REVIEW]: 3,
  [ProjectStatus.RETURNED]: 4,
  [ProjectStatus.DRAFT]: 5,
  [ProjectStatus.REJECTED]: 6,
}

export async function getProjectsForApproval(filters?: GetProjectsForApprovalFilters): Promise<GetProjectsForApprovalResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Verify reviewer has permission
  await PermissionsService.authorize(session.user.id, { slug: "projects.approve" })

  const { search, status, assignedToMe, hasWorkPlan, missingWorkPlan, hasLegalInstrument, missingLegalInstrument, dateStart, dateEnd, sort, page = 1, pageSize = 12 } = filters || {}

  const where: Prisma.ProjectWhereInput = {}

  // Search filter (title or user name/email)
  if (search) {
    where.OR = [{ title: { contains: search, mode: "insensitive" } }, { user: { name: { contains: search, mode: "insensitive" } } }, { user: { email: { contains: search, mode: "insensitive" } } }]
  }

  // Status filter
  if (status && status.length > 0) {
    where.status = { in: status as ProjectStatus[] }
  }

  // Assignment filter
  if (assignedToMe) {
    where.reviewStartedBy = session.user.id
  }

  // Work Plan filters
  if (hasWorkPlan) {
    where.workPlan = { isNot: null }
  } else if (missingWorkPlan) {
    where.workPlan = { is: null }
  }

  // Legal Instrument filters
  if (hasLegalInstrument) {
    where.legalInstrumentInstance = { isNot: null }
  } else if (missingLegalInstrument) {
    where.legalInstrumentInstance = { is: null }
  }

  // Date filters (using submittedAt)
  if (dateStart || dateEnd) {
    where.submittedAt = {}
    if (dateStart) {
      where.submittedAt.gte = new Date(dateStart)
    }
    if (dateEnd) {
      // Set to end of day
      const end = new Date(dateEnd)
      end.setHours(23, 59, 59, 999)
      where.submittedAt.lte = end
    }
  }

  // Sorting
  let orderBy: Prisma.ProjectOrderByWithRelationInput = { submittedAt: "desc" }
  const isStatusSort = sort === "status_asc" || sort === "status_desc"

  if (sort && !isStatusSort) {
    switch (sort) {
      case "date_asc":
        orderBy = { submittedAt: "asc" }
        break
      case "date_desc":
        orderBy = { submittedAt: "desc" }
        break
      case "title_asc":
        orderBy = { title: "asc" }
        break
      case "title_desc":
        orderBy = { title: "desc" }
        break
    }
  }

  const skip = (page - 1) * pageSize
  const take = pageSize

  let data: Prisma.ProjectGetPayload<typeof projectsForApprovalValidator>[] = []
  let total = 0

  if (isStatusSort) {
    // 1. Build the dynamic WHERE clause for Raw SQL
    const conditions: Prisma.Sql[] = [Prisma.sql`1=1`]

    if (search) {
      const searchPattern = `%${search}%`
      conditions.push(Prisma.sql`(p.title ILIKE ${searchPattern} OR u.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern})`)
    }

    if (status && status.length > 0) {
      // Need to cast the string array to the enum type in SQL
      conditions.push(Prisma.sql`p.status::text IN (${Prisma.join(status)})`)
    }

    if (assignedToMe) {
      conditions.push(Prisma.sql`p."reviewStartedBy" = ${session.user.id}`)
    }

    if (hasWorkPlan) {
      conditions.push(Prisma.sql`wp.id IS NOT NULL`)
    } else if (missingWorkPlan) {
      conditions.push(Prisma.sql`wp.id IS NULL`)
    }

    if (hasLegalInstrument) {
      conditions.push(Prisma.sql`lii.id IS NOT NULL`)
    } else if (missingLegalInstrument) {
      conditions.push(Prisma.sql`lii.id IS NULL`)
    }

    if (dateStart || dateEnd) {
      if (dateStart) {
        conditions.push(Prisma.sql`p."submittedAt" >= ${new Date(dateStart)}`)
      }
      if (dateEnd) {
        const end = new Date(dateEnd)
        end.setHours(23, 59, 59, 999)
        conditions.push(Prisma.sql`p."submittedAt" <= ${end}`)
      }
    }

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`

    // 2. Count total matches
    const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT p.id) as count
      FROM "Project" p
      LEFT JOIN "User" u ON p."userId" = u.id
      LEFT JOIN "LegalInstrumentInstance" lii ON p.id = lii."projectId"
      LEFT JOIN "WorkPlan" wp ON p.id = wp."projectId"
      ${whereClause}
    `
    total = Number(countResult[0].count)

    // 3. Fetch paginated and sorted results
    const statusOrder = Prisma.sql`
      CASE p.status::text
        WHEN 'APPROVED' THEN 1
        WHEN 'UNDER_REVIEW' THEN 2
        WHEN 'PENDING_REVIEW' THEN 3
        WHEN 'RETURNED' THEN 4
        WHEN 'DRAFT' THEN 5
        WHEN 'REJECTED' THEN 6
        ELSE 99
      END
    `
    const orderDir = sort === "status_asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`

    const rawResults = await prisma.$queryRaw<any[]>`
      SELECT 
        p.*,
        u.name as "userName", u.email as "userEmail", u.color as "userColor",
        f.url as "userImageUrl",
        lii.status as "liiStatus",
        liv.type as "livType",
        li.name as "liName", li.description as "liDescription",
        wp.id as "wpId"
      FROM "Project" p
      LEFT JOIN "User" u ON p."userId" = u.id
      LEFT JOIN "File" f ON u."imageId" = f.id
      LEFT JOIN "LegalInstrumentInstance" lii ON p.id = lii."projectId"
      LEFT JOIN "LegalInstrumentVersion" liv ON lii."legalInstrumentVersionId" = liv.id
      LEFT JOIN "LegalInstrument" li ON liv."legalInstrumentId" = li.id
      LEFT JOIN "WorkPlan" wp ON p.id = wp."projectId"
      ${whereClause}
      ORDER BY ${statusOrder} ${orderDir}, p."submittedAt" DESC
      LIMIT ${take} OFFSET ${skip}
    `

    // 4. Map to the expected nested structure
    data = rawResults.map((r) => ({
      ...r,
      user: {
        name: r.userName,
        email: r.userEmail,
        color: r.userColor,
        imageFile: r.userImageUrl ? { url: r.userImageUrl } : null,
      },
      legalInstrumentInstance: r.liiStatus
        ? {
            status: r.liiStatus,
            legalInstrumentVersion: {
              type: r.livType,
              legalInstrument: {
                name: r.liName,
                description: r.liDescription,
              },
            },
          }
        : null,
      workPlan: r.wpId ? { id: r.wpId } : null,
    }))
  } else {
    // Standard Prisma pagination for other sorts
    const [t, d] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        ...projectsForApprovalValidator,
        orderBy,
        skip,
        take,
      }),
    ])
    total = t
    data = d
  }

  return {
    data,
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  }
}

export async function getGlobalProjectStats(): Promise<GetProjectApprovalStatsResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Verify approver has permission
  await PermissionsService.authorize(session.user.id, { slug: "projects.approve" })

  const [pendingReview, underReview, approved, rejected, total] = await Promise.all([prisma.project.count({ where: { status: "PENDING_REVIEW" } }), prisma.project.count({ where: { status: "UNDER_REVIEW" } }), prisma.project.count({ where: { status: "APPROVED" } }), prisma.project.count({ where: { status: "REJECTED" } }), prisma.project.count()])

  return {
    pendingReview,
    underReview,
    inReview: pendingReview + underReview,
    approved,
    rejected,
    total,
  }
}

export async function getUserProjectStats(): Promise<GetUserProjectStatsResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Verify approver has permission
  await PermissionsService.authorize(session.user.id, { slug: "projects.approve" })

  const userId = session.user.id

  const [assignedToMe, inReviewByMe, approvedByMe, rejectedByMe, totalPendingInSystem, totalGlobal] = await Promise.all([
    prisma.project.count({
      where: {
        reviewStartedBy: userId,
      },
    }),
    prisma.project.count({
      where: {
        reviewStartedBy: userId,
        status: ProjectStatus.UNDER_REVIEW,
      },
    }),
    prisma.project.count({
      where: {
        approvedBy: userId,
        status: ProjectStatus.APPROVED,
      },
    }),
    prisma.project.count({
      where: {
        reviewStartedBy: userId,
        status: ProjectStatus.REJECTED,
      },
    }),
    prisma.project.count({
      where: {
        status: ProjectStatus.PENDING_REVIEW,
      },
    }),
    prisma.project.count(),
  ])

  return {
    assignedToMe,
    inReviewByMe,
    approvedByMe,
    rejectedByMe,
    totalPendingInSystem,
    totalGlobal,
  }
}

export async function releaseProjectReview(slug: string): Promise<Project> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Verify has specific management permission
  await PermissionsService.authorize(session.user.id, { slug: "projects.manage.reviews" })

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, status: true, reviewStartedBy: true },
  })

  if (!project) throw new Error("Project not found")

  if (project.status !== ProjectStatus.UNDER_REVIEW) {
    throw new Error("Only projects under review can be released")
  }

  const updated = await prisma.project.update({
    where: { slug },
    data: {
      status: "PENDING_REVIEW",
      reviewStartedBy: null,
      reviewStartedAt: null,
      statusUpdatedAt: new Date(),
    },
  })

  // Log audit
  try {
    await logProjectAction(project.id, "REVIEW_RELEASED", session.user.id, {
      fromStatus: "UNDER_REVIEW",
      toStatus: "PENDING_REVIEW",
      releasedFrom: project.reviewStartedBy,
    })
  } catch (e) {
    console.error("log releaseProjectReview error", e)
  }

  revalidatePath(`/admin/projetos/${slug}/review`)
  revalidatePath("/admin/projetos")

  return updated
}

export async function retractProjectSubmission(slug: string): Promise<Project> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Unauthorized")

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, status: true, userId: true },
  })

  if (!project) throw new Error("Project not found")

  if (project.userId !== session.user.id) {
    throw new Error("Unauthorized - only project owner can retract submission")
  }

  if (project.status !== ProjectStatus.PENDING_REVIEW) {
    throw new Error("Only pending reviews can be retracted")
  }

  const updated = await prisma.project.update({
    where: { slug },
    data: {
      status: ProjectStatus.DRAFT,
      submittedAt: null,
      statusUpdatedAt: new Date(),
    },
  })

  try {
    await logProjectAction(project.id, "RETRACTED", session.user.id, { fromStatus: "PENDING_REVIEW", toStatus: "DRAFT" })
  } catch (e) {
    console.error("log retractProjectSubmission error", e)
  }

  revalidatePath("/projetos")
  return updated
}

export async function deleteProject(slug: string): Promise<void> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Unauthorized")

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, status: true, userId: true },
  })

  if (!project) throw new Error("Project not found")

  if (project.userId !== session.user.id) {
    throw new Error("Unauthorized - only project owner can delete")
  }

  if (project.status !== ProjectStatus.DRAFT) {
    throw new Error("Only draft projects can be deleted")
  }

  await prisma.project.delete({
    where: { slug },
  })

  revalidatePath("/projetos")
}
