'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { getMarket, formatCurrency, type MarketCode, type CurrencyCode, type MarketConfig } from '@/lib/markets'

export interface CartItemConfig {
  metalTone?: string
  karat?: number | string
  diamondType?: 'natural' | 'lab_grown' | 'lgd'
  ringSize?: string
  customEngraving?: string
}

export function formatVariantLabel(config?: CartItemConfig): string | null {
  if (!config) return null
  const parts: string[] = []

  // Metal tone / karat
  if (config.metalTone === 'platinum') {
    parts.push('950 Platinum')
  } else if (config.metalTone) {
    const toneCap = config.metalTone.charAt(0).toUpperCase() + config.metalTone.slice(1)
    parts.push(`18K ${toneCap} Gold`)
  } else if (config.karat) {
    parts.push(`${config.karat}K Gold`)
  }

  // Diamond type
  if (config.diamondType === 'natural') {
    parts.push('Natural Mined Diamond (GIA)')
  } else if (config.diamondType === 'lab_grown' || config.diamondType === 'lgd') {
    parts.push('Lab-Grown Diamond (IGI)')
  }

  // Ring size
  if (config.ringSize) {
    parts.push(`Size: ${config.ringSize}`)
  }

  return parts.length > 0 ? parts.join(' • ') : null
}

export interface CartItem {
  id: string // unique line id
  productId: string
  code: string
  name: string
  category?: string
  photoUrl?: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
  currency: CurrencyCode
  formattedUnitPrice: string
  formattedLineTotal: string
  config?: CartItemConfig
}

