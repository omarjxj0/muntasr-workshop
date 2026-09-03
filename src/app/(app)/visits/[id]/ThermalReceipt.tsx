import { formatDate, formatCurrency } from '@/lib/utils'

interface ThermalReceiptProps {
  visit: any
  vehicle: any
  customer: any
  parts: any[]
}

export default function ThermalReceipt({ visit, vehicle, customer, parts }: ThermalReceiptProps) {
  if (!visit || !vehicle) return null

  const grandTotal = (visit.total_amount || 0) + (visit.labor_cost || 0)

  return (
    <div id="thermal-receipt" className="hidden print:block w-[105mm] text-black bg-white mx-auto text-sm font-sans" dir="rtl">
      {/* Header */}
      <div className="text-center pb-3">
        <div className="flex justify-center mb-2">
          <img
            src="/logo.jpg"
            alt="Victor ECU"
            className="h-16 w-auto object-contain"
            style={{ maxHeight: '64px' }}
          />
        </div>
        <h1 className="font-bold text-lg leading-tight">ورشة منتصر لكهرباء السيارات</h1>
        <p className="text-xs mt-0.5">هاتف: 07708981636</p>
      </div>

      <div className="border-t border-dashed border-gray-400 my-2"></div>

      {/* Info Section */}
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span>التاريخ:</span>
          <span>{formatDate(visit.created_at || visit.entry_date)}</span>
        </div>
        {customer && (
          <>
            <div className="flex justify-between">
              <span>الزبون:</span>
              <span>{customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span>الهاتف:</span>
              <span className="font-mono">{customer.phone}</span>
            </div>
          </>
        )}
        <div className="flex justify-between">
          <span>المركبة:</span>
          <span>{vehicle.make_and_model}</span>
        </div>
        <div className="flex justify-between">
          <span>الرقم:</span>
          <span className="font-mono">{vehicle.license_plate}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-400 my-2"></div>

      {/* Complaints & Diagnosis */}
      <div className="space-y-2 text-xs">
        <div>
          <span className="font-bold">العطل:</span>
          <p className="mt-1">{visit.complaint || 'لا يوجد'}</p>
        </div>
        {visit.diagnosis && (
          <div>
            <span className="font-bold">التصليح:</span>
            <p className="mt-1">{visit.diagnosis}</p>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-gray-400 my-2"></div>

      {/* Parts Table */}
      <div className="text-xs">
        <div className="font-bold mb-1">المواد المضافة:</div>
        {parts.length === 0 ? (
          <p className="text-gray-500">لا توجد مواد</p>
        ) : (
          <table className="w-full mt-1">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-right font-normal pb-1">المادة</th>
                <th className="text-center font-normal pb-1 w-10">العدد</th>
                <th className="text-left font-normal pb-1 w-16">السعر</th>
              </tr>
            </thead>
            <tbody>
              {parts.map(p => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-1 pr-1">{p.ecus?.name || 'مادة غير معروفة'}</td>
                  <td className="py-1 text-center font-mono">{p.quantity}</td>
                  <td className="py-1 pl-1 text-left font-mono">{formatCurrency(p.selling_price_at_time * p.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="border-t border-dashed border-gray-400 my-2"></div>

      {/* Totals */}
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span>سعر المواد:</span>
          <span className="font-mono">{formatCurrency(visit.total_amount || 0)}</span>
        </div>
        <div className="flex justify-between">
          <span>أجور العمل:</span>
          <span className="font-mono">{formatCurrency(visit.labor_cost || 0)}</span>
        </div>
        <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t border-gray-200">
          <span>السعر الكلي:</span>
          <span className="font-mono">{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-400 my-3"></div>

      {/* Footer */}
      <div className="text-center text-xs pb-4">
        <p className="font-bold">شكراً لزيارتكم</p>
      </div>
    </div>
  )
}
