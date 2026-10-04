'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Flame, Car, Cpu, Wrench, Search, X, Calendar, DollarSign,
  CheckCircle2, Clock, Filter, Printer, ExternalLink, RefreshCw,
  TrendingUp, Activity, User, Phone, AlertCircle, ChevronLeft
} from 'lucide-react'
import {
  formatCurrency,
  formatTimeBaghdad,
  formatFullBaghdadDate,
  cn,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_COLORS,
} from '@/lib/utils'
import { TECHNICIANS } from '@/lib/constants'
import type { VisitStatus, UserRole } from '@/lib/types'

export interface DailyVisitItem {
  id: string
  entry_date: string
  delivered_at?: string | null
  completed_at?: string | null
  status: VisitStatus
  complaint: string | null
  labor_cost: number
  total_amount: number
  technician_name: string | null
  vehicles?: {
    make_and_model: string
    license_plate: string
    customers?: {
      name: string
      phone: string
    } | null
  } | null
}

export interface DailyInspectionItem {
  id: string
  type: 'car' | 'ecu'
  customer_name: string
  phone: string | null
  subject: string | null
  fault_codes: string | null
  technician_name: string | null
  inspection_fee: number
  created_at: string
  image_paths?: any
  notes?: string | null
  status?: string | null
}

export interface UnifiedOperation {
  id: string
  kind: 'visit' | 'inspection_car' | 'inspection_ecu'
  kindLabel: string
  customerName: string
  customerPhone: string | null
  vehicleOrSubject: string
  licensePlate: string | null
  technicianName: string
  amount: number
  timestamp: string
  timeFormatted: string
  statusText: string
  statusVariant: 'success' | 'warning' | 'info' | 'neutral'
  detailsHref?: string
  rawItem: DailyVisitItem | DailyInspectionItem
}

interface Props {
  role: UserRole
  initialVisits: DailyVisitItem[]
  initialInspections: DailyInspectionItem[]
}

