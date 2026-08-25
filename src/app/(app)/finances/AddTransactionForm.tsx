'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function AddTransactionForm() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ type: 'Income', amount: '', description: '' })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.amount) return
    setLoading(true)
    const { error } = await supabase.from('transactions').insert({
      type: form.type as 'Income' | 'Expense',
      amount: Number(form.amount),
      reference_type: 'Other',
      description: form.description || null,
    } as any)
    if (error) { toast.error('فشل في إضافة المعاملة'); setLoading(false); return }
    toast.success('تم إضافة المعاملة')
    setForm({ type: 'Income', amount: '', description: '' })
    setOpen(false)
    router.refresh()
    setLoading(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-all">
        <Plus size={16} />
        إضافة معاملة يدوية
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4 border border-blue-500/20">
      <h3 className="font-semibold text-slate-200">معاملة يدوية</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">النوع</label>
          <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm input-glow">
            <option value="Income">إيراد</option>
            <option value="Expense">مصروف</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">المبلغ (IQD) *</label>
          <input required type="number" min="0" value={form.amount}
            onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm input-glow font-mono" dir="ltr" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">الوصف</label>
          <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm input-glow" />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button type="button" onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-sm hover:text-slate-200 transition-colors">إلغاء</button>
        <button type="submit" disabled={loading}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60">
          {loading ? 'جارٍ الحفظ...' : 'حفظ'}
        </button>
      </div>
    </form>
  )
}
