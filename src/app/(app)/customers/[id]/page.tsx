import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Car, Phone, MapPin, Plus, ArrowRight, Calendar, Hash } from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Visit } from '@/lib/types'
import AddVehicleForm from './AddVehicleForm'
import EditCustomerModal from './EditCustomerModal'
import DeleteCustomerButton from './DeleteCustomerButton'

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

  // Get all visits for this customer's vehicles
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
      <Link
        href="/customers"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-violet-600 transition-colors font-medium"
      >
        <ArrowRight size={16} />
        العودة للزبائن
      </Link>

      {/* Customer header */}
      <div className="soft-card p-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-800">{customer.name}</h1>
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Phone size={15} />
            <span className="font-mono">{customer.phone}</span>
          </p>
          {(customer as any).address && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <MapPin size={14} />
              {(customer as any).address}
            </p>
          )}
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar size={13} />
            زبون منذ: {formatDate(customer.created_at)}
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-3">
            <div className="text-center rounded-2xl px-5 py-3 bg-violet-50 border border-violet-100">
              <p className="text-2xl font-bold text-violet-700">{visits?.length ?? 0}</p>
              <p className="text-xs text-violet-500">زيارة</p>
            </div>
            <div className="text-center rounded-2xl px-5 py-3 bg-pink-50 border border-pink-100">
              <p className="text-2xl font-bold text-pink-700">{vehicles?.length ?? 0}</p>
              <p className="text-xs text-pink-500">مركبة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <EditCustomerModal
              customerId={id}
              initialName={customer.name}
              initialPhone={customer.phone}
              initialAddress={(customer as any).address ?? ''}
            />
            <DeleteCustomerButton customerId={id} customerName={customer.name} />
          </div>
        </div>
      </div>

      {/* Vehicles section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <Car size={20} className="text-violet-500" />
            المركبات
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {vehicles?.map(vehicle => (
            <div key={vehicle.id} className="soft-card p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-lg text-slate-800">{vehicle.make_and_model}</p>
                  <p className="font-mono text-sm mt-1 text-violet-600">{vehicle.license_plate}</p>
                  {vehicle.chassis_number_vin && (
                    <p className="text-xs flex items-center gap-1 mt-1 text-slate-400">
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
        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
          <Calendar size={20} className="text-pink-500" />
          سجل الزيارات
        </h2>
        {!visits?.length ? (
          <div className="soft-card p-8 text-center text-slate-400">
            لا توجد زيارات بعد
          </div>
        ) : (
          <div className="space-y-3">
            {visits.map((visit: any) => (
              <Link
                key={visit.id}
                href={`/visits/${visit.id}`}
                className="soft-card p-4 flex items-center justify-between hover:shadow-[0_8px_30px_rgba(124,58,237,0.15)] transition-all duration-200 block"
              >
                <div className="space-y-1">
                  <p className="font-semibold text-slate-700">
                    {visit.vehicles?.make_and_model ?? 'مركبة'} —{' '}
                    {visit.vehicles?.license_plate ?? ''}
                  </p>
                  {visit.complaint && (
                    <p className="text-sm text-slate-500">{visit.complaint}</p>
                  )}
                  <p className="text-xs text-slate-400">{formatDate(visit.entry_date)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={visit.status} />
                  <p className="font-semibold text-sm text-emerald-600">
                    {formatCurrency((visit.total_amount || 0) + (visit.labor_cost || 0))}
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

/* Inline "New Visit" button */
function NewVisitButton({ vehicleId }: { vehicleId: string }) {
  return (
    <Link
      href={`/visits/new?vehicleId=${vehicleId}`}
      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl text-sm font-semibold transition-all text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-100 hover:border-emerald-200"
    >
      <Plus size={16} />
      فتح زيارة جديدة
    </Link>
  )
}
