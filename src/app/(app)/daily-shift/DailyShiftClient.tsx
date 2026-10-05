'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Flame, Car, Cpu, Wrench, Search, X, Calendar, DollarSign,
  CheckCircle2, Clock, Filter, Printer, ExternalLink, RefreshCw,
  TrendingUp, TrendingDown, Activity, User, Phone, AlertCircle, ChevronLeft,
  Wallet, Receipt, Plus, Trash2, ArrowDownRight, ArrowUpRight, Coins, Sparkles,
  ShoppingBag, Scan, Tag
} from 'lucide-react'
import {
  formatCurrency,
  formatTimeBaghdad,
  formatFullBaghdadDate,
  formatDate,
  parseAmount,
  parseArabicNumerals,
  cn,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_COLORS,
} from '@/lib/utils'
import { TECHNICIANS } from '@/lib/constants'
import type { VisitStatus, UserRole, DirectSale, Ecu } from '@/lib/types'
import { printSaleReceipt } from '@/lib/printSaleReceipt'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export interface DailyVisitItem {
  id: string
  entry_date: string
  delivered_at?: string | null
  completed_at?: string | null
  status: VisitStatus
  complaint: string | null
  labor_cost: number
  total_amount: number
  technician_name: string | null
  vehicles?: {
    make_and_model: string
    license_plate: string
    customers?: {
      name: string
      phone: string
    } | null
  } | null
}

export interface DailyInspectionItem {
  id: string
  type: 'car' | 'ecu'
  customer_name: string
  phone: string | null
  subject: string | null
  fault_codes: string | null
  technician_name: string | null
  inspection_fee: number
  created_at: string
  image_paths?: any
  notes?: string | null
  status?: string | null
}

export interface DailyExpenseItem {
  id: string
  amount: number
  description: string
  category: string
  created_at: string
  isWage?: boolean
  recipientName?: string | null
}

export interface UnifiedOperation {
  id: string
  kind: 'visit' | 'inspection_car' | 'inspection_ecu' | 'sale'
  kindLabel: string
  customerName: string
  customerPhone: string | null
  vehicleOrSubject: string
  licensePlate: string | null
  technicianName: string
  amount: number
  timestamp: string
  timeFormatted: string
  statusText: string
  statusVariant: 'success' | 'warning' | 'info' | 'neutral'
  detailsHref?: string
  rawItem: DailyVisitItem | DailyInspectionItem | DirectSale
}

interface Props {
  role: UserRole
  initialVisits: DailyVisitItem[]
  initialInspections: DailyInspectionItem[]
  initialSales?: DirectSale[]
  initialExpenses?: DailyExpenseItem[]
  initialWages?: DailyExpenseItem[]
}

const EXPENSE_CATEGORIES = [
  'ضيافة ونثريات',
  'أدوات ومواد',
  'صيانة وتشغيل',
  'سلفة / أجور',
  'أخرى'
]

const QUICK_SALE_ITEMS = [
  { label: 'فيشة ضفيرة', price: 25000, icon: '🔌' },
  { label: 'ملف إيمو أوف (Immo Off)', price: 75000, icon: '💾' },
  { label: 'برمجة وفك شفرة عقل', price: 50000, icon: '⚡' },
  { label: 'استنساخ عقل (Cloning)', price: 100000, icon: '🧬' },
  { label: 'تعديل سرعة / كتمة', price: 50000, icon: '🚀' },
  { label: 'فيشة حساس أوكسجين / كام', price: 20000, icon: '🏷️' },
]

