'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { parseArabicNumerals, handleFinancialBlur } from '@/lib/utils'
import { Package, ArrowRight, Scan, MapPin, ChevronDown, FileText, Loader2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── DB Row Types ────────────────────────────────────────────

type MfrRow   = { id: string; name: string }
type FamRow   = { id: string; name: string; manufacturer_id: string }
type McRow    = { id: string; name: string; family_id: string }
type SwIdRow  = { id: string; name: string; model_code_id: string }

// ─── Component ──────────────────────────────────────────────

interface EcuFormProps {
  mode: 'new' | 'edit'
  ecuId?: string
}

type FormState = {
  name: string
  barcode: string
  symbols_codes: string
  shelf_location: string
  stock_quantity: number
  min_quantity: number
  purchase_price: number
  selling_price: number
  quantity: number
  notes: string
  // Hierarchy — DB IDs (drive cascade filtering)
  manufacturer_id: string
  family_id: string
  model_code_id: string
  software_id_ref: string
  // Hierarchy — free-text when CUSTOM is chosen
  manufacturerCustom: string
  familyCustom: string
  modelCodeCustom: string
  softwareIdCustom: string
}

const EMPTY_FORM: FormState = {
  name: '', barcode: '',
  symbols_codes: '', shelf_location: '',
  stock_quantity: 0, min_quantity: 3, purchase_price: 0, selling_price: 0,
  quantity: 1, notes: '',
  manufacturer_id: '', family_id: '', model_code_id: '', software_id_ref: '',
  manufacturerCustom: '', familyCustom: '', modelCodeCustom: '', softwareIdCustom: '',
}

export default function EcuForm({ mode, ecuId }: EcuFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  // ── Hierarchy DB data ─────────────────────────────────────
  const [dbMfr,  setDbMfr]  = useState<MfrRow[]>([])
  const [dbFam,  setDbFam]  = useState<FamRow[]>([])
  const [dbMc,   setDbMc]   = useState<McRow[]>([])
  const [dbSwId, setDbSwId] = useState<SwIdRow[]>([])
  const [hierarchyLoading, setHierarchyLoading] = useState(true)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  // Ref for barcode scanner
  const barcodeRef = useRef<HTMLInputElement>(null)
  const bufferRef  = useRef('')
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load lookup tables ────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      // ── Hierarchy tables (migration 016) ───────────────────
      const [
        { data: mfrs,  error: eMfr },
        { data: fams  },
        { data: mcs   },
        { data: swids },
      ] = await Promise.all([
        supabase.from('ecu_manufacturers').select('id,name').order('name'),
        supabase.from('ecu_families').select('id,name,manufacturer_id').order('name'),
        supabase.from('ecu_model_codes').select('id,name,family_id').order('name'),
        supabase.from('ecu_software_ids').select('id,name,model_code_id').order('name'),
      ])
      if (eMfr) console.warn('[EcuForm] ecu_manufacturers not found — run migration 016')
      setDbMfr(mfrs  ?? [])
      setDbFam(fams  ?? [])
      setDbMc(mcs    ?? [])
      setDbSwId(swids ?? [])
      setHierarchyLoading(false)

      // ── Edit mode: load ECU and pre-select hierarchy ──────
      if (mode === 'edit' && ecuId) {
        const { data } = await supabase.from('ecus').select('*').eq('id', ecuId).single()
        if (!data) return

        // Match stored name strings back to DB rows
        const mfrRow  = (mfrs  ?? []).find((m: MfrRow) => m.name === data.manufacturer)
        const famRow  = (fams  ?? []).find((f: FamRow) => f.name === data.ecu_family && f.manufacturer_id === mfrRow?.id)
        const mcRow   = (mcs   ?? []).find((mc: McRow) => mc.name === data.vehicle_model_code && mc.family_id === famRow?.id)
        const swIdRow = (swids ?? []).find((s: SwIdRow) => s.name === data.software_id && s.model_code_id === mcRow?.id)

        setForm({
          name:           data.name            ?? '',
          barcode:        data.barcode         ?? '',
          symbols_codes:  data.symbols_codes   ?? '',
          shelf_location: data.shelf_location  ?? '',
          stock_quantity: data.stock_quantity  ?? 0,
          min_quantity:   data.min_quantity    ?? 3,
          purchase_price: data.purchase_price  ?? 0,
          selling_price:  data.selling_price   ?? 0,
          quantity:       data.quantity        ?? 1,
          notes:          data.notes           ?? '',
          // IDs (empty string = not found in DB → use CUSTOM)
          manufacturer_id:  mfrRow?.id  ?? (data.manufacturer      ? 'CUSTOM' : ''),
          family_id:        famRow?.id  ?? (data.ecu_family         ? 'CUSTOM' : ''),
          model_code_id:    mcRow?.id   ?? (data.vehicle_model_code ? 'CUSTOM' : ''),
          software_id_ref:  swIdRow?.id ?? (data.software_id        ? 'CUSTOM' : ''),
          // Custom fallback text
          manufacturerCustom: mfrRow  ? '' : (data.manufacturer      ?? ''),
          familyCustom:       famRow  ? '' : (data.ecu_family         ?? ''),
          modelCodeCustom:    mcRow   ? '' : (data.vehicle_model_code ?? ''),
          softwareIdCustom:   swIdRow ? '' : (data.software_id        ?? ''),
        })
      }
    }

    load()
    const t = setTimeout(() => barcodeRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [mode, ecuId]) // eslint-disable-line

  // ── Barcode scanner ───────────────────────────────────────

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isBarcodeField = target === barcodeRef.current
      const isOtherInput = (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && !isBarcodeField
      if (isOtherInput) return
      if (e.key === 'Enter') {
        const scanned = bufferRef.current.trim()
        bufferRef.current = ''
        if (scanned && scanned.length > 3) {
          setForm(prev => ({ ...prev, barcode: scanned }))
          barcodeRef.current?.focus()
        }
        return
      }
      if (e.key.length === 1) {
        bufferRef.current += e.key
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => { bufferRef.current = '' }, 100)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

  // ── Cascade derived lists ─────────────────────────────────

  const availableFamilies = dbFam.filter(f => f.manufacturer_id === form.manufacturer_id)
  const availableModelCodes = dbMc.filter(mc => mc.family_id === form.family_id)
  const availableSoftwareIds = dbSwId.filter(s => s.model_code_id === form.model_code_id)

  // ── Resolved name strings (for payload + breadcrumb) ──────

  const resolvedManufacturer =
    form.manufacturer_id === 'CUSTOM' ? form.manufacturerCustom
    : dbMfr.find(m => m.id === form.manufacturer_id)?.name ?? ''

  const resolvedFamily =
    form.family_id === 'CUSTOM' ? form.familyCustom
    : dbFam.find(f => f.id === form.family_id)?.name ?? ''

  const resolvedModelCode =
    form.model_code_id === 'CUSTOM' ? form.modelCodeCustom
    : dbMc.find(mc => mc.id === form.model_code_id)?.name ?? ''

  const resolvedSoftwareId =
    form.software_id_ref === 'CUSTOM' ? form.softwareIdCustom
    : dbSwId.find(s => s.id === form.software_id_ref)?.name ?? ''

  // ── Submit ────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const payload = {
      name:                form.name,
      barcode:             form.barcode       || null,
      symbols_codes:       form.symbols_codes || null,
      shelf_location:      form.shelf_location || null,
      stock_quantity:      form.stock_quantity,
      min_quantity:        form.min_quantity,
      purchase_price:      form.purchase_price,
      selling_price:       form.selling_price,
      quantity:            form.quantity,
      notes:               form.notes         || null,
      manufacturer:        resolvedManufacturer  || null,
      ecu_family:          resolvedFamily        || null,
      vehicle_model_code:  resolvedModelCode     || null,
      software_id:         resolvedSoftwareId    || null,
    }

    const { error } = mode === 'new'
      ? await supabase.from('ecus').insert(payload as any)
      : await supabase.from('ecus').update(payload as any).eq('id', ecuId!)

    if (error) { toast.error('فشل في الحفظ: ' + error.message); setLoading(false); return }
    toast.success(mode === 'new' ? 'تم إضافة الصنف' : 'تم تحديث الصنف')
    router.push('/inventory')
    router.refresh()
  }

  const field = (key: keyof FormState) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [key]: e.target.type === 'number' ? Number(e.target.value) : e.target.value })),
  })

  const numericField = (key: keyof FormState) => ({
    value: (form[key] as number) === 0 ? '' : form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(p => ({ ...p, [key]: Number(parseArabicNumerals(e.target.value)) || 0 })),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) =>
      setForm(p => ({ ...p, [key]: handleFinancialBlur(e.target.value) || 0 })),
  })

  const inputClass  = "w-full px-4 py-3 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
  const labelClass  = "text-sm text-slate-500 mb-1.5 block font-medium"
  const selectClass = `${inputClass} appearance-none cursor-pointer pr-10`

  // ── Cascading select helper ───────────────────────────────
  // items: { id, name }[] — id='CUSTOM' triggers text input
  // selectedId: the current value (uuid | 'CUSTOM' | '')

  const CascadeSelect = ({
    label, selectedId, onSelect, items, placeholder, disabled, customValue,
    onCustomChange, showBadge, isLoading,
  }: {
    label: string
    selectedId: string
    onSelect: (id: string) => void
    items: { id: string; name: string }[]
    placeholder: string
    disabled?: boolean
    customValue: string
    onCustomChange: (v: string) => void
    showBadge?: string
    isLoading?: boolean
  }) => {
    const isEmpty = !isLoading && !disabled && items.length === 0 && !!selectedId

    return (
      <div className="space-y-2">
        <label className={labelClass}>
          {label}
          {showBadge && (
            <span className="mr-2 text-xs font-mono bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full">
              {showBadge}
            </span>
          )}
          {isLoading && <Loader2 size={12} className="inline mr-2 animate-spin text-violet-400" />}
        </label>

        {/* Inline quick-add hint when parent has no children yet */}
        {isEmpty && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
            <Plus size={12} />
            لا توجد خيارات — يمكنك إضافتها من <strong>الإعدادات</strong> أو الكتابة مباشرة أدناه
          </p>
        )}

        <div className="relative">
          <select
            value={selectedId}
            onChange={e => onSelect(e.target.value)}
            disabled={disabled || isLoading}
            className={`${selectClass} ${(disabled || isLoading) ? 'opacity-40 cursor-not-allowed bg-slate-50' : ''}`}
          >
            <option value="">{placeholder}</option>
            {items.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
            <option value="CUSTOM">✏️ أخرى / كتابة يدوية...</option>
          </select>
          <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {(selectedId === 'CUSTOM' || isEmpty) && (
          <input
            type="text"
            value={customValue}
            onChange={e => onCustomChange(e.target.value)}
            placeholder="اكتب القيمة..."
            className={`${inputClass} font-mono`}
            dir="ltr"
            autoFocus={selectedId === 'CUSTOM'}
          />
        )}
      </div>
    )
  }

  // ── Breadcrumb preview ────────────────────────────────────

  const breadcrumbParts = [
    resolvedManufacturer, resolvedFamily, resolvedModelCode, resolvedSoftwareId,
  ].filter(Boolean)

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

          {/* ── Barcode ── */}
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
              value={form.barcode}
              onChange={e => setForm(p => ({ ...p, barcode: e.target.value }))}
              autoFocus
              className={`${inputClass} font-mono`}
              dir="ltr"
              placeholder="امسح الباركود أو اكتبه يدوياً..."
            />
          </div>

          {/* ── Name ── */}
          <div>
            <label className={labelClass}>اسم الصنف *</label>
            <input required {...field('name')} className={inputClass} />
          </div>


          {/* ════════════════════════════════════════════════════════════
              HIERARCHICAL ECU CLASSIFICATION (dynamic from DB)
              ════════════════════════════════════════════════════════════ */}
          <div className="space-y-4 rounded-2xl border-2 border-violet-100 bg-violet-50/40 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-violet-700">تصنيف ECU الهرمي</p>
              {breadcrumbParts.length > 0 && (
                <p className="text-xs font-mono text-violet-500 bg-white border border-violet-200 px-3 py-1 rounded-full truncate max-w-[220px]">
                  {breadcrumbParts.join(' › ')}
                </p>
              )}
            </div>

            {/* Level 1: Manufacturer */}
            <CascadeSelect
              label="1. الصانع (Manufacturer)"
              selectedId={form.manufacturer_id}
              onSelect={v => setForm(p => ({
                ...p,
                manufacturer_id: v, manufacturerCustom: '',
                family_id: '', familyCustom: '',
                model_code_id: '', modelCodeCustom: '',
                software_id_ref: '', softwareIdCustom: '',
              }))}
              items={dbMfr}
              placeholder="— اختر الصانع —"
              customValue={form.manufacturerCustom}
              onCustomChange={v => setForm(p => ({ ...p, manufacturerCustom: v }))}
              isLoading={hierarchyLoading}
            />

            {/* Level 2: Family */}
            <CascadeSelect
              label="2. العائلة (Family)"
              selectedId={form.family_id}
              onSelect={v => setForm(p => ({
                ...p,
                family_id: v, familyCustom: '',
                model_code_id: '', modelCodeCustom: '',
                software_id_ref: '', softwareIdCustom: '',
              }))}
              items={availableFamilies}
              placeholder={form.manufacturer_id ? '— اختر العائلة —' : '— اختر الصانع أولاً —'}
              disabled={!form.manufacturer_id}
              customValue={form.familyCustom}
              onCustomChange={v => setForm(p => ({ ...p, familyCustom: v }))}
              isLoading={hierarchyLoading}
            />

            {/* Level 3: Model Code */}
            <CascadeSelect
              label="3. كود الموديل (Model Code)"
              selectedId={form.model_code_id}
              onSelect={v => setForm(p => ({
                ...p,
                model_code_id: v, modelCodeCustom: '',
                software_id_ref: '', softwareIdCustom: '',
              }))}
              items={availableModelCodes}
              placeholder={form.family_id ? '— اختر كود الموديل —' : '— اختر العائلة أولاً —'}
              disabled={!form.family_id}
              customValue={form.modelCodeCustom}
              onCustomChange={v => setForm(p => ({ ...p, modelCodeCustom: v }))}
              isLoading={hierarchyLoading}
            />

            {/* Level 4: Software / Part ID */}
            <CascadeSelect
              label="4. Software / Part ID"
              selectedId={form.software_id_ref}
              onSelect={v => setForm(p => ({ ...p, software_id_ref: v, softwareIdCustom: '' }))}
              items={availableSoftwareIds}
              placeholder={form.model_code_id ? '— اختر Software ID —' : '— اختر الموديل أولاً —'}
              disabled={!form.model_code_id}
              customValue={form.softwareIdCustom}
              onCustomChange={v => setForm(p => ({ ...p, softwareIdCustom: v }))}
              showBadge={resolvedSoftwareId || undefined}
              isLoading={hierarchyLoading}
            />
          </div>

          {/* ── Symbols Codes ── */}
          <div>
            <label className={labelClass}>رموز الأعطال</label>
            <input {...field('symbols_codes')} className={inputClass} />
          </div>

          {/* ── Shelf Location ── */}
          <div>
            <label className={labelClass}>
              <span className="flex items-center gap-1.5">
                <MapPin size={14} className="text-violet-500" />
                موقع الرف
              </span>
            </label>
            <input
              {...field('shelf_location')}
              className={inputClass}
              dir="auto"
              placeholder="مثال: الرف الأول، الرف الثاني، خانة 3"
            />
          </div>

          {/* ── Quantities & Prices ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>الكمية في المخزون</label>
              <input type="number" min="0" {...field('stock_quantity')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>الحد الأدنى (تنبيه)</label>
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

          {/* ── Notes ── */}
          <div>
            <label className={labelClass}>
              <span className="flex items-center gap-1.5">
                <FileText size={14} className="text-violet-500" />
                ملاحظات
              </span>
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3}
              placeholder="ملاحظات إضافية عن هذا الصنف..."
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* ── Actions ── */}
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
