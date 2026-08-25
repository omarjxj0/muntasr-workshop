'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Car, Package, Users, Wallet, Settings,
  LogOut, Menu, X, Zap, DollarSign, CalendarDays,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface SidebarProps {
  role: UserRole
}

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { href: '/',              label: 'لوحة التحكم',   icon: <LayoutDashboard size={20} /> },
  { href: '/visits',        label: 'الزيارات',       icon: <Car size={20} /> },
  { href: '/inventory',     label: 'المخزون (ECU)',  icon: <Package size={20} /> },
  { href: '/employees',     label: 'الموظفون',       icon: <Users size={20} />,       adminOnly: true },
  { href: '/employees/wages', label: 'الرواتب اليومية', icon: <CalendarDays size={20} />, adminOnly: true },
  { href: '/finances',      label: 'الصندوق',        icon: <Wallet size={20} />,      adminOnly: true },
  { href: '/settings',      label: 'الإعدادات',      icon: <Settings size={20} />,    adminOnly: true },
]

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('تم تسجيل الخروج')
    router.push('/login')
  }

  const visibleItems = navItems.filter(item => !item.adminOnly || role === 'admin')

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-slate-100">ورشة منتصر</h1>
            <p className="text-xs text-slate-400">كهرباء السيارات</p>
          </div>
        </div>
      </div>

      {/* Role badge */}
      <div className="px-4 py-3">
        <span className={cn(
          'text-xs px-3 py-1 rounded-full font-medium',
          role === 'admin'
            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            : 'bg-slate-700/50 text-slate-300 border border-slate-600'
        )}>
          {role === 'admin' ? '👑 مدير' : '🔧 فني'}
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {visibleItems.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'sidebar-link-active'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
        >
          <LogOut size={20} />
          تسجيل الخروج
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 h-screen bg-slate-900/80 border-l border-slate-800 sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile toggle */}
      <div className="md:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-72 h-full bg-slate-900 border-l border-slate-800 z-50">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
