'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, CalendarDays } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
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
      // Insert daily wage
      const { data: wage, error: wageError } = await supabase
        .from('daily_wages')
        .insert({ employee_id: emp.id, date, amount })
        .select()
        .single()

      if (wageError) { hasError = true; continue }

      // Create expense transaction
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
      // Reset wages to 0
      setWages(Object.fromEntries(employees.map(e => [e.id, 0])))
    }
  }

  return (
    <div className="space-y-6">
      {/* Date picker */}
      <div className="glass-card p-5 flex items-center gap-4">
        <CalendarDays size={20} className="text-blue-400 shrink-0" />
        <div>
          <label className="text-sm text-slate-400 block mb-1">تاريخ اليوم</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 input-glow text-sm"
            dir="ltr"
          />
        </div>
      </div>

      {/* Employee wage rows */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-sm">
              <th className="text-right px-6 py-4 font-medium">الموظف</th>
              <th className="text-right px-4 py-4 font-medium">التخصص</th>
              <th className="text-left px-6 py-4 font-medium">المبلغ (دينار عراقي)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                      <span className="text-amber-400 font-bold text-sm">{emp.name[0]}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200">{emp.name}</p>
                      {emp.phone && <p className="text-xs text-slate-500 font-mono">{emp.phone}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-slate-400 text-sm">{emp.specialization ?? '—'}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={wages[emp.id] || ''}
                      onChange={e => setWages(p => ({ ...p, [emp.id]: Number(e.target.value) }))}
                      placeholder="0"
                      className="w-40 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 input-glow text-sm font-mono text-left"
                      dir="ltr"
                    />
                    {(wages[emp.id] || 0) > 0 && (
                      <span className="text-emerald-400 text-sm font-semibold">
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

      {/* Total + Save button */}
      <div className="glass-card p-5 flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm">إجمالي الرواتب لهذا اليوم</p>
          <p className="text-2xl font-bold text-rose-400">{formatCurrency(totalWages)}</p>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={loading || totalWages === 0}
          className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/30"
        >
          <Save size={18} />
          {loading ? 'جارٍ الحفظ...' : 'حفظ الكل'}
        </button>
      </div>
    </div>
  )
}
