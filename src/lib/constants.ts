// ============================================================
// Montaser Workshop — Shared Constants
// ============================================================

export const TECHNICIANS = [
  'وسام',
  'أبو عبد الله',
  'سلوم',
  'صلاح',
  'عبود',
  'منتصر',
  'عمر',
] as const

export type TechnicianName = (typeof TECHNICIANS)[number]
