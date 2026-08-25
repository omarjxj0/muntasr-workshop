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
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' })
  const [newVehicle, setNewVehicle] = useState({ license_plate: '', make_and_model: '', chassis_number_vin: '' })
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
    setShowRegisterForm(false)

    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', query.trim())
      .single() as { data: Customer | null }

    if (!customer) {
      setNotFound(true)
      setNewCustomer(prev => ({ ...prev, phone: query.trim() }))
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

  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustomer.name || !newCustomer.phone) return

    const custResult = await supabase
      .from('customers')
      .insert({ name: newCustomer.name, phone: newCustomer.phone } as any)
      .select()
      .single()
    const customer = custResult.data as Customer | null
    const custError = custResult.error

    if (custError || !customer) { toast.error('فشل في تسجيل العميل'); return }

    if (newVehicle.license_plate && newVehicle.make_and_model) {
      await supabase.from('vehicles').insert({
        customer_id: customer.id,
        license_plate: newVehicle.license_plate,
        make_and_model: newVehicle.make_and_model,
        chassis_number_vin: newVehicle.chassis_number_vin || null,
      } as any)
    }

    toast.success('تم تسجيل العميل بنجاح')
    router.push(`/customers/${customer.id}`)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSearch} className="relative">
        <div className="absolute inset-y-0 right-0 flex items-center pr-5 pointer-events-none">
          <Phone size={22} className="text-blue-400" />
        </div>
        <input
          ref={inputRef}
          type="tel"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="أدخل رقم الهاتف للبحث عن العميل..."
          className="w-full pr-14 pl-32 py-5 rounded-2xl bg-slate-800/80 border border-slate-700 text-xl text-slate-100 placeholder-slate-500 input-glow transition-all duration-200"
          dir="rtl"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute left-3 inset-y-3 px-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-semibold flex items-center gap-2 transition-all duration-200 shadow-lg shadow-blue-600/30"
        >
          <Search size={18} />
          {loading ? 'جارٍ البحث...' : 'بحث'}
        </button>
      </form>

      {result && (
        <div className="mt-6 glass-card p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-100">{result.customer.name}</h2>
              <p className="text-slate-400 mt-1 flex items-center gap-2">
                <Phone size={15} />
                {result.customer.phone}
              </p>
              <p className="text-slate-500 text-sm mt-1">منذ: {formatDate(result.customer.created_at)}</p>
            </div>
            <button
              onClick={() => router.push(`/customers/${result.customer.id}`)}
              className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              الملف الكامل
              <ChevronLeft size={16} />
            </button>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
              <Car size={16} />
              المركبات ({result.vehicles.length})
            </h3>
            {result.vehicles.length === 0 ? (
              <p className="text-slate-500 text-sm">لا توجد مركبات مسجلة</p>
            ) : (
              <div className="space-y-3">
                {result.vehicles.map(vehicle => (
                  <div key={vehicle.id} className="flex items-center justify-between bg-slate-800/60 rounded-xl p-4">
                    <div>
                      <p className="font-semibold text-slate-200">{vehicle.make_and_model}</p>
                      <p className="text-slate-400 text-sm">
                        {vehicle.license_plate}
                        {vehicle.chassis_number_vin && ` · ${vehicle.chassis_number_vin}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleStartVisit(vehicle.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-emerald-600/20"
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

      {notFound && !showRegisterForm && (
        <div className="mt-6 glass-card p-6 text-center animate-in fade-in slide-in-from-top-4 duration-300">
          <p className="text-slate-400 mb-4">
            لم يتم العثور على عميل بالرقم <span className="text-slate-200 font-mono">{query}</span>
          </p>
          <button
            onClick={() => setShowRegisterForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-blue-600/30"
          >
            <UserPlus size={18} />
            تسجيل عميل جديد
          </button>
        </div>
      )}

      {showRegisterForm && (
        <form onSubmit={handleRegisterCustomer}
          className="mt-6 glass-card p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <UserPlus size={20} className="text-blue-400" />
            تسجيل عميل جديد
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">الاسم *</label>
              <input required value={newCustomer.name} onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 input-glow" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">رقم الهاتف *</label>
              <input required value={newCustomer.phone} onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 input-glow font-mono" />
            </div>
          </div>
          <div className="border-t border-slate-700 pt-4">
            <p className="text-sm text-slate-400 mb-3 font-semibold">بيانات المركبة (اختياري)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">نوع السيارة</label>
                <input value={newVehicle.make_and_model} onChange={e => setNewVehicle(p => ({ ...p, make_and_model: e.target.value }))}
                  placeholder="مثال: تويوتا كامري 2020"
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 input-glow" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">رقم اللوحة</label>
                <input value={newVehicle.license_plate} onChange={e => setNewVehicle(p => ({ ...p, license_plate: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 input-glow font-mono" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-slate-400 mb-1">رقم الشاسيه (VIN)</label>
                <input value={newVehicle.chassis_number_vin} onChange={e => setNewVehicle(p => ({ ...p, chassis_number_vin: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 input-glow font-mono" />
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowRegisterForm(false)}
              className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
              إلغاء
            </button>
            <button type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/30">
              تسجيل
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
