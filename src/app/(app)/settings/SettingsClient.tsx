'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronDown, Layers, Factory, GitBranch, Code2, Hash } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// ─── Shared input / button styles ─────────────────────────────
const inputCls  = 'flex-1 px-3 py-2 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]'
const btnAddCls = 'px-4 py-2 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-60 shrink-0'
const selectCls = `${inputCls} appearance-none cursor-pointer pr-8 w-auto`

// ─── Simple flat list (ecu_companies, ecu_categories, common_complaints) ───

function ManageList({
  title,
  initialItems,
  tableName,
  columnName,
}: {
  title: string
  initialItems: { id: string; name: string }[]
  tableName: 'ecu_companies' | 'ecu_categories' | 'common_complaints'
  columnName?: string
}) {
  const [items, setItems]   = useState(initialItems)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const reload = async () => {
    const col     = columnName ?? 'name'
    const orderBy = tableName === 'common_complaints' ? 'created_at' : 'name'
    const { data } = await supabase.from(tableName).select('*').order(orderBy, { ascending: true })
    setItems((data ?? []).map((item: any) => ({ id: item.id, name: item[col] ?? item.name ?? item.text ?? '' })))
  }

  useEffect(() => { reload() }, []) // eslint-disable-line

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setLoading(true)
    const col = columnName ?? 'name'
    const { error } = await supabase.from(tableName).insert({ [col]: newName.trim() } as any)
    if (error) { toast.error('فشل في الإضافة'); setLoading(false); return }
    toast.success('تم الإضافة')
    setNewName('')
    reload()
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر؟')) return
    const { error } = await supabase.from(tableName).delete().eq('id', id)
    if (error) { toast.error('فشل في الحذف'); return }
    toast.success('تم الحذف')
    reload()
  }

  return (
    <div className="soft-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-700">{title}</h2>
      </div>
      <div className="divide-y divide-slate-50">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between px-5 py-3 group">
            <span className="text-slate-700 text-sm">{item.name}</span>
            <button
              onClick={() => handleDelete(item.id)}
              className="p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-rose-50"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!items.length && <div className="px-5 py-4 text-slate-400 text-sm">لا توجد عناصر</div>}
      </div>
      <form onSubmit={handleAdd} className="p-4 flex gap-2 border-t border-slate-100">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="أضف جديد..."
          className={inputCls}
        />
        <button type="submit" disabled={loading} className={btnAddCls}
          style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
          <Plus size={16} />
        </button>
      </form>
    </div>
  )
}

// ─── Hierarchy Manager ─────────────────────────────────────────

type MfrRow  = { id: string; name: string }
type FamRow  = { id: string; name: string; manufacturer_id: string }
type McRow   = { id: string; name: string; family_id: string }
type SwRow   = { id: string; name: string; model_code_id: string }

interface HierarchyProps {
  initMfr:  MfrRow[]
  initFam:  FamRow[]
  initMc:   McRow[]
  initSwId: SwRow[]
}

