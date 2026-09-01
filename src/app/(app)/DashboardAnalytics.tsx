'use client'

import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface DashboardAnalyticsProps {
  income: number
  wages: number
  expenses: number
  topVehicleMakes: { name: string; count: number }[]
}

const COLORS = ['#10b981', '#f43f5e', '#f59e0b'] // Emerald (Income), Rose (Expenses), Amber (Wages)

export default function DashboardAnalytics({ income, wages, expenses, topVehicleMakes }: DashboardAnalyticsProps) {
  
  const financialData = useMemo(() => {
    // Only show expenses in the pie if we want a breakdown of OUTFLOWS, 
    // or we can show a pie of Income vs Total Expenses (Wages + Expenses)
    // Actually, a pie showing the ratio of Profit vs Outflows is great.
    const totalOutflows = wages + expenses
    const profit = Math.max(0, income - totalOutflows)
    
    return [
      { name: 'صافي الربح', value: profit, color: '#10b981' }, // Emerald
      { name: 'رواتب وأجور', value: wages, color: '#f59e0b' }, // Amber
      { name: 'مصروفات أخرى', value: expenses, color: '#f43f5e' }, // Rose
    ].filter(d => d.value > 0)
  }, [income, wages, expenses])

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      
      {/* Income vs Expenses Pie Chart */}
      <div className="soft-card p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-6">تحليل الإيرادات والمصروفات</h3>
        
        {financialData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400">
            لا توجد بيانات مالية كافية
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={financialData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {financialData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: any) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex justify-center gap-6 mt-4">
          {financialData.map(item => (
            <div key={item.name} className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </div>
          ))}
        </div>
      </div>

      {/* Top Vehicle Makes Bar Chart */}
      <div className="soft-card p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-6">أكثر أنواع السيارات صيانةً</h3>
        
        {topVehicleMakes.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400">
            لا توجد بيانات للسيارات
          </div>
        ) : (
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topVehicleMakes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <RechartsTooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', direction: 'rtl' }}
                />
                <Bar 
                  dataKey="count" 
                  name="عدد الزيارات" 
                  fill="#7c3aed" 
                  radius={[6, 6, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

    </div>
  )
}
