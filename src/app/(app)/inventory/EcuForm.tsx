'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Package, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface EcuFormProps {
  mode: 'new' | 'edit'
  ecuId?: string
}

export default function EcuForm({ mode, ecuId }: EcuFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [companies, setCompanies] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [form, setForm] = useState({
    name: '', company_id: '', category_id: '', barcode: '',
    symbols_codes: '', stock_quantity: 0, purchase_price: 0, selling_price: 0,
  })

  useEffect(() => {
    supabase.from('ecu_companies').select('*').order('name').then(({ data }) => setCompanies(data ?? []))
    supabase.from('ecu_categories').select('*').order('name').then(({ data }) => setCategories(data ?? []))
    if (mode === 'edit' && ecuId) {
      supabase.from('ecus').select('*').eq('id', ecuId).single().then(({ data }: { data: any }) => {
        if (data) setForm({
          name: data.name ?? '',
          company_id: data.company_id ?? '',
          category_id: data.category_id ?? '',
          barcode: data.barcode ?? '',
          symbols_codes: data.symbols_codes ?? '',
          stock_quantity: data.stock_quantity ?? 0,
          purchase_price: data.purchase_price ?? 0,
          selling_price: data.selling_price ?? 0,
        })
      })
    }
  }, [mode, ecuId, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const payload = {
      name: form.name,
      company_id: form.company_id || null,
      category_id: form.category_id || null,
      barcode: form.barcode || null,
      symbols_codes: form.symbols_codes || null,
      stock_quantity: form.stock_quantity,
      purchase_price: form.purchase_price,
      selling_price: form.selling_price,
    }

    const { error } = mode === 'new'
      ? await supabase.from('ecus').insert(payload as any)
      : await supabase.from('ecus').update(payload as any).eq('id', ecuId!)

    if (error) { toast.error('فشل في الحفظ: ' + error.message); setLoading(false); return }
    toast.success(mode === 'new' ? 'تم إضافة الصنف' : 'تم تحديث الصنف')
    router.push('/inventory')
    router.refresh()
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [key]: e.target.type === 'number' ? Number(e.target.value) : e.target.value })),
  })

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto space-y-6">
      <button onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">
        <ArrowRight size={16} />
        العودة
      </button>
      <div className="glass-card p-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
          <Package size={24} className="text-emerald-400" />
          {mode === 'new' ? 'إضافة صنف جديد' : 'تعديل الصنف'}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">اسم الصنف *</label>
            <input required {...field('name')} className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 input-glow" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">الشركة</label>
              <select {...field('company_id')} className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 input-glow">
                <option value="">— اختر —</option>
                {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">النوع / الفئة</label>
              <select {...field('category_id')} className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 input-glow">
                <option value="">— اختر —</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">الباركود</label>
              <input {...field('barcode')} className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 input-glow font-mono" dir="ltr" />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">رموز الأعطال</label>
              <input {...field('symbols_codes')} className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 input-glow" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">الكمية في المخزون</label>
              <input type="number" min="0" {...field('stock_quantity')} className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 input-glow" />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">سعر الشراء (IQD)</label>
              <input type="number" min="0" step="any" {...field('purchase_price')} className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 input-glow" />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">سعر البيع (IQD)</label>
              <input type="number" min="0" step="any" {...field('selling_price')} className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 input-glow" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => router.back()}
              className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
              إلغاء
            </button>
            <button type="submit" disabled={loading}
              className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-60">
              {loading ? 'جارٍ الحفظ...' : mode === 'new' ? 'إضافة' : 'حفظ التعديلات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
