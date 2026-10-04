import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import DailyShiftClient from './DailyShiftClient'
import { isBaghdadToday } from '@/lib/utils'
import type { Profile } from '@/lib/types'

export const metadata: Metadata = {
  title: 'شغل اليوم · سجل العمل اليومي وتوزيع الفنيين',
  description: 'متابعة شفت اليوم المباشر وتوزيع العمل على الفنيين وإجمالي الدخل في ورشة منتصر',
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

  // Fetch recent visits and quick inspections
  const [
    { data: rawVisits, error: visitsErr },
    { data: rawInspections, error: inspErr }
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
      .limit(400)
  ])

  if (visitsErr) {
    console.error('Daily Shift Visits Fetch Error:', visitsErr)
  }
  if (inspErr) {
    console.error('Daily Shift Inspections Fetch Error:', inspErr)
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

  return (
    <DailyShiftClient
      role={profile?.role ?? 'technician'}
      initialVisits={todayVisits}
      initialInspections={todayInspections}
    />
  )
}
