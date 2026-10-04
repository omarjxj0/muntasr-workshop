import { createClient } from '@/lib/supabase/server'
import PhoneSearch from '@/components/PhoneSearch'
import { Car, Package, Users, TrendingUp, Wallet, DollarSign, ArrowUpRight, Flame, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import type { Profile } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import DashboardAnalytics from './DashboardAnalytics'
import DashboardLowStock from './DashboardLowStock'

// Baghdad Timezone (UTC+3) Date Helper
function getBaghdadDateKey(dateStr: string | null | undefined): { dayKey: string; monthKey: string } {
  if (!dateStr) return { dayKey: '', monthKey: '' }
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return { dayKey: '', monthKey: '' }
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d).split('-')
    return {
      dayKey: `${parts[0]}-${parts[1]}-${parts[2]}`,
      monthKey: `${parts[0]}-${parts[1]}`,
    }
  } catch {
    return { dayKey: '', monthKey: '' }
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user!.id).single<Profile>()

  // Summary counts
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

  // Financial & Operational Data Queries
  const [
    { data: visitsData },
    { data: inspectionData },
    { data: expensesData },
    { data: wagesData },
    { data: visitsWithVehicles },
  ] = await Promise.all([
    supabase.from('visits').select('id, status, labor_cost, total_amount, entry_date'),
    supabase.from('quick_inspections').select('id, inspection_fee, created_at'),
    supabase.from('expenses').select('id, amount, created_at'),
    supabase.from('daily_wages').select('id, amount, date'),
    supabase.from('visits').select('id, vehicles(make_and_model)'),
  ])

  // Get current Baghdad date keys for Today and This Month
  const nowBaghdadParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()).split('-')
  const todayKey = `${nowBaghdadParts[0]}-${nowBaghdadParts[1]}-${nowBaghdadParts[2]}`
  const currentMonthKey = `${nowBaghdadParts[0]}-${nowBaghdadParts[1]}`

  // 1. Completed Visits Revenue (status IN ('Completed', 'Delivered'))
  let todayVisitsRev = 0
  let monthVisitsRev = 0
  let allVisitsRev = 0

  for (const v of visitsData || []) {
    if (v.status === 'Completed' || v.status === 'Delivered') {
      const rev = (Number(v.labor_cost) || 0) + (Number(v.total_amount) || 0)
      const { dayKey, monthKey } = getBaghdadDateKey(v.entry_date)
      if (dayKey === todayKey) todayVisitsRev += rev
      if (monthKey === currentMonthKey) monthVisitsRev += rev
      allVisitsRev += rev
    }
  }

  // 2. Quick Inspection Fees
  let todayInspectionsRev = 0
  let monthInspectionsRev = 0
  let allInspectionsRev = 0

  for (const qi of inspectionData || []) {
    const fee = Number(qi.inspection_fee) || 0
    const { dayKey, monthKey } = getBaghdadDateKey(qi.created_at)
    if (dayKey === todayKey) todayInspectionsRev += fee
    if (monthKey === currentMonthKey) monthInspectionsRev += fee
    allInspectionsRev += fee
  }

  // 3. Operational Expenses
  let todayExpenses = 0
  let monthExpenses = 0
  let allExpenses = 0

  for (const e of expensesData || []) {
    const exp = Number(e.amount) || 0
    const { dayKey, monthKey } = getBaghdadDateKey(e.created_at)
    if (dayKey === todayKey) todayExpenses += exp
    if (monthKey === currentMonthKey) monthExpenses += exp
    allExpenses += exp
  }

  // 4. Daily Wages
  let todayWages = 0
  let monthWages = 0
  let allWages = 0

  for (const w of wagesData || []) {
    const wage = Number(w.amount) || 0
    const { dayKey, monthKey } = getBaghdadDateKey(w.date)
    if (dayKey === todayKey) todayWages += wage
    if (monthKey === currentMonthKey) monthWages += wage
    allWages += wage
  }

  // Financial Breakdown Calculations: (Completed Visits Revenue + Quick Inspection Fees) - (Expenses + Wages)
  const todayNet = (todayVisitsRev + todayInspectionsRev) - (todayExpenses + todayWages)
  const monthNet = (monthVisitsRev + monthInspectionsRev) - (monthExpenses + monthWages)
  const allTimeNet = (allVisitsRev + allInspectionsRev) - (allExpenses + allWages)

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

  // Inventory fetch for Grouped Low Stock
  let { data: allEcus, error: allEcusError } = await supabase
    .from('ecus')
    .select('id, name, barcode, symbols_codes, stock_quantity, min_quantity, manufacturer, ecu_family, vehicle_model_code, software_id')
    .order('stock_quantity', { ascending: true })

  if (allEcusError) {
    console.warn("Dashboard Fetch Error:", allEcusError)
    const fallback = await supabase
      .from('ecus')
      .select('id, name, barcode, symbols_codes, stock_quantity, min_quantity')
      .order('stock_quantity', { ascending: true })
    allEcus = fallback.data as any
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-10">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="w-24 h-24 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="ورشة منتصر"
              width={96}
              height={96}
              className="w-full h-full object-contain"
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
        </div>
        <h1 className="text-4xl font-bold gradient-text">ورشة منتصر</h1>
        <p className="text-slate-500">نظام إدارة الصيانة والبرمجة الإلكترونية</p>
      </div>

      {/* Daily Shift Work Prominent Banner */}
      <Link
        href="/daily-shift"
        className="soft-card p-5 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-2 border-amber-300 hover:border-amber-400 bg-gradient-to-r from-amber-50/90 via-white to-amber-50/50 hover:shadow-lg transition-all group block"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0 group-hover:scale-105 transition-transform">
            <Flame size={26} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-lg text-slate-800 group-hover:text-amber-700 transition-colors">
                شغل اليوم · سجل العمل وتوزيع الفنيين
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                مباشر الشفت
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              متابعة إنجازات الفنيين المباشرة، فحص السيارات والعقول، وحسابات دخل الشفت لليوم.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0 text-amber-800 font-bold text-sm bg-amber-100/90 px-4 py-2 rounded-xl group-hover:bg-amber-500 group-hover:text-white transition-all">
          <span>فتح سجل شغل اليوم</span>
          <ArrowLeft size={16} />
        </div>
      </Link>

      {/* Financial Breakdown Cards (Daily, Monthly, All-Time) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Wallet size={22} className="text-violet-500" />
            المؤشرات المالية (الصافي)
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            أجور الزيارات المكتملة + رسوم الفحوصات - المصروفات
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* دخل اليوم */}
          <div className="soft-card p-6 relative overflow-hidden flex flex-col justify-between border-2 border-emerald-100 hover:border-emerald-300 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                <DollarSign size={24} />
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                اليوم
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold mb-1">دخل اليوم (الصافي)</p>
              <p className={`text-2xl lg:text-3xl font-bold tracking-tight ${todayNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(todayNet)}
              </p>
              <p className="text-[11px] text-slate-400 mt-2 truncate">
                إيرادات: {formatCurrency(todayVisitsRev + todayInspectionsRev)} · مصاريف: {formatCurrency(todayExpenses + todayWages)}
              </p>
              <Link
                href="/daily-shift"
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline pt-2 border-t border-emerald-100 w-full"
              >
                <span>عرض شغل اليوم بالتفصيل</span>
                <ArrowLeft size={13} />
              </Link>
            </div>
          </div>

          {/* دخل الشهر الحالي */}
          <div className="soft-card p-6 relative overflow-hidden flex flex-col justify-between border-2 border-violet-100 hover:border-violet-300 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-600/20">
                <TrendingUp size={24} />
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                الشهر الحالي
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold mb-1">دخل الشهر الحالي (الصافي)</p>
              <p className={`text-2xl lg:text-3xl font-bold tracking-tight ${monthNet >= 0 ? 'text-violet-600' : 'text-rose-600'}`}>
                {formatCurrency(monthNet)}
              </p>
              <p className="text-[11px] text-slate-400 mt-2 truncate">
                إيرادات: {formatCurrency(monthVisitsRev + monthInspectionsRev)} · مصاريف: {formatCurrency(monthExpenses + monthWages)}
              </p>
            </div>
          </div>

          {/* الإجمالي الكلي */}
          <div className="soft-card p-6 relative overflow-hidden flex flex-col justify-between border-2 border-blue-100 hover:border-blue-300 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
                <ArrowUpRight size={24} />
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                تراكمي
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold mb-1">الإجمالي الكلي (صافي الربح)</p>
              <p className={`text-2xl lg:text-3xl font-bold tracking-tight ${allTimeNet >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                {formatCurrency(allTimeNet)}
              </p>
              <p className="text-[11px] text-slate-400 mt-2 truncate">
                إجمالي إيرادات الورشة مخصوماً منها المصروفات
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="soft-card p-5 flex flex-col gap-2">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{(activeVisits ?? 0).toLocaleString('ar')}</p>
            <p className="text-xs text-slate-500 mt-0.5">زيارات نشطة قيد العمل</p>
          </div>
        </div>

        <div className="soft-card p-5 flex flex-col gap-2">
          <div className="w-10 h-10 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center">
            <Car size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{(totalVisits ?? 0).toLocaleString('ar')}</p>
            <p className="text-xs text-slate-500 mt-0.5">إجمالي كل الزيارات</p>
          </div>
        </div>

        <div className="soft-card p-5 flex flex-col gap-2">
          <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <Users size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{(totalCustomers ?? 0).toLocaleString('ar')}</p>
            <p className="text-xs text-slate-500 mt-0.5">إجمالي الزبائن المسجلين</p>
          </div>
        </div>

        <div className="soft-card p-5 flex flex-col gap-2">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Package size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{(totalEcus ?? 0).toLocaleString('ar')}</p>
            <p className="text-xs text-slate-500 mt-0.5">أصناف المخزون المتوفرة</p>
          </div>
        </div>
      </div>

      {/* Analytics Module */}
      {profile?.role === 'admin' && (
        <DashboardAnalytics 
          income={allVisitsRev + allInspectionsRev}
          wages={allWages}
          expenses={allExpenses}
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

      {/* Low Stock Alerts (Grouped Main Types View) */}
      <DashboardLowStock allEcus={allEcus ?? []} />

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
