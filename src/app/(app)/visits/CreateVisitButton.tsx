'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function CreateVisitButton() {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [vehicles, setVehicles] = useState<any[]>([])
  const [searched, setSearched] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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
    const result = await supabase
      .from('visits')
      .insert({ vehicle_id: vehicleId, complaint: '' } as any)
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
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/30">
        <Plus size={18} />
        زيارة جديدة
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="glass-card p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg text-slate-100">فتح زيارة جديدة</h3>
        <div className="flex gap-2">
          <input value={phone} onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="رقم هاتف العميل"
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 input-glow" />
          <button onClick={handleSearch} disabled={loading}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all">
            <Search size={18} />
          </button>
        </div>
        {searched && vehicles.length === 0 && (
          <p className="text-slate-400 text-sm text-center">لم يتم العثور على مركبات، سجّل العميل أولاً من لوحة التحكم</p>
        )}
        {vehicles.map((v: any) => (
          <button key={v.id} onClick={() => handleCreate(v.id)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all text-right">
            <span className="text-slate-200 font-medium">{v.make_and_model}</span>
            <span className="text-slate-400 font-mono text-sm">{v.license_plate}</span>
          </button>
        ))}
        <button onClick={() => setOpen(false)} className="w-full py-2 text-slate-500 text-sm hover:text-slate-300 transition-colors">إلغاء</button>
      </div>
    </div>
  )
}
