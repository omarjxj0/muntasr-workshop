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
    if (error) { toast.error('فشل في حذف الصنف'); return }
    toast.success('تم حذف الصنف')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Link href={`/inventory/${ecuId}/edit`}
        className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all">
        <Pencil size={14} />
      </Link>
      <button onClick={handleDelete}
        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
