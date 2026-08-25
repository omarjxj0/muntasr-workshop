'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface BarcodeScannerProps {
  visitId: string
  onPartAdded: () => void
}

export default function BarcodeScanner({ visitId, onPartAdded }: BarcodeScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  const processBarcode = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return

    const { data: ecu } = await supabase
      .from('ecus')
      .select('*')
      .eq('barcode', barcode.trim())
      .single() as { data: any }

    if (!ecu) { toast.error(`لم يتم العثور على قطعة بالباركود: ${barcode}`); return }
    if (ecu.stock_quantity <= 0) { toast.error(`المخزون نفد لـ: ${ecu.name}`); return }

    const { data: existing } = await supabase
      .from('used_parts')
      .select('id, quantity')
      .eq('visit_id', visitId)
      .eq('ecu_id', ecu.id)
      .single() as { data: any }

    if (existing) {
      const { error } = await supabase
        .from('used_parts')
        .update({ quantity: existing.quantity + 1 } as any)
        .eq('id', existing.id)
      if (error) { toast.error('فشل في تحديث الكمية'); return }
    } else {
      const { error } = await supabase
        .from('used_parts')
        .insert({
          visit_id: visitId,
          ecu_id: ecu.id,
          quantity: 1,
          selling_price_at_time: ecu.selling_price,
        } as any)
      if (error) { toast.error('فشل في إضافة القطعة'); return }
    }

    toast.success(`تم إضافة: ${ecu.name}`, { icon: '📦' })
    onPartAdded()
  }, [visitId, supabase, onPartAdded])

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isOtherInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      const isScannerInput = target === inputRef.current
      if (isOtherInput && !isScannerInput) return

      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim()
        bufferRef.current = ''
        if (barcode) processBarcode(barcode)
        return
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => { bufferRef.current = '' }, 100)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [processBarcode])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = inputRef.current?.value.trim()
    if (val) { processBarcode(val); if (inputRef.current) inputRef.current.value = '' }
  }

  return (
    <form onSubmit={handleManualSubmit} className="flex gap-2">
      <input
        ref={inputRef}
        placeholder="مسح الباركود أو إدخال يدوي..."
        className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 input-glow text-sm font-mono"
        dir="ltr"
      />
      <button type="submit"
        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all">
        إضافة
      </button>
    </form>
  )
}
