import { createClient } from '@/lib/supabase/server'
import { Settings } from 'lucide-react'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()

  // ── Core settings (always exist) ─────────────────────────
  const { data: complaints } = await supabase
    .from('common_complaints')
    .select('id, name:text')
    .order('created_at')

  // ── Hierarchy tables (migration 016 — may not exist yet) ─
  // Fetch independently so a missing table never crashes the page.
  const [mfrRes, famRes, mcRes, swRes] = await Promise.all([
    supabase.from('ecu_manufacturers').select('id,name').order('name'),
    supabase.from('ecu_families').select('id,name,manufacturer_id').order('name'),
    supabase.from('ecu_model_codes').select('id,name,family_id').order('name'),
    supabase.from('ecu_software_ids').select('id,name,model_code_id').order('name'),
  ])

  const hierarchyReady = !mfrRes.error && !famRes.error && !mcRes.error && !swRes.error

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
        <Settings size={28} className="text-slate-500" />
        الإعدادات
      </h1>

      {/* Migration notice — shown only when hierarchy tables are missing */}
      {!hierarchyReady && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 space-y-1">
          <p className="font-bold">⚠️ جداول التصنيف الهرمي غير موجودة</p>
          <p>
            يرجى تشغيل ملف{' '}
            <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">
              supabase/migrations/016_ecu_hierarchy_tables.sql
            </code>{' '}
            في Supabase SQL Editor لتفعيل إدارة الصانعين والعائلات.
          </p>
        </div>
      )}

      <SettingsClient
        complaints={complaints   ?? []}
        manufacturers={mfrRes.data ?? []}
        families={famRes.data     ?? []}
        modelCodes={mcRes.data    ?? []}
        softwareIds={swRes.data   ?? []}
        hierarchyReady={hierarchyReady}
      />
    </div>
  )
}
