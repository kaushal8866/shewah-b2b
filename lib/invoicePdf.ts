import PDFDocument from 'pdfkit'
import { fmtDate } from './pdfHelpers'

// Helper to convert numbers to words in Indian numbering system
export function numToWordsIndian(num: number): string {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ]
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  if (num === 0) return 'Zero'

  function convert(n: number): string {
    if (n < 20) return a[n]
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '')
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '')
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '')
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '')
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '')
  }

  const rounded = Math.round(num)
  return convert(rounded) + ' Rupees Only'
}

export interface BankDetails {
  accountName: string
  bankName: string
  accountNo: string
  ifsc: string
  terms: string
}

export async function renderInvoicePdf(invoice: any, bankDetails?: BankDetails): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: {
          Title: `Tax Invoice — ${invoice.invoice_number}`,
          Author: invoice.seller_name || 'Shewah',
        }
      })

      const chunks: Buffer[] = []
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))

      const brandColor = '#1E3A5F'
      const textColor = '#2C3E50'
      const lightText = '#7F8C8D'
      const borderColor = '#BDC3C7'

      const contentWidth = doc.page.width - 80 // 515 px
      const rightX = doc.page.width - 40 // 555 px

      // 1. Draw Title & Invoice details
      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(18).text('TAX INVOICE', 40, 40)
      
      if (invoice.status === 'cancelled') {
        doc.fillColor('#C0392B').font('Helvetica-Bold').fontSize(18).text('CANCELLED', 40, 40, { align: 'right' })
      } else {
        doc.fillColor(textColor).font('Helvetica-Bold').fontSize(12).text('Original Copy', 40, 45, { align: 'right' })
      }

      // Divider line
      doc.strokeColor(brandColor).lineWidth(1.5).moveTo(40, 65).lineTo(rightX, 65).stroke()

      // 2. Company Info & Invoice Metadata
      const metadataY = 75
      
      // Left side: Seller Details
      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(10).text('SOLD BY (SELLER):', 40, metadataY)
      doc.fillColor(textColor).font('Helvetica-Bold').fontSize(11).text(invoice.seller_name || 'Shewah', 40, metadataY + 15)
      doc.font('Helvetica').fontSize(9).fillColor(textColor)
      
      const sellerAddr = invoice.seller_address || 'Surat, Gujarat'
      const sellerAddrWidth = 240
      const sellerAddrHeight = doc.heightOfString(sellerAddr, { width: sellerAddrWidth })
      doc.text(sellerAddr, 40, metadataY + 30, { width: sellerAddrWidth })
      
      const sellerDetailsOffset = metadataY + 30 + sellerAddrHeight + 5
      doc.font('Helvetica-Bold').text(`GSTIN: `, 40, sellerDetailsOffset)
      doc.font('Helvetica').text(invoice.seller_gstin || '—', 85, sellerDetailsOffset)
      doc.font('Helvetica-Bold').text(`State: `, 40, sellerDetailsOffset + 12)
      doc.font('Helvetica').text(`${invoice.seller_state} (State Code: ${invoice.seller_gstin ? invoice.seller_gstin.slice(0, 2) : '—'})`, 80, sellerDetailsOffset + 12)

      // Right side: Invoice Details
      const rightColX = 320
      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(10).text('INVOICE DETAILS:', rightColX, metadataY)
      doc.fillColor(textColor).font('Helvetica-Bold').fontSize(10)
      
      doc.text('Invoice No:', rightColX, metadataY + 15)
      doc.font('Helvetica').text(invoice.invoice_number, rightColX + 75, metadataY + 15)
      
      doc.font('Helvetica-Bold').text('Invoice Date:', rightColX, metadataY + 28)
      doc.font('Helvetica').text(fmtDate(invoice.invoice_date), rightColX + 75, metadataY + 28)
      
      if (invoice.invoice_type === 'order') {
        doc.font('Helvetica-Bold').text('Order Ref:', rightColX, metadataY + 41)
        doc.font('Helvetica').text(invoice.orders?.order_number || '—', rightColX + 75, metadataY + 41)
      } else {
        doc.font('Helvetica-Bold').text('Trade Ref:', rightColX, metadataY + 41)
        doc.font('Helvetica').text(`TRD-${invoice.diamond_trade_id?.slice(0, 8).toUpperCase()}`, rightColX + 75, metadataY + 41)
      }

      // Divider line
      const buyerY = sellerDetailsOffset + 40
      doc.strokeColor(borderColor).lineWidth(0.5).moveTo(40, buyerY - 10).lineTo(rightX, buyerY - 10).stroke()

      // 3. Buyer Details Block
      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(10).text('BILLED TO (BUYER):', 40, buyerY)
      doc.fillColor(textColor).font('Helvetica-Bold').fontSize(11).text(invoice.buyer_name, 40, buyerY + 15)
      doc.font('Helvetica').fontSize(9).fillColor(textColor)
      
      const buyerAddr = invoice.buyer_address || '—'
      const buyerAddrWidth = 350
      const buyerAddrHeight = doc.heightOfString(buyerAddr, { width: buyerAddrWidth })
      doc.text(buyerAddr, 40, buyerY + 30, { width: buyerAddrWidth })

      const buyerDetailsOffset = buyerY + 30 + buyerAddrHeight + 5
      doc.font('Helvetica-Bold').text(`GSTIN: `, 40, buyerDetailsOffset)
      doc.font('Helvetica').text(invoice.buyer_gstin || 'Consumer / Unregistered', 85, buyerDetailsOffset)
      doc.font('Helvetica-Bold').text(`State: `, 40, buyerDetailsOffset + 12)
      doc.font('Helvetica').text(`${invoice.buyer_state} (State Code: ${invoice.buyer_gstin ? invoice.buyer_gstin.slice(0, 2) : '—'})`, 80, buyerDetailsOffset + 12)

      // 4. Items Table
      const tableTopY = buyerDetailsOffset + 40
      doc.strokeColor(brandColor).lineWidth(1.5).moveTo(40, tableTopY - 5).lineTo(rightX, tableTopY - 5).stroke()

      // Headers
      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(9)
      doc.text('S.No', 45, tableTopY)
      doc.text('Description of Goods', 80, tableTopY)
      doc.text('HSN Code', 260, tableTopY, { width: 55, align: 'center' })
      doc.text('Qty', 320, tableTopY, { width: 45, align: 'right' })
      doc.text('Unit', 370, tableTopY, { width: 35, align: 'center' })
      doc.text('Rate (₹)', 410, tableTopY, { width: 60, align: 'right' })
      doc.text('Amount (₹)', 475, tableTopY, { width: 75, align: 'right' })

      doc.strokeColor(brandColor).lineWidth(1).moveTo(40, tableTopY + 12).lineTo(rightX, tableTopY + 12).stroke()

      // Rows
      let currentY = tableTopY + 18
      doc.font('Helvetica').fontSize(9).fillColor(textColor)

      const itemsList = Array.isArray(invoice.items) ? invoice.items : []
      itemsList.forEach((item: any, idx: number) => {
        doc.text(String(idx + 1), 45, currentY)
        
        // Split description if it overflows
        const desc = item.description || 'Jewellery Item'
        const descWidth = 170
        const descHeight = doc.heightOfString(desc, { width: descWidth })
        doc.text(desc, 80, currentY, { width: descWidth })

        doc.text(item.hsn_code || '—', 260, currentY, { width: 55, align: 'center' })
        doc.text(Number(item.qty).toFixed(item.unit === 'grams' || item.unit === 'carats' ? 3 : 0), 320, currentY, { width: 45, align: 'right' })
        doc.text(item.unit || 'pcs', 370, currentY, { width: 35, align: 'center' })
        doc.text(Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 410, currentY, { width: 60, align: 'right' })
        doc.text(Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 475, currentY, { width: 75, align: 'right' })

        // Shift next Y coordinate based on description lines
        currentY += Math.max(descHeight + 4, 15)
      })

      // Draw bottom line of table
      doc.strokeColor(borderColor).lineWidth(0.5).moveTo(40, currentY).lineTo(rightX, currentY).stroke()

      // 5. Totals / Taxes section
      const totalSectionY = currentY + 10
      doc.font('Helvetica').fontSize(9).fillColor(textColor)

      // Split of CGST/SGST vs IGST
      let taxLines: Array<{ label: string; rate: number; amt: number }> = []
      if (Number(invoice.igst_amount) > 0) {
        taxLines.push({ label: 'Integrated GST (IGST)', rate: Number(invoice.igst_rate), amt: Number(invoice.igst_amount) })
      } else {
        if (Number(invoice.cgst_amount) > 0) {
          taxLines.push({ label: 'Central GST (CGST)', rate: Number(invoice.cgst_rate), amt: Number(invoice.cgst_amount) })
        }
        if (Number(invoice.sgst_amount) > 0) {
          taxLines.push({ label: 'State GST (SGST)', rate: Number(invoice.sgst_rate), amt: Number(invoice.sgst_amount) })
        }
      }

      // Calculations / Dues right columns
      let totalLinesOffset = totalSectionY
      
      const drawTotalRow = (label: string, value: string, isBold: boolean = false) => {
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fillColor(textColor)
        doc.text(label, 320, totalLinesOffset, { width: 140, align: 'right' })
        doc.text(value, 465, totalLinesOffset, { width: 85, align: 'right' })
        totalLinesOffset += 14
      }

      drawTotalRow('Taxable Value (Subtotal):', `₹${Number(invoice.subtotal_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
      
      taxLines.forEach(tl => {
        drawTotalRow(`${tl.label} @ ${tl.rate}%:`, `₹${tl.amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
      })
      
      if (taxLines.length > 0) {
        drawTotalRow('Total Tax:', `₹${Number(invoice.total_tax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
      }

      // Draw total divider
      doc.strokeColor(brandColor).lineWidth(1).moveTo(350, totalLinesOffset + 2).lineTo(rightX, totalLinesOffset + 2).stroke()
      totalLinesOffset += 6
      drawTotalRow('Total Invoice Value:', `₹${Number(invoice.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, true)

      // Total in words
      doc.font('Helvetica-Bold').fontSize(9).text('Total Invoice Value (in Words):', 40, totalSectionY)
      doc.font('Helvetica').text(numToWordsIndian(Number(invoice.grand_total)), 40, totalSectionY + 14, { width: 260 })

      // 6. Bank Details, Terms & Authorized Signatory
      const footerY = Math.max(totalLinesOffset + 20, totalSectionY + 45)
      doc.strokeColor(borderColor).lineWidth(0.5).moveTo(40, footerY - 5).lineTo(rightX, footerY - 5).stroke()

      // Bank Details (Left side)
      if (bankDetails && bankDetails.accountNo) {
        doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(9).text('BANK ACCOUNT DETAILS:', 40, footerY)
        doc.fillColor(textColor).font('Helvetica').fontSize(8.5)
        doc.text(`Account Name: `, 40, footerY + 14)
        doc.text(bankDetails.accountName, 115, footerY + 14)
        doc.text(`Bank Name: `, 40, footerY + 25)
        doc.text(bankDetails.bankName || '—', 100, footerY + 25)
        doc.text(`Account No: `, 40, footerY + 36)
        doc.text(bankDetails.accountNo, 100, footerY + 36)
        doc.text(`IFSC Code: `, 40, footerY + 47)
        doc.text(bankDetails.ifsc, 100, footerY + 47)
      }

      // Terms & Conditions (Left side below bank)
      const termsY = footerY + (bankDetails && bankDetails.accountNo ? 65 : 0)
      const terms = bankDetails?.terms || invoice.notes || 'Subject to local jurisdiction.'
      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(8.5).text('TERMS & CONDITIONS:', 40, termsY)
      doc.fillColor(textColor).font('Helvetica').fontSize(8)
      doc.text(terms, 40, termsY + 12, { width: 280, lineGap: 2 })

      // Authorized Signatory (Right side)
      const sigX = 350
      doc.fillColor(textColor).font('Helvetica').fontSize(8.5).text(`For ${invoice.seller_name || 'Shewah'}`, sigX, footerY, { width: 200, align: 'center' })
      
      // Signature box/line
      doc.strokeColor(borderColor).lineWidth(0.5).moveTo(sigX + 20, footerY + 70).lineTo(rightX - 20, footerY + 70).stroke()
      doc.font('Helvetica-Bold').fontSize(8).text('Authorized Signatory', sigX, footerY + 76, { width: 200, align: 'center' })

      // End document writing
      doc.end()

    } catch (e) {
      reject(e)
    }
  })
}
