'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BarcodeScanner from '@/components/BarcodeScanner'
import StatusBadge from '@/components/StatusBadge'
import {
  Car, Phone, Trash2, DollarSign, FileText, ArrowRight, Scan, Package
} from 'lucide-react'
import { formatDate, formatCurrency, VISIT_STATUS_LABELS } from '@/lib/utils'
import type { VisitStatus, UserRole } from '@/lib/types'
import toast from 'react-hot-toast'

interface Props {
  visitId: string
  role: UserRole
}

const ALL_STATUSES: VisitStatus[] = ['Pending', 'In Progress', 'Completed', 'Delivered']

export default function VisitDetailClient({ visitId, role }: Props) {
  const [visit, setVisit] = useState<any>(null)
  const [vehicle, setVehicle] = useState<any>(null)
  const [customer, setCustomer] = useState<any>(null)
  const [parts, setParts] = useState<any[]>([])
  const [complaint, setComplaint] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const loadVisit = useCallback(async () => {
    const { data } = await supabase.from('visits').select('*').eq('id', visitId).single() as { data: any }
    if (data) { setVisit(data); setComplaint(data.complaint ?? '') }
  }, [visitId, supabase])

  const loadParts = useCallback(async () => {
    const { data } = await supabase
      .from('used_parts')
      .select(`*, ecus(*, ecu_companies(name), ecu_categories(name))`)
      .eq('visit_id', visitId)
      .order('id') as { data: any[] | null }
    setParts(data ?? [])
  }, [visitId, supabase])

  const loadVehicleAndCustomer = useCallback(async () => {
    const { data: v } = await supabase.from('visits').select('vehicle_id').eq('id', visitId).single() as { data: any }
    if (!v) return
    const { data: veh } = await supabase.from('vehicles').select('*').eq('id', v.vehicle_id).single() as { data: any }
    setVehicle(veh)
    if (veh) {
      const { data: cust } = await supabase.from('customers').select('*').eq('id', veh.customer_id).single() as { data: any }
      setCustomer(cust)
    }
  }, [visitId, supabase])

  useEffect(() => {
    loadVisit()
    loadParts()
    loadVehicleAndCustomer()
  }, [loadVisit, loadParts, loadVehicleAndCustomer])

  const handleStatusChange = async (status: VisitStatus) => {
    const { error } = await supabase.from('visits').update({ status } as any).eq('id', visitId)
    if (error) { toast.error('فشل في تحديث الحالة'); return }
    toast.success('تم تحديث الحالة')
    loadVisit()
  }

  const handleComplaintSave = async () => {
    setSaving(true)
    await supabase.from('visits').update({ complaint } as any).eq('id', visitId)
    toast.success('تم حفظ الشكوى')
    setSaving(false)
  }

  const handleRemovePart = async (partId: string) => {
    const { error } = await supabase.from('used_parts').delete().eq('id', partId)
    if (error) { toast.error('فشل في حذف القطعة'); return }
    toast.success('تم حذف القطعة')
    loadParts()
    loadVisit()
  }

  const handleCollectPayment = async () => {
    if (!visit || visit.total_amount <= 0) { toast.error('لا يوجد مبلغ للتحصيل'); return }
    const { error } = await supabase.from('transactions').insert({
      type: 'Income',
      amount: visit.total_amount,
      reference_type: 'Visit_Payment',
      reference_id: visitId,
      description: `دفعة زيارة - ${customer?.name ?? ''} - ${vehicle?.license_plate ?? ''}`,
    } as any)
    if (error) { toast.error('فشل في تسجيل الدفعة'); return }
    await supabase.from('visits').update({ status: 'Delivered' } as any).eq('id', visitId)
    toast.success('تم تسجيل الدفعة وتسليم السيارة 🎉')
    loadVisit()
  }

  if (!visit) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <button onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">
        <ArrowRight size={16} />
        العودة
      </button>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vehicle + Customer header */}
          <div className="glass-card p-6 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Car size={22} className="text-blue-400" />
                  <h1 className="text-2xl font-bold text-slate-100">{vehicle?.make_and_model ?? '...'}</h1>
                  <span className="font-mono text-blue-400 bg-blue-400/10 px-3 py-1 rounded-lg text-sm">
                    {vehicle?.license_plate}
                  </span>
                </div>
                {customer && (
                  <p className="text-slate-400 flex items-center gap-2">
                    <Phone size={14} />
                    {customer.name} · <span className="font-mono">{customer.phone}</span>
                  </p>
                )}
                <p className="text-slate-500 text-sm mt-1">{formatDate(visit.entry_date)}</p>
              </div>
              <StatusBadge status={visit.status} />
            </div>
          </div>

          {/* Complaint */}
          <div className="glass-card p-6 space-y-3">
            <h2 className="font-semibold text-slate-300 flex items-center gap-2">
              <FileText size={18} className="text-violet-400" />
              الشكوى / وصف المشكلة
            </h2>
            <textarea value={complaint} onChange={e => setComplaint(e.target.value)}
              rows={3} placeholder="اكتب وصف المشكلة هنا..."
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 input-glow resize-none" />
            <div className="flex justify-end">
              <button onClick={handleComplaintSave} disabled={saving}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60">
                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>

          {/* Parts / Barcode Scanner */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-300 flex items-center gap-2">
                <Package size={18} className="text-emerald-400" />
                القطع المستخدمة
                <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">{parts.length}</span>
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Scan size={14} />
                امسح الباركود لإضافة قطعة
              </div>
            </div>

            <BarcodeScanner visitId={visitId} onPartAdded={() => { loadParts(); loadVisit() }} />

            {parts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">لا توجد قطع مضافة بعد</div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 px-3">
                  <div className="col-span-5">القطعة</div>
                  <div className="col-span-2 text-center">الكمية</div>
                  <div className="col-span-2 text-center">سعر الوحدة</div>
                  <div className="col-span-2 text-left">الإجمالي</div>
                  <div className="col-span-1" />
                </div>
                {parts.map(part => (
                  <div key={part.id} className="grid grid-cols-12 gap-2 items-center bg-slate-800/60 rounded-xl px-3 py-3">
                    <div className="col-span-5">
                      <p className="font-medium text-slate-200 text-sm">{part.ecus?.name}</p>
                      <p className="text-xs text-slate-500">
                        {part.ecus?.ecu_companies?.name} · {part.ecus?.ecu_categories?.name}
                      </p>
                    </div>
                    <div className="col-span-2 text-center">
                      <QuantityInput partId={part.id} quantity={part.quantity}
                        onUpdate={() => { loadParts(); loadVisit() }} />
                    </div>
                    <div className="col-span-2 text-center text-slate-300 text-sm">
                      {formatCurrency(part.selling_price_at_time)}
                    </div>
                    <div className="col-span-2 text-left font-semibold text-emerald-400 text-sm">
                      {formatCurrency(part.quantity * part.selling_price_at_time)}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button onClick={() => handleRemovePart(part.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-400/10">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar column */}
        <div className="space-y-6">
          {/* Status control */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="font-semibold text-slate-300">حالة الزيارة</h3>
            <div className="space-y-2">
              {ALL_STATUSES.map(s => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
                    visit.status === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}>
                  {VISIT_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Cost summary */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="font-semibold text-slate-300 flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-400" />
              ملخص التكلفة
            </h3>
            <div className="space-y-2">
              {parts.map((p: any) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span className="text-slate-400 truncate ml-2">{p.ecus?.name}</span>
                  <span className="text-slate-300 shrink-0">
                    {p.quantity} × {formatCurrency(p.selling_price_at_time)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-700 pt-3 flex justify-between font-bold">
              <span className="text-slate-300">الإجمالي</span>
              <span className="text-emerald-400 text-lg">{formatCurrency(visit.total_amount)}</span>
            </div>
            {role === 'admin' && (
              <button onClick={handleCollectPayment}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20">
                💰 تحصيل الدفعة وتسليم السيارة
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function QuantityInput({ partId, quantity, onUpdate }: { partId: string; quantity: number; onUpdate: () => void }) {
  const supabase = createClient()
  const handleChange = async (newQty: number) => {
    if (newQty < 1) return
    await supabase.from('used_parts').update({ quantity: newQty } as any).eq('id', partId)
    onUpdate()
  }
  return (
    <div className="flex items-center gap-1 justify-center">
      <button onClick={() => handleChange(quantity - 1)}
        className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center text-xs transition-colors">-</button>
      <span className="text-slate-200 text-sm w-6 text-center">{quantity}</span>
      <button onClick={() => handleChange(quantity + 1)}
        className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center text-xs transition-colors">+</button>
    </div>
  )
}
