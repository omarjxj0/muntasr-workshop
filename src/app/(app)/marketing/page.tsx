import { createClient } from '@/lib/supabase/server'
import MarketingClient from './MarketingClient'

export default async function MarketingPage() {
  const supabase = await createClient()

  // Fetch customers along with their vehicles
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, created_at, vehicles(id, make_and_model, license_plate)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <MarketingClient customers={(customers as any) ?? []} />
    </div>
  )
}
