'use client'

import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function DeleteEmployeeButton({ employeeId }: { employeeId: string }) {
  const router = useRouter()
  const supabase = createClient()

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟ سيتم حذف جميع رواتبه اليومية أيضاً.')) return
    const { error } = await supabase.from('employees').delete().eq('id', employeeId)
    if (error) { toast.error('فشل في الحذف'); return }
    toast.success('تم حذف الموظف')
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border-2 border-transparent hover:border-rose-100"
    >
      <Trash2 size={18} />
    </button>
  )
}
