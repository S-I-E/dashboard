"use client"

import * as React from "react"
import { Frame, LifeBuoy, Send, Settings2, SquareTerminal, CheckCircle2 } from "lucide-react"

import { NavMain } from "@/components/navs/main"
import { NavProjects } from "@/components/navs/projects"
import { NavSecondary } from "@/components/navs/secondary"
import { NavUser } from "@/components/navs/user"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/providers/sidebar"
import { type NavItem } from "@/lib/services/nav-items"

import { Logo } from "./logo"
import Link from "next/link"
import { useSession } from "next-auth/react"

const data: Record<string, NavItem[]> = {
  navMain: [
    // {
    //   title: "Dashboard",
    //   url: "/dashboard",
    //   icon: SquareTerminal,
    // },
    {
      title: "Gerenciamento",
      icon: Settings2,
      items: [
        {
          title: "Instrumentos Jurídicos",
          url: "/admin/legal-instruments",
          permissionSlug: "legal_instruments.manage",
        },
      ],
    },
    {
      title: "Meus Projetos",
      url: "/projetos",
      icon: Frame,
      transforms: [
        {
          permission: "projects.view.all",
          changes: { title: "Projetos", url: "/projetos", icon: CheckCircle2 },
        },
        {
          permission: "projects.approve",
          changes: { url: "/admin/projetos", icon: CheckCircle2 },
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Suporte",
      url: "/conta/suporte",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "/conta/feedback",
      icon: Send,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session, status } = useSession()

  const user = {
    name: session?.user?.name || "Usuário",
    email: session?.user?.email || "usuario@ufr.edu.br",
    avatar: session?.user?.image || "",
    color: session?.user?.color || "bg-sidebar-primary",
  }

  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/projetos">
                <Logo />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {/* <NavProjects items={data.navProjects} /> */}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} isLoading={status === "loading"} />
      </SidebarFooter>
    </Sidebar>
  )
}
