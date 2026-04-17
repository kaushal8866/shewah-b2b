import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer'
import { Order, Partner, Product } from './supabase'
import { formatPaise, formatDate, formatGoldWeight } from './utils'

// Register fonts if needed (optional for basic usage)
// Font.register({ family: 'Inter', src: '...' })

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: '#1c1917', // stone-900
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4', // stone-200
    paddingBottom: 20,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: -1,
  },
  piInfo: {
    textAlign: 'right',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  section: {
    flexDirection: 'row',
    marginBottom: 30,
    gap: 40,
  },
  column: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 8,
    color: '#78716c', // stone-500
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  bold: {
    fontWeight: 'bold',
  },
  table: {
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f4', // stone-100
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
  },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'center' },
  col3: { flex: 1, textAlign: 'right' },
  totals: {
    marginTop: 30,
    alignSelf: 'flex-end',
    width: 200,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#d6d3d1',
    fontWeight: 'bold',
    fontSize: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e7e5e4',
    paddingTop: 20,
    textAlign: 'center',
    color: '#a8a29e', // stone-400
    fontSize: 8,
  },
})

interface PIDocumentProps {
  order: Order
  partner: Partner
  product?: Product
  piNumber: string
}

export const PIDocument: React.FC<PIDocumentProps> = ({ order, partner, product, piNumber }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>SHEWAH</Text>
            <Text style={{ marginTop: 4, color: '#78716c' }}>Surat, Gujarat, India</Text>
          </View>
          <View style={styles.piInfo}>
            <Text style={styles.title}>Proforma Invoice</Text>
            <Text>No: {piNumber}</Text>
            <Text>Date: {formatDate(new Date())}</Text>
            <Text>Expires: {formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000))} (24h rate-lock)</Text>
          </View>
        </View>

        {/* Addresses */}
        <View style={styles.section}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>From</Text>
            <Text style={styles.bold}>Shewah B2B Operations</Text>
            <Text>Diamond World, Varachha</Text>
            <Text>Surat - 395006</Text>
            <Text>GSTIN: 24AAAAAAAAAA1Z5</Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Text style={styles.bold}>{partner.store_name}</Text>
            <Text>Attn: {partner.owner_name}</Text>
            <Text>{partner.address || partner.city}</Text>
            <Text>{partner.city}, {partner.state} {partner.pincode}</Text>
            {partner.gstin && <Text>GSTIN: {partner.gstin}</Text>}
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Item Description</Text>
            <Text style={styles.col2}>Qty</Text>
            <Text style={styles.col3}>Amount</Text>
          </View>
          
          <View style={styles.tableRow}>
            <View style={styles.col1}>
              <Text style={styles.bold}>{product?.name || 'Custom Design Order'}</Text>
              <Text style={{ marginTop: 4, color: '#78716c', fontSize: 8 }}>
                {product?.code ? `Code: ${product.code} | ` : ''}
                {order.ring_size ? `Size: ${order.ring_size} | ` : ''}
                {product?.gold_weight_mg ? `Gold: ${formatGoldWeight(product.gold_weight_mg)} | ` : ''}
                Karat: {product?.gold_karat || 18}K
              </Text>
            </View>
            <Text style={styles.col2}>{order.quantity}</Text>
            <Text style={styles.col3}>{formatPaise(order.total_amount)}</Text>
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal (Excl. Tax)</Text>
            <Text>{formatPaise(order.total_amount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>GST (3%)</Text>
            <Text>{formatPaise(Math.round(order.total_amount * 0.03))}</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text>Grand Total</Text>
            <Text>{formatPaise(Math.round(order.total_amount * 1.03))}</Text>
          </View>
          
          <View style={{ marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f5f5f4' }}>
            <View style={styles.totalRow}>
              <Text style={{ color: '#78716c' }}>Advance Required</Text>
              <Text>{formatPaise(Math.round(order.total_amount * 0.25))}</Text>
            </View>
          </View>
        </View>

        {/* Terms */}
        <View style={{ marginTop: 60 }}>
          <Text style={styles.sectionTitle}>Terms & Conditions</Text>
          <Text style={{ fontSize: 7, color: '#78716c', marginTop: 4, lineHeight: 1.5 }}>
            1. This is a Proforma Invoice and NOT a tax invoice. Tax invoice will be issued on dispatch.{"\n"}
            2. Gold rate is locked for 24 hours from the time of issue. Advance payment must be received within this window.{"\n"}
            3. Estimated delivery time: 14-21 business days from CAD approval.{"\n"}
            4. 25% advance non-refundable once CAD is approved and production begins.{"\n"}
            5. Subject to Surat Jurisdiction.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>This is a computer-generated document. No signature required.</Text>
          <Text style={{ marginTop: 4 }}>Shewah B2B — Transforming the Jewelry Industry</Text>
        </View>
      </Page>
    </Document>
  )
}
