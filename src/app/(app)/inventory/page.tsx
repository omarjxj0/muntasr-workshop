import { createClient } from '@/lib/supabase/server'
import InventoryClient from './InventoryClient'

export default async function InventoryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isAdmin = (profile as any)?.role === 'admin'

  // Attempt to fetch with relations
  let { data: ecus, error: ecusError } = await supabase
    .from('ecus')
    .select('*, ecu_companies(name), ecu_categories(name)')
    .order('name')

  if (ecusError) {
    console.warn("Inventory Fetch Error (with joins), falling back:", ecusError)
    // Fallback: fetch without relations if the join fails due to schema/RLS issues
    const fallback = await supabase.from('ecus').select('*').order('name')
    if (fallback.error) {
      console.warn("Inventory Fallback Fetch Error:", fallback.error)
    }
    ecus = fallback.data
  }

  // Fetch companies and categories for filters and manual joining if needed
  const [
    { data: companies },
    { data: categories },
  ] = await Promise.all([
    supabase.from('ecu_companies').select('id, name').order('name'),
    supabase.from('ecu_categories').select('id, name').order('name'),
  ])

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <InventoryClient
        initialEcus={ecus ?? []}
        companies={companies ?? []}
        categories={categories ?? []}
        isAdmin={isAdmin}
      />
    </div>
  )
}
