import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Car, Plus, Search } from 'lucide-react'
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
      *,
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
    { label: 'الكل', value: '' },
    { label: 'قيد الانتظار', value: 'Pending' },
    { label: 'قيد العمل', value: 'In Progress' },
    { label: 'مكتملة', value: 'Completed' },
    { label: 'تم التسليم', value: 'Delivered' },
  ]

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Car size={28} className="text-blue-400" />
            الزيارات
          </h1>
          <p className="text-slate-400 mt-1">{visits?.length ?? 0} زيارة</p>
        </div>
        <CreateVisitButton />
      </div>

      {/* Status filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {statuses.map(s => (
          <Link
            key={s.value}
            href={s.value ? `/visits?status=${s.value}` : '/visits'}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              (sp.status ?? '') === s.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* Visits list */}
      {!visits?.length ? (
        <div className="glass-card p-12 text-center text-slate-500">
          لا توجد زيارات
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map((visit: any) => (
            <Link
              key={visit.id}
              href={`/visits/${visit.id}`}
              className="glass-card p-5 flex items-center justify-between hover:border-blue-500/30 transition-all duration-200 block group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Car size={22} className="text-blue-400" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-200 group-hover:text-white transition-colors">
                    {visit.vehicles?.make_and_model ?? 'مركبة'}
                    <span className="font-mono text-slate-400 text-sm mr-2">
                      {visit.vehicles?.license_plate}
                    </span>
                  </p>
                  <p className="text-slate-400 text-sm">
                    {visit.vehicles?.customers?.name} · {visit.vehicles?.customers?.phone}
                  </p>
                  {visit.complaint && (
                    <p className="text-slate-500 text-xs truncate max-w-xs">{visit.complaint}</p>
                  )}
                  <p className="text-slate-600 text-xs">{formatDate(visit.entry_date)}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={visit.status} />
                <p className="text-emerald-400 font-bold">{formatCurrency(visit.total_amount)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
