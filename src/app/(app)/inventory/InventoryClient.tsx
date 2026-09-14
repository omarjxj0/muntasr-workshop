'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Package, Plus, AlertTriangle, Search, MapPin, ChevronDown,
  Scan, RotateCcw, X, CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import InventoryActions from './InventoryActions'

export interface MfrRow { id: string; name: string }
export interface FamRow { id: string; name: string; manufacturer_id: string }
export interface McRow { id: string; name: string; family_id: string }
export interface SwIdRow { id: string; name: string; model_code_id: string }

interface InventoryClientProps {
  initialEcus: any[]
  manufacturers?: MfrRow[]
  families?: FamRow[]
  modelCodes?: McRow[]
  softwareIds?: SwIdRow[]
  companies?: { id: string; name: string }[]
  categories?: { id: string; name: string }[]
  isAdmin: boolean
}

export default function InventoryClient({
  initialEcus,
  manufacturers = [],
  families = [],
  modelCodes = [],
  softwareIds = [],
  isAdmin,
}: InventoryClientProps) {
  // ── Hierarchy DB data ─────────────────────────────────────
  const [dbMfr, setDbMfr] = useState<MfrRow[]>(manufacturers)
  const [dbFam, setDbFam] = useState<FamRow[]>(families)
  const [dbMc, setDbMc] = useState<McRow[]>(modelCodes)
  const [dbSwId, setDbSwId] = useState<SwIdRow[]>(softwareIds)

  // ── Search & Filter State ─────────────────────────────────
  const [search, setSearch] = useState('')
  const [selectedMfrId, setSelectedMfrId] = useState('')
  const [selectedFamilyId, setSelectedFamilyId] = useState('')
  const [selectedModelCodeId, setSelectedModelCodeId] = useState('')
  const [selectedSoftwareId, setSelectedSoftwareId] = useState('')
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all')

  // ── Scanner refs ──────────────────────────────────────────
  const searchInputRef = useRef<HTMLInputElement>(null)
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Client-side fallback if hierarchy props were empty ───
  useEffect(() => {
    if (dbMfr.length > 0) return
    const supabase = createClient()
    Promise.all([
      supabase.from('ecu_manufacturers').select('id,name').order('name'),
      supabase.from('ecu_families').select('id,name,manufacturer_id').order('name'),
      supabase.from('ecu_model_codes').select('id,name,family_id').order('name'),
      supabase.from('ecu_software_ids').select('id,name,model_code_id').order('name'),
    ]).then(([mfrs, fams, mcs, swids]) => {
      if (mfrs.data?.length) setDbMfr(mfrs.data)
      if (fams.data?.length) setDbFam(fams.data)
      if (mcs.data?.length) setDbMc(mcs.data)
      if (swids.data?.length) setDbSwId(swids.data)
    })
  }, [dbMfr.length])

  // ── Barcode Scanner listener (USB / Bluetooth HID) ────────
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isSearchInput = target === searchInputRef.current
      const isOtherInput =
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && !isSearchInput

      if (isOtherInput) return

      if (e.key === 'Enter') {
        if (isSearchInput) {
          // Scanner or operator pressed Enter in search box -> trim whitespace
          e.preventDefault()
          setSearch(prev => prev.trim())
          return
        }

        // Global scan detected via keyboard buffer
        const scanned = bufferRef.current.trim()
        bufferRef.current = ''
        if (scanned.length >= 2) {
          e.preventDefault()
          setSearch(scanned)
          searchInputRef.current?.focus()
        }
        return
      }

      // Buffer characters arriving when not in any input
      if (!isSearchInput && e.key.length === 1) {
        bufferRef.current += e.key
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          bufferRef.current = ''
        }, 100)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

  // ── Merge custom manufacturers from items ─────────────────
  const allManufacturers = useMemo(() => {
    const list = [...dbMfr]
    const existing = new Set(dbMfr.map(m => m.name.trim().toLowerCase()))
    initialEcus?.forEach(e => {
      const name = e.manufacturer?.trim()
      if (name && !existing.has(name.toLowerCase())) {
        existing.add(name.toLowerCase())
        list.push({ id: `custom-${name}`, name })
      }
    })
    return list
  }, [dbMfr, initialEcus])

  // ── Cascading option lists ────────────────────────────────
  const availableFamilies = useMemo(() => {
    if (!selectedMfrId) return dbFam
    return dbFam.filter(f => f.manufacturer_id === selectedMfrId)
  }, [dbFam, selectedMfrId])

  const availableModelCodes = useMemo(() => {
    if (!selectedFamilyId) {
      if (!selectedMfrId) return dbMc
      const validFamIds = new Set(availableFamilies.map(f => f.id))
      return dbMc.filter(mc => validFamIds.has(mc.family_id))
    }
    return dbMc.filter(mc => mc.family_id === selectedFamilyId)
  }, [dbMc, selectedFamilyId, selectedMfrId, availableFamilies])

  const availableSoftwareIds = useMemo(() => {
    if (!selectedModelCodeId) {
      const validMcIds = new Set(availableModelCodes.map(mc => mc.id))
      return dbSwId.filter(sw => validMcIds.has(sw.model_code_id))
    }
    return dbSwId.filter(sw => sw.model_code_id === selectedModelCodeId)
  }, [dbSwId, selectedModelCodeId, availableModelCodes])

  // ── Cascade Handlers ──────────────────────────────────────
  const handleMfrChange = (mfrId: string) => {
    setSelectedMfrId(mfrId)
    setSelectedFamilyId('')
    setSelectedModelCodeId('')
    setSelectedSoftwareId('')
  }

  const handleFamilyChange = (famId: string) => {
    setSelectedFamilyId(famId)
    if (famId && !selectedMfrId) {
      const parentMfr = dbFam.find(f => f.id === famId)?.manufacturer_id
      if (parentMfr) setSelectedMfrId(parentMfr)
    }
    setSelectedModelCodeId('')
    setSelectedSoftwareId('')
  }

  const handleModelCodeChange = (mcId: string) => {
    setSelectedModelCodeId(mcId)
    if (mcId && !selectedFamilyId) {
      const parentFam = dbMc.find(mc => mc.id === mcId)?.family_id
      if (parentFam) {
        setSelectedFamilyId(parentFam)
        const parentMfr = dbFam.find(f => f.id === parentFam)?.manufacturer_id
        if (parentMfr) setSelectedMfrId(parentMfr)
      }
    }
    setSelectedSoftwareId('')
  }

  const handleSoftwareIdChange = (swId: string) => {
    setSelectedSoftwareId(swId)
    if (swId && !selectedModelCodeId) {
      const parentMc = dbSwId.find(s => s.id === swId)?.model_code_id
      if (parentMc) {
        setSelectedModelCodeId(parentMc)
        const parentFam = dbMc.find(mc => mc.id === parentMc)?.family_id
        if (parentFam) {
          setSelectedFamilyId(parentFam)
          const parentMfr = dbFam.find(f => f.id === parentFam)?.manufacturer_id
          if (parentMfr) setSelectedMfrId(parentMfr)
        }
      }
    }
  }

  const resetHierarchyFilters = () => {
    setSelectedMfrId('')
    setSelectedFamilyId('')
    setSelectedModelCodeId('')
    setSelectedSoftwareId('')
  }

  const hasActiveHierarchy = Boolean(
    selectedMfrId || selectedFamilyId || selectedModelCodeId || selectedSoftwareId
  )

  // ── Resolved filter names ─────────────────────────────────
  const selectedMfrName = useMemo(() => {
    return allManufacturers.find(m => m.id === selectedMfrId)?.name ?? ''
  }, [allManufacturers, selectedMfrId])

  const selectedFamName = useMemo(() => {
    return availableFamilies.find(f => f.id === selectedFamilyId)?.name ?? ''
  }, [availableFamilies, selectedFamilyId])

  const selectedMcName = useMemo(() => {
    return availableModelCodes.find(m => m.id === selectedModelCodeId)?.name ?? ''
  }, [availableModelCodes, selectedModelCodeId])

  const selectedSwName = useMemo(() => {
    return availableSoftwareIds.find(s => s.id === selectedSoftwareId)?.name ?? ''
  }, [availableSoftwareIds, selectedSoftwareId])

  // ── Exact Barcode Match Detection ─────────────────────────
  const exactBarcodeMatch = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    const matches = (initialEcus || []).filter(
      item => item.barcode && item.barcode.trim().toLowerCase() === q
    )
    return matches.length === 1 ? matches[0] : null
  }, [initialEcus, search])

  // Auto-scroll and highlight row when exact barcode match is found
  useEffect(() => {
    if (exactBarcodeMatch) {
      const timer = setTimeout(() => {
        const desktopEl = document.getElementById(`ecu-row-desktop-${exactBarcodeMatch.id}`)
        const mobileEl = document.getElementById(`ecu-row-mobile-${exactBarcodeMatch.id}`)
        const targetEl = window.innerWidth >= 768 ? desktopEl : mobileEl
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 80)
      return () => clearTimeout(timer)
    }
  }, [exactBarcodeMatch])

  // ── Filtered ECUs ─────────────────────────────────────────
  const filteredEcus = useMemo(() => {
    return (initialEcus || []).filter(item => {
      const q = search.trim().toLowerCase()
      const matchesSearch =
        !q ||
        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.manufacturer && item.manufacturer.toLowerCase().includes(q)) ||
        (item.ecu_family && item.ecu_family.toLowerCase().includes(q)) ||
        (item.vehicle_model_code && item.vehicle_model_code.toLowerCase().includes(q)) ||
        (item.software_id && item.software_id.toLowerCase().includes(q)) ||
        (item.shelf_location && item.shelf_location.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        (item.symbols_codes && item.symbols_codes.toLowerCase().includes(q))

      const matchesMfr =
        !selectedMfrName ||
        item.manufacturer?.trim().toLowerCase() === selectedMfrName.trim().toLowerCase()
      const matchesFam =
        !selectedFamName ||
        item.ecu_family?.trim().toLowerCase() === selectedFamName.trim().toLowerCase()
      const matchesMc =
        !selectedMcName ||
        item.vehicle_model_code?.trim().toLowerCase() === selectedMcName.trim().toLowerCase()
      const matchesSw =
        !selectedSwName ||
        item.software_id?.trim().toLowerCase() === selectedSwName.trim().toLowerCase()

      const minQty = item.min_quantity ?? 3
      const isOut = item.stock_quantity === 0
      const isLow = item.stock_quantity <= minQty

      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'low' && isLow) ||
        (stockFilter === 'out' && isOut)

      return matchesSearch && matchesMfr && matchesFam && matchesMc && matchesSw && matchesStock
    })
  }, [
    initialEcus,
    search,
    selectedMfrName,
    selectedFamName,
    selectedMcName,
    selectedSwName,
    stockFilter,
  ])

  const inputClass =
    'px-3 py-2 rounded-xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)] w-full'

  const getStockBadge = (ecu: any) => {
    const minQty = ecu.min_quantity ?? 3
    if (ecu.stock_quantity === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">
          <AlertTriangle size={12} className="text-rose-500" />
          نفد (0)
        </span>
      )
    }
    if (ecu.stock_quantity <= minQty) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200"
          title={`الحد الأدنى: ${minQty}`}
        >
          <AlertTriangle size={12} className="text-amber-500" />
          نقص ({ecu.stock_quantity})
        </span>
      )
    }
    return (
      <span className="inline-flex items-center justify-center min-w-8 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
        {ecu.stock_quantity}
      </span>
    )
  }

  // Hierarchical path badge: SIM2K › 141 › NF › 330
  const ClassificationBadges = ({ ecu }: { ecu: any }) => {
    const parts: string[] = []
    if (ecu.manufacturer) parts.push(ecu.manufacturer)
    if (ecu.ecu_family) parts.push(ecu.ecu_family)
    if (ecu.vehicle_model_code) parts.push(ecu.vehicle_model_code)
    if (ecu.software_id) parts.push(ecu.software_id)
    if (parts.length === 0) return null
    return (
      <div className="flex flex-wrap items-center gap-1">
        {parts.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-slate-300 text-xs select-none">&gt;</span>}
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold border bg-slate-50 text-slate-600 border-slate-200">
              {p}
            </span>
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Package size={24} className="text-violet-500 shrink-0" />
            مخزون القطع (ECU)
          </h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            {filteredEcus.length} من أصل {initialEcus.length} صنف
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/inventory/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-white text-sm transition-all shadow-md hover:opacity-95 shrink-0"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
              boxShadow: '0 4px 15px rgba(124,58,237,0.35)',
            }}
          >
            <Plus size={16} />
            <span className="hidden sm:inline">إضافة صنف</span>
            <span className="sm:hidden">إضافة</span>
          </Link>
        )}
      </div>

      {/* Filters bar */}
      <div className="soft-card p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                setSearch(prev => prev.trim())
              }
            }}
            placeholder="بحث بالاسم، الباركود، الصانع، العائلة، الموديل، السوفتوير، موقع الرف، الملاحظات..."
            className={`pr-10 pl-24 ${inputClass}`}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  searchInputRef.current?.focus()
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                title="مسح البحث"
              >
                <X size={14} />
              </button>
            )}
            <span
              className="inline-flex items-center gap-1 text-[11px] font-mono text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200"
              title="متوافق مع أجهزة قارئ الباركود USB / Bluetooth"
            >
              <Scan size={12} />
              <span className="hidden sm:inline">مسح</span>
            </span>
          </div>
        </div>

        {/* Exact Barcode Match Banner */}
        {exactBarcodeMatch && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-violet-50 border-2 border-violet-300 text-violet-900 text-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2 flex-wrap font-medium">
              <CheckCircle2 size={18} className="text-violet-600 shrink-0" />
              <span>تم العثور على مطابقة تامة للباركود:</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded-md border border-violet-200 text-violet-700 font-bold">
                {exactBarcodeMatch.barcode}
              </span>
              <span className="text-slate-700 font-bold">({exactBarcodeMatch.name})</span>
              {exactBarcodeMatch.shelf_location && (
                <span className="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-800 px-2 py-0.5 rounded-md font-semibold">
                  <MapPin size={11} />
                  الرف: {exactBarcodeMatch.shelf_location}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setSearch('')
                searchInputRef.current?.focus()
              }}
              className="text-xs text-violet-600 hover:text-violet-900 font-semibold px-2 py-1 rounded-lg hover:bg-violet-100 transition-colors shrink-0"
            >
              إلغاء المطابقة ✕
            </button>
          </div>
        )}

        {/* ── Cascading 4-Tier Dropdown Filters ── */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500">فلترة التصنيف الهرمي (ECU Hierarchy):</span>
            {hasActiveHierarchy && (
              <button
                type="button"
                onClick={resetHierarchyFilters}
                className="text-xs text-violet-600 hover:text-violet-800 font-semibold flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={12} />
                إعادة تعيين الكل
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* 1. الصانع (Manufacturer) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 block">1. الصانع (Manufacturer)</label>
              <div className="relative">
                <select
                  value={selectedMfrId}
                  onChange={e => handleMfrChange(e.target.value)}
                  className={`${inputClass} appearance-none pr-8 text-xs font-medium`}
                >
                  <option value="">الكل (جميع الصانعين)</option>
                  {allManufacturers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* 2. العائلة (Family) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 block">2. العائلة (Family)</label>
              <div className="relative">
                <select
                  value={selectedFamilyId}
                  onChange={e => handleFamilyChange(e.target.value)}
                  className={`${inputClass} appearance-none pr-8 text-xs font-medium`}
                >
                  <option value="">الكل (جميع العائلات)</option>
                  {availableFamilies.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* 3. كود الموديل (Model Code) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 block">3. كود الموديل (Model Code)</label>
              <div className="relative">
                <select
                  value={selectedModelCodeId}
                  onChange={e => handleModelCodeChange(e.target.value)}
                  className={`${inputClass} appearance-none pr-8 text-xs font-medium`}
                >
                  <option value="">الكل (جميع الموديلات)</option>
                  {availableModelCodes.map(mc => (
                    <option key={mc.id} value={mc.id}>{mc.name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* 4. السوفتوير / البارت (Software ID) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 block">4. السوفتوير (Software ID)</label>
              <div className="relative">
                <select
                  value={selectedSoftwareId}
                  onChange={e => handleSoftwareIdChange(e.target.value)}
                  className={`${inputClass} appearance-none pr-8 text-xs font-medium`}
                >
                  <option value="">الكل (جميع أرقام السوفتوير)</option>
                  {availableSoftwareIds.map(sw => (
                    <option key={sw.id} value={sw.id}>{sw.name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Stock status pills */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 flex-wrap">
          <span className="text-slate-400 font-medium text-xs">حالة المخزون:</span>
          <button
            type="button"
            onClick={() => setStockFilter('all')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              stockFilter === 'all'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل ({initialEcus.length})
          </button>
          <button
            type="button"
            onClick={() => setStockFilter('low')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              stockFilter === 'low'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            ⚠️ نواقص
          </button>
          <button
            type="button"
            onClick={() => setStockFilter('out')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              stockFilter === 'out'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            🚫 نفد
          </button>
        </div>
      </div>

      {/* ── Desktop Table (hidden on mobile) ── */}
      <div className="soft-card overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 bg-slate-50/60">
                <th className="text-right px-5 py-4 font-semibold">الاسم</th>
                <th className="text-right px-4 py-4 font-semibold">التصنيف الهرمي</th>
                <th className="text-right px-4 py-4 font-semibold">الباركود</th>
                <th className="text-center px-4 py-4 font-semibold">موقع الرف</th>
                <th className="text-center px-4 py-4 font-semibold">المخزون</th>
                {isAdmin && <th className="text-left px-4 py-4 font-semibold">سعر الشراء</th>}
                <th className="text-left px-4 py-4 font-semibold">سعر البيع</th>
                {isAdmin && <th className="px-4 py-4" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEcus.map((ecu: any) => {
                const isExactMatched = exactBarcodeMatch?.id === ecu.id
                return (
                  <tr
                    key={ecu.id}
                    id={`ecu-row-desktop-${ecu.id}`}
                    className={`transition-all duration-300 ${
                      isExactMatched
                        ? 'bg-violet-100/90 ring-2 ring-violet-500 ring-inset shadow-md font-semibold'
                        : 'hover:bg-violet-50/30 group'
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-700">{ecu.name}</p>
                          {isExactMatched && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-violet-600 text-white shadow-sm animate-pulse">
                              <Scan size={12} />
                              مطابقة تامة
                            </span>
                          )}
                        </div>
                        {ecu.symbols_codes && (
                          <p className="text-xs text-slate-400 font-mono">{ecu.symbols_codes}</p>
                        )}
                        {ecu.notes && (
                          <p className="text-xs text-slate-400 mt-0.5 max-w-[200px] truncate" title={ecu.notes}>
                            📝 {ecu.notes}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <ClassificationBadges ecu={ecu} />
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs">
                      {ecu.barcode ? (
                        <span className={isExactMatched ? 'text-violet-700 font-bold bg-white px-2 py-0.5 rounded border border-violet-300' : 'text-slate-500'}>
                          {ecu.barcode}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {ecu.shelf_location ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                          <MapPin size={11} className="text-violet-500 shrink-0" />
                          {ecu.shelf_location}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {getStockBadge(ecu)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3.5 text-left text-slate-500">
                        {formatCurrency(ecu.purchase_price)}
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-left font-semibold text-emerald-600">
                      {formatCurrency(ecu.selling_price)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3.5">
                        <InventoryActions ecuId={ecu.id} />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!filteredEcus.length && (
            <div className="py-16 text-center text-slate-400">
              لا توجد أصناف مطابقة لخيارات البحث المحددة
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile Cards (shown only on mobile) ── */}
      <div className="md:hidden space-y-3">
        {filteredEcus.length === 0 && (
          <div className="soft-card py-12 text-center text-slate-400 text-sm">
            لا توجد أصناف مطابقة لخيارات البحث المحددة
          </div>
        )}
        {filteredEcus.map((ecu: any) => {
          const isExactMatched = exactBarcodeMatch?.id === ecu.id
          return (
            <div
              key={ecu.id}
              id={`ecu-row-mobile-${ecu.id}`}
              className={`soft-card p-4 space-y-3 transition-all duration-300 ${
                isExactMatched ? 'ring-2 ring-violet-500 bg-violet-50/70 shadow-md' : ''
              }`}
            >
              {/* Top row: name + stock badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-800 text-sm leading-snug">{ecu.name}</p>
                    {isExactMatched && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-600 text-white shadow-sm animate-pulse">
                        <Scan size={10} />
                        مطابقة تامة
                      </span>
                    )}
                  </div>
                  {ecu.symbols_codes && (
                    <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">{ecu.symbols_codes}</p>
                  )}
                </div>
                <div className="shrink-0">{getStockBadge(ecu)}</div>
              </div>

              {/* Classification breadcrumb */}
              <ClassificationBadges ecu={ecu} />

              {/* Meta row */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {ecu.barcode && (
                  <span className={`font-mono ${isExactMatched ? 'font-bold text-violet-700 bg-white px-2 py-0.5 rounded border border-violet-200' : ''}`}>
                    📦 {ecu.barcode}
                  </span>
                )}
                {ecu.shelf_location && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-semibold text-xs">
                    <MapPin size={10} className="text-violet-500 shrink-0" />
                    {ecu.shelf_location}
                  </span>
                )}
              </div>

              {/* Notes */}
              {ecu.notes && (
                <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                  📝 {ecu.notes}
                </p>
              )}

              {/* Prices row */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-3 text-xs">
                  {isAdmin && (
                    <span className="text-slate-500">
                      شراء:{' '}
                      <span className="font-semibold text-slate-700">
                        {formatCurrency(ecu.purchase_price)}
                      </span>
                    </span>
                  )}
                  <span className="text-emerald-600">
                    بيع:{' '}
                    <span className="font-bold">{formatCurrency(ecu.selling_price)}</span>
                  </span>
                </div>
                {isAdmin && <InventoryActions ecuId={ecu.id} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