export default function DailyShiftClient({
  role,
  initialVisits,
  initialInspections,
  initialSales = [],
  initialExpenses = [],
  initialWages = []
}: Props) {
  const supabase = createClient()

  // State
  const [selectedTech, setSelectedTech] = useState<string | null>(null)
  const [filterKind, setFilterKind] = useState<'all' | 'visit' | 'inspection' | 'sale' | 'expense'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [previewInspection, setPreviewInspection] = useState<DailyInspectionItem | null>(null)

  // Direct Sales State
  const [sales, setSales] = useState<DirectSale[]>(() => initialSales)

  // Fast Direct Sale Modal State
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false)
  const [saleBarcodeInput, setSaleBarcodeInput] = useState('')
  const [saleMatchedEcu, setSaleMatchedEcu] = useState<Ecu | null>(null)
  const [isSaleSearchingEcu, setIsSaleSearchingEcu] = useState(false)
  const [saleItemName, setSaleItemName] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [saleBuyerName, setSaleBuyerName] = useState('')
  const [saleBuyerPhone, setSaleBuyerPhone] = useState('')
  const [saleTech, setSaleTech] = useState<string>(TECHNICIANS[0] || 'منتصر')
  const [saleNotes, setSaleNotes] = useState('')
  const [isSubmittingSale, setIsSubmittingSale] = useState(false)

  // Expenses State (local update for instant UI responsiveness)
  const [expenses, setExpenses] = useState<DailyExpenseItem[]>(() =>
    initialExpenses.map(e => ({
      ...e,
      amount: Math.round(Number(e.amount) || 0)
    }))
  )
  const [wages, setWages] = useState<DailyExpenseItem[]>(() =>
    initialWages.map(w => ({
      ...w,
      amount: Math.round(Number(w.amount) || 0)
    }))
  )

  // Quick Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('ضيافة ونثريات')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseWorker, setExpenseWorker] = useState('عام / الورشة')
  const [expenseNote, setExpenseNote] = useState('')
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false)

  // Barcode Lookup for Fast Direct Sale
  const lookupSaleBarcode = async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) {
      setSaleMatchedEcu(null)
      return
    }
    setIsSaleSearchingEcu(true)
    try {
      const { data } = await supabase
        .from('ecus')
        .select('*')
        .eq('barcode', trimmed)
        .maybeSingle()

      if (data) {
        setSaleMatchedEcu(data as Ecu)
        const parts = [
          data.manufacturer,
          data.ecu_family,
          data.vehicle_model_code,
          data.software_id
        ].filter(Boolean)

        const autoName = parts.length > 0 ? `عقل ${parts.join(' - ')}` : data.name || 'عقل سيارة'
        setSaleItemName(autoName)
        if (data.selling_price && Number(data.selling_price) > 0) {
          setSalePrice(String(Math.round(Number(data.selling_price))))
        }
        if (data.status === 'sold') {
          toast('⚠️ تنبيه: هذا العقل مسجل كمباع مسبقاً', { icon: '⚠️' })
        } else {
          toast.success(`تم العثور على: ${data.name || autoName}`, { icon: '🎯' })
        }
      } else {
        setSaleMatchedEcu(null)
      }
    } catch (err) {
      console.error('Barcode lookup error:', err)
    } finally {
      setIsSaleSearchingEcu(false)
    }
  }

  // Handle Quick Add Direct Sale
  const handleQuickAddSale = async (e: React.FormEvent, printAfter = false) => {
    e.preventDefault()
    const price = parseAmount(salePrice)
    if (!saleItemName.trim()) {
      toast.error('يرجى تحديد أو كتابة اسم الصنف المباع')
      return
    }
    if (price <= 0) {
      toast.error('يرجى إدخال سعر بيع صحيح')
      return
    }

    setIsSubmittingSale(true)
    try {
      const payload = {
        item_type: saleMatchedEcu ? 'ecu' : 'accessory_or_file',
        ecu_id: saleMatchedEcu ? saleMatchedEcu.id : null,
        item_name: saleItemName.trim(),
        customer_name: saleBuyerName.trim() || null,
        phone: saleBuyerPhone.trim() || null,
        selling_price: price,
        technician_name: saleTech || null,
        notes: saleNotes.trim() || null,
      }

      const { data, error } = await supabase
        .from('direct_sales')
        .insert(payload as any)
        .select()
        .single()

      if (error) throw error

      if (saleMatchedEcu) {
        await supabase
          .from('ecus')
          .update({ status: 'sold', stock_quantity: 0 } as any)
          .eq('id', saleMatchedEcu.id)
      }

      const newSale = data as DirectSale
      setSales(prev => [newSale, ...prev])
      toast.success('تم تسجيل البيع وإضافته إلى دخل شفت اليوم! 🛒')

      if (printAfter) {
        printSaleReceipt({
          id: newSale.id,
          itemName: newSale.item_name,
          barcode: saleMatchedEcu?.barcode || (saleBarcodeInput.trim() || null),
          sellingPrice: Number(newSale.selling_price),
          customerName: newSale.customer_name,
          phone: newSale.phone,
          technicianName: newSale.technician_name,
          notes: newSale.notes,
          createdAt: newSale.created_at,
        })
      }

      setSaleBarcodeInput('')
      setSaleMatchedEcu(null)
      setSaleItemName('')
      setSalePrice('')
      setSaleBuyerName('')
      setSaleBuyerPhone('')
      setSaleNotes('')
      setIsSaleModalOpen(false)
    } catch (err: any) {
      console.error('Failed to submit sale in daily-shift:', err)
      toast.error('فشل في تسجيل البيع: ' + (err.message || 'خطأ غير متوقع'))
    } finally {
      setIsSubmittingSale(false)
    }
  }

  // Map visits and inspections into UnifiedOperation array
  const allOperations: UnifiedOperation[] = useMemo(() => {
    const list: UnifiedOperation[] = []

    // 1. Visits
    for (const v of initialVisits) {
      const isDeliveredOrCompleted = v.status === 'Completed' || v.status === 'Delivered'
      // Overnight cars staying in the workshop contribute 0 cash today!
      const grandTotal = isDeliveredOrCompleted
        ? (Number(v.labor_cost) || 0) + (Number(v.total_amount) || 0)
        : 0

      const hasPlate = v.vehicles?.license_plate && !['—', '-', ''].includes(v.vehicles.license_plate.trim())
      const plate = hasPlate ? v.vehicles?.license_plate ?? null : null

      let statusVariant: UnifiedOperation['statusVariant'] = 'info'
      let statusText = VISIT_STATUS_LABELS[v.status] || v.status
      let kindLabel = 'زيارة صيانة'

      if (isDeliveredOrCompleted) {
        statusVariant = 'success'
        kindLabel = v.status === 'Delivered' ? 'زيارة مسلّمة' : 'زيارة مكتملة'
      } else if (v.status === 'In Progress') {
        statusVariant = 'warning'
        statusText = 'قيد العمل (بايتة)'
        kindLabel = 'سيارة بايتة'
      } else {
        statusVariant = 'neutral'
        statusText = 'قيد الانتظار (بايتة)'
        kindLabel = 'سيارة بايتة'
      }

      const timestamp = (isDeliveredOrCompleted ? (v.delivered_at || v.completed_at) : null) || v.entry_date

      list.push({
        id: v.id,
        kind: 'visit',
        kindLabel,
        customerName: v.vehicles?.customers?.name || 'زبون غير مسجل',
        customerPhone: v.vehicles?.customers?.phone || null,
        vehicleOrSubject: v.vehicles?.make_and_model || 'مركبة غير محددة',
        licensePlate: plate,
        technicianName: v.technician_name?.trim() || 'غير محدد',
        amount: grandTotal,
        timestamp,
        timeFormatted: formatTimeBaghdad(timestamp),
        statusText,
        statusVariant,
        detailsHref: `/visits/${v.id}`,
        rawItem: v,
      })
    }

    // 2. Quick Inspections
    for (const qi of initialInspections) {
      const isCar = qi.type !== 'ecu'
      list.push({
        id: qi.id,
        kind: isCar ? 'inspection_car' : 'inspection_ecu',
        kindLabel: isCar ? 'فحص سيارة' : 'فحص عقل ECU',
        customerName: qi.customer_name || 'زبون فحص',
        customerPhone: qi.phone || null,
        vehicleOrSubject: qi.subject || (isCar ? 'فحص كمبيوتر' : 'فحص على البنش'),
        licensePlate: null,
        technicianName: qi.technician_name?.trim() || 'غير محدد',
        amount: Number(qi.inspection_fee) || 0,
        timestamp: qi.created_at,
        timeFormatted: formatTimeBaghdad(qi.created_at),
        statusText: 'فحص مكتمل',
        statusVariant: 'success',
        rawItem: qi,
      })
    }

    // 3. Direct Sales (ECU Store & Parts)
    for (const s of sales) {
      list.push({
        id: s.id,
        kind: 'sale',
        kindLabel: '🛒 بيع عقل / مبيعات',
        customerName: s.customer_name || 'زبون نقدي',
        customerPhone: s.phone || null,
        vehicleOrSubject: s.item_name,
        licensePlate: s.barcode ? `باركود: ${s.barcode}` : null,
        technicianName: s.technician_name?.trim() || 'غير محدد',
        amount: Number(s.selling_price) || 0,
        timestamp: s.created_at,
        timeFormatted: formatTimeBaghdad(s.created_at),
        statusText: 'تم البيع والتسليم',
        statusVariant: 'success',
        rawItem: s,
      })
    }

    // Sort descending by time
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [initialVisits, initialInspections, sales])

  // Summary Metrics
  const totalOperationsCount = allOperations.length
  const totalVisitsCount = initialVisits.length
  const totalInspectionsCount = initialInspections.length

  const deliveredVisitsCount = useMemo(() => {
    return initialVisits.filter(v => v.status === 'Completed' || v.status === 'Delivered').length
  }, [initialVisits])

  const overnightVisitsCount = useMemo(() => {
    return initialVisits.filter(v => v.status === 'Pending' || v.status === 'In Progress').length
  }, [initialVisits])

  // Direct Sales Revenue Today
  const directSalesRevenueToday = useMemo(() => {
    return sales.reduce((sum, s) => sum + (Number(s.selling_price) || 0), 0)
  }, [sales])

  const directSalesCount = sales.length

  // Grand Total Revenue collected / recorded today (strictly delivered visits + inspection fees + direct sales)
  const totalRevenueToday = useMemo(() => {
    return allOperations.reduce((sum, op) => sum + (op.amount || 0), 0)
  }, [allOperations])

  const visitsRevenueToday = useMemo(() => {
    return initialVisits.reduce((sum, v) => {
      if (v.status === 'Completed' || v.status === 'Delivered') {
        return sum + ((Number(v.labor_cost) || 0) + (Number(v.total_amount) || 0))
      }
      return sum
    }, 0)
  }, [initialVisits])

  const inspectionsRevenueToday = useMemo(() => {
    return initialInspections.reduce((sum, qi) => sum + (Number(qi.inspection_fee) || 0), 0)
  }, [initialInspections])

  // Expenses & Wages Computations
  const todayExpensesOnlyTotal = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  }, [expenses])

  const todayWagesTotal = useMemo(() => {
    return wages.reduce((sum, w) => sum + (Number(w.amount) || 0), 0)
  }, [wages])

  const todayExpensesTotal = todayExpensesOnlyTotal + todayWagesTotal
  const todayExpensesCount = expenses.length + wages.length

  // Net Profit for Today = Gross Income - (Operational Expenses + Daily Wages)
  const todayNetProfit = totalRevenueToday - todayExpensesTotal

  // Combined expenses list for display in the feed tab and print report
  const allDailyExpenses = useMemo(() => {
    return [...expenses, ...wages].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [expenses, wages])

  // Technician Breakdown Calculation
  const technicianStats = useMemo(() => {
    const stats: Record<string, { count: number; totalAmount: number; visits: number; inspections: number; sales: number }> = {}

    // Initialize with all workshop technicians
    for (const tech of TECHNICIANS) {
      stats[tech] = { count: 0, totalAmount: 0, visits: 0, inspections: 0, sales: 0 }
    }
    // Also track unassigned if any
    stats['غير محدد'] = { count: 0, totalAmount: 0, visits: 0, inspections: 0, sales: 0 }

    for (const op of allOperations) {
      const name = op.technicianName || 'غير محدد'
      if (!stats[name]) {
        stats[name] = { count: 0, totalAmount: 0, visits: 0, inspections: 0, sales: 0 }
      }
      stats[name].count += 1
      stats[name].totalAmount += op.amount
      if (op.kind === 'visit') stats[name].visits += 1
      else if (op.kind === 'sale') stats[name].sales += 1
      else stats[name].inspections += 1
    }

    // Convert to array and sort by active contribution
    const list = Object.entries(stats).map(([name, data]) => ({
      name,
      ...data,
    }))

    // Keep active technicians first, then by count descending
    return list.sort((a, b) => {
      if (a.name === 'غير محدد' && b.name !== 'غير محدد') return 1
      if (b.name === 'غير محدد' && a.name !== 'غير محدد') return -1
      if (b.count !== a.count) return b.count - a.count
      return b.totalAmount - a.totalAmount
    })
  }, [allOperations])

  // Filtered Unified Operations
  const filteredOperations = useMemo(() => {
    return allOperations.filter(op => {
      // Tech filter
      if (selectedTech && op.technicianName !== selectedTech) {
        return false
      }

      // Kind filter
      if (filterKind === 'visit' && op.kind !== 'visit') return false
      if (filterKind === 'inspection' && op.kind !== 'inspection_car' && op.kind !== 'inspection_ecu') return false
      if (filterKind === 'sale' && op.kind !== 'sale') return false

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const match =
          op.customerName.toLowerCase().includes(q) ||
          (op.customerPhone && op.customerPhone.includes(q)) ||
          op.vehicleOrSubject.toLowerCase().includes(q) ||
          (op.licensePlate && op.licensePlate.toLowerCase().includes(q)) ||
          op.technicianName.toLowerCase().includes(q) ||
          op.kindLabel.toLowerCase().includes(q)
        if (!match) return false
      }

      return true
    })
  }, [allOperations, selectedTech, filterKind, searchQuery])

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return allDailyExpenses
    const q = searchQuery.trim().toLowerCase()
    return allDailyExpenses.filter(e =>
      e.description.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      (e.recipientName && e.recipientName.toLowerCase().includes(q))
    )
  }, [allDailyExpenses, searchQuery])

  // Handle Quick Add Expense
  const handleQuickAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseAmount(expenseAmount)
    if (parsed <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح للصرفية')
      return
    }
    if (!expenseDescription.trim()) {
      toast.error('يرجى إدخال وصف أو سبب المصروف')
      return
    }

    setIsSubmittingExpense(true)

    // Build description including technician/recipient or note
    const recipientTag = expenseWorker && expenseWorker !== 'عام / الورشة' ? ` (المستلم: ${expenseWorker})` : ''
    const extraNote = expenseNote.trim() ? ` [${expenseNote.trim()}]` : ''
    const fullDescription = `${expenseDescription.trim()}${recipientTag}${extraNote}`

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          amount: parsed,
          category: expenseCategory,
          description: fullDescription,
        })
        .select()
        .single()

      if (error) {
        console.error('Expense insert error:', error)
        toast.error('حدث خطأ أثناء حفظ الصرفية')
      } else if (data) {
        const newExpenseItem: DailyExpenseItem = {
          id: data.id,
          amount: Math.round(Number(data.amount) || 0),
          category: data.category,
          description: data.description,
          created_at: data.created_at,
          isWage: false,
          recipientName: expenseWorker !== 'عام / الورشة' ? expenseWorker : null,
        }

        setExpenses(prev => [newExpenseItem, ...prev])
        toast.success(`تم تسجيل صرفية بقيمة ${formatCurrency(parsed)} وتحديث صافي الشفت بنجاح ✅`)

        // Reset and close
        setExpenseAmount('')
        setExpenseDescription('')
        setExpenseNote('')
        setExpenseWorker('عام / الورشة')
        setExpenseCategory('ضيافة ونثريات')
        setIsExpenseModalOpen(false)
      }
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ غير متوقع أثناء حفظ الصرفية')
    } finally {
      setIsSubmittingExpense(false)
    }
  }

  // Handle Delete Expense
  const handleDeleteExpense = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الصرفية؟ سيتم إرجاع المبلغ لصافي ربح اليوم فوراً.')) return

    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) {
        toast.error('حدث خطأ أثناء حذف الصرفية')
      } else {
        setExpenses(prev => prev.filter(e => e.id !== id))
        toast.success('تم حذف الصرفية وتحديث صافي الربح بنجاح ✅')
      }
    } catch (err) {
      console.error(err)
      toast.error('تعذر حذف الصرفية')
    }
  }

  // Professional Printable Daily Shift Summary
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      // Fallback to window.print() if popup blocker intercepted
      window.print()
      return
    }

    const todayDateStr = formatFullBaghdadDate()
    const nowTimeStr = formatTimeBaghdad(new Date())

    // Technicians rows
    const techRowsHtml = technicianStats
      .filter(t => t.count > 0)
      .map(
        t => `
        <tr>
          <td><strong>🔧 ${t.name}</strong></td>
          <td style="text-align: center;">${t.count} عملية</td>
          <td style="text-align: center;">${t.visits}</td>
          <td style="text-align: center;">${t.inspections}</td>
          <td style="text-align: center; color: #4338ca; font-weight: bold;">${t.sales || 0}</td>
          <td style="text-align: left; font-weight: bold; font-family: monospace;">${formatCurrency(t.totalAmount)}</td>
        </tr>
      `
      )
      .join('')

    // Expenses breakdown rows
    const expenseRowsHtml = allDailyExpenses.length > 0
      ? allDailyExpenses.map((exp, idx) => `
        <tr>
          <td style="text-align: center; width: 36px;">#${idx + 1}</td>
          <td>
            <strong>${exp.description}</strong>
            ${exp.recipientName ? `<span class="badge badge-worker">المستلم: ${exp.recipientName}</span>` : ''}
          </td>
          <td style="text-align: center;">
            <span class="badge ${exp.isWage ? 'badge-wage' : 'badge-expense'}">${exp.category}</span>
          </td>
          <td style="text-align: center; font-size: 11px; color: #64748b;">${formatTimeBaghdad(exp.created_at)}</td>
          <td style="text-align: left; font-weight: bold; font-family: monospace; color: #e11d48;">
            - ${formatCurrency(exp.amount)}
          </td>
        </tr>
      `).join('')
      : `
        <tr>
          <td colspan="5" style="text-align: center; color: #94a3b8; padding: 18px;">
            لا توجد صرفيات أو أجور مسجلة في هذا الشفت حتى الآن
          </td>
        </tr>
      `

    // Operations rows
    const operationsRowsHtml = allOperations.slice(0, 50).map((op, idx) => `
      <tr>
        <td style="text-align: center; width: 36px;">#${idx + 1}</td>
        <td>
          <span class="badge ${op.kind === 'visit' ? 'badge-visit' : 'badge-insp'}">${op.kindLabel}</span>
        </td>
        <td>
          <strong>${op.vehicleOrSubject}</strong>
          ${op.licensePlate ? `<span style="font-family: monospace; font-size: 11px; background: #f1f5f9; padding: 2px 5px; border-radius: 4px; margin-right: 4px;">${op.licensePlate}</span>` : ''}
          <div style="font-size: 11px; color: #64748b;">${op.customerName}</div>
        </td>
        <td>🔧 ${op.technicianName}</td>
        <td style="text-align: center; font-size: 11px; color: #64748b;">${op.timeFormatted}</td>
        <td style="text-align: left; font-weight: bold; font-family: monospace;">
          ${op.amount > 0 ? formatCurrency(op.amount) : '<span style="color:#f59e0b;font-size:11px;">بايتة</span>'}
        </td>
      </tr>
    `).join('')

    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>تقرير شفت العمل اليومي والحساب المالي · ${todayDateStr}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    }
    body {
      direction: rtl;
      background: #ffffff;
      color: #0f172a;
      margin: 0;
      padding: 10px 14px;
      font-size: 12px;
      line-height: 1.5;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .workshop-title {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      margin: 0;
    }
    .report-subtitle {
      font-size: 12px;
      color: #475569;
      margin-top: 3px;
    }
    .header-meta {
      text-align: left;
      font-size: 11px;
      color: #334155;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-card {
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .kpi-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .kpi-val {
      font-size: 18px;
      font-weight: 900;
      font-family: monospace;
    }
    .kpi-sub {
      font-size: 10px;
      color: #64748b;
      margin-top: 4px;
    }
    .kpi-income {
      border-color: #10b981;
      background: #ecfdf5;
    }
    .kpi-income .kpi-val {
      color: #047857;
    }
    .kpi-expense {
      border-color: #f43f5e;
      background: #fff1f2;
    }
    .kpi-expense .kpi-val {
      color: #be123c;
    }
    .kpi-net {
      border-color: #0ea5e9;
      background: #f0f9ff;
    }
    .kpi-net .kpi-val {
      color: #0369a1;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #1e293b;
      border-right: 4px solid #f59e0b;
      padding-right: 8px;
      margin: 18px 0 8px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 11px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: right;
    }
    td {
      border: 1px solid #e2e8f0;
      padding: 5px 8px;
      vertical-align: middle;
    }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
    }
    .badge-visit { background: #ede9fe; color: #6d28d9; }
    .badge-insp { background: #ccfbf1; color: #0f766e; }
    .badge-expense { background: #ffe4e6; color: #be123c; }
    .badge-wage { background: #fef3c7; color: #b45309; }
    .badge-worker { background: #f1f5f9; color: #334155; font-size: 9px; margin-right: 4px; }
    .net-profit-box {
      border: 2px solid #0f172a;
      border-radius: 8px;
      padding: 14px 18px;
      background: #f8fafc;
      margin-top: 20px;
      page-break-inside: avoid;
    }
    .net-profit-grid {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .net-figure {
      font-size: 24px;
      font-weight: 900;
      font-family: monospace;
      color: ${todayNetProfit >= 0 ? '#047857' : '#be123c'};
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 36px;
      padding-top: 12px;
      border-top: 1px dashed #cbd5e1;
      page-break-inside: avoid;
    }
    .sign-block {
      text-align: center;
      width: 200px;
    }
    .sign-line {
      margin-top: 32px;
      border-top: 1px solid #64748b;
    }
    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header-bar">
    <div>
      <h1 class="workshop-title">ورشة منتصر لكهرباء وبرمجة السيارات الحديثة</h1>
      <div class="report-subtitle">سجل شفت العمل اليومي وتوزيع المهام والحساب المالي المباشر</div>
    </div>
    <div class="header-meta">
      <div><strong>التاريخ:</strong> ${todayDateStr}</div>
      <div><strong>وقت الطباعة:</strong> ${nowTimeStr} (توقيت بغداد)</div>
      <div><strong>حالة الشفت:</strong> رسمي ومعتمد</div>
    </div>
  </div>

  <!-- KPI Financial Cards -->
  <div class="kpi-grid">
    <div class="kpi-card kpi-income">
      <div class="kpi-label">إجمالي دخل اليوم المحصل (Gross)</div>
      <div class="kpi-val">${formatCurrency(totalRevenueToday)}</div>
      <div class="kpi-sub">زيارات: ${formatCurrency(visitsRevenueToday)} • فحوصات: ${formatCurrency(inspectionsRevenueToday)} • مبيعات: ${formatCurrency(directSalesRevenueToday)}</div>
    </div>
    <div class="kpi-card" style="border-color: #6366f1; background: #eef2ff;">
      <div class="kpi-label" style="color: #4f46e5;">مبيعات الورشة والعقول (Store)</div>
      <div class="kpi-val" style="color: #4338ca;">${formatCurrency(directSalesRevenueToday)}</div>
      <div class="kpi-sub" style="color: #6366f1;">${directSalesCount} عقل / قطعة مباعة</div>
    </div>
    <div class="kpi-card kpi-expense">
      <div class="kpi-label">إجمالي صرفيات وأجور اليوم (Expenses)</div>
      <div class="kpi-val">${formatCurrency(todayExpensesTotal)}</div>
      <div class="kpi-sub">${todayExpensesCount} بنود صرفيات وتشغيل ورواتب</div>
    </div>
    <div class="kpi-card kpi-net">
      <div class="kpi-label">صافي ربح شفت اليوم (Net Profit)</div>
      <div class="kpi-val">${formatCurrency(todayNetProfit)}</div>
      <div class="kpi-sub">الدخل المحصل - الصرفيات والأجور</div>
    </div>
  </div>

  <!-- Section 1: Expenses & Wages Breakdown (Requirement 4) -->
  <div class="section-title">
    <span>جدول صرفيات وأجور ونثريات اليوم (${allDailyExpenses.length} بنود)</span>
    <span style="font-size: 11px; font-weight: normal; color: #be123c;">الإجمالي: ${formatCurrency(todayExpensesTotal)}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 36px; text-align: center;">#</th>
        <th>بيان الصرفية / الوصف</th>
        <th style="text-align: center; width: 110px;">التصنيف</th>
        <th style="text-align: center; width: 80px;">الوقت</th>
        <th style="text-align: left; width: 110px;">المبلغ (IQD)</th>
      </tr>
    </thead>
    <tbody>
      ${expenseRowsHtml}
    </tbody>
    <tfoot>
      <tr style="background: #fff1f2; font-weight: bold;">
        <td colspan="4" style="text-align: right; color: #9f1239;">مجموع صرفيات وأجور الشفت اليومي:</td>
        <td style="text-align: left; font-family: monospace; color: #be123c;">${formatCurrency(todayExpensesTotal)}</td>
      </tr>
    </tfoot>
  </table>

  ${sales.length > 0 ? `
  <!-- Section: Direct Sales Breakdown -->
  <div class="section-title">
    <span>جدول مبيعات العقول والقطع المباشرة (${sales.length} مبيعات)</span>
    <span style="font-size: 11px; font-weight: normal; color: #4338ca;">الإجمالي: ${formatCurrency(directSalesRevenueToday)}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 36px; text-align: center;">#</th>
        <th>المادة المباعة</th>
        <th>المشتري</th>
        <th style="text-align: center; width: 100px;">الفني</th>
        <th style="text-align: center; width: 80px;">الوقت</th>
        <th style="text-align: left; width: 110px;">المبلغ (IQD)</th>
      </tr>
    </thead>
    <tbody>
      ${sales.map((s, i) => `
        <tr>
          <td style="text-align: center; color: #94a3b8; font-family: monospace;">#${i + 1}</td>
          <td style="font-weight: bold;">${s.item_name} ${s.barcode ? `<span style="font-size: 10px; color: #6366f1;">(${s.barcode})</span>` : ''}</td>
          <td>${s.customer_name || 'زبون نقدي'} ${s.phone ? `<span style="font-size: 10px; color: #64748b;">${s.phone}</span>` : ''}</td>
          <td style="text-align: center;">${s.technician_name || 'عام'}</td>
          <td style="text-align: center; font-size: 11px; color: #64748b;">${formatTimeBaghdad(s.created_at)}</td>
          <td style="text-align: left; font-weight: bold; font-family: monospace; color: #059669;">${formatCurrency(s.selling_price)}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr style="background: #eef2ff; font-weight: bold;">
        <td colspan="5" style="text-align: right; color: #3730a3;">مجموع مبيعات العقول والورشة اليوم:</td>
        <td style="text-align: left; font-family: monospace; color: #4338ca;">${formatCurrency(directSalesRevenueToday)}</td>
      </tr>
    </tfoot>
  </table>
  ` : ''}

  <!-- Section 2: Technician Distribution -->
  <div class="section-title">
    <span>توزيع إنتاجية ودخل الفنيين في الشفت</span>
    <span style="font-size: 11px; font-weight: normal; color: #475569;">إجمالي العمليات: ${totalOperationsCount}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>الفني المسؤول</th>
        <th style="text-align: center; width: 90px;">إجمالي العمليات</th>
        <th style="text-align: center; width: 75px;">زيارات مسلّمة</th>
        <th style="text-align: center; width: 75px;">فحوصات</th>
        <th style="text-align: center; width: 75px;">مبيعات</th>
        <th style="text-align: left; width: 130px;">الإيراد المحصل (IQD)</th>
      </tr>
    </thead>
    <tbody>
      ${techRowsHtml}
    </tbody>
  </table>

  <!-- Section 3: Operations Log -->
  <div class="section-title">
    <span>سجل عمليات اليوم والسيارات المسلّمة</span>
    <span style="font-size: 11px; font-weight: normal; color: #475569;">عرض أحدث العمليات</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 36px; text-align: center;">#</th>
        <th style="width: 90px;">نوع العملية</th>
        <th>المركبة / العقل والزبون</th>
        <th style="width: 100px;">الفني المسؤول</th>
        <th style="text-align: center; width: 70px;">الوقت</th>
        <th style="text-align: left; width: 100px;">المبلغ (IQD)</th>
      </tr>
    </thead>
    <tbody>
      ${operationsRowsHtml}
    </tbody>
  </table>

  <!-- Section 4: Final Net Profit Figure at the bottom (Requirement 4) -->
  <div class="net-profit-box">
    <div class="net-profit-grid">
      <div>
        <div style="font-size: 14px; font-weight: bold; color: #0f172a;">
          التصفية المالية النهائية لشفت اليوم (${todayDateStr})
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
          إجمالي الإيراد المقبوض: <strong>${formatCurrency(totalRevenueToday)}</strong> — إجمالي الصرفيات والأجور: <strong style="color: #be123c;">${formatCurrency(todayExpensesTotal)}</strong>
        </div>
      </div>
      <div style="text-align: left;">
        <div style="font-size: 11px; color: #64748b; font-weight: 600;">صافي ربح الشفت النهائي:</div>
        <div class="net-figure">${formatCurrency(todayNetProfit)}</div>
      </div>
    </div>
  </div>

  <!-- Signatures -->
  <div class="signatures">
    <div class="sign-block">
      <div><strong>مسؤول صندوق الشفت / المحاسب</strong></div>
      <div class="sign-line">التوقيع والختم</div>
    </div>
    <div class="sign-block">
      <div><strong>إدارة ورشة منتصر</strong></div>
      <div class="sign-line">المصادقة والاعتماد</div>
    </div>
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 250);
    });
  </script>
</body>
</html>
`
    printWindow.document.open()
    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  const inputClass = "px-4 py-3 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:border-rose-500 focus:shadow-[0_0_0_4px_rgba(244,63,94,0.1)]"

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg text-white"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 8px 24px rgba(245,158,11,0.35)' }}
            >
              <Flame size={26} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
                  شغل اليوم · سجل العمل اليومي
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  مباشر · توقيت بغداد
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 flex items-center gap-2">
                <Calendar size={14} className="text-amber-500" />
                <span>{formatFullBaghdadDate()}</span>
                <span>•</span>
                <span>توزيع المهام ومحاسبة الشفت وصافي الأرباح</span>
              </p>
            </div>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          <button
            onClick={handlePrintReport}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
            title="طباعة التقرير الشامل مع تفصيل الصرفيات وصافي الربح"
          >
            <Printer size={16} className="text-slate-500" />
            <span>طباعة تقرير الشفت</span>
          </button>

          {/* Quick Action Button: + صرفية جديدة (Requirement 3) */}
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-all shadow-sm shadow-rose-600/25 cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            <span>صرفية جديدة +</span>
          </button>

          {/* Quick Action Button: + بيع عقل / مبيعات (Requirement 2) */}
          <button
            onClick={() => setIsSaleModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-sm shadow-indigo-600/25 cursor-pointer active:scale-95"
          >
            <ShoppingBag size={16} />
            <span>بيع عقل / مبيعات +</span>
          </button>

          <Link
            href="/inspections"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-all shadow-sm"
          >
            فحص سريع +
          </Link>
          <Link
            href="/visits"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl btn-gradient text-white text-sm font-semibold transition-all shadow-sm"
          >
            الزيارات +
          </Link>
        </div>
      </div>

      {/* Top Metric Cards (Requirements 2) */}
      <div className="space-y-4">
        {/* Tier 1: The 4 Core Financial Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Gross Income */}
          <div className="soft-card p-5 relative overflow-hidden border-2 border-emerald-100 hover:border-emerald-300 transition-all shadow-sm bg-gradient-to-br from-emerald-50/30 via-white to-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                <DollarSign size={13} />
                دخل اليوم المحصل
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                <TrendingUp size={20} />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">إجمالي دخل اليوم المحصل</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-1 font-mono tracking-tight">
                {formatCurrency(totalRevenueToday)}
              </p>
              <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 mt-2 flex-wrap">
                <span>زيارات: {formatCurrency(visitsRevenueToday)}</span>
                <span>•</span>
                <span>فحوصات: {formatCurrency(inspectionsRevenueToday)}</span>
                <span>•</span>
                <span className="font-semibold text-indigo-700">مبيعات: {formatCurrency(directSalesRevenueToday)}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Today's Store & ECU Direct Sales (Requirement 2) */}
          <div className="soft-card p-5 relative overflow-hidden border-2 border-indigo-200 hover:border-indigo-300 transition-all shadow-sm bg-gradient-to-br from-indigo-50/40 via-white to-indigo-50/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 flex items-center gap-1">
                <ShoppingBag size={13} />
                مبيعات الورشة والعقول
              </span>
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                <ShoppingBag size={20} />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">مبيعات اليوم المباشرة</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-indigo-600 mt-1 font-mono tracking-tight">
                {formatCurrency(directSalesRevenueToday)}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                <span className="font-semibold text-indigo-700">
                  {directSalesCount} {directSalesCount === 1 ? 'عقل / قطعة' : directSalesCount === 2 ? 'عقلان / قطعتان' : 'عقول وقطع مباعة'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsSaleModalOpen(true)}
                  className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  + بيع فوري
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Today's Expenses & Wages Card (Requirement 2) */}
          <div className="soft-card p-5 relative overflow-hidden border-2 border-rose-200 hover:border-rose-300 transition-all shadow-sm bg-gradient-to-br from-rose-50/40 via-white to-rose-50/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 flex items-center gap-1">
                <Receipt size={13} />
                صرفيات وأجور الشفت
              </span>
              <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
                <Wallet size={20} />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">صرفيات وأجور اليوم</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 mt-1 font-mono tracking-tight">
                {formatCurrency(todayExpensesTotal)}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                <span className="font-semibold text-rose-700">
                  {todayExpensesCount} {todayExpensesCount === 1 ? 'بند صرفية' : todayExpensesCount === 2 ? 'بندان' : 'بنود صرفيات وأجور'}
                </span>
                {todayWagesTotal > 0 && (
                  <span className="text-[10px] text-slate-400">
                    (أجور: {formatCurrency(todayWagesTotal)})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card 4: Net Profit Card (Requirement 2) */}
          <div className={cn(
            "soft-card p-5 relative overflow-hidden border-2 transition-all shadow-md group",
            todayNetProfit >= 0
              ? "border-teal-300 hover:border-teal-400 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white"
              : "border-rose-300 hover:border-rose-400 bg-gradient-to-br from-rose-500/10 via-orange-500/5 to-white"
          )}>
            <div className="flex items-center justify-between mb-3">
              <span className={cn(
                "text-xs font-bold px-2.5 py-1 rounded-full border flex items-center gap-1",
                todayNetProfit >= 0
                  ? "text-emerald-800 bg-emerald-100/80 border-emerald-300"
                  : "text-rose-800 bg-rose-100/80 border-rose-300"
              )}>
                {todayNetProfit >= 0 ? <TrendingUp size={13} /> : <ArrowDownRight size={13} />}
                <span>صافي أرباح الشفت اليومي</span>
              </span>
              <div className={cn(
                "w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-md",
                todayNetProfit >= 0
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30"
                  : "bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/30"
              )}>
                <Coins size={20} />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">صافي ربح اليوم</p>
              <p className={cn(
                "text-2xl sm:text-3xl font-extrabold mt-1 font-mono tracking-tight",
                todayNetProfit >= 0 ? "text-teal-700" : "text-rose-600"
              )}>
                {formatCurrency(todayNetProfit)}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                <span>(الدخل المحصل - الصرفيات والأجور)</span>
                {totalRevenueToday > 0 && (
                  <span className={cn(
                    "font-bold px-1.5 py-0.5 rounded text-[10px]",
                    todayNetProfit >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  )}>
                    {Math.round((todayNetProfit / totalRevenueToday) * 100)}% هامش ربح
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tier 2: The 3 Operational Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 4: Operations Count */}
          <div className="soft-card p-5 relative overflow-hidden border-2 border-violet-100 hover:border-violet-300 transition-all shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-200">
                عمليات اليوم
              </span>
              <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-600/20">
                <Car size={20} />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">عدد سيارات وعمليات اليوم</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-violet-700 mt-1">
                {totalOperationsCount} <span className="text-base font-normal text-slate-500">عملية</span>
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-2 flex-wrap">
                <span>{totalVisitsCount} زيارة صيانة</span>
                <span>•</span>
                <span>{totalInspectionsCount} فحص سريع</span>
                <span>•</span>
                <span className="font-semibold text-indigo-700">{directSalesCount} مبيعات عقول</span>
              </div>
            </div>
          </div>

          {/* Card 5: Visits Count & Settlement */}
          <div className="soft-card p-5 relative overflow-hidden border-2 border-sky-100 hover:border-sky-300 transition-all shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
                زيارات الصيانة
              </span>
              <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
                <Wrench size={20} />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">سيارات مسلّمة اليوم</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-sky-700 mt-1">
                {deliveredVisitsCount} <span className="text-base font-normal text-slate-500">مسلّمة</span>
              </p>
              <div className="flex flex-col gap-0.5 text-[11px] text-slate-500 mt-2">
                <p>
                  إيراد التسليم: <span className="font-semibold text-sky-800">{formatCurrency(visitsRevenueToday)}</span>
                </p>
                {overnightVisitsCount > 0 && (
                  <p className="text-amber-600 font-semibold">
                    • {overnightVisitsCount} سيارة بايتة قيد العمل
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Card 6: Quick Inspections Count */}
          <div className="soft-card p-5 relative overflow-hidden border-2 border-amber-100 hover:border-amber-300 transition-all shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                الفحوصات السريعة
              </span>
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <Activity size={20} />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">فحوصات كمبيوتر وعقول اليوم</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-amber-700 mt-1">
                {totalInspectionsCount} <span className="text-base font-normal text-slate-500">فحص</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-2">
                رسوم الفحوصات: <span className="font-semibold text-amber-800">{formatCurrency(inspectionsRevenueToday)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Technician Breakdown Section */}
      <div className="soft-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wrench size={20} className="text-amber-500" />
            <h2 className="text-lg font-bold text-slate-800">
              توزيع شغل اليوم على الفنيين
            </h2>
            <span className="text-xs text-slate-400">
              (انقر على اسم الفني لفلترة العمليات)
            </span>
          </div>
          {selectedTech && (
            <button
              onClick={() => setSelectedTech(null)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-100 transition-colors w-fit cursor-pointer"
            >
              <X size={13} />
              إلغاء فلترة الفني ({selectedTech})
            </button>
          )}
        </div>

        {/* Technician Cards / Interactive Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {/* "All" button */}
          <button
            type="button"
            onClick={() => setSelectedTech(null)}
            className={cn(
              'p-3 rounded-2xl border-2 text-right transition-all flex flex-col justify-between cursor-pointer',
              selectedTech === null
                ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/20 scale-[1.02]'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            )}
          >
            <div className="text-xs font-bold">جميع الفنيين</div>
            <div className="mt-2">
              <div className={cn('text-lg font-extrabold', selectedTech === null ? 'text-white' : 'text-slate-800')}>
                {totalOperationsCount} <span className="text-xs font-normal">عملية</span>
              </div>
              <div className={cn('text-[11px] font-mono mt-0.5 truncate', selectedTech === null ? 'text-amber-100' : 'text-emerald-600 font-bold')}>
                {formatCurrency(totalRevenueToday)}
              </div>
            </div>
          </button>

          {/* Each Technician */}
          {technicianStats.map(tech => {
            const isSelected = selectedTech === tech.name
            const hasWork = tech.count > 0

            return (
              <button
                key={tech.name}
                type="button"
                onClick={() => setSelectedTech(isSelected ? null : tech.name)}
                className={cn(
                  'p-3 rounded-2xl border-2 text-right transition-all flex flex-col justify-between cursor-pointer group',
                  isSelected
                    ? 'bg-violet-600 text-white border-violet-700 shadow-md shadow-violet-600/30 scale-[1.02]'
                    : hasWork
                    ? 'bg-white hover:border-amber-400 text-slate-800 border-amber-200/80 shadow-sm'
                    : 'bg-slate-50/70 hover:bg-white text-slate-400 border-slate-100'
                )}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className={cn('text-xs font-bold truncate', isSelected ? 'text-white' : hasWork ? 'text-slate-800' : 'text-slate-400')}>
                    {tech.name}
                  </span>
                  {hasWork && (
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                      isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                    )}>
                      {tech.count}
                    </span>
                  )}
                </div>

                <div className="mt-2">
                  <div className={cn('text-sm font-extrabold', isSelected ? 'text-white' : hasWork ? 'text-slate-800' : 'text-slate-400')}>
                    {tech.count} <span className="text-[11px] font-normal">سيارات</span>
                  </div>
                  <div className={cn(
                    'text-[11px] font-mono mt-0.5 font-bold truncate',
                    isSelected ? 'text-violet-100' : hasWork ? 'text-emerald-600' : 'text-slate-300'
                  )}>
                    {formatCurrency(tech.totalAmount)}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Unified Daily Feed Section */}
      <div className="soft-card p-6 space-y-5">
        {/* Controls: Search, Filter Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span>سجل شفت اليوم الموحد</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {filterKind === 'expense' ? `${filteredExpenses.length} صرفية` : `${filteredOperations.length} عملية`}
              </span>
            </h2>

            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 flex-wrap">
              <button
                onClick={() => setFilterKind('all')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  filterKind === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                الكل ({allOperations.length})
              </button>
              <button
                onClick={() => setFilterKind('visit')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  filterKind === 'visit' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                زيارات صيانة ({totalVisitsCount})
              </button>
              <button
                onClick={() => setFilterKind('inspection')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  filterKind === 'inspection' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                فحوصات سريعة ({totalInspectionsCount})
              </button>
              <button
                onClick={() => setFilterKind('sale')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1',
                  filterKind === 'sale' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-indigo-700'
                )}
              >
                <ShoppingBag size={12} />
                <span>مبيعات العقول والورشة ({directSalesCount})</span>
              </button>
              <button
                onClick={() => setFilterKind('expense')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1',
                  filterKind === 'expense' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-rose-700'
                )}
              >
                <Wallet size={12} />
                <span>صرفيات وأجور ({todayExpensesCount})</span>
              </button>
            </div>
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث: الزبون، السيارة، الفني، الصرفية..."
              className="w-full pr-10 pl-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Alert Banner */}
        {selectedTech && filterKind !== 'expense' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs font-semibold">
            <span>
              عرض عمليات الفني <strong className="font-bold underline">{selectedTech}</strong> فقط ({filteredOperations.length} عملية بإجمالي {formatCurrency(filteredOperations.reduce((s, o) => s + o.amount, 0))})
            </span>
            <button
              onClick={() => setSelectedTech(null)}
              className="text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              عرض الكل <X size={12} />
            </button>
          </div>
        )}

        {/* VIEW 1: Expenses & Wages Tab View */}
        {filterKind === 'expense' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-rose-50/60 p-3.5 rounded-xl border border-rose-100">
              <div className="text-xs text-rose-800 font-semibold flex items-center gap-2">
                <Receipt size={16} className="text-rose-600" />
                <span>جميع الصرفيات التشغيلية والنثريات وأجور اليوم المخصومة من صافي الربح</span>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Plus size={13} />
                + إضافة صرفية
              </button>
            </div>

            {filteredExpenses.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-400 flex items-center justify-center mx-auto border border-rose-100">
                  <Receipt size={28} />
                </div>
                <p className="text-base font-bold text-slate-700">لا توجد صرفيات أو أجور مسجلة لليوم</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  يمكنك تسجيل أي صرفية بنزين، ضيافة، أدوات، أو سلفة فني باستخدام زر "+ صرفية جديدة" بالأعلى.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 bg-slate-50/60">
                      <th className="py-3 px-3 w-14">#</th>
                      <th className="py-3 px-3">التصنيف</th>
                      <th className="py-3 px-3">الوصف والبيان</th>
                      <th className="py-3 px-3">المستلم / الفني</th>
                      <th className="py-3 px-3 font-mono">المبلغ (د.ع)</th>
                      <th className="py-3 px-3">الوقت</th>
                      <th className="py-3 px-3 text-center w-16">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredExpenses.map((exp, idx) => (
                      <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3.5 px-3 font-mono text-xs font-bold text-slate-400">
                          #{idx + 1}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold',
                            exp.isWage ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          )}>
                            {exp.isWage ? <Wrench size={11} /> : <Receipt size={11} />}
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-medium text-slate-800">
                          {exp.description}
                        </td>
                        <td className="py-3.5 px-3">
                          {exp.recipientName ? (
                            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200 font-semibold">
                              🔧 {exp.recipientName}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-rose-600 whitespace-nowrap">
                          - {formatCurrency(exp.amount)}
                        </td>
                        <td className="py-3.5 px-3 text-xs text-slate-400 whitespace-nowrap">
                          {formatTimeBaghdad(exp.created_at)}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {!exp.isWage ? (
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف المصروف"
                            >
                              <Trash2 size={15} />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400" title="يُدار من شاشة الرواتب">أجر</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t border-slate-200 text-sm">
                      <td colSpan={4} className="py-3.5 px-3 text-right text-slate-700">
                        مجموع صرفيات وأجور اليوم:
                      </td>
                      <td className="py-3.5 px-3 font-mono text-rose-600 font-extrabold whitespace-nowrap">
                        - {formatCurrency(todayExpensesTotal)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* VIEW 2: Operations Feed List */
          filteredOperations.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-400 flex items-center justify-center mx-auto border border-amber-100">
                <Flame size={28} />
              </div>
              <p className="text-base font-bold text-slate-700">لا توجد عمليات مطابقة لليوم</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery || selectedTech || filterKind !== 'all'
                  ? 'جرب تغيير معايير البحث أو الفلترة'
                  : 'لم يتم تسجيل أي زيارات أو فحوصات سريعة حتى الآن في شفت اليوم.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 bg-slate-50/60">
                    <th className="py-3 px-3 w-14">#</th>
                    <th className="py-3 px-3">نوع العملية</th>
                    <th className="py-3 px-3">الزبون والمركبة</th>
                    <th className="py-3 px-3">الفني المسؤول</th>
                    <th className="py-3 px-3 font-mono">المبلغ (IQD)</th>
                    <th className="py-3 px-3">الوقت</th>
                    <th className="py-3 px-3 text-left">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredOperations.map((op, idx) => {
                    const isVisit = op.kind === 'visit'
                    const isCarInsp = op.kind === 'inspection_car'
                    const isSale = op.kind === 'sale'

                    return (
                      <tr
                        key={`${op.kind}-${op.id}`}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* # Counter */}
                        <td className="py-3.5 px-3 font-mono text-xs font-bold text-slate-400">
                          #{idx + 1}
                        </td>

                        {/* Operation Type */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap',
                                isSale
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : isVisit
                                  ? 'bg-violet-50 text-violet-700 border border-violet-200'
                                  : isCarInsp
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : 'bg-teal-50 text-teal-700 border border-teal-200'
                              )}
                            >
                              {isSale ? (
                                <ShoppingBag size={13} />
                              ) : isVisit ? (
                                <Car size={13} />
                              ) : isCarInsp ? (
                                <Search size={13} />
                              ) : (
                                <Cpu size={13} />
                              )}
                              {op.kindLabel}
                            </span>
                          </div>
                        </td>

                        {/* Customer & Vehicle */}
                        <td className="py-3.5 px-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800">{op.vehicleOrSubject}</span>
                              {op.licensePlate && (
                                <span className={cn(
                                  "font-mono text-xs px-2 py-0.5 rounded border",
                                  isSale
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                )}>
                                  {op.licensePlate}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                              <span>{op.customerName}</span>
                              {op.customerPhone && (
                                <span className="font-mono text-slate-400" dir="ltr">
                                  {op.customerPhone}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Technician */}
                        <td className="py-3.5 px-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap',
                              op.technicianName !== 'غير محدد'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                            )}
                          >
                            <Wrench size={11} className={op.technicianName !== 'غير محدد' ? 'text-amber-600' : 'text-slate-400'} />
                            {op.technicianName}
                          </span>
                        </td>

                        {/* Amount IQD */}
                        <td className="py-3.5 px-3 font-mono font-bold whitespace-nowrap">
                          {isVisit && (op.rawItem as DailyVisitItem).status !== 'Completed' && (op.rawItem as DailyVisitItem).status !== 'Delivered' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              بايتة (تُحصّل عند التسليم)
                            </span>
                          ) : op.amount > 0 ? (
                            <span className={cn("font-extrabold", isSale ? "text-indigo-600" : "text-emerald-600")}>
                              {formatCurrency(op.amount)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">0 IQD</span>
                          )}
                        </td>

                        {/* Time */}
                        <td className="py-3.5 px-3 text-xs text-slate-500 whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-slate-400" />
                            {op.timeFormatted}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-3 text-left">
                          {isSale ? (
                            <button
                              type="button"
                              onClick={() => printSaleReceipt(op.rawItem as DirectSale)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
                              title="طباعة وصل البيع المباشر"
                            >
                              <Printer size={13} />
                              وصل البيع
                            </button>
                          ) : isVisit ? (
                            <Link
                              href={op.detailsHref!}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors"
                            >
                              فتح الزيارة
                              <ChevronLeft size={13} />
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPreviewInspection(op.rawItem as DailyInspectionItem)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors cursor-pointer"
                            >
                              عرض الفحص
                              <ChevronLeft size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* QUICK EXPENSE MODAL (Requirement 3) */}
      {isExpenseModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setIsExpenseModalOpen(false)}
        >
          <div
            className="soft-card bg-white p-6 max-w-lg w-full space-y-5 max-h-[90vh] overflow-y-auto border-2 border-rose-100 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-sm">
                  <Wallet size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800">
                    تسجيل صرفية جديدة للشفت
                  </h3>
                  <p className="text-xs text-slate-500">خصم فوري من حسابات شفت اليوم وتحديث صافي الأرباح</p>
                </div>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleQuickAddExpense} className="space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  المبلغ (د.ع) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    className={`w-full font-mono text-xl font-bold pr-4 pl-16 py-3 rounded-2xl border-2 border-slate-200 bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:border-rose-500`}
                    placeholder="0"
                    dir="ltr"
                    autoFocus
                    required
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                    IQD
                  </span>
                </div>

                {/* Quick Increment Buttons */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[5000, 10000, 25000, 50000].map(inc => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => setExpenseAmount(prev => String((Number(prev) || 0) + inc))}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      +{inc.toLocaleString('en-US')}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExpenseAmount('')}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    تصفير
                  </button>
                </div>

                {expenseAmount && Number(expenseAmount) > 0 && (
                  <p className="text-xs font-bold text-rose-600 mt-1.5">
                    سيتم خصم: {formatCurrency(Number(expenseAmount))} من صافي الربح
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  التصنيف <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setExpenseCategory(cat)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border',
                        expenseCategory === cat
                          ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  بيان الصرفية / السبب <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={expenseDescription}
                  onChange={e => setExpenseDescription(e.target.value)}
                  className={`w-full ${inputClass}`}
                  placeholder="مثال: بنزين للمولدة، ضيافة شاي، تبديل فيوزات..."
                  required
                />
              </div>

              {/* Worker / Recipient */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    الفني المسؤول / المستلم
                  </label>
                  <select
                    value={expenseWorker}
                    onChange={e => setExpenseWorker(e.target.value)}
                    className={`w-full ${inputClass} py-2.5 text-xs font-semibold`}
                  >
                    <option value="عام / الورشة">عام (ورشة منتصر)</option>
                    {TECHNICIANS.map(tech => (
                      <option key={tech} value={tech}>
                        🔧 الفني: {tech}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ملاحظة إضافية (اختياري)
                  </label>
                  <input
                    type="text"
                    value={expenseNote}
                    onChange={e => setExpenseNote(e.target.value)}
                    className={`w-full ${inputClass} py-2.5 text-xs`}
                    placeholder="رقم وصل / تفصيل..."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  disabled={isSubmittingExpense}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingExpense ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      حفظ الصرفية وتحديث الشفت
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Inspection Preview Modal */}
      {previewInspection && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setPreviewInspection(null)}
        >
          <div
            className="soft-card bg-white p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                  {previewInspection.type === 'car' ? <Car size={18} /> : <Cpu size={18} />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800">
                    {previewInspection.type === 'car' ? 'تفاصيل فحص السيارة' : 'تفاصيل فحص عقل ECU'}
                  </h3>
                  <p className="text-xs text-slate-400">سجل الفحوصات السريعة</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewInspection(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">اسم الزبون:</span>
                  <span className="font-bold text-slate-800">{previewInspection.customer_name}</span>
                </div>
                {previewInspection.phone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-xs">الهاتف:</span>
                    <span className="font-mono text-slate-700" dir="ltr">{previewInspection.phone}</span>
                  </div>
                )}
                {previewInspection.subject && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-xs">نوع الفحص / الموديل:</span>
                    <span className="font-semibold text-slate-800">{previewInspection.subject}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">الفني المسؤول:</span>
                  <span className="font-bold text-amber-700">🔧 {previewInspection.technician_name || 'غير محدد'}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500 text-xs">أجور الفحص:</span>
                  <span className="font-mono font-bold text-emerald-600">{formatCurrency(previewInspection.inspection_fee)}</span>
                </div>
              </div>

              {previewInspection.fault_codes && (
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
                  <div className="text-xs font-bold text-rose-700 mb-1 flex items-center gap-1">
                    <AlertCircle size={13} />
                    رموز وتفاصيل الأعطال:
                  </div>
                  <pre className="text-xs text-slate-800 font-mono whitespace-pre-wrap">
                    {previewInspection.fault_codes}
                  </pre>
                </div>
              )}

              {previewInspection.notes && (
                <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600">
                  <span className="font-bold block mb-0.5">ملاحظات:</span>
                  {previewInspection.notes}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-between">
              <Link
                href="/inspections"
                className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1"
              >
                فتح سجل الفحوصات السريعة <ExternalLink size={12} />
              </Link>
              <button
                type="button"
                onClick={() => setPreviewInspection(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAST DIRECT SALE MODAL (شغل اليوم) */}
      {isSaleModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setIsSaleModalOpen(false)}
        >
          <div
            className="soft-card bg-white p-6 max-w-lg w-full space-y-5 max-h-[90vh] overflow-y-auto border-2 border-indigo-100 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
                  <ShoppingBag size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800">
                    تسجيل بيع عقل / مبيعات الورشة
                  </h3>
                  <p className="text-xs text-slate-500">إضافة فورية لدخل شفت اليوم وتحديث حصة الفني</p>
                </div>
              </div>
              <button
                onClick={() => setIsSaleModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={e => handleQuickAddSale(e, false)} className="space-y-4">
              {/* Barcode Scanner Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ضرب باركود العقل (ECU Barcode) - اختياري
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={saleBarcodeInput}
                    onChange={e => setSaleBarcodeInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        lookupSaleBarcode(saleBarcodeInput)
                      }
                    }}
                    onBlur={() => {
                      if (saleBarcodeInput.trim()) lookupSaleBarcode(saleBarcodeInput)
                    }}
                    placeholder="وجّه الماسح أو اكتب الباركود واضغط Enter..."
                    className="w-full font-mono text-sm pr-10 pl-24 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    dir="ltr"
                  />
                  <Scan size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => lookupSaleBarcode(saleBarcodeInput)}
                    disabled={isSaleSearchingEcu || !saleBarcodeInput.trim()}
                    className="absolute left-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                  >
                    {isSaleSearchingEcu ? <RefreshCw size={12} className="animate-spin" /> : 'فحص'}
                  </button>
                </div>
              </div>

              {/* Matched ECU Preview */}
              {saleMatchedEcu && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/80 border-2 border-indigo-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-indigo-900 flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-indigo-600" />
                      تم العثور على العقل في المخزون
                    </span>
                    <span className={cn(
                      'px-2 py-0.5 rounded-md font-bold text-[10px]',
                      saleMatchedEcu.status === 'sold'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    )}>
                      {saleMatchedEcu.status === 'sold' ? '⚠️ مسجل كمباع' : 'متوفر للبيع'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1 border-t border-indigo-200/60">
                    <div>
                      <span className="text-slate-400 block text-[10px]">الشركة المصنعة:</span>
                      <span className="font-bold text-slate-800">{saleMatchedEcu.manufacturer || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">عائلة الوحدة / الفئة:</span>
                      <span className="font-bold text-slate-800">{saleMatchedEcu.ecu_family || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">كود السيارة:</span>
                      <span className="font-bold text-slate-800">{saleMatchedEcu.vehicle_model_code || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">رقم السوفتوير:</span>
                      <span className="font-bold text-slate-800">{saleMatchedEcu.software_id || '—'}</span>
                    </div>
                  </div>
                  {saleMatchedEcu.shelf_location && (
                    <div className="text-[11px] text-indigo-700 font-semibold bg-white/70 px-2 py-1 rounded-lg">
                      موقع الرف في الورشة: <strong>{saleMatchedEcu.shelf_location}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Preset Chips */}
              <div>
                <span className="block text-xs font-bold text-slate-600 mb-1.5">
                  أو اختر صنف سريع بدون باركود (فيشة، ملف، برمجة):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SALE_ITEMS.map(ci => (
                    <button
                      key={ci.label}
                      type="button"
                      onClick={() => {
                        setSaleMatchedEcu(null)
                        setSaleBarcodeInput('')
                        setSaleItemName(ci.label)
                        setSalePrice(String(ci.price))
                      }}
                      className={cn(
                        'px-2.5 py-1 rounded-xl text-xs font-semibold transition-all border cursor-pointer',
                        saleItemName === ci.label
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                      )}
                    >
                      <span>{ci.icon} {ci.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Item Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم الصنف المباع <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={saleItemName}
                  onChange={e => setSaleItemName(e.target.value)}
                  placeholder="مثال: عقل سنتافي SIM2K-241، فيشة كمبيوتر، إلخ..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  required
                />
              </div>

              {/* Price IQD with quick increment chips */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  سعر البيع (د.ع) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={salePrice ? Number(salePrice).toLocaleString('en-US') : ''}
                    onChange={e => {
                      const raw = parseArabicNumerals(e.target.value).replace(/,/g, '').trim()
                      setSalePrice(raw)
                    }}
                    placeholder="0"
                    dir="ltr"
                    className="w-full font-mono text-xl font-bold pr-4 pl-16 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    required
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                    IQD
                  </span>
                </div>

                {/* Quick Increments */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[10000, 25000, 50000, 100000, 250000].map(inc => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => {
                        const cur = Number(salePrice) || 0
                        setSalePrice(String(cur + inc))
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
                    >
                      +{inc.toLocaleString('en-US')}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSalePrice('')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    مسح
                  </button>
                </div>
              </div>

              {/* Technician Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الفني المسؤول عن البيع
                </label>
                <select
                  value={saleTech}
                  onChange={e => setSaleTech(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  {TECHNICIANS.map(t => (
                    <option key={t} value={t}>
                      🔧 {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buyer Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    اسم المشتري (اختياري)
                  </label>
                  <input
                    type="text"
                    value={saleBuyerName}
                    onChange={e => setSaleBuyerName(e.target.value)}
                    placeholder="زبون نقدي / الورشة"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    رقم الهاتف (اختياري)
                  </label>
                  <input
                    type="tel"
                    value={saleBuyerPhone}
                    onChange={e => setSaleBuyerPhone(parseArabicNumerals(e.target.value))}
                    placeholder="07XXXXXXXX"
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ملاحظات إضافية (اختياري)
                </label>
                <input
                  type="text"
                  value={saleNotes}
                  onChange={e => setSaleNotes(e.target.value)}
                  placeholder="رقم الفيشة، تفاصيل الضمان، كود الفحص، إلخ..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsSaleModalOpen(false)}
                  disabled={isSubmittingSale}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={e => handleQuickAddSale(e, true)}
                  disabled={isSubmittingSale}
                  className="px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-200 disabled:opacity-50"
                >
                  <Printer size={14} />
                  <span>حفظ وطباعة الوصل 🖨️</span>
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSale}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <ShoppingBag size={14} />
                  <span>{isSubmittingSale ? 'جاري التسجيل...' : 'حفظ البيع فقط ✅'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
