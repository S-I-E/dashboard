"use client"

import { useEffect, useState, useTransition } from "react"
import { getProjectSchedule, createMilestone, updateMilestone, deleteMilestone, createTask, updateTask, deleteTask, addTaskDependency, removeTaskDependency } from "@/actions/schedule"
import { MilestoneWithTasks, TaskWithDependencies, ProjectScheduleResponse } from "@/actions/schedule/types"
import { MilestoneCard } from "./milestone-card"
import { TaskItem } from "./task-item"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, Calendar, LayoutList, History } from "lucide-react"
import { notify } from "@/lib/notifications"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TaskStatus } from "@prisma/client"

interface ScheduleManagerProps {
  projectId: string
  readOnly?: boolean
}

export function ScheduleManager({ projectId, readOnly }: ScheduleManagerProps) {
  const [data, setData] = useState<ProjectScheduleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Modal states
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<MilestoneWithTasks | null>(null)

  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskWithDependencies | null>(null)
  const [targetMilestoneId, setTargetMilestoneId] = useState<string | null>(null)

  const fetchSchedule = async () => {
    try {
      setLoading(true)
      const res = await getProjectSchedule(projectId)
      setData(res)
    } catch (err) {
      notify.error("Erro ao carregar cronograma")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedule()
  }, [projectId])

  const handleMilestoneSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const title = formData.get("title") as string
    const description = formData.get("description") as string

    startTransition(async () => {
      try {
        if (editingMilestone) {
          await updateMilestone({ id: editingMilestone.id, title, description })
          notify.success("Marco atualizado")
        } else {
          await createMilestone({ scheduleId: data!.id, title, description })
          notify.success("Marco criado")
        }
        setMilestoneModalOpen(false)
        fetchSchedule()
      } catch (err) {
        notify.error("Erro ao salvar marco")
      }
    })
  }

  const handleTaskSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const title = formData.get("title") as string
    const description = formData.get("description") as string
    const milestoneId = targetMilestoneId || (formData.get("milestoneId") as string) || null

    startTransition(async () => {
      try {
        if (editingTask) {
          await updateTask({ id: editingTask.id, title, description, milestoneId })
          notify.success("Tarefa atualizada")
        } else {
          await createTask({ scheduleId: data!.id, title, description, milestoneId: milestoneId || undefined })
          notify.success("Tarefa criada")
        }
        setTaskModalOpen(false)
        fetchSchedule()
      } catch (err) {
        notify.error("Erro ao salvar tarefa")
      }
    })
  }

  const handleTaskStatusChange = async (taskId: string, status: TaskStatus) => {
    startTransition(async () => {
      try {
        await updateTask({ id: taskId, status })
        notify.success("Status atualizado")
        fetchSchedule()
      } catch (err: any) {
        notify.error(err.message || "Erro ao atualizar status")
      }
    })
  }

  const handleTaskDelete = async (taskId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return
    startTransition(async () => {
      try {
        await deleteTask(taskId)
        notify.success("Tarefa excluída")
        fetchSchedule()
      } catch (err) {
        notify.error("Erro ao excluir tarefa")
      }
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando cronograma...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Cronograma de Execução
          </h3>
          <p className="text-xs text-muted-foreground">Gerencie as fases e tarefas do seu projeto.</p>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingMilestone(null)
                setMilestoneModalOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> Marco
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingTask(null)
                setTargetMilestoneId(null)
                setTaskModalOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> Tarefa
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {data?.milestones.map((m) => (
          <MilestoneCard
            key={m.id}
            milestone={m}
            readOnly={readOnly}
            onAddTask={(mid) => {
              setTargetMilestoneId(mid)
              setEditingTask(null)
              setTaskModalOpen(true)
            }}
            onEdit={(milestone) => {
              setEditingMilestone(milestone)
              setMilestoneModalOpen(true)
            }}
            onEditTask={(task) => {
              setEditingTask(task)
              setTargetMilestoneId(task.milestoneId)
              setTaskModalOpen(true)
            }}
            onDeleteTask={handleTaskDelete}
            onTaskStatusChange={handleTaskStatusChange}
          />
        ))}

        {data?.independentTasks && data.independentTasks.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 px-1">
              <LayoutList className="h-4 w-4" /> Tarefas Avulsas
            </h4>
            <div className="space-y-2">
              {data.independentTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  readOnly={readOnly}
                  onEdit={(t) => {
                    setEditingTask(t)
                    setTargetMilestoneId(null)
                    setTaskModalOpen(true)
                  }}
                  onDelete={handleTaskDelete}
                  onStatusChange={handleTaskStatusChange}
                />
              ))}
            </div>
          </div>
        )}

        {!data?.milestones.length && !data?.independentTasks.length && (
          <div className="py-20 text-center border-2 border-dashed rounded-xl bg-muted/5">
            <History className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h4 className="text-base font-bold text-muted-foreground">Nenhuma atividade planejada</h4>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">Comece adicionando marcos de entrega ou tarefas para organizar a execução do seu projeto.</p>
          </div>
        )}
      </div>

      {/* Milestone Modal */}
      <Dialog open={milestoneModalOpen} onOpenChange={setMilestoneModalOpen}>
        <DialogContent>
          <form onSubmit={handleMilestoneSubmit}>
            <DialogHeader>
              <DialogTitle>{editingMilestone ? "Editar Marco" : "Novo Marco de Projeto"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="m-title">Título do Marco</Label>
                <Input id="m-title" name="title" defaultValue={editingMilestone?.title} required placeholder="Ex: Fase de Pesquisa, Lançamento MVP..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-desc">Descrição (Opcional)</Label>
                <Textarea id="m-desc" name="description" defaultValue={editingMilestone?.description || ""} placeholder="O que deve ser alcançado neste marco?" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setMilestoneModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingMilestone ? "Atualizar" : "Criar Marco"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Modal */}
      <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
        <DialogContent>
          <form onSubmit={handleTaskSubmit}>
            <DialogHeader>
              <DialogTitle>{editingTask ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="t-title">Título da Tarefa</Label>
                <Input id="t-title" name="title" defaultValue={editingTask?.title} required placeholder="O que precisa ser feito?" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-desc">Descrição (Opcional)</Label>
                <Textarea id="t-desc" name="description" defaultValue={editingTask?.description || ""} placeholder="Detalhes da tarefa..." />
              </div>
              {!targetMilestoneId && data?.milestones.length && (
                <div className="space-y-2">
                  <Label htmlFor="t-milestone">Marco (Opcional)</Label>
                  <select id="t-milestone" name="milestoneId" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" defaultValue={editingTask?.milestoneId || ""}>
                    <option value="">Nenhum (Tarefa Avulsa)</option>
                    {data.milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setTaskModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingTask ? "Atualizar" : "Adicionar Tarefa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
