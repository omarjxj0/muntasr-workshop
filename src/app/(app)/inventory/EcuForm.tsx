'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { parseArabicNumerals, handleFinancialBlur } from '@/lib/utils'
import { Package, ArrowRight, Scan, MapPin, ChevronDown, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Static Hierarchy Data ──────────────────────────────────────────────────

type HierarchyMap = Record<string, {
  families: Record<string, {
    modelCodes: Record<string, string[]>
  }>
}>

const ECU_HIERARCHY: HierarchyMap = {
  SIM2K: {
    families: {
      '47':  { modelCodes: { NF: ['330', '331', '332', '333'], MG: ['330', '331'], UN: ['330'], TC: ['330'], LM: ['330'], OTHER: [] } },
      '140': { modelCodes: { NF: ['330', '331', '332'], MG: ['330', '331'], TD: ['330'], OTHER: [] } },
      '141': { modelCodes: { NF: ['330', '331', '332', '333', '2G330'], MG: ['330', '331', '332'], UN: ['330', '331'], TD: ['330'], TC: ['330', '331'], LM: ['330', '331'], OTHER: [] } },
      '241': { modelCodes: { NF: ['350', '351', '352'], MG: ['350', '351'], TD: ['350', '351'], TC: ['350'], LM: ['350'], OTHER: [] } },
      '341': { modelCodes: { NF: ['350', '351', '352'], MG: ['350', '351'], UN: ['350'], OTHER: [] } },
      '250': { modelCodes: { NF: ['330', '331', '332'], MG: ['330', '331'], OTHER: [] } },
      '259': { modelCodes: { NF: ['330', '331', '332', '333'], MG: ['330', '331'], UN: ['330'], OTHER: [] } },
      OTHER: { modelCodes: { OTHER: [] } },
    },
  },
  BOSCH: {
    families: {
      '47':  { modelCodes: { NF: ['9P347', '9P348'], MG: ['9MG47'], UN: ['9UN47'], OTHER: [] } },
      '140': { modelCodes: { NF: ['9NF140'], MG: ['9MG140'], TD: ['9TD140'], OTHER: [] } },
      '141': { modelCodes: { NF: ['2G330', '2G331', '2G332'], MG: ['2MG330', '2MG331'], UN: ['2UN141'], TD: ['2TD141'], TC: ['2TC141'], LM: ['2LM141'], OTHER: [] } },
      '241': { modelCodes: { NF: ['4NF241'], MG: ['4MG241'], UN: ['4UN241'], TD: ['4TD241'], TC: ['4TC241'], LM: ['4LM241'], OTHER: [] } },
      '341': { modelCodes: { NF: ['6NF341'], MG: ['6MG341'], UN: ['6UN341'], JA: ['6JA341'], KA: ['6KA341'], OTHER: [] } },
      '411': { modelCodes: { NF: ['8NF411'], MG: ['8MG411'], OTHER: [] } },
      OTHER: { modelCodes: { OTHER: [] } },
    },
  },
  DELPHI: {
    families: {
      DCM:  { modelCodes: { NF: ['DCM-NF01', 'DCM-NF02'], MG: ['DCM-MG01'], OTHER: [] } },
      MT:   { modelCodes: { NF: ['MT-NF1'], TD: ['MT-TD1'], OTHER: [] } },
      OTHER: { modelCodes: { OTHER: [] } },
    },
  },
  CONTINENTAL: {
    families: {
      SIM:  { modelCodes: { NF: ['SIM-NF1'], MG: ['SIM-MG1'], OTHER: [] } },
      EMS:  { modelCodes: { NF: ['EMS-NF1'], OTHER: [] } },
      OTHER: { modelCodes: { OTHER: [] } },
    },
  },
  DENSO: {
    families: {
      '275900': { modelCodes: { NF: ['275900-NF1'], OTHER: [] } },
      '276200': { modelCodes: { NF: ['276200-NF1'], OTHER: [] } },
      OTHER:    { modelCodes: { OTHER: [] } },
    },
  },
  SIEMENS: {
    families: {
      SIM: { modelCodes: { NF: ['SGSIM-NF'], OTHER: [] } },
      VDO: { modelCodes: { NF: ['VDO-NF1'],  OTHER: [] } },
      OTHER: { modelCodes: { OTHER: [] } },
    },
  },
}

const MANUFACTURERS = [...Object.keys(ECU_HIERARCHY), 'OTHER'] as const

// ─── Component ──────────────────────────────────────────────────────────────

interface EcuFormProps {
  mode: 'new' | 'edit'
  ecuId?: string
}

type FormState = {
  name: string
  company_id: string
  category_id: string
  barcode: string
  symbols_codes: string
  shelf_location: string
  stock_quantity: number
  min_quantity: number
  purchase_price: number
  selling_price: number
  quantity: number
  notes: string
  // Hierarchy
  manufacturer: string
  manufacturerCustom: string
  ecu_family: string
  familyCustom: string
  vehicle_model_code: string
  modelCodeCustom: string
  software_id: string
  softwareIdCustom: string
}

export default function EcuForm({ mode, ecuId }: EcuFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [companies, setCompanies] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  const [form, setForm] = useState<FormState>({
    name: '', company_id: '', category_id: '', barcode: '',
    symbols_codes: '', shelf_location: '',
    stock_quantity: 0, min_quantity: 3, purchase_price: 0, selling_price: 0,
    quantity: 1, notes: '',
    manufacturer: '', manufacturerCustom: '',
    ecu_family: '', familyCustom: '',
    vehicle_model_code: '', modelCodeCustom: '',
    software_id: '', softwareIdCustom: '',
  })

  // Ref for auto-focus on barcode field
  const barcodeRef = useRef<HTMLInputElement>(null)
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.from('ecu_companies').select('*').order('name').then(({ data }) => setCompanies(data ?? []))
    supabase.from('ecu_categories').select('*').order('name').then(({ data }) => setCategories(data ?? []))

    if (mode === 'edit' && ecuId) {
      supabase.from('ecus').select('*').eq('id', ecuId).single().then(({ data }: { data: any }) => {
        if (!data) return
        const mfr = data.manufacturer ?? ''
        const knownMfr = MANUFACTURERS.slice(0, -1).includes(mfr) ? mfr : (mfr ? 'OTHER' : '')
        const fam = data.ecu_family ?? ''
        const knownFams = knownMfr && knownMfr !== 'OTHER' ? Object.keys(ECU_HIERARCHY[knownMfr]?.families ?? {}) : []
        const knownFam = knownFams.includes(fam) ? fam : (fam ? 'OTHER' : '')
        const mc = data.vehicle_model_code ?? ''
        const knownMCs = (knownMfr && knownMfr !== 'OTHER' && knownFam && knownFam !== 'OTHER')
          ? Object.keys(ECU_HIERARCHY[knownMfr]?.families[knownFam]?.modelCodes ?? {})
          : []
        const knownMC = knownMCs.includes(mc) ? mc : (mc ? 'OTHER' : '')
        const sid = data.software_id ?? ''
        const knownSIDs = (knownMfr && knownMfr !== 'OTHER' && knownFam && knownFam !== 'OTHER' && knownMC && knownMC !== 'OTHER')
          ? ECU_HIERARCHY[knownMfr]?.families[knownFam]?.modelCodes[knownMC] ?? []
          : []
        const knownSID = knownSIDs.includes(sid) ? sid : (sid ? 'OTHER' : '')

        setForm({
          name: data.name ?? '',
          company_id: data.company_id ?? '',
          category_id: data.category_id ?? '',
          barcode: data.barcode ?? '',
          symbols_codes: data.symbols_codes ?? '',
          shelf_location: data.shelf_location ?? '',
          stock_quantity: data.stock_quantity ?? 0,
          min_quantity: data.min_quantity ?? 3,
          purchase_price: data.purchase_price ?? 0,
          selling_price: data.selling_price ?? 0,
          quantity: data.quantity ?? 1,
          notes: data.notes ?? '',
          manufacturer: knownMfr,
          manufacturerCustom: knownMfr === 'OTHER' ? mfr : '',
          ecu_family: knownFam,
          familyCustom: knownFam === 'OTHER' ? fam : '',
          vehicle_model_code: knownMC,
          modelCodeCustom: knownMC === 'OTHER' ? mc : '',
          software_id: knownSID,
          softwareIdCustom: knownSID === 'OTHER' ? sid : '',
        })
      })
    }

    const t = setTimeout(() => barcodeRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [mode, ecuId, supabase])

  // Global barcode scanner keyboard listener
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

  // ── Derived cascade values ────────────────────────────────────────────────

  const resolvedManufacturer =
    form.manufacturer === 'OTHER' ? form.manufacturerCustom :
    form.manufacturer

  const availableFamilies =
    form.manufacturer && form.manufacturer !== 'OTHER'
      ? Object.keys(ECU_HIERARCHY[form.manufacturer]?.families ?? {})
      : []

  const resolvedFamily =
    form.ecu_family === 'OTHER' ? form.familyCustom : form.ecu_family

  const availableModelCodes =
    form.manufacturer && form.manufacturer !== 'OTHER' &&
    form.ecu_family && form.ecu_family !== 'OTHER'
      ? Object.keys(ECU_HIERARCHY[form.manufacturer]?.families[form.ecu_family]?.modelCodes ?? {})
      : []

  const resolvedModelCode =
    form.vehicle_model_code === 'OTHER' ? form.modelCodeCustom : form.vehicle_model_code

  const availableSoftwareIds =
    form.manufacturer && form.manufacturer !== 'OTHER' &&
    form.ecu_family && form.ecu_family !== 'OTHER' &&
    form.vehicle_model_code && form.vehicle_model_code !== 'OTHER'
      ? ECU_HIERARCHY[form.manufacturer]?.families[form.ecu_family]?.modelCodes[form.vehicle_model_code] ?? []
      : []

  const resolvedSoftwareId =
    form.software_id === 'OTHER' ? form.softwareIdCustom : form.software_id

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const payload = {
      name: form.name,
      company_id: form.company_id || null,
      category_id: form.category_id || null,
      barcode: form.barcode || null,
      symbols_codes: form.symbols_codes || null,
      shelf_location: form.shelf_location || null,
      stock_quantity: form.stock_quantity,
      min_quantity: form.min_quantity,
      purchase_price: form.purchase_price,
      selling_price: form.selling_price,
      quantity: form.quantity,
      notes: form.notes || null,
      manufacturer: resolvedManufacturer || null,
      ecu_family: resolvedFamily || null,
      vehicle_model_code: resolvedModelCode || null,
      software_id: resolvedSoftwareId || null,
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

  const inputClass = "w-full px-4 py-3 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
  const labelClass = "text-sm text-slate-500 mb-1.5 block font-medium"
  const selectClass = `${inputClass} appearance-none cursor-pointer pr-10`

  // ── Cascading select helper ───────────────────────────────────────────────

  const CascadeSelect = ({
    label, value, onChange, options, placeholder, disabled, customValue, onCustomChange, showBadge,
  }: {
    label: string
    value: string
    onChange: (v: string) => void
    options: string[]
    placeholder: string
    disabled?: boolean
    customValue: string
    onCustomChange: (v: string) => void
    showBadge?: string
  }) => (
    <div className="space-y-2">
      <label className={labelClass}>
        {label}
        {showBadge && (
          <span className="mr-2 text-xs font-mono bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full">
            {showBadge}
          </span>
        )}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={e => {
            onChange(e.target.value)
          }}
          disabled={disabled}
          className={`${selectClass} ${disabled ? 'opacity-40 cursor-not-allowed bg-slate-50' : ''}`}
        >
          <option value="">{placeholder}</option>
          {options.map(o => (
            <option key={o} value={o}>{o === 'OTHER' ? '✏️ أخرى...' : o}</option>
          ))}
          {!options.includes('OTHER') && <option value="OTHER">✏️ أخرى...</option>}
        </select>
        <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
      {value === 'OTHER' && (
        <input
          type="text"
          value={customValue}
          onChange={e => onCustomChange(e.target.value)}
          placeholder="اكتب القيمة..."
          className={`${inputClass} font-mono`}
          dir="ltr"
          autoFocus
        />
      )}
    </div>
  )

  // ─── Hierarchy breadcrumb preview ─────────────────────────────────────────

  const breadcrumbParts = [
    resolvedManufacturer,
    resolvedFamily,
    resolvedModelCode,
    resolvedSoftwareId,
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

          {/* ── Company + Category ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>الشركة</label>
              <div className="relative">
                <select {...field('company_id')} className={selectClass}>
                  <option value="">— اختر —</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelClass}>النوع / الفئة</label>
              <div className="relative">
                <select {...field('category_id')} className={selectClass}>
                  <option value="">— اختر —</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════
              HIERARCHICAL ECU CLASSIFICATION
              ════════════════════════════════════════════════════════════ */}
          <div className="space-y-4 rounded-2xl border-2 border-violet-100 bg-violet-50/40 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-violet-700">تصنيف ECU الهرمي</p>
              {breadcrumbParts.length > 0 && (
                <p className="text-xs font-mono text-violet-500 bg-white border border-violet-200 px-3 py-1 rounded-full truncate max-w-[200px]">
                  {breadcrumbParts.join(' › ')}
                </p>
              )}
            </div>

            {/* Level 1: Manufacturer */}
            <CascadeSelect
              label="1. الصانع (Manufacturer)"
              value={form.manufacturer}
              onChange={v => setForm(p => ({ ...p, manufacturer: v, ecu_family: '', familyCustom: '', vehicle_model_code: '', modelCodeCustom: '', software_id: '', softwareIdCustom: '' }))}
              options={[...Object.keys(ECU_HIERARCHY)]}
              placeholder="— اختر الصانع —"
              customValue={form.manufacturerCustom}
              onCustomChange={v => setForm(p => ({ ...p, manufacturerCustom: v }))}
            />

            {/* Level 2: ECU Family */}
            <CascadeSelect
              label="2. العائلة (Family)"
              value={form.ecu_family}
              onChange={v => setForm(p => ({ ...p, ecu_family: v, vehicle_model_code: '', modelCodeCustom: '', software_id: '', softwareIdCustom: '' }))}
              options={availableFamilies}
              placeholder={form.manufacturer ? '— اختر العائلة —' : '— اختر الصانع أولاً —'}
              disabled={!form.manufacturer}
              customValue={form.familyCustom}
              onCustomChange={v => setForm(p => ({ ...p, familyCustom: v }))}
            />

            {/* Level 3: Vehicle Model Code */}
            <CascadeSelect
              label="3. كود الموديل (Model Code)"
              value={form.vehicle_model_code}
              onChange={v => setForm(p => ({ ...p, vehicle_model_code: v, software_id: '', softwareIdCustom: '' }))}
              options={availableModelCodes}
              placeholder={form.ecu_family ? '— اختر كود الموديل —' : '— اختر العائلة أولاً —'}
              disabled={!form.ecu_family}
              customValue={form.modelCodeCustom}
              onCustomChange={v => setForm(p => ({ ...p, modelCodeCustom: v }))}
            />

            {/* Level 4: Software / Part ID */}
            <CascadeSelect
              label="4. Software / Part ID"
              value={form.software_id}
              onChange={v => setForm(p => ({ ...p, software_id: v }))}
              options={availableSoftwareIds}
              placeholder={form.vehicle_model_code ? '— اختر Software ID —' : '— اختر الموديل أولاً —'}
              disabled={!form.vehicle_model_code}
              customValue={form.softwareIdCustom}
              onCustomChange={v => setForm(p => ({ ...p, softwareIdCustom: v }))}
              showBadge={resolvedSoftwareId || undefined}
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
