import PDFDocument from 'pdfkit'
import { fmtDate, fetchImage } from './pdfHelpers'

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

export interface QuotePDFData {
  quote_number: string
  quote_date: string
  valid_until: string
  reference_no?: string
  gst_treatment: 'exclusive' | 'inclusive' | 'none'
  gst_rate_pct: number
  margin_pct: number
  show_breakup: boolean
  show_24kt_column: boolean
  cover_note?: string
  terms_text?: string
  subtotal: number
  gst_amount: number
  grand_total: number
  walk_in_name?: string
  walk_in_phone?: string
  walk_in_city?: string
  partners?: {
    name: string
    store_name?: string
    city?: string
    phone?: string
  }
  prepared_by_user?: {
    display_name: string
    username: string
    signature_url?: string
  }
}

export interface QuoteItemPDFData {
  name: string
  category?: string
  ring_size?: string
  quantity: number
  karat: string | number
  gross_gold_weight_g: number
  net_24kt_weight_g: number
  gold_rate_24k: number
  labour_rate_per_g: number
  labour_total: number
  diamonds: any[]
  making_charges: number
  hallmarking: number
  other_charges: number
  other_charges_label?: string
  line_cogs: number
  line_trade: number
  line_total: number
  reference_images?: string[]
}

export async function renderQuotePdf(quote: QuotePDFData, items: QuoteItemPDFData[]): Promise<Buffer> {
  // 1. Fetch images for all items in parallel
  const itemImages = await Promise.all(
    items.map(async (item) => {
      const url = item.reference_images?.[0]
      if (!url) return null
      const buf = await fetchImage(url)
      return buf
    })
  )

  // Fetch signature if available
  let signatureBuffer: Buffer | null = null
  if (quote.prepared_by_user?.signature_url) {
    signatureBuffer = await fetchImage(quote.prepared_by_user.signature_url)
  }

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 48,
        bufferPages: true,
        info: {
          Title: `Quotation — ${quote.quote_number}`,
          Author: 'Shewah Jewellery',
        }
      })

      const chunks: Buffer[] = []
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))

      const brandColor = '#1E3A5F'
      const textColor = '#2C3E50'
      const lightText = '#7F8C8D'
      const lightBg = '#F8F9FA'
      const borderColor = '#BDC3C7'

      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right // 499.28
      const rightMarginX = doc.page.width - doc.page.margins.right

      // Draw standard top header (Logo and title)
      const drawHeader = () => {
        doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(24).text('SHEWAH', 48, 40)
        doc.fillColor(lightText).font('Helvetica').fontSize(9).text('B2B Fine Jewellery Platform', 48, 65)

        doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(16).text('QUOTATION', 48, 40, { align: 'right' })
        doc.fillColor(textColor).font('Helvetica').fontSize(10).text(`Quote #: ${quote.quote_number}`, 48, 60, { align: 'right' })

        // Horizontal divider line
        doc.strokeColor(brandColor).lineWidth(1.5).moveTo(48, 80).lineTo(rightMarginX, 80).stroke()
      }

      drawHeader()

      // Metadata section (Date, Valid Until, Customer Details)
      doc.y = 95
      const startY = doc.y

      // Left column: Customer Details
      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(10).text('BILL TO:', 48, startY)
      doc.fillColor(textColor).font('Helvetica').fontSize(10)
      
      let customerName = 'Walk-in Customer'
      let customerCity = '—'
      let customerPhone = '—'
      
      if (quote.partners) {
        customerName = quote.partners.store_name || quote.partners.name
        customerCity = quote.partners.city || '—'
        customerPhone = quote.partners.phone || '—'
      } else if (quote.walk_in_name) {
        customerName = quote.walk_in_name
        customerCity = quote.walk_in_city || '—'
        customerPhone = quote.walk_in_phone || '—'
      }

      doc.fillColor(textColor).font('Helvetica-Bold').text(customerName, 48, startY + 14)
      doc.fillColor(textColor).font('Helvetica').text(`City: ${customerCity}`, 48, startY + 28)
      doc.fillColor(textColor).font('Helvetica').text(`Phone: ${customerPhone}`, 48, startY + 42)

      // Right column: Quote Details
      const rightColX = 320
      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(10).text('QUOTE DETAILS:', rightColX, startY)
      doc.fillColor(textColor).font('Helvetica').fontSize(10)
      doc.text(`Date: ${fmtDate(quote.quote_date)}`, rightColX, startY + 14)
      doc.text(`Valid Until: ${fmtDate(quote.valid_until)}`, rightColX, startY + 28)
      if (quote.reference_no) {
        doc.text(`Ref No: ${quote.reference_no}`, rightColX, startY + 42)
      }

      doc.y = startY + 65
      doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(48, doc.y).lineTo(rightMarginX, doc.y).stroke()
      doc.moveDown(0.8)

      // Cover note if any
      if (quote.cover_note) {
        doc.fillColor(textColor).font('Helvetica-Oblique').fontSize(9).text(quote.cover_note, { width: contentWidth })
        doc.moveDown(1)
      }

      // Line Items
      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(12).text('LINE ITEMS')
      doc.moveDown(0.4)

      items.forEach((item, index) => {
        // Ensure page breaks dynamically
        if (doc.y > doc.page.height - 200) {
          doc.addPage()
          drawHeader()
          doc.y = 95
        }

        const itemStartY = doc.y
        const itemImg = itemImages[index]

        // Box wrapper for item card
        const cardHeight = quote.show_breakup ? 120 + (item.diamonds?.length || 0) * 15 : 60
        doc.save()
        doc.roundedRect(48, itemStartY, contentWidth, cardHeight, 4)
           .fillColor(lightBg)
           .fill()
        doc.roundedRect(48, itemStartY, contentWidth, cardHeight, 4)
           .strokeColor('#E2E8F0')
           .lineWidth(0.5)
           .stroke()
        doc.restore()

        // Image rendering if available
        let textStartX = 60
        if (itemImg) {
          try {
            doc.image(itemImg, 56, itemStartY + 8, { fit: [44, 44], align: 'center', valign: 'center' })
            textStartX = 110
          } catch {
            // Draw placeholder box
            doc.strokeColor(borderColor).rect(56, itemStartY + 8, 44, 44).stroke()
            textStartX = 110
          }
        }

        // Item Header (Name, Karat, Quantity)
        doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(10)
           .text(item.name, textStartX, itemStartY + 10)
        
        doc.fillColor(textColor).font('Helvetica').fontSize(9)
        const itemKaratStr = typeof item.karat === 'number' ? `${item.karat}K` : String(item.karat)
        const sizeStr = item.ring_size ? ` · Size: ${item.ring_size}` : ''
        doc.text(`${itemKaratStr}${sizeStr} · Qty: ${item.quantity}`, textStartX, itemStartY + 24)

        // Line item total on the far right
        doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(11)
           .text(`₹ ${item.line_total.toLocaleString('en-IN')}`, rightMarginX - 120, itemStartY + 10, { width: 100, align: 'right' })
        
        doc.fillColor(lightText).font('Helvetica').fontSize(8)
        doc.text(`(₹ ${item.line_trade.toLocaleString('en-IN')} / pc)`, rightMarginX - 120, itemStartY + 24, { width: 100, align: 'right' })

        // Detailed Cost Breakup Table (if show_breakup is enabled)
        if (quote.show_breakup) {
          const tableY = itemStartY + 45
          
          // Header row for sub-table
          doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(56, tableY).lineTo(rightMarginX - 8, tableY).stroke()
          
          doc.fillColor(lightText).font('Helvetica-Bold').fontSize(7)
          doc.text('GOLD SPEC', 56, tableY + 4)
          doc.text('LABOUR', 160, tableY + 4)
          doc.text('DIAMONDS & GEMS', 240, tableY + 4)
          doc.text('CHARGES', 380, tableY + 4)

          doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(56, tableY + 13).lineTo(rightMarginX - 8, tableY + 13).stroke()

          // Data row
          doc.fillColor(textColor).font('Helvetica').fontSize(8)
          
          // Gold Column
          let goldText = `Gross: ${item.gross_gold_weight_g.toFixed(3)}g`
          if (quote.show_24kt_column) {
            goldText += `\nNet 24kt: ${item.net_24kt_weight_g.toFixed(3)}g`
          }
          goldText += `\nRate 24kt: ₹${item.gold_rate_24k.toLocaleString('en-IN')}/g`
          doc.text(goldText, 56, tableY + 18, { lineGap: 2 })

          // Labour Column
          const labourText = `Rate: ₹${item.labour_rate_per_g.toLocaleString('en-IN')}/g\nTotal: ₹${item.labour_total.toLocaleString('en-IN')}`
          doc.text(labourText, 160, tableY + 18, { lineGap: 2 })

          // Diamonds Column
          if (item.diamonds && item.diamonds.length > 0) {
            let diamondY = tableY + 18
            item.diamonds.forEach((d) => {
              const dShape = d.shape_id || 'Round'
              const dPieces = d.pieces || 0
              const dWeight = d.approx_carats ? `${d.approx_carats}ct` : ''
              const dRate = d.rate_per_pc ? `₹${d.rate_per_pc}/pc` : ''
              const dIgi = d.igi_charge ? ` + IGI: ₹${d.igi_charge}` : ''
              
              const dText = `${dShape} × ${dPieces}pcs ${dWeight} (${dRate})${dIgi}`
              doc.fontSize(7).text(dText, 240, diamondY, { width: 130 })
              diamondY += 10
            })
          } else {
            doc.text('None', 240, tableY + 18)
          }

          // Charges Column
          let chargesText = `Making: ₹${item.making_charges.toLocaleString('en-IN')}\nHallmark: ₹${item.hallmarking.toLocaleString('en-IN')}`
          if (item.other_charges > 0) {
            chargesText += `\nOther: ₹${item.other_charges.toLocaleString('en-IN')} (${item.other_charges_label || 'Charges'})`
          }
          doc.fontSize(8).text(chargesText, 380, tableY + 18, { lineGap: 2 })
        }

        doc.y = itemStartY + cardHeight + 12
      })

      doc.moveDown(1)

      // Totals section (aligns to bottom or continues)
      if (doc.y > doc.page.height - 200) {
        doc.addPage()
        drawHeader()
        doc.y = 95
      }

      const summaryY = doc.y
      
      // Draw standard terms on the left
      const termsBoxWidth = 260
      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(10).text('TERMS & CONDITIONS', 48, summaryY)
      doc.fillColor(textColor).font('Helvetica').fontSize(8)
      const termsText = quote.terms_text || 'Standard terms apply.'
      doc.text(termsText, 48, summaryY + 15, { width: termsBoxWidth, lineGap: 2 })

      // Draw totals table on the right
      const totalColX = 340
      const totalValX = rightMarginX
      let currentTotalY = summaryY

      const drawTotalRow = (label: string, value: string, isBold = false) => {
        doc.fillColor(isBold ? brandColor : textColor)
           .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
           .fontSize(10)
           .text(label, totalColX, currentTotalY)
        
        doc.text(value, totalColX, currentTotalY, { align: 'right', width: rightMarginX - totalColX })
        currentTotalY += 18
      }

      drawTotalRow('Subtotal:', `₹ ${quote.subtotal.toLocaleString('en-IN')}`)
      
      if (quote.gst_treatment === 'exclusive') {
        drawTotalRow(`GST (${quote.gst_rate_pct}%):`, `₹ ${quote.gst_amount.toLocaleString('en-IN')}`)
      } else if (quote.gst_treatment === 'inclusive') {
        drawTotalRow(`GST (${quote.gst_rate_pct}% Incl.):`, `₹ ${quote.gst_amount.toLocaleString('en-IN')}`)
      }

      // Divider line before Grand Total
      doc.strokeColor(brandColor).lineWidth(1).moveTo(totalColX, currentTotalY - 2).lineTo(rightMarginX, currentTotalY - 2).stroke()
      currentTotalY += 4

      drawTotalRow('Grand Total:', `₹ ${quote.grand_total.toLocaleString('en-IN')}`, true)

      // Amount in words
      doc.y = currentTotalY + 5
      doc.fillColor(textColor).font('Helvetica-Bold').fontSize(9)
         .text(`Amount in Words: ${numToWordsIndian(quote.grand_total)}`, totalColX, doc.y, { width: rightMarginX - totalColX })

      // Signatory Section
      doc.y = Math.max(doc.y + 40, summaryY + 120)
      if (doc.y > doc.page.height - 100) {
        doc.addPage()
        drawHeader()
        doc.y = 150
      }

      const sigY = doc.y
      
      // Right-aligned signature block
      const sigBlockX = 350
      const sigWidth = rightMarginX - sigBlockX

      if (signatureBuffer) {
        try {
          doc.image(signatureBuffer, sigBlockX + sigWidth / 2 - 40, sigY - 35, { fit: [80, 30] })
        } catch {}
      }

      doc.strokeColor(borderColor).lineWidth(0.5).moveTo(sigBlockX, sigY).lineTo(rightMarginX, sigY).stroke()
      
      doc.fillColor(textColor).font('Helvetica-Bold').fontSize(9)
         .text('Authorized Signatory', sigBlockX, sigY + 5, { align: 'center', width: sigWidth })
      
      if (quote.prepared_by_user) {
        doc.fillColor(lightText).font('Helvetica').fontSize(8)
           .text(`Prepared By: ${quote.prepared_by_user.display_name}`, sigBlockX, sigY + 18, { align: 'center', width: sigWidth })
      }

      // Add Page Numbers and Footers (Two Pass)
      const range = doc.bufferedPageRange()
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i)
        
        doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(48, doc.page.height - 40).lineTo(rightMarginX, doc.page.height - 40).stroke()
        
        doc.fillColor(lightText).font('Helvetica').fontSize(8)
        doc.text(
          `Page ${i + 1} of ${range.count}  ·  Quote: ${quote.quote_number}  ·  Generated via Shewah`,
          48,
          doc.page.height - 32,
          { width: contentWidth, align: 'center' }
        )
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}
