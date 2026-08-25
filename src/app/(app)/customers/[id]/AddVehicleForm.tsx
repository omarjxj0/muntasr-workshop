'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function AddVehicleForm({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ license_plate: '', make_and_model: '', chassis_number_vin: '' })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.license_plate || !form.make_and_model) return
    setLoading(true)

    const { error } = await supabase.from('vehicles').insert({
      customer_id: customerId,
      license_plate: form.license_plate,
      make_and_model: form.make_and_model,
      chassis_number_vin: form.chassis_number_vin || null,
    })

    if (error) { toast.error('فشل في إضافة المركبة'); setLoading(false); return }
    toast.success('تم إضافة المركبة')
    setOpen(false)
    setForm({ license_plate: '', make_and_model: '', chassis_number_vin: '' })
    router.refresh()
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors py-2"
      >
        <Plus size={16} />
        إضافة مركبة جديدة
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4 border border-blue-500/20">
      <h3 className="font-semibold text-slate-200">إضافة مركبة</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">نوع السيارة *</label>
          <input required value={form.make_and_model} onChange={e => setForm(p => ({ ...p, make_and_model: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm input-glow" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">رقم اللوحة *</label>
          <input required value={form.license_plate} onChange={e => setForm(p => ({ ...p, license_plate: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm input-glow font-mono" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-slate-400 mb-1 block">رقم الشاسيه (VIN)</label>
          <input value={form.chassis_number_vin} onChange={e => setForm(p => ({ ...p, chassis_number_vin: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm input-glow font-mono" />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button type="button" onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition-colors">
          إلغاء
        </button>
        <button type="submit" disabled={loading}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60">
          {loading ? 'جارٍ الحفظ...' : 'حفظ'}
        </button>
      </div>
    </form>
  )
}
