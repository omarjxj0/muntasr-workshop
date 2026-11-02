'use client'

import { useState, useMemo } from 'react'
import {
  ChevronRight, ChevronLeft, Printer, FileBarChart2,
  TrendingUp, TrendingDown, DollarSign, Users, Car, Cpu, ShoppingBag,
  BarChart3, Wrench, Stethoscope, Banknote, X, Calendar,
} from 'lucide-react'
import { formatCurrency, getBaghdadDateKey } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────
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
// Expense row from the `expenses` table
interface ExpenseRow {
  id: string
  amount: number
  category: string
  description: string
  created_at: string
}
// Normalized daily wage row (from `daily_wages` + `employees`)
interface WageRow {
  id: string
  amount: number
  created_at: string  // contains the `date` field (YYYY-MM-DD)
  category: string    // always 'أجور ورواتب'
  description: string // 'أجر يومي - <name>'
  recipientName: string | null
  isWage: true
}

interface Props {
  visits: VisitRow[]
  inspections: InspectionRow[]
  sales: SaleRow[]
  expenses: ExpenseRow[]
  wages: WageRow[]     // ← new: daily_wages rows
}

// ─── Canonical worker list (incl. historical عبود) ─────────────
const ALL_WORKERS = [
  'وسام', 'أبو عبد الله', 'سلوم', 'صلاح', 'بكر', 'عبود', 'منتصر', 'عمر',
]

// Expense categories from daily-shift that represent operational (non-wage) spend
const EXPENSE_WAGE_CATEGORIES = ['سلفة / أجور', 'أجور ورواتب', 'أجور عمال', 'أجور', 'يوميات', 'رواتب', 'راتب']

/** Returns true if an `expenses` table record is a wage-type entry */
function isExpenseWage(category: string, description: string): boolean {
  if (!category) return false
  const catMatch = EXPENSE_WAGE_CATEGORIES.some(c =>
    category === c || category.includes(c)
  )
  if (catMatch) return true
  // Also match if description contains a worker name pattern
  const desc = description ?? ''
  return ALL_WORKERS.some(name => desc.includes(name)) && desc.includes('أجر')
}

/**
 * Extract worker name from an expense description.
 * Daily-shift saves worker name as: "بيان المصروف (المستلم: وسام) [ملاحظة]"
 */
function extractWorkerFromExpense(description: string): string | null {
  if (!description) return null
  // Pattern: (المستلم: <name>)
  const recipientMatch = description.match(/\(المستلم:\s*([^)]+)\)/)
  if (recipientMatch) return recipientMatch[1].trim()
  // Pattern: "أجر يومي - <name>"
  const dailyMatch = description.match(/أجر يومي\s*[-–]\s*(.+)/)
  if (dailyMatch) return dailyMatch[1].replace(/\[.*?\]/g, '').trim()
  // Fallback: scan for any known worker name in description
  const sorted = [...ALL_WORKERS].sort((a, b) => b.length - a.length)
  for (const name of sorted) {
    if (description.includes(name)) return name
  }
  return null
}

// ─── Baghdad timezone helpers ──────────────────────────────────
function getBaghdadMonthKey(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  // Handle plain YYYY-MM-DD date strings (from daily_wages.date)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr.slice(0, 7)
  const { monthKey } = getBaghdadDateKey(dateStr)
  return monthKey
}

function getBaghdadDayDisplay(dateStr: string): string {
  try {
    // Plain date string: treat as Baghdad local date directly
    const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? new Date(`${dateStr}T12:00:00+03:00`)
      : new Date(dateStr)
    return new Intl.DateTimeFormat('ar-IQ', {
      timeZone: 'Asia/Baghdad',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(d)
  } catch { return dateStr }
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long' })
}

function getCurrentBaghdadYearMonth(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baghdad', year: 'numeric', month: '2-digit',
  }).format(new Date()).split('-')
  return { year: Number(parts[0]), month: Number(parts[1]) }
}

