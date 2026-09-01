'use client'

import { useState } from 'react'
import { RotateCcw, AlertTriangle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function ResetCashierButton() {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [resetting, setResetting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const confirmed = confirm.trim() === 'تصفير'

  const handleReset = async () => {
    if (!confirmed) return
    setResetting(true)

    // Delete all transactions first, then daily_wages
    const { error: txErr } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (txErr) {
      toast.error('فشل في حذف المعاملات: ' + txErr.message)
      setResetting(false)
      return
    }

    const { error: wagesErr } = await supabase.from('daily_wages').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (wagesErr) {
      toast.error('فشل في حذف الرواتب اليومية: ' + wagesErr.message)
      setResetting(false)
      return
    }

    toast.success('تم تصفير الصندوق — جميع السجلات المالية حُذفت')
    setOpen(false)
    setConfirm('')
    setResetting(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-rose-600 border-2 border-rose-200 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 transition-all duration-200"
      >
        <RotateCcw size={16} />
        تصفير الصندوق
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
              <div className="w-16 h-16 rounded-3xl bg-amber-50 border-2 border-amber-100 flex items-center justify-center">
                <AlertTriangle size={32} className="text-amber-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">تصفير الصندوق المالي</h2>
                <p className="text-slate-500 text-sm mt-1">
                  هذا الإجراء مخصص لمسح بيانات الاختبار قبل الإطلاق الرسمي
                </p>
              </div>
            </div>

            {/* Warning box */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
              <p className="text-sm font-bold text-amber-700 mb-2">⚠️ سيتم حذف جميع السجلات في:</p>
              <ul className="text-sm text-amber-600 space-y-1">
                <li>• جدول المعاملات المالية (transactions)</li>
                <li>• جدول الرواتب اليومية (daily_wages)</li>
              </ul>
              <p className="text-xs font-bold text-amber-700 mt-2 pt-2 border-t border-amber-200">
                ⚡ بيانات الزيارات والعملاء لن تُمس. لا يمكن التراجع!
              </p>
            </div>

            {/* Confirmation input */}
            <div>
              <label className="block text-sm text-slate-600 mb-2 font-medium">
                اكتب كلمة <span className="font-bold text-amber-600 font-mono bg-amber-50 px-1 py-0.5 rounded">"تصفير"</span> للتأكيد:
              </label>
              <input
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder='اكتب "تصفير" هنا...'
                className="w-full px-4 py-3 rounded-2xl border-2 text-sm font-medium transition-all"
                style={{
                  borderColor: confirmed ? '#f59e0b' : '#e2e4ef',
                  background: confirmed ? '#fffbeb' : '#f5f6fa',
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
                onClick={handleReset}
                disabled={!confirmed || resetting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: confirmed ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#e2e4ef',
                  boxShadow: confirmed ? '0 4px 15px rgba(245,158,11,0.35)' : 'none',
                }}
              >
                <RotateCcw size={15} />
                {resetting ? 'جارٍ التصفير...' : 'نعم، صفّر الصندوق'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
