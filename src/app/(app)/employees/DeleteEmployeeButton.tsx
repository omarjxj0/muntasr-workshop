'use client'

import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function DeleteEmployeeButton({ employeeId }: { employeeId: string }) {
  const router = useRouter()
  const supabase = createClient()

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟')) return
    const { error } = await supabase.from('employees').delete().eq('id', employeeId)
    if (error) { toast.error('فشل في الحذف'); return }
    toast.success('تم حذف الموظف')
    router.refresh()
  }

  return (
    <button onClick={handleDelete}
      className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all">
      <Trash2 size={18} />
    </button>
  )
}
