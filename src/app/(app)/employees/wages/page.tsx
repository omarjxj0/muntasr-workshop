import { createClient } from '@/lib/supabase/server'
import { CalendarDays } from 'lucide-react'
import WagesForm from './WagesForm'

export default async function WagesPage() {
  const supabase = await createClient()
  const { data: employees } = await supabase
    .from('employees').select('*').order('name')

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <CalendarDays size={28} className="text-violet-500" />
          رواتب نهاية اليوم
        </h1>
        <p className="text-slate-500 mt-2">
          حدد مبلغ أجر كل موظف لليوم ثم اضغط &quot;حفظ الكل&quot;
        </p>
      </div>

      <WagesForm employees={employees ?? []} />
    </div>
  )
}