function HierarchyManager({ initMfr, initFam, initMc, initSwId }: HierarchyProps) {
  const supabase = createClient()

  const [mfrs,  setMfrs]  = useState<MfrRow[]>(initMfr)
  const [fams,  setFams]  = useState<FamRow[]>(initFam)
  const [mcs,   setMcs]   = useState<McRow[]>(initMc)
  const [swids, setSwids] = useState<SwRow[]>(initSwId)

  // Add-form state per tier
  const [newMfr,  setNewMfr]  = useState('')
  const [newFam,  setNewFam]  = useState('')
  const [selMfrForFam, setSelMfrForFam]   = useState('')

  const [newMc,   setNewMc]   = useState('')
  const [selFamForMc, setSelFamForMc]   = useState('')

  const [newSw,   setNewSw]   = useState('')
  const [selMcForSw, setSelMcForSw]     = useState('')

  // Filter dropdowns for display
  const [filterMfr, setFilterMfr] = useState('')
  const [filterFam, setFilterFam] = useState('')

  const [loading, setLoading] = useState(false)

  // ── Reload helpers ────────────────────────────────────────
  const reloadMfr  = async () => { const { data } = await supabase.from('ecu_manufacturers').select('id,name').order('name'); setMfrs(data ?? []) }
  const reloadFam  = async () => { const { data } = await supabase.from('ecu_families').select('id,name,manufacturer_id').order('name'); setFams(data ?? []) }
  const reloadMc   = async () => { const { data } = await supabase.from('ecu_model_codes').select('id,name,family_id').order('name'); setMcs(data ?? []) }
  const reloadSwId = async () => { const { data } = await supabase.from('ecu_software_ids').select('id,name,model_code_id').order('name'); setSwids(data ?? []) }

  // ── Add / Delete ──────────────────────────────────────────
  const addMfr = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMfr.trim()) return
    setLoading(true)
    const { error } = await supabase.from('ecu_manufacturers').insert({ name: newMfr.trim() })
    if (error) { toast.error('فشل: ' + error.message) } else { toast.success('تم إضافة الصانع'); setNewMfr(''); reloadMfr() }
    setLoading(false)
  }
  const delMfr = async (id: string) => {
    if (!confirm('سيُحذف الصانع مع جميع عائلاته وموديلاته. هل أنت متأكد؟')) return
    const { error } = await supabase.from('ecu_manufacturers').delete().eq('id', id)
    if (error) { toast.error('فشل في الحذف') } else { toast.success('تم الحذف'); reloadMfr(); reloadFam(); reloadMc(); reloadSwId() }
  }

  const addFam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFam.trim() || !selMfrForFam) return
    setLoading(true)
    const { error } = await supabase.from('ecu_families').insert({ name: newFam.trim(), manufacturer_id: selMfrForFam })
    if (error) { toast.error('فشل: ' + error.message) } else { toast.success('تم إضافة العائلة'); setNewFam(''); reloadFam() }
    setLoading(false)
  }
  const delFam = async (id: string) => {
    if (!confirm('سيُحذف مع جميع الموديلات التابعة. هل أنت متأكد؟')) return
    const { error } = await supabase.from('ecu_families').delete().eq('id', id)
    if (error) { toast.error('فشل في الحذف') } else { toast.success('تم الحذف'); reloadFam(); reloadMc(); reloadSwId() }
  }

  const addMc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMc.trim() || !selFamForMc) return
    setLoading(true)
    const { error } = await supabase.from('ecu_model_codes').insert({ name: newMc.trim(), family_id: selFamForMc })
    if (error) { toast.error('فشل: ' + error.message) } else { toast.success('تم إضافة كود الموديل'); setNewMc(''); reloadMc() }
    setLoading(false)
  }
  const delMc = async (id: string) => {
    if (!confirm('سيُحذف مع جميع Software IDs التابعة. هل أنت متأكد؟')) return
    const { error } = await supabase.from('ecu_model_codes').delete().eq('id', id)
    if (error) { toast.error('فشل في الحذف') } else { toast.success('تم الحذف'); reloadMc(); reloadSwId() }
  }

  const addSw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSw.trim() || !selMcForSw) return
    setLoading(true)
    const { error } = await supabase.from('ecu_software_ids').insert({ name: newSw.trim(), model_code_id: selMcForSw })
    if (error) { toast.error('فشل: ' + error.message) } else { toast.success('تم إضافة Software ID'); setNewSw(''); reloadSwId() }
    setLoading(false)
  }
  const delSw = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return
    const { error } = await supabase.from('ecu_software_ids').delete().eq('id', id)
    if (error) { toast.error('فشل في الحذف') } else { toast.success('تم الحذف'); reloadSwId() }
  }

  // ── Filtered views for display ────────────────────────────
  const displayedFams  = filterMfr ? fams.filter(f => f.manufacturer_id === filterMfr) : fams
  const displayedMcs   = filterFam ? mcs.filter(mc => mc.family_id === filterFam)      : mcs
  const displayedSwids = selMcForSw ? swids.filter(s => s.model_code_id === selMcForSw) : swids

  const tierCard = (icon: React.ReactNode, title: string, subtitle: string, color: string, children: React.ReactNode) => (
    <div className="soft-card overflow-hidden">
      <div className={`px-5 py-4 border-b border-slate-100 flex items-center gap-3`}>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
        <div>
          <h3 className="font-semibold text-slate-700 text-sm">{title}</h3>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )

  const itemRow = (id: string, label: string, sub: string | undefined, onDel: () => void) => (
    <div key={id} className="flex items-center justify-between px-5 py-2.5 group hover:bg-slate-50/60 transition-colors">
      <div>
        <p className="text-sm text-slate-700">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      <button
        onClick={onDel}
        className="p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-rose-50"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* ── Tier 1: Manufacturers ──────────────────────────── */}
      {tierCard(
        <Factory size={16} className="text-blue-600" />,
        'الصانعون (Manufacturers)',
        'المستوى الأول من التصنيف الهرمي',
        'bg-blue-50',
        <>
          <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
            {mfrs.map(m => itemRow(m.id, m.name, undefined, () => delMfr(m.id)))}
            {!mfrs.length && <div className="px-5 py-4 text-slate-400 text-sm">لا توجد صانعون</div>}
          </div>
          <form onSubmit={addMfr} className="p-4 flex gap-2 border-t border-slate-100 bg-slate-50/40">
            <input value={newMfr} onChange={e => setNewMfr(e.target.value)} placeholder="اسم الصانع مثلاً: SIM2K" className={inputCls} dir="ltr" />
            <button type="submit" disabled={loading} className={btnAddCls}
              style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
              <Plus size={16} />
            </button>
          </form>
        </>
      )}

      {/* ── Tier 2: Families ───────────────────────────────── */}
      {tierCard(
        <GitBranch size={16} className="text-indigo-600" />,
        'العائلات (Families)',
        'المستوى الثاني — مرتبط بالصانع',
        'bg-indigo-50',
        <>
          {/* Filter by manufacturer */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <span className="text-xs text-slate-400 shrink-0">تصفية:</span>
            <div className="relative">
              <select value={filterMfr} onChange={e => setFilterMfr(e.target.value)} className={`${selectCls} text-xs py-1.5`}>
                <option value="">كل الصانعين</option>
                {mfrs.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
            {displayedFams.map(f => {
              const parent = mfrs.find(m => m.id === f.manufacturer_id)
              return itemRow(f.id, f.name, parent?.name, () => delFam(f.id))
            })}
            {!displayedFams.length && <div className="px-5 py-4 text-slate-400 text-sm">لا توجد عائلات</div>}
          </div>
          <form onSubmit={addFam} className="p-4 flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/40">
            <div className="relative">
              <select value={selMfrForFam} onChange={e => setSelMfrForFam(e.target.value)} className={`${selectCls} text-sm`} required>
                <option value="">— اختر الصانع —</option>
                {mfrs.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <input value={newFam} onChange={e => setNewFam(e.target.value)} placeholder="اسم العائلة مثلاً: 141" className={inputCls} dir="ltr" />
            <button type="submit" disabled={loading || !selMfrForFam} className={btnAddCls}
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
              <Plus size={16} />
            </button>
          </form>
        </>
      )}

      {/* ── Tier 3: Model Codes ────────────────────────────── */}
      {tierCard(
        <Code2 size={16} className="text-purple-600" />,
        'أكواد الموديل (Model Codes)',
        'المستوى الثالث — مرتبط بالعائلة',
        'bg-purple-50',
        <>
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <span className="text-xs text-slate-400 shrink-0">تصفية:</span>
            <div className="relative">
              <select value={filterFam} onChange={e => setFilterFam(e.target.value)} className={`${selectCls} text-xs py-1.5`}>
                <option value="">كل العائلات</option>
                {fams.map(f => {
                  const p = mfrs.find(m => m.id === f.manufacturer_id)
                  return <option key={f.id} value={f.id}>{p ? `${p.name} / ` : ''}{f.name}</option>
                })}
              </select>
              <ChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
            {displayedMcs.map(mc => {
              const parentFam = fams.find(f => f.id === mc.family_id)
              const parentMfr = mfrs.find(m => m.id === parentFam?.manufacturer_id)
              return itemRow(mc.id, mc.name, parentMfr && parentFam ? `${parentMfr.name} / ${parentFam.name}` : parentFam?.name, () => delMc(mc.id))
            })}
            {!displayedMcs.length && <div className="px-5 py-4 text-slate-400 text-sm">لا توجد أكواد موديل</div>}
          </div>
          <form onSubmit={addMc} className="p-4 flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/40">
            <div className="relative">
              <select value={selFamForMc} onChange={e => setSelFamForMc(e.target.value)} className={`${selectCls} text-sm`} required>
                <option value="">— اختر العائلة —</option>
                {fams.map(f => {
                  const p = mfrs.find(m => m.id === f.manufacturer_id)
                  return <option key={f.id} value={f.id}>{p ? `${p.name} / ` : ''}{f.name}</option>
                })}
              </select>
              <ChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <input value={newMc} onChange={e => setNewMc(e.target.value)} placeholder="كود الموديل مثلاً: NF" className={inputCls} dir="ltr" />
            <button type="submit" disabled={loading || !selFamForMc} className={btnAddCls}
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
              <Plus size={16} />
            </button>
          </form>
        </>
      )}

      {/* ── Tier 4: Software / Part IDs ────────────────────── */}
      {tierCard(
        <Hash size={16} className="text-violet-600" />,
        'Software / Part IDs',
        'المستوى الرابع — مرتبط بكود الموديل',
        'bg-violet-50',
        <>
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <span className="text-xs text-slate-400 shrink-0">تصفية:</span>
            <div className="relative">
              <select value={selMcForSw} onChange={e => setSelMcForSw(e.target.value)} className={`${selectCls} text-xs py-1.5`}>
                <option value="">كل أكواد الموديل</option>
                {mcs.map(mc => {
                  const f = fams.find(f => f.id === mc.family_id)
                  const m = mfrs.find(m => m.id === f?.manufacturer_id)
                  return <option key={mc.id} value={mc.id}>{m ? `${m.name} / ` : ''}{f ? `${f.name} / ` : ''}{mc.name}</option>
                })}
              </select>
              <ChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
            {displayedSwids.map(s => {
              const mc = mcs.find(mc => mc.id === s.model_code_id)
              const f  = fams.find(f => f.id === mc?.family_id)
              const m  = mfrs.find(m => m.id === f?.manufacturer_id)
              const path = [m?.name, f?.name, mc?.name].filter(Boolean).join(' / ')
              return itemRow(s.id, s.name, path || undefined, () => delSw(s.id))
            })}
            {!displayedSwids.length && <div className="px-5 py-4 text-slate-400 text-sm">لا توجد Software IDs</div>}
          </div>
          <form onSubmit={addSw} className="p-4 flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/40">
            <div className="relative">
              <select value={selMcForSw} onChange={e => setSelMcForSw(e.target.value)} className={`${selectCls} text-sm`} required>
                <option value="">— اختر كود الموديل —</option>
                {mcs.map(mc => {
                  const f = fams.find(f => f.id === mc.family_id)
                  const m = mfrs.find(m => m.id === f?.manufacturer_id)
                  return <option key={mc.id} value={mc.id}>{m ? `${m.name} / ` : ''}{f ? `${f.name} / ` : ''}{mc.name}</option>
                })}
              </select>
              <ChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <input value={newSw} onChange={e => setNewSw(e.target.value)} placeholder="رقم السوفتوير مثلاً: 330" className={inputCls} dir="ltr" />
            <button type="submit" disabled={loading || !selMcForSw} className={btnAddCls}
              style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
              <Plus size={16} />
            </button>
          </form>
        </>
      )}
    </div>
  )
}

// ─── Main SettingsClient ───────────────────────────────────────

interface Props {
  companies:   { id: string; name: string }[]
  categories:  { id: string; name: string }[]
  complaints:  { id: string; name: string }[]
  manufacturers: { id: string; name: string }[]
  families:      { id: string; name: string; manufacturer_id: string }[]
  modelCodes:    { id: string; name: string; family_id: string }[]
  softwareIds:   { id: string; name: string; model_code_id: string }[]
}

export default function SettingsClient({
  companies, categories, complaints,
  manufacturers, families, modelCodes, softwareIds,
}: Props) {
  return (
    <div className="space-y-8">

      {/* ── ECU Hierarchy ─────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-violet-100 flex items-center justify-center">
            <Layers size={18} className="text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">تصنيف ECU الهرمي</h2>
            <p className="text-sm text-slate-400">أضف وأدر الصانعين، العائلات، أكواد الموديل، وأرقام السوفتوير</p>
          </div>
        </div>
        <HierarchyManager
          initMfr={manufacturers}
          initFam={families}
          initMc={modelCodes}
          initSwId={softwareIds}
        />
      </section>

      <hr className="border-slate-100" />

      {/* ── Existing lists ─────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800">إعدادات عامة</h2>
        <ManageList title="شركات ECU"       initialItems={companies}  tableName="ecu_companies" />
        <ManageList title="فئات ECU"        initialItems={categories} tableName="ecu_categories" />
        <ManageList title="الشكاوى الشائعة" initialItems={complaints} tableName="common_complaints" columnName="text" />
      </section>
    </div>
  )
}
