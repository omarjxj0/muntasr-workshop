import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ExpensesClient from './ExpensesClient'
import type { Profile } from '@/lib/types'

export default async function ExpensesPage() {
  const supabase = await createClient()

  // Protect route for admins only
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<Profile>()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  // Fetch initial expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <ExpensesClient initialExpenses={expenses || []} />
    </div>
  )
}
