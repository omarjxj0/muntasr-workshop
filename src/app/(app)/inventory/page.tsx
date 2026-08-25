import { createClient } from '@/lib/supabase/server'
import { Package, Plus } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import InventoryActions from './InventoryActions'
import InventoryFilterBar from './InventoryFilterBar'

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; company?: string; category?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isAdmin = (profile as any)?.role === 'admin'

  let query = supabase
    .from('ecus')
    .select('id, name, barcode, symbols_codes, stock_quantity, purchase_price, selling_price, company_id, category_id, ecu_companies(name), ecu_categories(name)')
    .order('name')

  if (sp.q) query = query.ilike('name', `%${sp.q}%`)
  if (sp.company) query = query.eq('company_id', sp.company)
  if (sp.category) query = query.eq('category_id', sp.category)

  const { data: ecus } = await query
  const { data: companies } = await supabase.from('ecu_companies').select('id, name').order('name')
  const { data: categories } = await supabase.from('ecu_categories').select('id, name').order('name')

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Package size={28} className="text-emerald-400" />
            مخزون القطع (ECU)
          </h1>
          <p className="text-slate-400 mt-1">{ecus?.length ?? 0} صنف</p>
        </div>
        {isAdmin && (
          <Link href="/inventory/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-emerald-600/20">
            <Plus size={18} />
            إضافة صنف
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <InventoryFilterBar
          companies={(companies ?? []) as { id: string; name: string }[]}
          categories={(categories ?? []) as { id: string; name: string }[]}
          currentCompany={sp.company}
          currentCategory={sp.category}
          currentQ={sp.q}
        />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="text-right px-5 py-4 font-medium">الاسم</th>
                <th className="text-right px-4 py-4 font-medium">الشركة</th>
                <th className="text-right px-4 py-4 font-medium">النوع</th>
                <th className="text-right px-4 py-4 font-medium">الباركود</th>
                <th className="text-center px-4 py-4 font-medium">المخزون</th>
                {isAdmin && <th className="text-left px-4 py-4 font-medium">سعر الشراء</th>}
                <th className="text-left px-4 py-4 font-medium">سعر البيع</th>
                {isAdmin && <th className="px-4 py-4" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {(ecus ?? []).map((ecu: any) => (
                <tr key={ecu.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="font-medium text-slate-200">{ecu.name}</p>
                      {ecu.symbols_codes && (
                        <p className="text-xs text-slate-500 font-mono">{ecu.symbols_codes}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-400">{(ecu.ecu_companies as any)?.name ?? '—'}</td>
                  <td className="px-4 py-3.5 text-slate-400">{(ecu.ecu_categories as any)?.name ?? '—'}</td>
                  <td className="px-4 py-3.5 font-mono text-slate-400 text-xs">{ecu.barcode ?? '—'}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`inline-flex items-center justify-center w-10 h-6 rounded-full text-xs font-bold ${
                      ecu.stock_quantity === 0
                        ? 'bg-rose-500/20 text-rose-400'
                        : ecu.stock_quantity <= 3
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {ecu.stock_quantity}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3.5 text-left text-slate-400">
                      {formatCurrency(ecu.purchase_price)}
                    </td>
                  )}
                  <td className="px-4 py-3.5 text-left font-semibold text-emerald-400">
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
          {!ecus?.length && (
            <div className="py-16 text-center text-slate-500">لا توجد أصناف مطابقة</div>
          )}
        </div>
      </div>
    </div>
  )
}