// ─── Summary Card ──────────────────────────────────────────────
function SummaryCard({ label, value, icon, color, sub }: {
  label: string; value: string; icon: React.ReactNode; color: string; sub?: string
}) {
  return (
    <div className={`rounded-2xl p-5 border ${color} print:p-3 print:rounded-lg`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold opacity-70 mb-1">{label}</p>
          <p className="text-xl font-extrabold font-mono leading-tight">{value}</p>
          {sub && <p className="text-[11px] opacity-60 mt-0.5 leading-snug">{sub}</p>}
        </div>
        <div className="opacity-60 shrink-0">{icon}</div>
      </div>
    </div>
  )
}

// ─── Worker Detail Drawer ──────────────────────────────────────
interface WorkerPayment {
  id: string; date: string; amount: number; description: string; source: 'wages' | 'expenses'
}
function WorkerDrawer({ name, payments, totalWages, onClose }: {
  name: string; payments: WorkerPayment[]; totalWages: number; onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Banknote size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">كشف مدفوعات — {name}</h3>
              <p className="text-xs text-slate-500">{payments.length} دفعة مسجلة</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[400px] divide-y divide-slate-50">
          {payments.length === 0 ? (
            <p className="text-center text-slate-400 py-10 text-sm">لا توجد دفعات مسجلة</p>
          ) : payments.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold text-xs flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                    <Calendar size={12} className="text-slate-400" />
                    {getBaghdadDayDisplay(p.date)}
                    {p.source === 'wages' && (
                      <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-md font-semibold mr-1">يومية</span>
                    )}
                    {p.source === 'expenses' && (
                      <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-md font-semibold mr-1">سلفة</span>
                    )}
                  </p>
                  {p.description && (
                    <p className="text-xs text-slate-400 truncate max-w-[220px]">{p.description}</p>
                  )}
                </div>
              </div>
              <span className="font-mono font-bold text-amber-700 text-sm">{formatCurrency(p.amount)}</span>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 bg-amber-50 border-t border-amber-100 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">المجموع الكلي</span>
          <span className="font-mono font-extrabold text-amber-800 text-base">{formatCurrency(totalWages)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────
export default function MonthlyReportClient({ visits, inspections, sales, expenses, wages }: Props) {
  const { year: todayYear, month: todayMonth } = getCurrentBaghdadYearMonth()
  const [year, setYear] = useState(todayYear)
  const [month, setMonth] = useState(todayMonth)
  const [drawerWorker, setDrawerWorker] = useState<string | null>(null)

  const selectedKey = `${year}-${String(month).padStart(2, '0')}`

  const goBack = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const goForward = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  // ── Filter all data by selected month ────────────────────────
  const mVisits = useMemo(() =>
    visits.filter(v => getBaghdadMonthKey(v.delivered_at) === selectedKey), [visits, selectedKey])

  const mInspections = useMemo(() =>
    inspections.filter(i => getBaghdadMonthKey(i.created_at) === selectedKey), [inspections, selectedKey])

  const mSales = useMemo(() =>
    sales.filter(s => getBaghdadMonthKey(s.created_at) === selectedKey), [sales, selectedKey])

  const mExpenses = useMemo(() =>
    expenses.filter(e => getBaghdadMonthKey(e.created_at) === selectedKey), [expenses, selectedKey])

  // daily_wages rows for the month
  const mWages = useMemo(() =>
    wages.filter(w => getBaghdadMonthKey(w.created_at) === selectedKey), [wages, selectedKey])

  // ── Financial Totals ─────────────────────────────────────────
  const totals = useMemo(() => {
    const visitRevenue       = mVisits.reduce((s, v) => s + (v.total_amount ?? 0) + (v.labor_cost ?? 0), 0)
    const inspectionRevenue  = mInspections.reduce((s, i) => s + (i.inspection_fee ?? i.cost ?? 0), 0)
    const salesRevenue       = mSales.reduce((s, x) => s + (x.selling_price ?? 0), 0)
    const totalIncome        = visitRevenue + inspectionRevenue + salesRevenue

    // Wages: daily_wages table (primary) + expenses table entries categorized as wages
    const wageFromWagesTable   = mWages.reduce((s, w) => s + (w.amount ?? 0), 0)
    const wageExpensesRows     = mExpenses.filter(e => isExpenseWage(e.category, e.description))
    const wageFromExpensesTable = wageExpensesRows.reduce((s, e) => s + (e.amount ?? 0), 0)
    const totalWages = wageFromWagesTable + wageFromExpensesTable

    // Operational expenses (non-wage entries from expenses table)
    const otherExpensesRows  = mExpenses.filter(e => !isExpenseWage(e.category, e.description))
    const totalOther         = otherExpensesRows.reduce((s, e) => s + (e.amount ?? 0), 0)

    const totalExpenses = totalWages + totalOther
    const netProfit     = totalIncome - totalExpenses

    return {
      visitRevenue, inspectionRevenue, salesRevenue, totalIncome,
      totalWages, totalOther, totalExpenses, netProfit,
      wagePaymentsCount: mWages.length + wageExpensesRows.length,
      otherExpensesCount: otherExpensesRows.length,
    }
  }, [mVisits, mInspections, mSales, mExpenses, mWages])

  // ── Worker Wages Breakdown ───────────────────────────────────
  const wagesBreakdown = useMemo(() => {
    type Bucket = { count: number; total: number; payments: WorkerPayment[] }
    const map = new Map<string, Bucket>()
    const ensureWorker = (name: string): Bucket => {
      if (!map.has(name)) map.set(name, { count: 0, total: 0, payments: [] })
      return map.get(name)!
    }

    // 1. Process daily_wages rows (primary source)
    for (const w of mWages) {
      const name = w.recipientName ?? extractWorkerFromExpense(w.description) ?? 'غير محدد'
      const b = ensureWorker(name)
      b.count++
      b.total += w.amount ?? 0
      b.payments.push({ id: w.id, date: w.created_at, amount: w.amount, description: w.description, source: 'wages' })
    }

    // 2. Process expenses table rows that are wage-type
    for (const e of mExpenses) {
      if (!isExpenseWage(e.category, e.description)) continue
      const name = extractWorkerFromExpense(e.description) ?? 'غير محدد'
      const b = ensureWorker(name)
      b.count++
      b.total += e.amount ?? 0
      b.payments.push({ id: e.id, date: e.created_at, amount: e.amount, description: e.description, source: 'expenses' })
    }

    // Sort each worker's payments chronologically
    for (const [, b] of map) {
      b.payments.sort((a, z) => {
        const ak = /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : getBaghdadDateKey(a.date).dayKey
        const zk = /^\d{4}-\d{2}-\d{2}$/.test(z.date) ? z.date : getBaghdadDateKey(z.date).dayKey
        return ak.localeCompare(zk)
      })
    }

    const grandTotal = totals.totalWages

    // Build output: canonical workers first, then غير محدد last
    const rows = [...ALL_WORKERS, 'غير محدد']
      .map(name => {
        const b = map.get(name)
        if (!b || b.count === 0) return null
        return {
          name,
          count: b.count,
          total: b.total,
          payments: b.payments,
          pct: grandTotal > 0 ? Math.round((b.total / grandTotal) * 100) : 0,
        }
      })
      .filter(Boolean) as { name: string; count: number; total: number; payments: WorkerPayment[]; pct: number }[]

    return { rows, grandTotal, totalPayments: rows.reduce((s, r) => s + r.count, 0) }
  }, [mWages, mExpenses, totals.totalWages])

  const drawerData = useMemo(() =>
    drawerWorker ? wagesBreakdown.rows.find(r => r.name === drawerWorker) ?? null : null,
    [drawerWorker, wagesBreakdown]
  )

  // ── Technician Performance ───────────────────────────────────
  const techBreakdown = useMemo(() => {
    const map = new Map<string, { visits: number; inspections: number; ecuSales: number; revenue: number }>()
    const ensure = (name: string) => {
      if (!map.has(name)) map.set(name, { visits: 0, inspections: 0, ecuSales: 0, revenue: 0 })
      return map.get(name)!
    }
    for (const v of mVisits) {
      const t = ensure(v.technician_name || 'غير محدد')
      t.visits++; t.revenue += (v.total_amount ?? 0) + (v.labor_cost ?? 0)
    }
    for (const i of mInspections) {
      const t = ensure(i.technician_name || 'غير محدد')
      t.inspections++; t.revenue += (i.inspection_fee ?? i.cost ?? 0)
    }
    for (const s of mSales) {
      const t = ensure(s.technician_name || 'غير محدد')
      if (s.ecu_id || s.item_type === 'ecu') t.ecuSales++
      t.revenue += s.selling_price ?? 0
    }
    return Array.from(map.entries()).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue)
  }, [mVisits, mInspections, mSales])

  // ── ECU Sales ───────────────────────────────────────────────
  const ecuSummary = useMemo(() => {
    const ecuSales    = mSales.filter(s => s.ecu_id || s.item_type === 'ecu')
    const unlockSales = mSales.filter(s => !s.ecu_id && s.item_type !== 'ecu')
    const modelMap = new Map<string, number>()
    for (const s of ecuSales) modelMap.set(s.item_name || 'غير محدد', (modelMap.get(s.item_name || 'غير محدد') ?? 0) + 1)
    return {
      totalEcuSales: ecuSales.length,
      totalUnlockSales: unlockSales.length,
      topModels: Array.from(modelMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    }
  }, [mSales])

  // ── Expense Category Breakdown ───────────────────────────────
  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>()
    for (const e of mExpenses) {
      const cat = e.category || 'أخرى'
      const ex = map.get(cat) ?? { count: 0, total: 0 }
      ex.count++; ex.total += e.amount ?? 0
      map.set(cat, ex)
    }
    return Array.from(map.entries()).map(([category, d]) => ({ category, ...d })).sort((a, b) => b.total - a.total)
  }, [mExpenses])

  // ── Top Vehicles ─────────────────────────────────────────────
  const topVehicles = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of mVisits) {
      const key = ((v.vehicles as any)?.make_and_model || 'غير محدد').trim().split(/\s+/).slice(0, 2).join(' ')
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    const total = mVisits.length || 1
    return Array.from(map.entries()).map(([model, count]) => ({ model, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count).slice(0, 5)
  }, [mVisits])

  const label = monthLabel(year, month)
  const handlePrint = () => window.print()

  return (
    <>
      {/* Drawer — screen only */}
      {drawerWorker && drawerData && (
        <WorkerDrawer
          name={drawerData.name}
          payments={drawerData.payments}
          totalWages={drawerData.total}
          onClose={() => setDrawerWorker(null)}
        />
      )}

      {/* ── Screen header & nav (hidden when printing) ──────── */}
      <div className="no-print space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 transition-colors shadow-md shadow-violet-200"
          >
            <Printer size={18} />
            طباعة التقرير
          </button>
        </div>
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 w-fit shadow-sm">
          <button onClick={goBack} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors">
            <ChevronRight size={16} />الشهر السابق
          </button>
          <span className="text-base font-bold text-violet-700 min-w-[140px] text-center">{label}</span>
          <button onClick={goForward} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors">
            الشهر التالي<ChevronLeft size={16} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          PRINTABLE REGION — everything inside this div
          is visible when printing (via globals.css allowlist)
      ═══════════════════════════════════════════════════════ */}
      <div id="monthly-report-printable" dir="rtl" className="space-y-5">

        {/* Print-only header */}
        <div className="hidden print:block mb-4">
          <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
            <h1 className="text-xl font-extrabold text-slate-900">ورشة منتصر لكهرباء السيارات</h1>
            <p className="text-base font-semibold text-slate-700 mt-0.5">التقرير المالي والتشغيلي لشهر {label}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              تاريخ الطباعة: {new Date().toLocaleDateString('ar-IQ', { timeZone: 'Asia/Baghdad', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* ─── SECTION 1: Financial Summary Cards ─────────────── */}
        <section className="report-card">
          <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2 print:text-sm print:mb-2">
            <DollarSign size={18} className="text-emerald-500 no-print" />
            ملخص الدخل والمصروفات
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:gap-2 print:grid-cols-4">
            <SummaryCard label="إجمالي الدخل المحصّل" value={formatCurrency(totals.totalIncome)} icon={<TrendingUp size={28} />}
              color="bg-emerald-50 border-emerald-200 text-emerald-800"
              sub={`زيارات: ${formatCurrency(totals.visitRevenue)} | فحص: ${formatCurrency(totals.inspectionRevenue)} | مبيعات: ${formatCurrency(totals.salesRevenue)}`} />
            <SummaryCard label="إجمالي أجور العمال" value={formatCurrency(totals.totalWages)} icon={<Users size={28} />}
              color="bg-amber-50 border-amber-200 text-amber-800"
              sub={`${totals.wagePaymentsCount} دفعة · ${wagesBreakdown.rows.length} عامل`} />
            <SummaryCard label="المصاريف والنثريات" value={formatCurrency(totals.totalOther)} icon={<TrendingDown size={28} />}
              color="bg-rose-50 border-rose-200 text-rose-800"
              sub={`${totals.otherExpensesCount} بند مصروف`} />
            <SummaryCard label="صافي أرباح الشهر" value={formatCurrency(totals.netProfit)} icon={<BarChart3 size={28} />}
              color={totals.netProfit >= 0 ? 'bg-violet-50 border-violet-200 text-violet-800' : 'bg-red-50 border-red-200 text-red-800'}
              sub={`الإجمالي ${formatCurrency(totals.totalIncome)} - المصاريف ${formatCurrency(totals.totalExpenses)}`} />
          </div>
        </section>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 report-card print:gap-2">
          {[
            { label: 'سيارة صيانة', value: mVisits.length, icon: <Car size={20} />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
            { label: 'فحص سريع', value: mInspections.length, icon: <Stethoscope size={20} />, color: 'text-violet-600 bg-violet-50 border-violet-200' },
            { label: 'مبيعة (عقول + خدمات)', value: mSales.length, icon: <ShoppingBag size={20} />, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 flex items-center gap-3 print:p-2 print:rounded-lg ${s.color}`}>
              <div className="shrink-0 no-print">{s.icon}</div>
              <div>
                <p className="text-2xl font-extrabold leading-none print:text-lg">{s.value}</p>
                <p className="text-xs font-semibold opacity-70 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ─── SECTION 2: Technician Performance ──────────────── */}
        <section className="report-card">
          <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2 print:text-sm print:mb-2">
            <Wrench size={18} className="text-violet-500 no-print" />أداء الفنيين
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {techBreakdown.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400 text-sm">لا توجد بيانات لهذا الشهر</td></tr>
                  ) : techBreakdown.map(t => (
                    <tr key={t.name} className="hover:bg-slate-50/60 print:hover:bg-transparent">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-violet-400 no-print" />{t.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center"><span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg print:bg-transparent print:text-slate-800">{t.visits}</span></td>
                      <td className="px-4 py-3 text-center"><span className="font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-lg print:bg-transparent print:text-slate-800">{t.inspections}</span></td>
                      <td className="px-4 py-3 text-center"><span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg print:bg-transparent print:text-slate-800">{t.ecuSales}</span></td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-700">{formatCurrency(t.revenue)}</td>
                    </tr>
                  ))}
                  {techBreakdown.length > 0 && (
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                      <td className="px-4 py-3 text-slate-700">الإجمالي</td>
                      <td className="px-4 py-3 text-center text-blue-700">{mVisits.length}</td>
                      <td className="px-4 py-3 text-center text-violet-700">{mInspections.length}</td>
                      <td className="px-4 py-3 text-center text-emerald-700">{ecuSummary.totalEcuSales}</td>
                      <td className="px-4 py-3 font-mono text-emerald-700">{formatCurrency(totals.totalIncome)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ─── SECTION 3: Worker Wages Breakdown ──────────────── */}
        <section className="report-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-700 flex items-center gap-2 print:text-sm">
              <Banknote size={18} className="text-amber-500 no-print" />
              كشف رواتب ويوميات العمال للشهر
            </h2>
            <div className="no-print flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl font-semibold">
              <Users size={13} />{wagesBreakdown.rows.length} عامل · {wagesBreakdown.totalPayments} دفعة
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:rounded-lg print:shadow-none">
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between print:py-2">
              <span className="text-sm font-semibold text-amber-800">إجمالي أجور الورشة لشهر {label}</span>
              <span className="font-mono font-extrabold text-amber-900 text-base">{formatCurrency(wagesBreakdown.grandTotal)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm print:text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-600">
                    <th className="px-4 py-3 text-center font-semibold w-10">#</th>
                    <th className="px-4 py-3 text-right font-semibold">اسم العامل</th>
                    <th className="px-4 py-3 text-center font-semibold">عدد الدفعات / الأيام</th>
                    <th className="px-4 py-3 text-right font-semibold">إجمالي المبلغ المقبوض</th>
                    <th className="px-4 py-3 text-center font-semibold">النسبة من الإجمالي</th>
                    <th className="px-4 py-3 text-center font-semibold w-16 no-print">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {wagesBreakdown.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 text-sm">
                        <Banknote size={36} className="mx-auto mb-2 opacity-20" />
                        لا توجد أجور مسجلة لهذا الشهر
                      </td>
                    </tr>
                  ) : wagesBreakdown.rows.map((row, i) => (
                    <tr key={row.name} className="hover:bg-amber-50/40 transition-colors print:hover:bg-transparent group">
                      <td className="px-4 py-3 text-center">
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-bold text-xs inline-flex items-center justify-center print:bg-transparent print:text-slate-600">
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400 no-print" />{row.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg print:bg-transparent">
                          {row.count} {row.count === 1 ? 'دفعة' : 'دفعات'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-amber-700">{formatCurrency(row.total)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 no-print">
                            <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${row.pct}%` }} />
                          </div>
                          <span className="text-xs font-bold text-amber-700">{row.pct}٪</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center no-print">
                        <button
                          onClick={() => setDrawerWorker(row.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                        >
                          عرض
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {wagesBreakdown.rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-amber-200 bg-amber-50">
                      <td colSpan={2} className="px-4 py-3 font-bold text-amber-900">المجموع الكلي لأجور العمال</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700">{wagesBreakdown.totalPayments} دفعة</td>
                      <td className="px-4 py-3 font-mono font-extrabold text-amber-900 text-base">{formatCurrency(wagesBreakdown.grandTotal)}</td>
                      <td className="px-4 py-3 text-center font-bold text-amber-700">100٪</td>
                      <td className="no-print" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </section>

        {/* ─── SECTION 4 & 5: ECU Sales + Expense Categorization ─ */}
        <section className="grid md:grid-cols-2 gap-4 print:gap-3 report-card">
          {/* ECU Sales */}
          <div>
            <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2 print:text-sm print:mb-2">
              <Cpu size={18} className="text-violet-500 no-print" />بنك العقول والمبيعات
            </h2>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 print:p-3 print:rounded-lg print:shadow-none">
              <div className="grid grid-cols-2 gap-3 print:gap-2">
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-extrabold text-violet-700 print:text-lg">{ecuSummary.totalEcuSales}</p>
                  <p className="text-xs text-violet-600 font-semibold mt-0.5">عقل مباع/محرر</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
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
                        <span className="font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-lg print:bg-transparent">{m.count} ×</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Expense Categories */}
          <div>
            <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2 print:text-sm print:mb-2">
              <TrendingDown size={18} className="text-rose-500 no-print" />تصنيف المصروفات
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
                    <tr><td colSpan={3} className="py-6 text-center text-slate-400 text-sm">لا توجد مصروفات</td></tr>
                  ) : expenseBreakdown.map(e => (
                    <tr key={e.category} className="hover:bg-slate-50/60 print:hover:bg-transparent">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold print:bg-transparent print:text-slate-800 ${isExpenseWage(e.category, '') ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700'}`}>
                          {e.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-600">{e.count}</td>
                      <td className="px-4 py-3 font-mono font-bold text-rose-700">{formatCurrency(e.total)}</td>
                    </tr>
                  ))}
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

        {/* ─── SECTION 6: Top Vehicles ─────────────────────────── */}
        <section className="report-card">
          <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2 print:text-sm print:mb-2">
            <Car size={18} className="text-blue-500 no-print" />أكثر السيارات تكراراً في الورشة
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 print:p-3 print:rounded-lg print:shadow-none">
            {topVehicles.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">لا توجد بيانات</p>
            ) : (
              <div className="space-y-3 print:space-y-2">
                {topVehicles.map((v, i) => (
                  <div key={v.model} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 print:bg-transparent print:text-slate-700">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-slate-800 truncate">{v.model}</span>
                        <span className="text-xs font-bold text-blue-700 shrink-0 mr-2">{v.count} سيارة ({v.pct}٪)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 no-print">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${v.pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Print footer */}
        <div className="hidden print:block mt-4 pt-3 border-t border-slate-300 text-center">
          <p className="text-xs text-slate-500">ورشة منتصر لكهرباء السيارات — {label} — نظام إدارة الورشة</p>
        </div>

      </div>{/* end #monthly-report-printable */}
    </>
  )
}
