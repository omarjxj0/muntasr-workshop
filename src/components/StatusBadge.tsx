import { cn, VISIT_STATUS_LABELS, VISIT_STATUS_COLORS } from '@/lib/utils'
import type { VisitStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: VisitStatus
  className?: string
}

// Light-background-friendly status colors
const LIGHT_STATUS_COLORS: Record<VisitStatus, string> = {
  'Pending':     'bg-slate-100 text-slate-700 border border-slate-200',
  'In Progress': 'bg-violet-50 text-violet-700 border border-violet-200',
  'Completed':   'bg-amber-50 text-amber-800 border-2 border-amber-300 shadow-xs font-bold',
  'Delivered':   'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
        LIGHT_STATUS_COLORS[status],
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          status === 'Pending'     && 'bg-slate-400',
          status === 'In Progress' && 'bg-violet-500 pulse-soft',
          status === 'Completed'   && 'bg-amber-500 animate-pulse',
          status === 'Delivered'   && 'bg-emerald-500',
        )}
      />
      {VISIT_STATUS_LABELS[status]}
    </span>
  )
}
