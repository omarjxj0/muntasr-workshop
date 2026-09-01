import { createClient } from '@/lib/supabase/server'
import { Users } from 'lucide-react'
import AddEmployeeForm from './AddEmployeeForm'
import DeleteEmployeeButton from './DeleteEmployeeButton'
import { Phone, Briefcase } from 'lucide-react'

export default async function EmployeesPage() {
  const supabase = await createClient()
  const { data: employees } = await supabase
    .from('employees').select('*').order('name')

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Users size={28} className="text-amber-500" />
          الموظفون
        </h1>
      </div>

      <div className="grid gap-4">
        {employees?.map(emp => (
          <div key={emp.id} className="soft-card p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border-2 border-amber-100 flex items-center justify-center">
                <span className="text-amber-600 font-bold text-lg">{emp.name[0]}</span>
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-lg">{emp.name}</p>
                <div className="flex items-center gap-4 mt-1">
                  {emp.phone && (
                    <p className="text-slate-500 text-sm flex items-center gap-1">
                      <Phone size={12} />
                      <span className="font-mono">{emp.phone}</span>
                    </p>
                  )}
                  {emp.specialization && (
                    <p className="text-slate-500 text-sm flex items-center gap-1">
                      <Briefcase size={12} />
                      {emp.specialization}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <DeleteEmployeeButton employeeId={emp.id} />
          </div>
        ))}
        {!employees?.length && (
          <div className="soft-card p-12 text-center text-slate-400">
            لا يوجد موظفون مسجلون
          </div>
        )}
      </div>

      <AddEmployeeForm />
    </div>
  )
}
