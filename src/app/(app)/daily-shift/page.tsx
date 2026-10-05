import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import DailyShiftClient, { type DailyExpenseItem } from './DailyShiftClient'

import type { Profile, DirectSale } from '@/lib/types'

export const metadata: Metadata = {
  title: 'شغل اليوم · سجل العمل اليومي وتوزيع الفنيين',
  description: 'متابعة شفت اليوم المباشر وتوزيع العمل على الفنيين وإجمالي الدخل والصرفيات في ورشة منتصر',
}

export default async function DailyShiftPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<Profile>()

  // Fetch recent visits, quick inspections, direct sales, expenses, and daily wages
  const [
    { data: rawVisits, error: visitsErr },
    { data: rawInspections, error: inspErr },
    { data: rawSales, error: salesErr },
    { data: rawExpenses, error: expErr },
    { data: rawWages, error: wagesErr },
  ] = await Promise.all([
    supabase
      .from('visits')
      .select(`
        id, entry_date, status, complaint, labor_cost, total_amount, technician_name, delivered_at, completed_at,
        vehicles (
          make_and_model,
          license_plate,
          customers ( name, phone )
        )
      `)
      .order('entry_date', { ascending: false })
      .limit(600),
    supabase
      .from('quick_inspections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(600),
    supabase
      .from('direct_sales')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('daily_wages')
      .select(`
        id, amount, date, employee_id,
        employees ( name )
      `)
      .order('date', { ascending: false })
      .limit(200),
  ])

  if (visitsErr) {
    console.error('Daily Shift Visits Fetch Error:', visitsErr)
  }
  if (inspErr) {
    console.error('Daily Shift Inspections Fetch Error:', inspErr)
  }
  if (salesErr) {
    console.error('Daily Shift Sales Fetch Error:', salesErr)
  }
  if (expErr) {
    console.error('Daily Shift Expenses Fetch Error:', expErr)
  }
  if (wagesErr) {
    console.warn('Daily Shift Wages Fetch Warning (may require admin):', wagesErr)
  }

  // Pass raw data to client — client filters by selectedDate
  const allVisits = (rawVisits || []) as any[]
  const allInspections = (rawInspections || []) as any[]
  const allSales = (rawSales || []) as DirectSale[]

  const allExpenses: DailyExpenseItem[] = (rawExpenses || []).map(e => ({
    id: e.id,
    amount: Math.round(Number(e.amount) || 0),
    description: e.description || 'مصروف تشغيلي',
    category: e.category || 'أخرى',
    created_at: e.created_at,
    isWage: false,
  }))

  const allWages: DailyExpenseItem[] = (rawWages || []).map(w => ({
    id: w.id,
    amount: Math.round(Number(w.amount) || 0),
    description: `أجر يومي - ${(w.employees as any)?.name || 'فني / موظف'}`,
    category: 'أجور ورواتب',
    created_at: w.date,
    isWage: true,
    recipientName: (w.employees as any)?.name || null,
  }))

  return (
    <DailyShiftClient
      role={profile?.role ?? 'technician'}
      allVisits={allVisits}
      allInspections={allInspections}
      allSales={allSales}
      allExpenses={allExpenses}
      allWages={allWages}
    />
  )
}
