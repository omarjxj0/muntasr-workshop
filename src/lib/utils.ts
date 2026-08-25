import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { VisitStatus, TransactionType } from '@/lib/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format currency in Iraqi Dinar (IQD)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-IQ', {
    style: 'currency',
    currency: 'IQD',
    maximumFractionDigits: 0,
  }).format(amount)
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
