import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import SalesClient from './SalesClient'
import type { Profile, DirectSale } from '@/lib/types'

export const metadata: Metadata = {
  title: 'مبيعات الورشة والعقول · نقطة البيع المباشر',
  description: 'سجل مبيعات العقول والفيش والملفات المباشرة وسحب الباركود في ورشة منتصر',
}

export default async function SalesPage() {
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

  // Fetch sales records ordered by latest
  const { data: rawSales, error: salesErr } = await supabase
    .from('direct_sales')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300)

  if (salesErr) {
    console.error('Direct Sales fetch error:', salesErr)
  }

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto">
      <SalesClient
        role={profile?.role ?? 'technician'}
        initialSales={(rawSales as DirectSale[]) ?? []}
      />
    </div>
  )
}
