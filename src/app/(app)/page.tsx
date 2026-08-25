import { createClient } from '@/lib/supabase/server'
import PhoneSearch from '@/components/PhoneSearch'
import { Car, Package, Users, TrendingUp, Zap } from 'lucide-react'
import Link from 'next/link'
import type { Profile } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user!.id).single<Profile>()

  // Summary stats
  const [
    { count: totalCustomers },
    { count: totalVisits },
    { count: activeVisits },
    { count: totalEcus },
  ] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('visits').select('*', { count: 'exact', head: true }),
    supabase.from('visits').select('*', { count: 'exact', head: true }).in('status', ['Pending', 'In Progress']),
    supabase.from('ecus').select('*', { count: 'exact', head: true }),
  ])

  const stats = [
    { label: 'إجمالي العملاء', value: totalCustomers ?? 0, icon: <Users size={22} />, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
    { label: 'إجمالي الزيارات', value: totalVisits ?? 0, icon: <Car size={22} />, color: 'text-violet-400', bg: 'bg-violet-400/10 border-violet-400/20' },
    { label: 'زيارات نشطة', value: activeVisits ?? 0, icon: <TrendingUp size={22} />, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
    { label: 'أصناف المخزون', value: totalEcus ?? 0, icon: <Package size={22} />, color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  ]

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-10">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-600/30">
            <Zap size={30} className="text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-bold gradient-text">ورشة منتصر</h1>
        <p className="text-slate-400">نظام إدارة الصيانة الكهربائية</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <div
            key={stat.label}
            className={`glass-card p-5 flex flex-col gap-3 border ${stat.bg}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-100">{stat.value.toLocaleString('ar')}</p>
              <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tbla Search */}
      <div className="glass-card p-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-slate-100">البحث عن عميل — الطابلة</h2>
          <p className="text-slate-400 text-sm">أدخل رقم هاتف العميل للوصول إلى سجله الكامل وفتح زيارة جديدة</p>
        </div>
        <PhoneSearch />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { href: '/visits',    label: 'كل الزيارات',   icon: <Car size={20} />,    color: 'hover:border-blue-500/50' },
          { href: '/inventory', label: 'المخزون',        icon: <Package size={20} />, color: 'hover:border-violet-500/50' },
          ...(profile?.role === 'admin' ? [
            { href: '/employees',       label: 'الموظفون',   icon: <Users size={20} />,    color: 'hover:border-amber-500/50' },
            { href: '/finances',        label: 'الصندوق',    icon: <TrendingUp size={20} />, color: 'hover:border-emerald-500/50' },
          ] : []),
        ].map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`glass-card p-5 flex flex-col items-center gap-3 text-slate-400 hover:text-slate-200 border border-transparent ${link.color} transition-all duration-200 text-center`}
          >
            {link.icon}
            <span className="text-sm font-medium">{link.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
