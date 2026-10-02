'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { UserPlus, ArrowRight, Phone, User, Car, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Link from 'next/link'

function NewCustomerPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPhone = searchParams.get('phone') || ''
  
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: initialPhone, address: '' })
  const [newVehicle, setNewVehicle] = useState({ make_and_model: '', chassis_number_vin: '', complaint: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (initialPhone) {
      setNewCustomer(prev => ({ ...prev, phone: initialPhone }))
    }
  }, [initialPhone])

  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault()

    const name = newCustomer.name.trim()
    const phone = newCustomer.phone.trim()
    const address = newCustomer.address.trim()
    const makeAndModel = newVehicle.make_and_model.trim()
    const vin = newVehicle.chassis_number_vin.trim()
    const complaint = newVehicle.complaint.trim()

    if (!name || !phone) {
      toast.error('يرجى إدخال اسم ورقم هاتف الزبون')
      return
    }

    if (!makeAndModel) {
      toast.error('يرجى إدخال نوع وموديل السيارة (مثال: سنتافي 2018)')
      return
    }

    setIsSubmitting(true)

    try {
      // 1. Check if customer already exists by phone
      let customerId: string | null = null
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phone)
        .maybeSingle()

      if (existingCust?.id) {
        customerId = existingCust.id
        await supabase
          .from('customers')
          .update({ name, address: address || null } as any)
          .eq('id', customerId)
      } else {
        const { data: customer, error: custError } = await supabase
          .from('customers')
          .insert({ 
            name, 
            phone, 
            address: address || null 
          } as any)
          .select()
          .single()

        if (custError || !customer) {
          console.error('Customer Insert Error:', custError)
          toast.error(`فشل في تسجيل العميل: ${custError?.message || 'خطأ في حفظ البيانات'}`)
          setIsSubmitting(false)
          return
        }
        customerId = customer.id
      }

      // 2. Add vehicle (default license_plate to '—' to satisfy NOT NULL constraint)
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .insert({
          customer_id: customerId,
          license_plate: '—',
          make_and_model: makeAndModel,
          chassis_number_vin: vin || null,
        } as any)
        .select()
        .single()

      if (vehicleError || !vehicle) {
        console.error('Vehicle Insert Error:', vehicleError)
        toast.error(`حدث خطأ في إضافة المركبة: ${vehicleError?.message || 'فشل في الحفظ'}`)
        setIsSubmitting(false)
        return
      }

      // 3. Automatically open active visit in "زيارات نشطة"
      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .insert({
          vehicle_id: vehicle.id,
          status: 'In Progress',
          complaint: complaint || 'فحص وصيانة عامة',
          entry_date: new Date().toISOString(),
        } as any)
        .select()
        .single()

      if (visitError || !visit) {
        console.error('Visit Insert Error:', visitError)
        toast.success('تم تسجيل الزبون والمركبة بنجاح')
        router.push(`/customers/${customerId}`)
        return
      }

      toast.success('تم تسجيل الزبون وفتح زيارة نشطة بنجاح 🚗')
      router.push(`/visits/${visit.id}`)
    } catch (err: any) {
      console.error('Unexpected Registration Error:', err)
      toast.error(`حدث خطأ غير متوقع: ${err?.message || err}`)
      setIsSubmitting(false)
    }
  }

  const inputClass = "w-full px-4 py-3 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <Link
        href="/customers"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-violet-600 transition-colors font-medium"
      >
        <ArrowRight size={16} />
        العودة للزبائن
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <UserPlus size={28} className="text-violet-500" />
            تسجيل سريع وفتح زيارة
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            تسجيل بيانات الزبون والسيارة وفتح زيارة في &quot;زيارات نشطة&quot; بضغطة واحدة
          </p>
        </div>
      </div>

      <form onSubmit={handleRegisterCustomer} className="soft-card p-6 md:p-8 space-y-6 animate-fade-up">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="flex items-center gap-1.5 text-sm text-slate-700 mb-2 font-medium">
              <User size={14} className="text-violet-500" />
              اسم الزبون *
            </label>
            <input 
              required 
              value={newCustomer.name} 
              onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))}
              placeholder="مثال: أحمد علي"
              className={inputClass} 
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm text-slate-700 mb-2 font-medium">
              <Phone size={14} className="text-violet-500" />
              رقم الهاتف *
            </label>
            <input 
              required 
              value={newCustomer.phone} 
              onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))}
              placeholder="07700000000"
              className={`${inputClass} font-mono`} 
              dir="ltr"
            />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-1.5 text-sm text-slate-700 mb-2 font-medium">
              <MapPin size={14} className="text-violet-500" />
              سكن الزبون / العنوان (اختياري)
            </label>
            <input 
              value={newCustomer.address} 
              onChange={e => setNewCustomer(p => ({ ...p, address: e.target.value }))}
              placeholder="المدينة، الحي أو الشارع..."
              className={inputClass} 
            />
          </div>
        </div>
        
        <div className="border-t border-slate-100 pt-6">
          <p className="text-sm text-slate-800 mb-4 font-bold flex items-center gap-2">
            <Car size={16} className="text-violet-500" />
            بيانات المركبة والزيارة
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-700 mb-2 font-semibold">
                نوع وموديل السيارة *
              </label>
              <input 
                required
                value={newVehicle.make_and_model} 
                onChange={e => setNewVehicle(p => ({ ...p, make_and_model: e.target.value }))}
                placeholder="مثال: سنتافي 2018 أو كيا سبورتاج 2015"
                className={inputClass} 
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2 font-medium">رقم الشاسيه (VIN) (اختياري)</label>
              <input 
                value={newVehicle.chassis_number_vin} 
                onChange={e => setNewVehicle(p => ({ ...p, chassis_number_vin: e.target.value }))}
                placeholder="رقم الشاسيه"
                className={`${inputClass} font-mono`} 
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2 font-medium">الشكوى أو العطل المبدئي</label>
              <input 
                value={newVehicle.complaint} 
                onChange={e => setNewVehicle(p => ({ ...p, complaint: e.target.value }))}
                placeholder="مثال: برمجة عقل محرك، فحص كهرباء..."
                className={inputClass} 
              />
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 justify-end pt-4">
          <button 
            type="button" 
            onClick={() => router.push('/customers')}
            className="px-6 py-3 rounded-2xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-semibold text-sm"
          >
            إلغاء
          </button>
          <button 
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 rounded-2xl text-base font-bold text-white transition-all disabled:opacity-70 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', boxShadow: '0 4px 15px rgba(124,58,237,0.35)' }}
          >
            <Car size={18} />
            {isSubmitting ? 'جاري التسجيل وفتح الزيارة...' : 'تسجيل وفتح زيارة نشطة'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function NewCustomerPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-400">جارٍ التحميل...</div>}>
      <NewCustomerPageInner />
    </Suspense>
  )
}
