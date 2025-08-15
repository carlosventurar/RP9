import { Metadata } from 'next'
import { AdminSidebar } from '@/components/admin-sidebar'

export const metadata: Metadata = {
  title: 'Admin Dashboard - Agente Virtual IA',
  description: 'Administrative dashboard for template marketplace management',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  )
}