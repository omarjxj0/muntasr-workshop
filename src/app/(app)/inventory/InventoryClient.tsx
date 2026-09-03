'use client'

import { useState, useMemo } from 'react'
import { Package, Plus, AlertTriangle, Search, MapPin } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import InventoryActions from './InventoryActions'

interface InventoryClientProps {
  initialEcus: any[]
  companies: { id: string; name: string }[]
  categories: { id: string; name: string }[]
  isAdmin: boolean
}

export default function InventoryClient({
  initialEcus,
  companies,
  categories,
  isAdmin,
}: InventoryClientProps) {
  const [search, setSearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all')

  const filteredEcus = useMemo(() => {
    return (initialEcus || []).filter(item => {
      const q = search.trim().toLowerCase()
      const matchesSearch =
        !q ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
        (item.symbols_codes && item.symbols_codes.toLowerCase().includes(q)) ||
        (item.shelf_location && item.shelf_location.toLowerCase().includes(q))

      const matchesCompany = !selectedCompany || item.company_id === selectedCompany
      const matchesCategory = !selectedCategory || item.category_id === selectedCategory

      const minQty = item.min_quantity ?? 3
      const isOut = item.stock_quantity === 0
      const isLow = item.stock_quantity <= minQty

      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'low' && isLow) ||
        (stockFilter === 'out' && isOut)

      return matchesSearch && matchesCompany && matchesCategory && matchesStock
    })
  }, [initialEcus, search, selectedCompany, selectedCategory, stockFilter])

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
      <div className="soft-card p-4 space-y-3">
        {/* Search full width on mobile */}
        <div className="relative">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم، الباركود، رموز الأعطال، أو موقع الرف..."
            className={`pr-9 ${inputClass}`}
          />
        </div>

        {/* Two selects side by side */}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={selectedCompany}
            onChange={e => setSelectedCompany(e.target.value)}
            className={inputClass}
          >
            <option value="">كل الشركات</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className={inputClass}
          >
            <option value="">كل الأنواع</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
                <th className="text-right px-4 py-4 font-semibold">الشركة</th>
                <th className="text-right px-4 py-4 font-semibold">النوع</th>
                <th className="text-right px-4 py-4 font-semibold">الباركود</th>
                <th className="text-center px-4 py-4 font-semibold">موقع الرف</th>
                <th className="text-center px-4 py-4 font-semibold">المخزون</th>
                {isAdmin && <th className="text-left px-4 py-4 font-semibold">سعر الشراء</th>}
                <th className="text-left px-4 py-4 font-semibold">سعر البيع</th>
                {isAdmin && <th className="px-4 py-4" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEcus.map((ecu: any) => (
                <tr key={ecu.id} className="hover:bg-violet-50/30 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="font-semibold text-slate-700">{ecu.name}</p>
                      {ecu.symbols_codes && (
                        <p className="text-xs text-slate-400 font-mono">{ecu.symbols_codes}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">
                    {(ecu.ecu_companies as any)?.name || companies.find(c => c.id === ecu.company_id)?.name || 'غير محدد'}
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">
                    {(ecu.ecu_categories as any)?.name || categories.find(c => c.id === ecu.category_id)?.name || 'غير محدد'}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-slate-400 text-xs">
                    {ecu.barcode ?? '—'}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {ecu.shelf_location ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200 font-mono tracking-wider">
                        <MapPin size={11} className="text-violet-500" />
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
              ))}
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
        {filteredEcus.map((ecu: any) => (
          <div key={ecu.id} className="soft-card p-4 space-y-3">
            {/* Top row: name + stock badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm leading-snug">{ecu.name}</p>
                {ecu.symbols_codes && (
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">{ecu.symbols_codes}</p>
                )}
              </div>
              <div className="shrink-0">{getStockBadge(ecu)}</div>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>
                🏢{' '}
                {(ecu.ecu_companies as any)?.name ||
                  companies.find(c => c.id === ecu.company_id)?.name ||
                  'غير محدد'}
              </span>
              <span>
                🔖{' '}
                {(ecu.ecu_categories as any)?.name ||
                  categories.find(c => c.id === ecu.category_id)?.name ||
                  'غير محدد'}
              </span>
              {ecu.barcode && (
                <span className="font-mono">📦 {ecu.barcode}</span>
              )}
              {ecu.shelf_location && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-mono font-bold tracking-wider">
                  <MapPin size={10} className="text-violet-500" />
                  {ecu.shelf_location}
                </span>
              )}
            </div>

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
        ))}
      </div>
    </div>
  )
}
