import { createClient } from '@/lib/supabase/server'
import { Settings } from 'lucide-react'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const [
    { data: companies },
    { data: categories },
    { data: complaints },
    { data: manufacturers },
    { data: families },
    { data: modelCodes },
    { data: softwareIds },
  ] = await Promise.all([
    supabase.from('ecu_companies').select('*').order('name'),
    supabase.from('ecu_categories').select('*').order('name'),
    supabase.from('common_complaints').select('id, name:text').order('created_at'),
    supabase.from('ecu_manufacturers').select('id,name').order('name'),
    supabase.from('ecu_families').select('id,name,manufacturer_id').order('name'),
    supabase.from('ecu_model_codes').select('id,name,family_id').order('name'),
    supabase.from('ecu_software_ids').select('id,name,model_code_id').order('name'),
  ])

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
        <Settings size={28} className="text-slate-500" />
        الإعدادات
      </h1>
      <SettingsClient
        companies={companies     ?? []}
        categories={categories   ?? []}
        complaints={complaints   ?? []}
        manufacturers={manufacturers ?? []}
        families={families       ?? []}
        modelCodes={modelCodes   ?? []}
        softwareIds={softwareIds ?? []}
      />
    </div>
  )
}
