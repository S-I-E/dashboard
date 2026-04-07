"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Project } from "@prisma/client"
import { Check, FileText, Scale, Clock } from "lucide-react"
import { createProject } from "@/actions/projects"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import TextareaWithCounter from "@/components/ui/textarea-with-counter"
import { notify } from "@/lib/notifications"

const projectFormSchema = z.object({
  titulo: z.string().min(3, "O título deve ter pelo menos 3 caracteres").max(200, "O título deve ter no máximo 200 caracteres"),
  objetivos: z.string().min(10, "Descreva os objetivos com mais detalhes (mínimo 10 caracteres)"),
  justificativa: z.string().min(10, "A justificativa deve ser mais detalhada (mínimo 10 caracteres)"),
  abrangencia: z.string().min(5, "Defina a abrangência (mínimo 5 caracteres)"),
})

type ProjectFormValues = z.infer<typeof projectFormSchema>

interface ProjectFormProps {
  initialProject?: Project | null
  embedded?: boolean
}

export function ProjectForm({ initialProject, embedded = false }: ProjectFormProps) {
  const router = useRouter()
  const [step, setStep] = useState<"create" | "choisen" | "loading">(initialProject ? "choisen" : "create")
  const [project, setProject] = useState<Project | null>(initialProject || null)

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      titulo: "",
      objetivos: "",
      justificativa: "",
      abrangencia: "",
    },
  })

  const onSubmit = async (data: ProjectFormValues) => {
    setStep("loading")
    try {
      const formData = new FormData()
      formData.append("titulo", data.titulo)
      formData.append("objetivos", data.objetivos)
      formData.append("justificativa", data.justificativa)
      formData.append("abrangencia", data.abrangencia)

      const p = await createProject(formData)

      setProject(p)
      setStep("choisen")
      router.replace(`/projetos/novo?slug=${p.slug}`)
    } catch (error) {
      console.error(error)
      notify.error("Erro ao criar projeto")
      setStep("create")
    }
  }

  if (step === "choisen") {
    if (embedded) {
      return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center pb-6">
            <div className="mx-auto bg-green-100 dark:bg-green-900/30 p-3 rounded-full w-fit mb-3 ring-4 ring-green-50 dark:ring-green-900/8">
              <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-2xl font-semibold">Projeto criado com sucesso!</h3>
            <p className="text-sm text-muted-foreground mt-2">
              O projeto <span className="font-medium text-foreground">"{project?.title}"</span> foi iniciado. Como você deseja prosseguir?
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mt-6">
            <Link href={`/projetos/${project?.slug}/work-plan?next=legal-instrument`} className="group">
              <div className="h-full border rounded-lg p-6 hover:border-primary/50 hover:shadow transition-all duration-200 cursor-pointer bg-card">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="p-3 rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-base group-hover:text-primary">Inserir Plano de Trabalho</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed px-1">Defina a estrutura, mercado e viabilidade do seu projeto.</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href={`/projetos/${project?.slug}/legal-instrument?next=work-plan`} className="group">
              <div className="h-full border rounded-lg p-6 hover:border-primary/50 hover:shadow transition-all duration-200 cursor-pointer bg-card">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="p-3 rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                    <Scale className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-base group-hover:text-primary">Inserir Instrumento Jurídico</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed px-1">Anexe contratos, termos e documentos legais necessários.</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href={`/projetos/${project?.slug}`} className="group">
              <div className="h-full border rounded-lg p-6 hover:border-muted-foreground/50 hover:shadow transition-all duration-200 cursor-pointer bg-muted/10">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="p-3 rounded-xl bg-muted text-muted-foreground transition-colors duration-200">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-base">Inserir dependências mais tarde</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed px-1">Finalizar por agora e retornar à listagem de projetos.</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      )
    }

    return (
      <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="text-center pb-8">
            <div className="mx-auto bg-green-100 dark:bg-green-900/30 p-4 rounded-full w-fit mb-4 ring-8 ring-green-50 dark:ring-green-900/10">
              <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-3xl font-bold">Projeto criado com sucesso!</CardTitle>
            <CardDescription className="text-lg mt-2">
              O projeto <span className="font-medium text-foreground">"{project?.title}"</span> foi iniciado.
              <br />
              Como você deseja prosseguir?
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3">
            <Link href={`/projetos/${project?.slug}/work-plan?next=legal-instrument`} className="group">
              <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all duration-300 cursor-pointer border-muted">
                <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
                  <div className="p-4 rounded-2xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">Inserir Plano de Trabalho</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed px-2">Defina a estrutura, mercado e viabilidade do seu projeto.</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/projetos/${project?.slug}/legal-instrument?next=work-plan`} className="group">
              <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all duration-300 cursor-pointer border-muted">
                <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
                  <div className="p-4 rounded-2xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                    <Scale className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">Inserir Instrumento Jurídico</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed px-2">Anexe contratos, termos e documentos legais necessários.</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/projetos/${project?.slug}`} className="group">
              <Card className="h-full hover:border-muted-foreground/50 hover:shadow-md transition-all duration-300 cursor-pointer border-muted bg-muted/30">
                <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
                  <div className="p-4 rounded-2xl bg-muted text-muted-foreground group-hover:bg-muted-foreground group-hover:text-background transition-colors duration-300">
                    <Clock className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg group-hover:text-foreground transition-colors">Inserir dependências mais tarde</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed px-2">Finalizar por agora e retornar à listagem de projetos.</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formInner = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="titulo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Ex.: Plataforma de Inovação SIE/UFR" maxLength={200} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="objetivos"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Objetivos</FormLabel>
              <FormControl>
                <TextareaWithCounter placeholder="Descreva os objetivos do projeto..." rows={6} minLength={10} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="justificativa"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Justificativa</FormLabel>
              <FormControl>
                <TextareaWithCounter placeholder="Explique a relevância pública/acadêmica, demanda atendida, etc." rows={6} minLength={10} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="abrangencia"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Abrangência</FormLabel>
              <FormControl>
                <TextareaWithCounter placeholder="Defina localidades, público-alvo e alcance..." rows={5} minLength={5} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" asChild type="button">
            <Link href="/projetos/">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={step === "loading"}>
            {step === "loading" ? "Salvando..." : "Salvar projeto"}
          </Button>
        </div>
      </form>
    </Form>
  )

  if (embedded) return formInner

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Novo Projeto</CardTitle>
          <CardDescription>Preencha os dados do seu projeto (Plano de Trabalho ficará para depois).</CardDescription>
        </CardHeader>
        <CardContent>{formInner}</CardContent>
      </Card>
    </div>
  )
}
