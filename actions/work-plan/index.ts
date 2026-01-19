"use server"

import { prisma } from "@/lib/config/db"
import { type WorkPlanFormData } from "@/lib/schemas/work-plan"
import { ProjectStatus } from "@prisma/client"
import { workPlanValidator, GetWorkPlanResponse, UpsertWorkPlanResponse } from "./types"
import { revalidatePath } from "next/cache"

export async function getWorkPlan(projectId: string): Promise<GetWorkPlanResponse | null> {
  try {
    const workPlan = await prisma.workPlan.findUnique({
      where: { projectId },
      ...workPlanValidator,
    })

    if (!workPlan) return null

    // Parse specificObjectives robustly into string[]
    let specificObjectives: string[] = []
    if (workPlan.specificObjectives && Array.isArray(workPlan.specificObjectives)) {
      specificObjectives = workPlan.specificObjectives
        .map((item) => {
          if (typeof item === "string") return item
          if (typeof item === "object" && item !== null && "value" in item) {
            const maybeValue = (item as { value?: unknown }).value
            return typeof maybeValue === "string" ? maybeValue : undefined
          }
          return undefined
        })
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    }

    return {
      ...workPlan,
      specificObjectives,
    }
  } catch (error) {
    console.error("Error fetching work plan:", error)
    throw new Error("Failed to fetch work plan")
  }
}

export async function upsertWorkPlan(projectId: string, data: WorkPlanFormData): Promise<UpsertWorkPlanResponse> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    })

    if (!project) {
      return { success: false, error: "Project not found" }
    }

    if (project.status !== ProjectStatus.DRAFT && project.status !== (ProjectStatus as any).RETURNED) {
      return { success: false, error: "Project is locked for editing" }
    }

    const workPlan = await prisma.workPlan.upsert({
      where: { projectId },
      create: {
        projectId,
        ...data,
        specificObjectives: data.specificObjectives,
      },
      update: {
        ...data,
        specificObjectives: data.specificObjectives,
      },
      ...workPlanValidator,
    })
    return { success: true, data: workPlan }
  } catch (error) {
    console.error("Error upserting work plan:", error)
    return { success: false, error: "Failed to save work plan" }
  }
}
