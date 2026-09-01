'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { parseArabicNumerals, handleFinancialBlur } from '@/lib/utils'
import { Package, ArrowRight, Scan } from 'lucide-react'
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
    symbols_codes: '', stock_quantity: 0, min_quantity: 3, purchase_price: 0, selling_price: 0,
  })

  // Ref for auto-focus on barcode field
  const barcodeRef = useRef<HTMLInputElement>(null)
  // Barcode scanner buffer
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
          min_quantity: data.min_quantity ?? 3,
          purchase_price: data.purchase_price ?? 0,
          selling_price: data.selling_price ?? 0,
        })
      })
    }

    // Auto-focus barcode field on mount
    const t = setTimeout(() => barcodeRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [mode, ecuId, supabase])

  // Global barcode scanner keyboard listener
  // Rapid keystrokes (< 100ms apart) followed by Enter → fill barcode field
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      // Only intercept when NOT in a named input/textarea (other than the barcode field itself)
      const isBarcodeField = target === barcodeRef.current
      const isOtherInput = (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && !isBarcodeField

      if (isOtherInput) return

      if (e.key === 'Enter') {
        const scanned = bufferRef.current.trim()
        bufferRef.current = ''
        if (scanned && scanned.length > 3) {
          // Populate the barcode field with the scanned value
          setForm(prev => ({ ...prev, barcode: scanned }))
          barcodeRef.current?.focus()
        }
        return
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key
        if (timerRef.current) clearTimeout(timerRef.current)
        // Clear buffer if no new key within 100ms (not a scanner burst)
        timerRef.current = setTimeout(() => { bufferRef.current = '' }, 100)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

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
      min_quantity: form.min_quantity,
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

  const numericField = (key: keyof typeof form) => ({
    value: form[key] === 0 ? '' : form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(p => ({ ...p, [key]: Number(parseArabicNumerals(e.target.value)) || 0 })),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) =>
      setForm(p => ({ ...p, [key]: handleFinancialBlur(e.target.value) || 0 })),
  })

  const inputClass = "w-full px-4 py-3 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
  const labelClass = "text-sm text-slate-500 mb-1.5 block font-medium"

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto space-y-6">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-slate-500 hover:text-violet-600 text-sm transition-colors font-medium"
      >
        <ArrowRight size={16} />
        العودة
      </button>

      <div className="soft-card p-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <Package size={24} className="text-violet-500" />
          {mode === 'new' ? 'إضافة صنف جديد' : 'تعديل الصنف'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Barcode — FIRST and AUTO-FOCUSED for scanner workflow */}
          <div>
            <label className={labelClass}>
              <span className="flex items-center gap-1.5">
                <Scan size={14} className="text-violet-500" />
                الباركود
                <span className="text-xs text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full mr-1">مسح تلقائي</span>
              </span>
            </label>
            <input
              ref={barcodeRef}
              {...field('barcode')}
              autoFocus
              className={`${inputClass} font-mono`}
              dir="ltr"
              placeholder="امسح الباركود أو اكتبه يدوياً..."
            />
          </div>

          <div>
            <label className={labelClass}>اسم الصنف *</label>
            <input required {...field('name')} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>الشركة</label>
              <select {...field('company_id')} className={inputClass}>
                <option value="">— اختر —</option>
                {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>النوع / الفئة</label>
              <select {...field('category_id')} className={inputClass}>
                <option value="">— اختر —</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>رموز الأعطال</label>
            <input {...field('symbols_codes')} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>الكمية في المخزون</label>
              <input type="number" min="0" {...field('stock_quantity')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>الحد الأدنى (تنبيه النقص)</label>
              <input type="number" min="0" {...field('min_quantity')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>سعر الشراء (IQD)</label>
              <input type="text" inputMode="numeric" {...numericField('purchase_price')} className={inputClass} lang="en" dir="ltr" />
            </div>
            <div>
              <label className={labelClass}>سعر البيع (IQD)</label>
              <input type="text" inputMode="numeric" {...numericField('selling_price')} className={inputClass} lang="en" dir="ltr" />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 rounded-2xl border-2 border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors font-semibold text-sm"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-7 py-2.5 rounded-2xl font-bold text-sm text-white transition-all disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                boxShadow: '0 4px 15px rgba(124,58,237,0.35)',
              }}
            >
              {loading ? 'جارٍ الحفظ...' : mode === 'new' ? 'إضافة' : 'حفظ التعديلات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
