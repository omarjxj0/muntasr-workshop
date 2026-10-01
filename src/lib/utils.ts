import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { VisitStatus, TransactionType } from '@/lib/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format currency in Iraqi Dinar (IQD)
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseAmount(amount) : Number(amount) || 0
  const safe = Object.is(num, -0) ? 0 : Math.round(num)
  return new Intl.NumberFormat('ar-IQ', {
    style: 'currency',
    currency: 'IQD',
    maximumFractionDigits: 0,
  }).format(safe)
}

// Replaces Eastern Arabic numerals (٠-٩) with standard digits (0-9)
export function parseArabicNumerals(val: string | number): string {
  if (val == null) return ''
  return val.toString().replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
}

// Strict numeric parse — always use this before saving to Supabase or calculating totals
export function parseAmount(val: string | number | null | undefined): number {
  if (val == null) return 0
  if (typeof val === 'number') {
    return isNaN(val) || !isFinite(val) ? 0 : (Object.is(val, -0) ? 0 : val)
  }
  const cleaned = parseArabicNumerals(val).replace(/,/g, '').trim()
  const n = parseFloat(cleaned)
  return isNaN(n) || !isFinite(n) || n < 0 ? 0 : (Object.is(n, -0) ? 0 : n)
}

// Global handler for financial inputs on blur
// No implicit multipliers — stores exactly what the user typed.
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
