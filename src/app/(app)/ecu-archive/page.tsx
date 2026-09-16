import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EcuArchiveClient from './EcuArchiveClient'
import type { EcuFlashArchive } from '@/lib/types'

export const metadata = {
  title: 'بنك ملفات العقول | ورشة منتصر',
  description: 'أرشيف ملفات الفلاش والبيانات التقنية لوحدات التحكم ECU',
}

export default async function EcuArchivePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = (profile as any)?.role === 'admin'

  // Fetch all archive records
  const { data: archiveRecords, error } = await supabase
    .from('ecu_flash_archive')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('ECU Archive Fetch Error:', error)
  }

  // Fetch all ECU barcodes for "in stock" badge cross-reference
  const { data: ecuBarcodes } = await supabase
    .from('ecus')
    .select('barcode, stock_quantity')

  // Build a map: barcode → total stock
  const stockMap: Record<string, number> = {}
  ecuBarcodes?.forEach(e => {
    if (e.barcode) {
      stockMap[e.barcode] = (stockMap[e.barcode] ?? 0) + (e.stock_quantity ?? 0)
    }
  })

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <EcuArchiveClient
        initialRecords={(archiveRecords as EcuFlashArchive[]) ?? []}
        stockMap={stockMap}
        isAdmin={isAdmin}
      />
    </div>
  )
}
