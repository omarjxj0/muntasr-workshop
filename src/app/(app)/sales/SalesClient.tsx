'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  ShoppingBag, Scan, Search, Plus, Trash2, Printer, CheckCircle2,
  AlertTriangle, Wrench, Calendar, DollarSign, Clock, Phone, User,
  ChevronLeft, Sparkles, RefreshCw, X, Tag, Cpu, ShieldCheck
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TECHNICIANS } from '@/lib/constants'
import {
  formatCurrency,
  formatTimeBaghdad,
  formatDate,
  parseAmount,
  parseArabicNumerals,
  isBaghdadToday,
  cn
} from '@/lib/utils'
import { printSaleReceipt } from '@/lib/printSaleReceipt'
import { printThermalMiniReceipt } from '@/lib/printThermalMiniReceipt'
import type { DirectSale, UserRole, Ecu } from '@/lib/types'
import toast from 'react-hot-toast'

interface SalesClientProps {
  role: UserRole
  initialSales: DirectSale[]
}

const COMMON_ITEMS = [
  { label: 'فيشة ضفيرة', price: 25000, icon: '🔌' },
  { label: 'ملف إيمو أوف (Immo Off)', price: 75000, icon: '💾' },
  { label: 'برمجة وفك شفرة عقل', price: 50000, icon: '⚡' },
  { label: 'استنساخ عقل (Cloning)', price: 100000, icon: '🧬' },
  { label: 'تعديل سرعة / كتمة', price: 50000, icon: '🚀' },
  { label: 'فيشة حساس أوكسجين / كام', price: 20000, icon: '🏷️' },
]

