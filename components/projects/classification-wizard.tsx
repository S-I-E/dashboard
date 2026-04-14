"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useMachine } from "@xstate/react"
import { createProjectFlowMachine } from "@/lib/constrants/project-flow-machine"
import { Button } from "@/components/ui/button"
import Modal from "@/components/ui/modal"
import { getLegalSupportWhatsApp } from "@/actions/system-defaults"
import { CheckCircle2, RotateCcw, ArrowRight, CheckCircle, AlertCircle, MessageCircle, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { LegalInstrumentType } from "@prisma/client"
import type { ProjectClassificationAnswer, ProjectClassificationResult, ProjectClassificationSavedState } from "@/types/legal-instrument"

const STATE_TO_PARTNERSHIP_TYPE: Record<string, LegalInstrumentType> = {
  result_pdi_agreement: LegalInstrumentType.PDI_AGREEMENT,
  result_service_contract: LegalInstrumentType.SERVICE_CONTRACT,
  result_appdi_private: LegalInstrumentType.APPDI_PRIVATE,
  result_appdi_no_funding: LegalInstrumentType.APPDI_NO_FUNDING,
  result_coop_agreement: LegalInstrumentType.COOP_AGREEMENT,
  result_nda: LegalInstrumentType.NDA,
  result_tech_transfer: LegalInstrumentType.TECH_TRANSFER,
  result_review_scope: LegalInstrumentType.REVIEW_SCOPE,
}

interface ProjectClassificationWizardProps {
  onComplete: (result: ProjectClassificationResult) => void
  initialState?: ProjectClassificationSavedState
  onReset?: () => void
}

export function ProjectClassificationWizard({ onComplete, initialState, onReset }: ProjectClassificationWizardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [resetKey, setResetKey] = useState(0)
  const [wizardId, setWizardId] = useState(() =>
    searchParams.get("wizard") ?? (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()))
  )
  const [isConsultDialogOpen, setIsConsultDialogOpen] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const machine = useMemo(() => createProjectFlowMachine(), [])
  const [state, send] = useMachine(machine)
  const [history, setHistory] = useState<ProjectClassificationAnswer[]>([])

  const [legalSupportWhatsApp, setLegalSupportWhatsApp] = useState<string>(process.env.NEXT_PUBLIC_LEGAL_SUPPORT_PHONE || "+55 11 99999-9999")

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const value = await getLegalSupportWhatsApp()
        if (mounted && value) setLegalSupportWhatsApp(value)
      } catch (err) {
        // ignore, keep fallback
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const WHATSAPP_PHONE = legalSupportWhatsApp.replace(/\D/g, "")
  const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=Olá%2C%20gostaria%20de%20consultar%20sobre%20classificação%20de%20projeto.`

  const currentStateValue = state.value as string
  const isFinal = Object.keys(STATE_TO_PARTNERSHIP_TYPE).includes(currentStateValue)
  const currentStateNode = machine.states[currentStateValue as keyof typeof machine.states] as unknown as
    | { meta?: { description?: string } }
    | undefined
  const description = currentStateNode?.meta?.description || "Responda para continuar..."
  const isReviewScope = currentStateValue === "result_review_scope"
  
  const handleAnswer = (answer: "YES" | "NO") => {
    setHistory((prev) => [...prev, { question: description, answer: answer === "YES" ? "Sim" : "Não" }])
    send({ type: answer === "YES" ? "ANSWER_YES" : "ANSWER_NO" })
  }

  const handleReset = () => {
    if (onReset) {
      onReset()
      return
    }
    const storageKey = `legalInstrumentWizard:${wizardId}`
    localStorage.removeItem(storageKey)
    setHistory([])
    send({ type: "RESET" })
    setResetKey((k) => k + 1)

    const url = new URL(window.location.href)
    url.searchParams.delete("state")
    url.searchParams.delete("wizard")
    router.replace(url.pathname + url.search)
  }

  const handleConfirm = () => {
    const partnershipType = STATE_TO_PARTNERSHIP_TYPE[currentStateValue]
    if (partnershipType) {
      onComplete({ type: partnershipType, history })
      const storageKey = `legalInstrumentWizard:${wizardId}`
      localStorage.removeItem(storageKey)
    }
  }

  const handleConsult = () => {
    setIsConsultDialogOpen(true)
  }

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(LEGAL_SUPPORT_WHATSAPP)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error("Erro ao copiar:", err)
    }
  }

  useEffect(() => {
    if (initialState && initialState.history && initialState.history.length > 0) {
      send({ type: "RESET" })
      initialState.history.forEach((h) => {
        send({ type: h.answer === "Sim" ? "ANSWER_YES" : "ANSWER_NO" })
      })
      setHistory(initialState.history)
    }
  }, [])

  useEffect(() => {
    // ensure each wizard flow uses its own storage key
    if (currentStateValue === "check_funding" || history.length === 0) return

    const storageKey = `legalInstrumentWizard:${wizardId}`
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        state: currentStateValue,
        history,
        timestamp: Date.now(),
      })
    )

    const currentUrlState = searchParams.get("state")
    if (currentUrlState !== currentStateValue) {
      const params = new URLSearchParams(searchParams.toString())
      params.set("state", currentStateValue)
      router.replace(`?${params.toString()}`, { scroll: false })
    }
  }, [currentStateValue, history, router, searchParams])

  useEffect(() => {
    // ensure wizard id present in URL so multiple sequential flows don't conflict
    if (!searchParams.get("wizard")) {
      const params = new URLSearchParams(searchParams.toString())
      params.set("wizard", wizardId)
      router.replace(`?${params.toString()}`, { scroll: false })
    }
  }, [router, searchParams, wizardId])

  return (
    <div key={resetKey} className="flex flex-col flex-1 w-full h-full bg-background rounded-xl overflow-hidden border shadow-sm">
      {/* Header / Progress */}
      <div className="px-6 py-4 md:px-10 md:py-6 shrink-0 border-b bg-card/50 backdrop-blur-sm z-10">
        <div className="flex items-center justify-between text-sm font-medium text-muted-foreground mb-3">
          <span className="flex items-center gap-2 text-foreground">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">{isFinal ? <CheckCircle2 className="w-4 h-4" /> : history.length + 1}</span>
            Classificação do Projeto
          </span>
          <span>{isFinal ? "Concluído" : `${Math.min((history.length + 1) * 15, 90)}%`}</span>
        </div>
        <div className="h-1 w-full bg-secondary/50 rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-700 ease-out" style={{ width: isFinal ? "100%" : `${Math.min((history.length + 1) * 15, 90)}%` }} />
        </div>
      </div>
      <div className="flex h-full flex-1">
        {/* Main Content Area (Left) */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 overflow-y-auto">
          {isFinal ? (
            <div className="w-full max-w-2xl space-y-8 text-center animate-in fade-in zoom-in duration-500">
              <div className="space-y-3">
                <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-2 ring-4 ring-primary/5">
                  {isReviewScope ? <AlertCircle className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}  
                </div>
                {!isReviewScope && (
                  <>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Análise Concluída</h2>
                    <p className="text-muted-foreground text-lg leading-relaxed max-w-lg mx-auto">Identificamos o instrumento ideal para o seu projeto.</p>
                  </>
                )}
              </div>

              <div className="bg-card border rounded-xl p-6 md:p-8 shadow-md transform transition-all hover:scale-[1.01] duration-300">
                {!isReviewScope && (
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Instrumento Recomendado</h3>
                )}
                <div className="text-xl md:text-3xl font-bold text-foreground mb-2 text-balance">{description}</div>

                {currentStateValue === "result_review_scope" && (
                  <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 text-left">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">O fluxo atual não encontrou um enquadramento direto. Recomendamos revisar o escopo ou consultar o setor jurídico.</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button variant="outline" onClick={handleReset} className="h-11 px-6 text-sm border hover:bg-muted">
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  {isReviewScope ? "Revisar o Escopo" : "Reiniciar"}
                </Button>
                {isReviewScope ? (
                  <Button onClick={handleConsult} size="lg" className="h-11 px-6 text-sm shadow-md hover:shadow-primary/25 transition-all">
                    Consultar o Setor Jurídico
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={handleConfirm} size="lg" className="h-11 px-6 text-sm shadow-md hover:shadow-primary/25 transition-all">
                    Confirmar e Continuar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 flex flex-col items-center" key={currentStateValue}>
              <div className="min-h-[120px] flex items-center justify-center w-full">
                <h2 className="text-2xl md:text-3xl font-semibold leading-tight text-foreground text-center text-balance max-w-2xl">{description}</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-4 md:gap-6 w-full max-w-lg mx-auto">
                <Button variant="outline" onClick={() => handleAnswer("NO")} className="h-20 md:h-24 text-lg font-medium border-2 hover:border-destructive hover:bg-destructive/5 hover:text-destructive transition-all rounded-xl">
                  Não
                </Button>
                <Button onClick={() => handleAnswer("YES")} className="h-20 md:h-24 text-lg font-medium shadow-md hover:shadow-primary/25 hover:-translate-y-0.5 transition-all rounded-xl">
                  Sim
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar (Right) */}
        <div className="hidden xl:flex w-2/6 flex-col border-l bg-muted/30 min-h-full">
          <div className="p-8 border-b bg-background/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Histórico</h3>
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs text-muted-foreground hover:text-foreground px-2">
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Reiniciar
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground/40 border-2 border-dashed rounded-xl bg-background/50">
                <p className="text-sm font-medium">Suas respostas aparecerão aqui</p>
              </div>
            ) : (
              <div className="space-y-5 relative pl-3">
                <div className="absolute left-[23px] top-3 bottom-3 w-px bg-border" />
                {history.map((item, index) => (
                  <div key={index} className="relative animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                    <div className="flex items-start gap-3">
                      <div className={cn("relative z-10 flex items-center justify-center w-5 h-5 rounded-full border shadow-sm transition-colors bg-background mt-0.5", item.answer === "Sim" ? "border-primary text-primary" : "border-destructive text-destructive")}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", item.answer === "Sim" ? "bg-primary" : "bg-destructive")} />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="p-3 rounded-lg bg-background border shadow-sm hover:shadow-md transition-all">
                          <p className="text-sm text-foreground/80 leading-snug font-medium">{item.question}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider border", item.answer === "Sim" ? "bg-primary/10 text-primary border-primary/20" : "bg-destructive/10 text-destructive border-destructive/20")}>{item.answer}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={isConsultDialogOpen}
        onOpenChange={setIsConsultDialogOpen}
        title={
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            Consultar Setor Jurídico
          </div>
        }
        className="sm:max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setIsConsultDialogOpen(false)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                window.open(WHATSAPP_URL, "_blank")
                setIsConsultDialogOpen(false)
              }}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="w-4 h-4" />
              Abrir WhatsApp
            </Button>
          </div>
        }
      >
        <div className="text-sm text-muted-foreground">Entre em contato com nosso setor jurídico via WhatsApp para tirar suas dúvidas</div>

        <div className="space-y-4 py-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-3">Número de WhatsApp:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-background border rounded px-3 py-2 font-mono text-sm font-semibold">
                {legalSupportWhatsApp}
              </code>
              <Button size="sm" variant="outline" onClick={handleCopyPhone} className="shrink-0">
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Descreva sua situação e deixe que nossos especialistas jurídicos ajudem a encontrar a melhor solução para seu projeto.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
