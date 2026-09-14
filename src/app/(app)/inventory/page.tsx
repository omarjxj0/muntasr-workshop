import { createClient } from '@/lib/supabase/server'
import InventoryClient from './InventoryClient'

export default async function InventoryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isAdmin = (profile as any)?.role === 'admin'

  const { data: ecus, error: ecusError } = await supabase
    .from('ecus')
    .select('*')
    .order('name')

  if (ecusError) {
    console.warn("Inventory Fetch Error:", ecusError)
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <InventoryClient
        initialEcus={ecus ?? []}
        isAdmin={isAdmin}
      />
    </div>
  )
}
