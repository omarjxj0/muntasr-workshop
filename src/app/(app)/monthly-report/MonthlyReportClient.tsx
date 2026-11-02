'use client'

import { useState, useMemo } from 'react'
import {
  ChevronRight, ChevronLeft, Printer, FileBarChart2,
  TrendingUp, TrendingDown, DollarSign, Users, Car, Cpu, ShoppingBag,
  BarChart3, Wrench, Stethoscope, Banknote, Calendar, ChevronDown, ChevronUp,
  Eye, EyeOff, ShieldCheck, Equal, Minus, Plus
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

interface ExpenseRow {
  id: string
  amount: number
  category: string
  description: string
  created_at: string
  notes?: string | null
  title?: string | null
  worker_name?: string | null
  technician_name?: string | null
}

interface WageRow {
  id: string
  amount: number
  created_at: string // YYYY-MM-DD from daily_wages.date
  category: string   // 'أجور ورواتب'
  description: string
  recipientName: string | null
  isWage: true
}

interface Props {
  visits: VisitRow[]
  inspections: InspectionRow[]
  sales: SaleRow[]
  expenses: ExpenseRow[]
  wages: WageRow[]
}

// ─── Canonical Workers List ────────────────────────────────────
// Required list: Abu Abdullah, Wesam, Salloum, Salah, Aboud, Bakr, Montaser, Omar
export const CANONICAL_WORKERS = [
  'أبو عبد الله',
  'وسام',
  'سلوم',
  'صلاح',
  'عبود',
  'بكر',
  'منتصر',
  'عمر',
] as const

const WAGE_CATEGORY_KEYWORDS = [
  'اجور',
  'أجور',
  'يوميات',
  'رواتب',
  'راتب',
  'سلفة',
  'سلفه',
  'سلفة / أجور',
  'أجور ورواتب',
  'أجور عمال',
]

// ─── Arabic Text Normalization & Worker Matching ───────────────
export function normalizeArabic(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .toString()
    .trim()
    .toLowerCase()
    // Strip diacritics & tashkeel
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Replace alef variants with ا
    .replace(/[أإآٱ]/g, 'ا')
    // Replace ة with ه
    .replace(/ة/g, 'ه')
    // Replace ى with ي
    .replace(/ى/g, 'ي')
    // Remove tatweel ـ
    .replace(/ـ/g, '')
    // Normalize multiple whitespace
    .replace(/\s+/g, ' ')
}

export function stripSpaces(text: string): string {
  return text.replace(/\s+/g, '')
}

/**
 * Smart Worker Matching:
 * Scans all text fields of an item using normalization and exact priority
 * to resolve to one of the canonical workers.
 */
export function matchWorker(item: any): string | null {
  if (!item) return null

  // Extract recipient from "(المستلم: <name>)" if present
  const desc = item.description || ''
  const recipientMatch = desc.match(/\(المستلم:\s*([^)]+)\)/)
  const explicitRecipient = recipientMatch ? recipientMatch[1].trim() : null

  const fields = [
    explicitRecipient,
    item.recipientName,
    item.worker_name,
    item.technician_name,
    item.employees?.name,
    item.description,
    item.notes,
    item.title,
    item.category,
  ].filter(Boolean).join(' ')

  const norm = normalizeArabic(fields)
  const compact = stripSpaces(norm)

  // 1. 'أبو عبد الله' MUST be checked FIRST before 'عبود' / 'عبدالله'
  if (
    compact.includes('ابوعبدالله') ||
    compact.includes('ابوعبد الله') ||
    norm.includes('ابو عبد الله') ||
    norm.includes('ابو عبدالله')
  ) {
    return 'أبو عبد الله'
  }

  // 2. 'وسام' (includes 'وسام عدنان')
  if (norm.includes('وسام')) {
    return 'وسام'
  }

  // 3. 'سلوم' (includes 'سلام')
  if (norm.includes('سلوم') || /(^|[^\u0621-\u064A])سلام([^\u0621-\u064A]|$)/.test(norm)) {
    return 'سلوم'
  }

  // 4. 'صلاح'
  if (norm.includes('صلاح')) {
    return 'صلاح'
  }

  // 5. 'عبود' (includes 'عبدالله' / 'عبد الله' when NOT preceded by 'ابو')
  if (norm.includes('عبود') || compact.includes('عبدالله') || norm.includes('عبد الله')) {
    return 'عبود'
  }

  // 6. 'بكر'
  if (/(^|[^\u0621-\u064A])بكر([^\u0621-\u064A]|$)/.test(norm) || norm.includes('بكر')) {
    return 'بكر'
  }

  // 7. 'منتصر'
  if (norm.includes('منتصر')) {
    return 'منتصر'
  }

  // 8. 'عمر' (boundary match to avoid words like عمران or معمر)
  if (/(^|[^\u0621-\u064A])عمر([^\u0621-\u064A]|$)/.test(norm)) {
    return 'عمر'
  }

  // 9. 'كنان' (active in workshop database)
  if (norm.includes('كنان')) {
    return 'كنان'
  }

  return null
}

