"use client"

import { TaskWithDependencies } from "@/actions/schedule/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock, MoreVertical, Trash2, Edit2, Lock } from "lucide-react"
import { TaskStatus } from "@prisma/client"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface TaskItemProps {
  task: TaskWithDependencies
  onEdit?: (task: TaskWithDependencies) => void
  onDelete?: (id: string) => void
  onStatusChange?: (id: string, status: TaskStatus) => void
  readOnly?: boolean
}

export function TaskItem({ task, onEdit, onDelete, onStatusChange, readOnly }: TaskItemProps) {
  const statusColors = {
    TODO: "bg-slate-100 text-slate-700 border-slate-200",
    DOING: "bg-blue-50 text-blue-700 border-blue-200",
    DONE: "bg-green-50 text-green-700 border-green-200",
    BLOCKED: "bg-red-50 text-red-700 border-red-200",
  }

  const isBlocked = task.status === "BLOCKED" || task.dependencies.some((d) => d.dependsOnTask.status !== "DONE")

  return (
    <div className={cn("group flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-all", task.status === "DONE" && "opacity-60 bg-slate-50")}>
      <div className="flex items-center gap-3">
        {task.status === "DONE" ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : isBlocked ? <Lock className="h-5 w-5 text-red-400" /> : <div className="h-5 w-5 rounded-full border-2 border-slate-300" />}

        <div className="flex flex-col">
          <span className={cn("text-sm font-medium", task.status === "DONE" && "line-through text-slate-500")}>{task.title}</span>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={cn("text-[10px] uppercase font-bold px-1.5 py-0", statusColors[task.status])}>
              {task.status === "TODO" && "Pendente"}
              {task.status === "DOING" && "Fazendo"}
              {task.status === "DONE" && "Concluída"}
              {task.status === "BLOCKED" && "Bloqueada"}
            </Badge>
            {task.estimatedTime && (
              <span className="flex items-center text-[10px] text-muted-foreground gap-1">
                <Clock className="h-3 w-3" />
                {task.estimatedTime}m
              </span>
            )}
            {task.dependencies.length > 0 && <span className="text-[10px] text-orange-600 font-medium">{task.dependencies.length} dependência(s)</span>}
          </div>
        </div>
      </div>

      {!readOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit?.(task)}>
              <Edit2 className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            {task.status !== "DONE" && (
              <DropdownMenuItem onClick={() => onStatusChange?.(task.id, "DONE")}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar Concluída
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete?.(task.id)}>
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
