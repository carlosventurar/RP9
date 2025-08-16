"use client"

import {
  ChevronUp,
  Home,
  Workflow,
  Settings,
  CreditCard,
  BarChart3,
  User2,
  Search,
  Heart,
  Plus,
  LogOut,
} from "lucide-react"
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useNavigationTranslations, useAuthTranslations } from '@/hooks/use-translations'


export function AppSidebar() {
  const navT = useNavigationTranslations()
  const authT = useAuthTranslations()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const handleAccountSettings = () => {
    router.push('/app/settings/account')
  }

  const translatedItems = [
    {
      title: navT('dashboard'),
      url: "/app/dashboard",
      icon: Home,
    },
    {
      title: navT('searchTemplates'),
      url: "/app/search",
      icon: Search,
    },
    {
      title: navT('favorites'),
      url: "/app/favorites",
      icon: Heart,
    },
    {
      title: navT('workflows'),
      url: "/app/workflows",
      icon: Workflow,
    },
    {
      title: navT('flowBuilder'),
      url: "/app/flows/new",
      icon: Plus,
    },
    {
      title: navT('analytics'),
      url: "/app/analytics",
      icon: BarChart3,
    },
    {
      title: navT('billing'),
      url: "/app/billing",
      icon: CreditCard,
    },
    {
      title: navT('settings'),
      url: "/app/settings",
      icon: Settings,
    },
  ]

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/app/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-sidebar-primary-foreground">
                  <span className="text-sm font-bold">IA</span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{authT('title')}</span>
                  <span className="truncate text-xs">{authT('subtitle')}</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{navT('platform')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {translatedItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <User2 />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{authT('demoUser')}</span>
                    <span className="truncate text-xs">admin@agentevirtualia.com</span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem onClick={handleAccountSettings}>
                  <Settings />
                  {navT('accountSettings')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut />
                  {navT('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}