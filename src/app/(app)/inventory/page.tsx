import { createClient } from '@/lib/supabase/server'
import InventoryClient from './InventoryClient'

export default async function InventoryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isAdmin = (profile as any)?.role === 'admin'

  const [
    ecusRes,
    mfrRes,
    famRes,
    mcRes,
    swRes,
  ] = await Promise.all([
    supabase.from('ecus').select('*').order('name'),
    supabase.from('ecu_manufacturers').select('id,name').order('name'),
    supabase.from('ecu_families').select('id,name,manufacturer_id').order('name'),
    supabase.from('ecu_model_codes').select('id,name,family_id').order('name'),
    supabase.from('ecu_software_ids').select('id,name,model_code_id').order('name'),
  ])

  if (ecusRes.error) {
    console.warn("Inventory Fetch Error:", ecusRes.error)
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <InventoryClient
        initialEcus={ecusRes.data ?? []}
        manufacturers={mfrRes.data ?? []}
        families={famRes.data ?? []}
        modelCodes={mcRes.data ?? []}
        softwareIds={swRes.data ?? []}
        isAdmin={isAdmin}
      />
    </div>
  )
}
