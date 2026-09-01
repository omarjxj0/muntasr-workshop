'use client'

import { useState } from 'react'
import { X, Save, Phone, User, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface Props {
  customerId: string
  initialName: string
  initialPhone: string
  initialAddress: string
}

const inputClass = "w-full px-4 py-2.5 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"

export default function EditCustomerModal({ customerId, initialName, initialPhone, initialAddress }: Props) {
  const [open, setOpen]         = useState(false)
  const [name, setName]         = useState(initialName)
  const [phone, setPhone]       = useState(initialPhone)
  const [address, setAddress]   = useState(initialAddress)
  const [saving, setSaving]     = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('customers')
      .update({ name: name.trim(), phone: phone.trim(), address: address.trim() || null } as any)
      .eq('id', customerId)
    if (error) { toast.error('فشل في حفظ التعديلات'); setSaving(false); return }
    toast.success('تم تحديث بيانات الزبون ✔')
    setOpen(false)
    router.refresh()
    setSaving(false)
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-2xl text-sm font-semibold transition-all border-2 border-slate-200 bg-white text-slate-600 hover:text-violet-600 hover:border-violet-200 hover:bg-violet-50"
      >
        ✏️ تعديل بيانات الزبون
      </button>

      {/* Modal backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,10,40,0.5)', backdropFilter: 'blur(6px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl p-6 space-y-5 animate-fade-up"
            style={{
              background: '#ffffff',
              boxShadow: '0 25px 80px rgba(124,58,237,0.2), 0 4px 20px rgba(0,0,0,0.08)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-slate-800">تعديل بيانات الزبون</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-xl transition-colors text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-sm mb-1.5 text-slate-500 font-medium">
                  <User size={13} /> الاسم *
                </label>
                <input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm mb-1.5 text-slate-500 font-medium">
                  <Phone size={13} /> رقم الهاتف *
                </label>
                <input
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm mb-1.5 text-slate-500 font-medium">
                  <MapPin size={13} /> سكن الزبون
                </label>
                <input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="الحي، الشارع..."
                  className={inputClass}
                />
              </div>

              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-2xl text-sm font-semibold border-2 border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-2xl text-sm font-bold transition-all disabled:opacity-60 text-white"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                    boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
                  }}
                >
                  <Save size={15} />
                  {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
