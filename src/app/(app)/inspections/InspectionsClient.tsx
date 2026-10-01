'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import {
  Stethoscope, Plus, Search, X, Car, Cpu, Phone,
  User, Image as ImageIcon, Upload, Trash2, ZoomIn,
  Calendar, DollarSign, AlertCircle, Printer,
  StickyNote, CheckCircle2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatCurrency, cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { QuickInspection, InspectionType, ImageEntry } from '@/lib/types'

const BUCKET = 'inspection_images'

const fieldCls =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 ' +
  'placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all'

function formatBytes(b?: number) {
  if (!b) return ''
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB'
  return (b / 1024 / 1024).toFixed(1) + ' MB'
}

function parseFaultBadges(raw: string | null): string[] {
  if (!raw) return []
  const codes = raw.match(/[PCBU][0-9A-Fa-f]{4}/g) ?? []
  return [...new Set(codes.map(c => c.toUpperCase()))].slice(0, 6)
}

interface Props { initialRecords: QuickInspection[]; isAdmin: boolean }

interface FormState {
  type: InspectionType; customer_name: string; phone: string
  subject: string; fault_codes: string; inspection_fee: string; notes: string
}

const EMPTY_FORM: FormState = {
  type: 'car', customer_name: '', phone: '', subject: '',
  fault_codes: '', inspection_fee: '', notes: '',
}

function TypeBadge({ type }: { type: InspectionType }) {
  return type === 'car' ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
      <Car size={11} /> فحص سيارة
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
      <Cpu size={11} /> فحص عقل ECU
    </span>
  )
}

function FaultBadge({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
      {code}
    </span>
  )
}