export default function DailyShiftClient({ role, initialVisits, initialInspections }: Props) {
  const [selectedTech, setSelectedTech] = useState<string | null>(null)
  const [filterKind, setFilterKind] = useState<'all' | 'visit' | 'inspection'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [previewInspection, setPreviewInspection] = useState<DailyInspectionItem | null>(null)

  // Map visits and inspections into UnifiedOperation array
  const allOperations: UnifiedOperation[] = useMemo(() => {
    const list: UnifiedOperation[] = []

    // 1. Visits
    for (const v of initialVisits) {
      const isDeliveredOrCompleted = v.status === 'Completed' || v.status === 'Delivered'
      // Overnight cars staying in the workshop contribute 0 cash today!
      const grandTotal = isDeliveredOrCompleted
        ? (Number(v.labor_cost) || 0) + (Number(v.total_amount) || 0)
        : 0

      const hasPlate = v.vehicles?.license_plate && !['—', '-', ''].includes(v.vehicles.license_plate.trim())
      const plate = hasPlate ? v.vehicles?.license_plate ?? null : null

      let statusVariant: UnifiedOperation['statusVariant'] = 'info'
      let statusText = VISIT_STATUS_LABELS[v.status] || v.status
      let kindLabel = 'زيارة صيانة'

      if (isDeliveredOrCompleted) {
        statusVariant = 'success'
        kindLabel = v.status === 'Delivered' ? 'زيارة مسلّمة' : 'زيارة مكتملة'
      } else if (v.status === 'In Progress') {
        statusVariant = 'warning'
        statusText = 'قيد العمل (بايتة)'
        kindLabel = 'سيارة بايتة'
      } else {
        statusVariant = 'neutral'
        statusText = 'قيد الانتظار (بايتة)'
        kindLabel = 'سيارة بايتة'
      }

      const timestamp = (isDeliveredOrCompleted ? (v.delivered_at || v.completed_at) : null) || v.entry_date

      list.push({
        id: v.id,
        kind: 'visit',
        kindLabel,
        customerName: v.vehicles?.customers?.name || 'زبون غير مسجل',
        customerPhone: v.vehicles?.customers?.phone || null,
        vehicleOrSubject: v.vehicles?.make_and_model || 'مركبة غير محددة',
        licensePlate: plate,
        technicianName: v.technician_name?.trim() || 'غير محدد',
        amount: grandTotal,
        timestamp,
        timeFormatted: formatTimeBaghdad(timestamp),
        statusText,
        statusVariant,
        detailsHref: `/visits/${v.id}`,
        rawItem: v,
      })
    }

    // 2. Quick Inspections
    for (const qi of initialInspections) {
      const isCar = qi.type !== 'ecu'
      list.push({
        id: qi.id,
        kind: isCar ? 'inspection_car' : 'inspection_ecu',
        kindLabel: isCar ? 'فحص سيارة' : 'فحص عقل ECU',
        customerName: qi.customer_name || 'زبون فحص',
        customerPhone: qi.phone || null,
        vehicleOrSubject: qi.subject || (isCar ? 'فحص كمبيوتر' : 'فحص على البنش'),
        licensePlate: null,
        technicianName: qi.technician_name?.trim() || 'غير محدد',
        amount: Number(qi.inspection_fee) || 0,
        timestamp: qi.created_at,
        timeFormatted: formatTimeBaghdad(qi.created_at),
        statusText: 'فحص مكتمل',
        statusVariant: 'success',
        rawItem: qi,
      })
    }

    // Sort descending by time
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [initialVisits, initialInspections])

  // Summary Metrics
  const totalOperationsCount = allOperations.length
  const totalVisitsCount = initialVisits.length
  const totalInspectionsCount = initialInspections.length

  const deliveredVisitsCount = useMemo(() => {
    return initialVisits.filter(v => v.status === 'Completed' || v.status === 'Delivered').length
  }, [initialVisits])

  const overnightVisitsCount = useMemo(() => {
    return initialVisits.filter(v => v.status === 'Pending' || v.status === 'In Progress').length
  }, [initialVisits])

  // Grand Total Revenue collected / recorded today (strictly delivered visits + inspection fees)
  const totalRevenueToday = useMemo(() => {
    return allOperations.reduce((sum, op) => sum + (op.amount || 0), 0)
  }, [allOperations])

  const visitsRevenueToday = useMemo(() => {
    return initialVisits.reduce((sum, v) => {
      if (v.status === 'Completed' || v.status === 'Delivered') {
        return sum + ((Number(v.labor_cost) || 0) + (Number(v.total_amount) || 0))
      }
      return sum
    }, 0)
  }, [initialVisits])

  const inspectionsRevenueToday = useMemo(() => {
    return initialInspections.reduce((sum, qi) => sum + (Number(qi.inspection_fee) || 0), 0)
  }, [initialInspections])

  // Technician Breakdown Calculation
  const technicianStats = useMemo(() => {
    const stats: Record<string, { count: number; totalAmount: number; visits: number; inspections: number }> = {}

    // Initialize with all workshop technicians
    for (const tech of TECHNICIANS) {
      stats[tech] = { count: 0, totalAmount: 0, visits: 0, inspections: 0 }
    }
    // Also track unassigned if any
    stats['غير محدد'] = { count: 0, totalAmount: 0, visits: 0, inspections: 0 }

    for (const op of allOperations) {
      const name = op.technicianName || 'غير محدد'
      if (!stats[name]) {
        stats[name] = { count: 0, totalAmount: 0, visits: 0, inspections: 0 }
      }
      stats[name].count += 1
      stats[name].totalAmount += op.amount
      if (op.kind === 'visit') stats[name].visits += 1
      else stats[name].inspections += 1
    }

    // Convert to array and sort by active contribution
    const list = Object.entries(stats).map(([name, data]) => ({
      name,
      ...data,
    }))

    // Keep active technicians first, then by count descending
    return list.sort((a, b) => {
      if (a.name === 'غير محدد' && b.name !== 'غير محدد') return 1
      if (b.name === 'غير محدد' && a.name !== 'غير محدد') return -1
      if (b.count !== a.count) return b.count - a.count
      return b.totalAmount - a.totalAmount
    })
  }, [allOperations])

  // Filtered Unified Operations
  const filteredOperations = useMemo(() => {
    return allOperations.filter(op => {
      // Tech filter
      if (selectedTech && op.technicianName !== selectedTech) {
        return false
      }

      // Kind filter
      if (filterKind === 'visit' && op.kind !== 'visit') return false
      if (filterKind === 'inspection' && op.kind === 'visit') return false

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const match =
          op.customerName.toLowerCase().includes(q) ||
          (op.customerPhone && op.customerPhone.includes(q)) ||
          op.vehicleOrSubject.toLowerCase().includes(q) ||
          (op.licensePlate && op.licensePlate.toLowerCase().includes(q)) ||
          op.technicianName.toLowerCase().includes(q) ||
          op.kindLabel.toLowerCase().includes(q)
        if (!match) return false
      }

      return true
    })
  }, [allOperations, selectedTech, filterKind, searchQuery])

  const handlePrintReport = () => {
    window.print()
  }

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg text-white"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 8px 24px rgba(245,158,11,0.35)' }}
            >
              <Flame size={26} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
                  شغل اليوم · سجل العمل اليومي
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  مباشر · توقيت بغداد
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 flex items-center gap-2">
                <Calendar size={14} className="text-amber-500" />
                <span>{formatFullBaghdadDate()}</span>
                <span>•</span>
                <span>توزيع المهام ومحاسبة الشفت اليومي</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-auto">
          <button
            onClick={handlePrintReport}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
          >
            <Printer size={16} className="text-slate-500" />
            طباعة تقرير الشفت
          </button>
          <Link
            href="/inspections"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-all shadow-sm"
          >
            فحص سريع +
          </Link>
          <Link
            href="/visits"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl btn-gradient text-white text-sm font-semibold transition-all shadow-sm"
          >
            الزيارات +
          </Link>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Revenue Today */}
        <div className="soft-card p-5 relative overflow-hidden border-2 border-emerald-100 hover:border-emerald-300 transition-all shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              دخل اليوم المباشر
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <DollarSign size={20} />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">إجمالي دخل اليوم المحصل</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-1 font-mono tracking-tight">
              {formatCurrency(totalRevenueToday)}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-2">
              <span>زيارات: {formatCurrency(visitsRevenueToday)}</span>
              <span>•</span>
              <span>فحوصات: {formatCurrency(inspectionsRevenueToday)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Operations Today */}
        <div className="soft-card p-5 relative overflow-hidden border-2 border-violet-100 hover:border-violet-300 transition-all shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-200">
              عمليات اليوم
            </span>
            <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-600/20">
              <Car size={20} />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">عدد سيارات وعمليات اليوم</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-violet-700 mt-1">
              {totalOperationsCount} <span className="text-base font-normal text-slate-500">عملية</span>
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-2">
              <span>{totalVisitsCount} زيارة صيانة</span>
              <span>•</span>
              <span>{totalInspectionsCount} فحص سريع</span>
            </div>
          </div>
        </div>

        {/* Card 3: Visits Count & Settlement */}
        <div className="soft-card p-5 relative overflow-hidden border-2 border-sky-100 hover:border-sky-300 transition-all shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
              زيارات الصيانة
            </span>
            <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
              <Wrench size={20} />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">سيارات مسلّمة اليوم</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-sky-700 mt-1">
              {deliveredVisitsCount} <span className="text-base font-normal text-slate-500">مسلّمة</span>
            </p>
            <div className="flex flex-col gap-0.5 text-[11px] text-slate-500 mt-2">
              <p>
                إيراد التسليم: <span className="font-semibold text-sky-800">{formatCurrency(visitsRevenueToday)}</span>
              </p>
              {overnightVisitsCount > 0 && (
                <p className="text-amber-600 font-semibold">
                  • {overnightVisitsCount} سيارة بايتة قيد العمل
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Inspections Count */}
        <div className="soft-card p-5 relative overflow-hidden border-2 border-amber-100 hover:border-amber-300 transition-all shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              الفحوصات السريعة
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Activity size={20} />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">فحوصات كمبيوتر وعقول اليوم</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-700 mt-1">
              {totalInspectionsCount} <span className="text-base font-normal text-slate-500">فحص</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-2">
              رسوم الفحوصات: <span className="font-semibold text-amber-800">{formatCurrency(inspectionsRevenueToday)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Technician Breakdown Section */}
      <div className="soft-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wrench size={20} className="text-amber-500" />
            <h2 className="text-lg font-bold text-slate-800">
              توزيع شغل اليوم على الفنيين
            </h2>
            <span className="text-xs text-slate-400">
              (انقر على اسم الفني لفلترة العمليات)
            </span>
          </div>
          {selectedTech && (
            <button
              onClick={() => setSelectedTech(null)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-100 transition-colors w-fit"
            >
              <X size={13} />
              إلغاء فلترة الفني ({selectedTech})
            </button>
          )}
        </div>

        {/* Technician Cards / Interactive Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {/* "All" button */}
          <button
            type="button"
            onClick={() => setSelectedTech(null)}
            className={cn(
              'p-3 rounded-2xl border-2 text-right transition-all flex flex-col justify-between cursor-pointer',
              selectedTech === null
                ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/20 scale-[1.02]'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            )}
          >
            <div className="text-xs font-bold">جميع الفنيين</div>
            <div className="mt-2">
              <div className={cn('text-lg font-extrabold', selectedTech === null ? 'text-white' : 'text-slate-800')}>
                {totalOperationsCount} <span className="text-xs font-normal">عملية</span>
              </div>
              <div className={cn('text-[11px] font-mono mt-0.5 truncate', selectedTech === null ? 'text-amber-100' : 'text-emerald-600 font-bold')}>
                {formatCurrency(totalRevenueToday)}
              </div>
            </div>
          </button>

          {/* Each Technician */}
          {technicianStats.map(tech => {
            const isSelected = selectedTech === tech.name
            const hasWork = tech.count > 0

            return (
              <button
                key={tech.name}
                type="button"
                onClick={() => setSelectedTech(isSelected ? null : tech.name)}
                className={cn(
                  'p-3 rounded-2xl border-2 text-right transition-all flex flex-col justify-between cursor-pointer group',
                  isSelected
                    ? 'bg-violet-600 text-white border-violet-700 shadow-md shadow-violet-600/30 scale-[1.02]'
                    : hasWork
                    ? 'bg-white hover:border-amber-400 text-slate-800 border-amber-200/80 shadow-sm'
                    : 'bg-slate-50/70 hover:bg-white text-slate-400 border-slate-100'
                )}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className={cn('text-xs font-bold truncate', isSelected ? 'text-white' : hasWork ? 'text-slate-800' : 'text-slate-400')}>
                    {tech.name}
                  </span>
                  {hasWork && (
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                      isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                    )}>
                      {tech.count}
                    </span>
                  )}
                </div>

                <div className="mt-2">
                  <div className={cn('text-sm font-extrabold', isSelected ? 'text-white' : hasWork ? 'text-slate-800' : 'text-slate-400')}>
                    {tech.count} <span className="text-[11px] font-normal">سيارات</span>
                  </div>
                  <div className={cn(
                    'text-[11px] font-mono mt-0.5 font-bold truncate',
                    isSelected ? 'text-violet-100' : hasWork ? 'text-emerald-600' : 'text-slate-300'
                  )}>
                    {formatCurrency(tech.totalAmount)}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Unified Daily Feed Section */}
      <div className="soft-card p-6 space-y-5">
        {/* Controls: Search, Filter Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span>سجل شفت اليوم الموحد</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {filteredOperations.length} عملية
              </span>
            </h2>

            {/* Quick kind filter tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
              <button
                onClick={() => setFilterKind('all')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  filterKind === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                الكل ({allOperations.length})
              </button>
              <button
                onClick={() => setFilterKind('visit')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  filterKind === 'visit' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                زيارات صيانة ({totalVisitsCount})
              </button>
              <button
                onClick={() => setFilterKind('inspection')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  filterKind === 'inspection' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                فحوصات سريعة ({totalInspectionsCount})
              </button>
            </div>
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث: الزبون، السيارة، الفني..."
              className="w-full pr-10 pl-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Alert Banner */}
        {selectedTech && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs font-semibold">
            <span>
              عرض عمليات الفني <strong className="font-bold underline">{selectedTech}</strong> فقط ({filteredOperations.length} عملية بإجمالي {formatCurrency(filteredOperations.reduce((s, o) => s + o.amount, 0))})
            </span>
            <button
              onClick={() => setSelectedTech(null)}
              className="text-amber-700 hover:underline flex items-center gap-1"
            >
              عرض الكل <X size={12} />
            </button>
          </div>
        )}

        {/* Feed List */}
        {filteredOperations.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-400 flex items-center justify-center mx-auto border border-amber-100">
              <Flame size={28} />
            </div>
            <p className="text-base font-bold text-slate-700">لا توجد عمليات مطابقة لليوم</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery || selectedTech || filterKind !== 'all'
                ? 'جرب تغيير معايير البحث أو الفلترة'
                : 'لم يتم تسجيل أي زيارات أو فحوصات سريعة حتى الآن في شفت اليوم.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 bg-slate-50/60">
                  <th className="py-3 px-3 w-14">#</th>
                  <th className="py-3 px-3">نوع العملية</th>
                  <th className="py-3 px-3">الزبون والمركبة</th>
                  <th className="py-3 px-3">الفني المسؤول</th>
                  <th className="py-3 px-3 font-mono">المبلغ (IQD)</th>
                  <th className="py-3 px-3">الوقت</th>
                  <th className="py-3 px-3 text-left">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredOperations.map((op, idx) => {
                  const isVisit = op.kind === 'visit'
                  const isCarInsp = op.kind === 'inspection_car'

                  return (
                    <tr
                      key={`${op.kind}-${op.id}`}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* # Counter */}
                      <td className="py-3.5 px-3 font-mono text-xs font-bold text-slate-400">
                        #{idx + 1}
                      </td>

                      {/* Operation Type */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap',
                              isVisit
                                ? 'bg-violet-50 text-violet-700 border border-violet-200'
                                : isCarInsp
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : 'bg-teal-50 text-teal-700 border border-teal-200'
                            )}
                          >
                            {isVisit ? <Car size={13} /> : isCarInsp ? <Search size={13} /> : <Cpu size={13} />}
                            {op.kindLabel}
                          </span>
                        </div>
                      </td>

                      {/* Customer & Vehicle */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800">{op.vehicleOrSubject}</span>
                            {op.licensePlate && (
                              <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                                {op.licensePlate}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span>{op.customerName}</span>
                            {op.customerPhone && (
                              <span className="font-mono text-slate-400" dir="ltr">
                                {op.customerPhone}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Technician */}
                      <td className="py-3.5 px-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap',
                            op.technicianName !== 'غير محدد'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-400 border border-slate-200'
                          )}
                        >
                          <Wrench size={11} className={op.technicianName !== 'غير محدد' ? 'text-amber-600' : 'text-slate-400'} />
                          {op.technicianName}
                        </span>
                      </td>

                      {/* Amount IQD */}
                      <td className="py-3.5 px-3 font-mono font-bold whitespace-nowrap">
                        {isVisit && (op.rawItem as DailyVisitItem).status !== 'Completed' && (op.rawItem as DailyVisitItem).status !== 'Delivered' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            بايتة (تُحصّل عند التسليم)
                          </span>
                        ) : op.amount > 0 ? (
                          <span className="text-emerald-600 font-extrabold">{formatCurrency(op.amount)}</span>
                        ) : (
                          <span className="text-slate-400 font-normal">0 IQD</span>
                        )}
                      </td>

                      {/* Time */}
                      <td className="py-3.5 px-3 text-xs text-slate-500 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" />
                          {op.timeFormatted}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-3 text-left">
                        {isVisit ? (
                          <Link
                            href={op.detailsHref!}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors"
                          >
                            فتح الزيارة
                            <ChevronLeft size={13} />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPreviewInspection(op.rawItem as DailyInspectionItem)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors cursor-pointer"
                          >
                            عرض الفحص
                            <ChevronLeft size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Inspection Preview Modal */}
      {previewInspection && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setPreviewInspection(null)}
        >
          <div
            className="soft-card bg-white p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                  {previewInspection.type === 'car' ? <Car size={18} /> : <Cpu size={18} />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800">
                    {previewInspection.type === 'car' ? 'تفاصيل فحص السيارة' : 'تفاصيل فحص عقل ECU'}
                  </h3>
                  <p className="text-xs text-slate-400">سجل الفحوصات السريعة</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewInspection(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">اسم الزبون:</span>
                  <span className="font-bold text-slate-800">{previewInspection.customer_name}</span>
                </div>
                {previewInspection.phone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-xs">الهاتف:</span>
                    <span className="font-mono text-slate-700" dir="ltr">{previewInspection.phone}</span>
                  </div>
                )}
                {previewInspection.subject && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-xs">نوع الفحص / الموديل:</span>
                    <span className="font-semibold text-slate-800">{previewInspection.subject}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">الفني المسؤول:</span>
                  <span className="font-bold text-amber-700">🔧 {previewInspection.technician_name || 'غير محدد'}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500 text-xs">أجور الفحص:</span>
                  <span className="font-mono font-bold text-emerald-600">{formatCurrency(previewInspection.inspection_fee)}</span>
                </div>
              </div>

              {previewInspection.fault_codes && (
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
                  <div className="text-xs font-bold text-rose-700 mb-1 flex items-center gap-1">
                    <AlertCircle size={13} />
                    رموز وتفاصيل الأعطال:
                  </div>
                  <pre className="text-xs text-slate-800 font-mono whitespace-pre-wrap">
                    {previewInspection.fault_codes}
                  </pre>
                </div>
              )}

              {previewInspection.notes && (
                <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600">
                  <span className="font-bold block mb-0.5">ملاحظات:</span>
                  {previewInspection.notes}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-between">
              <Link
                href="/inspections"
                className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1"
              >
                فتح سجل الفحوصات السريعة <ExternalLink size={12} />
              </Link>
              <button
                type="button"
                onClick={() => setPreviewInspection(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
