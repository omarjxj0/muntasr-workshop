// ============================================================
// Montaser Workshop — Shared Constants
// ============================================================

export const TECHNICIANS = [
  'وسام',
  'أبو عبد الله',
  'سلوم',
  'صلاح',
  'بكر',
  'منتصر',
  'عمر',
] as const

export type TechnicianName = (typeof TECHNICIANS)[number]
