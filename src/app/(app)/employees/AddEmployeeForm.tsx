'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function AddEmployeeForm() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', specialization: '' })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('employees').insert({
      name: form.name,
      phone: form.phone || null,
      specialization: form.specialization || null,
    })
    if (error) { toast.error('فشل في إضافة الموظف'); setLoading(false); return }
    toast.success('تم إضافة الموظف')
    setForm({ name: '', phone: '', specialization: '' })
    setOpen(false)
    router.refresh()
    setLoading(false)
  }

  const inputClass = "w-full px-3 py-2.5 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold transition-all w-full justify-center text-white"
        style={{
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          boxShadow: '0 4px 15px rgba(245,158,11,0.35)',
        }}
      >
        <Plus size={18} />
        إضافة موظف جديد
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="soft-card p-6 space-y-4 border-2 border-amber-100">
      <h3 className="font-bold text-slate-700">إضافة موظف جديد</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-slate-500 mb-1 block font-medium">الاسم *</label>
          <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block font-medium">رقم الهاتف</label>
          <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            className={`${inputClass} font-mono`} />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block font-medium">التخصص</label>
          <input value={form.specialization} onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))}
            placeholder="مثال: كهربائي محركات"
            className={inputClass} />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button type="button" onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-2xl border-2 border-slate-200 text-slate-500 text-sm hover:bg-slate-50 transition-colors font-semibold">
          إلغاء
        </button>
        <button type="submit" disabled={loading}
          className="px-5 py-2 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}>
          {loading ? 'جارٍ الحفظ...' : 'إضافة'}
        </button>
      </div>
    </form>
  )
}
