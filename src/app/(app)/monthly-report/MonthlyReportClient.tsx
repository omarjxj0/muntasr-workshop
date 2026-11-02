'use client'

import { useState, useMemo } from 'react'
import {
  ChevronRight, ChevronLeft, Printer, FileBarChart2,
  TrendingUp, TrendingDown, DollarSign, Users, Car, Cpu, ShoppingBag,
  BarChart3, Wrench, Stethoscope
} from 'lucide-react'
import { formatCurrency, getBaghdadDateKey } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────
interface VisitRow {
  id: string
  total_amount: number
  labor_cost?: number
  technician_name?: string | null
  delivered_at?: string | null
  status: string
  vehicles?: { make_and_model: string } | null
}
interface InspectionRow {
  id: string
  inspection_fee?: number
  cost?: number
  technician_name?: string | null
  created_at: string
  subject?: string | null
  car_info?: string | null
}
interface SaleRow {
  id: string
  selling_price: number
  technician_name?: string | null
  created_at: string
  item_name: string
  item_type?: string | null
  ecu_id?: string | null
}
interface ExpenseRow {
  id: string
  amount: number
  category: string
  description: string
  created_at: string
}

interface Props {
  visits: VisitRow[]
  inspections: InspectionRow[]
  sales: SaleRow[]
  expenses: ExpenseRow[]
}

// ─── Baghdad month helpers ────────────────────────────────────
function getBaghdadMonthKey(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const { monthKey } = getBaghdadDateKey(dateStr)
  return monthKey
}

function monthLabel(year: number, month: number): string {
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long' })
}

function getCurrentBaghdadYearMonth(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date()).split('-')
  return { year: Number(parts[0]), month: Number(parts[1]) }
}

// ─── Wage-like expense categories ────────────────────────────
const WAGE_CATEGORIES = ['سلفة / أجور', 'أجور عمال', 'أجور', 'يوميات']

function isWageExpense(category: string): boolean {
  return WAGE_CATEGORIES.some(c => category?.includes(c.split('/')[0].trim()) || category === c)
}

