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
  ExternalLink,
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

  // Filter customers with search
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

  // Select all visible
  const handleSelectAll = () => {
    const next: Record<string, boolean> = { ...selectedIds }
    const allSelected = filteredCustomers.every(c => next[c.id])
    if (allSelected) {
      filteredCustomers.forEach(c => {
        delete next[c.id]
      })
    } else {
      filteredCustomers.forEach(c => {
        if (c.phone) next[c.id] = true
      })
    }
    setSelectedIds(next)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId)
    const tpl = TEMPLATES.find(t => t.id === templateId)
    if (tpl) {
      setMessageText(tpl.text)
    }
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
    'px-4 py-2.5 rounded-2xl text-sm transition-all border-2 border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <MessageSquare size={30} className="text-emerald-500" />
            التسويق عبر واتساب
          </h1>
          <p className="text-slate-500 mt-1">
            إرسال عروض وتنبيهات مخصصة لزبائن ورشة منتصر مباشرة بنقرة واحدة
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} />
            تم الإرسال: {sentCount}
          </div>
          <div className="px-4 py-2 bg-violet-50 border border-violet-100 rounded-2xl text-violet-700 text-sm font-semibold flex items-center gap-2">
            <Users size={16} />
            المحددون: {selectedCount}
          </div>
        </div>
      </div>

      {/* Message Composer & Template Selector */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 soft-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Sparkles size={18} className="text-violet-500" />
              صياغة الرسالة التسويقية
            </h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium">النموذج:</label>
              <select
                value={selectedTemplate}
                onChange={e => handleTemplateChange(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-violet-400"
              >
                {TEMPLATES.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                يمكنك استخدام المتغيرات التلقائية لتخصيص الرسالة لكل عميل:
              </span>
              <button
                type="button"
                onClick={() => insertTag('{اسم_الزبون}')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100 transition-colors cursor-pointer"
              >
                <Tag size={12} />
                + إضافة {`{اسم_الزبون}`}
              </button>
            </div>

            <textarea
              rows={4}
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder="اكتب نص الرسالة هنا..."
              className="w-full p-4 rounded-2xl text-sm border-2 border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)] resize-none transition-all leading-relaxed"
            />
          </div>
        </div>

        {/* Message Live Preview */}
        <div className="soft-card p-6 flex flex-col justify-between space-y-4 bg-gradient-to-br from-slate-50 to-emerald-50/30 border border-emerald-100/50">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              معاينة الرسالة (مثال حي)
            </h3>
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
              {messageText.replace(/\{اسم_الزبون\}/g, 'أحمد علي')}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>عدد الحروف: {messageText.length}</span>
            <span>المرسل: ورشة منتصر</span>
          </div>
        </div>
      </div>

      {/* Customer Selection & Dispatch Queue */}
      <div className="soft-card overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <Users size={20} className="text-violet-500" />
              قائمة العملاء المستهدفين
              <span className="text-xs font-normal text-slate-400">
                ({filteredCustomers.length} عميل)
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative min-w-56">
              <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث بالاسم، الهاتف، أو السيارة..."
                className={`w-full pr-9 pl-4 text-xs ${inputClass}`}
              />
            </div>
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-4 py-2 rounded-2xl text-xs font-bold border-2 border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              {filteredCustomers.length > 0 &&
              filteredCustomers.every(c => selectedIds[c.id]) ? (
                <>
                  <CheckSquare size={14} className="text-violet-600" />
                  إلغاء تحديد الكل
                </>
              ) : (
                <>
                  <Square size={14} className="text-slate-400" />
                  تحديد الكل
                </>
              )}
            </button>
          </div>
        </div>

        {/* Customer Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
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
                          تم الإرسال ({sentTime})
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
      </div>
    </div>
  )
}
