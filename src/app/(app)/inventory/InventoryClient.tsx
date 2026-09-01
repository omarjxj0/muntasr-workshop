'use client'

import { useState, useMemo } from 'react'
import { Package, Plus, AlertTriangle, Search, Filter } from 'lucide-react'
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
        (item.symbols_codes && item.symbols_codes.toLowerCase().includes(q))

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
    'px-4 py-2.5 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Package size={28} className="text-violet-500" />
            مخزون القطع (ECU)
          </h1>
          <p className="text-slate-500 mt-1">
            {filteredEcus.length} من أصل {initialEcus.length} صنف
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/inventory/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-white transition-all shadow-md hover:opacity-95"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
              boxShadow: '0 4px 15px rgba(124,58,237,0.35)',
            }}
          >
            <Plus size={18} />
            إضافة صنف
          </Link>
        )}
      </div>

      {/* Filters bar */}
      <div className="soft-card p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Real-time search */}
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث فوري بالاسم، الباركود، أو رموز الأعطال..."
              className={`w-full pr-10 pl-4 ${inputClass}`}
            />
          </div>

          {/* Company filter */}
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

          {/* Category filter */}
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

        {/* Quick stock status pills */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-medium ml-1">حالة المخزون:</span>
          <button
            type="button"
            onClick={() => setStockFilter('all')}
            className={`px-3 py-1 rounded-xl font-semibold transition-all ${
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
            className={`px-3 py-1 rounded-xl font-semibold transition-all ${
              stockFilter === 'low'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            ⚠️ نواقص المخزون
          </button>
          <button
            type="button"
            onClick={() => setStockFilter('out')}
            className={`px-3 py-1 rounded-xl font-semibold transition-all ${
              stockFilter === 'out'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            🚫 نفد المخزون
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="soft-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 bg-slate-50/60">
                <th className="text-right px-5 py-4 font-semibold">الاسم</th>
                <th className="text-right px-4 py-4 font-semibold">الشركة</th>
                <th className="text-right px-4 py-4 font-semibold">النوع</th>
                <th className="text-right px-4 py-4 font-semibold">الباركود</th>
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
                    {ecu.stock_quantity === 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">
                        <AlertTriangle size={12} className="text-rose-500" />
                        نفد (0)
                      </span>
                    ) : ecu.stock_quantity <= (ecu.min_quantity ?? 3) ? (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200"
                        title={`الحد الأدنى: ${ecu.min_quantity ?? 3}`}
                      >
                        <AlertTriangle size={12} className="text-amber-500" />
                        نقص ({ecu.stock_quantity})
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center min-w-8 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                        {ecu.stock_quantity}
                      </span>
                    )}
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
    </div>
  )
}