function isWageExpenseItem(item: any): boolean {
  if (item.isWage) return true
  const normCat = normalizeArabic(item.category || '')
  const normDesc = normalizeArabic(item.description || '')
  return WAGE_CATEGORY_KEYWORDS.some(k => normCat.includes(k) || normDesc.includes(k))
}

// ─── Baghdad Timezone Date Helpers ─────────────────────────────
function getBaghdadMonthKey(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  // Plain YYYY-MM-DD from daily_wages.date
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr.slice(0, 7)
  const { monthKey } = getBaghdadDateKey(dateStr)
  return monthKey
}

function getBaghdadDateSortKey(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  const { dayKey } = getBaghdadDateKey(dateStr)
  return dayKey
}

function formatDayBaghdad(dateStr: string): string {
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? new Date(`${dateStr}T12:00:00+03:00`)
      : new Date(dateStr)
    return new Intl.DateTimeFormat('ar-IQ', {
      timeZone: 'Asia/Baghdad',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(d)
  } catch {
    return dateStr
  }
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long' })
}

function getCurrentBaghdadYearMonth(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date()).split('-')
  return { year: Number(parts[0]), month: Number(parts[1]) }
}

// ─── Payment Record Interface ──────────────────────────────────
interface PaymentRecord {
  id: string
  date: string
  amount: number
  description: string
  source: 'wage_entry' | 'expense_entry'
}

interface WorkerSummary {
  name: string
  count: number
  total: number
  payments: PaymentRecord[]
  pct: number
}

