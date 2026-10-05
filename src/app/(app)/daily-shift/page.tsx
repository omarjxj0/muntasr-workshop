import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import DailyShiftClient, { type DailyExpenseItem } from './DailyShiftClient'
import { isBaghdadToday } from '@/lib/utils'
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
      .limit(400),
    supabase
      .from('quick_inspections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(400),
    supabase
      .from('direct_sales')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('daily_wages')
      .select(`
        id, amount, date, employee_id,
        employees ( name )
      `)
      .order('date', { ascending: false })
      .limit(100),
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

  // Filter strictly for today in Baghdad timezone (Asia/Baghdad)
  // - Delivered/Completed visits settled TODAY (using delivered_at || completed_at || entry_date)
  // - Active/Overnight visits entered TODAY
  const todayVisits = (rawVisits || []).filter(v => {
    const isDeliveredOrCompleted = v.status === 'Completed' || v.status === 'Delivered'
    const settlementDate = v.delivered_at || v.completed_at || v.entry_date

    if (isDeliveredOrCompleted && isBaghdadToday(settlementDate)) {
      return true
    }

    const isActive = v.status === 'Pending' || v.status === 'In Progress'
    if (isActive && isBaghdadToday(v.entry_date)) {
      return true
    }

    return false
  }) as any[]

  const todayInspections = (rawInspections || []).filter(qi => isBaghdadToday(qi.created_at)) as any[]
  const todaySales = (rawSales || []).filter(s => isBaghdadToday(s.created_at)) as DirectSale[]

  // Operational expenses registered today in Baghdad timezone
  const todayExpenses: DailyExpenseItem[] = (rawExpenses || [])
    .filter(e => isBaghdadToday(e.created_at))
    .map(e => ({
      id: e.id,
      amount: Math.round(Number(e.amount) || 0),
      description: e.description || 'مصروف تشغيلي',
      category: e.category || 'أخرى',
      created_at: e.created_at,
      isWage: false,
    }))

  // Daily wages registered today in Baghdad timezone
  const todayWages: DailyExpenseItem[] = (rawWages || [])
    .filter(w => isBaghdadToday(w.date))
    .map(w => ({
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
      initialVisits={todayVisits}
      initialInspections={todayInspections}
      initialSales={todaySales}
      initialExpenses={todayExpenses}
      initialWages={todayWages}
    />
  )
}
