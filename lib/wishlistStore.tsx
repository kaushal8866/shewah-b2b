'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

export interface WishlistItem {
  id: string
  slug: string
  name: string
  category: string
  priceFormatted: string
  photoUrl?: string | null
  subtitle?: string
}

interface WishlistContextType {
  items: WishlistItem[]
  wishlistCount: number
  isInWishlist: (id: string) => boolean
  toggleWishlist: (item: WishlistItem) => void
  removeFromWishlist: (id: string) => void
  clearWishlist: () => void
}

const STORAGE_KEY = 'shewah_d2c_wishlist_v1'

const WishlistContext = createContext<WishlistContextType | undefined>(undefined)

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setItems(JSON.parse(stored))
      }
    } catch (e) {
      console.error('Failed to parse wishlist from storage', e)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Persist to localStorage on change
  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch (e) {
      console.error('Failed to save wishlist to storage', e)
    }
  }, [items, isLoaded])

  const isInWishlist = useCallback((id: string) => {
    return items.some((i) => i.id === id)
  }, [items])

  const toggleWishlist = useCallback((item: WishlistItem) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === item.id)
      if (exists) {
        return prev.filter((i) => i.id !== item.id)
      } else {
        return [item, ...prev]
      }
    })
  }, [])

  const removeFromWishlist = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const clearWishlist = useCallback(() => {
    setItems([])
  }, [])

  return (
    <WishlistContext.Provider
      value={{
        items,
        wishlistCount: items.length,
        isInWishlist,
        toggleWishlist,
        removeFromWishlist,
        clearWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  const context = useContext(WishlistContext)
  if (!context) {
    // Graceful fallback for non-provider SSR or unmounted states
    return {
      items: [],
      wishlistCount: 0,
      isInWishlist: () => false,
      toggleWishlist: () => {},
      removeFromWishlist: () => {},
      clearWishlist: () => {},
    }
  }
  return context
}
