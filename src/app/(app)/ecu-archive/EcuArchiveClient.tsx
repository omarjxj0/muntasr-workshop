'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  Cpu, Plus, Search, X, Download, Image as ImageIcon, Zap,
  Upload, FileText, Clipboard, CheckCircle2, AlertTriangle,
  Trash2, ChevronDown, ChevronUp, Package, Calendar,
  HardDrive, Hash, Car, StickyNote, ZoomIn, Gauge, Tag, Code,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type {
  EcuFlashArchive, ArchiveFileEntry,
  ArchiveCustomLabels,
} from '@/lib/types'
import { ARCHIVE_LABEL_DEFAULTS } from '@/lib/types'

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  initialRecords: EcuFlashArchive[]
  stockMap: Record<string, number>
  isAdmin: boolean
}

/** A single key-value pair in extra_data / the extra fields editor */
interface ExtraField { key: string; value: string }

/** The core identified fields */
interface FormState {
  rawLog:      string
  vin:         string
  software_id: string
  part_number: string
  sw_version:  string
  hardware_id: string
  ecu_module:  string
  car_name:    string
  engine_size: string
  notes:       string
}

const EMPTY_FORM: FormState = {
  rawLog: '', vin: '', software_id: '', part_number: '', sw_version: '',
  hardware_id: '', ecu_module: '', car_name: '', engine_size: '', notes: '',
}

// ── Parser ─────────────────────────────────────────────────────────────────
//
// Strategy:
//  1. Split the pasted text into "Key: Value" lines.
//  2. Map known keys to specific FormState fields.
//  3. Everything else becomes ExtraField rows.

/** Keys that map directly to FormState fields (case-insensitive) */
const KNOWN_KEY_MAP: Record<string, keyof FormState> = {
  vin:             'vin',
  chassis:         'vin',
  barcode:         'vin',
  calibration:     'software_id',
  'sw id':         'software_id',
  'software id':   'software_id',
  sw:              'software_id',
  software:        'software_id',
  cal:             'software_id',
  'part number':   'part_number',
  part:            'part_number',
  partnumber:      'part_number',
  'sw version':    'sw_version',
  swversion:       'sw_version',
  version:         'sw_version',
  hardware:        'hardware_id',
  hw:              'hardware_id',
  'hardware id':   'hardware_id',
  hw_version:      'hardware_id',
  ecu:             'ecu_module',
  module:          'ecu_module',
  unit:            'ecu_module',
  controller:      'ecu_module',
  'module family': 'ecu_module',
  vehicle:         'car_name',
  car:             'car_name',
  make:            'car_name',
  model:           'car_name',
  engine:          'engine_size',
  displacement:    'engine_size',
  cc:              'engine_size',
}

/** Keys we intentionally skip (not useful to surface) */
const SKIP_KEYS = new Set(['', 'ok', 'done', 'info'])

interface ParseResult {
  fields: Partial<FormState>
  extra:  ExtraField[]
}

