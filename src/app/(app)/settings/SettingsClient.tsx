'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

function ManageList({
  title,
  initialItems,
  tableName,
  columnName,
}: {
  title: string
  initialItems: { id: string; name: string }[]
  tableName: 'ecu_companies' | 'ecu_categories' | 'common_complaints'
  columnName?: string
}) {
  const [items, setItems] = useState(initialItems)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const loadData = async () => {
    const col = columnName ?? 'name'
    const orderBy = tableName === 'common_complaints' ? 'created_at' : 'name'
    const { data, error } = await supabase.from(tableName).select('*').order(orderBy, { ascending: true })
    if (error) {
      console.error(`Error loading ${tableName}:`, error)
    } else if (data) {
      const formatted = (data as any[]).map(item => ({
        id: item.id,
        name: (item[col] ?? item.name ?? item.text ?? '') as string,
      }))
      setItems(formatted)
    }
  }

  // Fetch on mount to ensure fresh data
  useEffect(() => {
    loadData()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setLoading(true)
    const col = columnName ?? 'name'
    const { error } = await supabase.from(tableName).insert({ [col]: newName.trim() } as any)
    if (error) { toast.error('فشل في الإضافة'); setLoading(false); return }
    toast.success('تم الإضافة')
    setNewName('')
    loadData() // Refetch data instead of router.refresh()
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر؟')) return
    const { error } = await supabase.from(tableName).delete().eq('id', id)
    if (error) { toast.error('فشل في الحذف'); return }
    toast.success('تم الحذف')
    loadData() // Refetch data instead of router.refresh()
  }

  return (
    <div className="soft-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-700">{title}</h2>
      </div>
      <div className="divide-y divide-slate-50">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between px-5 py-3 group">
            <span className="text-slate-700 text-sm">{item.name}</span>
            <button
              onClick={() => handleDelete(item.id)}
              className="p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-rose-50"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!items.length && (
          <div className="px-5 py-4 text-slate-400 text-sm">لا توجد عناصر</div>
        )}
      </div>
      <form onSubmit={handleAdd} className="p-4 flex gap-2 border-t border-slate-100">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="أضف جديد..."
          className="flex-1 px-3 py-2 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
          }}
        >
          <Plus size={16} />
        </button>
      </form>
    </div>
  )
}

interface Props {
  companies: { id: string; name: string }[]
  categories: { id: string; name: string }[]
  complaints: { id: string; name: string }[]
}

export default function SettingsClient({ companies, categories, complaints }: Props) {
  return (
    <div className="space-y-6">
      <ManageList title="شركات ECU" initialItems={companies} tableName="ecu_companies" />
      <ManageList title="فئات ECU" initialItems={categories} tableName="ecu_categories" />
      <ManageList title="الشكاوى الشائعة" initialItems={complaints} tableName="common_complaints" columnName="text" />
    </div>
  )
}
