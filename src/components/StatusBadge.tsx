import { cn, VISIT_STATUS_LABELS, VISIT_STATUS_COLORS } from '@/lib/utils'
import type { VisitStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: VisitStatus
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
        VISIT_STATUS_COLORS[status],
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          status === 'Pending'     && 'bg-amber-400 pulse-soft',
          status === 'In Progress' && 'bg-blue-400 pulse-soft',
          status === 'Completed'   && 'bg-emerald-400',
          status === 'Delivered'   && 'bg-slate-400',
        )}
      />
      {VISIT_STATUS_LABELS[status]}
    </span>
  )
}
