'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BarcodeScanner from '@/components/BarcodeScanner'
import StatusBadge from '@/components/StatusBadge'
import {
  Car, Phone, Trash2, DollarSign, FileText, ArrowRight, Scan, Package, Lock, Wrench, Calendar, X, CheckCircle2,
} from 'lucide-react'
import {
  formatDate,
  formatCurrency,
  VISIT_STATUS_LABELS,
  parseArabicNumerals,
  parseAmount,
  toBaghdadDateTimeLocalString,
  getBaghdadYesterdayDateTimeLocalString,
  baghdadInputToISOString,
} from '@/lib/utils'
import { TECHNICIANS } from '@/lib/constants'
import type { VisitStatus, UserRole } from '@/lib/types'
import toast from 'react-hot-toast'
import VoiceComplaintField from './VoiceComplaintField'
import VisitImages from './VisitImages'
import ThermalReceipt from './ThermalReceipt'
import { printThermalMiniReceipt } from '@/lib/printThermalMiniReceipt'

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
  const [technicianName, setTechnicianName] = useState<string>('')
  const [settlementDate, setSettlementDate] = useState(() => toBaghdadDateTimeLocalString())
  const [showDateModal, setShowDateModal] = useState(false)
  const [editEntryDate, setEditEntryDate] = useState('')
  const [editDeliveredDate, setEditDeliveredDate] = useState('')
  const [savingDates, setSavingDates] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const loadVisit = useCallback(async () => {
    const { data } = await supabase.from('visits').select('*').eq('id', visitId).single() as { data: any }
    if (data) {
      setVisit(data)
      setComplaint(data.complaint ?? '')
      setTechnicianName(data.technician_name ?? '')
      const numericLabor = Number(data.labor_cost) || 0
      setLaborCostInput(numericLabor > 0 ? Math.round(numericLabor).toString() : '')
      if (data.delivered_at) {
        setSettlementDate(toBaghdadDateTimeLocalString(data.delivered_at))
      } else if (data.completed_at) {
        setSettlementDate(toBaghdadDateTimeLocalString(data.completed_at))
      }
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
  // If status is 'Delivered' and >= 24 hours have passed since delivery, lock technician edits (admin can still override)
  const isDelivered = visit?.status === 'Delivered'
  const deliveryTimestamp = new Date(visit?.delivered_at || visit?.entry_date || 0).getTime()
  const hoursSinceDelivery = (Date.now() - deliveryTimestamp) / (1000 * 60 * 60)
  const isLocked = isDelivered && hoursSinceDelivery >= 24 && role !== 'admin'

  const handleStatusChange = async (status: VisitStatus) => {
    if (isLocked) {
      toast.error('الزيارة مقفلة ومؤرشفة — لا يمكن تغيير حالتها')
      return
    }
    const chosenDate = settlementDate
      ? baghdadInputToISOString(settlementDate)
      : new Date().toISOString()
    const updatePayload: any = { status }

    if (status === 'Delivered') {
      updatePayload.delivered_at = chosenDate
    } else if (status === 'Completed') {
      updatePayload.completed_at = chosenDate
      updatePayload.delivered_at = null
    } else {
      updatePayload.delivered_at = null
    }

    const { error } = await supabase.from('visits').update(updatePayload).eq('id', visitId)
    if (error) { toast.error('فشل في تحديث الحالة'); return }
    toast.success('تم تحديث الحالة')
    loadVisit()
  }

  const handleTechnicianChange = async (newTech: string) => {
    if (isLocked) {
      toast.error('الزيارة مقفلة ومؤرشفة')
      return
    }
    setTechnicianName(newTech)
    const { error } = await supabase.from('visits').update({ technician_name: newTech || null } as any).eq('id', visitId)
    if (error) {
      toast.error('فشل في حفظ الفني المسؤول')
    } else {
      toast.success(newTech ? `تم تعيين الفني: ${newTech}` : 'تم إزالة تعيين الفني')
      loadVisit()
    }
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
    const finalVal = parseAmount(laborCostInput)
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
    const currentLabor = parseAmount(laborCostInput) || Number(visit.labor_cost) || 0
    const grandTotal = currentLabor
    
    if (grandTotal <= 0) { toast.error('يرجى تحديد أتعاب العمل والبرمجة أولاً'); return }

    const chosenDate = settlementDate
      ? baghdadInputToISOString(settlementDate)
      : new Date().toISOString()

    const desc = `أجور صيانة وبرمجة - ${customer?.name ?? ''} - ${vehicle?.make_and_model ?? ''}`

    const { error } = await supabase.from('transactions').insert({
      type: 'Income',
      amount: grandTotal,
      reference_type: 'Visit_Payment',
      reference_id: visitId,
      description: desc,
      date: chosenDate,
    } as any)
    if (error) { toast.error('فشل في تسجيل الدفعة'); return }

    await supabase.from('visits').update({
      status: 'Delivered',
      labor_cost: currentLabor,
      delivered_at: chosenDate,
      technician_name: technicianName || visit.technician_name || null,
    } as any).eq('id', visitId)

    toast.success('تم تسوية الحساب وتسليم السيارة بنجاح 🎉')
    loadVisit()
  }

  const handleSaveDates = async () => {
    if (!editEntryDate) {
      toast.error('يرجى تحديد تاريخ الدخول')
      return
    }
    setSavingDates(true)
    try {
      const entryIso = baghdadInputToISOString(editEntryDate)
      const delivIso = editDeliveredDate ? baghdadInputToISOString(editDeliveredDate) : null

      const updatePayload: any = { entry_date: entryIso }
      if (editDeliveredDate || visit.status === 'Delivered') {
        updatePayload.delivered_at = delivIso
      }

      const { error } = await supabase.from('visits').update(updatePayload).eq('id', visitId)
      if (error) throw error

      if (delivIso) {
        await supabase
          .from('transactions')
          .update({ date: delivIso })
          .eq('reference_id', visitId)
          .eq('reference_type', 'Visit_Payment')
      }

      toast.success('تم تحديث تواريخ الزيارة بنجاح ✅')
      setShowDateModal(false)
      loadVisit()
    } catch (err: any) {
      toast.error('فشل في تعديل التواريخ: ' + (err.message || 'خطأ غير متوقع'))
    } finally {
      setSavingDates(false)
    }
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
    const currentLabor = parseAmount(laborCostInput) || Number(visit.labor_cost) || 0
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

  const handleThermalPrint = () => {
    if (!visit) return
    const currentLabor = parseAmount(laborCostInput) || Number(visit.labor_cost) || 0
    printThermalMiniReceipt({
      mode: 'visit',
      sequenceNumber: visit.id?.slice(0, 6).toUpperCase(),
      createdAt: visit.delivered_at || visit.created_at || new Date().toISOString(),
      customerName: customer?.name || null,
      phone: customer?.phone || null,
      vehicleInfo: [
        vehicle?.make_and_model,
        vehicle?.license_plate && vehicle.license_plate !== '—' ? vehicle.license_plate : null,
      ].filter(Boolean).join(' • ') || '—',
      technicianName: technicianName || visit.technician_name || null,
      faultCodes: visit.complaint || null,
      laborCost: currentLabor,
    })
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
            onClick={handleThermalPrint}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            title="طباعة وصل حراري 50mm"
          >
            🧾 وصل حراري (50mm)
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
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <p className="text-slate-400 text-sm">تاريخ الدخول: {formatDate(visit.entry_date)}</p>
                  {visit.delivered_at && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      تاريخ التسليم: {formatDate(visit.delivered_at)}
                    </span>
                  )}
                  {role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditEntryDate(toBaghdadDateTimeLocalString(visit.entry_date))
                        setEditDeliveredDate(visit.delivered_at ? toBaghdadDateTimeLocalString(visit.delivered_at) : '')
                        setShowDateModal(true)
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors cursor-pointer"
                      title="تعديل تاريخ الدخول أو التسليم للسيارة بأثر رجعي"
                    >
                      <Calendar size={11} />
                      <span>تعديل التواريخ</span>
                    </button>
                  )}
                  {technicianName ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      <Wrench size={11} className="text-amber-600" />
                      الفني: {technicianName}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                      <Wrench size={11} />
                      بدون فني محدد
                    </span>
                  )}
                </div>
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
                    <div className="col-span-6">القطعة المركبة</div>
                    <div className="col-span-3">الباركود / الموقع</div>
                    <div className="col-span-2 text-center">الكمية</div>
                    <div className="col-span-1" />
                  </div>
                  {parts.map(part => (
                    <div key={part.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50 border border-slate-100 rounded-2xl px-3 py-3">
                      <div className="col-span-6">
                        <p className="font-semibold text-slate-700 text-sm">{part.ecus?.name}</p>
                        <p className="text-xs text-slate-400">
                          {[part.ecus?.manufacturer, part.ecus?.ecu_family, part.ecus?.vehicle_model_code, part.ecus?.software_id].filter(Boolean).join(' › ') || '—'}
                        </p>
                      </div>
                      <div className="col-span-3 text-xs text-slate-500 font-mono">
                        {part.ecus?.barcode || part.ecus?.shelf_location ? (
                          <div className="flex flex-col gap-0.5">
                            {part.ecus?.barcode && <span>📦 {part.ecus.barcode}</span>}
                            {part.ecus?.shelf_location && <span className="text-violet-600 font-sans">رف: {part.ecus.shelf_location}</span>}
                          </div>
                        ) : '—'}
                      </div>
                      <div className="col-span-2 text-center">
                        <QuantityInput
                          partId={part.id}
                          quantity={part.quantity}
                          disabled={isLocked}
                          onUpdate={() => { loadParts(); loadVisit() }}
                        />
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
          {/* Technician Assignment */}
          <div className="soft-card p-5 space-y-3">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Wrench size={16} className="text-violet-500" />
              الفني المسؤول
            </h3>
            <select
              value={technicianName}
              onChange={e => handleTechnicianChange(e.target.value)}
              disabled={isLocked}
              className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all ${
                isLocked ? 'cursor-not-allowed bg-slate-50 text-slate-400' : ''
              }`}
            >
              <option value="">-- اختر الفني المسؤول --</option>
              {TECHNICIANS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Status control */}
          <div className="soft-card p-5 space-y-3">
            <h3 className="font-semibold text-slate-700">حالة الزيارة</h3>
            <div className="space-y-2">
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={isLocked}
                  className={`w-full py-2.5 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    visit.status === s
                      ? 'text-white shadow-md'
                      : s === 'Completed'
                      ? 'bg-amber-50 text-amber-800 hover:text-amber-900 hover:bg-amber-100/90 border-2 border-amber-300 font-bold'
                      : 'bg-slate-50 text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-100'
                  } ${isLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                  style={visit.status === s ? {
                    background: s === 'Completed'
                      ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                      : s === 'Delivered'
                      ? 'linear-gradient(135deg, #10b981, #059669)'
                      : 'linear-gradient(135deg, #7c3aed, #ec4899)',
                    boxShadow: s === 'Completed'
                      ? '0 4px 12px rgba(245,158,11,0.35)'
                      : s === 'Delivered'
                      ? '0 4px 12px rgba(16,185,129,0.35)'
                      : '0 4px 12px rgba(124,58,237,0.35)',
                  } : {}}
                >
                  {s === 'Completed' && (
                    <span className={`w-2 h-2 rounded-full ${visit.status === s ? 'bg-white' : 'bg-amber-500'} animate-pulse`} />
                  )}
                  <span>{s === 'Completed' ? 'ديون (غير مسدد)' : VISIT_STATUS_LABELS[s]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cost summary */}
          <div className="soft-card p-5 space-y-3">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-500" />
              أجور الصيانة والإيراد
            </h3>
            {parts.length > 0 && (
              <div className="space-y-1.5 pb-2 border-b border-slate-100">
                <p className="text-xs text-slate-400 font-medium">العقول والقطع المركبة:</p>
                {parts.map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    <span className="truncate">{p.ecus?.name}</span>
                    <span className="font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md shrink-0">
                      {p.quantity} {p.quantity === 1 ? 'قطعة' : 'قطع'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-1 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 text-sm font-medium">أجرة العمل والبرمجة</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={laborCostInput}
                  onChange={e => !isLocked && setLaborCostInput(parseArabicNumerals(e.target.value))}
                  onBlur={handleLaborCostBlur}
                  disabled={isLocked}
                  lang="en"
                  dir="ltr"
                  className={`w-28 px-2.5 py-1.5 rounded-xl font-mono text-slate-800 text-sm transition-all border-2 border-slate-200 ${
                    isLocked
                      ? 'bg-slate-100 cursor-not-allowed text-slate-500'
                      : 'bg-white focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]'
                  }`}
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between items-center font-bold pt-2 border-t border-slate-100">
                <span className="text-slate-700">دخل الزيارة المحصل</span>
                <span className="text-emerald-600 text-lg font-mono">
                  {formatCurrency(parseAmount(laborCostInput) || Number(visit.labor_cost) || 0)}
                </span>
              </div>
            </div>
            {role === 'admin' && !isLocked && visit.status !== 'Delivered' && (
              <div className="space-y-3 pt-2">
                {/* Settlement Date Picker (Backdating) */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Calendar size={12} className="text-emerald-600" />
                      <span>تاريخ التسليم والمحاسبة</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSettlementDate(toBaghdadDateTimeLocalString())}
                        className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                      >
                        الآن
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettlementDate(getBaghdadYesterdayDateTimeLocalString())}
                        className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        أمس
                      </button>
                    </div>
                  </div>
                  <input
                    type="datetime-local"
                    value={settlementDate}
                    onChange={e => setSettlementDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-mono focus:outline-none focus:border-emerald-400"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-slate-400">
                    افتراضياً الآن — يمكنك اختيار الأمس إذا كانت السيارة سُلمت بالأمس لتسجيل دخلها في شفت أمس.
                  </p>
                </div>

                <button
                  onClick={handleCollectPayment}
                  className="w-full py-3 rounded-2xl font-bold text-white transition-all cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    boxShadow: '0 4px 15px rgba(16,185,129,0.3)',
                  }}
                >
                  💰 تحصيل الإيراد وتسليم السيارة
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Date Edit Modal (Admin backdating override) */}
      {showDateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => !savingDates && setShowDateModal(false)}
        >
          <div
            className="soft-card bg-white p-6 max-w-md w-full space-y-4 border-2 border-violet-100 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600">
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800">تعديل تواريخ الزيارة بأثر رجعي</h3>
                  <p className="text-xs text-slate-400">تعديل تاريخ دخول أو تسليم السيارة في السجلات</p>
                </div>
              </div>
              <button
                onClick={() => !savingDates && setShowDateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">تاريخ ووقت الدخول</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditEntryDate(toBaghdadDateTimeLocalString())}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      اليوم
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditEntryDate(getBaghdadYesterdayDateTimeLocalString())}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      أمس
                    </button>
                  </div>
                </div>
                <input
                  type="datetime-local"
                  value={editEntryDate}
                  onChange={e => setEditEntryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono focus:outline-none focus:border-violet-400"
                  dir="ltr"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">تاريخ ووقت التسليم (اختياري)</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditDeliveredDate(toBaghdadDateTimeLocalString())}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      اليوم
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditDeliveredDate(getBaghdadYesterdayDateTimeLocalString())}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      أمس
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditDeliveredDate('')}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      مسح
                    </button>
                  </div>
                </div>
                <input
                  type="datetime-local"
                  value={editDeliveredDate}
                  onChange={e => setEditDeliveredDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono focus:outline-none focus:border-violet-400"
                  dir="ltr"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  تعديل تاريخ التسليم سيحدث تاريخ تقرير الشفت اليومي وسجل المدفوعات فوراً.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDateModal(false)}
                disabled={savingDates}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveDates}
                disabled={savingDates}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all shadow-md shadow-violet-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savingDates ? 'جاري الحفظ...' : 'حفظ التواريخ'}
              </button>
            </div>
          </div>
        </div>
      )}

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
