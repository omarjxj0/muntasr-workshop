import { formatCurrency, formatTimeBaghdad, formatDate } from './utils'
import type { DirectSale } from './types'

export interface SaleReceiptData {
  sequenceNumber?: number | string
  id: string
  itemName?: string
  item_name?: string
  barcode?: string | null
  sellingPrice?: number
  selling_price?: number | string
  customerName?: string | null
  customer_name?: string | null
  phone?: string | null
  technicianName?: string | null
  technician_name?: string | null
  notes?: string | null
  createdAt?: string
  created_at?: string
}

export function printSaleReceipt(sale: SaleReceiptData | DirectSale) {
  const printWindow = window.open('', '_blank', 'width=800,height=900')
  if (!printWindow) {
    window.print()
    return
  }

  const isDirectSale = 'item_name' in sale
  const id = sale.id
  const seqNumber = (sale as any).sequenceNumber
  const itemName = (isDirectSale ? sale.item_name : (sale as SaleReceiptData).itemName) || 'صنف غير محدد'
  const barcode = (isDirectSale ? sale.barcode : (sale as SaleReceiptData).barcode) || null
  const priceNum = isDirectSale ? Number(sale.selling_price) || 0 : ((sale as SaleReceiptData).sellingPrice || 0)
  const custName = isDirectSale ? sale.customer_name : (sale as SaleReceiptData).customerName
  const phone = isDirectSale ? sale.phone : (sale as SaleReceiptData).phone
  const techName = isDirectSale ? sale.technician_name : (sale as SaleReceiptData).technicianName
  const notes = isDirectSale ? sale.notes : (sale as SaleReceiptData).notes
  const createdAt = (isDirectSale ? sale.created_at : (sale as SaleReceiptData).createdAt) || new Date().toISOString()

  const seqStr = seqNumber != null ? `#${seqNumber}` : `#${id.slice(0, 8)}`
  const formattedPrice = formatCurrency(priceNum)
  const timeStr = formatTimeBaghdad(createdAt)
  const dateStr = formatDate(createdAt)

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>وصل بيع مباشر ${seqStr} · ورشة منتصر</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      background: #fff;
      color: #0f172a;
      padding: 32px 36px;
      direction: rtl;
      font-size: 13px;
      line-height: 1.5;
    }
    .receipt-container {
      max-width: 640px;
      margin: 0 auto;
      border: 2px dashed #cbd5e1;
      border-radius: 18px;
      padding: 28px 32px;
      position: relative;
      background: #fafafa;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .workshop-brand h1 {
      font-size: 20px;
      font-weight: 900;
      color: #1e1b4b;
      margin-bottom: 4px;
    }
    .workshop-brand p {
      font-size: 11px;
      color: #64748b;
    }
    .receipt-badge {
      background: #4f46e5;
      color: #fff;
      padding: 6px 14px;
      border-radius: 12px;
      font-weight: 800;
      font-size: 13px;
      text-align: center;
    }
    .seq-number {
      font-family: 'JetBrains Mono', monospace;
      font-size: 16px;
      display: block;
      margin-top: 2px;
      letter-spacing: 0.5px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 20px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 10.5px;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .meta-value {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
    }
    .meta-value.mono {
      font-family: 'JetBrains Mono', monospace;
      direction: ltr;
      text-align: right;
    }
    .item-box {
      background: #f8fafc;
      border: 2px solid #e0e7ff;
      border-radius: 14px;
      padding: 16px 20px;
      margin-bottom: 20px;
    }
    .item-header {
      font-size: 11px;
      color: #4f46e5;
      font-weight: 800;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .item-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 6px;
    }
    .item-barcode {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      background: #ede9fe;
      color: #5b21b6;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .price-box {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      border-radius: 14px;
      padding: 16px 22px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
    }
    .price-label {
      font-size: 13px;
      font-weight: 700;
    }
    .price-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .notes-box {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 20px;
      font-size: 11.5px;
      color: #92400e;
    }
    .notes-box strong {
      font-weight: 700;
      display: block;
      margin-bottom: 2px;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid #e2e8f0;
    }
    .sign-col {
      text-align: center;
    }
    .sign-col span {
      display: block;
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 34px;
    }
    .sign-line {
      border-bottom: 1.5px dashed #94a3b8;
      width: 70%;
      margin: 0 auto;
    }
    .footer {
      text-align: center;
      margin-top: 22px;
      font-size: 10px;
      color: #94a3b8;
    }
    @media print {
      body { padding: 0; background: #fff; }
      .receipt-container { border: 1px solid #cbd5e1; background: #fff; box-shadow: none; max-width: 100%; padding: 20px; }
      @page { size: auto; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="workshop-brand">
        <h1>ورشة منتصر</h1>
        <p>لكهرباء وبرمجة السيارات الحديثة وفحص العقول (ECU)</p>
      </div>
      <div class="receipt-badge">
        وصل بيع مباشر
        <span class="seq-number">${seqStr}</span>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">التاريخ والوقت (شفت بغداد)</span>
        <span class="meta-value">${dateStr} · ${timeStr}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">الفني المسؤول</span>
        <span class="meta-value">🔧 ${techName || 'عام / الورشة'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">اسم المشتري / الزبون</span>
        <span class="meta-value">${custName || 'زبون مباشر (نقدي)'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">رقم الهاتف</span>
        <span class="meta-value mono">${phone || '—'}</span>
      </div>
    </div>

    <div class="item-box">
      <div class="item-header">تفاصيل المادة المباعة</div>
      <div class="item-title">${itemName}</div>
      ${barcode ? `<div class="item-barcode">باركود: ${barcode}</div>` : ''}
    </div>

    <div class="price-box">
      <span class="price-label">المبلغ الإجمالي المستلم (نقداً):</span>
      <span class="price-value">${formattedPrice}</span>
    </div>

    ${notes ? `
    <div class="notes-box">
      <strong>ملاحظات وشروط الضمان:</strong>
      ${notes}
    </div>
    ` : `
    <div class="notes-box">
      <strong>ملاحظة:</strong>
      تم فحص القطعة وتسليمها بحالة سليمة للزبون. يرجى الاحتفاظ بالوصل لأي استفسار.
    </div>
    `}

    <div class="signatures">
      <div class="sign-col">
        <span>توقيع الفني / البائع</span>
        <div class="sign-line"></div>
      </div>
      <div class="sign-col">
        <span>توقيع واستلام الزبون</span>
        <div class="sign-line"></div>
      </div>
    </div>

    <div class="footer">
      ورشة منتصر · نظام الإدارة المالي والمخزني · تاريخ الطباعة: ${new Date().toLocaleDateString('ar-IQ')}
    </div>
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 250);
    });
  </script>
</body>
</html>`

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
