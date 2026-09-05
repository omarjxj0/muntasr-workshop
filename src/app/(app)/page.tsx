import { createClient } from '@/lib/supabase/server'
import PhoneSearch from '@/components/PhoneSearch'
import { Car, Package, Users, TrendingUp, AlertTriangle, CheckCircle2, ArrowLeft, Wallet } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import type { Profile } from '@/lib/types'
import DashboardAnalytics from './DashboardAnalytics'

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

  // Analytics Data
  const [
    { data: incomeTransactions },
    { data: wages },
    { data: expensesData },
    { data: visitsWithVehicles }
  ] = await Promise.all([
    supabase.from('transactions').select('amount').eq('type', 'Income'),
    supabase.from('daily_wages').select('amount'),
    supabase.from('expenses').select('amount'),
    supabase.from('visits').select('id, vehicles(make_and_model)')
  ])

  const totalIncome = (incomeTransactions || []).reduce((sum, t) => sum + Number(t.amount), 0)
  const totalWages = (wages || []).reduce((sum, w) => sum + Number(w.amount), 0)
  const totalExpenses = (expensesData || []).reduce((sum, e) => sum + Number(e.amount), 0)
  const netProfit = totalIncome - totalWages - totalExpenses

  // Top vehicles
  const vehicleCounts: Record<string, number> = {}
  visitsWithVehicles?.forEach((v: any) => {
    const make = v.vehicles?.make_and_model
    if (make) {
      vehicleCounts[make] = (vehicleCounts[make] || 0) + 1
    }
  })
  const topVehicleMakes = Object.entries(vehicleCounts)
    .map(([name, count]) => ({ name, count: count as number }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Low stock items
  let { data: allEcus, error: allEcusError } = await supabase
    .from('ecus')
    .select('id, name, barcode, symbols_codes, stock_quantity, min_quantity, ecu_companies(name), ecu_categories(name)')
    .order('stock_quantity', { ascending: true })

  if (allEcusError) {
    console.warn("Dashboard Fetch Error (with joins), falling back:", allEcusError)
    const fallback = await supabase
      .from('ecus')
      .select('id, name, barcode, symbols_codes, stock_quantity, min_quantity')
      .order('stock_quantity', { ascending: true })
    allEcus = fallback.data as any
  }

  const lowStockItems = (allEcus ?? []).filter(
    (item: any) => (item.stock_quantity ?? 0) <= (item.min_quantity ?? 3)
  )

  const stats = [
    {
      label: 'إجمالي العملاء',
      value: totalCustomers ?? 0,
      icon: <Users size={22} />,
      gradient: 'from-violet-500 to-purple-600',
      shadow: 'rgba(124,58,237,0.3)',
      bg: 'bg-violet-50',
      text: 'text-violet-600',
    },
    {
      label: 'إجمالي الزيارات',
      value: totalVisits ?? 0,
      icon: <Car size={22} />,
      gradient: 'from-pink-500 to-rose-500',
      shadow: 'rgba(236,72,153,0.3)',
      bg: 'bg-pink-50',
      text: 'text-pink-600',
    },
    {
      label: 'زيارات نشطة',
      value: activeVisits ?? 0,
      icon: <TrendingUp size={22} />,
      gradient: 'from-amber-400 to-orange-500',
      shadow: 'rgba(245,158,11,0.3)',
      bg: 'bg-amber-50',
      text: 'text-amber-600',
    },
    {
      label: 'صافي الربح (د.ع)',
      value: netProfit,
      icon: <Wallet size={22} />,
      gradient: 'from-blue-500 to-indigo-600',
      shadow: 'rgba(59,130,246,0.3)',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
    },
    {
      label: 'أصناف المخزون',
      value: totalEcus ?? 0,
      icon: <Package size={22} />,
      gradient: 'from-emerald-500 to-teal-500',
      shadow: 'rgba(16,185,129,0.3)',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
    },
  ]

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-10">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div
            className="w-24 h-24 rounded-3xl overflow-hidden flex items-center justify-center"
            style={{
              background: '#ffffff',
              boxShadow: '0 8px 25px rgba(124,58,237,0.3)',
            }}
          >
            <Image
              src="/logo.jpg"
              alt="ورشة منتصر"
              width={96}
              height={96}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
        </div>
        <h1 className="text-4xl font-bold gradient-text">ورشة منتصر</h1>
        <p className="text-slate-500">نظام إدارة الصيانة الكهربائية</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="soft-card p-5 flex flex-col gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0"
              style={{
                background: `linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))`,
                boxShadow: `0 4px 14px ${stat.shadow}`,
              }}
            >
              {/* Use a colored wrapper since gradient classes need full class name */}
              <span className={`${stat.bg} ${stat.text} w-11 h-11 rounded-2xl flex items-center justify-center`}>
                {stat.icon}
              </span>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stat.value.toLocaleString('ar')}</p>
              <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Module */}
      {profile?.role === 'admin' && (
        <DashboardAnalytics 
          income={totalIncome}
          wages={totalWages}
          expenses={totalExpenses}
          topVehicleMakes={topVehicleMakes}
        />
      )}

      {/* Tbla Search */}
      <div className="soft-card p-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-slate-800">البحث عن عميل — الطابلة</h2>
          <p className="text-slate-500 text-sm">أدخل رقم هاتف العميل للوصول إلى سجله الكامل وفتح زيارة جديدة</p>
        </div>
        <PhoneSearch />
      </div>

      {/* Low Stock Alerts */}
      <div className="soft-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              lowStockItems.length > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {lowStockItems.length > 0 ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                نواقص المخزون
                {lowStockItems.length > 0 && (
                  <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full font-bold">
                    {lowStockItems.length} صنف
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">تنبيهات الأصناف التي وصلت للحد الأدنى أو نفدت</p>
            </div>
          </div>
          <Link
            href="/inventory"
            className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1 transition-colors"
          >
            إدارة المخزون
            <ArrowLeft size={14} />
          </Link>
        </div>

        {lowStockItems.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-center bg-emerald-50/50 rounded-2xl border border-emerald-100/60 p-4">
            <CheckCircle2 size={28} className="text-emerald-500 mb-1" />
            <p className="font-bold text-emerald-800 text-sm">المخزون متوفر بالكامل</p>
            <p className="text-xs text-emerald-600/80 mt-0.5">جميع الأصناف أعلى من الحد الأدنى المحدد</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockItems.slice(0, 6).map((item: any) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center justify-between gap-3 hover:border-violet-200 transition-all"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{item.name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {(item.ecu_companies as any)?.name ?? '—'} · {(item.ecu_categories as any)?.name ?? '—'}
                  </p>
                </div>
                <div className="flex flex-col items-end shrink-0 gap-1">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    item.stock_quantity === 0
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {item.stock_quantity === 0 ? 'نفد (0)' : `متبقي ${item.stock_quantity}`}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    الحد: {item.min_quantity ?? 3}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { href: '/visits',    label: 'كل الزيارات',   icon: <Car size={20} />,    color: 'text-violet-600', bg: 'bg-violet-50 hover:bg-violet-100', border: 'border-violet-100 hover:border-violet-200' },
          { href: '/inventory', label: 'المخزون',        icon: <Package size={20} />, color: 'text-pink-600',    bg: 'bg-pink-50 hover:bg-pink-100',     border: 'border-pink-100 hover:border-pink-200' },
          ...(profile?.role === 'admin' ? [
            { href: '/employees', label: 'الموظفون',   icon: <Users size={20} />,      color: 'text-amber-600',   bg: 'bg-amber-50 hover:bg-amber-100',   border: 'border-amber-100 hover:border-amber-200' },
            { href: '/finances',  label: 'الصندوق',    icon: <TrendingUp size={20} />, color: 'text-emerald-600', bg: 'bg-emerald-50 hover:bg-emerald-100', border: 'border-emerald-100 hover:border-emerald-200' },
          ] : []),
        ].map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`soft-card p-5 flex flex-col items-center gap-3 border-2 ${link.bg} ${link.border} ${link.color} transition-all duration-200 text-center`}
          >
            {link.icon}
            <span className="text-sm font-semibold">{link.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
