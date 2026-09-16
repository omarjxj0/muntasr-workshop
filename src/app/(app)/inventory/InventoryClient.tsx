'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Package, Plus, AlertTriangle, Search, MapPin, ChevronDown, ChevronUp,
  Scan, RotateCcw, X, CheckCircle2, Layers, ListFilter, Copy, Pencil, Zap,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
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
  /** Set of VINs / barcodes that have a record in ecu_flash_archive */
  flashArchiveVins?: Set<string>
}

export interface EcuGroup {
  key: string
  manufacturer: string
  ecu_family: string
  vehicle_model_code: string
  software_id: string
  displayName: string
  totalStockQuantity: number
  totalUnitsCount: number
  min_quantity: number
  items: any[]
  minPrice: number
  maxPrice: number
  minPurchasePrice: number
  maxPurchasePrice: number
  shelfLocations: string[]
  hasLowStock: boolean
  isOutOfStock: boolean
  matchingItemIds: Set<string>
}

export default function InventoryClient({
  initialEcus,
  manufacturers = [],
  families = [],
  modelCodes = [],
  softwareIds = [],
  isAdmin,
  flashArchiveVins = new Set(),
}: InventoryClientProps) {
  // ── Hierarchy DB data ─────────────────────────────────────
  const [dbMfr, setDbMfr] = useState<MfrRow[]>(manufacturers)
  const [dbFam, setDbFam] = useState<FamRow[]>(families)
  const [dbMc, setDbMc] = useState<McRow[]>(modelCodes)
  const [dbSwId, setDbSwId] = useState<SwIdRow[]>(softwareIds)

  // ── View Mode: Grouped (default) vs Flat list ─────────────
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped')
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set())

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

  // ── Quick copy helper for Barcode / VIN ───────────────────
  const copyBarcode = (code: string) => {
    if (!code) return
    navigator.clipboard.writeText(code)
    toast.success(`تم نسخ الباركود / VIN: ${code}`, { duration: 1500, id: `copy-${code}` })
  }

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

  // ── Filtered Flat ECUs ─────────────────────────────────────
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

      const qty = Number(item.stock_quantity ?? item.quantity ?? 1) || 0
      const isOut = qty === 0
      const isLow = qty <= 1 && !isOut

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

  // ── Aggregated Grouped View Engine ────────────────────────
  // Groups by (Manufacturer + Family + Model Code + Software ID)
  const groupedEcus = useMemo(() => {
    const q = search.trim().toLowerCase()

    // 1. Group items matching current hierarchy dropdown filters
    const groupsMap = new Map<string, {
      key: string
      manufacturer: string
      ecu_family: string
      vehicle_model_code: string
      software_id: string
      displayName: string
      items: any[]
    }>()

    for (const item of (initialEcus || [])) {
      if (selectedMfrName && item.manufacturer?.trim().toLowerCase() !== selectedMfrName.trim().toLowerCase()) continue
      if (selectedFamName && item.ecu_family?.trim().toLowerCase() !== selectedFamName.trim().toLowerCase()) continue
      if (selectedMcName && item.vehicle_model_code?.trim().toLowerCase() !== selectedMcName.trim().toLowerCase()) continue
      if (selectedSwName && item.software_id?.trim().toLowerCase() !== selectedSwName.trim().toLowerCase()) continue

      const mfr = (item.manufacturer || '').trim()
      const fam = (item.ecu_family || '').trim()
      const mc  = (item.vehicle_model_code || '').trim()
      const sw  = (item.software_id || '').trim()

      let groupKey = ''
      if (mfr || fam || mc || sw) {
        groupKey = `hier::${mfr.toLowerCase()}::${fam.toLowerCase()}::${mc.toLowerCase()}::${sw.toLowerCase()}`
      } else {
        groupKey = `name::${(item.name || 'unclassified').trim().toLowerCase()}`
      }

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          key: groupKey,
          manufacturer: mfr,
          ecu_family: fam,
          vehicle_model_code: mc,
          software_id: sw,
          displayName: item.name || sw || mc || fam || mfr || 'صنف غير محدد',
          items: [],
        })
      }

      groupsMap.get(groupKey)!.items.push(item)
    }

    // 2. Compute aggregated metrics and evaluate search & stock filters
    const result: EcuGroup[] = []

    for (const group of groupsMap.values()) {
      const totalStockQuantity = group.items.reduce(
        (sum, it) => sum + (Number(it.stock_quantity ?? it.quantity ?? 1) || 0),
        0
      )
      const isOutOfStock = totalStockQuantity === 0
      const hasLowStock = totalStockQuantity === 1
      const minQty = 1

      // Stock status filter check on aggregated group
      if (stockFilter === 'low' && !hasLowStock) continue
      if (stockFilter === 'out' && !isOutOfStock) continue

      // Check group-level query match
      const groupMatchesQuery = !q || (
        (group.manufacturer && group.manufacturer.toLowerCase().includes(q)) ||
        (group.ecu_family && group.ecu_family.toLowerCase().includes(q)) ||
        (group.vehicle_model_code && group.vehicle_model_code.toLowerCase().includes(q)) ||
        (group.software_id && group.software_id.toLowerCase().includes(q)) ||
        (group.displayName && group.displayName.toLowerCase().includes(q))
      )

      // Check individual item matches (barcode / VIN / shelf / notes / symbols)
      const matchingItemIds = new Set<string>()
      for (const item of group.items) {
        const itemMatches = !q || (
          (item.barcode && item.barcode.toLowerCase().includes(q)) ||
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.shelf_location && item.shelf_location.toLowerCase().includes(q)) ||
          (item.notes && item.notes.toLowerCase().includes(q)) ||
          (item.symbols_codes && item.symbols_codes.toLowerCase().includes(q)) ||
          groupMatchesQuery
        )
        if (itemMatches) {
          matchingItemIds.add(item.id)
        }
      }

      // If search query is active, group must match or contain matching items
      if (q && !groupMatchesQuery && matchingItemIds.size === 0) {
        continue
      }

      const prices = group.items.map(it => Number(it.selling_price) || 0)
      const purchasePrices = group.items.map(it => Number(it.purchase_price) || 0)
      const minPrice = prices.length ? Math.min(...prices) : 0
      const maxPrice = prices.length ? Math.max(...prices) : 0
      const minPurchasePrice = purchasePrices.length ? Math.min(...purchasePrices) : 0
      const maxPurchasePrice = purchasePrices.length ? Math.max(...purchasePrices) : 0

      const shelfLocations = Array.from(
        new Set(group.items.map(it => it.shelf_location?.trim()).filter(Boolean))
      ) as string[]

      // Sort items inside group: matching items first, then alphabetical by barcode
      const sortedItems = [...group.items].sort((a, b) => {
        if (matchingItemIds.has(a.id) && !matchingItemIds.has(b.id)) return -1
        if (!matchingItemIds.has(a.id) && matchingItemIds.has(b.id)) return 1
        return (a.barcode || '').localeCompare(b.barcode || '')
      })

      result.push({
        key: group.key,
        manufacturer: group.manufacturer,
        ecu_family: group.ecu_family,
        vehicle_model_code: group.vehicle_model_code,
        software_id: group.software_id,
        displayName: group.displayName,
        totalStockQuantity,
        totalUnitsCount: group.items.length,
        min_quantity: minQty,
        items: sortedItems,
        minPrice,
        maxPrice,
        minPurchasePrice,
        maxPurchasePrice,
        shelfLocations,
        hasLowStock,
        isOutOfStock,
        matchingItemIds,
      })
    }

    // Sort: In-stock first, then by Software ID or Display Name
    return result.sort((a, b) => {
      if (a.isOutOfStock !== b.isOutOfStock) return a.isOutOfStock ? 1 : -1
      return (a.software_id || a.displayName).localeCompare(b.software_id || b.displayName)
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

  // ── Auto-expand and scroll on exact barcode match ─────────
  useEffect(() => {
    if (exactBarcodeMatch) {
      const targetGroup = groupedEcus.find(g =>
        g.items.some((item: any) => item.id === exactBarcodeMatch.id)
      )
      if (targetGroup) {
        setExpandedGroupKeys(prev => {
          const next = new Set(prev)
          next.add(targetGroup.key)
          return next
        })
      }
      const timer = setTimeout(() => {
        const unitDesktopEl = document.getElementById(`ecu-unit-desktop-${exactBarcodeMatch.id}`)
        const unitMobileEl = document.getElementById(`ecu-unit-mobile-${exactBarcodeMatch.id}`)
        const flatDesktopEl = document.getElementById(`ecu-row-desktop-${exactBarcodeMatch.id}`)
        const flatMobileEl = document.getElementById(`ecu-row-mobile-${exactBarcodeMatch.id}`)
        const groupEl = targetGroup ? document.getElementById(`ecu-group-${targetGroup.key}`) : null

        const targetEl =
          unitDesktopEl || unitMobileEl || flatDesktopEl || flatMobileEl || groupEl
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [exactBarcodeMatch, groupedEcus])

  // ── Auto-expand matching groups when searching by VIN/Barcode ─
  useEffect(() => {
    const q = search.trim().toLowerCase()
    if (q.length >= 2) {
      const matchingKeys = groupedEcus
        .filter(g => g.matchingItemIds.size > 0)
        .map(g => g.key)
      if (matchingKeys.length > 0 && matchingKeys.length <= 8) {
        setExpandedGroupKeys(prev => {
          const next = new Set(prev)
          matchingKeys.forEach(k => next.add(k))
          return next
        })
      }
    }
  }, [search, groupedEcus])

  // ── Group Accordion Controls ──────────────────────────────
  const toggleGroup = (key: string) => {
    setExpandedGroupKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const toggleExpandAll = () => {
    if (expandedGroupKeys.size === groupedEcus.length) {
      setExpandedGroupKeys(new Set())
    } else {
      setExpandedGroupKeys(new Set(groupedEcus.map(g => g.key)))
    }
  }

  const inputClass =
    'px-3 py-2 rounded-xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)] w-full'

  const getStockBadge = (ecu: any) => {
    const qty = Number(ecu.stock_quantity ?? ecu.quantity ?? 1) || 0
    if (qty === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">
          <AlertTriangle size={12} className="text-rose-500" />
          نفد (0)
        </span>
      )
    }
    if (qty <= 1) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200"
          title="تنبيه: متبقي قطعة واحدة فقط أو أقل"
        >
          <AlertTriangle size={12} className="text-amber-500" />
          تحذير ({qty})
        </span>
      )
    }
    return (
      <span className="inline-flex items-center justify-center min-w-8 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
        {qty}
      </span>
    )
  }

  // Hierarchical path badge
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
            {viewMode === 'grouped' ? (
              <span>{groupedEcus.length} طراز مجمّع ({filteredEcus.length} قطعة متوفرة في المخزن)</span>
            ) : (
              <span>{filteredEcus.length} من أصل {initialEcus.length} صنف</span>
            )}
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
            placeholder="بحث بالباركود، رقم الشاسيه (VIN)، اسم الصنف، الصانع، العائلة، الموديل، السوفتوير، الرف..."
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
              <span className="hidden sm:inline">ماسح Barcode/VIN</span>
            </span>
          </div>
        </div>

        {/* Exact Barcode Match Banner */}
        {exactBarcodeMatch && (
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-violet-50 border-2 border-violet-300 text-violet-900 text-sm animate-in fade-in duration-200 shadow-xs">
            <div className="flex items-center gap-2 flex-wrap font-medium">
              <CheckCircle2 size={18} className="text-violet-600 shrink-0" />
              <span>تم العثور على مطابقة تامة للباركود / VIN:</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded-md border border-violet-200 text-violet-700 font-bold">
                {exactBarcodeMatch.barcode}
              </span>
              <span className="text-slate-700 font-bold">({exactBarcodeMatch.name})</span>
              {exactBarcodeMatch.software_id && (
                <span className="font-mono text-xs bg-violet-200/60 text-violet-800 px-2 py-0.5 rounded-md font-semibold">
                  SW: {exactBarcodeMatch.software_id}
                </span>
              )}
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
              className="text-xs text-violet-600 hover:text-violet-900 font-semibold px-2.5 py-1 rounded-lg hover:bg-violet-100 transition-colors shrink-0"
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

      {/* ── View Switcher & Expand/Collapse Controls ─────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('grouped')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'grouped'
                ? 'bg-white text-violet-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers size={14} />
            عرض مجمّع ({groupedEcus.length} طراز)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('flat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'flat'
                ? 'bg-white text-violet-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ListFilter size={14} />
            عرض فردي ({filteredEcus.length} قطعة)
          </button>
        </div>

        {viewMode === 'grouped' && groupedEcus.length > 0 && (
          <button
            type="button"
            onClick={toggleExpandAll}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-violet-50 hover:border-violet-300 text-xs font-semibold text-slate-600 hover:text-violet-700 transition-colors"
          >
            {expandedGroupKeys.size === groupedEcus.length ? (
              <>
                <ChevronUp size={14} />
                طي جميع الطرازات
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                توسيع جميع الطرازات ({groupedEcus.length})
              </>
            )}
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          MODE 1: GROUPED VIEW (ACCORDION & BREAKDOWN)
          ══════════════════════════════════════════════════════ */}
      {viewMode === 'grouped' && (
        <div className="space-y-4">
          {groupedEcus.length === 0 && (
            <div className="soft-card py-16 text-center text-slate-400 text-sm">
              لا توجد طرازات مطابقة لخيارات البحث المحددة
            </div>
          )}

          {groupedEcus.map(group => {
            const isExpanded = expandedGroupKeys.has(group.key)
            const hasExactMatch = exactBarcodeMatch && group.items.some(it => it.id === exactBarcodeMatch.id)

            return (
              <div
                key={group.key}
                id={`ecu-group-${group.key}`}
                className={`soft-card overflow-hidden transition-all duration-200 border-2 ${
                  hasExactMatch
                    ? 'ring-2 ring-violet-500 border-violet-400 bg-violet-50/20'
                    : isExpanded
                    ? 'border-violet-300 shadow-sm'
                    : 'border-slate-100 hover:border-violet-200'
                }`}
              >
                {/* ── Group Header Bar (Click to toggle) ── */}
                <div
                  onClick={() => toggleGroup(group.key)}
                  className="p-4 sm:p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none hover:bg-violet-50/20 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      aria-label="توسيع أو طي"
                      className={`mt-0.5 p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-700 transition-all duration-200 shrink-0 ${
                        isExpanded ? 'rotate-180 bg-violet-100 text-violet-700' : ''
                      }`}
                    >
                      <ChevronDown size={18} />
                    </button>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Software ID and Breadcrumb path */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {group.software_id ? (
                          <span className="font-mono text-xs sm:text-sm font-extrabold text-violet-700 bg-violet-100/90 border border-violet-300 px-2.5 py-0.5 rounded-xl shadow-xs">
                            {group.software_id}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
                            بدون Software ID
                          </span>
                        )}

                        <div className="flex items-center gap-1 text-xs text-slate-500 flex-wrap">
                          {group.manufacturer && (
                            <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                              {group.manufacturer}
                            </span>
                          )}
                          {group.ecu_family && (
                            <>
                              <span className="text-slate-300">›</span>
                              <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                                {group.ecu_family}
                              </span>
                            </>
                          )}
                          {group.vehicle_model_code && (
                            <>
                              <span className="text-slate-300">›</span>
                              <span className="bg-violet-50 text-violet-700 font-semibold px-2 py-0.5 rounded-md text-[11px] border border-violet-100">
                                {group.vehicle_model_code}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Model / Display Name */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                          {group.displayName}
                        </h3>
                        {group.matchingItemIds.size > 0 && search.trim().length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-violet-600 text-white px-2 py-0.5 rounded-full">
                            مطابقة ({group.matchingItemIds.size})
                          </span>
                        )}
                      </div>

                      {/* Shelf Locations Summary */}
                      {group.shelfLocations.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-0.5">
                          <MapPin size={12} className="text-violet-500 shrink-0" />
                          <span>مواقع الرفوف:</span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {group.shelfLocations.map((loc, i) => (
                              <span key={i} className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                {loc}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Left (RTL): Total Stock Quantity & Price Summary */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-right space-y-1">
                      <div className="flex items-center gap-2">
                        {group.isOutOfStock ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">
                            <AlertTriangle size={13} />
                            نفد من المخزون (0)
                          </span>
                        ) : group.hasLowStock ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs"
                            title="تحذير: متبقي قطعة واحدة فقط أو أقل"
                          >
                            <AlertTriangle size={13} className="text-amber-500" />
                            تحذير مخزون منخفض ({group.totalStockQuantity} قطعة)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            {group.totalStockQuantity} قطع متوفرة
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 text-xs">
                        <span className="text-slate-400 font-medium">
                          {group.totalUnitsCount} {group.totalUnitsCount === 1 ? 'وحدة مسجلة' : 'وحدات مسجلة'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-emerald-600 font-bold font-mono">
                          {formatCurrency(group.minPrice)}
                          {group.maxPrice !== group.minPrice && ` - ${formatCurrency(group.maxPrice)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Expanded Units Breakdown (Sub-table / Sub-cards) ── */}
                {isExpanded && (
                  <div className="bg-slate-50/70 border-t border-slate-200/80 p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Scan size={13} className="text-violet-600" />
                          تفصيل القطع والوحدات المتوفرة برقم الباركود والشاسيه (VIN):
                        </span>
                        <span className="text-xs font-semibold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                          {group.items.length} {group.items.length === 1 ? 'وحدة' : 'وحدات'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 hidden sm:inline">
                        اضغط على كود الباركود لنسخه سريعاً
                      </span>
                    </div>

                    {/* Desktop Sub-Table */}
                    <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-500 bg-slate-50/90">
                            <th className="text-right px-4 py-3 font-semibold w-10">#</th>
                            <th className="text-right px-4 py-3 font-semibold">الباركود / رقم الشاسيه (VIN)</th>
                            <th className="text-center px-3 py-3 font-semibold">موقع الرف</th>
                            <th className="text-center px-3 py-3 font-semibold">الكمية</th>
                            <th className="text-right px-3 py-3 font-semibold">الملاحظات الفنية</th>
                            <th className="text-right px-3 py-3 font-semibold">رموز الأعطال</th>
                            {isAdmin && <th className="text-left px-3 py-3 font-semibold">سعر الشراء</th>}
                            <th className="text-left px-4 py-3 font-semibold">سعر البيع</th>
                            {isAdmin && <th className="px-3 py-3 w-20 text-center">الإجراءات</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.items.map((ecu: any, idx: number) => {
                            const isExact = exactBarcodeMatch?.id === ecu.id
                            const isMatched = group.matchingItemIds.has(ecu.id) && search.trim().length > 0

                            return (
                              <tr
                                key={ecu.id}
                                id={`ecu-unit-desktop-${ecu.id}`}
                                className={`transition-all duration-200 ${
                                  isExact
                                    ? 'bg-violet-100/95 ring-2 ring-violet-500 font-bold shadow-sm'
                                    : isMatched
                                    ? 'bg-violet-50/70 font-semibold'
                                    : 'hover:bg-slate-50/80 group/row'
                                }`}
                              >
                                <td className="px-4 py-3 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {ecu.barcode ? (
                                      <button
                                        type="button"
                                        onClick={() => copyBarcode(ecu.barcode)}
                                        className={`font-mono text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                                          isExact
                                            ? 'bg-white text-violet-800 border-violet-400 shadow-xs font-bold'
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-violet-300 hover:bg-violet-50/50'
                                        }`}
                                        title="اضغط لنسخ الباركود / VIN"
                                      >
                                        <Scan size={12} className="text-violet-500 shrink-0" />
                                        <span>{ecu.barcode}</span>
                                        <Copy size={11} className="text-slate-400 hover:text-violet-600 transition-colors" />
                                      </button>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                    {isExact && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-600 text-white shadow-xs animate-pulse">
                                        مطابقة تامة
                                      </span>
                                    )}
                                    {!isExact && isMatched && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                                        مطابقة
                                      </span>
                                    )}
                                    {ecu.barcode && flashArchiveVins.has(ecu.barcode) && (
                                      <Link
                                        href={`/ecu-archive?search=${encodeURIComponent(ecu.barcode)}`}
                                        onClick={e => e.stopPropagation()}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-700 border border-amber-300 hover:bg-amber-400/40 transition-colors"
                                        title="ملف الفلاش متوفر في بنك الملفات"
                                      >
                                        <Zap size={10} className="fill-amber-500 text-amber-500" />
                                        ملف الفلاش متوفر
                                      </Link>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {ecu.shelf_location ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-xs bg-violet-50 text-violet-700 border border-violet-200">
                                      <MapPin size={11} className="text-violet-500 shrink-0" />
                                      {ecu.shelf_location}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 text-xs">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {getStockBadge(ecu)}
                                </td>
                                <td className="px-3 py-3 text-slate-600 max-w-[220px]">
                                  {ecu.notes ? (
                                    <span className="truncate block" title={ecu.notes}>
                                      📝 {ecu.notes}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-3 font-mono text-slate-500">
                                  {ecu.symbols_codes || <span className="text-slate-300">—</span>}
                                </td>
                                {isAdmin && (
                                  <td className="px-3 py-3 text-left font-mono text-slate-500">
                                    {formatCurrency(ecu.purchase_price)}
                                  </td>
                                )}
                                <td className="px-4 py-3 text-left font-mono font-bold text-emerald-600">
                                  {formatCurrency(ecu.selling_price)}
                                </td>
                                {isAdmin && (
                                  <td className="px-3 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Link
                                        href={`/inventory/${ecu.id}/edit`}
                                        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                        title="تعديل هذه القطعة"
                                      >
                                        <Pencil size={13} />
                                      </Link>
                                      <InventoryActions ecuId={ecu.id} />
                                    </div>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Sub-Cards */}
                    <div className="md:hidden space-y-2.5">
                      {group.items.map((ecu: any, idx: number) => {
                        const isExact = exactBarcodeMatch?.id === ecu.id
                        const isMatched = group.matchingItemIds.has(ecu.id) && search.trim().length > 0

                        return (
                          <div
                            key={ecu.id}
                            id={`ecu-unit-mobile-${ecu.id}`}
                            className={`p-3 rounded-xl border bg-white space-y-2 transition-all duration-200 ${
                              isExact
                                ? 'ring-2 ring-violet-500 bg-violet-50/80 border-violet-300 shadow-sm'
                                : isMatched
                                ? 'border-violet-300 bg-violet-50/40'
                                : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] text-slate-400 font-mono font-bold">#{idx + 1}</span>
                                {ecu.barcode ? (
                                  <button
                                    type="button"
                                    onClick={() => copyBarcode(ecu.barcode)}
                                    className="font-mono text-xs font-bold bg-slate-50 hover:bg-violet-50 px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 flex items-center gap-1"
                                  >
                                    <Scan size={11} className="text-violet-500" />
                                    {ecu.barcode}
                                    <Copy size={10} className="text-slate-400" />
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-xs">بدون باركود</span>
                                )}
                                {ecu.barcode && flashArchiveVins.has(ecu.barcode) && (
                                  <Link
                                    href={`/ecu-archive?search=${encodeURIComponent(ecu.barcode)}`}
                                    onClick={e => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-700 border border-amber-300 hover:bg-amber-400/40 transition-colors"
                                    title="ملف الفلاش متوفر"
                                  >
                                    <Zap size={9} className="fill-amber-500 text-amber-500" />
                                    ملف الفلاش متوفر
                                  </Link>
                                )}
                                {isExact && (
                                  <span className="text-[10px] font-bold bg-violet-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                                    مطابقة تامة
                                  </span>
                                )}
                              </div>
                              <div>{getStockBadge(ecu)}</div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
                              {ecu.shelf_location && (
                                <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 px-2 py-0.5 rounded-md border border-violet-200 font-semibold">
                                  <MapPin size={11} /> {ecu.shelf_location}
                                </span>
                              )}
                              {ecu.symbols_codes && (
                                <span className="font-mono text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                  {ecu.symbols_codes}
                                </span>
                              )}
                            </div>

                            {ecu.notes && (
                              <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                📝 {ecu.notes}
                              </p>
                            )}

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                              <div className="flex items-center gap-2">
                                {isAdmin && (
                                  <span className="text-slate-400">
                                    شراء: <span className="font-mono font-semibold text-slate-600">{formatCurrency(ecu.purchase_price)}</span>
                                  </span>
                                )}
                                <span className="text-emerald-600 font-bold font-mono">
                                  بيع: {formatCurrency(ecu.selling_price)}
                                </span>
                              </div>
                              {isAdmin && (
                                <div className="flex items-center gap-1">
                                  <Link
                                    href={`/inventory/${ecu.id}/edit`}
                                    className="p-1 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg"
                                  >
                                    <Pencil size={13} />
                                  </Link>
                                  <InventoryActions ecuId={ecu.id} />
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODE 2: FLAT / INDIVIDUAL PIECES VIEW
          ══════════════════════════════════════════════════════ */}
      {viewMode === 'flat' && (
        <>
          {/* Desktop Table (hidden on mobile) */}
          <div className="soft-card overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 bg-slate-50/60">
                    <th className="text-right px-5 py-4 font-semibold">الاسم</th>
                    <th className="text-right px-4 py-4 font-semibold">التصنيف الهرمي</th>
                    <th className="text-right px-4 py-4 font-semibold">الباركود / VIN</th>
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
                            <button
                              type="button"
                              onClick={() => copyBarcode(ecu.barcode)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
                                isExactMatched
                                  ? 'text-violet-700 font-bold bg-white border-violet-300'
                                  : 'text-slate-600 hover:text-violet-700 border-transparent hover:border-slate-200'
                              }`}
                              title="اضغط للنسخ"
                            >
                              <span>{ecu.barcode}</span>
                              <Copy size={11} className="text-slate-400" />
                            </button>
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

          {/* Mobile Cards (shown only on mobile) */}
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
                      <button
                        type="button"
                        onClick={() => copyBarcode(ecu.barcode)}
                        className={`font-mono flex items-center gap-1 ${
                          isExactMatched ? 'font-bold text-violet-700 bg-white px-2 py-0.5 rounded border border-violet-200' : ''
                        }`}
                      >
                        📦 {ecu.barcode}
                        <Copy size={10} className="text-slate-400" />
                      </button>
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
        </>
      )}
    </div>
  )
}
