'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ArrowLeft, ChevronDown, ChevronUp, Cpu, Barcode, Hash } from 'lucide-react'

interface EcuItem {
  id: string
  name?: string | null
  barcode?: string | null
  symbols_codes?: string | null
  stock_quantity?: number | null
  min_quantity?: number | null
  manufacturer?: string | null
  ecu_family?: string | null
  vehicle_model_code?: string | null
  software_id?: string | null
}

interface GroupedLowStock {
  key: string
  title: string
  subtitle: string
  totalStock: number
  minQuantity: number
  items: EcuItem[]
}

export default function DashboardLowStock({ allEcus }: { allEcus: EcuItem[] }) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  const lowStockGroups = useMemo(() => {
    const groupsMap = new Map<string, GroupedLowStock>()

    for (const item of allEcus || []) {
      const mfr = (item.manufacturer || '').trim()
      const fam = (item.ecu_family || '').trim()
      const mc  = (item.vehicle_model_code || '').trim()
      const sw  = (item.software_id || '').trim()

      let groupKey = ''
      let title = ''
      let subtitle = ''

      if (mfr || fam || mc || sw) {
        groupKey = `hier::${mfr.toLowerCase()}::${fam.toLowerCase()}::${mc.toLowerCase()}::${sw.toLowerCase()}`
        // Main type display e.g. "SIM2K-141 NF 39100-2G351"
        title = [fam, mc, sw].filter(Boolean).join(' ') || item.name || 'عقل محرك'
        subtitle = [mfr, fam, mc, sw].filter(Boolean).join(' › ')
      } else {
        groupKey = `name::${(item.name || 'unclassified').trim().toLowerCase()}`
        title = item.name || 'صنف غير محدد'
        subtitle = 'صنف عام'
      }

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          key: groupKey,
          title,
          subtitle,
          totalStock: 0,
          minQuantity: 3,
          items: [],
        })
      }

      const g = groupsMap.get(groupKey)!
      g.items.push(item)
      g.totalStock += Number(item.stock_quantity) || 0
      const itemMin = Number(item.min_quantity)
      if (!isNaN(itemMin) && itemMin > g.minQuantity) {
        g.minQuantity = itemMin
      }
    }

    // Filter to only groups that reached min_quantity or ran out
    return Array.from(groupsMap.values()).filter(g => g.totalStock <= g.minQuantity)
  }, [allEcus])

  return (
    <div className="soft-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            lowStockGroups.length > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            {lowStockGroups.length > 0 ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              نواقص المخزون
              {lowStockGroups.length > 0 && (
                <span className="bg-rose-100 text-rose-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {lowStockGroups.length} نوع عقل
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              أنواع العقول الرئيسية المجمّعة التي وصلت للحد الأدنى أو نفدت (انقر لعرض الوحدات/VINs)
            </p>
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

      {/* Content */}
      {lowStockGroups.length === 0 ? (
        <div className="py-8 flex flex-col items-center justify-center text-center bg-emerald-50/50 rounded-2xl border border-emerald-100/60 p-4">
          <CheckCircle2 size={32} className="text-emerald-500 mb-2" />
          <p className="font-bold text-emerald-800 text-sm">المخزون متوفر بالكامل</p>
          <p className="text-xs text-emerald-600/80 mt-0.5">جميع فئات العقول الرئيسية أعلى من الحد الأدنى المحدد</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lowStockGroups.map(group => {
            const isExpanded = expandedGroup === group.key

            return (
              <div
                key={group.key}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isExpanded
                    ? 'border-violet-300 bg-white shadow-md'
                    : 'border-slate-100 bg-slate-50/80 hover:border-violet-200 hover:bg-white'
                }`}
              >
                {/* Main Card Header (Click to Expand) */}
                <button
                  type="button"
                  onClick={() => setExpandedGroup(isExpanded ? null : group.key)}
                  className="w-full text-right p-4 flex items-start justify-between gap-3 select-none"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Cpu size={16} className="text-violet-500 shrink-0" />
                      <p className="font-bold text-slate-800 text-sm truncate">{group.title}</p>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-1 mr-6" dir="ltr">
                      {group.subtitle}
                    </p>
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-1.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      group.totalStock === 0
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {group.totalStock === 0 ? 'نفد (0)' : `متبقي ${group.totalStock} وحدة`}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      الحد: {group.minQuantity} · {group.items.length} قطع
                    </span>
                  </div>

                  <div className="mt-1 text-slate-400 hover:text-slate-600">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* Expanded Individual Units / VINs / Barcodes */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-violet-50/30 space-y-2 text-xs">
                    <p className="font-semibold text-slate-600 flex items-center gap-1.5 text-[11px]">
                      <Hash size={12} className="text-violet-500" />
                      الوحدات الفردية والباركود المسجل:
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {group.items.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-slate-700"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-mono font-medium text-slate-800 truncate flex items-center gap-1">
                              <Barcode size={13} className="text-slate-400 shrink-0" />
                              {item.barcode || 'بدون باركود'}
                            </p>
                            {item.symbols_codes && (
                              <p className="text-[10px] text-slate-400 truncate">
                                الرمز: {item.symbols_codes}
                              </p>
                            )}
                          </div>
                          <span className="font-bold text-slate-600 shrink-0 bg-slate-100 px-2 py-0.5 rounded-lg text-[11px]">
                            الكمية: {item.stock_quantity ?? 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
