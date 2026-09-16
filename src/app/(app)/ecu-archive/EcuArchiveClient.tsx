'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  Cpu, Plus, Search, X, Download, Image as ImageIcon, Zap,
  Upload, FileText, Clipboard, CheckCircle2, AlertTriangle,
  Eye, Trash2, ChevronDown, ChevronUp, Package, Calendar,
  HardDrive, Hash, Car, StickyNote, ZoomIn,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { EcuFlashArchive } from '@/lib/types'

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  initialRecords: EcuFlashArchive[]
  stockMap: Record<string, number>       // barcode → stock qty
  isAdmin: boolean
}

interface FormState {
  rawLog: string
  vin: string
  software_id: string
  hardware_id: string
  ecu_module: string
  car_name: string
  notes: string
}

const EMPTY_FORM: FormState = {
  rawLog: '', vin: '', software_id: '', hardware_id: '',
  ecu_module: '', car_name: '', notes: '',
}

// ── Regex Parser ───────────────────────────────────────────────────────────

function parseLog(log: string): Partial<FormState> {
  const extract = (patterns: RegExp[]): string => {
    for (const re of patterns) {
      const m = log.match(re)
      if (m?.[1]?.trim()) return m[1].trim()
    }
    return ''
  }
  return {
    vin: extract([/VIN\s*[:\-=]\s*(\S+)/i, /Chassis\s*[:\-=]\s*(\S+)/i, /Barcode\s*[:\-=]\s*(\S+)/i]),
    software_id: extract([/Calibration\s*[:\-=]\s*(\S+)/i, /SW\s*[:\-=]\s*(\S+)/i, /Software\s*[:\-=]\s*(\S+)/i, /Cal\s*[:\-=]\s*(\S+)/i]),
    hardware_id: extract([/Hardware\s*[:\-=]\s*(\S+)/i, /HW\s*[:\-=]\s*(\S+)/i, /HW_Version\s*[:\-=]\s*(\S+)/i]),
    ecu_module: extract([/Module\s*[:\-=]\s*(.+)/i, /ECU\s*[:\-=]\s*(.+)/i, /Unit\s*[:\-=]\s*(.+)/i, /Controller\s*[:\-=]\s*(.+)/i]),
    car_name: extract([/Vehicle\s*[:\-=]\s*(.+)/i, /Car\s*[:\-=]\s*(.+)/i, /Model\s*[:\-=]\s*(.+)/i, /Make\s*[:\-=]\s*(.+)/i]),
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function StockBadge({ vin, stockMap }: { vin: string | null; stockMap: Record<string, number> }) {
  if (!vin) return null
  const qty = stockMap[vin]
  if (qty === undefined) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
        تم البيع / غير متوفر
      </span>
    )
  }
  if (qty <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
        <AlertTriangle size={11} /> نفد المخزون
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <Package size={11} /> في المخزون ({qty})
    </span>
  )
}

function MetaChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-slate-400 shrink-0">{icon}</span>
      <span className="text-[11px] text-slate-500 shrink-0">{label}:</span>
      <span className="font-mono text-xs font-semibold text-slate-800 truncate">{value}</span>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function EcuArchiveClient({ initialRecords, stockMap, isAdmin }: Props) {
  const supabase = createClient()

  // ── State ────────────────────────────────────────────────────────────────
  const [records, setRecords] = useState<EcuFlashArchive[]>(initialRecords)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [flashFile, setFlashFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [localStockMap, setLocalStockMap] = useState(stockMap)

  const flashInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Refresh stock map occasionally (lightweight)
  useEffect(() => {
    setLocalStockMap(stockMap)
  }, [stockMap])

  // ── Log Parser ───────────────────────────────────────────────────────────
  const handleLogPaste = useCallback((val: string) => {
    setForm(prev => {
      const parsed = parseLog(val)
      return {
        ...prev,
        rawLog: val,
        vin:         parsed.vin         || prev.vin,
        software_id: parsed.software_id || prev.software_id,
        hardware_id: parsed.hardware_id || prev.hardware_id,
        ecu_module:  parsed.ecu_module  || prev.ecu_module,
        car_name:    parsed.car_name    || prev.car_name,
      }
    })
  }, [])

  // ── Search Filter ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return records
    return records.filter(r =>
      [r.vin, r.software_id, r.hardware_id, r.car_name, r.ecu_module, r.notes]
        .some(f => f?.toLowerCase().includes(q))
    )
  }, [records, search])

  // ── File Upload Helper ───────────────────────────────────────────────────
  async function uploadFile(file: File, folder: string, recordId: string): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `${recordId}/${folder}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('ecu_vault').upload(path, file, { upsert: true })
    if (error) throw error
    return path
  }

  // ── Download Handler ─────────────────────────────────────────────────────
  async function handleDownload(record: EcuFlashArchive) {
    if (!record.flash_file_path) return
    const { data, error } = await supabase.storage
      .from('ecu_vault')
      .createSignedUrl(record.flash_file_path, 60)
    if (error || !data?.signedUrl) {
      toast.error('فشل توليد رابط التحميل')
      return
    }
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = record.flash_file_name || 'flash_file'
    a.click()
  }

  // ── Image Preview Handler ─────────────────────────────────────────────────
  async function handleImagePreview(record: EcuFlashArchive) {
    if (!record.image_path) return
    const { data, error } = await supabase.storage
      .from('ecu_vault')
      .createSignedUrl(record.image_path, 120)
    if (error || !data?.signedUrl) {
      toast.error('فشل تحميل الصورة')
      return
    }
    setLightboxUrl(data.signedUrl)
  }

  // ── Save Record ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.vin && !form.software_id && !form.ecu_module) {
      toast.error('يجب إدخال VIN أو Software ID أو نوع الوحدة على الأقل')
      return
    }
    setSaving(true)
    try {
      const newId = crypto.randomUUID()

      // Upload flash file
      let flashPath: string | null = null
      if (flashFile) {
        flashPath = await uploadFile(flashFile, 'flash', newId)
      }

      // Upload image
      let imagePath: string | null = null
      if (imageFile) {
        imagePath = await uploadFile(imageFile, 'images', newId)
      }

      const { data, error } = await supabase
        .from('ecu_flash_archive')
        .insert({
          id: newId,
          vin:             form.vin || null,
          software_id:     form.software_id || null,
          hardware_id:     form.hardware_id || null,
          ecu_module:      form.ecu_module || null,
          car_name:        form.car_name || null,
          notes:           form.notes || null,
          flash_file_path: flashPath,
          flash_file_name: flashFile?.name || null,
          image_path:      imagePath,
        })
        .select()
        .single()

      if (error) throw error

      setRecords(prev => [data as EcuFlashArchive, ...prev])
      setShowModal(false)
      setForm(EMPTY_FORM)
      setFlashFile(null)
      setImageFile(null)
      toast.success('تم حفظ السجل في بنك الملفات ✓')
    } catch (err: any) {
      console.error(err)
      toast.error(`فشل الحفظ: ${err?.message ?? 'خطأ غير معروف'}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete Record ────────────────────────────────────────────────────────
  async function handleDelete(record: EcuFlashArchive) {
    if (!confirm(`هل تريد حذف هذا السجل بشكل نهائي؟\nVIN: ${record.vin || '—'}`)) return
    setDeletingId(record.id)
    try {
      // Delete storage objects if they exist
      const toDelete: string[] = []
      if (record.flash_file_path) toDelete.push(record.flash_file_path)
      if (record.image_path) toDelete.push(record.image_path)
      if (toDelete.length) {
        await supabase.storage.from('ecu_vault').remove(toDelete)
      }

      const { error } = await supabase.from('ecu_flash_archive').delete().eq('id', record.id)
      if (error) throw error

      setRecords(prev => prev.filter(r => r.id !== record.id))
      toast.success('تم حذف السجل')
    } catch (err: any) {
      toast.error(`فشل الحذف: ${err?.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
            >
              <Cpu size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 leading-tight">بنك ملفات العقول</h1>
              <p className="text-sm text-slate-500">ECU Flash Archive & Data Bank</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {records.length} سجل محفوظ • السجلات محمية بشكل دائم ومستقلة عن المخزون
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 8px 24px rgba(109,40,217,0.35)' }}
          >
            <Plus size={18} />
            إضافة عقل إلى بنك الملفات
          </button>
        )}
      </div>

      {/* ── Search Bar ── */}
      <div className="relative mb-6">
        <Search size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث سريع: VIN، Software ID، Hardware ID، اسم السيارة، نوع الوحدة..."
          className="w-full pr-11 pl-10 py-3.5 rounded-2xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent shadow-sm transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={15} />
          </button>
        )}
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'إجمالي السجلات', value: records.length, color: 'violet' },
          { label: 'نتائج البحث', value: filtered.length, color: 'blue' },
          { label: 'مع ملف فلاش', value: records.filter(r => r.flash_file_path).length, color: 'emerald' },
          { label: 'في المخزون حالياً', value: records.filter(r => r.vin && (localStockMap[r.vin] ?? 0) > 0).length, color: 'amber' },
        ].map(({ label, value, color }) => (
          <div key={label} className={cn(
            'bg-white rounded-2xl border p-4 shadow-sm',
            color === 'violet' ? 'border-violet-100' :
            color === 'blue' ? 'border-blue-100' :
            color === 'emerald' ? 'border-emerald-100' : 'border-amber-100'
          )}>
            <div className={cn(
              'text-2xl font-extrabold',
              color === 'violet' ? 'text-violet-700' :
              color === 'blue' ? 'text-blue-700' :
              color === 'emerald' ? 'text-emerald-700' : 'text-amber-700'
            )}>{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Records List ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-3xl bg-violet-50 flex items-center justify-center mb-4 border border-violet-100">
            <Cpu size={36} className="text-violet-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-600 mb-1">
            {search ? 'لا توجد نتائج مطابقة' : 'بنك الملفات فارغ'}
          </h3>
          <p className="text-sm text-slate-400 max-w-sm">
            {search
              ? `لم يتم العثور على سجل يطابق "${search}"`
              : 'أضف أول سجل عبر زر "إضافة عقل إلى بنك الملفات" أعلاه'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(record => {
            const isExpanded = expandedId === record.id
            const inStock = record.vin ? (localStockMap[record.vin] ?? undefined) : undefined

            return (
              <div
                key={record.id}
                className={cn(
                  'bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all duration-200',
                  isExpanded ? 'border-violet-300 shadow-md' : 'border-slate-100 hover:border-violet-200'
                )}
              >
                {/* ── Card Header (always visible) ── */}
                <div
                  className="p-4 sm:p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-violet-50/20 transition-colors select-none"
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      className={cn(
                        'mt-0.5 p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-700 transition-all duration-200 shrink-0',
                        isExpanded && 'bg-violet-100 text-violet-700'
                      )}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Top row: VIN + Module */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {record.vin ? (
                          <span className="font-mono text-sm font-extrabold text-violet-700 bg-violet-100/90 border border-violet-300 px-2.5 py-0.5 rounded-xl shadow-xs">
                            {record.vin}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">بدون VIN</span>
                        )}
                        {record.ecu_module && (
                          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                            {record.ecu_module}
                          </span>
                        )}
                        {record.car_name && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Car size={11} className="text-slate-400" />
                            {record.car_name}
                          </span>
                        )}
                      </div>

                      {/* Meta chips */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <MetaChip icon={<Hash size={11} />} label="SW" value={record.software_id} />
                        <MetaChip icon={<HardDrive size={11} />} label="HW" value={record.hardware_id} />
                        {record.notes && (
                          <div className="flex items-center gap-1.5">
                            <StickyNote size={11} className="text-amber-500 shrink-0" />
                            <span className="text-[11px] text-amber-700 font-medium">{record.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side: badges + date */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0 sm:flex-col sm:items-end sm:gap-1.5">
                    <StockBadge vin={record.vin} stockMap={localStockMap} />
                    {record.flash_file_path && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <FileText size={10} /> ملف فلاش
                      </span>
                    )}
                    {record.image_path && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200">
                        <ImageIcon size={10} /> صورة
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar size={10} />
                      {formatDate(record.created_at)}
                    </span>
                  </div>
                </div>

                {/* ── Expanded Detail Panel ── */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5 space-y-4">
                    {/* Full details grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: 'VIN / Barcode', value: record.vin, mono: true },
                        { label: 'نوع الوحدة / Module', value: record.ecu_module, mono: false },
                        { label: 'Software ID / Calibration', value: record.software_id, mono: true },
                        { label: 'Hardware ID', value: record.hardware_id, mono: true },
                        { label: 'اسم السيارة', value: record.car_name, mono: false },
                        { label: 'ملاحظات', value: record.notes, mono: false },
                      ].map(({ label, value, mono }) => value ? (
                        <div key={label} className="bg-white rounded-xl border border-slate-100 px-4 py-3">
                          <div className="text-[11px] text-slate-400 mb-0.5">{label}</div>
                          <div className={cn('text-sm font-semibold text-slate-800 break-all', mono && 'font-mono')}>{value}</div>
                        </div>
                      ) : null)}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {record.flash_file_path && (
                        <button
                          onClick={() => handleDownload(record)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                        >
                          <Download size={15} />
                          تحميل ملف الفلاش
                          {record.flash_file_name && (
                            <span className="font-normal opacity-80 text-xs">({record.flash_file_name})</span>
                          )}
                        </button>
                      )}

                      {record.image_path && (
                        <button
                          onClick={() => handleImagePreview(record)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-fuchsia-600 text-white hover:bg-fuchsia-700 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                        >
                          <ZoomIn size={15} />
                          عرض الصورة
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(record)}
                          disabled={deletingId === record.id}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-600 hover:text-white transition-all duration-200 active:scale-95 disabled:opacity-50 mr-auto"
                        >
                          <Trash2 size={15} />
                          {deletingId === record.id ? 'جاري الحذف...' : 'حذف السجل'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          Quick Add Modal
         ══════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => !saving && setShowModal(false)}
          />

          {/* Modal Panel */}
          <div
            className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl bg-white"
            style={{ boxShadow: '0 30px 80px rgba(109,40,217,0.25)' }}
          >
            {/* Modal Header */}
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white/95 backdrop-blur-sm rounded-t-3xl"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                >
                  <Plus size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-base">إضافة عقل إلى بنك الملفات</h2>
                  <p className="text-[11px] text-slate-400">الصق تقرير الـ ID أو أدخل البيانات يدوياً</p>
                </div>
              </div>
              <button
                onClick={() => !saving && setShowModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* ── Fast Log Parser ── */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <Clipboard size={15} className="text-violet-500" />
                  لصق تقرير الـ ID السريع (PCMflash / KTAG / Scan Tools)
                </label>
                <textarea
                  rows={5}
                  value={form.rawLog}
                  onChange={e => handleLogPaste(e.target.value)}
                  placeholder={"الصق تقرير الأداة هنا...\nمثال:\nVIN: WBAAA12345678\nCalibration: 8512345\nHardware: 7654321\nModule: Bosch MED17.1\nVehicle: BMW 5 Series 2018"}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-mono text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none transition-all"
                />
                {form.rawLog && (
                  <p className="text-[11px] text-violet-600 mt-1.5 flex items-center gap-1.5">
                    <CheckCircle2 size={11} />
                    تم تحليل التقرير — راجع الحقول أدناه وعدّلها إذا لزم الأمر
                  </p>
                )}
              </div>

              <div className="border-t border-dashed border-slate-200 pt-4">
                <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide">البيانات المستخرجة / اليدوية</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* VIN */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">VIN / Barcode *</label>
                    <input
                      type="text"
                      value={form.vin}
                      onChange={e => setForm(p => ({ ...p, vin: e.target.value }))}
                      placeholder="WBAAA12345678..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-mono text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Software ID */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Software ID / Calibration</label>
                    <input
                      type="text"
                      value={form.software_id}
                      onChange={e => setForm(p => ({ ...p, software_id: e.target.value }))}
                      placeholder="8512345..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-mono text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Hardware ID */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Hardware ID</label>
                    <input
                      type="text"
                      value={form.hardware_id}
                      onChange={e => setForm(p => ({ ...p, hardware_id: e.target.value }))}
                      placeholder="7654321..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-mono text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* ECU Module */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">ECU / Module Family</label>
                    <input
                      type="text"
                      value={form.ecu_module}
                      onChange={e => setForm(p => ({ ...p, ecu_module: e.target.value }))}
                      placeholder="Bosch MED17.1..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Car Name */}
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">اسم السيارة / Vehicle</label>
                    <input
                      type="text"
                      value={form.car_name}
                      onChange={e => setForm(p => ({ ...p, car_name: e.target.value }))}
                      placeholder="BMW 5 Series 2018..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Notes */}
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">
                      <StickyNote size={12} className="inline ml-1 text-amber-500" />
                      ملاحظات (مثال: Immo Off، Stage 1، Stock، Tuned)
                    </label>
                    <input
                      type="text"
                      value={form.notes}
                      onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Stock / Immo Off / Stage 1..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* ── File Uploads ── */}
              <div className="border-t border-dashed border-slate-200 pt-4 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">رفع الملفات إلى ecu_vault</p>

                {/* Flash File */}
                <div
                  onClick={() => flashInputRef.current?.click()}
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
                    flashFile ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/30'
                  )}
                >
                  <div className={cn('p-2.5 rounded-xl', flashFile ? 'bg-blue-100' : 'bg-slate-100')}>
                    <Upload size={18} className={flashFile ? 'text-blue-600' : 'text-slate-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700">ملف الفلاش (Flash File)</p>
                    <p className="text-xs text-slate-400">{flashFile ? flashFile.name : '.bin, .hex, .ori, .rar, .zip'}</p>
                  </div>
                  {flashFile && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setFlashFile(null) }}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <input
                    ref={flashInputRef}
                    type="file"
                    accept=".bin,.hex,.ori,.rar,.zip"
                    className="hidden"
                    onChange={e => setFlashFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                {/* Image File */}
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
                    imageFile ? 'border-fuchsia-300 bg-fuchsia-50/50' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/30'
                  )}
                >
                  <div className={cn('p-2.5 rounded-xl', imageFile ? 'bg-fuchsia-100' : 'bg-slate-100')}>
                    <ImageIcon size={18} className={imageFile ? 'text-fuchsia-600' : 'text-slate-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700">صورة العقل / Pinout (اختياري)</p>
                    <p className="text-xs text-slate-400">{imageFile ? imageFile.name : 'صورة لاصقة ECU أو توصيلات Pinout'}</p>
                  </div>
                  {imageFile && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setImageFile(null) }}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => setImageFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              {/* ── Action Buttons ── */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 8px 24px rgba(109,40,217,0.35)' }}
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جاري الحفظ والرفع...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <CheckCircle2 size={16} />
                      حفظ في بنك الملفات
                    </span>
                  )}
                </button>
                <button
                  onClick={() => !saving && setShowModal(false)}
                  disabled={saving}
                  className="px-5 py-3.5 rounded-2xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all duration-200 disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2.5 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxUrl}
            alt="صورة ECU"
            className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
