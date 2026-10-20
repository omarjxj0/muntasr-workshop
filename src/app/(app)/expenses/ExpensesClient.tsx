'use client'

import { useState, useMemo } from 'react'
import { TrendingUp, Plus, Trash2, Calendar, FileText, Pencil, AlertTriangle, X } from 'lucide-react'
import {
  formatCurrency,
  parseAmount,
  parseArabicNumerals,
  toBaghdadDateString,
  getBaghdadYesterdayKey,
  getBaghdadTodayKey,
  baghdadInputToISOString,
  getBaghdadDateKey,
  formatFullBaghdadDate,
} from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface Expense {
  id: string
  amount: number
  description: string
  category: string
  created_at: string
}

const CATEGORIES = [
  'ضيافة ونثريات',
  'أدوات ومواد',
  'صيانة وتشغيل',
  'سلفة / أجور',
  'أخرى'
]

export default function ExpensesClient({ initialExpenses }: { initialExpenses: Expense[] }) {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    (initialExpenses || []).map(e => ({
      ...e,
      amount: Math.round(Number(e.amount) || 0),
    }))
  )
  const [filter, setFilter] = useState<'all' | 'today' | 'month'>('month')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [date, setDate] = useState(() => toBaghdadDateString())
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('ضيافة ونثريات')

  // Edit Expense Modal State
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editCategory, setEditCategory] = useState('ضيافة ونثريات')
  const [editDescription, setEditDescription] = useState('')
  const [editDate, setEditDate] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Delete Confirmation Modal State
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedAmount = parseAmount(amount)
    if (parsedAmount <= 0 || !description.trim()) {
      toast.error('يرجى إدخال مبلغ صحيح ووصف للمصروف')
      return
    }

    setIsSubmitting(true)
    const isToday = date === getBaghdadTodayKey()
    const createdAtIso = isToday ? new Date().toISOString() : baghdadInputToISOString(date)

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        amount: parsedAmount,
        description: description.trim(),
        category,
        created_at: createdAtIso,
      })
      .select()
      .single()

    setIsSubmitting(false)

    if (error) {
      console.error(error)
      toast.error('حدث خطأ أثناء إضافة المصروف')
    } else if (data) {
      setExpenses([{ ...(data as Expense), amount: Math.round(Number((data as any).amount) || 0) }, ...expenses])
      setAmount('')
      setDescription('')
      setCategory('ضيافة ونثريات')
      toast.success('تمت إضافة المصروف بنجاح ✅')
    }
  }

  // Open Edit Modal
  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp)
    setEditAmount(String(exp.amount))
    setEditCategory(exp.category || 'أخرى')
    setEditDescription(exp.description)
    const { dayKey } = getBaghdadDateKey(exp.created_at)
    setEditDate(dayKey)
  }

  // Save Edit to Supabase & Update Local State Immediately
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingExpense) return
    const parsedAmount = parseAmount(editAmount)
    if (parsedAmount <= 0 || !editDescription.trim()) {
      toast.error('يرجى إدخال مبلغ صحيح ووصف للمصروف')
      return
    }

    setIsSavingEdit(true)
    try {
      const isToday = editDate === getBaghdadTodayKey()
      const createdAtIso = isToday ? new Date().toISOString() : baghdadInputToISOString(editDate)

      const { error } = await supabase
        .from('expenses')
        .update({
          amount: parsedAmount,
          category: editCategory,
          description: editDescription.trim(),
          created_at: createdAtIso,
        })
        .eq('id', editingExpense.id)

      if (error) {
        console.error(error)
        toast.error('حدث خطأ أثناء تعديل المصروف')
      } else {
        setExpenses(prev =>
          prev.map(item =>
            item.id === editingExpense.id
              ? {
                  ...item,
                  amount: parsedAmount,
                  category: editCategory,
                  description: editDescription.trim(),
                  created_at: createdAtIso,
                }
              : item
          )
        )
        toast.success('تم تعديل المصروف بنجاح وتحديث الحسابات ✅')
        setEditingExpense(null)
      }
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ غير متوقع أثناء تعديل المصروف')
    } finally {
      setIsSavingEdit(false)
    }
  }

  // Execute Delete from Supabase & Update Local State Immediately
  const handleConfirmDelete = async () => {
    if (!deletingExpense) return
    setIsDeleting(true)
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', deletingExpense.id)
      if (error) {
        console.error(error)
        toast.error('حدث خطأ أثناء حذف المصروف')
      } else {
        setExpenses(prev => prev.filter(e => e.id !== deletingExpense.id))
        toast.success('تم حذف المصروف بنجاح وتحديث صافي الحسابات ✅')
        setDeletingExpense(null)
      }
    } catch (err) {
      console.error(err)
      toast.error('تعذر حذف المصروف')
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredExpenses = useMemo(() => {
    const today = getBaghdadTodayKey()
    const thisMonth = today.slice(0, 7)

    return expenses.filter(expense => {
      const { dayKey, monthKey } = getBaghdadDateKey(expense.created_at)
      if (filter === 'today') return dayKey === today
      if (filter === 'month') return monthKey === thisMonth
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
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar size={15} className="text-violet-500" />
                  <span>تاريخ الصرفية</span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDate(getBaghdadTodayKey())}
                    className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors cursor-pointer"
                  >
                    اليوم
                  </button>
                  <button
                    type="button"
                    onClick={() => setDate(getBaghdadYesterdayKey())}
                    className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    أمس
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className={`w-full font-mono ${inputClass}`}
                dir="ltr"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">المبلغ (د.ع)</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className={`w-full font-mono text-lg ${inputClass}`}
                placeholder="0"
                dir="ltr"
                required
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[5000, 10000, 25000, 50000].map(inc => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => setAmount(prev => String((Number(prev) || 0) + inc))}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                  >
                    +{inc.toLocaleString('en-US')}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAmount('')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  تصفير
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">أدخل المبلغ كاملاً بالدينار العراقي (IQD)</p>
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
                    <th className="px-4 py-4 text-center font-semibold w-40">الإجراءات</th>
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
                        <td className="px-4 py-4 text-slate-400 text-xs font-mono">
                          {new Date(expense.created_at).toLocaleDateString('ar')}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenEdit(expense)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200 cursor-pointer shadow-xs"
                              title="تعديل المصروف"
                            >
                              <Pencil size={12} />
                              <span>تعديل ✏️</span>
                            </button>
                            <button
                              onClick={() => setDeletingExpense(expense)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200 cursor-pointer shadow-xs"
                              title="حذف المصروف"
                            >
                              <Trash2 size={12} />
                              <span>حذف 🗑️</span>
                            </button>
                          </div>
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

      {/* ── Confirmation Dialog for Deleting Expense ── */}
      {deletingExpense && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-lg font-bold text-slate-800">حذف هذا المصروف؟</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  هل أنت متأكد من حذف هذا المصروف؟ سيتم تعديل صافي أرباح اليوم فوراً وتحديث الحسابات.
                </p>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">المبلغ:</span>
                <span className="font-mono font-bold text-sm text-rose-600">- {formatCurrency(deletingExpense.amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">التصنيف:</span>
                <span className="font-semibold text-slate-700">{deletingExpense.category}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">البيان:</span>
                <span className="font-semibold text-slate-700 truncate max-w-[200px]">{deletingExpense.description}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">التاريخ:</span>
                <span className="font-mono text-slate-600">{new Date(deletingExpense.created_at).toLocaleDateString('ar')}</span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingExpense(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                إلغاء الأمر
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold rounded-xl text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={16} />
                <span>{isDeleting ? 'جاري الحذف...' : 'نعم، حذف المصروف 🗑️'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Expense Modal ── */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                  <Pencil size={18} />
                </div>
                <span>تعديل بيانات المصروف ✏️</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <Calendar size={15} className="text-violet-500" />
                    <span>تاريخ الصرفية</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditDate(getBaghdadTodayKey())}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors cursor-pointer"
                    >
                      اليوم
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditDate(getBaghdadYesterdayKey())}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      أمس
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className={`w-full font-mono ${inputClass}`}
                  dir="ltr"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">تعديل التاريخ ينقل المصروف إلى شفت ذلك اليوم فوراً</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">المبلغ (د.ع)</label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className={`w-full font-mono text-lg ${inputClass}`}
                  placeholder="0"
                  dir="ltr"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[5000, 10000, 25000, 50000].map(inc => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => setEditAmount(prev => String((Number(prev) || 0) + inc))}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                    >
                      +{inc.toLocaleString('en-US')}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditAmount('')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    تصفير
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">التصنيف</label>
                <select
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  className={`w-full ${inputClass}`}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">الوصف والبيان</label>
                <textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  className={`w-full resize-none h-24 ${inputClass}`}
                  placeholder="بيان المصروف..."
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-2.5 text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="btn-gradient px-6 py-2.5 text-sm shadow-lg shadow-violet-200 cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات 💾'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
