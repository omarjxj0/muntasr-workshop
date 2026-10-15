'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Wrench, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TECHNICIANS } from '@/lib/constants'
import {
  toBaghdadDateTimeLocalString,
  getBaghdadYesterdayDateTimeLocalString,
  baghdadInputToISOString,
} from '@/lib/utils'
import toast from 'react-hot-toast'

export default function CreateVisitButton() {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [technicianName, setTechnicianName] = useState('')
  const [entryDate, setEntryDate] = useState(() => toBaghdadDateTimeLocalString())
  const [loading, setLoading] = useState(false)
  const [vehicles, setVehicles] = useState<any[]>([])
  const [searched, setSearched] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleOpen = () => {
    setEntryDate(toBaghdadDateTimeLocalString())
    setOpen(true)
  }

  const handleSearch = async () => {
    if (!phone.trim()) return
    setLoading(true)
    const { data: customer } = await supabase
      .from('customers')
      .select('*, vehicles(*)')
      .eq('phone', phone.trim())
      .single() as { data: any }
    setSearched(true)
    setVehicles((customer as any)?.vehicles ?? [])
    setLoading(false)
  }

  const handleCreate = async (vehicleId: string) => {
    const entryDateIso = entryDate
      ? baghdadInputToISOString(entryDate)
      : new Date().toISOString()

    const result = await supabase
      .from('visits')
      .insert({
        vehicle_id: vehicleId,
        complaint: '',
        technician_name: technicianName || null,
        entry_date: entryDateIso,
      } as any)
      .select()
      .single()
    const visit = result.data as any
    const error = result.error
    if (error || !visit) { toast.error('فشل في إنشاء الزيارة'); return }
    toast.success('تم فتح زيارة جديدة')
    router.push(`/visits/${visit.id}`)
  }

  if (!open) {
    return (
      <button onClick={handleOpen}
        className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-semibold transition-all shadow-lg cursor-pointer"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', boxShadow: '0 4px 15px rgba(124,58,237,0.35)' }}>
        <Plus size={18} />
        زيارة جديدة
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="soft-card bg-white p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg text-slate-800">فتح زيارة جديدة</h3>
        
        {/* Entry Date & Time (Backdating Support) */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar size={13} className="text-violet-500" />
              <span>تاريخ ووقت دخول السيارة</span>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEntryDate(toBaghdadDateTimeLocalString())}
                className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors cursor-pointer"
              >
                الآن
              </button>
              <button
                type="button"
                onClick={() => setEntryDate(getBaghdadYesterdayDateTimeLocalString())}
                className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                أمس
              </button>
            </div>
          </div>
          <input
            type="datetime-local"
            value={entryDate}
            onChange={e => setEntryDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-mono focus:outline-none focus:border-violet-400"
            dir="ltr"
          />
          <p className="text-[10px] text-slate-400">
            افتراضياً الآن — اختر الأمس إذا كنت تسجل سيارة دخلت أو بايتة من أمس.
          </p>
        </div>

        <div className="flex gap-2">
          <input value={phone} onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="رقم هاتف العميل"
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]" />
          <button onClick={handleSearch} disabled={loading}
            className="px-4 py-2.5 text-white rounded-xl transition-all disabled:opacity-60 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
            <Search size={18} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Wrench size={13} className="text-violet-500" />
            الفني المسؤول
          </label>
          <select
            value={technicianName}
            onChange={e => setTechnicianName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-violet-400"
          >
            <option value="">-- اختر الفني المسؤول (اختياري) --</option>
            {TECHNICIANS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {searched && vehicles.length === 0 && (
          <div className="text-center space-y-3 py-2 bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-slate-600 text-sm">لم يتم العثور على زبون أو مركبات مسجلة بالرقم <span className="font-mono font-bold text-slate-800">{phone}</span></p>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                router.push(`/customers/new?phone=${encodeURIComponent(phone.trim())}`)
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-md"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
            >
              ➕ تسجيل كزبون جديد
            </button>
          </div>
        )}
        {vehicles.map((v: any) => (
          <button key={v.id} onClick={() => handleCreate(v.id)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl transition-all text-right">
            <span className="text-slate-700 font-semibold">{v.make_and_model}</span>
            <span className="text-slate-500 font-mono text-sm">{v.license_plate}</span>
          </button>
        ))}
        <button onClick={() => setOpen(false)} className="w-full py-2 text-slate-500 font-semibold text-sm hover:text-slate-700 transition-colors">إلغاء</button>
      </div>
    </div>
  )
}
