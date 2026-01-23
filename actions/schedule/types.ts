import { Prisma, Milestone, Task, MilestoneStatus, TaskStatus } from "@prisma/client"

// ============================================================================
// VALIDATORS
// ============================================================================

export const milestoneWithTasksValidator = Prisma.validator<Prisma.MilestoneDefaultArgs>()({
  include: {
    tasks: {
      include: {
        dependencies: {
          include: {
            dependsOnTask: true,
          },
        },
      },
    },
  },
})

export const taskWithDependenciesValidator = Prisma.validator<Prisma.TaskDefaultArgs>()({
  include: {
    dependencies: {
      include: {
        dependsOnTask: true,
      },
    },
    dependedBy: {
      include: {
        task: true,
      },
    },
  },
})

// ================= :1 ===========================================================
// OUTPUT TYPES
// ============================================================================

export type MilestoneWithTasks = Prisma.MilestoneGetPayload<typeof milestoneWithTasksValidator>
export type TaskWithDependencies = Prisma.TaskGetPayload<typeof taskWithDependenciesValidator>

export interface ProjectScheduleResponse {
  id: string
  milestones: MilestoneWithTasks[]
  independentTasks: TaskWithDependencies[]
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateMilestoneInput {
  scheduleId: string
  title: string
  description?: string
  order?: number
  startDate?: Date
  endDate?: Date
}

export interface UpdateMilestoneInput {
  id: string
  title?: string
  description?: string
  order?: number
  startDate?: Date
  endDate?: Date
  status?: MilestoneStatus
}

export interface CreateTaskInput {
  scheduleId: string
  milestoneId?: string
  title: string
  description?: string
  priority?: number
  estimatedTime?: number
  startDate?: Date
  dueDate?: Date
}

export interface UpdateTaskInput {
  id: string
  milestoneId?: string | null
  title?: string
  description?: string
  status?: TaskStatus
  priority?: number
  estimatedTime?: number
  startDate?: Date
  dueDate?: Date
  blockedReason?: string
}
