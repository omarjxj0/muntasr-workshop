'use client'

import { useRouter } from 'next/navigation'

interface FilterBarProps {
  companies: { id: string; name: string }[]
  categories: { id: string; name: string }[]
  currentCompany?: string
  currentCategory?: string
  currentQ?: string
}

export default function InventoryFilterBar({
  companies, categories, currentCompany, currentCategory, currentQ,
}: FilterBarProps) {
  const router = useRouter()

  const update = (key: string, value: string) => {
    const params = new URLSearchParams()
    if (currentQ && key !== 'q') params.set('q', currentQ)
    if (currentCompany && key !== 'company') params.set('company', currentCompany)
    if (currentCategory && key !== 'category') params.set('category', currentCategory)
    if (value) params.set(key, value)
    router.push(`/inventory?${params.toString()}`)
  }

  const inputClass = "px-4 py-2.5 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"

  return (
    <div className="flex flex-wrap gap-3">
      <form
        onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); update('q', fd.get('q') as string) }}
        className="flex-1 min-w-48"
      >
        <div className="relative">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            name="q"
            defaultValue={currentQ}
            placeholder="بحث بالاسم أو الرمز..."
            className={`w-full pr-9 pl-4 ${inputClass}`}
          />
        </div>
      </form>
      <select
        value={currentCompany ?? ''}
        onChange={e => update('company', e.target.value)}
        className={inputClass}
      >
        <option value="">كل الشركات</option>
        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select
        value={currentCategory ?? ''}
        onChange={e => update('category', e.target.value)}
        className={inputClass}
      >
        <option value="">كل الأنواع</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  )
}
