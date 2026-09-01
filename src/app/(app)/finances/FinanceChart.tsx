'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { Transaction } from '@/lib/types'

interface Props {
  transactions: Transaction[]
}

export default function FinanceChart({ transactions }: Props) {
  const chartData = useMemo(() => {
    // Group by date
    const map: Record<string, { date: string; income: number; expense: number }> = {}
    transactions.forEach(tx => {
      const date = tx.date.split('T')[0]
      if (!map[date]) map[date] = { date, income: 0, expense: 0 }
      if (tx.type === 'Income') map[date].income += tx.amount
      else map[date].expense += tx.amount
    })
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
  }, [transactions])

  if (!chartData.length) return null

  return (
    <div className="glass-card p-6 space-y-4">
      <h2 className="font-semibold text-slate-200">مخطط الإيرادات والمصروفات (آخر 30 يوم)</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '12px',
                color: '#f1f5f9',
                fontFamily: 'var(--font-cairo)',
              }}
              formatter={((value: any) => [
                typeof value === 'number' ? value.toLocaleString('ar-IQ') + ' د.ع' : String(value ?? ''),
                ''
              ]) as any}
            />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            <Bar
              dataKey="income"
              name="إيرادات"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="expense"
              name="مصروفات"
              fill="#f43f5e"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
