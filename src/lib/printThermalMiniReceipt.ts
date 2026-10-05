/**
 * printThermalMiniReceipt.ts
 * ─────────────────────────────────────────────────────────────
 * Shared utility for printing 50mm thermal mini-receipts (57mm roll / 50mm printable)
 * Used by: Quick Inspections, Visit Delivery, Direct Sales
 */

import { formatCurrency } from './utils'

// ── Receipt Types ────────────────────────────────────────────

export interface InspectionThermalData {
  mode: 'inspection'
  sequenceNumber?: number | string
  createdAt: string
  customerName: string
  phone?: string | null
  /** car_info or ecu_info depending on inspection type */
  subjectInfo: string
  technicianName?: string | null
  faultCodes?: string | null
  fee: number
}

export interface VisitThermalData {
  mode: 'visit'
  sequenceNumber?: number | string
  createdAt: string
  customerName?: string | null
  phone?: string | null
  vehicleInfo: string
  technicianName?: string | null
  faultCodes?: string | null
  laborCost: number
}

export interface SaleThermalData {
  mode: 'sale'
  sequenceNumber?: number | string
  createdAt: string
  customerName?: string | null
  phone?: string | null
  itemName: string
  technicianName?: string | null
  notes?: string | null
  totalAmount: number
}

export type ThermalReceiptData = InspectionThermalData | VisitThermalData | SaleThermalData

// ── Helpers ──────────────────────────────────────────────────

function getBaghdadDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    const datePart = new Intl.DateTimeFormat('ar-IQ', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d)
    const timePart = new Intl.DateTimeFormat('ar-IQ', {
      timeZone: 'Asia/Baghdad',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d)
    return datePart + ' \u00b7 ' + timePart
  } catch {
    return iso
  }
}

function escHtml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Main Print Function ──────────────────────────────────────

