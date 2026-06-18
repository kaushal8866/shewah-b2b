import PDFDocument from 'pdfkit'
import { fetchImage } from './pdfHelpers'

export interface CatalogPDFProduct {
  id: string
  code: string
  name: string
  category: string
  metal_type: string
  gold_karat: number | null
  gold_weight_g: number
  trade_price: number
  mrp_suggested: number
  photo_urls: string[]
  diamond_specs: any[]
}

export interface CatalogPDFConfig {
  showPrice: boolean
  priceType: 'trade' | 'mrp' | 'both'
}

export async function renderCatalogPdf(
  products: CatalogPDFProduct[],
  config: CatalogPDFConfig
): Promise<Buffer> {
  // 1. Fetch first cover image for all products in parallel
  const productImages = await Promise.all(
    products.map(async (p) => {
      const url = p.photo_urls?.[0]
      if (!url) return null
      return await fetchImage(url)
    })
  )

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        bufferPages: true,
      })

      const buffers: Buffer[] = []
      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))

      const itemsPerPage = 4
      const totalPages = Math.ceil(products.length / itemsPerPage)

      for (let i = 0; i < products.length; i++) {
        const p = products[i]
        const imgBuffer = productImages[i]

        const pageIndex = Math.floor(i / itemsPerPage)
        const itemIndex = i % itemsPerPage

        // Add a new page if needed (PDFKit creates first page automatically)
        if (i > 0 && itemIndex === 0) {
          doc.addPage()
        }

        // Draw Page Header (only once per page)
        if (itemIndex === 0) {
          doc.rect(0, 0, 595.28, 30).fill('#1E3A5F')
          doc.fillColor('#FFFFFF')
            .font('Helvetica-Bold')
            .fontSize(10)
            .text('SHEWAH JEWELS - B2B PRODUCT CATALOG', 40, 10, { characterSpacing: 1 })
          
          doc.fillColor('#94A3B8')
            .font('Helvetica')
            .fontSize(8)
            .text(`Page ${pageIndex + 1} of ${totalPages || 1}`, 500, 11)
        }

        // Grid positions
        const col = itemIndex % 2
        const row = Math.floor(itemIndex / 2)

        const startX = col === 0 ? 40 : 307
        const startY = row === 0 ? 55 : 430

        const cardWidth = 248
        const cardHeight = 355

        // Draw Card border/background
        doc.roundedRect(startX, startY, cardWidth, cardHeight, 6)
          .lineWidth(1)
          .strokeColor('#E2E8F0')
          .stroke()

        // Draw cover photo
        const imgX = startX + 10
        const imgY = startY + 10
        const imgWidth = cardWidth - 20
        const imgHeight = 170

        if (imgBuffer) {
          try {
            doc.image(imgBuffer, imgX, imgY, {
              fit: [imgWidth, imgHeight],
              align: 'center',
              valign: 'center',
            })
          } catch {
            // Draw placeholder if image buffer is corrupted/failed
            drawPlaceholder(doc, imgX, imgY, imgWidth, imgHeight)
          }
        } else {
          drawPlaceholder(doc, imgX, imgY, imgWidth, imgHeight)
        }

        // Make the image itself clickable (linking to the first photo url)
        if (p.photo_urls?.[0]) {
          doc.link(imgX, imgY, imgWidth, imgHeight, p.photo_urls[0])
        }

        // Product details Y coordinate starting after image
        let textY = imgY + imgHeight + 10

        // Code and Category labels
        doc.fillColor('#B45309')
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(p.code || 'CODE', startX + 10, textY)

        const categoryLabel = p.category ? p.category.toUpperCase() : 'DESIGN'
        doc.fillColor('#64748B')
          .font('Helvetica')
          .fontSize(8)
          .text(categoryLabel, startX + 120, textY, { width: 110, align: 'right' })

        textY += 14

        // Product Name
        doc.fillColor('#1E3A5F')
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(p.name || 'Unnamed Product', startX + 10, textY, { width: cardWidth - 20, height: 14, ellipsis: true })

        textY += 16

        // Metal type and specs
        const isSilver = p.metal_type === 'silver'
        const metalLabel = isSilver ? 'Silver' : (p.gold_karat ? `${p.gold_karat}K Gold` : 'Gold')
        const metalWeight = p.gold_weight_g ? `${p.gold_weight_g.toFixed(3)}g` : '—'
        
        doc.fillColor('#334155')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text('Metal: ', startX + 10, textY)
          .font('Helvetica')
          .text(`${metalLabel} (${metalWeight})`, startX + 45, textY)

        textY += 13

        // Diamond specs summary
        let diamondText = 'None'
        if (p.diamond_specs && p.diamond_specs.length > 0) {
          const main = p.diamond_specs[0]
          const weight = main.weight ? `${main.weight}ct` : ''
          const quality = main.quality || ''
          const color = main.color || ''
          const dType = main.type === 'natural' ? 'Nat' : 'Lgd'
          diamondText = [weight, [quality, color].filter(Boolean).join('/'), dType].filter(Boolean).join(' ')
          if (p.diamond_specs.length > 1) {
            diamondText += ` (+${p.diamond_specs.length - 1} rows)`
          }
        }

        doc.fillColor('#334155')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text('Stone: ', startX + 10, textY)
          .font('Helvetica')
          .text(diamondText, startX + 45, textY, { width: cardWidth - 55, height: 12, ellipsis: true })

        textY += 15

        // Clickable media link
        doc.fillColor('#2563EB')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text('👉 View Photos / Videos', startX + 10, textY, {
            link: p.photo_urls?.[0] || '#',
            underline: true,
          })

        // Also add small sub-links for additional images if they exist
        if (p.photo_urls && p.photo_urls.length > 1) {
          const linksTextY = textY
          let startLinkX = startX + 130
          doc.fillColor('#64748B').font('Helvetica').fontSize(8).text('More:', startLinkX, linksTextY)
          startLinkX += 28

          for (let idx = 1; idx < Math.min(p.photo_urls.length, 4); idx++) {
            const labelStr = `#${idx + 1}`
            doc.fillColor('#2563EB')
              .text(labelStr, startLinkX, linksTextY, {
                link: p.photo_urls[idx],
                underline: true,
              })
            startLinkX += 16
          }
        }

        textY += 15

        // Prices section (conditional)
        if (config.showPrice) {
          doc.rect(startX + 10, textY, cardWidth - 20, 1).fill('#F1F5F9')
          textY += 8

          if (config.priceType === 'trade' || config.priceType === 'both') {
            doc.fillColor('#475569')
              .font('Helvetica-Bold')
              .fontSize(8)
              .text('B2B Trade:', startX + 10, textY)
              
            const tradePriceFormatted = `Rs. ${Math.round(p.trade_price).toLocaleString('en-IN')}`
            doc.fillColor('#1E3A5F')
              .font('Helvetica-Bold')
              .fontSize(10)
              .text(tradePriceFormatted, startX + 70, textY - 1.5)
          }

          if (config.priceType === 'both') {
            textY += 14
          }

          if (config.priceType === 'mrp' || config.priceType === 'both') {
            doc.fillColor('#475569')
              .font('Helvetica-Bold')
              .fontSize(8)
              .text('Retail MRP:', startX + 10, textY)
              
            const mrpFormatted = `Rs. ${Math.round(p.mrp_suggested).toLocaleString('en-IN')}`
            doc.fillColor('#B45309')
              .font('Helvetica-Bold')
              .fontSize(10)
              .text(mrpFormatted, startX + 70, textY - 1.5)
          }
        }
      }

      // Draw footer on all pages (buffer pages allows looping through them)
      const range = doc.bufferedPageRange()
      for (let j = 0; j < range.count; j++) {
        doc.switchToPage(j)
        
        // Footer divider line
        doc.rect(40, 800, 515, 0.5).fill('#CBD5E1')
        
        // Footer text
        doc.fillColor('#94A3B8')
          .font('Helvetica')
          .fontSize(7.5)
          .text('SHEWAH B2B PLATFORM • EXCLUSIVE JEWELRY CATALOG', 40, 808)
          
        doc.text('CONFIDENTIAL • FOR INTERNAL USE ONLY', 380, 808, { align: 'right', width: 175 })
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

function drawPlaceholder(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number) {
  doc.rect(x, y, w, h).fill('#F8FAFC')
  doc.rect(x, y, w, h).lineWidth(1).strokeColor('#E2E8F0').stroke()
  doc.fillColor('#94A3B8')
    .font('Helvetica')
    .fontSize(9)
    .text('No Image Available', x, y + h / 2 - 5, { align: 'center', width: w })
}
