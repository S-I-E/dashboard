"use server"

import { prisma } from "@/lib/config/db"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/config/auth"
import { MilestoneStatus, TaskStatus } from "@prisma/client"
import { CreateMilestoneInput, UpdateMilestoneInput, CreateTaskInput, UpdateTaskInput, ProjectScheduleResponse, milestoneWithTasksValidator, taskWithDependenciesValidator } from "./types"

async function ensureAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  return session
}

/**
 * Ensures a ProjectSchedule exists for the project and returns its ID
 */
async function ensureSchedule(projectId: string): Promise<string> {
  let schedule = await prisma.projectSchedule.findUnique({
    where: { projectId },
  })

  if (!schedule) {
    schedule = await prisma.projectSchedule.create({
      data: { projectId },
    })
  }

  return schedule.id
}

// ============================================================================
// MILESTONE ACTIONS
// ============================================================================

export async function createMilestone(input: CreateMilestoneInput) {
  await ensureAuth()

  const milestone = await prisma.milestone.create({
    data: {
      scheduleId: input.scheduleId,
      title: input.title,
      description: input.description,
      order: input.order ?? 0,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "PLANNED",
    },
  })

  revalidatePath(`/projetos/[slug]`, "page")
  return milestone
}

export async function updateMilestone(input: UpdateMilestoneInput) {
  await ensureAuth()

  const milestone = await prisma.milestone.update({
    where: { id: input.id },
    data: {
      title: input.title,
      description: input.description,
      order: input.order,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
    },
  })

  revalidatePath(`/projetos/[slug]`, "page")
  return milestone
}

export async function deleteMilestone(id: string) {
  await ensureAuth()

  await prisma.milestone.delete({
    where: { id },
  })

  revalidatePath(`/projetos/[slug]`, "page")
}

// ============================================================================
// TASK ACTIONS
// ============================================================================

export async function createTask(input: CreateTaskInput) {
  await ensureAuth()

  const task = await prisma.task.create({
    data: {
      scheduleId: input.scheduleId,
      milestoneId: input.milestoneId,
      title: input.title,
      description: input.description,
      priority: input.priority ?? 0,
      estimatedTime: input.estimatedTime,
      startDate: input.startDate,
      dueDate: input.dueDate,
      status: "TODO",
    },
  })

  revalidatePath(`/projetos/[slug]`, "page")
  return task
}

export async function updateTask(input: UpdateTaskInput) {
  await ensureAuth()

  // Business Rule: Check dependencies if status is being changed to DONE
  if (input.status === "DONE") {
    const task = await prisma.task.findUnique({
      where: { id: input.id },
      include: {
        dependencies: {
          include: {
            dependsOnTask: true,
          },
        },
      },
    })

    if (task) {
      const unfinishedDeps = task.dependencies.filter((d) => d.dependsOnTask.status !== "DONE")
      if (unfinishedDeps.length > 0) {
        throw new Error("Não é possível concluir a tarefa pois existem dependências pendentes.")
      }
    }
  }

  const task = await prisma.task.update({
    where: { id: input.id },
    data: {
      milestoneId: input.milestoneId,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      estimatedTime: input.estimatedTime,
      startDate: input.startDate,
      dueDate: input.dueDate,
      blockedReason: input.blockedReason,
    },
  })

  revalidatePath(`/projetos/[slug]`, "page")
  return task
}

export async function deleteTask(id: string) {
  await ensureAuth()

  await prisma.task.delete({
    where: { id },
  })

  revalidatePath(`/projetos/[slug]`, "page")
}

// ============================================================================
// DEPENDENCY ACTIONS
// ============================================================================

export async function addTaskDependency(taskId: string, dependsOnTaskId: string) {
  await ensureAuth()

  if (taskId === dependsOnTaskId) {
    throw new Error("Uma tarefa não pode depender de si mesma.")
  }

  // Circular dependency check
  const createsCycle = await checkCircularDependency(taskId, dependsOnTaskId)
  if (createsCycle) {
    throw new Error("Esta dependência criaria um ciclo vicioso.")
  }

  const dependency = await prisma.taskDependency.create({
    data: {
      taskId,
      dependsOnTaskId,
    },
  })

  revalidatePath(`/projetos/[slug]`, "page")
  return dependency
}

export async function removeTaskDependency(taskId: string, dependsOnTaskId: string) {
  await ensureAuth()

  await prisma.taskDependency.delete({
    where: {
      taskId_dependsOnTaskId: {
        taskId,
        dependsOnTaskId,
      },
    },
  })

  revalidatePath(`/projetos/[slug]`, "page")
}

async function checkCircularDependency(taskId: string, dependsOnTaskId: string): Promise<boolean> {
  const visited = new Set<string>()
  const queue = [dependsOnTaskId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (currentId === taskId) return true

    if (visited.has(currentId)) continue
    visited.add(currentId)

    const deps = await prisma.taskDependency.findMany({
      where: { taskId: currentId },
    })

    queue.push(...deps.map((d) => d.dependsOnTaskId))
  }

  return false
}

// ============================================================================
// QUERY ACTIONS
// ============================================================================

export async function getProjectSchedule(projectId: string): Promise<ProjectScheduleResponse> {
  await ensureAuth()

  // Auto-creation of schedule if missing (ensure 1:1)
  const scheduleId = await ensureSchedule(projectId)

  const [milestones, independentTasks] = await Promise.all([
    prisma.milestone.findMany({
      where: { scheduleId },
      ...milestoneWithTasksValidator,
      orderBy: { order: "asc" },
    }),
    prisma.task.findMany({
      where: {
        scheduleId,
        milestoneId: null,
      },
      ...taskWithDependenciesValidator,
      orderBy: { priority: "desc" },
    }),
  ])

  return {
    id: scheduleId,
    milestones,
    independentTasks,
  }
}
