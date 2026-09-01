import { cn, VISIT_STATUS_LABELS, VISIT_STATUS_COLORS } from '@/lib/utils'
import type { VisitStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: VisitStatus
  className?: string
}

// Light-background-friendly status colors
const LIGHT_STATUS_COLORS: Record<VisitStatus, string> = {
  'Pending':     'bg-amber-50 text-amber-700 border border-amber-200',
  'In Progress': 'bg-violet-50 text-violet-700 border border-violet-200',
  'Completed':   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Delivered':   'bg-slate-100 text-slate-600 border border-slate-200',
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
          status === 'Pending'     && 'bg-amber-400 pulse-soft',
          status === 'In Progress' && 'bg-violet-500 pulse-soft',
          status === 'Completed'   && 'bg-emerald-500',
          status === 'Delivered'   && 'bg-slate-400',
        )}
      />
      {VISIT_STATUS_LABELS[status]}
    </span>
  )
}
