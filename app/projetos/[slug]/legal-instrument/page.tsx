"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import ProjectClassificationStart from "@/components/projects/classification-start"
import { ProjectClassificationWizard } from "@/components/projects/classification-wizard"
import { useProject } from "@/components/providers/project"
import { Skeleton } from "@/components/ui/skeleton"
import { createLegalInstrument } from "@/actions/projects"
import { notify } from "@/lib/notifications"
import { APP_ERRORS } from "@/lib/errors"
import type { ProjectClassificationResult, ProjectClassificationSavedState } from "@/types/legal-instrument"
import LoadingOverlay from "@/components/ui/loading-overlay"

export default function Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextParam = searchParams.get("next")
  const { project, loading, updateLegalInstrument } = useProject()
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<"start" | "wizard">("start")
  const [initialState, setInitialState] = useState<ProjectClassificationSavedState | null>(null)

  const handleComplete = async (res: ProjectClassificationResult) => {
    if (!project || !project.slug) return
    setSaving(true)
    try {
      const result = await createLegalInstrument(project.slug, res)

      if (result.success) {
        notify.success("Instrumento jurídico salvo com sucesso!")

        // Update local context with the created link if returned
        if (result.created && updateLegalInstrument) {
          updateLegalInstrument(result.created)
        }

        const next = nextParam
        if (next) {
          router.push(`/projetos/${project.slug}/${next}`)
          return
        }

        router.push(`/projetos/${project.slug}/`)
      } else {
        if (result.error) notify.error(result.error)
        notify.error(APP_ERRORS.GENERIC_ERROR.code)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleStart = () => {
    setInitialState(null)
    setMode("wizard")
  }

  const handleResume = (savedState: ProjectClassificationSavedState) => {
    setInitialState(savedState)
    setMode("wizard")
  }

  const handleWizardReset = () => {
    if (project && project.slug) {
      const storageKey = `legalInstrumentWizard:${project.slug}`
      localStorage.removeItem(storageKey)
    }
    setInitialState(null)
    setMode("start")

    const url = new URL(window.location.href)
    url.searchParams.delete("state")
    url.searchParams.delete("wizard")
    router.replace(url.pathname + url.search)
  }

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-4 space-y-8 max-w-5xl">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-[300px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    )
  }

  if (!project) return null

  return (
    <>
      <LoadingOverlay open={saving} message="Criando instrumento jurídico..." />
      <div className="h-full bg-linear-to-b from-background to-muted/20">
        <div className="container min-h-full mx-auto py-6 px-4 md:py-8 flex flex-col">
          <div className="flex-1 flex flex-col h-full justify-center">{mode === "start" ? <ProjectClassificationStart projectSlug={project.slug!} onStart={handleStart} onResume={handleResume} /> : <ProjectClassificationWizard initialState={initialState ?? undefined} onReset={handleWizardReset} onComplete={handleComplete} />}</div>
        </div>
      </div>
    </>
  )
}