// ─── Component ─────────────────────────────────────────────────
export default function MonthlyReportClient({ visits, inspections, sales, expenses, wages }: Props) {
  const { year: todayYear, month: todayMonth } = getCurrentBaghdadYearMonth()
  const [year, setYear] = useState(todayYear)
  const [month, setMonth] = useState(todayMonth)

  // Track expanded worker rows in the payroll table
  const [expandedWorkers, setExpandedWorkers] = useState<Record<string, boolean>>({})
  const [expandAll, setExpandAll] = useState(false)

  const selectedKey = `${year}-${String(month).padStart(2, '0')}`

  // ── Month Navigation ─────────────────────────────────────────
  const goBack = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const goForward = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  // ── Filter Data for Selected Month (Asia/Baghdad) ────────────
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
  const mWages = useMemo(() =>
    wages.filter(w => getBaghdadMonthKey(w.created_at) === selectedKey),
    [wages, selectedKey]
  )

  // ── Worker Wages & Categorization ────────────────────────────
  const { workerSummaries, totalWagesAll, totalOtherExpenses, otherExpensesRows } = useMemo(() => {
    const map = new Map<string, { count: number; total: number; payments: PaymentRecord[] }>()

    const ensure = (name: string) => {
      if (!map.has(name)) map.set(name, { count: 0, total: 0, payments: [] })
      return map.get(name)!
    }

    // Initialize all canonical workers so they always exist
    for (const name of CANONICAL_WORKERS) {
      ensure(name)
    }

    // 1. Process daily_wages
    for (const w of mWages) {
      const matched = matchWorker({ ...w, recipientName: w.recipientName })
      const workerName = matched || 'أجور عمال أخرى (غير محدد الاسم)'
      const b = ensure(workerName)
      b.count++
      b.total += Number(w.amount) || 0
      b.payments.push({
        id: w.id,
        date: w.created_at,
        amount: Number(w.amount) || 0,
        description: w.description || 'أجر يومي',
        source: 'wage_entry',
      })
    }

    // 2. Process expenses
    const nonWageExpenses: ExpenseRow[] = []
    for (const e of mExpenses) {
      const matched = matchWorker(e)
      if (matched) {
        // Matched to a worker: count as wage payment for that worker
        const b = ensure(matched)
        b.count++
        b.total += Number(e.amount) || 0
        b.payments.push({
          id: e.id,
          date: e.created_at,
          amount: Number(e.amount) || 0,
          description: e.description || e.category || 'سلفة / أجر',
          source: 'expense_entry',
        })
      } else if (isWageExpenseItem(e)) {
        // Wage category but unassigned: count under unmatched wages
        const b = ensure('أجور عمال أخرى (غير محدد الاسم)')
        b.count++
        b.total += Number(e.amount) || 0
        b.payments.push({
          id: e.id,
          date: e.created_at,
          amount: Number(e.amount) || 0,
          description: e.description || e.category || 'سلفة / أجر غير محدد',
          source: 'expense_entry',
        })
      } else {
        // Operational expense
        nonWageExpenses.push(e)
      }
    }

    // Sort payments chronologically for each worker
    for (const [, b] of map) {
      b.payments.sort((a, z) => getBaghdadDateSortKey(a.date).localeCompare(getBaghdadDateSortKey(z.date)))
    }

    // Calculate grand total of all worker wages
    let sumWages = 0
    for (const [, b] of map) {
      sumWages += b.total
    }

    // Build the ordered summary list:
    // 1. Canonical workers first (always displayed)
    // 2. Any additional workers (e.g. كنان) if they have payments
    // 3. Catch-all 'أجور عمال أخرى (غير محدد الاسم)' if has payments
    const summaries: WorkerSummary[] = []

    for (const name of CANONICAL_WORKERS) {
      const b = map.get(name)!
      summaries.push({
        name,
        count: b.count,
        total: b.total,
        payments: b.payments,
        pct: sumWages > 0 ? Math.round((b.total / sumWages) * 100) : 0,
      })
    }

    // Additional workers
    for (const [name, b] of map.entries()) {
      if (
        !CANONICAL_WORKERS.includes(name as any) &&
        name !== 'أجور عمال أخرى (غير محدد الاسم)' &&
        b.count > 0
      ) {
        summaries.push({
          name,
          count: b.count,
          total: b.total,
          payments: b.payments,
          pct: sumWages > 0 ? Math.round((b.total / sumWages) * 100) : 0,
        })
      }
    }

    // Unmatched catch-all
    const unmatchedBucket = map.get('أجور عمال أخرى (غير محدد الاسم)')
    if (unmatchedBucket && unmatchedBucket.count > 0) {
      summaries.push({
        name: 'أجور عمال أخرى (غير محدد الاسم)',
        count: unmatchedBucket.count,
        total: unmatchedBucket.total,
        payments: unmatchedBucket.payments,
        pct: sumWages > 0 ? Math.round((unmatchedBucket.total / sumWages) * 100) : 0,
      })
    }

    const otherExpTotal = nonWageExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)

    return {
      workerSummaries: summaries,
      totalWagesAll: sumWages,
      totalOtherExpenses: otherExpTotal,
      otherExpensesRows: nonWageExpenses,
    }
  }, [mWages, mExpenses])

  // ── Financial Equation Totals ─────────────────────────────────
  const financialTotals = useMemo(() => {
    const visitRev = mVisits.reduce((s, v) => s + (v.total_amount ?? 0) + (v.labor_cost ?? 0), 0)
    const inspRev  = mInspections.reduce((s, i) => s + (i.inspection_fee ?? i.cost ?? 0), 0)
    const salesRev = mSales.reduce((s, x) => s + (x.selling_price ?? 0), 0)
    const totalIncome = visitRev + inspRev + salesRev

    const totalExpenses = totalWagesAll + totalOtherExpenses
    const netProfit = totalIncome - totalExpenses

    return {
      visitRev,
      inspRev,
      salesRev,
      totalIncome,
      totalWagesAll,
      totalOtherExpenses,
      totalExpenses,
      netProfit,
    }
  }, [mVisits, mInspections, mSales, totalWagesAll, totalOtherExpenses])

  // ── Technician Performance Breakdown ─────────────────────────
  const techBreakdown = useMemo(() => {
    const map = new Map<string, { visits: number; inspections: number; ecuSales: number; revenue: number }>()
    const ensure = (name: string) => {
      if (!map.has(name)) map.set(name, { visits: 0, inspections: 0, ecuSales: 0, revenue: 0 })
      return map.get(name)!
    }

    for (const v of mVisits) {
      const matched = matchWorker({ technician_name: v.technician_name }) || v.technician_name || 'غير محدد'
      const t = ensure(matched)
      t.visits++
      t.revenue += (v.total_amount ?? 0) + (v.labor_cost ?? 0)
    }
    for (const i of mInspections) {
      const matched = matchWorker({ technician_name: i.technician_name }) || i.technician_name || 'غير محدد'
      const t = ensure(matched)
      t.inspections++
      t.revenue += (i.inspection_fee ?? i.cost ?? 0)
    }
    for (const s of mSales) {
      const matched = matchWorker({ technician_name: s.technician_name }) || s.technician_name || 'غير محدد'
      const t = ensure(matched)
      if (s.ecu_id || s.item_type === 'ecu') t.ecuSales++
      t.revenue += s.selling_price ?? 0
    }

    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [mVisits, mInspections, mSales])

  // ── ECU Sales Summary ────────────────────────────────────────
  const ecuSummary = useMemo(() => {
    const ecuSales = mSales.filter(s => s.ecu_id || s.item_type === 'ecu')
    const unlockSales = mSales.filter(s => !s.ecu_id && s.item_type !== 'ecu')
    const modelMap = new Map<string, number>()
    for (const s of ecuSales) {
      const name = s.item_name || 'غير محدد'
      modelMap.set(name, (modelMap.get(name) ?? 0) + 1)
    }
    return {
      totalEcuSales: ecuSales.length,
      totalUnlockSales: unlockSales.length,
      topModels: Array.from(modelMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    }
  }, [mSales])

  // ── Expense Categories Breakdown ─────────────────────────────
  const expenseCategoryBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>()
    for (const e of otherExpensesRows) {
      const cat = e.category || 'أخرى'
      const item = map.get(cat) ?? { count: 0, total: 0 }
      item.count++
      item.total += Number(e.amount) || 0
      map.set(cat, item)
    }
    return Array.from(map.entries())
      .map(([category, d]) => ({ category, ...d }))
      .sort((a, b) => b.total - a.total)
  }, [otherExpensesRows])

  // ── Top Vehicles ─────────────────────────────────────────────
  const topVehicles = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of mVisits) {
      const key = ((v.vehicles as any)?.make_and_model || 'غير محدد').trim().split(/\s+/).slice(0, 2).join(' ')
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    const total = mVisits.length || 1
    return Array.from(map.entries())
      .map(([model, count]) => ({ model, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [mVisits])

  const label = monthLabel(year, month)
  const handlePrint = () => window.print()

  const toggleWorker = (name: string) => {
    setExpandedWorkers(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const toggleExpandAll = () => {
    const nextState = !expandAll
    setExpandAll(nextState)
    const updated: Record<string, boolean> = {}
    for (const w of workerSummaries) {
      updated[w.name] = nextState
    }
    setExpandedWorkers(updated)
  }

  const isWorkerExpanded = (name: string) => {
    if (expandAll) return true
    return !!expandedWorkers[name]
  }

  return (
    <>
      {/* ── Screen header & Month Navigation ─────────────────── */}
      <div className="no-print space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-violet-50 flex items-center justify-center">
                <FileBarChart2 size={24} className="text-violet-600" />
              </div>
              التقرير المالي والتشغيلي الشهري
            </h1>
            <p className="text-sm text-slate-500 mt-1">ورشة منتصر لكهرباء السيارات · تقرير تنفيذي شامل</p>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 transition-colors shadow-md shadow-violet-200 cursor-pointer"
          >
            <Printer size={18} />
            طباعة التقرير (A4)
          </button>
        </div>

        {/* Month Selector Buttons */}
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 w-fit shadow-sm">
          <button
            onClick={goBack}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
          >
            <ChevronRight size={16} />
            الشهر السابق
          </button>
          <span className="text-base font-bold text-violet-700 min-w-[140px] text-center font-mono">
            {label}
          </span>
          <button
            onClick={goForward}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
          >
            الشهر التالي
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          PRINTABLE CONTAINER
      ═══════════════════════════════════════════════════════ */}
      <div id="monthly-report-printable" dir="rtl" className="space-y-6">

        {/* Print Only Header */}
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

        {/* ═══════════════════════════════════════════════════════
            HERO: TOP FINANCIAL EQUATION BANNER (الخلاصة المالية)
        ═══════════════════════════════════════════════════════ */}
        <section className="report-card">
          <div className="rounded-3xl border-2 border-slate-200/90 bg-linear-to-br from-white via-slate-50/50 to-slate-100/60 p-5 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-200/70 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold">
                  ∑
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-bold text-slate-800">
                    الخلاصة المالية الصافية لشهر {label}
                  </h2>
                  <p className="text-xs text-slate-500">معادلة الأرباح الحقيقية للورشة (الدخل − الأجور − المصاريف)</p>
                </div>
              </div>
              <span className="text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1 rounded-full">
                Asia/Baghdad
              </span>
            </div>

            {/* 4 Connected Equation Stages */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-stretch">
              {/* Stage 1: Gross Income */}
              <div className="rounded-2xl p-4 bg-emerald-50/90 border border-emerald-200 text-emerald-950 flex flex-col justify-between relative">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-700 mb-1">
                    <span className="flex items-center gap-1">
                      <Plus size={14} className="text-emerald-600" /> إجمالي دخل الورشة
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">مقبوض</span>
                  </div>
                  <p className="text-xl md:text-2xl font-extrabold font-mono text-emerald-700 my-1">
                    {formatCurrency(financialTotals.totalIncome)}
                  </p>
                </div>
                <p className="text-[11px] text-emerald-700/80 pt-2 border-t border-emerald-200/60 leading-tight">
                  زيارات: {formatCurrency(financialTotals.visitRev)} · فحص: {formatCurrency(financialTotals.inspRev)} · مبيعات: {formatCurrency(financialTotals.salesRev)}
                </p>
              </div>

              {/* Stage 2: Total Wages */}
              <div className="rounded-2xl p-4 bg-amber-50/90 border border-amber-200 text-amber-950 flex flex-col justify-between relative">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-amber-700 mb-1">
                    <span className="flex items-center gap-1">
                      <Minus size={14} className="text-amber-600" /> مجموع أجور العمال
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">رواتب ويوميات</span>
                  </div>
                  <p className="text-xl md:text-2xl font-extrabold font-mono text-amber-700 my-1">
                    {formatCurrency(financialTotals.totalWagesAll)}
                  </p>
                </div>
                <p className="text-[11px] text-amber-700/80 pt-2 border-t border-amber-200/60 leading-tight">
                  مجموع ما استلمه أبو عبد الله، وسام، سلوم، صلاح، عبود، بكر، عمر، والجميع
                </p>
              </div>

              {/* Stage 3: Other Expenses */}
              <div className="rounded-2xl p-4 bg-rose-50/90 border border-rose-200 text-rose-950 flex flex-col justify-between relative">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-rose-700 mb-1">
                    <span className="flex items-center gap-1">
                      <Minus size={14} className="text-rose-600" /> الصرفيات والنثريات
                    </span>
                    <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">تشغيل وضيافة</span>
                  </div>
                  <p className="text-xl md:text-2xl font-extrabold font-mono text-rose-700 my-1">
                    {formatCurrency(financialTotals.totalOtherExpenses)}
                  </p>
                </div>
                <p className="text-[11px] text-rose-700/80 pt-2 border-t border-rose-200/60 leading-tight">
                  {otherExpensesRows.length} بند (أدوات، قطع، ضيافة، تشغيل ومواد)
                </p>
              </div>

              {/* Stage 4: Net Real Profit */}
              <div className={`rounded-2xl p-4 border-2 flex flex-col justify-between ${
                financialTotals.netProfit >= 0
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-200'
                  : 'bg-rose-600 text-white border-rose-700'
              }`}>
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-100 mb-1">
                    <span className="flex items-center gap-1">
                      <Equal size={14} /> صافي الربح الحقيقي
                    </span>
                    <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
                      الصافي بجيبك
                    </span>
                  </div>
                  <p className="text-2xl md:text-3xl font-black font-mono text-white my-1">
                    {formatCurrency(financialTotals.netProfit)}
                  </p>
                </div>
                <p className="text-[11px] text-white/90 pt-2 border-t border-white/20 leading-tight">
                  {formatCurrency(financialTotals.totalIncome)} − {formatCurrency(financialTotals.totalExpenses)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Quick operational counters ──────────────────────── */}
        <div className="grid grid-cols-3 gap-3 report-card print:gap-2">
          {[
            { label: 'سيارة صيانة منجزة', value: mVisits.length, icon: <Car size={20} />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
            { label: 'فحص كمبيوتر / عقول', value: mInspections.length, icon: <Stethoscope size={20} />, color: 'text-violet-600 bg-violet-50 border-violet-200' },
            { label: 'مبيعات عقول وملفات', value: mSales.length, icon: <ShoppingBag size={20} />, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
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

        {/* ═══════════════════════════════════════════════════════
            SECTION: COMPLETE WORKERS MONTHLY PAYROLL TABLE
        ═══════════════════════════════════════════════════════ */}
        <section className="report-card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 print:text-sm">
                <Banknote size={20} className="text-amber-500 no-print" />
                كشف رواتب ويوميات العمال للشهر
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                كشف الدفعات التفصيلية الكاملة لكل فني وعامل بالورشة خلال شهر {label}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                {workerSummaries.filter(w => w.count > 0).length} موظف مستلم · {workerSummaries.reduce((s, w) => s + w.count, 0)} دفعة
              </span>
              <button
                type="button"
                onClick={toggleExpandAll}
                className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-colors cursor-pointer"
              >
                {expandAll ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{expandAll ? 'إخفاء التفاصيل' : 'إظهار تفاصيل الكل 👁️'}</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:rounded-lg print:shadow-none">
            {/* Header banner */}
            <div className="px-5 py-3 bg-amber-50/80 border-b border-amber-200/70 flex items-center justify-between print:py-2">
              <span className="text-sm font-bold text-amber-900">
                إجمالي أجور ورواتب كل العمال لشهر {label}
              </span>
              <span className="font-mono font-extrabold text-amber-900 text-lg">
                {formatCurrency(financialTotals.totalWagesAll)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm print:text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="px-4 py-3 text-center font-semibold w-12">#</th>
                    <th className="px-4 py-3 text-right font-semibold">اسم العامل</th>
                    <th className="px-4 py-3 text-center font-semibold">عدد الدفعات / الأيام</th>
                    <th className="px-4 py-3 text-right font-semibold">المجموع الكلي المستلم</th>
                    <th className="px-4 py-3 text-center font-semibold">النسبة من إجمالي الأجور</th>
                    <th className="px-4 py-3 text-center font-semibold w-28 no-print">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workerSummaries.map((worker, idx) => {
                    const expanded = isWorkerExpanded(worker.name)
                    const hasPayments = worker.count > 0

                    return (
                      <tbody key={worker.name} className="divide-y divide-slate-100">
                        <tr
                          onClick={() => hasPayments && toggleWorker(worker.name)}
                          className={`transition-colors ${
                            hasPayments ? 'hover:bg-amber-50/30 cursor-pointer' : 'opacity-65'
                          } ${expanded ? 'bg-amber-50/20' : ''}`}
                        >
                          <td className="px-4 py-3 text-center">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-xs inline-flex items-center justify-center print:bg-transparent">
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-violet-400 no-print" />
                              <span>{worker.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {hasPayments ? (
                              <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                                {worker.count} {worker.count === 1 ? 'دفعة' : 'دفعات'}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">0 دفعة</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-base">
                            <span className={hasPayments ? 'text-amber-800' : 'text-slate-400'}>
                              {formatCurrency(worker.total)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {hasPayments ? (
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 bg-slate-100 rounded-full h-1.5 no-print">
                                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${worker.pct}%` }} />
                                </div>
                                <span className="text-xs font-bold text-amber-700">{worker.pct}٪</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center no-print">
                            {hasPayments ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleWorker(worker.name)
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                              >
                                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                <span>{expanded ? 'إخفاء' : 'عرض التفاصيل'}</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 text-xs">لا توجد</span>
                            )}
                          </td>
                        </tr>

                        {/* Expandable nested table of payments for this worker */}
                        {expanded && hasPayments && (
                          <tr className="bg-amber-50/15">
                            <td colSpan={6} className="px-4 py-3">
                              <div className="rounded-xl border border-amber-200/80 bg-white p-3 space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-amber-900 border-b border-slate-100 pb-2">
                                  <span>تفاصيل دفعات {worker.name} لشهر {label} ({worker.count} دفعة):</span>
                                  <span className="font-mono">{formatCurrency(worker.total)}</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {worker.payments.map((p, pIdx) => (
                                    <div
                                      key={p.id}
                                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                                    >
                                      <div className="min-w-0 pr-1">
                                        <div className="flex items-center gap-1 font-semibold text-slate-800">
                                          <span className="text-[10px] text-slate-400 font-mono">#{pIdx + 1}</span>
                                          <Calendar size={12} className="text-slate-400 shrink-0" />
                                          <span>{formatDayBaghdad(p.date)}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 truncate max-w-[170px]" title={p.description}>
                                          {p.description}
                                        </p>
                                      </div>
                                      <span className="font-mono font-bold text-amber-700 shrink-0">
                                        {formatCurrency(p.amount)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    )
                  })}
                </tbody>

                {/* Grand Total Footer */}
                <tfoot>
                  <tr className="border-t-2 border-amber-300 bg-amber-50/90 font-bold">
                    <td colSpan={2} className="px-4 py-3 text-amber-950 font-extrabold">
                      المجموع الكلي لأجور ورواتب العمال:
                    </td>
                    <td className="px-4 py-3 text-center text-slate-800">
                      {workerSummaries.reduce((s, w) => s + w.count, 0)} دفعة
                    </td>
                    <td className="px-4 py-3 font-mono font-black text-amber-950 text-base">
                      {formatCurrency(financialTotals.totalWagesAll)}
                    </td>
                    <td className="px-4 py-3 text-center text-amber-800">100٪</td>
                    <td className="no-print" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            SECTION: TECHNICIAN WORK PERFORMANCE
        ═══════════════════════════════════════════════════════ */}
        <section className="report-card">
          <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2 print:text-sm print:mb-2">
            <Wrench size={18} className="text-violet-500 no-print" />
            أداء الفنيين في الصيانة والفحوصات
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:rounded-lg print:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm print:text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="px-4 py-3 text-right font-semibold">اسم الفني</th>
                    <th className="px-4 py-3 text-center font-semibold">صيانة سيارات</th>
                    <th className="px-4 py-3 text-center font-semibold">فحوصات سريعة</th>
                    <th className="px-4 py-3 text-center font-semibold">مبيعات عقول</th>
                    <th className="px-4 py-3 text-right font-semibold">إجمالي الدخل المولد للورشة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {techBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                        لا توجد عمليات مسجلة لهذا الشهر
                      </td>
                    </tr>
                  ) : (
                    techBreakdown.map(t => (
                      <tr key={t.name} className="hover:bg-slate-50/60 transition-colors print:hover:bg-transparent">
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-violet-400 no-print" />
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
                      </tr>
                    ))
                  )}
                  {techBreakdown.length > 0 && (
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                      <td className="px-4 py-3 text-slate-700">الإجمالي</td>
                      <td className="px-4 py-3 text-center text-blue-700">{mVisits.length}</td>
                      <td className="px-4 py-3 text-center text-violet-700">{mInspections.length}</td>
                      <td className="px-4 py-3 text-center text-emerald-700">{ecuSummary.totalEcuSales}</td>
                      <td className="px-4 py-3 font-mono text-emerald-700">{formatCurrency(financialTotals.totalIncome)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            SECTION: ECU SALES & EXPENSE CATEGORIZATION
        ═══════════════════════════════════════════════════════ */}
        <section className="grid md:grid-cols-2 gap-4 print:gap-3 report-card">
          {/* ECU Store */}
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2 print:text-sm print:mb-2">
              <Cpu size={18} className="text-violet-500 no-print" />
              بنك العقول والمبيعات
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
                <span className="font-mono font-bold text-emerald-700">{formatCurrency(financialTotals.salesRev)}</span>
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

          {/* Operational Expenses Categorization */}
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2 print:text-sm print:mb-2">
              <TrendingDown size={18} className="text-rose-500 no-print" />
              تصنيف الصرفيات والنثريات الأخرى
            </h2>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:rounded-lg print:shadow-none">
              <table className="w-full text-sm print:text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="px-4 py-3 text-right font-semibold">التصنيف</th>
                    <th className="px-4 py-3 text-center font-semibold">العدد</th>
                    <th className="px-4 py-3 text-right font-semibold">المجموع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenseCategoryBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400 text-sm">
                        لا توجد مصروفات إضافية مسجلة
                      </td>
                    </tr>
                  ) : (
                    expenseCategoryBreakdown.map(e => (
                      <tr key={e.category} className="hover:bg-slate-50/60 print:hover:bg-transparent">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                            {e.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-600">{e.count}</td>
                        <td className="px-4 py-3 font-mono font-bold text-rose-700">{formatCurrency(e.total)}</td>
                      </tr>
                    ))
                  )}
                  {expenseCategoryBreakdown.length > 0 && (
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                      <td className="px-4 py-3 text-slate-700">الإجمالي</td>
                      <td className="px-4 py-3 text-center">{otherExpensesRows.length}</td>
                      <td className="px-4 py-3 font-mono text-rose-700">
                        {formatCurrency(financialTotals.totalOtherExpenses)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            SECTION: TOP VEHICLES
        ═══════════════════════════════════════════════════════ */}
        <section className="report-card">
          <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2 print:text-sm print:mb-2">
            <Car size={18} className="text-blue-500 no-print" />
            أكثر السيارات تكراراً في الورشة
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 print:p-3 print:rounded-lg print:shadow-none">
            {topVehicles.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">لا توجد بيانات سيارات لهذا الشهر</p>
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
                      <div className="w-full bg-slate-100 rounded-full h-1.5 no-print">
                        <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${v.pct}%` }} />
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
          <p className="text-xs text-slate-500">
            ورشة منتصر لكهرباء السيارات — {label} — التقرير المالي والتشغيلي المعتمد
          </p>
        </div>

      </div>
    </>
  )
}
