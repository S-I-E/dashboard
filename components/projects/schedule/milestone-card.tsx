"use client"

import { MilestoneWithTasks } from "@/actions/schedule/types"
import { TaskItem } from "./task-item"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Edit, ChevronRight, ChevronDown } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface MilestoneCardProps {
  milestone: MilestoneWithTasks
  onAddTask: (milestoneId: string) => void
  onEdit: (milestone: MilestoneWithTasks) => void
  onEditTask: (task: any) => void
  onDeleteTask: (id: string) => void
  onTaskStatusChange: (id: string, status: any) => void
  readOnly?: boolean
}

export function MilestoneCard({ milestone, onAddTask, onEdit, onEditTask, onDeleteTask, onTaskStatusChange, readOnly }: MilestoneCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const doneTasks = milestone.tasks.filter((t) => t.status === "DONE").length
  const totalTasks = milestone.tasks.length
  const progress = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0

  return (
    <Card className="overflow-hidden border-slate-200">
      <CardHeader className="bg-slate-50/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <div className="space-y-1">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                {milestone.title}
                {milestone.status === "COMPLETED" && (
                  <Badge variant="default" className="bg-green-500 hover:bg-green-500 text-[10px]">
                    CONCLUÍDO
                  </Badge>
                )}
              </CardTitle>
              {milestone.description && <p className="text-xs text-muted-foreground line-clamp-1">{milestone.description}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!readOnly && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(milestone)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => onAddTask(milestone.id)}>
                  <Plus className="h-4 w-4 mr-2" /> Tarefa
                </Button>
              </>
            )}
          </div>
        </div>

        {totalTasks > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
              <span>Progresso</span>
              <span>
                {Math.round(progress)}% ({doneTasks}/{totalTasks})
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-4 pt-2 space-y-2">
          {milestone.tasks.length > 0 ? (
            milestone.tasks.map((task) => <TaskItem key={task.id} task={task} onEdit={onEditTask} onDelete={onDeleteTask} onStatusChange={onTaskStatusChange} readOnly={readOnly} />)
          ) : (
            <div className="py-8 text-center border-2 border-dashed rounded-lg bg-slate-50/50">
              <p className="text-xs text-muted-foreground">Nenhuma tarefa vinculada a este marco.</p>
              {!readOnly && (
                <Button variant="link" size="sm" onClick={() => onAddTask(milestone.id)}>
                  Adicionar primeira tarefa
                </Button>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
