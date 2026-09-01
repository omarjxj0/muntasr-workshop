import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Car } from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { VisitStatus } from '@/lib/types'
import CreateVisitButton from './CreateVisitButton'

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('visits')
    .select(`
      id, status, entry_date, complaint, total_amount, labor_cost,
      vehicles (
        make_and_model,
        license_plate,
        customers ( name, phone )
      )
    `)
    .order('entry_date', { ascending: false })
    .limit(100)

  if (sp.status) {
    query = query.eq('status', sp.status as VisitStatus)
  }

  const { data: visits } = await query

  const statuses: { label: string; value: string }[] = [
    { label: 'الكل',          value: '' },
    { label: 'قيد الانتظار', value: 'Pending' },
    { label: 'قيد العمل',    value: 'In Progress' },
    { label: 'مكتملة',        value: 'Completed' },
    { label: 'تم التسليم',   value: 'Delivered' },
  ]

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Car size={28} className="text-violet-500" />
            الزيارات
          </h1>
          <p className="text-sm mt-1 text-slate-500">
            {visits?.length ?? 0} زيارة
          </p>
        </div>
        <CreateVisitButton />
      </div>

      {/* Status filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {statuses.map(s => (
          <Link
            key={s.value}
            href={s.value ? `/visits?status=${s.value}` : '/visits'}
            className={`px-4 py-2 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all ${
              (sp.status ?? '') === s.value
                ? 'text-white shadow-md'
                : 'bg-white text-slate-500 hover:text-violet-600 border-2 border-slate-200 hover:border-violet-200'
            }`}
            style={(sp.status ?? '') === s.value ? {
              background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
              boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
            } : {}}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* Visits list */}
      {!visits?.length ? (
        <div className="soft-card p-12 text-center text-slate-400">
          لا توجد زيارات
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map((visit: any) => {
            const grandTotal = (visit.total_amount ?? 0) + (visit.labor_cost ?? 0)
            return (
              <Link
                key={visit.id}
                href={`/visits/${visit.id}`}
                className="soft-card p-5 flex items-center justify-between hover:shadow-[0_8px_30px_rgba(124,58,237,0.15)] transition-all duration-200 block group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-violet-50 border-2 border-violet-100 flex items-center justify-center shrink-0">
                    <Car size={22} className="text-violet-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-700 group-hover:text-violet-700 transition-colors">
                      {visit.vehicles?.make_and_model ?? 'مركبة'}
                      <span className="font-mono text-sm mr-2 text-slate-400">
                        {visit.vehicles?.license_plate}
                      </span>
                    </p>
                    <p className="text-sm text-slate-500">
                      {visit.vehicles?.customers?.name} · {visit.vehicles?.customers?.phone}
                    </p>
                    {visit.complaint && (
                      <p className="text-xs truncate max-w-xs text-slate-400">{visit.complaint}</p>
                    )}
                    <p className="text-xs text-slate-400">{formatDate(visit.entry_date)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={visit.status} />
                  <p className="font-bold text-emerald-600">{formatCurrency(grandTotal)}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
