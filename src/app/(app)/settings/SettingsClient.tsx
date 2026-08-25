'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

function ManageList({
  title,
  items,
  tableName,
}: {
  title: string
  items: { id: string; name: string }[]
  tableName: 'ecu_companies' | 'ecu_categories'
}) {
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setLoading(true)
    const { error } = await supabase.from(tableName).insert({ name: newName.trim() } as any)
    if (error) { toast.error('فشل في الإضافة'); setLoading(false); return }
    toast.success('تم الإضافة')
    setNewName('')
    router.refresh()
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد؟')) return
    const { error } = await supabase.from(tableName).delete().eq('id', id)
    if (error) { toast.error('فشل في الحذف'); return }
    toast.success('تم الحذف')
    router.refresh()
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <h2 className="font-semibold text-slate-200">{title}</h2>
      </div>
      <div className="divide-y divide-slate-800/50">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between px-5 py-3 group">
            <span className="text-slate-300">{item.name}</span>
            <button onClick={() => handleDelete(item.id)}
              className="p-1.5 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-rose-400/10">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!items.length && (
          <div className="px-5 py-4 text-slate-500 text-sm">لا توجد عناصر</div>
        )}
      </div>
      <form onSubmit={handleAdd} className="p-4 flex gap-2 border-t border-slate-800">
        <input value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="أضف جديد..."
          className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm input-glow" />
        <button type="submit" disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition-all disabled:opacity-60">
          <Plus size={16} />
        </button>
      </form>
    </div>
  )
}

interface Props {
  companies: { id: string; name: string }[]
  categories: { id: string; name: string }[]
}

export default function SettingsClient({ companies, categories }: Props) {
  return (
    <div className="space-y-6">
      <ManageList title="شركات ECU" items={companies} tableName="ecu_companies" />
      <ManageList title="فئات ECU" items={categories} tableName="ecu_categories" />
    </div>
  )
}
