'use client'

import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function InventoryActions({ ecuId }: { ecuId: string }) {
  const router = useRouter()
  const supabase = createClient()

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذا الصنف؟')) return
    const { error } = await supabase.from('ecus').delete().eq('id', ecuId)
    if (error) {
      // PostgreSQL FK violation → code 23503
      if ((error as any).code === '23503') {
        toast.error('لا يمكن حذف هذا الصنف لأنه مستخدم في زيارات أو طلبات سابقة', { duration: 5000 })
      } else {
        toast.error(`فشل في حذف الصنف: ${error.message}`)
      }
      return
    }
    toast.success('تم حذف الصنف')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Link
        href={`/inventory/${ecuId}/edit`}
        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-all"
      >
        <Pencil size={14} />
      </Link>
      <button
        onClick={handleDelete}
        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
