'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { parseArabicNumerals, handleFinancialBlur } from '@/lib/utils'
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

  const inputClass = "w-full px-3 py-2.5 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-slate-600 border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-violet-200 transition-all"
      >
        <Plus size={16} />
        إضافة معاملة يدوية
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="soft-card p-5 space-y-4 border-2 border-violet-100">
      <h3 className="font-semibold text-slate-700">معاملة يدوية</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-slate-500 mb-1 block font-medium">النوع</label>
          <select
            value={form.type}
            onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
            className={inputClass}
          >
            <option value="Income">إيراد</option>
            <option value="Expense">مصروف</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block font-medium">المبلغ (IQD) *</label>
          <input
            required
            type="text"
            inputMode="numeric"
            value={form.amount}
            onChange={e => setForm(p => ({ ...p, amount: parseArabicNumerals(e.target.value) }))}
            onBlur={e => setForm(p => ({ ...p, amount: handleFinancialBlur(e.target.value).toString() }))}
            className={`${inputClass} font-mono`}
            lang="en"
            dir="ltr"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block font-medium">الوصف</label>
          <input
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-2xl border-2 border-slate-200 text-slate-500 text-sm hover:bg-slate-50 transition-colors font-semibold"
        >
          إلغاء
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-60"
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
