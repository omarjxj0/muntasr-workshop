import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InspectionsClient from './InspectionsClient'
import type { QuickInspection } from '@/lib/types'

export const metadata = {
  title: 'الفحوصات السريعة | ورشة منتصر',
  description: 'سجل فحوصات السيارات والعقول ECU بشكل سريع',
}

export default async function InspectionsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = (profile as any)?.role === 'admin'

  const { data: records, error } = await supabase
    .from('quick_inspections')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('Quick Inspections Fetch Error:', error)
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <InspectionsClient
        initialRecords={(records as QuickInspection[]) ?? []}
        isAdmin={isAdmin}
      />
    </div>
  )
}
