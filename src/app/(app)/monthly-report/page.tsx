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

  // Fetch all data — client filters by selected month in Baghdad timezone
  const [visitsRes, inspectionsRes, salesRes, expensesRes, wagesRes] = await Promise.all([
    supabase
      .from('visits')
      .select('id, total_amount, labor_cost, technician_name, delivered_at, status, vehicles(make_and_model)')
      .eq('status', 'Delivered')
      .not('delivered_at', 'is', null)
      .order('delivered_at', { ascending: false }),

    supabase
      .from('quick_inspections')
      .select('id, inspection_fee, cost, technician_name, created_at, subject, car_info')
      .order('created_at', { ascending: false }),

    supabase
      .from('direct_sales')
      .select('id, selling_price, technician_name, created_at, item_name, item_type, ecu_id')
      .order('created_at', { ascending: false }),

    // Operational expenses from expenses table (includes 'سلفة / أجور' entries)
    supabase
      .from('expenses')
      .select('id, amount, category, description, created_at')
      .order('created_at', { ascending: false }),

    // Daily wages from daily_wages table (the primary source for worker pay)
    supabase
      .from('daily_wages')
      .select(`
        id, amount, date, employee_id,
        employees ( name )
      `)
      .order('date', { ascending: false }),
  ])

  // Normalize wages into a unified shape for the client
  const normalizedWages = (wagesRes.data ?? []).map((w: any) => ({
    id: w.id,
    amount: Math.round(Number(w.amount) || 0),
    // Use `date` field (YYYY-MM-DD) as the timestamp for Baghdad-tz month filtering
    created_at: w.date,
    category: 'أجور ورواتب',
    description: `أجر يومي - ${w.employees?.name || 'فني / موظف'}`,
    recipientName: w.employees?.name ?? null,
    isWage: true,
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
