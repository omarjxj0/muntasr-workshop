import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { UserCheck, Plus, Phone, MapPin, Car, ChevronLeft } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select(`
      *,
      vehicles ( id )
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (sp.q?.trim()) {
    query = query.or(`name.ilike.%${sp.q}%,phone.ilike.%${sp.q}%`)
  }

  const { data: customers } = await query

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <UserCheck size={28} className="text-violet-500" />
            الزبائن
          </h1>
          <p className="text-sm mt-1 text-slate-500">
            {customers?.length ?? 0} زبون مسجّل
          </p>
        </div>
        <Link
          href="/customers/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all text-white"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            boxShadow: '0 4px 15px rgba(124,58,237,0.35)',
          }}
        >
          <Plus size={18} />
          إضافة زبون جديد
        </Link>
      </div>

      {/* Search bar */}
      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="ابحث بالاسم أو رقم الهاتف..."
          className="flex-1 px-4 py-2.5 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
        />
        <button
          type="submit"
          className="px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all text-white"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}
        >
          بحث
        </button>
        {sp.q && (
          <Link
            href="/customers"
            className="px-4 py-2.5 rounded-2xl text-sm font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 border-2 border-slate-200 transition-colors"
          >
            مسح
          </Link>
        )}
      </form>

      {/* Customer list */}
      {!customers?.length ? (
        <div className="soft-card p-16 text-center text-slate-400">
          {sp.q ? `لا نتائج لـ "${sp.q}"` : 'لا يوجد زبائن مسجّلون بعد'}
        </div>
      ) : (
        <div className="space-y-3">
          {customers.map((customer: any) => (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="soft-card p-5 flex items-center justify-between group transition-all duration-200 hover:shadow-[0_8px_30px_rgba(124,58,237,0.15)] block"
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-2xl bg-violet-50 border-2 border-violet-100 flex items-center justify-center shrink-0 font-bold text-lg text-violet-600">
                  {customer.name.charAt(0)}
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-slate-700 text-base group-hover:text-violet-700 transition-colors">
                    {customer.name}
                  </p>
                  <p className="flex items-center gap-1.5 text-sm font-mono text-slate-500">
                    <Phone size={12} />
                    {customer.phone}
                  </p>
                  {customer.address && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-400">
                      <MapPin size={11} />
                      {customer.address}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    عميل منذ: {formatDate(customer.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm bg-violet-50 text-violet-600 border border-violet-100">
                  <Car size={14} />
                  <span>{(customer.vehicles as any[])?.length ?? 0} مركبة</span>
                </div>
                <ChevronLeft size={18} className="text-slate-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
