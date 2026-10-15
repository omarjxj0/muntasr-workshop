import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { VisitStatus, TransactionType } from '@/lib/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format currency in standard Iraqi Dinar (IQD X,XXX)
export function formatCurrency(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseAmount(amount) : Number(amount) || 0
  const safe = Object.is(num, -0) ? 0 : Math.round(num)
  const isNegative = safe < 0
  const absFormatted = Math.abs(safe).toLocaleString('en-US')
  return isNegative ? `-IQD ${absFormatted}` : `IQD ${absFormatted}`
}

// Replaces Eastern Arabic numerals (٠-٩) with standard digits (0-9)
export function parseArabicNumerals(val: string | number): string {
  if (val == null) return ''
  return val.toString().replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
}

// Strict numeric parse — always use this before saving to Supabase or calculating totals
// Guarantees clean integer values in IQD with NO implicit multipliers
export function parseAmount(val: string | number | null | undefined): number {
  if (val == null) return 0
  if (typeof val === 'number') {
    return isNaN(val) || !isFinite(val) ? 0 : (Object.is(val, -0) ? 0 : Math.round(val))
  }
  const cleaned = parseArabicNumerals(val).replace(/,/g, '').trim()
  const n = parseFloat(cleaned)
  return isNaN(n) || !isFinite(n) || n < 0 ? 0 : (Object.is(n, -0) ? 0 : Math.round(n))
}

// Global handler for financial inputs on blur
// No implicit multipliers — stores exactly what the user typed as raw integer.
export function handleFinancialBlur(val: string | number): number {
  return parseAmount(val)
}

// Format a number as Iraqi Dinar for display only
export function formatAmount(amount: number | string): string {
  return formatCurrency(amount)
}

// Format a date/timestamp to readable Arabic locale
export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('ar-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

export function formatDateOnly(dateStr: string): string {
  return new Intl.DateTimeFormat('ar-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(dateStr))
}

// Visit status labels in Arabic
export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  'Pending':     'قيد الانتظار',
  'In Progress': 'قيد العمل',
  'Completed':   'مكتملة',
  'Delivered':   'تم التسليم',
}

export const VISIT_STATUS_COLORS: Record<VisitStatus, string> = {
  'Pending':     'text-amber-400 bg-amber-400/10 border-amber-400/30',
  'In Progress': 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  'Completed':   'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  'Delivered':   'text-slate-400 bg-slate-400/10 border-slate-400/30',
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  'Income':  'إيراد',
  'Expense': 'مصروف',
}

// ── Baghdad Timezone (Asia/Baghdad) Helpers ─────────────────

export function getBaghdadDateKey(dateStr: string | Date | null | undefined): { dayKey: string; monthKey: string } {
  if (!dateStr) return { dayKey: '', monthKey: '' }
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
    if (isNaN(d.getTime())) return { dayKey: '', monthKey: '' }
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d).split('-')
    return {
      dayKey: `${parts[0]}-${parts[1]}-${parts[2]}`,
      monthKey: `${parts[0]}-${parts[1]}`,
    }
  } catch {
    return { dayKey: '', monthKey: '' }
  }
}

export function getBaghdadTodayKey(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()).split('-')
  return `${parts[0]}-${parts[1]}-${parts[2]}`
}

export function isBaghdadToday(dateStr: string | Date | null | undefined): boolean {
  if (!dateStr) return false
  const { dayKey } = getBaghdadDateKey(dateStr)
  return dayKey === getBaghdadTodayKey()
}

export function formatTimeBaghdad(dateStr: string | Date): string {
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
    if (isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('ar-IQ', {
      timeZone: 'Asia/Baghdad',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d)
  } catch {
    return ''
  }
}

export function formatFullBaghdadDate(dateStr: string | Date = new Date()): string {
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
    return new Intl.DateTimeFormat('ar-IQ', {
      timeZone: 'Asia/Baghdad',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d)
  } catch {
    return ''
  }
}

/**
 * Returns a string formatted as YYYY-MM-DDTHH:mm suitable for <input type="datetime-local">
 * respecting the Baghdad timezone (Asia/Baghdad) or provided date.
 */
export function toBaghdadDateTimeLocalString(date: Date | string = new Date()): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d)

    const find = (type: string) => parts.find(p => p.type === type)?.value || '00'
    const year = find('year')
    const month = find('month')
    const day = find('day')
    const hour = find('hour')
    const minute = find('minute')
    return `${year}-${month}-${day}T${hour}:${minute}`
  } catch {
    return ''
  }
}

/**
 * Returns a string formatted as YYYY-MM-DD suitable for <input type="date">
 * in Asia/Baghdad timezone.
 */
export function toBaghdadDateString(date: Date | string = new Date()): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    const { dayKey } = getBaghdadDateKey(d)
    return dayKey
  } catch {
    return ''
  }
}

/**
 * Returns yesterday's YYYY-MM-DD in Asia/Baghdad timezone.
 */
export function getBaghdadYesterdayKey(): string {
  const [y, m, d] = getBaghdadTodayKey().split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0))
  return getBaghdadDateKey(dt).dayKey
}

/**
 * Returns yesterday's YYYY-MM-DDTHH:mm in Asia/Baghdad timezone.
 */
export function getBaghdadYesterdayDateTimeLocalString(): string {
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  return toBaghdadDateTimeLocalString(yesterday)
}

/**
 * Converts a datetime-local or date string (assumed to be in Baghdad time if no offset)
 * into an accurate UTC ISO 8601 string (+03:00 for Baghdad).
 */
export function baghdadInputToISOString(inputVal: string): string {
  if (!inputVal) return new Date().toISOString()
  if (inputVal.includes('Z') || /[+-]\d{2}:\d{2}$/.test(inputVal)) {
    return new Date(inputVal).toISOString()
  }
  if (inputVal.includes('T')) {
    const withSeconds = inputVal.split(':').length === 2 ? `${inputVal}:00` : inputVal
    return new Date(`${withSeconds}+03:00`).toISOString()
  }
  const nowBaghdad = toBaghdadDateTimeLocalString(new Date())
  const timePart = nowBaghdad.split('T')[1] || '12:00'
  return new Date(`${inputVal}T${timePart}:00+03:00`).toISOString()
}


