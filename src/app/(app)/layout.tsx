import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import type { Profile } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  const role = profile?.role ?? 'technician'

  return (
    <div className="flex min-h-screen bg-[#f0f2f7]">
      <Sidebar role={role} logoUrl="/logo.png" />
      {/* md:pr-[280px] gives the content breathing room from the fixed right sidebar (width 240px + margin) */}
      <main className="flex-1 overflow-auto md:pr-[280px] w-full pt-20 md:pt-0">
        {children}
      </main>
    </div>
  )
}