export default function SalesClient({ role, initialSales }: SalesClientProps) {
  const supabase = createClient()

  // Sales State
  const [sales, setSales] = useState<DirectSale[]>(initialSales)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today')

  // Form State
  const [barcodeInput, setBarcodeInput] = useState('')
  const [matchedEcu, setMatchedEcu] = useState<Ecu | null>(null)
  const [isSearchingEcu, setIsSearchingEcu] = useState(false)
  const [itemName, setItemName] = useState('')
  const [sellingPrice, setSellingPrice] = useState<string>('')
  const [buyerName, setBuyerName] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [technicianName, setTechnicianName] = useState<string>(TECHNICIANS[0] || 'منتصر')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Barcode input ref for rapid continuous scanning
  const barcodeRef = useRef<HTMLInputElement>(null)

  // Focus barcode input on mount
  useEffect(() => {
    barcodeRef.current?.focus()
  }, [])

  // ── Barcode Live Search / Lookup in ECUs Table ────────────
  const lookupBarcode = useCallback(async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) {
      setMatchedEcu(null)
      return
    }

    setIsSearchingEcu(true)
    try {
      const { data, error } = await supabase
        .from('ecus')
        .select('*')
        .eq('barcode', trimmed)
        .maybeSingle()

      if (error) {
        console.warn('Barcode lookup error:', error)
      }

      if (data) {
        setMatchedEcu(data as Ecu)
        // Auto-fill item name from hierarchical specs
        const parts = [
          data.manufacturer,
          data.ecu_family,
          data.vehicle_model_code,
          data.software_id
        ].filter(Boolean)

        const autoName = parts.length > 0
          ? `عقل ${parts.join(' - ')}`
          : data.name || 'عقل سيارة'

        setItemName(autoName)

        // Auto-fill price if set
        if (data.selling_price && Number(data.selling_price) > 0) {
          setSellingPrice(String(Math.round(Number(data.selling_price))))
        }

        if (data.status === 'sold') {
          toast('⚠️ تنبيه: هذا العقل مسجل كمباع مسبقاً في النظام', { icon: '⚠️' })
        } else {
          toast.success(`تم العثور على: ${data.name || autoName}`, { icon: '🎯' })
        }
      } else {
        setMatchedEcu(null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSearchingEcu(false)
    }
  }, [supabase])

  // Handle Barcode Input Change & Enter Key
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      lookupBarcode(barcodeInput)
    }
  }

  // Handle Quick Select Chip for common items
  const handleSelectQuickItem = (item: { label: string; price: number }) => {
    setMatchedEcu(null)
    setBarcodeInput('')
    setItemName(item.label)
    setSellingPrice(String(item.price))
  }

  // Quick increment buttons for price
  const addPriceIncrement = (amount: number) => {
    const current = Number(sellingPrice) || 0
    setSellingPrice(String(current + amount))
  }

  // Reset Form
  const resetForm = () => {
    setBarcodeInput('')
    setMatchedEcu(null)
    setItemName('')
    setSellingPrice('')
    setBuyerName('')
    setBuyerPhone('')
    setNotes('')
    barcodeRef.current?.focus()
  }

  // ── Submit Direct Sale ────────────────────────────────────
  const handleSubmitSale = async (e: React.FormEvent, printAfter = false) => {
    e.preventDefault()

    const price = parseAmount(sellingPrice)
    if (!itemName.trim()) {
      toast.error('يرجى تحديد أو كتابة اسم الصنف المباع')
      return
    }
    if (price <= 0) {
      toast.error('يرجى إدخال سعر بيع صحيح')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        item_type: matchedEcu ? 'ecu' : 'accessory_or_file',
        ecu_id: matchedEcu ? matchedEcu.id : null,
        item_name: itemName.trim(),
        customer_name: buyerName.trim() || null,
        phone: buyerPhone.trim() || null,
        selling_price: price,
        technician_name: technicianName || null,
        notes: notes.trim() || null,
      }

      // Insert into direct_sales (Trigger automatically sets ecus.status = 'sold')
      const { data, error } = await supabase
        .from('direct_sales')
        .insert(payload as any)
        .select()
        .single()

      if (error) {
        throw error
      }

      // Direct fallback to ensure ECU is marked as sold in DB
      if (matchedEcu) {
        await supabase
          .from('ecus')
          .update({ status: 'sold', stock_quantity: 0 } as any)
          .eq('id', matchedEcu.id)
      }

      const newSale = data as DirectSale
      setSales(prev => [newSale, ...prev])

      toast.success('تم تسجيل عملية البيع بنجاح! 🛒')

      if (printAfter) {
        printSaleReceipt({
          sequenceNumber: 1, // Will be computed accurately in list or printed with #
          id: newSale.id,
          itemName: newSale.item_name,
          barcode: matchedEcu?.barcode || (barcodeInput.trim() || null),
          sellingPrice: Number(newSale.selling_price),
          customerName: newSale.customer_name,
          phone: newSale.phone,
          technicianName: newSale.technician_name,
          notes: newSale.notes,
          createdAt: newSale.created_at,
        })
      }

      resetForm()
    } catch (err: any) {
      console.error('Failed to submit sale:', err)
      toast.error('فشل في إتمام عملية البيع: ' + (err.message || 'خطأ غير متوقع'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete sale with confirmation
  const handleDeleteSale = async (id: string, ecuId?: string | null) => {
    if (!confirm('هل أنت متأكد من حذف عملية البيع؟')) return

    try {
      const { error } = await supabase.from('direct_sales').delete().eq('id', id)
      if (error) throw error

      // If an ECU was attached, restore its availability
      if (ecuId) {
        await supabase
          .from('ecus')
          .update({ status: 'available', stock_quantity: 1 } as any)
          .eq('id', ecuId)
      }

      setSales(prev => prev.filter(s => s.id !== id))
      toast.success('تم حذف عملية البيع')
    } catch (err: any) {
      toast.error('فشل في حذف العملية: ' + err.message)
    }
  }

  // ── Metrics & Calculations ────────────────────────────────
  const todaySales = useMemo(() => {
    return sales.filter(s => isBaghdadToday(s.created_at))
  }, [sales])

  const todayRevenue = useMemo(() => {
    return todaySales.reduce((sum, s) => sum + (Number(s.selling_price) || 0), 0)
  }, [todaySales])

  const allTimeRevenue = useMemo(() => {
    return sales.reduce((sum, s) => sum + (Number(s.selling_price) || 0), 0)
  }, [sales])

  // Filtered sales list for display
  const filteredSales = useMemo(() => {
    const now = new Date()

    return sales.filter(s => {
      // Date filter
      if (dateFilter === 'today' && !isBaghdadToday(s.created_at)) {
        return false
      }
      if (dateFilter === 'week') {
        const saleDate = new Date(s.created_at)
        const diffDays = (now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24)
        if (diffDays > 7) return false
      }
      if (dateFilter === 'month') {
        const saleDate = new Date(s.created_at)
        const diffDays = (now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24)
        if (diffDays > 30) return false
      }

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const matches =
          (s.item_name && s.item_name.toLowerCase().includes(q)) ||
          (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
          (s.phone && s.phone.includes(q)) ||
          (s.technician_name && s.technician_name.toLowerCase().includes(q)) ||
          (s.notes && s.notes.toLowerCase().includes(q)) ||
          (s.barcode && s.barcode.toLowerCase().includes(q))
        if (!matches) return false
      }

      return true
    })
  }, [sales, dateFilter, searchQuery])

  const inputClass = "w-full px-4 py-3 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)]"

  return (
    <div className="space-y-8">
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4338ca)',
              boxShadow: '0 8px 24px rgba(99,102,241,0.35)'
            }}
          >
            <ShoppingBag size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
                مبيعات الورشة والعقول
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Sparkles size={13} />
                نقطة البيع السريعة POS
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              ضرب باركود العقل، بيع الفيش والملفات، وتوثيق المبيعات اللحظية
            </p>
          </div>
        </div>

        {/* Quick Top Stats Summary */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl text-right">
            <span className="text-[11px] font-bold text-emerald-700 block">مبيعات اليوم (شفت بغداد)</span>
            <span className="text-lg font-black text-emerald-600 font-mono">
              {formatCurrency(todayRevenue)}
            </span>
            <span className="text-[10px] text-slate-500 mr-2">({todaySales.length} قطعة)</span>
          </div>

          <div className="bg-slate-100 border border-slate-200 px-4 py-2 rounded-2xl text-right">
            <span className="text-[11px] font-bold text-slate-600 block">إجمالي مبيعات المتجر</span>
            <span className="text-lg font-black text-slate-800 font-mono">
              {formatCurrency(allTimeRevenue)}
            </span>
            <span className="text-[10px] text-slate-500 mr-2">({sales.length} عملية)</span>
          </div>
        </div>
      </div>

      {/* ── Main Layout: Fast POS Form (Left/Top) & Sales Feed (Right/Bottom) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* SECTION 1: FAST POS SALE FORM (5 Cols on LG) */}
        <div className="lg:col-span-5 soft-card p-6 border-2 border-indigo-100 shadow-md space-y-5 bg-gradient-to-b from-indigo-50/20 via-white to-white sticky top-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Scan size={18} />
              </div>
              <h2 className="font-extrabold text-base text-slate-800">
                تسجيل بيع جديد (سريع)
              </h2>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              تفريغ الحقول
            </button>
          </div>

          <form onSubmit={e => handleSubmitSale(e, false)} className="space-y-4">
            {/* Fast Barcode Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  ضرب باركود العقل (ECU Barcode)
                </label>
                <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md">
                  ماسح الباركود مفعّل تلقائياً
                </span>
              </div>
              <div className="relative">
                <input
                  ref={barcodeRef}
                  type="text"
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  onBlur={() => { if (barcodeInput.trim()) lookupBarcode(barcodeInput) }}
                  placeholder="وجّه الماسح أو اكتب الباركود واضغط Enter..."
                  className={`w-full font-mono text-sm pr-10 pl-24 py-3 rounded-2xl border-2 border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-indigo-500`}
                  dir="ltr"
                />
                <Scan size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <button
                  type="button"
                  onClick={() => lookupBarcode(barcodeInput)}
                  disabled={isSearchingEcu || !barcodeInput.trim()}
                  className="absolute left-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                >
                  {isSearchingEcu ? <RefreshCw size={13} className="animate-spin" /> : 'فحص'}
                </button>
              </div>
            </div>

            {/* Matched ECU Preview Banner */}
            {matchedEcu && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/80 border-2 border-indigo-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-indigo-900 flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-indigo-600" />
                    تم العثور على العقل في المخزون
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-md font-bold text-[10px]',
                    matchedEcu.status === 'sold'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  )}>
                    {matchedEcu.status === 'sold' ? '⚠️ مسجل كمباع' : 'متوفر للبيع'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1 border-t border-indigo-200/60">
                  <div>
                    <span className="text-slate-400 block text-[10px]">الشركة المصنعة:</span>
                    <span className="font-bold text-slate-800">{matchedEcu.manufacturer || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">عائلة الوحدة / الفئة:</span>
                    <span className="font-bold text-slate-800">{matchedEcu.ecu_family || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">كود السيارة:</span>
                    <span className="font-bold text-slate-800">{matchedEcu.vehicle_model_code || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">رقم السوفتوير:</span>
                    <span className="font-bold text-slate-800">{matchedEcu.software_id || '—'}</span>
                  </div>
                </div>
                {matchedEcu.shelf_location && (
                  <div className="text-[11px] text-indigo-700 font-semibold bg-white/70 px-2 py-1 rounded-lg">
                    موقع الرف في الورشة: <strong>{matchedEcu.shelf_location}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Quick Selection Chips for Store Items Without Barcode */}
            <div>
              <span className="block text-xs font-bold text-slate-600 mb-1.5">
                أو اختر صنف سريع بدون باركود (فيشة، ملف، برمجة):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_ITEMS.map(ci => (
                  <button
                    key={ci.label}
                    type="button"
                    onClick={() => handleSelectQuickItem(ci)}
                    className={cn(
                      'px-2.5 py-1 rounded-xl text-xs font-semibold transition-all border cursor-pointer',
                      itemName === ci.label
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    )}
                  >
                    <span>{ci.icon} {ci.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Item Name (Editable / Manual) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اسم الصنف المباع <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={itemName}
                onChange={e => setItemName(e.target.value)}
                placeholder="مثال: عقل سنتافي SIM2K-241، فيشة كمبيوتر، إلخ..."
                className={inputClass}
                required
              />
            </div>

            {/* Price IQD with Quick Increments */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                سعر البيع (د.ع) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={sellingPrice ? Number(sellingPrice).toLocaleString('en-US') : ''}
                  onChange={e => {
                    const raw = parseArabicNumerals(e.target.value).replace(/,/g, '').trim()
                    setSellingPrice(raw)
                  }}
                  placeholder="0"
                  dir="ltr"
                  className="w-full font-mono text-xl font-bold pr-4 pl-16 py-3 rounded-2xl border-2 border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
                  required
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                  IQD
                </span>
              </div>

              {/* Quick Increment Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[10000, 25000, 50000, 100000, 250000].map(inc => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => addPriceIncrement(inc)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    +{inc.toLocaleString('en-US')}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSellingPrice('')}
                  className="px-2 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  تصفير
                </button>
              </div>
            </div>

            {/* Buyer Details (Optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المشتري (اختياري)
                </label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={e => setBuyerName(e.target.value)}
                  placeholder="مثال: أحمد، أبو علي..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم الهاتف (اختياري)
                </label>
                <input
                  type="tel"
                  value={buyerPhone}
                  onChange={e => setBuyerPhone(parseArabicNumerals(e.target.value))}
                  placeholder="07XXXXXXXXX"
                  dir="ltr"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Technician Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الفني المسؤول عن البيع <span className="text-rose-500">*</span>
              </label>
              <select
                value={technicianName}
                onChange={e => setTechnicianName(e.target.value)}
                className={`${inputClass} font-semibold`}
                required
              >
                {TECHNICIANS.map(tech => (
                  <option key={tech} value={tech}>
                    🔧 الفني: {tech}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ملاحظات وشروط الضمان
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="مثال: فحص بنش سليم، ضمان تشغيل أسبوع، بدون استرجاع..."
                rows={2}
                className={inputClass}
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <ShoppingBag size={17} />
                    إتمام البيع
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={e => handleSubmitSale(e, true)}
                disabled={isSubmitting}
                className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
                title="إتمام البيع مع فتح وصل الطباعة مباشرة"
              >
                <Printer size={16} />
                بيع وطباعة وصل 🖨️
              </button>

              <button
                type="button"
                onClick={async (e) => {
                  // Submit sale then print thermal mini-receipt
                  const price = parseAmount(sellingPrice)
                  if (!itemName.trim() || price <= 0) {
                    handleSubmitSale(e, false)
                    return
                  }
                  setIsSubmitting(true)
                  try {
                    const payload = {
                      item_type: matchedEcu ? 'ecu' : 'accessory_or_file',
                      ecu_id: matchedEcu ? matchedEcu.id : null,
                      item_name: itemName.trim(),
                      customer_name: buyerName.trim() || null,
                      phone: buyerPhone.trim() || null,
                      selling_price: price,
                      technician_name: technicianName || null,
                      notes: notes.trim() || null,
                    }
                    const { data, error } = await supabase
                      .from('direct_sales')
                      .insert(payload as any)
                      .select()
                      .single()
                    if (error) throw error
                    if (matchedEcu) {
                      await supabase
                        .from('ecus')
                        .update({ status: 'sold', stock_quantity: 0 } as any)
                        .eq('id', matchedEcu.id)
                    }
                    const newSale = data as DirectSale
                    setSales(prev => [newSale, ...prev])
                    printThermalMiniReceipt({
                      mode: 'sale',
                      sequenceNumber: newSale.id?.slice(0, 6).toUpperCase(),
                      createdAt: newSale.created_at || new Date().toISOString(),
                      customerName: newSale.customer_name || null,
                      phone: newSale.phone || null,
                      itemName: newSale.item_name || itemName,
                      technicianName: newSale.technician_name || null,
                      notes: newSale.notes || null,
                      totalAmount: price,
                    })
                    toast.success('تم تسجيل عملية البيع بنجاح! 🛝')
                    resetForm()
                  } catch (err: any) {
                    toast.error('فشل في إتمام عملية البيع: ' + (err.message || 'خطأ غير متوقع'))
                  } finally {
                    setIsSubmitting(false)
                  }
                }}
                disabled={isSubmitting}
                className="py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
                title="إتمام البيع وطباعة وصل حراري 50mm"
              >
                🧾 بيع ووصل حراري
              </button>
            </div>
          </form>
        </div>

        {/* SECTION 2: SALES LOG & FEED TABLE (7 Cols on LG) */}
        <div className="lg:col-span-7 soft-card p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Clock size={19} className="text-indigo-600" />
                سجل مبيعات المتجر
              </h2>
              <p className="text-xs text-slate-400">
                قائمة العمليات المسجلة مع إمكانية طباعة الوصل في أي وقت
              </p>
            </div>

            {/* Date filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setDateFilter('today')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  dateFilter === 'today'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                اليوم ({todaySales.length})
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('week')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  dateFilter === 'week'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                آخر 7 أيام
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('month')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  dateFilter === 'month'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('all')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  dateFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                الكل ({sales.length})
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث في المبيعات بالاسم، الباركود، الفني، الزبون..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs text-slate-800 focus:outline-none focus:border-indigo-400"
            />
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Table */}
          {filteredSales.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-100">
                <ShoppingBag size={26} />
              </div>
              <p className="text-sm font-bold text-slate-700">لا توجد مبيعات مسجلة في هذا النطاق</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                يمكنك ضرب باركود أي عقل أو اختيار فيشة/ملف من القائمة لتسجيل عملية بيع مباشرة.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 bg-slate-50/60">
                    <th className="py-3 px-3 w-12">#</th>
                    <th className="py-3 px-3">المادة المباعة</th>
                    <th className="py-3 px-3">المشتري</th>
                    <th className="py-3 px-3">الفني</th>
                    <th className="py-3 px-3 font-mono">المبلغ (IQD)</th>
                    <th className="py-3 px-3">التاريخ والوقت</th>
                    <th className="py-3 px-3 text-center w-24">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredSales.map((sale, idx) => {
                    const seqNumber = filteredSales.length - idx

                    return (
                      <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors group">
                        {/* Sequence # */}
                        <td className="py-3.5 px-3 font-mono text-xs font-bold text-slate-400">
                          #{seqNumber}
                        </td>

                        {/* Item Details */}
                        <td className="py-3.5 px-3">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 block text-xs sm:text-sm">
                              {sale.item_name}
                            </span>
                            {sale.barcode && (
                              <span className="inline-block font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200" dir="ltr">
                                {sale.barcode}
                              </span>
                            )}
                            {sale.notes && (
                              <p className="text-[11px] text-slate-400 truncate max-w-xs">
                                {sale.notes}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Buyer */}
                        <td className="py-3.5 px-3">
                          <div className="text-xs">
                            <span className="font-semibold text-slate-700 block">
                              {sale.customer_name || 'زبون نقدي'}
                            </span>
                            {sale.phone && (
                              <span className="font-mono text-slate-400 text-[11px]" dir="ltr">
                                {sale.phone}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Technician */}
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Wrench size={11} className="text-amber-600" />
                            {sale.technician_name || 'عام'}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-3 font-mono font-extrabold text-emerald-600 whitespace-nowrap">
                          {formatCurrency(sale.selling_price)}
                        </td>

                        {/* Time */}
                        <td className="py-3.5 px-3 text-xs text-slate-400 whitespace-nowrap">
                          <div>{formatDate(sale.created_at)}</div>
                          <div className="text-[10px] text-slate-400">{formatTimeBaghdad(sale.created_at)}</div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => printSaleReceipt({
                                sequenceNumber: seqNumber,
                                id: sale.id,
                                itemName: sale.item_name,
                                barcode: sale.barcode,
                                sellingPrice: Number(sale.selling_price),
                                customerName: sale.customer_name,
                                phone: sale.phone,
                                technicianName: sale.technician_name,
                                notes: sale.notes,
                                createdAt: sale.created_at,
                              })}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                              title="طباعة وصل البيع (A4)"
                            >
                              <Printer size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={() => printThermalMiniReceipt({
                                mode: 'sale',
                                sequenceNumber: seqNumber,
                                createdAt: sale.created_at,
                                customerName: sale.customer_name || null,
                                phone: sale.phone || null,
                                itemName: sale.item_name || '—',
                                technicianName: sale.technician_name || null,
                                notes: sale.notes || null,
                                totalAmount: Number(sale.selling_price) || 0,
                              })}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
                              title="وصل حراري 50mm"
                            >
                              🧾
                            </button>

                            {(role === 'admin' || isBaghdadToday(sale.created_at)) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSale(sale.id, sale.ecu_id)}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="حذف العملية"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t border-slate-200 text-xs sm:text-sm">
                    <td colSpan={4} className="py-3.5 px-3 text-right text-slate-700">
                      مجموع المبيعات المعروضة:
                    </td>
                    <td className="py-3.5 px-3 font-mono text-emerald-600 font-extrabold whitespace-nowrap">
                      {formatCurrency(filteredSales.reduce((sum, s) => sum + (Number(s.selling_price) || 0), 0))}
                    </td>
                    <td colSpan={2} className="py-3.5 px-3 text-slate-400 text-xs text-left">
                      ({filteredSales.length} عملية)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
