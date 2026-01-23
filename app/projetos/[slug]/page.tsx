"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, FileText, Plus, Edit, Scale, Download, CheckCircle2, AlertCircle, SendHorizontal, Loader2, XCircle } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useProject } from "@/components/providers/project"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PageContent, PageHeader, PageHeaderHeading, PageShell, PageBack } from "@/components/shell"
import { ProjectEditSheet } from "@/components/projects/edit-sheet"
import { DependencyCard } from "@/components/projects/dependency-card"
import { UserAvatar } from "@/components/user-avatar"
import { ProjectStatus, LegalInstrumentStatus } from "@prisma/client"
import { submitProjectForApproval } from "@/actions/projects"
import { notify } from "@/lib/notifications"
import type { LucideIcon } from "lucide-react"
import type { ProjectDependences } from "@/components/providers/project"
import type { LegalInstrumentFieldSpec } from "@/types/legal-instrument"
import { legalInstrumentTypeLabel } from "@/lib/utils/legal-instrument"
import { ProjectStatusBadge } from "@/components/projects/status-badge"
import { ExportPdfButton } from "@/components/projects/export-pdf-button"
import { ScheduleManager } from "@/components/projects/schedule/schedule-manager"

type MissingDependency = {
  id: string
  label: string
  description: string
  link: string
  action: string
  icon: LucideIcon
}

type ProjectLegalInstrumentInstance = NonNullable<ProjectDependences["legal-instrument"]>

const getErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message
    return typeof message === "string" ? message : undefined
  }
  return undefined
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export default function ProjectDetailsPage() {
  const router = useRouter()
  const { project, dependences, loading, view } = useProject()
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-[300px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
        <Skeleton className="h-[400px] w-full" />
      </PageShell>
    )
  }

  if (!project) return null

  const workPlan = dependences["work-plan"]
  const legalInstrumentInstance: ProjectLegalInstrumentInstance | null = dependences["legal-instrument"] ?? null

  const specificObjectives: any = workPlan?.specificObjectives
  console.log("specificObjectives: ", specificObjectives)
  console.log("workPlan: ", workPlan?.specificObjectives)

  // Calculate dependencies
  const missingDependencies: MissingDependency[] = []

  const hasWorkPlan = !!workPlan
  const hasLegalInstrument = !!legalInstrumentInstance || (!!(project as any).proposedInstrumentType && !!(project as any).classificationAnswers)
  const hasPendingInstrument = !!legalInstrumentInstance && (legalInstrumentInstance.status || LegalInstrumentStatus.PENDING) !== LegalInstrumentStatus.FILLED

  const canSubmit = view?.allowActions && hasWorkPlan && hasLegalInstrument && (project.status === ProjectStatus.DRAFT || (project.status as any) === "RETURNED")

  // Mensagem de feedback para botão desabilitado
  const getSubmitDisabledReason = () => {
    if (project.status !== ProjectStatus.DRAFT && (project.status as any) !== "RETURNED") return "Projeto já foi enviado"
    if (!hasWorkPlan) return "É necessário criar o Plano de Trabalho"
    if (!hasLegalInstrument) return "É necessário realizar a Classificação do Projeto (Wizard)"
    return null
  }

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      await submitProjectForApproval(project.slug!)
      notify.success("Projeto enviado para análise!")
      router.refresh()
    } catch (error: unknown) {
      console.error(error)
      notify.error(getErrorMessage(error) ?? "Erro ao enviar projeto")
    } finally {
      setIsSubmitting(false)
    }
  }

  // 1. Work Plan Dependency
  if (!workPlan) {
    missingDependencies.push({
      id: "work-plan",
      label: "Plano de Trabalho",
      description: "O plano de trabalho ainda não foi criado. É necessário definir metas e cronograma.",
      link: `/projetos/${project.slug}/work-plan`,
      action: "Criar Plano",
      icon: FileText,
    })
  }

  // 2. Legal Instrument Dependency
  if (!legalInstrumentInstance) {
    missingDependencies.push({
      id: "legal-instrument-select",
      label: "Instrumento Jurídico",
      description: "Instrumento jurídico ainda não foi selecionado para este projeto.",
      link: `/projetos/${project.slug}/legal-instrument`,
      action: "Selecionar",
      icon: Scale,
    })
  } else {
    if ((legalInstrumentInstance.status || LegalInstrumentStatus.PENDING) !== LegalInstrumentStatus.FILLED) {
      const instrumentName = legalInstrumentInstance.legalInstrumentVersion.legalInstrument.name
      missingDependencies.push({
        id: `legal-instrument-fill-${legalInstrumentInstance.id}`,
        label: `Preencher ${instrumentName}`,
        description: "O instrumento jurídico precisa ser preenchido para gerar o documento.",
        link: `/projetos/${project.slug}/legal-instrument/fill`,
        action: "Preencher",
        icon: Scale,
      })
    }
  }

  return (
    <PageShell>
      {/* Header */}
      <PageHeader className="flex-col items-start gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <PageBack href="/projetos" className="text-muted-foreground hover:text-foreground">
            Voltar para Projetos
          </PageBack>
          <PageHeaderHeading className="text-3xl font-bold tracking-tight">{project.title}</PageHeaderHeading>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center">
              <Calendar className="mr-2 h-4 w-4" />
              Criado em {format(new Date(project.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <span className="hidden md:inline">•</span>
            <ProjectStatusBadge status={project.status} className="font-normal" />
            {project.approvedAt && (
              <>
                <span className="hidden md:inline">•</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Aprovado em {format(new Date(project.approvedAt), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </>
            )}
            {project.status === ProjectStatus.REJECTED && project.rejectionReason && (
              <>
                <span className="hidden md:inline">•</span>
                <span className="text-red-600 dark:text-red-400">Motivo: {project.rejectionReason}</span>
              </>
            )}
            {view?.mode !== "owner" && project.user && (
              <>
                <span className="hidden md:inline">•</span>
                <span className="flex items-center gap-2">
                  <UserAvatar size="sm" preview={{ name: project.user.name, image: project.user.imageFile?.url, color: project.user.color }} />
                  <span>{project.user.name}</span>
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {view?.allowActions && (project.status === ProjectStatus.DRAFT || (project.status as any) === "RETURNED") && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !canSubmit} variant="default" className="bg-blue-600 hover:bg-blue-700">
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                        </>
                      ) : (
                        <>
                          <SendHorizontal className="mr-2 h-4 w-4" /> Enviar para Análise
                        </>
                      )}
                    </Button>
                  </div>
                </TooltipTrigger>
                {!canSubmit && getSubmitDisabledReason() && (
                  <TooltipContent>
                    <p className="text-sm">{getSubmitDisabledReason()}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
          {view?.allowActions && (project.status === ProjectStatus.DRAFT || (project.status as any) === "RETURNED") && (
            <Button onClick={() => setIsEditSheetOpen(true)}>
              <Edit className="mr-2 h-4 w-4" /> Editar Detalhes
            </Button>
          )}
          <ExportPdfButton project={project} />
        </div>
      </PageHeader>

      {project.status === ProjectStatus.APPROVED && (project as any).approvalOpinion && (
        <Card className="bg-green-50 border-green-200 mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-green-900">Parecer Técnico de Aprovação</p>
                <div className="prose prose-sm prose-green max-w-none">
                  <p className="text-green-800 whitespace-pre-wrap">{(project as any).approvalOpinion}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {project.status === (ProjectStatus as any).RETURNED && (project as any).returnReason && (
        <Card className="bg-amber-50 border-amber-200 mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-900">Ajustes Solicitados pelo Administrador</p>
                <div className="prose prose-sm prose-amber max-w-none">
                  <p className="text-amber-800 whitespace-pre-wrap">{(project as any).returnReason}</p>
                </div>
                <p className="text-xs text-amber-700 mt-2 italic">* Realize as alterações solicitadas e clique em "Enviar para Análise" novamente.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {project.status === ProjectStatus.REJECTED && project.rejectionReason && (
        <Card className="bg-red-50 border-red-200 mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-red-900">Projeto Rejeitado</p>
                <div className="prose prose-sm prose-red max-w-none">
                  <p className="text-red-800 whitespace-pre-wrap">{project.rejectionReason}</p>
                </div>
                <p className="text-xs text-red-700 mt-2 italic">* Caso deseje contestar, entre em contato com a coordenação.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      <PageContent>
        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
              Histórico
            </TabsTrigger>
            <TabsTrigger value="workplan" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
              Plano de Trabalho
            </TabsTrigger>
            <TabsTrigger value="legal-instrument" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
              Instrumento Jurídico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8 animate-in fade-in-50 duration-300">
            <div className="grid gap-8 md:grid-cols-3">
              {/* Main Info */}
              <div className={cn("space-y-8", missingDependencies.length > 0 || (view?.allowActions && project.status === ProjectStatus.DRAFT) ? "md:col-span-2" : "md:col-span-3")}>
                <section className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" /> Objetivos
                  </h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">{project.objectives || "Nenhum objetivo definido."}</div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-lg font-semibold">Justificativa</h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">{project.justification || "Nenhuma justificativa definida."}</div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-lg font-semibold">Abrangência</h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">{project.scope || "Nenhuma abrangência definida."}</div>
                </section>
              </div>

              {/* Sidebar */}
              {(missingDependencies.length > 0 || (view?.allowActions && project.status === ProjectStatus.DRAFT)) && (
                <div className="space-y-4">
                  {missingDependencies.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 font-medium text-orange-600 dark:text-orange-400">
                        <AlertCircle className="h-5 w-5" />
                        Pendências do Projeto
                      </div>
                      {missingDependencies.map((dep) => (
                        <DependencyCard key={dep.id} title={dep.label} description={dep.description} icon={dep.icon} actionLabel={dep.action} actionLink={dep.link} variant="warning" readOnly={!view?.allowActions} />
                      ))}
                    </div>
                  )}

                  {!missingDependencies.length && view?.allowActions && project.status === ProjectStatus.DRAFT && (
                    <Card className="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                          <div>
                            <CardTitle className="text-base text-green-900 dark:text-green-300">Pronto para Submissão</CardTitle>
                            <CardDescription className="text-green-700 dark:text-green-400 mt-1">Todas as dependências foram atendidas. Você pode enviar o projeto para análise.</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="animate-in fade-in-50 duration-300">
            <Card>
              <CardHeader>
                <CardTitle>Histórico</CardTitle>
                <CardDescription>Registro de ações do projeto</CardDescription>
              </CardHeader>
              <CardContent>
                {!project.audits.length ? (
                  <div className="text-sm text-muted-foreground">Nenhuma ação registrada ainda.</div>
                ) : (
                  <div className="space-y-3">
                    {project.audits.map((a) => {
                      const details = isPlainObject(a.changeDetails) ? (a.changeDetails as any) : {}
                      const reason = typeof details.reason === "string" ? details.reason : undefined
                      const opinion = typeof details.opinion === "string" ? details.opinion : undefined

                      return (
                        <div key={a.id} className="flex items-start gap-3 text-sm">
                          <div className="shrink-0 w-2 h-2 rounded-full bg-muted mt-1.5" />
                          <div className="flex-1">
                            <div className="font-medium">
                              {a.action === "SUBMITTED" && "Enviado para análise"}
                              {a.action === "APPROVED" && "Projeto Aprovado"}
                              {a.action === "REJECTED" && "Projeto Rejeitado"}
                              {a.action === "RETURNED" && "Ajustes Solicitados"}
                              {a.action === "REVIEW_STARTED" && "Análise Iniciada"}
                              {!(["SUBMITTED", "APPROVED", "REJECTED", "RETURNED", "REVIEW_STARTED"] as string[]).includes(a.action) && a.action}
                            </div>
                            <div className="text-muted-foreground">
                              {a.user?.name ? (a.changedBy === project.userId ? `por ${a.user.name}` : "por Administrador") : null}
                              {a.createdAt ? ` • ${format(new Date(a.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}` : null}
                            </div>
                            {reason && <div className="mt-1 text-red-600 dark:text-red-400 italic">Motivo: {reason}</div>}
                            {opinion && <div className="mt-1 text-green-600 dark:text-green-400 italic">Parecer: {opinion}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workplan" className="animate-in fade-in-50 duration-300">
            {workPlan ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle>Plano de Trabalho</CardTitle>
                      <CardDescription>
                        Criado em {format(new Date(workPlan.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        {workPlan.updatedAt ? <> • Atualizado em {format(new Date(workPlan.updatedAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</> : null}
                      </CardDescription>
                    </div>
                    {view?.allowActions && (
                      <Button variant="outline" asChild>
                        <Link href={`/projetos/${project.slug}/work-plan`}>
                          <Edit className="mr-2 h-4 w-4" /> Gerenciar Plano
                        </Link>
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-6">
                        <div className="rounded-lg border bg-muted/10">
                          <div className="p-4 border-b">
                            <h4 className="font-medium flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary" /> Objetivos
                            </h4>
                          </div>
                          <div className="p-4 space-y-4">
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">Objetivo Geral</div>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{workPlan.generalObjective}</p>
                            </div>

                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">Objetivos Específicos</div>
                              {specificObjectives.length ? (
                                <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
                                  {specificObjectives.map((objective: any, idx: any) => (
                                    <li key={`${idx}-${objective.value}`}>{objective.value}</li>
                                  ))}
                                </ol>
                              ) : (
                                <div className="text-sm text-muted-foreground">Não informado.</div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-lg border bg-muted/10">
                          <div className="p-4 border-b">
                            <h4 className="font-medium flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-primary" /> Informações
                            </h4>
                          </div>
                          <div className="p-4 space-y-4">
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">Vigência</div>
                              <div className="text-sm">
                                <span className="text-muted-foreground">
                                  {workPlan.validityStart ? format(new Date(workPlan.validityStart), "dd/MM/yyyy") : "Início não definido"}
                                  {" - "}
                                  {workPlan.validityEnd ? format(new Date(workPlan.validityEnd), "dd/MM/yyyy") : "Fim não definido"}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">Objeto</div>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{workPlan.object || "Não informado."}</p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">Unidade Responsável</div>
                                <div className="text-sm text-muted-foreground">{workPlan.responsibleUnit || "Não informado."}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">Gestor da ICT</div>
                                <div className="text-sm text-muted-foreground">{workPlan.ictManager || "Não informado."}</div>
                              </div>
                              <div className="space-y-1 sm:col-span-2">
                                <div className="text-xs font-medium text-muted-foreground">Gestor do Parceiro</div>
                                <div className="text-sm text-muted-foreground">{workPlan.partnerManager || "Não informado."}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="rounded-lg border bg-muted/10">
                          <div className="p-4 border-b">
                            <h4 className="font-medium">Diagnóstico e Escopo</h4>
                          </div>
                          <div className="p-4 space-y-4">
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">Diagnóstico</div>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{workPlan.diagnosis || "Não informado."}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">Justificativa</div>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{workPlan.planJustification || "Não informado."}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">Abrangência</div>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{workPlan.planScope || "Não informado."}</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-lg border bg-muted/10">
                          <div className="p-4 border-b">
                            <h4 className="font-medium">Metodologia e Resultados</h4>
                          </div>
                          <div className="p-4 space-y-4">
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">Metodologia</div>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{workPlan.methodology || "Não informado."}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">Resultados Esperados</div>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{workPlan.expectedResults || "Não informado."}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">Monitoramento e Avaliação</div>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{workPlan.monitoring || "Não informado."}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Equipe Executora</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                        <p className="text-sm text-muted-foreground">Em desenvolvimento</p>
                        {view?.allowActions && (
                          <Button variant="link" size="sm" asChild>
                            <Link href={`/projetos/${project.slug}/work-plan`}>Ver Equipe</Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-6">
                    <ScheduleManager projectId={project.id} readOnly={!view?.allowActions || (project.status !== ProjectStatus.DRAFT && (project.status as any) !== "RETURNED")} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg bg-muted/10">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhum plano de trabalho</h3>
                <p className="text-muted-foreground max-w-sm text-center mb-6">Crie um plano de trabalho para definir os objetivos, cronograma e equipe do projeto.</p>
                {view?.allowActions && (
                  <Button asChild>
                    <Link href={`/projetos/${project.slug}/work-plan`}>
                      <Plus className="mr-2 h-4 w-4" /> Criar Plano de Trabalho
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="legal-instrument" className="animate-in fade-in-50 duration-500">
            {legalInstrumentInstance ? (
              <div className="space-y-6">
                {(() => {
                  const instance = legalInstrumentInstance
                  const instrument = instance.legalInstrumentVersion.legalInstrument
                  const filledFile = instance.filledFile ?? null
                  const status = instance.status || LegalInstrumentStatus.PENDING

                  const answers = (instance.answers ?? {}) as unknown as Record<string, unknown>
                  const fields = (instance.legalInstrumentVersion.fieldsJson ?? []) as unknown as LegalInstrumentFieldSpec[]
                  const requiredFields = fields.filter((f) => f.required)

                  const isAnswered = (fieldId: string) => {
                    const val = answers[fieldId]
                    return val !== undefined && val !== null && String(val).trim() !== ""
                  }

                  const requiredFilledCount = requiredFields.filter((f) => isAnswered(f.id)).length
                  const requiredTotalCount = requiredFields.length
                  const requiredProgress = requiredTotalCount > 0 ? requiredFilledCount / requiredTotalCount : 1
                  const isFullyFilled = status === LegalInstrumentStatus.FILLED

                  const actionLabel = status === LegalInstrumentStatus.FILLED ? "Revisar Respostas" : status === LegalInstrumentStatus.PARTIAL ? "Continuar Preenchimento" : "Iniciar Preenchimento"

                  const isReviewingDocument = project.status === ProjectStatus.PENDING_REVIEW || project.status === ProjectStatus.UNDER_REVIEW

                  return (
                    <div className="space-y-6">
                      {isReviewingDocument && (
                        <Card className="bg-blue-50 border-blue-200">
                          <CardContent className="pt-6">
                            <div className="flex gap-3">
                              <Loader2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5 animate-spin" />
                              <div className="space-y-1">
                                <p className="font-semibold text-blue-900">Documento em Análise pela SIE</p>
                                <p className="text-sm text-blue-800">O instrumento jurídico preenchido foi enviado para análise da equipe técnica da SIE. Você será notificado assim que houver um parecer ou solicitação de ajustes.</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      <div className="grid gap-6 lg:grid-cols-12 items-stretch">
                        {/* Header Status Card */}
                        <Card className="overflow-hidden border-none col-span-7 shadow-md bg-linear-to-br from-card to-muted/30">
                          <CardHeader className="pb-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <Scale className="h-5 w-5" />
                                  </div>
                                  <CardTitle className="text-xl">{instrument.name}</CardTitle>
                                </div>
                                <CardDescription className="text-xs font-medium flex items-center gap-2">{legalInstrumentTypeLabel(instance.legalInstrumentVersion.type)}</CardDescription>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Badge variant={isFullyFilled ? "default" : "secondary"} className={cn("px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-xs", isFullyFilled && "bg-green-500 hover:bg-green-600 border-none text-white", status === LegalInstrumentStatus.PARTIAL && "bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-900", status === LegalInstrumentStatus.PENDING && "bg-muted text-muted-foreground")}>
                                  {status === LegalInstrumentStatus.FILLED && "Completo"}
                                  {status === LegalInstrumentStatus.PARTIAL && "Em Progresso"}
                                  {status === LegalInstrumentStatus.PENDING && "Pendente"}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>

                          <div className="flex px-6 flex-col sm:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-background border shadow-sm">
                                <CheckCircle2 className="h-6 w-6 text-primary" />
                              </div>
                              <div className="space-y-0.5">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Progresso</h4>
                                <p className="text-xs text-muted-foreground">{requiredTotalCount > 0 ? `${requiredFilledCount} de ${requiredTotalCount} campos obrigatórios finalizados` : "Sem campos obrigatórios específicos"}</p>
                              </div>
                            </div>

                            {requiredTotalCount > 0 && (
                              <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black tracking-tighter text-primary">{Math.round(requiredProgress * 100)}%</span>
                                <span className="text-xs font-bold text-muted-foreground/50 uppercase">Concluído</span>
                              </div>
                            )}
                          </div>

                          {/* Progress bar attached to bottom of header card */}
                          {requiredTotalCount > 0 && (
                            <div className="h-1.5 w-full bg-muted/50">
                              <div className={cn("h-full transition-all duration-1000 ease-out bg-primary")} style={{ width: `${Math.round(requiredProgress * 100)}%` }} />
                            </div>
                          )}
                        </Card>

                        {/* Actions Card */}
                        <Card className="shadow-md border-primary/10 col-span-5 overflow-hidden">
                          <CardHeader className="bg-muted/20 pb-4">
                            <CardTitle className="text-lg">Gerenciar</CardTitle>
                          </CardHeader>
                          <CardContent className="p-6">
                            {view?.allowActions ? (
                              <Button className={cn("w-full h-11 text-sm font-semibold transition-all shadow-md", !isFullyFilled && "shadow-primary/20")} variant={isFullyFilled ? "outline" : "default"} asChild>
                                <Link href={`/projetos/${project.slug}/legal-instrument/fill`}>
                                  <Edit className="mr-2 h-4 w-4" /> {actionLabel}
                                </Link>
                              </Button>
                            ) : (
                              <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/50">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <span className="text-sm font-medium">Visualização restrita.</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="bg-muted/30 border-dashed col-span-7">
                          <CardContent className="p-5">
                            <p className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
                              <span>As alterações são salvas automaticamente. O instrumento jurídico será bloqueado permanentemente após o envio para análise técnica.</span>
                            </p>
                          </CardContent>
                        </Card>

                        {/* Metadata/Cronologia Card */}
                        <Card className="shadow-sm col-span-5">
                          <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Histórico</CardTitle>
                          </CardHeader>
                          <CardContent className="flex justify-between">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Primeiro Registro</span>
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <Calendar className="h-4 w-4 text-primary/60" />
                                {format(new Date(instance.createdAt), "dd/MM/yyyy HH:mm")}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Última Edição</span>
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <Calendar className="h-4 w-4 text-primary/60" />
                                {format(new Date(instance.updatedAt), "dd/MM/yyyy HH:mm")}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        <div className="col-span-7">
                          {filledFile && (
                            <Card className="border-green-500/20 col-span-7 bg-green-500/5 shadow-inner">
                              <CardContent className="p-6">
                                <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                                  <div className="p-3 rounded-xl bg-green-500/10 text-green-600">
                                    <FileText className="h-8 w-8" />
                                  </div>
                                  <div className="flex-1 space-y-0.5 text-center sm:text-left">
                                    <h4 className="font-bold text-green-900 dark:text-green-300">Minuta Pronta para Download</h4>
                                    <p className="text-xs text-muted-foreground max-w-md">O documento foi gerado automaticamente com os dados preenchidos até o momento.</p>
                                  </div>
                                  <Button size="sm" className="shrink-0 bg-green-600 hover:bg-green-700 shadow-sm" asChild>
                                    <Link href={filledFile.url} target="_blank">
                                      <Download className="h-4 w-4 mr-2" /> Baixar PDF
                                    </Link>
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>

                        {/* Discrete Technical Reference */}
                        <div className="px-2 pt-2 col-span-5 space-y-1 opacity-40 hover:opacity-100 transition-opacity">
                          <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                            <span>Versão do Instrumento</span>
                            <span className="font-bold">v{instance.legalInstrumentVersion.version}</span>
                          </div>
                          <div className="text-[8px] font-mono text-muted-foreground break-all text-center">ID: {instance.id}</div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : (project as any).proposedInstrumentType ? (
              <div className="space-y-6">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <Loader2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5 animate-spin" />
                      <div className="space-y-1">
                        <p className="font-semibold text-blue-900">Aguardando Classificação pela SIE</p>
                        <p className="text-sm text-blue-800">
                          Você já realizou a classificação preliminar (Sugestão: <strong>{legalInstrumentTypeLabel((project as any).proposedInstrumentType as any)}</strong>). Agora a equipe técnica da SIE analisará seu projeto para confirmar o instrumento jurídico adequado. O documento para preenchimento será liberado em seguida.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-dashed">
                  <CardHeader>
                    <CardTitle className="text-lg">Classificação Realizada</CardTitle>
                    <CardDescription>Resumo das respostas enviadas para análise</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                      <p className="text-sm text-muted-foreground italic">O histórico de respostas do Wizard será exibido aqui em breve (Fase 3).</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-muted/5 transition-colors hover:bg-muted/10">
                <div className="p-6 rounded-full bg-muted/50 mb-6 group-hover:scale-110 transition-transform">
                  <Scale className="h-12 w-12 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-bold mb-2">Instrumento jurídico não selecionado</h3>
                <p className="text-muted-foreground max-w-sm text-center mb-8 text-sm">Cada projeto deve estar vinculado a um instrumento jurídico que define as regras e termos da parceria.</p>
                {view?.allowActions && (
                  <Button size="lg" className="px-8 shadow-lg shadow-primary/20" asChild>
                    <Link href={`/projetos/${project.slug}/legal-instrument`}>
                      <Plus className="mr-2 h-5 w-5" /> Selecionar Agora
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageContent>

      <ProjectEditSheet
        project={{
          ...project,
          slug: project.slug || "",
        }}
        open={isEditSheetOpen}
        onOpenChange={setIsEditSheetOpen}
      />
    </PageShell>
  )
}
