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

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-5 py-3 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/30 text-amber-400 rounded-xl font-semibold transition-all w-full justify-center">
        <Plus size={18} />
        إضافة موظف جديد
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4 border border-amber-500/20">
      <h3 className="font-bold text-slate-200">إضافة موظف جديد</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">الاسم *</label>
          <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm input-glow" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">رقم الهاتف</label>
          <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm input-glow font-mono" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">التخصص</label>
          <input value={form.specialization} onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))}
            placeholder="مثال: كهربائي محركات"
            className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm input-glow" />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button type="button" onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-sm hover:text-slate-200 transition-colors">
          إلغاء
        </button>
        <button type="submit" disabled={loading}
          className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60">
          {loading ? 'جارٍ الحفظ...' : 'إضافة'}
        </button>
      </div>
    </form>
  )
}
