import { createClient } from '@/lib/supabase/server'
import { Wallet, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { formatCurrency, formatDate, TRANSACTION_TYPE_LABELS } from '@/lib/utils'
import type { Transaction, TransactionType } from '@/lib/types'
import FinanceChart from './FinanceChart'
import AddTransactionForm from './AddTransactionForm'

const REF_TYPE_LABELS: Record<string, string> = {
  'Visit_Payment': 'دفعة زيارة',
  'Employee_Wage': 'أجر موظف',
  'Other':         'أخرى',
}

export default async function FinancesPage() {
  const supabase = await createClient()

  const { data: rawTransactions } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .limit(200)

  const transactions = (rawTransactions ?? []) as Transaction[]

  const totalIncome  = transactions.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0)
  const netBalance   = totalIncome - totalExpense

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
        <Wallet size={28} className="text-emerald-400" />
        الصندوق والمالية
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-6 border border-emerald-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center">
              <TrendingUp size={20} className="text-emerald-400" />
            </div>
            <p className="text-slate-400 text-sm">إجمالي الإيرادات</p>
          </div>
          <p className="text-3xl font-bold text-emerald-400">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="glass-card p-6 border border-rose-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-400/10 flex items-center justify-center">
              <TrendingDown size={20} className="text-rose-400" />
            </div>
            <p className="text-slate-400 text-sm">إجمالي المصروفات</p>
          </div>
          <p className="text-3xl font-bold text-rose-400">{formatCurrency(totalExpense)}</p>
        </div>
        <div className={`glass-card p-6 border ${netBalance >= 0 ? 'border-blue-500/20' : 'border-rose-500/20'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${netBalance >= 0 ? 'bg-blue-400/10' : 'bg-rose-400/10'}`}>
              <DollarSign size={20} className={netBalance >= 0 ? 'text-blue-400' : 'text-rose-400'} />
            </div>
            <p className="text-slate-400 text-sm">الرصيد الصافي</p>
          </div>
          <p className={`text-3xl font-bold ${netBalance >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
            {formatCurrency(netBalance)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <FinanceChart transactions={transactions} />

      {/* Add transaction */}
      <AddTransactionForm />

      {/* Transactions ledger */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-slate-200">سجل المعاملات</h2>
        </div>
        <div className="divide-y divide-slate-800/50">
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/20 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-8 rounded-full ${tx.type === 'Income' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <div>
                  <p className="font-medium text-slate-200 text-sm">
                    {tx.description || REF_TYPE_LABELS[tx.reference_type] || 'معاملة'}
                  </p>
                  <p className="text-xs text-slate-500">{formatDate(tx.date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  tx.type === 'Income'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {TRANSACTION_TYPE_LABELS[tx.type as TransactionType]}
                </span>
                <span className={`font-bold ${tx.type === 'Income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {tx.type === 'Income' ? '+' : '-'}{formatCurrency(tx.amount)}
                </span>
              </div>
            </div>
          ))}
          {!transactions.length && (
            <div className="py-12 text-center text-slate-500">لا توجد معاملات بعد</div>
          )}
        </div>
      </div>
    </div>
  )
}
