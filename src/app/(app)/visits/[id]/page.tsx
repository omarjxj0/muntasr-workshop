import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'
import VisitDetailClient from './VisitDetailClient'

interface Props { params: Promise<{ id: string }> }

export default async function VisitDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: visit } = await supabase.from('visits').select('id').eq('id', id).single()
  if (!visit) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single<Profile>()

  return <VisitDetailClient visitId={id} role={profile?.role ?? 'technician'} />
}
