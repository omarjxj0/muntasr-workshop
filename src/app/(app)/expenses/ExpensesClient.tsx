'use client'

import { useState, useMemo } from 'react'
import { TrendingUp, Plus, Trash2, Calendar, FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface Expense {
  id: string
  amount: number
  description: string
  category: string
  created_at: string
}

const CATEGORIES = ['أدوات', 'ضيافة', 'صيانة', 'أخرى']

export default function ExpensesClient({ initialExpenses }: { initialExpenses: Expense[] }) {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [filter, setFilter] = useState<'all' | 'today' | 'month'>('month')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('أخرى')

  // Smart Thousands Shortcut
  const handleAmountBlur = () => {
    const val = Number(amount)
    if (val > 0 && val < 10000) {
      setAmount((val * 1000).toString())
    }
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0 || !description.trim()) {
      toast.error('يرجى إدخال مبلغ صحيح ووصف للمصروف')
      return
    }

    setIsSubmitting(true)
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        amount: Number(amount),
        description: description.trim(),
        category,
      })
      .select()
      .single()

    setIsSubmitting(false)

    if (error) {
      console.error(error)
      toast.error('حدث خطأ أثناء إضافة المصروف')
    } else if (data) {
      setExpenses([data, ...expenses])
      setAmount('')
      setDescription('')
      setCategory('أخرى')
      toast.success('تمت إضافة المصروف بنجاح')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return
    
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) {
      toast.error('حدث خطأ أثناء الحذف')
    } else {
      setExpenses(expenses.filter(e => e.id !== id))
      toast.success('تم الحذف بنجاح')
    }
  }

  const filteredExpenses = useMemo(() => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const thisMonth = now.toISOString().slice(0, 7)

    return expenses.filter(expense => {
      const dateStr = expense.created_at.split('T')[0]
      if (filter === 'today') return dateStr === today
      if (filter === 'month') return dateStr.startsWith(thisMonth)
      return true
    })
  }, [expenses, filter])

  const totalAmount = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0)

  const inputClass = "px-4 py-3 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:border-violet-500 focus:shadow-[0_0_0_4px_rgba(124,58,237,0.1)]"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center">
              <TrendingUp size={28} className="text-rose-500 rotate-180" />
            </div>
            المصروفات التشغيلية
          </h1>
          <p className="text-slate-500 mt-2">إدارة المصروفات اليومية والشهرية للورشة</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Quick Add Form */}
        <div className="soft-card p-6 md:col-span-1 h-fit">
          <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
            <Plus size={20} className="text-violet-500" />
            إضافة مصروف جديد
          </h2>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">المبلغ (د.ع)</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onBlur={handleAmountBlur}
                className={`w-full font-mono text-lg ${inputClass}`}
                placeholder="0"
                dir="ltr"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">اختصار: أدخل 25 وسيتم تحويلها إلى 25,000</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">التصنيف</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className={`w-full ${inputClass}`}
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">الوصف</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className={`w-full resize-none h-24 ${inputClass}`}
                placeholder="مثال: شراء شاي وقهوة للورشة..."
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-gradient py-3.5 text-base shadow-lg shadow-violet-200 mt-2"
            >
              {isSubmitting ? 'جاري الإضافة...' : 'إضافة المصروف'}
            </button>
          </form>
        </div>

        {/* Expenses List */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
              <button
                onClick={() => setFilter('today')}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${filter === 'today' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                اليوم
              </button>
              <button
                onClick={() => setFilter('month')}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${filter === 'month' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                هذا الشهر
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${filter === 'all' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                الكل
              </button>
            </div>
            <div className="text-left">
              <span className="text-slate-500 text-sm ml-2">الإجمالي:</span>
              <span className="text-xl font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-xl">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          <div className="soft-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500">
                    <th className="px-5 py-4 text-right font-semibold">المبلغ</th>
                    <th className="px-4 py-4 text-right font-semibold">التصنيف</th>
                    <th className="px-4 py-4 text-right font-semibold">الوصف</th>
                    <th className="px-4 py-4 text-right font-semibold">التاريخ</th>
                    <th className="px-4 py-4 text-center font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <FileText size={48} className="mx-auto mb-3 opacity-20" />
                        لا توجد مصروفات في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map(expense => (
                      <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-5 py-4 font-bold text-rose-600">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-4 py-4">
                          <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-medium">
                            {expense.category}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {expense.description}
                        </td>
                        <td className="px-4 py-4 text-slate-400 text-xs">
                          {new Date(expense.created_at).toLocaleDateString('ar')}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => handleDelete(expense.id)}
                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            title="حذف"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