export function printThermalMiniReceipt(data: ThermalReceiptData): void {
  const win = window.open('', '_blank', 'width=310,height=720')
  if (!win) {
    // eslint-disable-next-line no-alert
    alert('\u064a\u0631\u062c\u0649 \u0627\u0644\u0633\u0645\u0627\u062d \u0628\u0627\u0644\u0646\u0648\u0627\u0641\u0630 \u0627\u0644\u0645\u0646\u0628\u062b\u0642\u0629 \u0644\u0637\u0628\u0627\u0639\u0629 \u0627\u0644\u0648\u0635\u0644 \u0627\u0644\u062d\u0631\u0627\u0631\u064a')
    return
  }

  // Resolve fields per mode
  let receiptTitle: string
  let subjectLabel: string
  let subjectValue: string
  let amountLabel: string
  let amountValue: number
  let faultCodes: string | null | undefined
  let warrantyText: string

  const createdAt = data.createdAt || new Date().toISOString()
  const seqStr = data.sequenceNumber != null ? '#' + data.sequenceNumber : ''
  const dateTimeStr = getBaghdadDateTime(createdAt)
  const customerName = ((data as InspectionThermalData).customerName) || ((data as VisitThermalData).customerName) || ((data as SaleThermalData).customerName) || ''
  const phone = (data as VisitThermalData).phone || null
  const technicianName = (data as VisitThermalData).technicianName || null

  if (data.mode === 'inspection') {
    receiptTitle = '\u0648\u0635\u0644 \u0641\u062d\u0635 \u0648\u0636\u0645\u0627\u0646'
    subjectLabel = '\u0627\u0644\u0645\u0631\u0643\u0628\u0629 / \u0627\u0644\u0639\u0642\u0644'
    subjectValue = data.subjectInfo || '\u2014'
    amountLabel = '\u0623\u062c\u0648\u0631 \u0627\u0644\u0641\u062d\u0635'
    amountValue = data.fee
    faultCodes = data.faultCodes
    warrantyText = '\u064a\u062d\u0642 \u0644\u0644\u0632\u0628\u0648\u0646 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0641\u062d\u0635 \u0645\u062c\u0627\u0646\u0627\u064b \u0644\u0645\u0631\u0629 \u0648\u0627\u062d\u062f\u0629 \u062e\u0644\u0627\u0644 24 \u0633\u0627\u0639\u0629 \u0645\u0646 \u0648\u0642\u062a \u0647\u0630\u0627 \u0627\u0644\u0648\u0635\u0644.'
  } else if (data.mode === 'visit') {
    receiptTitle = '\u0648\u0635\u0644 \u062a\u0633\u0644\u064a\u0645 \u0648\u0636\u0645\u0627\u0646'
    subjectLabel = '\u0627\u0644\u0645\u0631\u0643\u0628\u0629'
    subjectValue = data.vehicleInfo || '\u2014'
    amountLabel = '\u0627\u0644\u0645\u0628\u0644\u063a \u0627\u0644\u0645\u0633\u062a\u0644\u0645'
    amountValue = data.laborCost
    faultCodes = data.faultCodes
    warrantyText = '\u064a\u062d\u0642 \u0644\u0644\u0632\u0628\u0648\u0646 \u0625\u0639\u0627\u062f\u0629 \u0641\u062d\u0635 \u0627\u0644\u0633\u064a\u0627\u0631\u0629 \u0645\u062c\u0627\u0646\u0627\u064b \u0644\u0645\u0631\u0629 \u0648\u0627\u062d\u062f\u0629 \u062e\u0644\u0627\u0644 24 \u0633\u0627\u0639\u0629 \u0645\u0646 \u0648\u0642\u062a \u0627\u0644\u062a\u0633\u0644\u064a\u0645.'
  } else {
    receiptTitle = '\u0648\u0635\u0644 \u0628\u064a\u0639 \u0648\u0636\u0645\u0627\u0646'
    subjectLabel = '\u0627\u0644\u0635\u0646\u0641 \u0627\u0644\u0645\u0628\u0627\u0639'
    subjectValue = data.itemName || '\u2014'
    amountLabel = '\u0627\u0644\u0645\u0628\u0644\u063a \u0627\u0644\u0645\u0633\u062a\u0644\u0645'
    amountValue = data.totalAmount
    faultCodes = data.notes
    warrantyText = '\u062a\u0645 \u0641\u062d\u0635 \u0627\u0644\u0635\u0646\u0641 \u0648\u062a\u0633\u0644\u064a\u0645\u0647 \u0628\u062d\u0627\u0644\u0629 \u0633\u0644\u064a\u0645\u0629. \u064a\u0631\u062c\u0649 \u0627\u0644\u0627\u062d\u062a\u0641\u0627\u0638 \u0628\u0627\u0644\u0648\u0635\u0644 \u0644\u0623\u064a \u0627\u0633\u062a\u0641\u0633\u0627\u0631 \u0623\u0648 \u0636\u0645\u0627\u0646.'
  }

  const formattedAmount = formatCurrency(amountValue)

  // Build key-value rows
  const rowsHtml: string[] = []
  const addRow = (label: string, value: string | null | undefined) => {
    if (!value) return
    rowsHtml.push(
      '<div class="row"><span class="row-label">' + escHtml(label) + '</span>' +
      '<span class="row-value">' + escHtml(value) + '</span></div>'
    )
  }

  addRow('\u0627\u0644\u0632\u0628\u0648\u0646', customerName || '\u0632\u0628\u0648\u0646 \u0645\u0628\u0627\u0634\u0631')
  addRow('\u0627\u0644\u0647\u0627\u062a\u0641', phone)
  addRow(subjectLabel, subjectValue)
  addRow('\u0627\u0644\u0641\u0646\u064a \u0627\u0644\u0645\u0633\u0624\u0648\u0644', technicianName)

  if (faultCodes && data.mode !== 'sale') {
    const compact = faultCodes.length > 100 ? faultCodes.slice(0, 100) + '\u2026' : faultCodes
    rowsHtml.push(
      '<div class="row"><span class="row-label">\u0631\u0645\u0648\u0632 \u0627\u0644\u0623\u0639\u0637\u0627\u0644</span>' +
      '<span class="row-value mono">' + escHtml(compact) + '</span></div>'
    )
  } else if (data.mode === 'sale' && faultCodes) {
    const compact = faultCodes.length > 100 ? faultCodes.slice(0, 100) + '\u2026' : faultCodes
    rowsHtml.push(
      '<div class="row"><span class="row-label">\u0645\u0644\u0627\u062d\u0638\u0627\u062a</span>' +
      '<span class="row-value">' + escHtml(compact) + '</span></div>'
    )
  }

  const html = [
    '<!DOCTYPE html>',
    '<html dir="rtl" lang="ar">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  <title>' + escHtml(receiptTitle) + ' ' + seqStr + ' \u00b7 \u0648\u0631\u0634\u0629 \u0645\u0646\u062a\u0635\u0631</title>',
    '  <style>',
    '    * { box-sizing: border-box; margin: 0; padding: 0; }',
    '    body {',
    '      margin: 0; padding: 4mm 3mm;',
    '      width: 60mm; min-height: 100vh;',
    '      background: #fff; color: #000;',
    '      font-family: system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif;',
    '      font-size: 11px; direction: rtl; line-height: 1.45;',
    '    }',
    '    @media print {',
    '      @page { size: 50mm auto; margin: 0mm; }',
    '      body { margin: 0; padding: 2mm; width: 50mm; color: #000; background: #fff; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; }',
    '      .no-print { display: none !important; }',
    '    }',
    '    .header { text-align: center; padding-bottom: 3px; }',
    '    .shop-name { font-size: 13px; font-weight: 800; line-height: 1.3; }',
    '    .receipt-type { font-size: 11.5px; font-weight: 700; margin-top: 2px; }',
    '    .receipt-meta { font-size: 9.5px; color: #444; margin-top: 2px; line-height: 1.4; }',
    '    .divider { border: none; border-top: 1px dashed #555; margin: 4px 0; }',
    '    .rows-block { padding: 2px 0; }',
    '    .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; padding: 1.5px 0; font-size: 10.5px; }',
    '    .row-label { color: #555; white-space: nowrap; flex-shrink: 0; font-weight: 600; }',
    '    .row-label::after { content: ":"; }',
    '    .row-value { font-weight: 700; text-align: left; word-break: break-word; flex: 1; direction: rtl; }',
    '    .row-value.mono { font-size: 9.5px; font-family: monospace; white-space: pre-wrap; word-break: break-all; }',
    '    .amount-box { border: 2px solid #000; border-radius: 3px; padding: 4px 5px; margin: 4px 0; text-align: center; font-size: 13px; font-weight: 900; }',
    '    .amount-label { font-size: 10px; font-weight: 700; display: block; margin-bottom: 1px; }',
    '    .warranty-box { border: 1.5px solid #000; border-radius: 3px; padding: 4px 5px; margin: 4px 0; font-size: 9.5px; text-align: center; background: #f8f8f8; }',
    '    .warranty-title { font-weight: 900; font-size: 11px; display: block; margin-bottom: 2px; }',
    '    .footer-text { text-align: center; font-size: 10px; font-weight: 700; margin-top: 4px; padding-top: 3px; }',
    '    .no-print { display: flex; justify-content: center; gap: 8px; padding: 10px 0 4px; }',
    '    .btn-print { background: #1e293b; color: #fff; border: none; border-radius: 8px; padding: 8px 20px; font-size: 13px; font-family: system-ui, sans-serif; cursor: pointer; font-weight: 700; }',
    '    .btn-print:hover { background: #0f172a; }',
    '    .btn-close { background: #64748b; color: #fff; border: none; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-family: system-ui, sans-serif; cursor: pointer; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div class="no-print" style="margin-bottom:8px;">',
    '    <button class="btn-print" onclick="window.print()">\uD83D\uDDA8\uFE0F \u0637\u0628\u0627\u0639\u0629 \u0627\u0644\u0648\u0635\u0644 \u0627\u0644\u062d\u0631\u0627\u0631\u064a</button>',
    '    <button class="btn-close" onclick="window.close()">\u0625\u063a\u0644\u0627\u0642</button>',
    '  </div>',
    '  <div class="header">',
    '    <div class="shop-name">\u0648\u0631\u0634\u0629 \u0645\u0646\u062a\u0635\u0631 \u0644\u0643\u0647\u0631\u0628\u0627\u0621 \u0627\u0644\u0633\u064a\u0627\u0631\u0627\u062a</div>',
    '    <div class="receipt-type">' + escHtml(receiptTitle) + '</div>',
    '    <div class="receipt-meta">' + (seqStr ? '<span>' + escHtml(seqStr) + '</span> &middot; ' : '') + escHtml(dateTimeStr) + '</div>',
    '  </div>',
    '  <hr class="divider" />',
    '  <div class="rows-block">',
    '    ' + rowsHtml.join('\n    '),
    '  </div>',
    '  <hr class="divider" />',
    '  <div class="amount-box">',
    '    <span class="amount-label">' + escHtml(amountLabel) + ':</span>',
    '    <strong>' + escHtml(formattedAmount) + '</strong>',
    '  </div>',
    '  <hr class="divider" />',
    '  <div class="warranty-box">',
    '    <span class="warranty-title">\u2605 \u062a\u0646\u0628\u064a\u0647 \u0627\u0644\u0636\u0645\u0627\u0646 \u2605</span>',
    '    ' + escHtml(warrantyText),
    '  </div>',
    '  <div class="footer-text">',
    '    \u0634\u0643\u0631\u0627\u064b \u0644\u0632\u064a\u0627\u0631\u062a\u0643\u0645 \u2014 \u0646\u062a\u0645\u0646\u0649 \u0644\u0643\u0645 \u0627\u0644\u0633\u0644\u0627\u0645\u0629',
    '  </div>',
    '  <script>',
    '    window.addEventListener("load", function () {',
    '      setTimeout(function () { window.print(); }, 400);',
    '    });',
    '  <\/script>',
    '</body>',
    '</html>',
  ].join('\n')

  win.document.open()
  win.document.write(html)
  win.document.close()
}