export default function InspectionsClient({ initialRecords, isAdmin }: Props) {
  const supabase = createClient()
  const [records, setRecords] = useState<QuickInspection[]>(initialRecords)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return records
    return records.filter(r =>
      [r.customer_name, r.subject, r.fault_codes, r.phone, r.notes]
        .some(f => f?.toLowerCase().includes(q))
    )
  }, [records, search])

  function mergeFiles(existing: File[], incoming: FileList | File[] | null): File[] {
    if (!incoming) return existing
    const names = new Set(existing.map(f => f.name))
    const next = [...existing]
    Array.from(incoming).forEach(f => { if (!names.has(f.name)) { next.push(f); names.add(f.name) } })
    return next
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length) setImageFiles(prev => mergeFiles(prev, files))
  }, []) // eslint-disable-line

  async function uploadImage(file: File, recordId: string): Promise<ImageEntry> {
    const ext = file.name.split('.').pop()
    const filePath = recordId + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '.' + ext
    const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, { upsert: true })
    if (error) throw error
    return { name: file.name, path: filePath, size: file.size }
  }

  async function openLightbox(imgPath: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(imgPath, 120)
    if (error || !data?.signedUrl) { toast.error('فشل تحميل الصورة'); return }
    setLightboxUrl(data.signedUrl)
  }

  function resetModal() { setShowModal(false); setForm(EMPTY_FORM); setImageFiles([]) }

  async function handleSave() {
    if (!form.customer_name.trim()) { toast.error('اسم الزبون مطلوب'); return }
    setSaving(true)
    try {
      const newId = crypto.randomUUID()
      const imageEntries: ImageEntry[] = await Promise.all(imageFiles.map(f => uploadImage(f, newId)))
      const fee = parseFloat(form.inspection_fee.replace(/,/g, '')) || 0
      const payload = {
        id: newId, type: form.type, customer_name: form.customer_name.trim(),
        phone: form.phone.trim() || null, subject: form.subject.trim() || null,
        fault_codes: form.fault_codes.trim() || null, image_paths: imageEntries,
        inspection_fee: fee, notes: form.notes.trim() || null,
      }
      const { data, error } = await supabase.from('quick_inspections').insert(payload).select().single()
      if (error) throw error
      setRecords(prev => [data as QuickInspection, ...prev])
      resetModal(); toast.success('تم حفظ الفحص بنجاح ✓')
    } catch (err: any) {
      console.error(err)
      toast.error('فشل الحفظ: ' + (err?.message ?? 'خطأ غير معروف'))
    } finally { setSaving(false) }
  }

  async function handleDelete(record: QuickInspection) {
    if (!confirm('هل تريد حذف فحص “' + record.customer_name + '” بشكل نهائي؟')) return
    setDeletingId(record.id)
    try {
      const paths = record.image_paths.map(img => img.path)
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
      const { error } = await supabase.from('quick_inspections').delete().eq('id', record.id)
      if (error) throw error
      setRecords(prev => prev.filter(r => r.id !== record.id))
      toast.success('تم حذف السجل')
    } catch (err: any) { toast.error('فشل الحذف: ' + err?.message)
    } finally { setDeletingId(null) }
  }

  function handlePrint(record: QuickInspection) {
    const typeLabel = record.type === 'car' ? 'فحص سيارة' : 'فحص عقل ECU'
    const win = window.open('', '_blank', 'width=600,height=800')
    if (!win) return
    const rows: [string, string][] = []
    rows.push(['اسم الزبون', record.customer_name])
    if (record.phone) rows.push(['رقم الهاتف', record.phone])
    if (record.subject) rows.push([record.type === 'car' ? 'نوع السيارة' : 'نوع العقل', record.subject])
    if (record.fault_codes) rows.push(['رموز الأعطال', '<pre style="font-size:12px;margin:0;white-space:pre-wrap">' + record.fault_codes + '</pre>'])
    rows.push(['أجور الفحص', formatCurrency(record.inspection_fee)])
    if (record.notes) rows.push(['ملاحظات', record.notes])
    const tableRows = rows.map(([k, v]) => '<tr><td>' + k + '</td><td>' + v + '</td></tr>').join('')
    win.document.write('<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير</title>'
      + '<style>body{font-family:Segoe UI,sans-serif;padding:32px;color:#1e293b;direction:rtl}'
      + 'table{width:100%;border-collapse:collapse}td{padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px}'
      + 'td:first-child{font-weight:600;color:#475569;width:35%}'
      + '.footer{margin-top:24px;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:12px}'
      + '</style></head><body>'
      + '<h2>تقرير الفحص السريع — ' + typeLabel + '</h2>'
      + '<p style="color:#64748b;margin-bottom:16px">' + formatDate(record.created_at) + '</p>'
      + '<table>' + tableRows + '</table>'
      + '<div class="footer">ورشة منتصر لكهرباء السيارات</div>'
      + '</body></html>')
    win.document.close(); win.print()
  }

  const totalFees = records.reduce((s, r) => s + (r.inspection_fee || 0), 0)
  const carCount = records.filter(r => r.type === 'car').length
  const ecuCount = records.filter(r => r.type === 'ecu').length

  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}>
              <Stethoscope size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 leading-tight">سجل الفحوصات السريعة</h1>
              <p className="text-sm text-slate-500">Quick Inspections Log</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">{records.length} فحص مسجّل • {carCount} سيارة • {ecuCount} عقل ECU</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 shrink-0" style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)', boxShadow: '0 8px 24px rgba(13,148,136,0.35)' }}>
          <Plus size={18} /> + تسجيل فحص جديد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {([
          { label: 'إجمالي الفحوصات', value: String(records.length), color: 'teal' },
          { label: 'فحوصات سيارات', value: String(carCount), color: 'sky' },
          { label: 'فحوصات عقول ECU', value: String(ecuCount), color: 'violet' },
          { label: 'إجمالي الأجور', value: formatCurrency(totalFees), color: 'emerald' },
        ] as const).map(({ label, value, color }) => (
          <div key={label} className={cn('bg-white rounded-2xl border p-4 shadow-sm',
            color === 'teal' ? 'border-teal-100' : color === 'sky' ? 'border-sky-100' : color === 'violet' ? 'border-violet-100' : 'border-emerald-100')}>
            <div className={cn('text-2xl font-extrabold',
              color === 'teal' ? 'text-teal-700' : color === 'sky' ? 'text-sky-700' : color === 'violet' ? 'text-violet-700' : 'text-emerald-700')}>{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث: اسم الزبون، نوع السيارة، رمز العطل..."
          className="w-full pr-11 pl-10 py-3.5 rounded-2xl border border-slate-200 bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 shadow-sm transition-all" />
        {search && <button onClick={() => setSearch('')} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={15} /></button>}
      </div>

      {/* Records */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-3xl bg-teal-50 flex items-center justify-center mb-4 border border-teal-100"><Stethoscope size={36} className="text-teal-300" /></div>
          <h3 className="text-lg font-bold text-slate-600 mb-1">{search ? 'لا توجد نتائج مطابقة' : 'لا توجد فحوصات مسجّلة بعد'}</h3>
          <p className="text-sm text-slate-400 max-w-sm">{search ? 'لم يتم العثور على فحص يطابق “' + search + '”' : 'ابدأ بتسجيل أول فحص عبر زر “+ تسجيل فحص جديد” أعلاه'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(record => {
            const dtcBadges = parseFaultBadges(record.fault_codes)
            const isExpanded = expandedId === record.id
            return (
              <div key={record.id} className={cn('bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all duration-200', isExpanded ? 'border-teal-300 shadow-md' : 'border-slate-100 hover:border-teal-200')}>
                <div className="p-4 sm:p-5 cursor-pointer flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:bg-teal-50/20 transition-colors select-none" onClick={() => setExpandedId(isExpanded ? null : record.id)}>
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn('mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0', record.type === 'car' ? 'bg-sky-100 text-sky-600' : 'bg-violet-100 text-violet-600')}>
                      {record.type === 'car' ? <Car size={18} /> : <Cpu size={18} />}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-base">{record.customer_name}</span>
                        <TypeBadge type={record.type} />
                      </div>
                      {record.subject && <p className="text-sm text-slate-600 font-medium">{record.subject}</p>}
                      {dtcBadges.length > 0 && <div className="flex flex-wrap gap-1.5">{dtcBadges.map(code => <FaultBadge key={code} code={code} />)}</div>}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
                        {record.phone && <span className="flex items-center gap-1"><Phone size={11} /> {record.phone}</span>}
                        <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(record.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap shrink-0 sm:flex-col sm:items-end sm:gap-1.5">
                    {record.inspection_fee > 0 && <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><DollarSign size={11} /> {formatCurrency(record.inspection_fee)}</span>}
                    {record.image_paths.length > 0 && <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200"><ImageIcon size={10} /> {record.image_paths.length} صورة</span>}
                    {record.fault_codes && dtcBadges.length === 0 && <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"><AlertCircle size={10} /> أعطال</span>}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: record.type === 'car' ? 'نوع السيارة / الموديل' : 'نوع العقل / السيارة', value: record.subject, icon: record.type === 'car' ? <Car size={13} className="text-sky-500" /> : <Cpu size={13} className="text-violet-500" /> },
                        { label: 'رقم الهاتف', value: record.phone, icon: <Phone size={13} className="text-slate-400" /> },
                        { label: 'أجور الفحص', value: record.inspection_fee > 0 ? formatCurrency(record.inspection_fee) : null, icon: <DollarSign size={13} className="text-emerald-500" /> },
                      ].filter(f => f.value).map(f => (
                        <div key={f.label} className="bg-white rounded-xl border border-slate-100 px-4 py-3">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">{f.icon}{f.label}</div>
                          <div className="text-sm font-semibold text-slate-800">{f.value}</div>
                        </div>
                      ))}
                    </div>

                    {record.fault_codes && (
                      <div className="bg-rose-50 rounded-xl border border-rose-100 p-4">
                        <p className="text-xs font-bold text-rose-600 mb-2 flex items-center gap-1.5"><AlertCircle size={13} /> رموز وتفاصيل الأعطال</p>
                        <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">{record.fault_codes}</pre>
                        {dtcBadges.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{dtcBadges.map(code => <FaultBadge key={code} code={code} />)}</div>}
                      </div>
                    )}

                    {record.notes && (
                      <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
                        <p className="text-xs font-bold text-amber-600 mb-1.5 flex items-center gap-1.5"><StickyNote size={13} /> ملاحظات</p>
                        <p className="text-sm text-slate-700">{record.notes}</p>
                      </div>
                    )}

                    {record.image_paths.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><ImageIcon size={12} className="text-fuchsia-500" /> الصور ({record.image_paths.length})</p>
                        <div className="flex flex-wrap gap-3">
                          {record.image_paths.map((img, i) => (
                            <button key={i} onClick={() => openLightbox(img.path)} className="group relative w-24 h-24 rounded-2xl border-2 border-fuchsia-100 bg-fuchsia-50 overflow-hidden hover:border-fuchsia-400 transition-all hover:shadow-lg" title={img.name}>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <ImageIcon size={28} className="text-fuchsia-300 group-hover:opacity-0 transition-opacity" />
                                <ZoomIn size={20} className="text-fuchsia-600 absolute opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <p className="absolute bottom-0 inset-x-0 bg-fuchsia-900/70 text-white text-[9px] px-1.5 py-1 truncate text-center">{img.name}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 flex-wrap gap-2">
                      <button onClick={() => handlePrint(record)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-all active:scale-95">
                        <Printer size={15} /> طباعة التقرير
                      </button>
                      {isAdmin && (
                        <button onClick={() => handleDelete(record)} disabled={deletingId === record.id} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-600 hover:text-white transition-all active:scale-95 disabled:opacity-50">
                          <Trash2 size={15} /> {deletingId === record.id ? 'جاري الحذف...' : 'حذف السجل'}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !saving && resetModal()} />
          <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl bg-white" style={{ boxShadow: '0 30px 80px rgba(13,148,136,0.25)' }}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white/95 backdrop-blur-sm rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}><Plus size={18} className="text-white" /></div>
                <div>
                  <h2 className="font-bold text-slate-800 text-base">تسجيل فحص جديد</h2>
                  <p className="text-[11px] text-slate-400">سجل بيانات الفحص السريع</p>
                </div>
              </div>
              <button onClick={() => !saving && resetModal()} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Type Switch */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">نوع الفحص</label>
                <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                  <button type="button" onClick={() => setForm(f => ({ ...f, type: 'car' }))}
                    className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200', form.type === 'car' ? 'bg-white text-sky-700 shadow-md border border-sky-200' : 'text-slate-500 hover:text-slate-700')}>
                    <Car size={16} /> فحص سيارة
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, type: 'ecu' }))}
                    className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200', form.type === 'ecu' ? 'bg-white text-violet-700 shadow-md border border-violet-200' : 'text-slate-500 hover:text-slate-700')}>
                    <Cpu size={16} /> فحص عقل ECU
                  </button>
                </div>
              </div>
              {/* Customer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    <span className="flex items-center gap-1.5"><User size={14} className="text-teal-500" /> اسم الزبون <span className="text-rose-400">*</span></span>
                  </label>
                  <input type="text" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="مثال: أحمد محمد" className={fieldCls} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    <span className="flex items-center gap-1.5"><Phone size={14} className="text-slate-400" /> رقم الهاتف (اختياري)</span>
                  </label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="07xxxxxxxxx" className={fieldCls} dir="ltr" />
                </div>
              </div>
              {/* Subject */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    {form.type === 'car' ? <Car size={14} className="text-sky-500" /> : <Cpu size={14} className="text-violet-500" />}
                    {form.type === 'car' ? 'نوع وموديل السيارة' : 'نوع العقل / السيارة'}
                  </span>
                </label>
                <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder={form.type === 'car' ? 'مثال: سنتافي 2018' : 'مثال: SIM2K-241 سوناتا'} className={fieldCls} />
              </div>
              {/* Fault Codes */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  <span className="flex items-center gap-1.5"><AlertCircle size={14} className="text-rose-500" /> رموز وتفاصيل الأعطال</span>
                </label>
                <textarea rows={4} value={form.fault_codes} onChange={e => setForm(f => ({ ...f, fault_codes: e.target.value }))}
                  placeholder={"P0300 - إطلاق متعدد الأسطوانات\nP0171 - خليط فقير"}
                  className={fieldCls + ' resize-none font-mono'} />
                {parseFaultBadges(form.fault_codes).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">{parseFaultBadges(form.fault_codes).map(code => <FaultBadge key={code} code={code} />)}</div>
                )}
              </div>
              {/* Dropzone */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <span className="flex items-center gap-1.5"><ImageIcon size={14} className="text-fuchsia-500" /> صور رموز الأعطال / العقل</span>
                </label>
                <div
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => imageInputRef.current?.click()}
                  className={cn('border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200',
                    dragOver ? 'border-fuchsia-400 bg-fuchsia-50' : 'border-slate-200 hover:border-fuchsia-300 hover:bg-fuchsia-50/40')}
                >
                  <Upload size={24} className={cn('mx-auto mb-2', dragOver ? 'text-fuchsia-500' : 'text-slate-300')} />
                  <p className="text-sm text-slate-500 font-medium">اسحب وأفلت الصور هنا أو <span className="text-fuchsia-600 font-bold">انقر للتحديد</span></p>
                  <p className="text-xs text-slate-400 mt-1">PNG، JPG، WEBP — يمكن رفع أكثر من صورة</p>
                  <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => setImageFiles(prev => mergeFiles(prev, e.target.files))} />
                </div>
                {imageFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {imageFiles.map((f, i) => (
                      <span key={f.name + i} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[11px] font-medium border bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200">
                        <ImageIcon size={10} />
                        <span className="max-w-[140px] truncate">{f.name}</span>
                        {f.size ? <span className="opacity-60">({formatBytes(f.size)})</span> : null}
                        <button type="button" onClick={e => { e.stopPropagation(); setImageFiles(prev => prev.filter((_, j) => j !== i)) }} className="rounded-full hover:opacity-70 ml-0.5"><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* Fee + Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    <span className="flex items-center gap-1.5"><DollarSign size={14} className="text-emerald-500" /> أجور الفحص (IQD)</span>
                  </label>
                  <input type="number" min="0" value={form.inspection_fee} onChange={e => setForm(f => ({ ...f, inspection_fee: e.target.value }))} placeholder="0" className={fieldCls} dir="ltr" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    <span className="flex items-center gap-1.5"><StickyNote size={14} className="text-amber-500" /> ملاحظات</span>
                  </label>
                  <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="أي ملاحظات إضافية..." className={fieldCls} />
                </div>
              </div>
              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => !saving && resetModal()} disabled={saving} className="px-5 py-3 rounded-2xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all disabled:opacity-50">إلغاء</button>
                <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:scale-100" style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)', boxShadow: '0 8px 24px rgba(13,148,136,0.4)' }}>
                  {saving ? (<><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> جاري الحفظ...</>) : (<><CheckCircle2 size={17} /> حفظ الفحص</>)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-5 right-5 p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all" onClick={() => setLightboxUrl(null)}><X size={24} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="صورة الفحص" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}
