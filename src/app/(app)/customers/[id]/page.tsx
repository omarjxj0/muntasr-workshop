import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Car, Phone, Plus, ArrowRight, Calendar, Hash } from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Visit } from '@/lib/types'
import AddVehicleForm from './AddVehicleForm'

interface Props { params: Promise<{ id: string }> }

export default async function CustomerProfilePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (!customer) notFound()

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .eq('customer_id', id)

  // Get all visits for this customer
  const vehicleIds = vehicles?.map(v => v.id) ?? []
  const { data: visits } = vehicleIds.length
    ? await supabase
        .from('visits')
        .select('*, vehicles(make_and_model, license_plate)')
        .in('vehicle_id', vehicleIds)
        .order('entry_date', { ascending: false })
    : { data: [] }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">
        <ArrowRight size={16} />
        العودة للبحث
      </Link>

      {/* Customer header */}
      <div className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-100">{customer.name}</h1>
          <p className="text-slate-400 flex items-center gap-2">
            <Phone size={15} />
            <span className="font-mono">{customer.phone}</span>
          </p>
          <p className="text-slate-500 text-sm flex items-center gap-2">
            <Calendar size={14} />
            عميل منذ: {formatDate(customer.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center bg-slate-800/60 rounded-xl px-5 py-3">
            <p className="text-2xl font-bold text-slate-100">{visits?.length ?? 0}</p>
            <p className="text-xs text-slate-400">زيارة</p>
          </div>
          <div className="text-center bg-slate-800/60 rounded-xl px-5 py-3">
            <p className="text-2xl font-bold text-slate-100">{vehicles?.length ?? 0}</p>
            <p className="text-xs text-slate-400">مركبة</p>
          </div>
        </div>
      </div>

      {/* Vehicles */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Car size={20} className="text-blue-400" />
            المركبات
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {vehicles?.map(vehicle => (
            <div key={vehicle.id} className="glass-card p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-100 text-lg">{vehicle.make_and_model}</p>
                  <p className="text-blue-400 font-mono text-sm mt-1">{vehicle.license_plate}</p>
                  {vehicle.chassis_number_vin && (
                    <p className="text-slate-500 text-xs flex items-center gap-1 mt-1">
                      <Hash size={12} />
                      {vehicle.chassis_number_vin}
                    </p>
                  )}
                </div>
              </div>
              <NewVisitButton vehicleId={vehicle.id} />
            </div>
          ))}
        </div>
        {/* Add vehicle form */}
        <AddVehicleForm customerId={id} />
      </section>

      {/* Visit History */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Calendar size={20} className="text-violet-400" />
          سجل الزيارات
        </h2>
        {!visits?.length ? (
          <div className="glass-card p-8 text-center text-slate-500">
            لا توجد زيارات بعد
          </div>
        ) : (
          <div className="space-y-3">
            {visits.map((visit: any) => (
              <Link
                key={visit.id}
                href={`/visits/${visit.id}`}
                className="glass-card p-4 flex items-center justify-between hover:border-blue-500/30 transition-all duration-200 block"
              >
                <div className="space-y-1">
                  <p className="font-semibold text-slate-200">
                    {(visit as any).vehicles?.make_and_model ?? 'مركبة'} —{' '}
                    {(visit as any).vehicles?.license_plate ?? ''}
                  </p>
                  {visit.complaint && (
                    <p className="text-slate-400 text-sm">{visit.complaint}</p>
                  )}
                  <p className="text-slate-500 text-xs">{formatDate(visit.entry_date)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={visit.status} />
                  <p className="text-emerald-400 font-semibold text-sm">
                    {formatCurrency(visit.total_amount)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// Inline new visit link (no client code needed - uses query param routing)
function NewVisitButton({ vehicleId }: { vehicleId: string }) {
  return (
    <Link
      href={`/visits/new?vehicleId=${vehicleId}`}
      className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-emerald-400 rounded-xl text-sm font-semibold transition-all"
    >
      <Plus size={16} />
      فتح زيارة جديدة
    </Link>
  )
}