function parseLog(log: string): ParseResult {
  const fields: Partial<FormState> = {}
  const extra:  ExtraField[] = []

  for (const raw of log.split(/\r?\n/)) {
    const colonIdx = raw.indexOf(':')
    if (colonIdx < 1) continue
    const rawKey = raw.slice(0, colonIdx).trim()
    const val    = raw.slice(colonIdx + 1).trim()
    if (!val) continue

    const normalKey = rawKey.toLowerCase().replace(/_/g, ' ')
    const mapped = KNOWN_KEY_MAP[normalKey]

    if (mapped) {
      // Only fill if we haven't already found this field
      if (!fields[mapped]) (fields as any)[mapped] = val
    } else if (!SKIP_KEYS.has(normalKey)) {
      // Avoid duplicates
      if (!extra.some(e => e.key.toLowerCase() === rawKey.toLowerCase())) {
        extra.push({ key: rawKey, value: val })
      }
    }
  }

  return { fields, extra }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(b?: number) {
  if (!b) return ''
  if (b < 1024)          return `${b} B`
  if (b < 1024 * 1024)   return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

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

// ── Pending-files badge list ───────────────────────────────────────────────

function PendingFileBadges({
  files, onRemove, color,
}: { files: File[]; onRemove: (i: number) => void; color: 'blue' | 'fuchsia' }) {
  if (!files.length) return null
  const cls = color === 'blue'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {files.map((f, i) => (
        <span
          key={`${f.name}-${i}`}
          className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[11px] font-medium border ${cls}`}
        >
          <FileText size={10} />
          <span className="max-w-[160px] truncate">{f.name}</span>
          {f.size ? <span className="opacity-60">({formatBytes(f.size)})</span> : null}
          <button type="button" onClick={() => onRemove(i)} className="rounded-full hover:opacity-70 ml-0.5">
            <X size={11} />
          </button>
        </span>
      ))}
    </div>
  )
}

// ── Input style helper ─────────────────────────────────────────────────────

const fieldCls = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all'
const monoFieldCls = fieldCls + ' font-mono'

// ══════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════

export default function EcuArchiveClient({ initialRecords, stockMap, isAdmin }: Props) {
  const supabase = createClient()

  // ── State ────────────────────────────────────────────────────────────────
  const [records,      setRecords]      = useState<EcuFlashArchive[]>(initialRecords)
  const [search,       setSearch]       = useState('')
  const [showModal,    setShowModal]    = useState(false)
  const [form,         setForm]         = useState<FormState>(EMPTY_FORM)
  const [extraFields,  setExtraFields]  = useState<ExtraField[]>([])
  const [flashFiles,   setFlashFiles]   = useState<File[]>([])
  const [imageFiles,   setImageFiles]   = useState<File[]>([])
  const [saving,       setSaving]       = useState(false)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [lightboxUrl,  setLightboxUrl]  = useState<string | null>(null)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)
  const [localStockMap, setLocalStockMap] = useState(stockMap)
  const [labels,       setLabels]       = useState<ArchiveCustomLabels>(ARCHIVE_LABEL_DEFAULTS)

  const flashInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // ── Load custom labels ────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'archive_custom_labels')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          try { setLabels({ ...ARCHIVE_LABEL_DEFAULTS, ...JSON.parse(data.value) }) }
          catch { /* ignore */ }
        }
      })
  }, []) // eslint-disable-line

  useEffect(() => { setLocalStockMap(stockMap) }, [stockMap])

  const lbl = (key: string) => labels[key]?.label ?? ARCHIVE_LABEL_DEFAULTS[key]?.label ?? key
  const visible = (key: string) => labels[key]?.visible !== false

  // ── Log parser ────────────────────────────────────────────────────────
  const handleLogPaste = useCallback((val: string) => {
    const { fields, extra } = parseLog(val)
    setForm(prev => ({
      ...prev,
      rawLog:      val,
      vin:         fields.vin         || prev.vin,
      software_id: fields.software_id || prev.software_id,
      part_number: fields.part_number || prev.part_number,
      sw_version:  fields.sw_version  || prev.sw_version,
      hardware_id: fields.hardware_id || prev.hardware_id,
      ecu_module:  fields.ecu_module  || prev.ecu_module,
      car_name:    fields.car_name    || prev.car_name,
      engine_size: fields.engine_size || prev.engine_size,
    }))
    // Merge extra fields (append new keys, don't overwrite manual ones)
    setExtraFields(prev => {
      const existingKeys = new Set(prev.map(e => e.key.toLowerCase()))
      const toAdd = extra.filter(e => !existingKeys.has(e.key.toLowerCase()))
      return [...prev, ...toAdd]
    })
  }, [])

  // ── Extra-data field management ───────────────────────────────────────
  const addExtraField = () =>
    setExtraFields(prev => [...prev, { key: '', value: '' }])

  const updateExtra = (idx: number, patch: Partial<ExtraField>) =>
    setExtraFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f))

  const removeExtra = (idx: number) =>
    setExtraFields(prev => prev.filter((_, i) => i !== idx))

  // Build extra_data JSONB object from the rows (skip blank keys)
  const buildExtraData = () =>
    Object.fromEntries(
      extraFields
        .filter(f => f.key.trim())
        .map(f => [f.key.trim(), f.value.trim()])
    )

  // ── File selection (multiple, dedup by name) ──────────────────────────
  function mergeFiles(existing: File[], incoming: FileList | null): File[] {
    if (!incoming) return existing
    const names = new Set(existing.map(f => f.name))
    const next = [...existing]
    Array.from(incoming).forEach(f => { if (!names.has(f.name)) { next.push(f); names.add(f.name) } })
    return next
  }

  // ── Search filter ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return records
    return records.filter(r => {
      const extraVals = Object.values(r.extra_data ?? {}).join(' ')
      return [r.vin, r.software_id, r.hardware_id, r.car_name, r.ecu_module,
              r.engine_size, r.part_number, r.sw_version, r.notes, extraVals]
        .some(f => f?.toLowerCase().includes(q))
    })
  }, [records, search])

  // ── Upload helper ─────────────────────────────────────────────────────
  async function uploadFile(file: File, folder: string, recordId: string): Promise<ArchiveFileEntry> {
    const ext = file.name.split('.').pop()
    const path = `${recordId}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`
    const { error } = await supabase.storage.from('ecu_vault').upload(path, file, { upsert: true })
    if (error) throw error
    return { name: file.name, path, size: file.size }
  }

  // ── Download (signed URL) ─────────────────────────────────────────────
  async function downloadEntry(entry: ArchiveFileEntry) {
    const { data, error } = await supabase.storage.from('ecu_vault').createSignedUrl(entry.path, 120)
    if (error || !data?.signedUrl) { toast.error('فشل توليد رابط التحميل'); return }
    const a = document.createElement('a'); a.href = data.signedUrl; a.download = entry.name; a.click()
  }

  async function downloadLegacy(record: EcuFlashArchive) {
    if (!record.flash_file_path) return
    const { data, error } = await supabase.storage.from('ecu_vault').createSignedUrl(record.flash_file_path, 60)
    if (error || !data?.signedUrl) { toast.error('فشل توليد رابط التحميل'); return }
    const a = document.createElement('a'); a.href = data.signedUrl; a.download = record.flash_file_name || 'flash_file'; a.click()
  }

  // ── Image lightbox ────────────────────────────────────────────────────
  async function openImageLightbox(path: string) {
    const { data, error } = await supabase.storage.from('ecu_vault').createSignedUrl(path, 120)
    if (error || !data?.signedUrl) { toast.error('فشل تحميل الصورة'); return }
    setLightboxUrl(data.signedUrl)
  }

  // ── Reset modal ───────────────────────────────────────────────────────
  function resetModal() {
    setShowModal(false)
    setForm(EMPTY_FORM)
    setExtraFields([])
    setFlashFiles([])
    setImageFiles([])
  }

  // ── Save Record ───────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.vin && !form.software_id && !form.part_number && !form.ecu_module) {
      toast.error('يجب إدخال VIN أو Software ID أو رقم القطعة أو نوع الوحدة على الأقل')
      return
    }
    setSaving(true)
    try {
      const newId = crypto.randomUUID()

      const flashEntries: ArchiveFileEntry[] = await Promise.all(
        flashFiles.map(f => uploadFile(f, 'flash', newId))
      )
      const imageEntries: ArchiveFileEntry[] = await Promise.all(
        imageFiles.map(f => uploadFile(f, 'images', newId))
      )

      const extra_data = buildExtraData()

      const payload = {
        id:          newId,
        vin:         form.vin         || null,
        software_id: form.software_id || null,
        hardware_id: form.hardware_id || null,
        ecu_module:  form.ecu_module  || null,
        car_name:    form.car_name    || null,
        engine_size: form.engine_size || null,
        part_number: form.part_number || null,
        sw_version:  form.sw_version  || null,
        notes:       form.notes       || null,
        extra_data,
        flash_files: flashEntries,
        images:      imageEntries,
        // Fill legacy columns from first file for backward-compat
        flash_file_path: flashEntries[0]?.path ?? null,
        flash_file_name: flashEntries[0]?.name ?? null,
        image_path:      imageEntries[0]?.path ?? null,
      }

      const { data, error } = await supabase
        .from('ecu_flash_archive')
        .insert(payload)
        .select()
        .single()

      if (error) throw error

      setRecords(prev => [data as EcuFlashArchive, ...prev])
      resetModal()
      toast.success('تم حفظ السجل في بنك الملفات ✓')
    } catch (err: any) {
      console.error(err)
      toast.error(`فشل الحفظ: ${err?.message ?? 'خطأ غير معروف'}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete Record ─────────────────────────────────────────────────────
  async function handleDelete(record: EcuFlashArchive) {
    if (!confirm(`هل تريد حذف هذا السجل بشكل نهائي؟\nVIN: ${record.vin || '—'}`)) return
    setDeletingId(record.id)
    try {
      const toDelete = [
        ...(record.flash_files ?? []).map(f => f.path),
        ...(record.images      ?? []).map(f => f.path),
        ...(record.flash_file_path ? [record.flash_file_path] : []),
        ...(record.image_path      ? [record.image_path]      : []),
      ]
      if (toDelete.length) await supabase.storage.from('ecu_vault').remove(toDelete)
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

  // ── Derived counts ────────────────────────────────────────────────────
  function flashCount(r: EcuFlashArchive) {
    const n = (r.flash_files ?? []).length
    return n > 0 ? n : r.flash_file_path ? 1 : 0
  }
  function imageCount(r: EcuFlashArchive) {
    const n = (r.images ?? []).length
    return n > 0 ? n : r.image_path ? 1 : 0
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
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
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث: VIN، Part Number، SW Version، Software ID، Hardware ID، اسم السيارة..."
          className="w-full pr-11 pl-10 py-3.5 rounded-2xl border border-slate-200 bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm transition-all"
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
          { label: 'إجمالي السجلات',   value: records.length,                                                        color: 'violet'  },
          { label: 'نتائج البحث',       value: filtered.length,                                                       color: 'blue'    },
          { label: 'مع ملف فلاش',       value: records.filter(r => flashCount(r) > 0).length,                        color: 'emerald' },
          { label: 'في المخزون حالياً', value: records.filter(r => r.vin && (localStockMap[r.vin] ?? 0) > 0).length, color: 'amber'   },
        ].map(({ label, value, color }) => (
          <div key={label} className={cn('bg-white rounded-2xl border p-4 shadow-sm',
            color === 'violet'  ? 'border-violet-100'  :
            color === 'blue'    ? 'border-blue-100'    :
            color === 'emerald' ? 'border-emerald-100' : 'border-amber-100')}>
            <div className={cn('text-2xl font-extrabold',
              color === 'violet'  ? 'text-violet-700'  :
              color === 'blue'    ? 'text-blue-700'    :
              color === 'emerald' ? 'text-emerald-700' : 'text-amber-700')}>{value}</div>
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
            const fc = flashCount(record)
            const ic = imageCount(record)
            const flashList: ArchiveFileEntry[] = (record.flash_files ?? []).length > 0
              ? record.flash_files
              : record.flash_file_path ? [{ name: record.flash_file_name || 'flash_file', path: record.flash_file_path }] : []
            const imageList: ArchiveFileEntry[] = (record.images ?? []).length > 0
              ? record.images
              : record.image_path ? [{ name: 'image', path: record.image_path }] : []
            const extraEntries = Object.entries(record.extra_data ?? {})

            return (
              <div key={record.id} className={cn(
                'bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all duration-200',
                isExpanded ? 'border-violet-300 shadow-md' : 'border-slate-100 hover:border-violet-200'
              )}>
                {/* Card Header */}
                <div
                  className="p-4 sm:p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-violet-50/20 transition-colors select-none"
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button type="button" className={cn(
                      'mt-0.5 p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-700 transition-all shrink-0',
                      isExpanded && 'bg-violet-100 text-violet-700'
                    )}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    <div className="flex-1 min-w-0 space-y-2">
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
                            <Car size={11} className="text-slate-400" />{record.car_name}
                          </span>
                        )}
                        {record.engine_size && visible('engine_size') && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Gauge size={11} className="text-slate-400" />{record.engine_size}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <MetaChip icon={<Hash size={11} />}       label="SW"   value={record.software_id} />
                        <MetaChip icon={<Tag size={11} />}        label="Part" value={record.part_number} />
                        <MetaChip icon={<Code size={11} />}       label="Ver"  value={record.sw_version} />
                        <MetaChip icon={<HardDrive size={11} />}  label="HW"   value={record.hardware_id} />
                        {record.notes && (
                          <div className="flex items-center gap-1.5">
                            <StickyNote size={11} className="text-amber-500 shrink-0" />
                            <span className="text-[11px] text-amber-700 font-medium">{record.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right badges */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0 sm:flex-col sm:items-end sm:gap-1.5">
                    <StockBadge vin={record.vin} stockMap={localStockMap} />
                    {fc > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <FileText size={10} /> {fc > 1 ? `${fc} ملفات` : 'ملف فلاش'}
                      </span>
                    )}
                    {ic > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200">
                        <ImageIcon size={10} /> {ic > 1 ? `${ic} صور` : 'صورة'}
                      </span>
                    )}
                    {extraEntries.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        +{extraEntries.length} بيانات
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar size={10} />{formatDate(record.created_at)}
                    </span>
                  </div>
                </div>

                {/* Expanded Panel */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5 space-y-5">

                    {/* Main fields grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { key: 'vin',         label: 'VIN / Barcode',            value: record.vin,         mono: true,  always: true  },
                        { key: 'ecu_module',  label: lbl('ecu_module'),           value: record.ecu_module,  mono: false, always: false },
                        { key: 'software_id', label: 'Software ID / Calibration', value: record.software_id, mono: true,  always: true  },
                        { key: 'part_number', label: lbl('part_number'),           value: record.part_number, mono: true,  always: false },
                        { key: 'sw_version',  label: lbl('sw_version'),            value: record.sw_version,  mono: true,  always: false },
                        { key: 'hardware_id', label: lbl('hardware_id'),           value: record.hardware_id, mono: true,  always: false },
                        { key: 'car_name',    label: lbl('car_name'),              value: record.car_name,    mono: false, always: false },
                        { key: 'engine_size', label: lbl('engine_size'),           value: record.engine_size, mono: false, always: false },
                        { key: 'notes',       label: 'ملاحظات',                  value: record.notes,       mono: false, always: true  },
                      ].filter(({ key, value, always }) => value && (always || visible(key)))
                       .map(({ key, label, value, mono }) => (
                        <div key={key} className="bg-white rounded-xl border border-slate-100 px-4 py-3">
                          <div className="text-[11px] text-slate-400 mb-0.5">{label}</div>
                          <div className={cn('text-sm font-semibold text-slate-800 break-all', mono && 'font-mono')}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Extra Data section */}
                    {extraEntries.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Zap size={12} className="text-amber-500" />
                          بيانات إضافية مستخرجة ({extraEntries.length})
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {extraEntries.map(([k, v]) => (
                            <div key={k} className="bg-white rounded-xl border border-amber-100 px-4 py-2.5 flex items-baseline gap-2">
                              <span className="text-[11px] text-amber-600 font-mono font-bold shrink-0">{k}:</span>
                              <span className="text-xs text-slate-700 break-all">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Flash Files Download List */}
                    {flashList.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <FileText size={12} className="text-blue-500" />
                          ملفات الفلاش ({flashList.length})
                        </p>
                        <div className="space-y-2">
                          {flashList.map((entry, i) => (
                            <div key={i} className="flex items-center gap-3 bg-white border border-blue-100 rounded-xl px-4 py-2.5">
                              <FileText size={15} className="text-blue-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">{entry.name}</p>
                                {entry.size && <p className="text-[11px] text-slate-400">{formatBytes(entry.size)}</p>}
                              </div>
                              <button
                                onClick={() => downloadEntry(entry)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors active:scale-95 shrink-0"
                              >
                                <Download size={12} /> تحميل
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Image Thumbnail Gallery */}
                    {imageList.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <ImageIcon size={12} className="text-fuchsia-500" />
                          الصور ({imageList.length})
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {imageList.map((entry, i) => (
                            <button
                              key={i}
                              onClick={() => openImageLightbox(entry.path)}
                              className="group relative w-24 h-24 rounded-2xl border-2 border-fuchsia-100 bg-fuchsia-50 overflow-hidden hover:border-fuchsia-400 transition-all hover:shadow-lg"
                              title={entry.name}
                            >
                              <div className="absolute inset-0 flex items-center justify-center">
                                <ImageIcon size={28} className="text-fuchsia-300 group-hover:opacity-0 transition-opacity" />
                                <ZoomIn size={20} className="text-fuchsia-600 absolute opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <p className="absolute bottom-0 inset-x-0 bg-fuchsia-900/70 text-white text-[9px] px-1.5 py-1 truncate text-center">
                                {entry.name}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Legacy single-file fallback */}
                    {flashList.length === 0 && record.flash_file_path && (
                      <button
                        onClick={() => downloadLegacy(record)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all active:scale-95"
                      >
                        <Download size={15} /> تحميل ملف الفلاش
                        {record.flash_file_name && <span className="font-normal opacity-80 text-xs">({record.flash_file_name})</span>}
                      </button>
                    )}

                    {/* Delete */}
                    {isAdmin && (
                      <div className="flex justify-end pt-1 border-t border-slate-100">
                        <button
                          onClick={() => handleDelete(record)}
                          disabled={deletingId === record.id}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-600 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                          {deletingId === record.id ? 'جاري الحذف...' : 'حذف السجل'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          Quick Add Modal
         ════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !saving && resetModal()} />
          <div
            className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl bg-white"
            style={{ boxShadow: '0 30px 80px rgba(109,40,217,0.25)' }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white/95 backdrop-blur-sm rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                  <Plus size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-base">إضافة عقل إلى بنك الملفات</h2>
                  <p className="text-[11px] text-slate-400">الصق تقرير الـ ID أو أدخل البيانات يدوياً</p>
                </div>
              </div>
              <button onClick={() => !saving && resetModal()} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
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
                  rows={6}
                  value={form.rawLog}
                  onChange={e => handleLogPaste(e.target.value)}
                  placeholder={
                    "الصق تقرير الأداة هنا (Key: Value)...\n" +
                    "مثال:\n" +
                    "VIN: WAUZZZ8U9CR058808\n" +
                    "Part Number: 03L906018PJ\n" +
                    "SW Version: 9978\n" +
                    "Hardware: R4 2.0l TDI CLLB\n" +
                    "ECU: EDC17C46\n" +
                    "Protocol: J1962 ISO15765-4\n" +
                    "ASAM: CAL_Bosch_EDC17C46_CR4"
                  }
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-mono text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none transition-all"
                />
                {form.rawLog && (
                  <p className="text-[11px] text-violet-600 mt-1.5 flex items-center gap-1.5">
                    <CheckCircle2 size={11} />
                    تم تحليل التقرير — راجع الحقول أدناه وعدّلها إذا لزم الأمر
                  </p>
                )}
              </div>

              {/* ── Primary Fields ── */}
              <div className="border-t border-dashed border-slate-200 pt-4">
                <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide">الحقول الأساسية</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  {/* VIN */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">VIN / Barcode *</label>
                    <input type="text" value={form.vin}
                      onChange={e => setForm(p => ({ ...p, vin: e.target.value }))}
                      placeholder="WAUZZZ8U9CR058808..."
                      className={monoFieldCls} />
                  </div>

                  {/* ECU Module */}
                  {visible('ecu_module') && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">{lbl('ecu_module')}</label>
                      <input type="text" value={form.ecu_module}
                        onChange={e => setForm(p => ({ ...p, ecu_module: e.target.value }))}
                        placeholder="EDC17C46 / Bosch MED17..."
                        className={fieldCls} />
                    </div>
                  )}

                  {/* Software ID */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Software ID / Calibration</label>
                    <input type="text" value={form.software_id}
                      onChange={e => setForm(p => ({ ...p, software_id: e.target.value }))}
                      placeholder="8512345..."
                      className={monoFieldCls} />
                  </div>

                  {/* Part Number */}
                  {visible('part_number') && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">{lbl('part_number')}</label>
                      <input type="text" value={form.part_number}
                        onChange={e => setForm(p => ({ ...p, part_number: e.target.value }))}
                        placeholder="03L906018PJ..."
                        className={monoFieldCls} />
                    </div>
                  )}

                  {/* SW Version */}
                  {visible('sw_version') && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">{lbl('sw_version')}</label>
                      <input type="text" value={form.sw_version}
                        onChange={e => setForm(p => ({ ...p, sw_version: e.target.value }))}
                        placeholder="9978..."
                        className={monoFieldCls} />
                    </div>
                  )}

                  {/* Hardware ID */}
                  {visible('hardware_id') && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">{lbl('hardware_id')}</label>
                      <input type="text" value={form.hardware_id}
                        onChange={e => setForm(p => ({ ...p, hardware_id: e.target.value }))}
                        placeholder="R4 2.0l TDI CLLB..."
                        className={monoFieldCls} />
                    </div>
                  )}

                  {/* Car Name */}
                  {visible('car_name') && (
                    <div className={cn(visible('engine_size') ? '' : 'sm:col-span-2')}>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">{lbl('car_name')}</label>
                      <input type="text" value={form.car_name}
                        onChange={e => setForm(p => ({ ...p, car_name: e.target.value }))}
                        placeholder="Audi A4 2.0 TDI 2012..."
                        className={fieldCls} />
                    </div>
                  )}

                  {/* Engine Size */}
                  {visible('engine_size') && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">{lbl('engine_size')}</label>
                      <input type="text" value={form.engine_size}
                        onChange={e => setForm(p => ({ ...p, engine_size: e.target.value }))}
                        placeholder="2000cc / 2.0T..."
                        className={fieldCls} />
                    </div>
                  )}

                  {/* Notes */}
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">
                      <StickyNote size={12} className="inline ml-1 text-amber-500" />
                      ملاحظات (مثال: Immo Off، Stage 1، Stock، Tuned)
                    </label>
                    <input type="text" value={form.notes}
                      onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Stock / Immo Off / Stage 1..."
                      className={fieldCls} />
                  </div>
                </div>
              </div>

              {/* ── Extra Data (dynamic key-value rows) ── */}
              <div className="border-t border-dashed border-slate-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Zap size={12} className="text-amber-500" />
                    بيانات إضافية مستخرجة
                    {extraFields.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700">
                        {extraFields.length}
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={addExtraField}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700 transition-colors"
                  >
                    <Plus size={12} /> إضافة حقل جديد
                  </button>
                </div>

                {extraFields.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-xl">
                    الحقول الإضافية المُعرَّفة في التقرير ستظهر هنا تلقائياً
                  </p>
                ) : (
                  <div className="space-y-2">
                    {extraFields.map((ef, i) => (
                      <div key={i} className="flex gap-2 items-center group">
                        <input
                          type="text"
                          value={ef.key}
                          onChange={e => updateExtra(i, { key: e.target.value })}
                          placeholder="اسم الحقل (Key)"
                          className="w-36 shrink-0 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono text-amber-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all"
                          dir="ltr"
                        />
                        <span className="text-slate-400 text-sm shrink-0">:</span>
                        <input
                          type="text"
                          value={ef.value}
                          onChange={e => updateExtra(i, { value: e.target.value })}
                          placeholder="القيمة (Value)"
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => removeExtra(i)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-rose-50 shrink-0"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── File Uploads ── */}
              <div className="border-t border-dashed border-slate-200 pt-4 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">رفع الملفات إلى ecu_vault</p>

                {/* Flash Files */}
                <div>
                  <div
                    onClick={() => flashInputRef.current?.click()}
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
                      flashFiles.length > 0 ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/30'
                    )}
                  >
                    <div className={cn('p-2.5 rounded-xl', flashFiles.length > 0 ? 'bg-blue-100' : 'bg-slate-100')}>
                      <Upload size={18} className={flashFiles.length > 0 ? 'text-blue-600' : 'text-slate-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700">ملفات الفلاش (Flash Files)</p>
                      <p className="text-xs text-slate-400">
                        {flashFiles.length > 0 ? `${flashFiles.length} ملف محدد` : '.bin, .hex, .ori, .rar, .zip — يمكن اختيار أكثر من ملف'}
                      </p>
                    </div>
                    <input ref={flashInputRef} type="file" multiple accept=".bin,.hex,.ori,.rar,.zip" className="hidden"
                      onChange={e => setFlashFiles(prev => mergeFiles(prev, e.target.files))} />
                  </div>
                  <PendingFileBadges files={flashFiles} onRemove={i => setFlashFiles(prev => prev.filter((_, j) => j !== i))} color="blue" />
                </div>

                {/* Image Files */}
                <div>
                  <div
                    onClick={() => imageInputRef.current?.click()}
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
                      imageFiles.length > 0 ? 'border-fuchsia-300 bg-fuchsia-50/50' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/30'
                    )}
                  >
                    <div className={cn('p-2.5 rounded-xl', imageFiles.length > 0 ? 'bg-fuchsia-100' : 'bg-slate-100')}>
                      <ImageIcon size={18} className={imageFiles.length > 0 ? 'text-fuchsia-600' : 'text-slate-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700">صور العقل / Pinout (اختياري)</p>
                      <p className="text-xs text-slate-400">
                        {imageFiles.length > 0 ? `${imageFiles.length} صورة محددة` : 'صور لاصقة ECU أو توصيلات Pinout — يمكن اختيار أكثر من صورة'}
                      </p>
                    </div>
                    <input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden"
                      onChange={e => setImageFiles(prev => mergeFiles(prev, e.target.files))} />
                  </div>
                  <PendingFileBadges files={imageFiles} onRemove={i => setImageFiles(prev => prev.filter((_, j) => j !== i))} color="fuchsia" />
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
                  onClick={() => !saving && resetModal()}
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
          <button className="absolute top-4 right-4 p-2.5 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-colors" onClick={() => setLightboxUrl(null)}>
            <X size={20} />
          </button>
          <img
            src={lightboxUrl} alt="صورة ECU"
            className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
