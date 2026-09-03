'use client'

import { useState, useMemo } from 'react'
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Users,
  Search,
  CheckSquare,
  Square,
  Sparkles,
  Phone,
  Car,
  Tag,
  Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface CustomerWithVehicles {
  id: string
  name: string
  phone: string
  created_at: string
  vehicles?: { id: string; make_and_model: string; license_plate: string }[]
}

interface Props {
  customers: CustomerWithVehicles[]
}

const TEMPLATES = [
  {
    id: 'maintenance',
    title: '🔧 عروض الصيانة الدورية',
    text: 'مرحباً {اسم_الزبون}، يسعدنا في ورشة منتصر لكهرباء السيارات تقديم فحص شامل للكهرباء والحساسات لسيارتك بخصم خاص 20% هذا الأسبوع. تفضل بزيارتنا ونتشرف بخدمتك!',
  },
  {
    id: 'ecu_discount',
    title: '⚡ خصم فحص وبرمجة العقول',
    text: 'عزيزي {اسم_الزبون}، هل تواجه مشاكل في تشغيل أو عزم السيارة؟ استفد الآن من فحص كمبيوتر وبرمجة العقول وحساسات المحرك بأحدث الأجهزة لدى ورشة منتصر.',
  },
  {
    id: 'eid',
    title: '🎉 تهنئة بالمناسبات والأعياد',
    text: 'مرحباً {اسم_الزبون}، ورشة منتصر تهنئكم بحلول المناسبة السعيدة، ونتمنى لكم ولعائلتكم الكريمة دوام الصحة والسلامة والبركة في قيادتكم.',
  },
  {
    id: 'followup',
    title: '🚗 تذكير ومتابعة دورية',
    text: 'مرحباً {اسم_الزبون}، نود الاطمئنان على أداء سيارتك بعد زيارتك الأخيرة لورشة منتصر. يسعدنا دائماً تقديم المشورة والفحص المجاني لضمان سلامتك.',
  },
]

function formatWhatsAppPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = '964' + cleaned.slice(1)
  } else if (!cleaned.startsWith('964')) {
    cleaned = '964' + cleaned
  }
  return cleaned
}

