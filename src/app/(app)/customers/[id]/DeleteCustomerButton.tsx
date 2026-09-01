'use client'

import { useState } from 'react'
import { Trash2, AlertTriangle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function DeleteCustomerButton({ customerId, customerName }: { customerId: string; customerName: string }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const confirmed = confirm.trim() === 'حذف'

  const handleDelete = async () => {
    if (!confirmed) return
    setDeleting(true)
    const { error } = await supabase.from('customers').delete().eq('id', customerId)
    if (error) {
      toast.error('فشل في حذف الزبون: ' + error.message)
      setDeleting(false)
      return
    }
    toast.success('تم حذف الزبون وجميع بياناته نهائياً')
    router.push('/customers')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-rose-600 border-2 border-rose-200 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 transition-all duration-200"
      >
        <Trash2 size={15} />
        حذف الزبون
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,10,40,0.55)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="relative w-full max-w-md rounded-3xl p-6 space-y-5 animate-fade-up"
            style={{
              background: '#ffffff',
              boxShadow: '0 25px 80px rgba(124,58,237,0.2), 0 4px 20px rgba(0,0,0,0.1)',
            }}
          >
            {/* Close */}
            <button
              onClick={() => { setOpen(false); setConfirm('') }}
              className="absolute top-4 left-4 p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Warning icon */}
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-3xl bg-rose-50 border-2 border-rose-100 flex items-center justify-center">
                <AlertTriangle size={32} className="text-rose-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">حذف الزبون نهائياً</h2>
                <p className="text-slate-500 text-sm mt-1">
                  أنت على وشك حذف الزبون <span className="font-bold text-slate-700">«{customerName}»</span>
                </p>
              </div>
            </div>

            {/* Warning list */}
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
              <p className="text-sm font-bold text-rose-700 mb-2">⚠️ سيتم حذف الآتي بشكل نهائي:</p>
              <ul className="text-sm text-rose-600 space-y-1 list-none">
                <li>• جميع سيارات هذا الزبون</li>
                <li>• جميع زيارات الصيانة المرتبطة بها</li>
                <li>• جميع القطع المستخدمة في تلك الزيارات</li>
                <li>• جميع صور الزيارات</li>
              </ul>
              <p className="text-xs font-bold text-rose-700 mt-2 pt-2 border-t border-rose-200">
                لا يمكن التراجع عن هذا الإجراء!
              </p>
            </div>

            {/* Confirmation input */}
            <div>
              <label className="block text-sm text-slate-600 mb-2 font-medium">
                اكتب كلمة <span className="font-bold text-rose-600 font-mono bg-rose-50 px-1 py-0.5 rounded">"حذف"</span> للتأكيد:
              </label>
              <input
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder='اكتب "حذف" هنا...'
                className="w-full px-4 py-3 rounded-2xl border-2 text-sm font-medium transition-all"
                style={{
                  borderColor: confirmed ? '#f43f5e' : '#e2e4ef',
                  background: confirmed ? '#fff5f5' : '#f5f6fa',
                  color: '#1e1b4b',
                }}
                dir="rtl"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setOpen(false); setConfirm('') }}
                className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleDelete}
                disabled={!confirmed || deleting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: confirmed ? 'linear-gradient(135deg, #f43f5e, #e11d48)' : '#e2e4ef',
                  boxShadow: confirmed ? '0 4px 15px rgba(244,63,94,0.35)' : 'none',
                }}
              >
                <Trash2 size={15} />
                {deleting ? 'جارٍ الحذف...' : 'نعم، احذف نهائياً'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