interface CartContextType {
  items: CartItem[]
  market: MarketConfig
  setMarketCode: (code: MarketCode) => void
  addItem: (product: {
    id: string
    code: string
    name: string
    category?: string
    photoUrl?: string | null
    unitPrice: number
    currency: CurrencyCode
    config?: CartItemConfig
  }, quantity?: number) => void
  updateQuantity: (id: string, quantity: number) => void
  removeItem: (id: string) => void
  clearCart: () => void
  itemCount: number
  subtotal: number
  totalAmount: number
  formattedSubtotal: string
  formattedTotal: string
  isCartOpen: boolean
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
  revalidateCart: (targetMarketCode?: MarketCode) => Promise<void>
  isValidating: boolean
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_STORAGE_KEY = 'shewah_d2c_cart_v2'
const MARKET_COOKIE_KEY = 'shewah_market'
const MARKET_MANUAL_FLAG = 'shewah_market_manual_v1'

const VALID_MARKETS: MarketCode[] = ['US', 'GB', 'AU', 'DE', 'FR', 'IN']

/**
 * Fast client-side location heuristic from browser environment (timezone & language).
 * Guaranteed synchronous and zero-latency before edge geo refinement resolves.
 */
function detectMarketFromBrowser(): MarketCode {
  if (typeof window === 'undefined') return 'US'
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (tz.includes('Kolkata') || tz.includes('Calcutta') || tz === 'IST' || tz.includes('Asia/Colombo')) return 'IN'
    if (tz.includes('London') || tz === 'GMT' || tz === 'BST') return 'GB'
    if (tz.includes('Sydney') || tz.includes('Melbourne') || tz.includes('Brisbane') || tz.includes('Perth') || tz.includes('Adelaide')) return 'AU'
    if (tz.includes('Berlin') || tz.includes('Vienna') || tz.includes('Zurich')) return 'DE'
    if (tz.includes('Paris') || tz.includes('Brussels')) return 'FR'
    if (tz.includes('New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago') || tz.includes('Denver') || tz.includes('Phoenix')) return 'US'

    // Secondary heuristic: browser languages
    const langs = navigator.languages || [navigator.language]
    for (const lang of langs) {
      if (/-IN\b/i.test(lang) || /^(hi|gu|mr|ta|te|kn|bn|pa)\b/i.test(lang)) return 'IN'
      if (/-GB\b/i.test(lang)) return 'GB'
      if (/-AU\b/i.test(lang)) return 'AU'
      if (/-DE\b/i.test(lang)) return 'DE'
      if (/-FR\b/i.test(lang)) return 'FR'
    }
  } catch {}
  return 'US'
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [marketCode, setMarketCodeState] = useState<MarketCode>('US')
  const [items, setItems] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  // Initialize market with automatic location detection & manual preference support
  useEffect(() => {
    if (typeof window === 'undefined') return

    const isManual = localStorage.getItem(MARKET_MANUAL_FLAG) === 'true'
    const storedMarket = localStorage.getItem(MARKET_COOKIE_KEY) as MarketCode | null

    if (isManual && storedMarket && VALID_MARKETS.includes(storedMarket)) {
      // Respect explicit user manual selection from header dropdown
      setMarketCodeState(storedMarket)
    } else {
      // Auto-detect based on user location:
      // Step 1: Immediate zero-latency heuristic from browser environment
      const detected = detectMarketFromBrowser()
      setMarketCodeState(detected)
      localStorage.setItem(MARKET_COOKIE_KEY, detected)
      document.cookie = `${MARKET_COOKIE_KEY}=${detected}; path=/; max-age=31536000; SameSite=Lax`

      // Step 2: Refine via server edge geolocation headers
      fetch('/api/d2c/geo')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.marketCode && VALID_MARKETS.includes(data.marketCode)) {
            setMarketCodeState(data.marketCode)
            localStorage.setItem(MARKET_COOKIE_KEY, data.marketCode)
            document.cookie = `${MARKET_COOKIE_KEY}=${data.marketCode}; path=/; max-age=31536000; SameSite=Lax`
          }
        })
        .catch(() => {})
    }

    const storedCart = localStorage.getItem(CART_STORAGE_KEY)
    if (storedCart) {
      try {
        const parsed = JSON.parse(storedCart)
        if (Array.isArray(parsed)) setItems(parsed)
      } catch {}
    }
  }, [])

  const itemsRef = useRef(items)
  itemsRef.current = items

  // Persist cart items to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const market = getMarket(marketCode)

  const revalidateCart = useCallback(async (targetMarketCode?: MarketCode) => {
    const currentItems = itemsRef.current
    if (currentItems.length === 0) return
    const activeCode = targetMarketCode || marketCode
    setIsValidating(true)
    try {
      const res = await fetch('/api/d2c/cart/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: currentItems.map(it => ({
            productId: it.productId,
            quantity: it.quantity,
            config: it.config,
          })),
          marketCode: activeCode,
        }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data?.items && Array.isArray(data.items)) {
        setItems(prev => {
          return prev.map((it, idx) => {
            const remote = data.items[idx]
            if (!remote) return it
            return {
              ...it,
              unitPrice: remote.unitPrice,
              lineTotal: remote.lineTotal,
              currency: remote.currency,
              formattedUnitPrice: remote.formattedUnitPrice,
              formattedLineTotal: remote.formattedLineTotal,
            }
          })
        })
      }
    } catch (e) {
      console.warn('[revalidateCart] Failed:', e)
    } finally {
      setIsValidating(false)
    }
  }, [marketCode])

  // Automatically re-price and convert existing bag items whenever the user changes market
  const prevMarketCodeRef = useRef(marketCode)
  useEffect(() => {
    if (prevMarketCodeRef.current !== marketCode) {
      prevMarketCodeRef.current = marketCode
      if (itemsRef.current.length > 0) {
        revalidateCart(marketCode)
      }
    }
  }, [marketCode, revalidateCart])

  const setMarketCode = (code: MarketCode) => {
    setMarketCodeState(code)
    if (typeof window !== 'undefined') {
      localStorage.setItem(MARKET_COOKIE_KEY, code)
      localStorage.setItem(MARKET_MANUAL_FLAG, 'true') // Flag that user manually chose this market
      document.cookie = `${MARKET_COOKIE_KEY}=${code}; path=/; max-age=31536000; SameSite=Lax`
    }
  }

  const addItem: CartContextType['addItem'] = (prod, qty = 1) => {
    const configKey = JSON.stringify(prod.config || {})
    const safeKey = typeof btoa !== 'undefined'
      ? btoa(encodeURIComponent(configKey)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)
      : Buffer.from(configKey).toString('base64').slice(0, 16)
    const lineId = `${prod.id}_${safeKey}`
    
    setItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.id === lineId)
      if (existingIdx >= 0) {
        const copy = [...prev]
        const newQty = copy[existingIdx].quantity + qty
        copy[existingIdx] = {
          ...copy[existingIdx],
          quantity: newQty,
          lineTotal: copy[existingIdx].unitPrice * newQty,
          formattedLineTotal: formatCurrency(copy[existingIdx].unitPrice * newQty, market.currency),
        }
        return copy
      }
      const newItem: CartItem = {
        id: lineId,
        productId: prod.id,
        code: prod.code,
        name: prod.name,
        category: prod.category,
        photoUrl: prod.photoUrl,
        quantity: qty,
        unitPrice: prod.unitPrice,
        lineTotal: prod.unitPrice * qty,
        currency: market.currency,
        formattedUnitPrice: formatCurrency(prod.unitPrice, market.currency),
        formattedLineTotal: formatCurrency(prod.unitPrice * qty, market.currency),
        config: prod.config,
      }
      return [...prev, newItem]
    })
    setIsCartOpen(true)
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id)
      return
    }
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const lineTotal = it.unitPrice * quantity
          return {
            ...it,
            quantity,
            lineTotal,
            formattedLineTotal: formatCurrency(lineTotal, market.currency),
          }
        }
        return it
      })
    )
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const clearCart = () => {
    setItems([])
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CART_STORAGE_KEY)
    }
  }

  const itemCount = items.reduce((sum, it) => sum + it.quantity, 0)
  const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0)
  const totalAmount = subtotal

  return (
    <CartContext.Provider
      value={{
        items,
        market,
        setMarketCode,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        itemCount,
        subtotal,
        totalAmount,
        formattedSubtotal: formatCurrency(subtotal, market.currency),
        formattedTotal: formatCurrency(totalAmount, market.currency),
        isCartOpen,
        openCart: () => setIsCartOpen(true),
        closeCart: () => setIsCartOpen(false),
        toggleCart: () => setIsCartOpen((prev) => !prev),
        revalidateCart,
        isValidating,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return ctx
}