export default function MarketingClient({ customers }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id)
  const [messageText, setMessageText] = useState(TEMPLATES[0].text)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [sentMap, setSentMap] = useState<Record<string, string>>({})

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      const matchesName = c.name?.toLowerCase().includes(q)
      const matchesPhone = c.phone?.includes(q)
      const matchesVehicle = c.vehicles?.some(v => v.make_and_model?.toLowerCase().includes(q))
      return matchesName || matchesPhone || matchesVehicle
    })
  }, [customers, search])

  const selectedCount = useMemo(() => {
    return Object.values(selectedIds).filter(Boolean).length
  }, [selectedIds])

  const sentCount = useMemo(() => {
    return Object.keys(sentMap).length
  }, [sentMap])

  const handleSelectAll = () => {
    const next: Record<string, boolean> = { ...selectedIds }
    const allSelected = filteredCustomers.every(c => next[c.id])
    if (allSelected) {
      filteredCustomers.forEach(c => { delete next[c.id] })
    } else {
      filteredCustomers.forEach(c => { if (c.phone) next[c.id] = true })
    }
    setSelectedIds(next)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId)
    const tpl = TEMPLATES.find(t => t.id === templateId)
    if (tpl) setMessageText(tpl.text)
  }

  const insertTag = (tag: string) => {
    setMessageText(prev => prev + ' ' + tag + ' ')
  }

  const handleSendToCustomer = (customer: CustomerWithVehicles) => {
    if (!customer.phone) {
      toast.error('لا يوجد رقم هاتف للزبون')
      return
    }
    const formattedPhone = formatWhatsAppPhone(customer.phone)
    const personalized = messageText.replace(/\{اسم_الزبون\}/g, customer.name || 'عزيزي الزبون')
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(personalized)}`
    window.open(url, '_blank')
    const timeStr = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })
    setSentMap(prev => ({ ...prev, [customer.id]: timeStr }))
    toast.success(`تم فتح المحادثة للزبون: ${customer.name}`, { icon: '📱' })
  }

  const inputClass =
    'px-3 py-2 rounded-xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare size={24} className="text-emerald-500 shrink-0" />
            التسويق عبر واتساب
          </h1>
          <p className="text-slate-500 mt-0.5 text-xs sm:text-sm">
            إرسال عروض وتنبيهات مخصصة لزبائن ورشة منتصر مباشرة بنقرة واحدة
          </p>
        </div>
        {/* Stats pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            تم الإرسال: {sentCount}
          </div>
          <div className="px-3 py-1.5 bg-violet-50 border border-violet-100 rounded-xl text-violet-700 text-xs font-semibold flex items-center gap-1.5">
            <Users size={14} />
            المحددون: {selectedCount}
          </div>
        </div>
      </div>

      {/* Message Composer & Preview */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Composer */}
        <div className="lg:col-span-2 soft-card p-4 sm:p-6 space-y-4">
          {/* Template selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Sparkles size={16} className="text-violet-500" />
              صياغة الرسالة التسويقية
            </h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium shrink-0">النموذج:</label>
              <select
                value={selectedTemplate}
                onChange={e => handleTemplateChange(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400"
              >
                {TEMPLATES.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Message input */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs text-slate-400">
                استخدم المتغيرات لتخصيص الرسالة:
              </span>
              <button
                type="button"
                onClick={() => insertTag('{اسم_الزبون}')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Tag size={12} />
                + {`{اسم_الزبون}`}
              </button>
            </div>
            <textarea
              rows={4}
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder="اكتب نص الرسالة هنا..."
              className="w-full p-3 sm:p-4 rounded-2xl text-sm border-2 border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)] resize-none transition-all leading-relaxed"
            />
          </div>
        </div>

        {/* Live Preview */}
        <div className="soft-card p-4 sm:p-6 flex flex-col justify-between space-y-4 bg-gradient-to-br from-slate-50 to-emerald-50/30 border border-emerald-100/50">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              معاينة الرسالة
            </h3>
            <div className="p-3 rounded-xl bg-white border border-slate-100 shadow-sm text-slate-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
              {messageText.replace(/\{اسم_الزبون\}/g, 'أحمد علي')}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>عدد الحروف: {messageText.length}</span>
            <span>المرسل: ورشة منتصر</span>
          </div>
        </div>
      </div>

      {/* Customer List */}
      <div className="soft-card overflow-hidden p-4 sm:p-6 space-y-4">
        {/* List header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <Users size={18} className="text-violet-500" />
            قائمة العملاء المستهدفين
            <span className="text-xs font-normal text-slate-400">
              ({filteredCustomers.length} عميل)
            </span>
          </h2>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث بالاسم أو الهاتف..."
                className={`w-full pr-8 text-xs ${inputClass}`}
              />
            </div>
            {/* Select all */}
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-3 py-2 rounded-xl text-xs font-bold border-2 border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              {filteredCustomers.length > 0 && filteredCustomers.every(c => selectedIds[c.id]) ? (
                <>
                  <CheckSquare size={13} className="text-violet-600" />
                  <span className="hidden sm:inline">إلغاء تحديد الكل</span>
                </>
              ) : (
                <>
                  <Square size={13} className="text-slate-400" />
                  <span className="hidden sm:inline">تحديد الكل</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Desktop Table ── */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 bg-slate-50/70 text-xs">
                <th className="w-12 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredCustomers.length > 0 &&
                      filteredCustomers.every(c => selectedIds[c.id])
                    }
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
                  />
                </th>
                <th className="text-right px-4 py-3.5 font-semibold">الزبون</th>
                <th className="text-right px-4 py-3.5 font-semibold">رقم الهاتف</th>
                <th className="text-right px-4 py-3.5 font-semibold">المركبات</th>
                <th className="text-center px-4 py-3.5 font-semibold">حالة الإرسال</th>
                <th className="text-left px-4 py-3.5 font-semibold">إجراء الإرسال</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredCustomers.map(customer => {
                const isSelected = !!selectedIds[customer.id]
                const sentTime = sentMap[customer.id]
                return (
                  <tr
                    key={customer.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-violet-50/40' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(customer.id)}
                        className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{customer.name}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Phone size={12} className="text-slate-400" />
                        {customer.phone || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {customer.vehicles && customer.vehicles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {customer.vehicles.map(v => (
                            <span
                              key={v.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              <Car size={11} className="text-violet-500" />
                              {v.make_and_model} ({v.license_plate})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {sentTime ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          تم ({sentTime})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          <Clock size={12} />
                          بانتظار الإرسال
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleSendToCustomer(customer)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#25D366] hover:bg-[#20bd5a] text-white transition-all shadow-sm hover:shadow cursor-pointer"
                      >
                        <Send size={12} />
                        إرسال واتساب
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!filteredCustomers.length && (
            <div className="py-12 text-center text-slate-400 text-sm">
              لا يوجد عملاء مطابقون للبحث
            </div>
          )}
        </div>

        {/* ── Mobile Cards ── */}
        <div className="md:hidden space-y-3">
          {filteredCustomers.length === 0 && (
            <div className="py-10 text-center text-slate-400 text-sm">
              لا يوجد عملاء مطابقون للبحث
            </div>
          )}
          {filteredCustomers.map(customer => {
            const isSelected = !!selectedIds[customer.id]
            const sentTime = sentMap[customer.id]
            return (
              <div
                key={customer.id}
                onClick={() => toggleSelect(customer.id)}
                className={`rounded-2xl border-2 p-4 space-y-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-violet-400 bg-violet-50/40'
                    : 'border-slate-100 bg-white'
                }`}
              >
                {/* Top: checkbox + name + status */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(customer.id)}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 mt-0.5 rounded text-violet-600 focus:ring-violet-500 cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm">{customer.name}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                      <Phone size={11} className="text-slate-400" />
                      {customer.phone || '—'}
                    </p>
                  </div>
                  {/* Sent status badge */}
                  {sentTime ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      <CheckCircle2 size={11} />
                      تم
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 shrink-0">
                      <Clock size={11} />
                      لم يُرسل
                    </span>
                  )}
                </div>

                {/* Vehicles */}
                {customer.vehicles && customer.vehicles.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {customer.vehicles.map(v => (
                      <span
                        key={v.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] border border-slate-200"
                      >
                        <Car size={10} className="text-violet-500" />
                        {v.make_and_model}
                      </span>
                    ))}
                  </div>
                )}

                {/* Send button */}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    handleSendToCustomer(customer)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold bg-[#25D366] hover:bg-[#20bd5a] text-white transition-all shadow-sm cursor-pointer"
                >
                  <Send size={14} />
                  إرسال واتساب
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
