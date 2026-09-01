'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, CalendarDays } from 'lucide-react'
import { formatCurrency, parseArabicNumerals, handleFinancialBlur } from '@/lib/utils'
import type { Employee } from '@/lib/types'
import toast from 'react-hot-toast'

interface Props {
  employees: Employee[]
}

export default function WagesForm({ employees }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [wages, setWages] = useState<Record<string, number>>(
    Object.fromEntries(employees.map(e => [e.id, 0]))
  )
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const totalWages = Object.values(wages).reduce((sum, v) => sum + (v || 0), 0)

  const handleSaveAll = async () => {
    const activeWages = employees.filter(e => (wages[e.id] || 0) > 0)
    if (!activeWages.length) { toast.error('لم يتم إدخال أي مبالغ'); return }

    setLoading(true)
    let hasError = false

    for (const emp of activeWages) {
      const amount = wages[emp.id]
      const { data: wage, error: wageError } = await supabase
        .from('daily_wages')
        .insert({ employee_id: emp.id, date, amount })
        .select()
        .single()

      if (wageError) { hasError = true; continue }

      await supabase.from('transactions').insert({
        type: 'Expense',
        amount,
        reference_type: 'Employee_Wage',
        reference_id: wage.id,
        description: `أجر يومي - ${emp.name} - ${date}`,
        date: new Date(date).toISOString(),
      })
    }

    setLoading(false)
    if (hasError) {
      toast.error('بعض العمليات فشلت، تحقق من البيانات')
    } else {
      toast.success(`تم حفظ رواتب ${activeWages.length} موظف بنجاح ✅`)
      setWages(Object.fromEntries(employees.map(e => [e.id, 0])))
    }
  }

  return (
    <div className="space-y-6">
      {/* Date picker */}
      <div className="soft-card p-5 flex items-center gap-4">
        <CalendarDays size={20} className="text-violet-500 shrink-0" />
        <div>
          <label className="text-sm text-slate-500 block mb-1 font-medium">تاريخ اليوم</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-4 py-2 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
            dir="ltr"
          />
        </div>
      </div>

      {/* Employee wage rows */}
      <div className="soft-card overflow-hidden">
        <div className="overflow-x-auto w-full pb-2">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 text-sm bg-slate-50/60">
                <th className="text-right px-6 py-4 font-semibold">الموظف</th>
                <th className="text-right px-4 py-4 font-semibold">التخصص</th>
                <th className="text-left px-6 py-4 font-semibold">المبلغ (دينار عراقي)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-violet-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-amber-50 border-2 border-amber-100 flex items-center justify-center">
                        <span className="text-amber-600 font-bold text-sm">{emp.name[0]}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">{emp.name}</p>
                        {emp.phone && <p className="text-xs text-slate-400 font-mono">{emp.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-500 text-sm">{emp.specialization ?? '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={wages[emp.id] || ''}
                        onChange={e => setWages(p => ({ ...p, [emp.id]: Number(parseArabicNumerals(e.target.value)) || 0 }))}
                        onBlur={e => setWages(p => ({ ...p, [emp.id]: handleFinancialBlur(e.target.value) || 0 }))}
                        placeholder="0"
                        className="w-40 px-4 py-2 rounded-2xl text-sm font-mono transition-all border-2 border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
                        lang="en"
                        dir="ltr"
                      />
                      {(wages[emp.id] || 0) > 0 && (
                        <span className="text-emerald-600 text-sm font-semibold">
                          {formatCurrency(wages[emp.id])}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Total + Save button */}
      <div className="soft-card p-5 flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-sm">إجمالي الرواتب لهذا اليوم</p>
          <p className="text-2xl font-bold text-rose-500">{formatCurrency(totalWages)}</p>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={loading || totalWages === 0}
          className="flex items-center gap-2 px-8 py-3 rounded-2xl font-bold transition-all disabled:opacity-50 text-white"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            boxShadow: totalWages > 0 ? '0 6px 20px rgba(124,58,237,0.35)' : 'none',
          }}
        >
          <Save size={18} />
          {loading ? 'جارٍ الحفظ...' : 'حفظ الكل'}
        </button>
      </div>
    </div>
  )
}
