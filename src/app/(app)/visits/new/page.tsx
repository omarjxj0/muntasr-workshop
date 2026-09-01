'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

function NewVisitPageInner() {
  const searchParams = useSearchParams()
  const vehicleId = searchParams.get('vehicleId')
  const router = useRouter()
  const supabase = createClient()
  const [complaint, setComplaint] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vehicleId) return
    setLoading(true)
    const result = await supabase
      .from('visits')
      .insert({ vehicle_id: vehicleId, complaint } as any)
      .select()
      .single()
    const visit = result.data as any
    const error = result.error

    if (error || !visit) { toast.error('فشل في إنشاء الزيارة'); setLoading(false); return }
    toast.success('تم فتح الزيارة')
    router.push(`/visits/${visit.id}`)
  }

  if (!vehicleId) {
    return (
      <div className="p-10 text-center text-slate-400">
        يرجى تحديد مركبة أولاً. <a href="/" className="text-blue-400 hover:underline">العودة للبحث</a>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-10 max-w-xl mx-auto">
      <div className="glass-card p-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">فتح زيارة جديدة</h1>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-2 font-medium">وصف المشكلة / الشكوى</label>
            <textarea value={complaint} onChange={e => setComplaint(e.target.value)}
              rows={4} placeholder="اكتب وصف المشكلة..."
              className="w-full px-4 py-3 rounded-xl bg-slate-50 text-slate-800 border border-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none transition-all focus:outline-none" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 btn-gradient text-white rounded-xl font-bold transition-all disabled:opacity-60">
            {loading ? 'جارٍ الإنشاء...' : 'فتح الزيارة'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function NewVisitPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-400">جارٍ التحميل...</div>}>
      <NewVisitPageInner />
    </Suspense>
  )
}
