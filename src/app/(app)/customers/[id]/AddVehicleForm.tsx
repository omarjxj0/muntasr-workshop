'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function AddVehicleForm({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ make_and_model: '', chassis_number_vin: '' })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.make_and_model.trim()) return
    setLoading(true)

    const { error } = await supabase.from('vehicles').insert({
      customer_id: customerId,
      license_plate: '—',
      make_and_model: form.make_and_model.trim(),
      chassis_number_vin: form.chassis_number_vin.trim() || null,
    })

    if (error) { toast.error('فشل في إضافة المركبة'); setLoading(false); return }
    toast.success('تم إضافة المركبة')
    setOpen(false)
    setForm({ make_and_model: '', chassis_number_vin: '' })
    router.refresh()
    setLoading(false)
  }

  const inputClass = "w-full px-3 py-2.5 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
  const labelClass = "text-xs mb-1 block text-slate-500 font-medium"

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-semibold transition-colors py-2 text-violet-600 hover:text-violet-700"
      >
        <Plus size={16} />
        إضافة مركبة جديدة
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="soft-card p-5 space-y-4 border-2 border-violet-100">
      <h3 className="font-semibold text-slate-700">إضافة مركبة</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="col-span-1 md:col-span-2">
          <label className={labelClass}>نوع السيارة والموديل *</label>
          <input
            required
            placeholder="مثال: سنتافي 2018 أو كيا سبورتاج 2015"
            value={form.make_and_model}
            onChange={e => setForm(p => ({ ...p, make_and_model: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div className="col-span-1 md:col-span-2">
          <label className={labelClass}>رقم الشاسيه (VIN) (اختياري)</label>
          <input
            placeholder="رقم الشاسيه"
            value={form.chassis_number_vin}
            onChange={e => setForm(p => ({ ...p, chassis_number_vin: e.target.value }))}
            className={`${inputClass} font-mono`}
            dir="ltr"
          />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-2xl text-sm font-semibold border-2 border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
        >
          إلغاء
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 rounded-2xl text-sm font-bold transition-all disabled:opacity-60 text-white"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
          }}
        >
          {loading ? 'جارٍ الحفظ...' : 'حفظ'}
        </button>
      </div>
    </form>
  )
}
