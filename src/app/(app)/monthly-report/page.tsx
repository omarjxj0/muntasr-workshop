import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MonthlyReportClient from './MonthlyReportClient'
import type { Profile } from '@/lib/types'

export const metadata = {
  title: 'التقرير الشهري | ورشة منتصر',
  description: 'التقرير المالي والتشغيلي الشهري الشامل',
}

export default async function MonthlyReportPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<Profile>()

  if (profile?.role !== 'admin') redirect('/')

  // Fetch all data for client-side Baghdad timezone month filtering
  const [visitsRes, inspectionsRes, salesRes, expensesRes, wagesRes] = await Promise.all([
    supabase
      .from('visits')
      .select('id, total_amount, labor_cost, technician_name, delivered_at, status, vehicles(make_and_model)')
      .eq('status', 'Delivered')
      .not('delivered_at', 'is', null)
      .order('delivered_at', { ascending: false })
      .limit(5000),

    supabase
      .from('quick_inspections')
      .select('id, inspection_fee, cost, technician_name, created_at, subject, car_info')
      .order('created_at', { ascending: false })
      .limit(5000),

    supabase
      .from('direct_sales')
      .select('id, selling_price, technician_name, created_at, item_name, item_type, ecu_id')
      .order('created_at', { ascending: false })
      .limit(5000),

    // All expenses with full columns (description, category, amount, created_at, and any notes/worker fields)
    supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000),

    // Daily wages from daily_wages table with employee details
    supabase
      .from('daily_wages')
      .select(`
        id, amount, date, employee_id,
        employees ( id, name, specialization, phone )
      `)
      .order('date', { ascending: false })
      .limit(5000),
  ])

  // Normalize wages into a unified structure
  const normalizedWages = (wagesRes.data ?? []).map((w: any) => ({
    id: w.id,
    amount: Math.round(Number(w.amount) || 0),
    // `date` field (YYYY-MM-DD) for Baghdad-tz month matching
    created_at: w.date,
    category: 'أجور ورواتب',
    description: `أجر يومي - ${w.employees?.name || 'فني / موظف'}`,
    recipientName: w.employees?.name ?? null,
    isWage: true as const,
  }))

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <MonthlyReportClient
        visits={(visitsRes.data as any[]) ?? []}
        inspections={(inspectionsRes.data as any[]) ?? []}
        sales={(salesRes.data as any[]) ?? []}
        expenses={(expensesRes.data as any[]) ?? []}
        wages={normalizedWages}
      />
    </div>
  )
}
