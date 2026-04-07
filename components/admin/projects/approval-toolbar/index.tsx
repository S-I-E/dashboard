"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ArrowUpDown, CalendarDays, ChevronDown, ListFilter, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ToggleRadioRow } from "@/components/ui/toggle-radio"
import { ProjectStatus } from "@prisma/client"
import { cn } from "@/lib/utils"
import { PageFilters, PageFilterGroup, PageFilterRow } from "@/components/shell"
import { cloneProjectsApprovalLocalFilters, getProjectsApprovalDefaultQueryParams } from "@/components/admin/projects/approval-toolbar/default"

export function ProjectsApprovalToolbar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "")

  // Local state for filters in the Sheet (staging)
  const [localFilters, setLocalFilters] = useState(() => cloneProjectsApprovalLocalFilters())

  const didApplyDefaultRef = useRef(false)

  const syncLocalFiltersFromUrl = useCallback(() => {
    setLocalFilters({
      status: searchParams.getAll("status") as ProjectStatus[],
      assignedToMe: searchParams.get("assignedToMe") === "true",
      hasWorkPlan: searchParams.get("hasWorkPlan") === "true",
      missingWorkPlan: searchParams.get("missingWorkPlan") === "true",
      hasLegalInstrument: searchParams.get("hasLegalInstrument") === "true",
      missingLegalInstrument: searchParams.get("missingLegalInstrument") === "true",
      dateStart: searchParams.get("dateStart") || "",
      dateEnd: searchParams.get("dateEnd") || "",
    })
  }, [searchParams])

  // Helper to update search params
  const createQueryString = useCallback(
    (params: Record<string, string | string[] | null>) => {
      const newSearchParams = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
          newSearchParams.delete(key)
        } else if (Array.isArray(value)) {
          newSearchParams.delete(key)
          value.forEach((v) => newSearchParams.append(key, v))
        } else {
          newSearchParams.set(key, value)
        }
      }

      return newSearchParams.toString()
    },
    [searchParams]
  )

  // Custom debounce for search (stays real-time as it's outside the sheet)
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentSearch = searchParams.get("search") || ""
      if (searchValue !== currentSearch) {
        router.push(`${pathname}?${createQueryString({ search: searchValue || null })}`, { scroll: false })
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [searchValue, pathname, router, createQueryString, searchParams])

  // On first load, enforce default filter in URL (so server-side list matches UI default)
  useEffect(() => {
    if (didApplyDefaultRef.current) return
    didApplyDefaultRef.current = true

    if (searchParams.get("defaults") === "1") return

    const currentStatus = searchParams.getAll("status")
    if (currentStatus.length > 0) return

    router.replace(`${pathname}?${createQueryString({ ...getProjectsApprovalDefaultQueryParams(), defaults: "1" })}`, { scroll: false })
  }, [pathname, router, searchParams, createQueryString])

  const handleApply = () => {
    const params: Record<string, string | string[] | null> = {
      status: localFilters.status,
      assignedToMe: localFilters.assignedToMe ? "true" : null,
      hasWorkPlan: localFilters.hasWorkPlan ? "true" : null,
      missingWorkPlan: localFilters.missingWorkPlan ? "true" : null,
      hasLegalInstrument: localFilters.hasLegalInstrument ? "true" : null,
      missingLegalInstrument: localFilters.missingLegalInstrument ? "true" : null,
      dateStart: localFilters.dateStart || null,
      dateEnd: localFilters.dateEnd || null,
      page: "1",
    }

    router.push(`${pathname}?${createQueryString(params)}`, { scroll: false })
    setOpen(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      syncLocalFiltersFromUrl()
    }

    if (!newOpen) {
      handleApply()
    }

    setOpen(newOpen)
  }

  const clearFilters = () => {
    setSearchValue("")
    router.push(pathname, { scroll: false })
    setOpen(false)
  }

  const toggleLocalStatus = (status: ProjectStatus, checked: boolean) => {
    setLocalFilters((prev) => ({
      ...prev,
      status: checked ? [...prev.status, status] : prev.status.filter((s) => s !== status),
    }))
  }

  const activeFiltersCount = searchParams.getAll("status").length + (searchParams.get("assignedToMe") === "true" ? 1 : 0) + (searchParams.get("hasWorkPlan") === "true" ? 1 : 0) + (searchParams.get("missingWorkPlan") === "true" ? 1 : 0) + (searchParams.get("hasLegalInstrument") === "true" ? 1 : 0) + (searchParams.get("missingLegalInstrument") === "true" ? 1 : 0) + (searchParams.get("dateStart") ? 1 : 0) + (searchParams.get("dateEnd") ? 1 : 0)

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="relative w-full md:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por título, proponente..." className="pl-9 pr-9 bg-white" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} aria-label="Buscar projetos" />
        {searchValue && (
          <button onClick={() => setSearchValue("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors group">
            <X className="h-4 w-4 group-hover:scale-110" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PageFilters
          open={open}
          onOpenChange={handleOpenChange}
          title="Filtros"
          description="Selecione os critérios e clique em aplicar."
          trigger={
            <Button variant="outline" size="sm" className={cn("h-9 gap-2", activeFiltersCount > 0 && "border-primary/50 bg-primary/5 text-primary")}>
              <ListFilter className="h-4 w-4 text-primary" />
              Filtros
              {activeFiltersCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{activeFiltersCount}</span>}
            </Button>
          }
          footer={
            <div className="flex w-full gap-3">
              <Button variant="outline" className="flex-1 h-10" onClick={clearFilters}>
                Limpar Tudo
              </Button>
              <Button className="flex-1 h-10" onClick={handleApply}>
                Aplicar Filtros
              </Button>
            </div>
          }
        >
          <PageFilterGroup label="Status do Projeto">
            <div className="grid grid-cols-2 gap-1">
              <PageFilterRow label="Pendente" checked={localFilters.status.includes(ProjectStatus.PENDING_REVIEW)} onCheckedChange={(next) => toggleLocalStatus(ProjectStatus.PENDING_REVIEW, next)} />
              <PageFilterRow label="Em revisão" checked={localFilters.status.includes(ProjectStatus.UNDER_REVIEW)} onCheckedChange={(next) => toggleLocalStatus(ProjectStatus.UNDER_REVIEW, next)} />
              <PageFilterRow label="Aprovado" checked={localFilters.status.includes(ProjectStatus.APPROVED)} onCheckedChange={(next) => toggleLocalStatus(ProjectStatus.APPROVED, next)} />
              <PageFilterRow label="Rejeitado" checked={localFilters.status.includes(ProjectStatus.REJECTED)} onCheckedChange={(next) => toggleLocalStatus(ProjectStatus.REJECTED, next)} />
            </div>
          </PageFilterGroup>

          <Separator />

          <PageFilterGroup label="Atribuição">
            <PageFilterRow label="Vinculados a mim" checked={localFilters.assignedToMe} onCheckedChange={(next) => setLocalFilters((prev) => ({ ...prev, assignedToMe: next }))} />
          </PageFilterGroup>

          <Separator />

          <PageFilterGroup label="Período de Submissão">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground text-left block">Desde</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="date" className="h-9 pl-9 text-sm" value={localFilters.dateStart} onChange={(e) => setLocalFilters((prev) => ({ ...prev, dateStart: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground text-left block">Até</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="date" className="h-9 pl-9 text-sm" value={localFilters.dateEnd} onChange={(e) => setLocalFilters((prev) => ({ ...prev, dateEnd: e.target.value }))} />
                </div>
              </div>
            </div>
          </PageFilterGroup>

          <Separator />

          <PageFilterGroup label="Pendências Técnicas">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground text-left block">Plano de Trabalho</Label>
                <div className="grid grid-cols-1 gap-1" role="radiogroup" aria-label="Plano de Trabalho">
                  <ToggleRadioRow
                    label="Com plano"
                    checked={localFilters.hasWorkPlan}
                    onCheckedChange={(next) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        hasWorkPlan: next,
                        missingWorkPlan: false,
                      }))
                    }
                  />
                  <ToggleRadioRow
                    label="Sem plano"
                    checked={localFilters.missingWorkPlan}
                    onCheckedChange={(next) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        missingWorkPlan: next,
                        hasWorkPlan: false,
                      }))
                    }
                  />
                </div>
              </div>
              <Separator className="border-dashed" />
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground text-left block">Instrumento Jurídico</Label>
                <div className="grid grid-cols-1 gap-1" role="radiogroup" aria-label="Instrumento Jurídico">
                  <ToggleRadioRow
                    label="Com instrumento"
                    checked={localFilters.hasLegalInstrument}
                    onCheckedChange={(next) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        hasLegalInstrument: next,
                        missingLegalInstrument: false,
                      }))
                    }
                  />
                  <ToggleRadioRow
                    label="Sem instrumento"
                    checked={localFilters.missingLegalInstrument}
                    onCheckedChange={(next) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        missingLegalInstrument: next,
                        hasLegalInstrument: false,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </PageFilterGroup>
        </PageFilters>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              Ordenar
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuLabel>Ordenação</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => router.push(`${pathname}?${createQueryString({ sort: "date_desc" })}`)}>
              Data (mais recente)
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => router.push(`${pathname}?${createQueryString({ sort: "date_asc" })}`)}>
              Data (mais antigo)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => router.push(`${pathname}?${createQueryString({ sort: "title_asc" })}`)}>
              Título (A → Z)
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => router.push(`${pathname}?${createQueryString({ sort: "title_desc" })}`)}>
              Título (Z → A)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => router.push(`${pathname}?${createQueryString({ sort: "status_asc" })}`)}>
              Status (A → Z)
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => router.push(`${pathname}?${createQueryString({ sort: "status_desc" })}`)}>
              Status (Z → A)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