// ─── Card component ───────────────────────────────────────────
function SummaryCard({
  label, value, icon, color, sub,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
  sub?: string
}) {
  return (
    <div className={`rounded-2xl p-5 border ${color} print:p-3 print:rounded-lg`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold opacity-70 mb-1">{label}</p>
          <p className="text-xl font-extrabold font-mono leading-tight">{value}</p>
          {sub && <p className="text-[11px] opacity-60 mt-0.5">{sub}</p>}
        </div>
        <div className="opacity-60 shrink-0">{icon}</div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────
export default function MonthlyReportClient({ visits, inspections, sales, expenses }: Props) {
  const { year: todayYear, month: todayMonth } = getCurrentBaghdadYearMonth()
  const [year, setYear] = useState(todayYear)
  const [month, setMonth] = useState(todayMonth)

  const selectedKey = `${year}-${String(month).padStart(2, '0')}`

  // ── Navigation ─────────────────────────────────────────────
  const goBack = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const goForward = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  // ── Filter data by selected month ──────────────────────────
  const mVisits = useMemo(() =>
    visits.filter(v => getBaghdadMonthKey(v.delivered_at) === selectedKey),
    [visits, selectedKey]
  )
  const mInspections = useMemo(() =>
    inspections.filter(i => getBaghdadMonthKey(i.created_at) === selectedKey),
    [inspections, selectedKey]
  )
  const mSales = useMemo(() =>
    sales.filter(s => getBaghdadMonthKey(s.created_at) === selectedKey),
    [sales, selectedKey]
  )
  const mExpenses = useMemo(() =>
    expenses.filter(e => getBaghdadMonthKey(e.created_at) === selectedKey),
    [expenses, selectedKey]
  )

  // ── Financial Totals ───────────────────────────────────────
  const totals = useMemo(() => {
    const visitRevenue = mVisits.reduce((s, v) => s + (v.total_amount ?? 0) + (v.labor_cost ?? 0), 0)
    const inspectionRevenue = mInspections.reduce((s, i) => s + (i.inspection_fee ?? i.cost ?? 0), 0)
    const salesRevenue = mSales.reduce((s, sale) => s + (sale.selling_price ?? 0), 0)
    const totalIncome = visitRevenue + inspectionRevenue + salesRevenue

    const wageExpenses = mExpenses.filter(e => isWageExpense(e.category))
    const otherExpenses = mExpenses.filter(e => !isWageExpense(e.category))
    const totalWages = wageExpenses.reduce((s, e) => s + (e.amount ?? 0), 0)
    const totalOther = otherExpenses.reduce((s, e) => s + (e.amount ?? 0), 0)
    const totalExpenses = totalWages + totalOther
    const netProfit = totalIncome - totalExpenses

    return { visitRevenue, inspectionRevenue, salesRevenue, totalIncome, totalWages, totalOther, totalExpenses, netProfit }
  }, [mVisits, mInspections, mSales, mExpenses])

  // ── Technician Breakdown ───────────────────────────────────
  const techBreakdown = useMemo(() => {
    const map = new Map<string, {
      visits: number
      inspections: number
      ecuSales: number
      revenue: number
      wages: number
    }>()

    const ensure = (name: string) => {
      if (!map.has(name)) map.set(name, { visits: 0, inspections: 0, ecuSales: 0, revenue: 0, wages: 0 })
      return map.get(name)!
    }

    for (const v of mVisits) {
      const name = v.technician_name || 'غير محدد'
      const t = ensure(name)
      t.visits++
      t.revenue += (v.total_amount ?? 0) + (v.labor_cost ?? 0)
    }
    for (const i of mInspections) {
      const name = i.technician_name || 'غير محدد'
      const t = ensure(name)
      t.inspections++
      t.revenue += (i.inspection_fee ?? i.cost ?? 0)
    }
    for (const s of mSales) {
      const name = s.technician_name || 'غير محدد'
      const t = ensure(name)
      if (s.ecu_id || s.item_type === 'ecu') t.ecuSales++
      t.revenue += s.selling_price ?? 0
    }
    for (const e of mExpenses) {
      if (isWageExpense(e.category)) {
        // Try to match technician name from description
        const desc = e.description?.toLowerCase() ?? ''
        let matched = false
        for (const [name] of map) {
          if (name !== 'غير محدد' && desc.includes(name)) {
            map.get(name)!.wages += e.amount ?? 0
            matched = true
            break
          }
        }
        if (!matched) {
          // Distribute to 'غير محدد' bucket
          ensure('غير محدد').wages += e.amount ?? 0
        }
      }
    }

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [mVisits, mInspections, mSales, mExpenses])

  // ── ECU Sales Summary ──────────────────────────────────────
  const ecuSummary = useMemo(() => {
    const ecuSales = mSales.filter(s => s.ecu_id || s.item_type === 'ecu')
    const unlockSales = mSales.filter(s => !s.ecu_id && s.item_type !== 'ecu')
    const totalEcuRevenue = ecuSales.reduce((s, x) => s + (x.selling_price ?? 0), 0)

    // Top models from item_name
    const modelMap = new Map<string, number>()
    for (const s of ecuSales) {
      const name = s.item_name || 'غير محدد'
      modelMap.set(name, (modelMap.get(name) ?? 0) + 1)
    }
    const topModels = Array.from(modelMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalEcuSales: ecuSales.length,
      totalUnlockSales: unlockSales.length,
      totalEcuRevenue,
      topModels,
    }
  }, [mSales])

  // ── Expense Category Breakdown ─────────────────────────────
  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>()
    for (const e of mExpenses) {
      const cat = e.category || 'أخرى'
      const ex = map.get(cat) ?? { count: 0, total: 0 }
      ex.count++
      ex.total += e.amount ?? 0
      map.set(cat, ex)
    }
    return Array.from(map.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.total - a.total)
  }, [mExpenses])

  // ── Top Vehicle Models ─────────────────────────────────────
  const topVehicles = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of mVisits) {
      const model = (v.vehicles as any)?.make_and_model || 'غير محدد'
      // Extract car make/model roughly (first 2-3 words)
      const key = model.trim().split(/\s+/).slice(0, 2).join(' ')
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    const total = mVisits.length || 1
    return Array.from(map.entries())
      .map(([model, count]) => ({ model, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [mVisits])

  const label = monthLabel(year, month)

  // ── Print handler ──────────────────────────────────────────
  const handlePrint = () => window.print()

  return (
    <>
      {/* ── Print Styles ─────────────────────────────────── */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
          .no-print { display: none !important; }
          .print-container { padding: 0 !important; margin: 0 !important; }
          @page { size: A4; margin: 12mm 14mm; }
          .page-break-before { page-break-before: always; }
          .soft-card, .rounded-2xl { box-shadow: none !important; }
        }
      `}</style>

      <div className="space-y-6 print-container" dir="rtl">
        {/* ── Screen Header ─────────────────────────────── */}
        <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-violet-50 flex items-center justify-center">
                <FileBarChart2 size={24} className="text-violet-600" />
              </div>
              التقرير الشهري الشامل
            </h1>
            <p className="text-sm text-slate-500 mt-1">ورشة منتصر لكهرباء السيارات</p>
          </div>
          <button
            onClick={handlePrint}
            className="no-print flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 transition-colors shadow-md shadow-violet-200"
          >
            <Printer size={18} />
            طباعة التقرير
          </button>
        </div>

        {/* ── Month Navigator ───────────────────────────── */}
        <div className="no-print flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 w-fit shadow-sm">
          <button
            onClick={goBack}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors"
          >
            <ChevronRight size={16} />
            الشهر السابق
          </button>
          <span className="text-base font-bold text-violet-700 min-w-[140px] text-center">{label}</span>
          <button
            onClick={goForward}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors"
          >
            الشهر التالي
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* ── Print Header (only visible when printing) ─── */}
        <div className="hidden print:block mb-4">
          <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
            <h1 className="text-xl font-extrabold text-slate-900">ورشة منتصر لكهرباء السيارات</h1>
            <p className="text-base font-semibold text-slate-700 mt-0.5">
              التقرير المالي والتشغيلي لشهر {label}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              تاريخ الطباعة: {new Date().toLocaleDateString('ar-IQ', { timeZone: 'Asia/Baghdad', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            SECTION 1: Financial Summary Cards
        ═══════════════════════════════════════════════ */}
        <section>
          <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2 print:text-sm print:mb-2">
            <DollarSign size={18} className="text-emerald-500 print:hidden" />
            ملخص الدخل والمصروفات
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:gap-2 print:grid-cols-4">
            <SummaryCard
              label="إجمالي الدخل المحصّل"
              value={formatCurrency(totals.totalIncome)}
              icon={<TrendingUp size={28} />}
              color="bg-emerald-50 border-emerald-200 text-emerald-800"
              sub={`زيارات: ${formatCurrency(totals.visitRevenue)} | فحص: ${formatCurrency(totals.inspectionRevenue)} | مبيعات: ${formatCurrency(totals.salesRevenue)}`}
            />
            <SummaryCard
              label="إجمالي أجور العمال"
              value={formatCurrency(totals.totalWages)}
              icon={<Users size={28} />}
              color="bg-amber-50 border-amber-200 text-amber-800"
              sub={`${mExpenses.filter(e => isWageExpense(e.category)).length} سحبة أجور`}
            />
            <SummaryCard
              label="المصاريف والنثريات"
              value={formatCurrency(totals.totalOther)}
              icon={<TrendingDown size={28} />}
              color="bg-rose-50 border-rose-200 text-rose-800"
              sub={`${mExpenses.filter(e => !isWageExpense(e.category)).length} بند مصروف`}
            />
            <SummaryCard
              label="صافي أرباح الشهر"
              value={formatCurrency(totals.netProfit)}
              icon={<BarChart3 size={28} />}
              color={totals.netProfit >= 0
                ? 'bg-violet-50 border-violet-200 text-violet-800'
                : 'bg-red-50 border-red-200 text-red-800'}
              sub={`الإجمالي ${formatCurrency(totals.totalIncome)} - المصاريف ${formatCurrency(totals.totalExpenses)}`}
            />
          </div>
        </section>

        {/* ── Quick stats row ─────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 print:gap-2">
          {[
            { label: 'سيارة صيانة', value: mVisits.length, icon: <Car size={20} />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
            { label: 'فحص سريع', value: mInspections.length, icon: <Stethoscope size={20} />, color: 'text-violet-600 bg-violet-50 border-violet-200' },
            { label: 'مبيعة (عقول + خدمات)', value: mSales.length, icon: <ShoppingBag size={20} />, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 flex items-center gap-3 print:p-2 print:rounded-lg ${s.color}`}>
              <div className="shrink-0 print:hidden">{s.icon}</div>
              <div>
                <p className="text-2xl font-extrabold leading-none print:text-lg">{s.value}</p>
                <p className="text-xs font-semibold opacity-70 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════
            SECTION 2: Technician Performance Table
        ═══════════════════════════════════════════════ */}
        <section>
          <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2 print:text-sm print:mb-2">
            <Wrench size={18} className="text-violet-500 print:hidden" />
            أداء الفنيين
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:rounded-lg print:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm print:text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-600">
                    <th className="px-4 py-3 text-right font-semibold">اسم الفني</th>
                    <th className="px-4 py-3 text-center font-semibold">صيانة سيارات</th>
                    <th className="px-4 py-3 text-center font-semibold">فحوصات سريعة</th>
                    <th className="px-4 py-3 text-center font-semibold">مبيعات عقول</th>
                    <th className="px-4 py-3 text-right font-semibold">إجمالي الدخل</th>
                    <th className="px-4 py-3 text-right font-semibold">اليوميات المستلمة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {techBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                        لا توجد بيانات لهذا الشهر
                      </td>
                    </tr>
                  ) : (
                    techBreakdown.map(t => (
                      <tr key={t.name} className="hover:bg-slate-50/60 transition-colors print:hover:bg-transparent">
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-violet-400 print:hidden" />
                            {t.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg print:bg-transparent print:text-slate-800">
                            {t.visits}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-lg print:bg-transparent print:text-slate-800">
                            {t.inspections}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg print:bg-transparent print:text-slate-800">
                            {t.ecuSales}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-700">
                          {formatCurrency(t.revenue)}
                        </td>
                        <td className="px-4 py-3 font-mono text-amber-700">
                          {t.wages > 0 ? formatCurrency(t.wages) : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    ))
                  )}
                  {techBreakdown.length > 0 && (
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                      <td className="px-4 py-3 text-slate-700">الإجمالي</td>
                      <td className="px-4 py-3 text-center text-blue-700">{mVisits.length}</td>
                      <td className="px-4 py-3 text-center text-violet-700">{mInspections.length}</td>
                      <td className="px-4 py-3 text-center text-emerald-700">{ecuSummary.totalEcuSales}</td>
                      <td className="px-4 py-3 font-mono text-emerald-700">{formatCurrency(totals.totalIncome)}</td>
                      <td className="px-4 py-3 font-mono text-amber-700">{formatCurrency(totals.totalWages)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Page 2 break for print ───────────────────── */}
        <div className="page-break-before" />

        {/* ═══════════════════════════════════════════════
            SECTION 3: ECU Sales & Unlocking Summary
        ═══════════════════════════════════════════════ */}
        <section className="grid md:grid-cols-2 gap-4 print:gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2 print:text-sm print:mb-2">
              <Cpu size={18} className="text-violet-500 print:hidden" />
              بنك العقول والمبيعات
            </h2>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 print:p-3 print:rounded-lg print:shadow-none">
              <div className="grid grid-cols-2 gap-3 print:gap-2">
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-center print:rounded-lg">
                  <p className="text-2xl font-extrabold text-violet-700 print:text-lg">{ecuSummary.totalEcuSales}</p>
                  <p className="text-xs text-violet-600 font-semibold mt-0.5">عقل مباع/محرر</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center print:rounded-lg">
                  <p className="text-2xl font-extrabold text-emerald-700 print:text-lg">{ecuSummary.totalUnlockSales}</p>
                  <p className="text-xs text-emerald-600 font-semibold mt-0.5">خدمة برمجة / فتح</p>
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-slate-100">
                <span className="text-sm text-slate-600 font-semibold">إجمالي إيراد المبيعات:</span>
                <span className="font-mono font-bold text-emerald-700">{formatCurrency(totals.salesRevenue)}</span>
              </div>
              {ecuSummary.topModels.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">الموديلات الأكثر مبيعاً</p>
                  <div className="space-y-1.5">
                    {ecuSummary.topModels.map(m => (
                      <div key={m.name} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 truncate max-w-[180px]">{m.name}</span>
                        <span className="font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-lg print:bg-transparent">
                          {m.count} ×
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════
              SECTION 4: Expense Categorization
          ═══════════════════════════════════════════════ */}
          <div>
            <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2 print:text-sm print:mb-2">
              <TrendingDown size={18} className="text-rose-500 print:hidden" />
              تصنيف المصروفات
            </h2>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:rounded-lg print:shadow-none">
              <table className="w-full text-sm print:text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-600">
                    <th className="px-4 py-3 text-right font-semibold">التصنيف</th>
                    <th className="px-4 py-3 text-center font-semibold">العدد</th>
                    <th className="px-4 py-3 text-right font-semibold">المجموع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {expenseBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400 text-sm">
                        لا توجد مصروفات
                      </td>
                    </tr>
                  ) : (
                    expenseBreakdown.map(e => (
                      <tr key={e.category} className="hover:bg-slate-50/60 print:hover:bg-transparent">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold print:bg-transparent print:text-slate-800 ${
                            isWageExpense(e.category)
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {e.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-600">{e.count}</td>
                        <td className="px-4 py-3 font-mono font-bold text-rose-700">{formatCurrency(e.total)}</td>
                      </tr>
                    ))
                  )}
                  {expenseBreakdown.length > 0 && (
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                      <td className="px-4 py-3 text-slate-700">الإجمالي</td>
                      <td className="px-4 py-3 text-center">{mExpenses.length}</td>
                      <td className="px-4 py-3 font-mono text-rose-700">{formatCurrency(totals.totalExpenses)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            SECTION 5: Top Recurring Vehicles
        ═══════════════════════════════════════════════ */}
        <section>
          <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2 print:text-sm print:mb-2">
            <Car size={18} className="text-blue-500 print:hidden" />
            أكثر السيارات تكراراً في الورشة
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 print:p-3 print:rounded-lg print:shadow-none">
            {topVehicles.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">لا توجد بيانات</p>
            ) : (
              <div className="space-y-3 print:space-y-2">
                {topVehicles.map((v, i) => (
                  <div key={v.model} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 print:bg-transparent print:text-slate-700">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-slate-800 truncate">{v.model}</span>
                        <span className="text-xs font-bold text-blue-700 shrink-0 mr-2">
                          {v.count} سيارة ({v.pct}٪)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 print:hidden">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${v.pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Print Footer ─────────────────────────────── */}
        <div className="hidden print:block mt-6 pt-3 border-t border-slate-300 text-center">
          <p className="text-xs text-slate-500">
            ورشة منتصر لكهرباء السيارات — {label} — نظام إدارة الورشة
          </p>
        </div>
      </div>
    </>
  )
}

