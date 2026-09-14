'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BarcodeScanner from '@/components/BarcodeScanner'
import StatusBadge from '@/components/StatusBadge'
import {
  Car, Phone, Trash2, DollarSign, FileText, ArrowRight, Scan, Package, Lock
} from 'lucide-react'
import { formatDate, formatCurrency, VISIT_STATUS_LABELS, parseArabicNumerals, handleFinancialBlur } from '@/lib/utils'
import type { VisitStatus, UserRole } from '@/lib/types'
import toast from 'react-hot-toast'
import VoiceComplaintField from './VoiceComplaintField'
import VisitImages from './VisitImages'
import ThermalReceipt from './ThermalReceipt'

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
  const [laborCostInput, setLaborCostInput] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const loadVisit = useCallback(async () => {
    const { data } = await supabase.from('visits').select('*').eq('id', visitId).single() as { data: any }
    if (data) {
      setVisit(data)
      setComplaint(data.complaint ?? '')
      setLaborCostInput(data.labor_cost ? data.labor_cost.toString() : '')
    }
  }, [visitId, supabase])

  const loadParts = useCallback(async () => {
    const { data } = await supabase
      .from('used_parts')
      .select(`*, ecus(*)`)
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

  // 24-Hour Visit Auto-Lock:
  // If status is 'Delivered' and >= 24 hours have passed since last update/delivery, lock all edits
  const isDelivered = visit?.status === 'Delivered'
  const deliveryTimestamp = new Date(visit?.updated_at || visit?.created_at || visit?.entry_date || 0).getTime()
  const hoursSinceDelivery = (Date.now() - deliveryTimestamp) / (1000 * 60 * 60)
  const isLocked = isDelivered && hoursSinceDelivery >= 24

  const handleStatusChange = async (status: VisitStatus) => {
    if (isLocked) {
      toast.error('الزيارة مقفلة ومؤرشفة — لا يمكن تغيير حالتها')
      return
    }
    const { error } = await supabase.from('visits').update({ status } as any).eq('id', visitId)
    if (error) { toast.error('فشل في تحديث الحالة'); return }
    toast.success('تم تحديث الحالة')
    loadVisit()
  }

  const handleComplaintSave = async (text: string) => {
    if (isLocked) return
    setSaving(true)
    setComplaint(text)
    await supabase.from('visits').update({ complaint: text } as any).eq('id', visitId)
    toast.success('تم حفظ الشكوى')
    setSaving(false)
  }

  const handleLaborCostBlur = async () => {
    if (isLocked) return
    const finalVal = handleFinancialBlur(laborCostInput)
    setLaborCostInput(finalVal.toString())
    const { error } = await supabase.from('visits').update({ labor_cost: finalVal } as any).eq('id', visitId)
    if (error) toast.error('فشل حفظ أجرة العمل')
    else loadVisit()
  }

  const handleRemovePart = async (partId: string) => {
    if (isLocked) {
      toast.error('الزيارة مقفلة ومؤرشفة')
      return
    }
    const { error } = await supabase.from('used_parts').delete().eq('id', partId)
    if (error) { toast.error('فشل في حذف القطعة'); return }
    toast.success('تم حذف القطعة')
    loadParts()
    loadVisit()
  }

  const handleCollectPayment = async () => {
    if (!visit || isLocked) return
    const currentLabor = handleFinancialBlur(laborCostInput) || Number(visit.labor_cost) || 0
    const grandTotal = (Number(visit.total_amount) || 0) + currentLabor
    
    if (grandTotal <= 0) { toast.error('لا يوجد مبلغ للتحصيل'); return }

    let descParts = []
    if (Number(visit.total_amount) > 0) descParts.push('مواد')
    if (currentLabor > 0) descParts.push('أجرة عمل')
    
    const desc = `دفعة زيارة (${descParts.join(' و ')}) - ${customer?.name ?? ''} - ${vehicle?.license_plate ?? ''}`

    const { error } = await supabase.from('transactions').insert({
      type: 'Income',
      amount: grandTotal,
      reference_type: 'Visit_Payment',
      reference_id: visitId,
      description: desc,
    } as any)
    if (error) { toast.error('فشل في تسجيل الدفعة'); return }
    await supabase.from('visits').update({ status: 'Delivered', labor_cost: currentLabor } as any).eq('id', visitId)
    toast.success('تم تسجيل الدفعة وتسليم السيارة 🎉')
    loadVisit()
  }

  const handleSendWhatsApp = () => {
    if (!customer?.phone) {
      toast.error('لا يوجد رقم هاتف مسجل للعميل')
      return
    }

    // Format Iraqi phone number: remove non-digits, replace leading 0 with 964
    let phone = customer.phone.replace(/\D/g, '')
    if (phone.startsWith('0')) {
      phone = '964' + phone.slice(1)
    } else if (!phone.startsWith('964')) {
      phone = '964' + phone
    }

    const customerName = customer.name || 'عزيزي العميل'
    const vehicleMake = vehicle?.make_and_model || 'سيارتك'
    const vehiclePlate = vehicle?.license_plate || ''
    const currentLabor = handleFinancialBlur(laborCostInput) || Number(visit.labor_cost) || 0
    const grandTotal = (Number(visit.total_amount) || 0) + currentLabor
    const formattedTotal = new Intl.NumberFormat('en-US').format(grandTotal)

    let message = ''
    if (visit.status === 'Pending' || visit.status === 'In Progress') {
      message = `مرحباً ${customerName}، تم استلام سيارتك (${vehicleMake}${vehiclePlate ? ' - ' + vehiclePlate : ''}) وجاري العمل عليها في ورشة منتصر.`
    } else {
      message = `مرحباً ${customerName}، سيارتك جاهزة للاستلام. الحساب الكلي: ${formattedTotal} دينار. شكراً لزيارتك ورشة منتصر.`
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
  }

  if (!visit) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-violet-600 text-sm transition-colors font-medium"
        >
          <ArrowRight size={16} />
          العودة
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSendWhatsApp}
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            📱 إرسال واتساب
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
          >
            🖨️ طباعة الوصل
          </button>
        </div>
      </div>

      {/* 24-Hour Auto-Lock Banner */}
      {isLocked && (
        <div className="bg-amber-50 border-2 border-amber-200 text-amber-900 px-5 py-3.5 rounded-2xl flex items-center gap-3 font-semibold text-sm shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
            <Lock size={18} />
          </div>
          <div>
            <p className="font-bold">🔒 الزيارة مقفلة ومؤرشفة</p>
            <p className="text-xs text-amber-700 font-normal mt-0.5">
              مضى أكثر من 24 ساعة على تسليم السيارة، تم إيقاف جميع التعديلات لحفظ سجلات الحسابات.
            </p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vehicle + Customer header */}
          <div className="soft-card p-6 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Car size={22} className="text-violet-500" />
                  <h1 className="text-2xl font-bold text-slate-800">{vehicle?.make_and_model ?? '...'}</h1>
                  <span className="font-mono text-violet-600 bg-violet-50 px-3 py-1 rounded-xl text-sm border border-violet-100">
                    {vehicle?.license_plate}
                  </span>
                </div>
                {customer && (
                  <p className="text-slate-500 flex items-center gap-2">
                    <Phone size={14} />
                    {customer.name} · <span className="font-mono">{customer.phone}</span>
                  </p>
                )}
                <p className="text-slate-400 text-sm mt-1">{formatDate(visit.entry_date)}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusBadge status={visit.status} />
                {isLocked && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                    <Lock size={10} />
                    مؤرشفة
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Complaint */}
          <div className="soft-card p-6 space-y-3">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
              <FileText size={18} className="text-violet-500" />
              الشكوى / وصف المشكلة
            </h2>
            <VoiceComplaintField
              value={complaint}
              onChange={(val) => { setComplaint(val); handleComplaintSave(val) }}
              disabled={isLocked}
            />
          </div>

          {/* Parts / Barcode Scanner */}
          <div className="soft-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                <Package size={18} className="text-emerald-500" />
                القطع المستخدمة
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full border border-slate-200">{parts.length}</span>
              </h2>
              {!isLocked && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Scan size={14} />
                  امسح الباركود لإضافة قطعة
                </div>
              )}
            </div>

            {!isLocked && (
              <BarcodeScanner visitId={visitId} onPartAdded={() => { loadParts(); loadVisit() }} />
            )}

            {parts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">لا توجد قطع مضافة بعد</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[500px] space-y-2 pb-2">
                  <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 px-3">
                    <div className="col-span-5">القطعة</div>
                    <div className="col-span-2 text-center">الكمية</div>
                    <div className="col-span-2 text-center">سعر الوحدة</div>
                    <div className="col-span-2 text-left">الإجمالي</div>
                    <div className="col-span-1" />
                  </div>
                  {parts.map(part => (
                    <div key={part.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50 border border-slate-100 rounded-2xl px-3 py-3">
                      <div className="col-span-5">
                        <p className="font-semibold text-slate-700 text-sm">{part.ecus?.name}</p>
                        <p className="text-xs text-slate-400">
                          {[part.ecus?.manufacturer, part.ecus?.ecu_family, part.ecus?.vehicle_model_code, part.ecus?.software_id].filter(Boolean).join(' › ') || '—'}
                        </p>
                      </div>
                      <div className="col-span-2 text-center">
                        <QuantityInput
                          partId={part.id}
                          quantity={part.quantity}
                          disabled={isLocked}
                          onUpdate={() => { loadParts(); loadVisit() }}
                        />
                      </div>
                      <div className="col-span-2 text-center text-slate-500 text-sm">
                        {formatCurrency(part.selling_price_at_time)}
                      </div>
                      <div className="col-span-2 text-left font-bold text-emerald-600 text-sm">
                        {formatCurrency(part.quantity * part.selling_price_at_time)}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {!isLocked && (
                          <button onClick={() => handleRemovePart(part.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-xl hover:bg-rose-50">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Visit Images */}
          <VisitImages visitId={visitId} isLocked={isLocked} />
        </div>

        {/* Sidebar column */}
        <div className="space-y-6">
          {/* Status control */}
          <div className="soft-card p-5 space-y-3">
            <h3 className="font-semibold text-slate-700">حالة الزيارة</h3>
            <div className="space-y-2">
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={isLocked}
                  className={`w-full py-2.5 rounded-2xl text-sm font-semibold transition-all ${
                    visit.status === s
                      ? 'text-white shadow-md'
                      : 'bg-slate-50 text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-100'
                  } ${isLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                  style={visit.status === s ? {
                    background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                    boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
                  } : {}}
                >
                  {VISIT_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Cost summary */}
          <div className="soft-card p-5 space-y-3">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-500" />
              ملخص التكلفة
            </h3>
            <div className="space-y-2">
              {parts.map((p: any) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span className="text-slate-500 truncate ml-2">{p.ecus?.name}</span>
                  <span className="text-slate-600 shrink-0">
                    {p.quantity} × {formatCurrency(p.selling_price_at_time)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 text-sm">أجرة العمل</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={laborCostInput}
                  onChange={e => !isLocked && setLaborCostInput(parseArabicNumerals(e.target.value))}
                  onBlur={handleLaborCostBlur}
                  disabled={isLocked}
                  lang="en"
                  dir="ltr"
                  className={`w-24 px-2 py-1.5 rounded-xl text-slate-700 text-sm transition-all border-2 border-slate-200 ${
                    isLocked
                      ? 'bg-slate-100 cursor-not-allowed text-slate-500'
                      : 'bg-white focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]'
                  }`}
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between font-bold pt-2 border-t border-slate-100">
                <span className="text-slate-600">الإجمالي الشامل</span>
                <span className="text-emerald-600 text-lg">
                  {formatCurrency((visit.total_amount || 0) + (visit.labor_cost || 0))}
                </span>
              </div>
            </div>
            {role === 'admin' && !isLocked && visit.status !== 'Delivered' && (
              <button
                onClick={handleCollectPayment}
                className="w-full py-3 rounded-2xl font-bold text-white transition-all cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 4px 15px rgba(16,185,129,0.3)',
                }}
              >
                💰 تحصيل الدفعة وتسليم السيارة
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Hidden print component */}
      <ThermalReceipt visit={visit} vehicle={vehicle} customer={customer} parts={parts} />
    </div>
  )
}

function QuantityInput({
  partId,
  quantity,
  disabled = false,
  onUpdate,
}: {
  partId: string
  quantity: number
  disabled?: boolean
  onUpdate: () => void
}) {
  const supabase = createClient()
  const handleChange = async (newQty: number) => {
    if (disabled || newQty < 1) return
    await supabase.from('used_parts').update({ quantity: newQty } as any).eq('id', partId)
    onUpdate()
  }

  if (disabled) {
    return <span className="text-slate-700 text-sm font-semibold">{quantity}</span>
  }

  return (
    <div className="flex items-center gap-1 justify-center">
      <button onClick={() => handleChange(quantity - 1)}
        className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs transition-colors border border-slate-200 cursor-pointer">-</button>
      <span className="text-slate-700 text-sm w-6 text-center">{quantity}</span>
      <button onClick={() => handleChange(quantity + 1)}
        className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs transition-colors border border-slate-200 cursor-pointer">+</button>
    </div>
  )
}
