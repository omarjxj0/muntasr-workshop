'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Car, Package, Users, Wallet, Settings,
  LogOut, Menu, X, CalendarDays, UserCheck, MessageSquare, TrendingUp
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface SidebarProps {
  role: UserRole
  appName?: string
  appSubtitle?: string
  logoUrl?: string
}

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { href: '/',                  label: 'لوحة التحكم',      icon: <LayoutDashboard size={20} /> },
  { href: '/customers',         label: 'الزبائن',           icon: <UserCheck size={20} /> },
  { href: '/visits',            label: 'الزيارات',          icon: <Car size={20} /> },
  { href: '/inventory',         label: 'المخزون (ECU)',     icon: <Package size={20} /> },
  { href: '/marketing',         label: 'التسويق الإلكتروني', icon: <MessageSquare size={20} />, adminOnly: true },
  { href: '/employees',         label: 'الموظفون',          icon: <Users size={20} />,       adminOnly: true },
  { href: '/employees/wages',   label: 'الرواتب اليومية',  icon: <CalendarDays size={20} />, adminOnly: true },
  { href: '/finances',          label: 'الصندوق',           icon: <Wallet size={20} />,      adminOnly: true },
  { href: '/expenses',          label: 'المصروفات',         icon: <TrendingUp size={20} className="rotate-180" />, adminOnly: true },
  { href: '/settings',          label: 'الإعدادات',         icon: <Settings size={20} />,    adminOnly: true },
]

export default function Sidebar({ role, appName, appSubtitle, logoUrl }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const supabase = createClient()

  const displayName     = appName     || 'ورشة منتصر'
  const displaySubtitle = appSubtitle || 'كهرباء السيارات'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('تم تسجيل الخروج')
    router.push('/login')
  }

  const visibleItems = navItems.filter(item => !item.adminOnly || role === 'admin')

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex flex-col h-full py-5 px-3">
      {/* Logo / Branding */}
      <div className="px-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center shrink-0">
            <Image
              src={logoUrl || '/logo.png'}
              alt={displayName}
              width={48}
              height={48}
              className="w-full h-full object-contain"
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight text-white">
              {displayName}
            </h1>
            <p className="text-xs text-white/60">{displaySubtitle}</p>
          </div>
        </div>
      </div>

      {/* Role badge */}
      <div className="px-3 mb-4">
        <span className={cn(
          'inline-flex items-center text-xs px-3 py-1 rounded-full font-semibold',
          role === 'admin'
            ? 'bg-white/20 text-white'
            : 'bg-white/10 text-white/70'
        )}>
          {role === 'admin' ? '👑 مدير' : '🔧 فني'}
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto space-y-1">
        {visibleItems.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onClose?.()}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'sidebar-link-active'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="pt-4 mt-2 border-t border-white/15">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <LogOut size={20} />
          تسجيل الخروج
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar — fixed floating pill on the RIGHT (RTL) */}
      <aside
        className="hidden md:flex flex-col fixed right-4 top-4 bottom-4 w-60 shrink-0 z-30 overflow-hidden"
        style={{
          background: 'linear-gradient(175deg, #7c3aed 0%, #6d28d9 60%, #5b21b6 100%)',
          borderRadius: '28px',
          boxShadow: '0 20px 60px rgba(109,40,217,0.4), 0 4px 16px rgba(109,40,217,0.25)',
        }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile toggle button */}
      <div className="md:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2.5 rounded-2xl shadow-lg text-white"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            boxShadow: '0 4px 15px rgba(109,40,217,0.4)',
          }}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex justify-end">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside
            className="relative flex flex-col w-64 h-screen z-50 m-3"
            style={{
              background: 'linear-gradient(175deg, #7c3aed 0%, #6d28d9 60%, #5b21b6 100%)',
              borderRadius: '24px',
              boxShadow: '0 20px 60px rgba(109,40,217,0.4)',
            }}
          >
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
