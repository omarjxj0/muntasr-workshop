'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Phone, UserPlus, Car, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Customer { id: string; phone: string; name: string; created_at: string }
interface Vehicle { id: string; customer_id: string; license_plate: string; chassis_number_vin: string | null; make_and_model: string }
interface SearchResult { customer: Customer; vehicles: Vehicle[] }

export default function PhoneSearch() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [notFound, setNotFound] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setResult(null)
    setNotFound(false)

    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', query.trim())
      .single() as { data: Customer | null }

    if (!customer) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('*')
      .eq('customer_id', customer.id) as { data: Vehicle[] | null }

    setResult({ customer, vehicles: vehicles ?? [] })
    setLoading(false)
  }

  const handleStartVisit = async (vehicleId: string) => {
    const visitResult = await supabase
      .from('visits')
      .insert({ vehicle_id: vehicleId, complaint: '' } as any)
      .select()
      .single()
    const visit = visitResult.data as { id: string } | null
    const visitError = visitResult.error

    if (visitError || !visit) { toast.error('فشل في إنشاء الزيارة'); return }
    toast.success('تم فتح زيارة جديدة')
    router.push(`/visits/${visit.id}`)
  }



  const inputClass = "w-full px-4 py-3 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSearch} className="relative">
        <div className="absolute inset-y-0 right-0 flex items-center pr-5 pointer-events-none">
          <Phone size={22} className="text-violet-400" />
        </div>
        <input
          ref={inputRef}
          type="tel"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="أدخل رقم الهاتف للبحث عن العميل..."
          className="w-full pr-14 pl-36 py-5 rounded-2xl bg-white border-2 border-slate-200 text-xl text-slate-700 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_4px_rgba(124,58,237,0.1)]"
          dir="rtl"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute left-3 inset-y-3 px-6 rounded-xl font-semibold flex items-center gap-2 transition-all duration-200 text-white disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            boxShadow: '0 4px 15px rgba(124,58,237,0.35)',
          }}
        >
          <Search size={18} />
          {loading ? 'جارٍ البحث...' : 'بحث'}
        </button>
      </form>

      {result && (
        <div className="mt-6 soft-card p-6 space-y-4 animate-fade-up">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{result.customer.name}</h2>
              <p className="text-slate-500 mt-1 flex items-center gap-2">
                <Phone size={15} />
                {result.customer.phone}
              </p>
              <p className="text-slate-400 text-sm mt-1">منذ: {formatDate(result.customer.created_at)}</p>
            </div>
            <button
              onClick={() => router.push(`/customers/${result.customer.id}`)}
              className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700 font-semibold transition-colors"
            >
              الملف الكامل
              <ChevronLeft size={16} />
            </button>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
              <Car size={16} />
              المركبات ({result.vehicles.length})
            </h3>
            {result.vehicles.length === 0 ? (
              <p className="text-slate-400 text-sm">لا توجد مركبات مسجلة</p>
            ) : (
              <div className="space-y-3">
                {result.vehicles.map(vehicle => (
                  <div key={vehicle.id} className="flex items-center justify-between bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div>
                      <p className="font-semibold text-slate-700">{vehicle.make_and_model}</p>
                      <p className="text-slate-500 text-sm">
                        {vehicle.license_plate}
                        {vehicle.chassis_number_vin && ` · ${vehicle.chassis_number_vin}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleStartVisit(vehicle.id)}
                      className="px-4 py-2 rounded-2xl text-sm font-semibold text-white transition-all duration-200"
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                      }}
                    >
                      فتح زيارة جديدة
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {notFound && (
        <div className="mt-6 soft-card p-6 text-center animate-fade-up">
          <p className="text-slate-500 mb-4">
            لم يتم العثور على عميل بالرقم <span className="text-slate-700 font-mono font-bold">{query}</span>
          </p>
          <button
            onClick={() => router.push(`/customers/new?phone=${query}`)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
              boxShadow: '0 4px 15px rgba(124,58,237,0.35)',
            }}
          >
            <UserPlus size={18} />
            ➕ إضافة كزبون جديد
          </button>
        </div>
      )}
    </div>
  )
}
