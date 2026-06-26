'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Package,
  Search,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  X,
  CheckCircle,
  SlidersHorizontal,
  ChevronRight,
  Info,
  AlertTriangle,
  Sparkles,
  Award,
  ShieldCheck,
  Scale,
  ShoppingCart,
  User,
  Heart,
  Plus,
  Minus,
  Trash2,
  Lock,
  ArrowRight,
  Star,
  Camera,
  Upload,
  ExternalLink,
  ChevronDown
} from 'lucide-react'
import Link from 'next/link'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import { DEFAULT_HOMEPAGE_SECTIONS, SectionBlock } from '@/lib/defaultSections'

function hexToRgba(hex: string, alpha: number): string {
  if (!hex) return `rgba(255, 255, 255, ${alpha})`
  let cleanHex = hex.replace('#', '')
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('')
  }
  if (cleanHex.length !== 6) return `rgba(255, 255, 255, ${alpha})`
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function PublicStorefront() {
  const { token } = useParams() as { token: string }

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reseller, setReseller] = useState<any>(null)
  const [theme, setTheme] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'catalog' | 'profile'>('catalog')

  // Customer Session
  const [customer, setCustomer] = useState<any>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authStep, setAuthStep] = useState(1) // 1 = input details, 2 = input OTP
  const [authPhone, setAuthPhone] = useState('')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Carts
  const [cart, setCart] = useState<any[]>([])
  const [showCartDrawer, setShowCartDrawer] = useState(false)

  // Checkout Flow
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState(1) // 1 = address, 2 = payment, 3 = confirmation
  const [shippingName, setShippingName] = useState('')
  const [shippingPhone, setShippingPhone] = useState('')
  const [shippingAddress, setShippingAddress] = useState('')
  const [shippingNotes, setShippingNotes] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [confirmedOrders, setConfirmedOrders] = useState<any[]>([])

  // Search/Filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Selected Product detail drawer
  const [selectedProduct, setSelectedProduct] = useState<any>(null)

  // Made-to-order config states
  const [selectedKarat, setSelectedKarat] = useState<number>(18)
  const [selectedSize, setSelectedSize] = useState<string>('14')
  const [customNotes, setCustomNotes] = useState('')
  const [briefImages, setBriefImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0)

  // Product Reviews
  const [reviews, setReviews] = useState<any[]>([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [newRating, setNewRating] = useState(5)
  const [newReviewText, setNewReviewText] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  // Customer Profile lists
  const [profileOrders, setProfileOrders] = useState<any[]>([])
  const [profileWishlist, setProfileWishlist] = useState<any[]>([])
  const [loadingProfile, setLoadingProfile] = useState(false)

  // Callback modal
  const [showCallbackModal, setShowCallbackModal] = useState(false)
  const [callbackName, setCallbackName] = useState('')
  const [callbackPhone, setCallbackPhone] = useState('')
  const [callbackMsg, setCallbackMsg] = useState('')
  const [callbackSuccess, setCallbackSuccess] = useState(false)
  const [submittingCallback, setSubmittingCallback] = useState(false)

  useEffect(() => {
    // Load luxury fonts
    const fontLink = document.createElement('link')
    fontLink.rel = 'stylesheet'
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap'
    document.head.appendChild(fontLink)
  }, [])

  useEffect(() => {
    if (token) {
      loadStorefront()
      checkCustomerSession()
    }
  }, [token])

  // Sync cart with local storage or DB
  useEffect(() => {
    const savedCart = localStorage.getItem(`r_cart_${token}`)
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart))
      } catch {}
    }
  }, [token])

  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem(`r_cart_${token}`, JSON.stringify(cart))
      logAbandonedCart(cart)
    } else {
      localStorage.removeItem(`r_cart_${token}`)
    }
  }, [cart, token])

  // Dynamic live price update hook
  useEffect(() => {
    if (selectedProduct) {
      updateLivePrice()
    }
  }, [selectedProduct, selectedKarat])

  useEffect(() => {
    if (selectedProduct) {
      loadProductReviews()
    }
  }, [selectedProduct])

  useEffect(() => {
    if (activeTab === 'profile' && customer) {
      loadCustomerProfileData()
    }
  }, [activeTab, customer])

  async function loadStorefront() {
    try {
      setLoading(true)
      const res = await fetch(`/api/r/${token}`)
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setReseller(data.reseller)
        setTheme(data.theme)
        setProducts(data.products || [])

        if (data.theme?.store_name) {
          document.title = data.theme.store_name
        } else if (data.reseller?.store_name) {
          document.title = data.reseller.store_name
        }

        if (data.theme?.favicon_url) {
          const icon: any = document.querySelector("link[rel*='icon']") || document.createElement('link')
          icon.type = 'image/x-icon'
          icon.rel = 'shortcut icon'
          icon.href = data.theme.favicon_url
          document.getElementsByTagName('head')[0].appendChild(icon)
        }
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function checkCustomerSession() {
    try {
      const res = await fetch(`/api/r/${token}/auth`)
      const data = await res.json()
      if (data.authenticated && data.customer) {
        setCustomer(data.customer)
        if (data.customer.wishlist_product_ids) {
          setProfileWishlist(data.customer.wishlist_product_ids)
        }
        // Load synced cart from database
        const cartRes = await fetch(`/api/r/${token}/cart`)
        const cartData = await cartRes.json()
        if (cartData.items && cartData.items.length > 0) {
          setCart(cartData.items)
        }
      }
    } catch {}
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setAuthLoading(true)
    try {
      const res = await fetch(`/api/r/${token}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-otp', phone: authPhone })
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        setAuthStep(2)
        if (data.code) {
          setAuthCode(data.code)
        }
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setAuthLoading(true)
    try {
      const res = await fetch(`/api/r/${token}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-otp',
          phone: authPhone,
          code: authCode,
          name: authName,
          email: authEmail
        })
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        setCustomer(data.customer)
        setShowAuthModal(false)
        setAuthStep(1)
        setAuthCode('')
        // Sync current cart to database
        if (cart.length > 0) {
          await fetch(`/api/r/${token}/cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: cart })
          })
        }
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleLogout() {
    if (!confirm('Are you sure you want to sign out?')) return
    try {
      await fetch(`/api/r/${token}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      })
      setCustomer(null)
      setCart([])
      localStorage.removeItem(`r_cart_${token}`)
      setActiveTab('catalog')
    } catch {}
  }

  async function updateLivePrice() {
    try {
      const res = await fetch(`/api/r/${token}/price?product_id=${selectedProduct.id}&karat=${selectedKarat}`)
      const data = await res.json()
      if (data.selling_price_rupees) {
        setEstimatedPrice(data.selling_price_rupees)
      }
    } catch {}
  }

  async function loadProductReviews() {
    setLoadingReviews(true)
    try {
      const res = await fetch(`/api/r/${token}/reviews?product_id=${selectedProduct.id}`)
      const data = await res.json()
      setReviews(data.reviews || [])
    } catch {
    } finally {
      setLoadingReviews(false)
    }
  }

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmittingReview(true)
    try {
      const res = await fetch(`/api/r/${token}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          rating: newRating,
          review_text: newReviewText
        })
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        alert('Thank you! Your review has been submitted for moderation.')
        setShowReviewForm(false)
        setNewReviewText('')
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSubmittingReview(false)
    }
  }

  async function logAbandonedCart(items: any[]) {
    try {
      fetch(`/api/r/${token}/abandoned-cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          guest_phone: customer ? null : authPhone || null,
          guest_name: customer ? null : authName || null
        })
      })
    } catch {}
  }

  async function loadCustomerProfileData() {
    setLoadingProfile(true)
    try {
      const res = await fetch(`/api/db`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'reseller_orders',
          op: 'select',
          select: '*, products(code, name, photo_urls)',
          filters: [{ type: 'eq', col: 'customer_id', val: customer.id }]
        })
      })
      const data = await res.json()
      setProfileOrders(data || [])
    } catch {} finally {
      setLoadingProfile(false)
    }
  }

  async function handleBriefImageUpload(files: FileList | null) {
    if (!files) return
    setUploadingImage(true)
    for (const f of Array.from(files)) {
      try {
        const url = await uploadToCloudinary(f)
        setBriefImages(prev => [...prev, url])
      } catch (err: any) {
        alert('Image upload failed: ' + err.message)
      }
    }
    setUploadingImage(false)
  }

  function handleAddToCart() {
    const cartItem = {
      id: selectedProduct.id,
      code: selectedProduct.code,
      name: selectedProduct.name,
      photo_url: selectedProduct.photo_urls?.[0],
      quantity: 1,
      selling_price: estimatedPrice || selectedProduct.selling_price_rupees,
      ring_size: selectedProduct.category?.toLowerCase() === 'necklace' || selectedProduct.category?.toLowerCase() === 'pendant' ? null : selectedSize,
      custom_attributes: {
        karat: `${selectedKarat}K`,
        custom_notes: customNotes,
        reference_images: briefImages
      }
    }

    setCart(prev => {
      const idx = prev.findIndex(
        i =>
          i.id === cartItem.id &&
          i.ring_size === cartItem.ring_size &&
          i.custom_attributes.karat === cartItem.custom_attributes.karat
      )
      if (idx > -1) {
        const copy = [...prev]
        copy[idx].quantity += 1
        return copy
      }
      return [...prev, cartItem]
    })

    setCustomNotes('')
    setBriefImages([])
    setSelectedProduct(null)
    setShowCartDrawer(true)
  }

  function updateCartQty(idx: number, delta: number) {
    setCart(prev => {
      const copy = [...prev]
      copy[idx].quantity = Math.max(copy[idx].quantity + delta, 1)
      return copy
    })
  }

  function removeFromCart(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx))
  }

  async function checkCoupon() {
    if (!promoCode.trim()) return
    try {
      const res = await fetch(`/api/r/${token}/coupons?code=${promoCode}`)
      const data = await res.json()
      if (data.valid) {
        setAppliedDiscount(data)
      } else {
        alert(data.error || 'Invalid promo code')
        setAppliedDiscount(null)
      }
    } catch {}
  }

  async function handleCheckoutSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCheckoutLoading(true)
    try {
      const checkoutPayload = {
        items: cart.map(i => ({
          id: i.id,
          quantity: i.quantity,
          ring_size: i.ring_size,
          custom_attributes: i.custom_attributes
        })),
        shipping_name: shippingName,
        shipping_phone: shippingPhone,
        shipping_address: shippingAddress,
        customer_notes: shippingNotes,
        promo_code: appliedDiscount?.code || null
      }

      const res = await fetch(`/api/r/${token}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutPayload)
      })

      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        setConfirmedOrders(data.orders || [])
        setCart([])
        setCheckoutStep(3)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setCheckoutLoading(false)
    }
  }

  async function handleEnquiryClick(product: any) {
    fetch(`/api/r/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enquiry_click' })
    }).catch(() => {})

    const message = `Hi! I'm interested in: *${product.name}* (SKU: ${product.code}) listed on your online store. Please share pricing and options!`
    const cleanPhone = reseller.phone.replace(/\D/g, '')
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  async function handleCallbackSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmittingCallback(true)
    setCallbackSuccess(false)

    try {
      const res = await fetch(`/api/r/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: callbackName,
          customer_phone: callbackPhone,
          customer_message: callbackMsg,
          product_id: selectedProduct?.id || null
        })
      })

      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        setCallbackSuccess(true)
        setCallbackName('')
        setCallbackPhone('')
        setCallbackMsg('')
        setTimeout(() => {
          setShowCallbackModal(false)
          setCallbackSuccess(false)
        }, 3500)
      }
    } catch (err: any) {
      alert('Error submitting callback request: ' + err.message)
    } finally {
      setSubmittingCallback(false)
    }
  }

  async function toggleWishlist(productId: string) {
    if (!customer) {
      setAuthStep(1)
      setShowAuthModal(true)
      return
    }
    const isSaved = profileWishlist.includes(productId)
    const newWishlist = isSaved
      ? profileWishlist.filter(id => id !== productId)
      : [...profileWishlist, productId]

    setProfileWishlist(newWishlist)

    try {
      await fetch(`/api/r/${token}/wishlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, action: isSaved ? 'remove' : 'add' })
      })
    } catch {}
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-stone-200 border-t-stone-850 animate-spin mx-auto"></div>
          <p className="text-stone-400 text-xs font-semibold tracking-widest uppercase animate-pulse">Loading Boutique...</p>
        </div>
      </div>
    )
  }

  if (error || !reseller) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white border border-stone-200 rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-md">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="font-bold text-stone-900 text-sm">Storefront Not Found</h2>
          <p className="text-stone-500 text-xs leading-relaxed">{error || 'Storefront does not exist.'}</p>
        </div>
      </div>
    )
  }

  const c = theme?.colors || {
    primary: '#1E3A5F',
    secondary: '#C9A86A',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#1C1917',
    borders: '#E7E5E4',
    accent: '#F59E0B'
  }
  const btnShape = theme?.buttons?.shape || 'rounded-xl'
  const btnShadow = theme?.buttons?.shadow || 'sm'
  const bgRgba = hexToRgba(c.background, 0.85)

  // Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.selling_price * item.quantity, 0)
  let cartTotal = cartSubtotal
  let discountAmount = 0
  if (appliedDiscount) {
    if (appliedDiscount.discount_type === 'percent') {
      discountAmount = Math.round(cartSubtotal * (appliedDiscount.discount_value / 100))
    } else {
      discountAmount = appliedDiscount.discount_value
    }
    cartTotal = Math.max(cartSubtotal - discountAmount, 0)
  }

  const categories = products ? ['all', ...Array.from(new Set(products.map(p => p.category)))] : []

  // Dynamic Section Finders
  const announcementSection = theme?.sections?.find((s: any) => s.type === 'announcement')
  const headerSection = theme?.sections?.find((s: any) => s.type === 'header')
  const footerSection = theme?.sections?.find((s: any) => s.type === 'footer')

  return (
    <div
      className="min-h-screen flex flex-col justify-between"
      style={{
        backgroundColor: c.background,
        color: c.text,
        fontFamily: `'Plus Jakarta Sans', sans-serif`
      }}
    >
      {/* Styles injector */}
      <style dangerouslySetInnerHTML={{
        __html: `
        :root {
          --primary-color: ${c.primary};
          --secondary-color: ${c.secondary};
          --bg-color: ${c.background};
          --surface-color: ${c.surface};
          --text-color: ${c.text};
          --borders-color: ${c.borders};
          --accent-color: ${c.accent};
        }
        body {
          background-color: var(--bg-color) !important;
          color: var(--text-color) !important;
          font-family: '${theme?.typography?.body || 'Plus Jakarta Sans'}', sans-serif !important;
        }
        h1, h2, h3, h4, h5, h6, .brand-font {
          font-family: '${theme?.typography?.heading || 'Plus Jakarta Sans'}', sans-serif !important;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        .header-blur {
          background-color: ${bgRgba} !important;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .btn-theme-fill {
          background-color: var(--primary-color) !important;
          color: #ffffff !important;
          border-radius: ${
            btnShape === 'rounded-none' ? '0px' :
            btnShape === 'rounded-md' ? '8px' :
            btnShape === 'rounded-xl' ? '16px' : '9999px'
          } !important;
          box-shadow: ${
            btnShadow === 'none' ? 'none' :
            btnShadow === 'sm' ? '0 1px 2px 0 rgba(0,0,0,0.05)' :
            btnShadow === 'md' ? '0 4px 12px -1px rgba(0,0,0,0.08)' : '0 10px 20px -3px rgba(0,0,0,0.1)'
          } !important;
          transition: all 0.2s ease-in-out;
        }
        .btn-theme-fill:hover {
          opacity: 0.95;
          transform: translateY(-0.5px);
        }
        .btn-theme-outline {
          border: 1px solid var(--primary-color) !important;
          background-color: transparent !important;
          color: var(--primary-color) !important;
          border-radius: ${
            btnShape === 'rounded-none' ? '0px' :
            btnShape === 'rounded-md' ? '8px' :
            btnShape === 'rounded-xl' ? '16px' : '9999px'
          } !important;
          transition: all 0.2s ease-in-out;
        }
        .btn-theme-outline:hover {
          background-color: var(--surface-color) !important;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 22s linear infinite;
        }
        `
      }} />

      {/* 1. Global Announcement Bar */}
      {announcementSection && announcementSection.visible && (
        <div style={{ backgroundColor: announcementSection.settings.bgColor || c.primary, color: announcementSection.settings.textColor || '#FFFFFF' }}>
          {announcementSection.settings.animation === 'marquee' ? (
            <div className="overflow-hidden whitespace-nowrap py-2 border-b flex relative" style={{ borderColor: c.borders }}>
              <div className="animate-marquee whitespace-nowrap flex gap-10 text-[10px] font-bold uppercase tracking-wider">
                <span>{announcementSection.settings.text}</span>
                <span>{announcementSection.settings.text}</span>
                <span>{announcementSection.settings.text}</span>
                <span>{announcementSection.settings.text}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-2 px-4 text-[10px] font-bold uppercase tracking-wider truncate border-b" style={{ borderColor: c.borders }}>
              {announcementSection.settings.text}
            </div>
          )}
        </div>
      )}

      {/* 2. Global Header */}
      {headerSection && headerSection.visible ? (
        <header
          className={`px-6 py-3.5 flex items-center justify-between border-b header-blur z-30 transition-all ${
            headerSection.settings.sticky ? 'sticky top-0 shadow-sm' : ''
          }`}
          style={{ borderColor: c.borders, backgroundColor: headerSection.settings.bgColor || bgRgba, color: headerSection.settings.textColor || c.text }}
        >
          <div className={`flex items-center gap-4 w-full justify-between`}>
            {/* Logo area */}
            <div className={`flex items-center gap-2 cursor-pointer`} onClick={() => setActiveTab('catalog')}>
              {theme?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={theme.logo_url} alt="" className="h-7 max-w-[130px] object-contain" />
              ) : (
                <span className="font-bold text-base tracking-widest uppercase brand-font" style={{ color: c.primary }}>
                  {theme?.store_name || reseller.store_name}
                </span>
              )}
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex gap-6 text-[10px] font-bold uppercase tracking-widest">
              {(headerSection.settings.navLinks || []).map((link: any, i: number) => (
                <a key={i} href={link.target} className="hover:opacity-70 transition-opacity">{link.label}</a>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowCartDrawer(true)}
                className="p-2 border rounded-xl hover:bg-stone-50/50 text-stone-700 relative"
                style={{ borderColor: c.borders }}
              >
                <ShoppingCart className="w-4 h-4" style={{ color: c.primary }} />
                {cart.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white font-bold text-[8px] rounded-full w-4 h-4 flex items-center justify-center">
                    {cart.reduce((sum, i) => sum + i.quantity, 0)}
                  </span>
                )}
              </button>

              {customer ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveTab(activeTab === 'catalog' ? 'profile' : 'catalog')}
                    className="p-2 border rounded-xl text-stone-750 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{ borderColor: c.borders, backgroundColor: activeTab === 'profile' ? c.surface : 'transparent' }}
                  >
                    <User className="w-4 h-4" />
                    <span className="hidden sm:inline">{customer.name.split(' ')[0]}</span>
                  </button>
                  <button onClick={handleLogout} className="p-2 text-stone-400 hover:text-stone-700 text-xxs font-bold uppercase tracking-wider">
                    Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAuthStep(1)
                    setShowAuthModal(true)
                  }}
                  className="p-2 border rounded-xl text-stone-700 hover:bg-stone-50/40 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider"
                  style={{ borderColor: c.borders }}
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign In</span>
                </button>
              )}

              <button
                onClick={() => {
                  setSelectedProduct(null)
                  setShowCallbackModal(true)
                }}
                className="hidden sm:block text-[9px] font-extrabold uppercase tracking-[0.15em] px-4 py-2.5 btn-theme-fill text-white"
              >
                Request Callback
              </button>
            </div>
          </div>
        </header>
      ) : (
        /* Fallback unbranded header if hidden or deleted */
        <div className="h-2"></div>
      )}

      {/* Tab Switcher */}
      {customer && (
        <div className="border-b flex justify-center bg-stone-50/20 shrink-0" style={{ borderColor: c.borders }}>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-5 py-3 text-xxs font-extrabold uppercase tracking-widest border-b-2 transition-all ${
              activeTab === 'catalog' ? 'text-[#1E3A5F]' : 'border-transparent text-stone-400'
            }`}
            style={{ borderBottomColor: activeTab === 'catalog' ? c.primary : 'transparent', color: activeTab === 'catalog' ? c.primary : undefined }}
          >
            Catalog Collections
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-5 py-3 text-xxs font-extrabold uppercase tracking-widest border-b-2 transition-all ${
              activeTab === 'profile' ? 'text-[#1E3A5F]' : 'border-transparent text-stone-400'
            }`}
            style={{ borderBottomColor: activeTab === 'profile' ? c.primary : 'transparent', color: activeTab === 'profile' ? c.primary : undefined }}
          >
            Orders & Saved
          </button>
        </div>
      )}

      {/* Main Page Body */}
      <main className="flex-1">
        {activeTab === 'catalog' ? (
          <div className="space-y-4">
            {theme?.sections?.map((section: any) => {
              if (!section.visible) return null
              // Skip shell components
              if (section.type === 'announcement' || section.type === 'header' || section.type === 'footer') return null

              switch (section.type) {
                case 'hero':
                  const heroSlide = section.settings.slides?.[0] || {}
                  return (
                    <section
                      key={section.id}
                      className="relative w-full h-[65vh] min-h-[360px] bg-stone-150 overflow-hidden flex items-center justify-center border-b"
                      style={{
                        backgroundImage: `url(${heroSlide.image})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        borderColor: c.borders
                      }}
                    >
                      <div 
                        className="absolute inset-0" 
                        style={{ 
                          backgroundColor: heroSlide.overlayColor || '#000000', 
                          opacity: (heroSlide.overlayOpacity || 30) / 100 
                        }}
                      ></div>
                      <div className="relative text-center text-white px-6 max-w-xl space-y-4">
                        {heroSlide.subtitle && (
                          <span className="text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase block opacity-85 text-stone-200">
                            {heroSlide.subtitle}
                          </span>
                        )}
                        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight leading-none" style={{ color: '#FFFFFF' }}>
                          {heroSlide.title}
                        </h1>
                        {heroSlide.ctaText && (
                          <div className="pt-2">
                            <a
                              href={heroSlide.ctaLink || '#shop'}
                              className="inline-block text-xxs font-bold border-b-2 border-white pb-1.5 uppercase tracking-[0.25em] hover:opacity-85 transition-opacity"
                            >
                              {heroSlide.ctaText}
                            </a>
                          </div>
                        )}
                      </div>
                    </section>
                  )

                case 'trust_bar':
                  return (
                    <section
                      key={section.id}
                      className="py-3.5 border-b overflow-hidden"
                      style={{ backgroundColor: section.settings.bgColor || c.surface, color: section.settings.textColor || c.text, borderColor: c.borders }}
                    >
                      {section.settings.animation === 'marquee' ? (
                        <div className="relative flex overflow-x-hidden">
                          <div className="animate-marquee whitespace-nowrap flex gap-12 text-[10px] font-bold uppercase tracking-[0.2em]">
                            {(section.settings.items || []).map((item: string, i: number) => (
                              <span key={i} className="mx-4">{item}</span>
                            ))}
                            {(section.settings.items || []).map((item: string, i: number) => (
                              <span key={`dup-${i}`} className="mx-4">{item}</span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap justify-center gap-6 md:gap-12 px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-center">
                          {(section.settings.items || []).map((item: string, i: number) => (
                            <span key={i}>{item}</span>
                          ))}
                        </div>
                      )}
                    </section>
                  )

                case 'category_grid':
                  return (
                    <section key={section.id} className="px-6 py-12 max-w-6xl mx-auto space-y-6">
                      {section.settings.title && (
                        <h3 className="text-xs font-bold text-center uppercase tracking-[0.25em]" style={{ color: c.primary }}>
                          {section.settings.title}
                        </h3>
                      )}
                      <div className={`grid grid-cols-2 sm:grid-cols-${section.settings.columns || 4} gap-4`}>
                        {(section.settings.items || []).map((item: any, i: number) => (
                          <div
                            key={i}
                            onClick={() => {
                              setCategoryFilter(item.category || 'all')
                              document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' })
                            }}
                            className="group aspect-[3/4] bg-stone-100 relative rounded-2xl overflow-hidden cursor-pointer border shadow-sm"
                            style={{ borderColor: c.borders }}
                          >
                            <div 
                              className="absolute inset-0 bg-cover bg-center group-hover:scale-103 transition-transform duration-500" 
                              style={{ backgroundImage: `url(${item.image})` }}
                            ></div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
                            <div className="absolute bottom-4 left-0 right-0 px-3 text-center">
                              <span className="text-xxs font-bold text-white uppercase tracking-[0.15em] block">
                                {item.name}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )

                case 'product_grid':
                  const filteredProducts = products.filter(p => {
                    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
                    const matchCat = categoryFilter === 'all' || p.category === categoryFilter
                    return matchSearch && matchCat
                  })
                  return (
                    <section key={section.id} id="shop" className="px-6 py-12 max-w-6xl mx-auto space-y-8 scroll-mt-20">
                      <div className="text-center space-y-2">
                        {section.settings.title && (
                          <h2 className="text-sm font-bold uppercase tracking-[0.25em]" style={{ color: c.primary }}>
                            {section.settings.title}
                          </h2>
                        )}
                        <div className="w-10 h-[1.5px] mx-auto" style={{ backgroundColor: c.secondary }}></div>
                      </div>

                      {/* Filter Search controls inside product section */}
                      <div className="space-y-4">
                        <div className="relative max-w-md mx-auto">
                          <Search className="absolute left-3.5 top-3 w-4 h-4 opacity-40" />
                          <input
                            type="text"
                            className="w-full pl-10 pr-4 py-2.5 text-xxs border rounded-xl focus:outline-none focus:ring-1 transition-all bg-white"
                            style={{ borderColor: c.borders, color: c.text }}
                            placeholder="Search catalog jewelry..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                          />
                        </div>

                        <div className="flex justify-center gap-2 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
                          {categories.map(cat => {
                            const active = categoryFilter === cat
                            return (
                              <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={`px-4.5 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-[0.15em] transition-all shrink-0 snap-start border ${
                                  active ? 'text-white' : 'bg-stone-50 border-stone-200 text-stone-500 hover:bg-stone-100'
                                }`}
                                style={{
                                  backgroundColor: active ? c.primary : c.background,
                                  borderColor: active ? c.primary : c.borders
                                }}
                              >
                                {cat === 'all' ? 'All Collections' : cat}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Grid Items */}
                      {filteredProducts.length === 0 ? (
                        <div className="text-center py-20 space-y-3 opacity-40">
                          <Package className="w-10 h-10 mx-auto stroke-1" />
                          <p className="text-xs font-semibold tracking-wider uppercase">No items found</p>
                        </div>
                      ) : (
                        <div className={`grid grid-cols-${section.settings.columnsMobile || 2} md:grid-cols-${section.settings.columnsDesktop || 4} gap-6`}>
                          {filteredProducts.map(p => {
                            const coverImg = p.photo_urls?.[0]
                            return (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setSelectedProduct(p)
                                  setSelectedKarat(p.ref_karat ? (parseInt(p.ref_karat) || 18) : 18)
                                  setSelectedSize('14')
                                  setEstimatedPrice(p.selling_price_rupees)
                                }}
                                className={`group bg-white overflow-hidden cursor-pointer flex flex-col justify-between transition-all duration-300 ${
                                  section.settings.cardStyle === 'bordered' ? 'border rounded-2xl p-2' :
                                  section.settings.cardStyle === 'shadow' ? 'shadow-md rounded-2xl' : 'hover:-translate-y-1'
                                }`}
                                style={{ backgroundColor: c.background, borderColor: c.borders }}
                              >
                                <div className="relative aspect-[4/5] bg-stone-50 overflow-hidden rounded-xl">
                                  {coverImg ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={coverImg}
                                      alt={p.name}
                                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                                    />
                                  ) : (
                                    <Package className="w-8 h-8 opacity-25 stroke-1" />
                                  )}
                                  
                                  {section.settings.showWishlist && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleWishlist(p.id);
                                      }}
                                      className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-sm text-xxs transition-transform active:scale-90"
                                    >
                                      <Heart className={`w-3.5 h-3.5 ${profileWishlist.includes(p.id) ? 'fill-red-500 text-red-500' : 'text-stone-400'}`} />
                                    </button>
                                  )}
                                </div>

                                <div className="pt-3.5 pb-2 px-1 flex-1 flex flex-col justify-between space-y-2">
                                  <div>
                                    <div className="flex justify-between items-center text-[9px] font-bold font-mono opacity-50 tracking-wider">
                                      <span>{p.code}</span>
                                    </div>
                                    <h4 className="text-[11px] font-semibold tracking-wide leading-relaxed line-clamp-2 mt-1" style={{ color: c.text }}>
                                      {p.name}
                                    </h4>
                                  </div>

                                  <div className="flex justify-between items-center pt-2.5 border-t" style={{ borderColor: c.borders }}>
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="text-xs font-black tracking-tight" style={{ color: c.primary }}>
                                        ₹{p.selling_price_rupees.toLocaleString('en-IN')}
                                      </span>
                                      {section.settings.showOriginalPrice && (
                                        <span className="text-[9px] line-through text-stone-400">
                                          ₹{Math.round(p.selling_price_rupees * 1.5).toLocaleString('en-IN')}
                                        </span>
                                      )}
                                    </div>
                                    {section.settings.showQuickView && (
                                      <button className="text-[8px] font-extrabold uppercase tracking-widest border border-stone-300 py-1.5 px-3 rounded-lg hover:bg-stone-50 transition-colors">
                                        Configure
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </section>
                  )

                case 'editorial':
                  const ed = section.settings
                  return (
                    <section key={section.id} className="py-16 px-6" style={{ backgroundColor: ed.bgColor || c.surface }}>
                      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8 items-center">
                        {ed.imagePosition === 'left' && ed.image && (
                          <div className="w-full md:w-1/2 aspect-[4/3] md:aspect-square bg-stone-200 rounded-2xl overflow-hidden shrink-0 border" style={{ borderColor: c.borders, backgroundImage: `url(${ed.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                        )}
                        <div className="flex-1 space-y-4 text-center md:text-left flex flex-col items-center md:items-start justify-center">
                          {ed.title && (
                            <h3 className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: c.primary }}>
                              {ed.title}
                            </h3>
                          )}
                          {ed.description && (
                            <p className="text-xs leading-relaxed font-light opacity-80" style={{ color: ed.textColor || c.text }}>
                              {ed.description}
                            </p>
                          )}
                          {ed.ctaText && (
                            <div className="pt-2">
                              <a
                                href={ed.ctaLink || '#shop'}
                                className="inline-block text-xxs font-bold border-b-2 border-stone-900 pb-1 uppercase tracking-[0.2em]"
                                style={{ borderColor: c.primary, color: c.primary }}
                              >
                                {ed.ctaText}
                              </a>
                            </div>
                          )}
                        </div>
                        {ed.imagePosition === 'right' && ed.image && (
                          <div className="w-full md:w-1/2 aspect-[4/3] md:aspect-square bg-stone-200 rounded-2xl overflow-hidden shrink-0 border" style={{ borderColor: c.borders, backgroundImage: `url(${ed.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                        )}
                      </div>
                    </section>
                  )

                case 'video':
                  return (
                    <section key={section.id} className="w-full relative overflow-hidden bg-black aspect-video max-h-[450px]">
                      {section.settings.videoUrl && (
                        <video
                          src={section.settings.videoUrl}
                          autoPlay={section.settings.autoplay !== false}
                          loop={section.settings.loop !== false}
                          muted={section.settings.muted !== false}
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      )}
                    </section>
                  )

                case 'testimonials':
                  return (
                    <section key={section.id} className="py-16 px-6 text-center space-y-8" style={{ backgroundColor: section.settings.bgColor || c.background }}>
                      {section.settings.title && (
                        <h3 className="text-xxs font-bold tracking-[0.3em] uppercase text-stone-400">
                          {section.settings.title}
                        </h3>
                      )}
                      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                        {(section.settings.reviews || []).map((rev: any, i: number) => (
                          <div key={i} className="p-6 bg-white rounded-2xl border flex flex-col justify-between space-y-4 shadow-sm" style={{ borderColor: c.borders }}>
                            <div className="flex justify-center text-amber-500 gap-0.5">
                              {Array.from({ length: rev.rating || 5 }).map((_, j) => (
                                <Star key={j} className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                              ))}
                            </div>
                            <p className="text-xs leading-relaxed italic opacity-85">"{rev.text}"</p>
                            <span className="text-[10px] font-bold text-stone-500 block uppercase tracking-wider">— {rev.author}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )

                case 'newsletter':
                  return (
                    <section key={section.id} className="py-16 px-6 text-center" style={{ backgroundColor: section.settings.bgColor || c.surface, color: section.settings.textColor || c.text }}>
                      <div className="max-w-md mx-auto space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-[0.25em]">{section.settings.title}</h3>
                        <p className="text-xs font-light opacity-80 leading-relaxed">{section.settings.description}</p>
                        <div className="flex gap-2 max-w-sm mx-auto pt-2">
                          <input
                            type="email"
                            placeholder={section.settings.placeholder}
                            className="flex-1 px-4 py-2 border rounded-xl text-xs bg-white focus:outline-none"
                            style={{ borderColor: c.borders }}
                          />
                          <button
                            type="button"
                            className="btn-theme-fill text-xxs tracking-wider uppercase font-bold px-5 py-2.5"
                          >
                            Join
                          </button>
                        </div>
                      </div>
                    </section>
                  )

                default:
                  return null
              }
            })}
          </div>
        ) : (
          /* Customer Profile Portal */
          <div className="max-w-4xl w-full mx-auto px-6 py-8 space-y-8 flex-1">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold font-serif text-[#1E3A5F]" style={{ color: c.primary }}>Customer Portal</h2>
              <p className="text-stone-400 text-xs font-light">Manage your past orders and personal profile details.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Left panel: Info */}
              <div className="space-y-6">
                <div className="bg-white p-5 border rounded-2xl shadow-sm space-y-4" style={{ borderColor: c.borders }}>
                  <h3 className="font-bold text-xs uppercase tracking-wider opacity-60">Profile details</h3>
                  <div className="space-y-2 text-xs">
                    <p className="font-semibold text-stone-850">{customer.name}</p>
                    <p className="text-stone-500">{customer.phone}</p>
                    {customer.email && <p className="text-stone-500">{customer.email}</p>}
                  </div>
                </div>
              </div>

              {/* Right panel: Order history */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white p-6 border rounded-2xl shadow-sm space-y-4" style={{ borderColor: c.borders }}>
                  <h3 className="font-bold text-xs uppercase tracking-wider opacity-60">Order History</h3>
                  
                  {loadingProfile ? (
                    <p className="text-stone-400 text-xs italic py-8 text-center animate-pulse">Loading orders...</p>
                  ) : profileOrders.length === 0 ? (
                    <p className="text-stone-400 text-xs italic py-8 text-center">You haven't placed any orders on this store yet.</p>
                  ) : (
                    <div className="space-y-4 divide-y divide-stone-100">
                      {profileOrders.map((o: any) => (
                        <div key={o.id} className="pt-4 first:pt-0 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-mono text-xs font-bold text-stone-900">{o.order_number}</span>
                              <span className="block text-[10px] text-stone-400 mt-0.5">Ordered {new Date(o.created_at).toLocaleDateString('en-IN')}</span>
                            </div>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              o.status === 'delivered' ? 'bg-green-50 text-green-700 border border-green-200' :
                              o.status === 'dispatched' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              o.status === 'cancelled' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {o.status.replace(/_/g, ' ')}
                            </span>
                          </div>

                          <div className="flex gap-3 items-center">
                            {o.products?.photo_urls?.[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={o.products.photo_urls[0]} className="w-10 h-10 object-cover rounded border" alt="" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-stone-50 border flex items-center justify-center text-stone-300">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                            <div className="flex-1 text-xs">
                              <p className="font-semibold text-stone-850">{o.products?.name}</p>
                              <p className="text-stone-400 mt-0.5">Karat: {o.custom_attributes?.karat || '18K'} · Qty: {o.quantity}</p>
                            </div>
                            <p className="font-bold text-stone-855 text-xs">₹{(o.customer_selling_price_paise / 100).toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Global Footer */}
      {footerSection && footerSection.visible ? (
        <footer
          className="mt-12 px-6 py-12 border-t text-xxs"
          style={{ borderColor: c.borders, backgroundColor: footerSection.settings.bgColor || c.surface, color: footerSection.settings.textColor || c.text }}
        >
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-left">
            {(footerSection.settings.columns || []).map((col: any, i: number) => (
              <div key={i} className="space-y-3">
                <h4 className="font-bold uppercase tracking-wider opacity-90">{col.title}</h4>
                <ul className="space-y-1.5 opacity-75">
                  {(col.links || []).map((l: any, j: number) => (
                    <li key={j}>
                      <a href={l.target} className="hover:underline">{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="space-y-3 col-span-2 md:col-span-1">
              <h4 className="font-bold uppercase tracking-wider opacity-90">Boutique Store</h4>
              <p className="opacity-75 leading-relaxed font-light">
                Discover a curation of hand-crafted masterworks designed for life's precious moments. Configure metal, size, or request personal custom orders.
              </p>
            </div>
          </div>
          <div className="w-full h-[1px] bg-stone-200/20 my-6" />
          <p className="opacity-40 text-[9px] tracking-wider uppercase">
            {footerSection.settings.copyright
              .replace('{store_name}', theme?.store_name || reseller.store_name)
              .replace('{year}', new Date().getFullYear())}
          </p>
        </footer>
      ) : (
        /* Fallback unbranded footer if hidden */
        <div className="h-4"></div>
      )}

      {/* OTP Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-sm bg-white rounded-t-[2.5rem] sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold font-serif text-[#1E3A5F]" style={{ color: c.primary }}>Storefront Login</h3>
              <button onClick={() => setShowAuthModal(false)} className="p-1 border rounded-lg text-stone-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {authStep === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <p className="text-stone-500 text-xs font-light leading-relaxed">
                  Enter your mobile number to sign in or sign up. We will log OTP code to console in simulated environment.
                </p>
                <div>
                  <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Full Name (New Users)</label>
                  <input
                    type="text"
                    className="w-full border rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    placeholder="e.g. Priya Sharma"
                    value={authName}
                    onChange={e => setAuthName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">WhatsApp Phone Number *</label>
                  <input
                    type="tel"
                    className="w-full border rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    placeholder="e.g. +91 98765 43210"
                    value={authPhone}
                    onChange={e => setAuthPhone(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3.5 text-xs font-bold text-white btn-theme-fill flex justify-center items-center gap-1.5"
                >
                  {authLoading ? 'Sending...' : 'Request OTP Code'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <p className="text-stone-500 text-xs font-light leading-relaxed">
                  Verification OTP code sent to {authPhone}. Input code below.
                </p>
                <div>
                  <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">6-Digit Verification Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    className="w-full border rounded-xl px-3 py-2.5 text-xs text-center font-mono font-bold tracking-[0.5em] outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    placeholder="123456"
                    value={authCode}
                    onChange={e => setAuthCode(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthStep(1)}
                    className="flex-1 py-3 text-xs font-bold btn-theme-outline"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="flex-1 py-3 text-xs font-bold text-white btn-theme-fill"
                  >
                    {authLoading ? 'Verifying...' : 'Sign In'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Persistent Shopping Cart Drawer */}
      {showCartDrawer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-end p-0">
          <div className="w-full sm:max-w-md h-full bg-white shadow-2xl flex flex-col p-6 justify-between">
            <div className="space-y-6 flex-1 flex flex-col overflow-hidden">
              <div className="flex justify-between items-center shrink-0">
                <h3 className="text-base font-bold font-serif text-[#1E3A5F]" style={{ color: c.primary }}>Shopping Basket</h3>
                <button onClick={() => setShowCartDrawer(false)} className="p-1 border rounded-lg text-stone-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-20 space-y-2 opacity-40 flex-1 flex flex-col justify-center">
                  <ShoppingCart className="w-10 h-10 mx-auto stroke-1" />
                  <p className="text-xs font-semibold uppercase tracking-wider">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4 divide-y divide-stone-100 overflow-y-auto flex-1 pr-1 scrollbar-none">
                  {cart.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="pt-4 first:pt-0 flex gap-3.5 items-start">
                      {item.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.photo_url} className="w-12 h-15 object-cover rounded border" alt="" />
                      ) : (
                        <div className="w-12 h-15 rounded bg-stone-50 border flex items-center justify-center text-stone-300 shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                      <div className="flex-1 text-xs space-y-1">
                        <h4 className="font-semibold text-stone-800 line-clamp-1">{item.name}</h4>
                        <p className="text-stone-400 font-mono text-[9px] uppercase tracking-wider">Karat: {item.custom_attributes?.karat || '18K'} {item.ring_size && `· Size: ${item.ring_size}`}</p>
                        {item.custom_attributes?.custom_notes && (
                          <p className="text-stone-500 text-[10px] bg-stone-50 p-1.5 rounded border border-stone-100 mt-1 italic leading-relaxed">"{item.custom_attributes.custom_notes}"</p>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center border rounded-lg bg-stone-50">
                            <button onClick={() => updateCartQty(idx, -1)} className="p-1 hover:bg-stone-150 text-stone-500"><Minus className="w-3 h-3" /></button>
                            <span className="px-2 text-xxs font-bold">{item.quantity}</span>
                            <button onClick={() => updateCartQty(idx, 1)} className="p-1 hover:bg-stone-150 text-stone-500"><Plus className="w-3 h-3" /></button>
                          </div>
                          <button onClick={() => removeFromCart(idx)} className="p-1 hover:bg-red-50 text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black" style={{ color: c.primary }}>₹{(item.selling_price * item.quantity).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="pt-4 border-t space-y-4 shrink-0" style={{ borderColor: c.borders }}>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xxs font-bold text-stone-500">
                    <span>Basket Subtotal</span>
                    <span>₹{cartSubtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {appliedDiscount && (
                    <div className="flex justify-between items-center text-xxs font-bold text-green-700 bg-green-50 px-2 py-1 rounded">
                      <span>Discount ({appliedDiscount.code})</span>
                      <span>- ₹{discountAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs font-bold border-t pt-2" style={{ borderColor: c.borders }}>
                    <span>Total Amount</span>
                    <span className="text-sm font-black" style={{ color: c.primary }}>₹{cartTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {!customer ? (
                    <button
                      onClick={() => {
                        setShowCartDrawer(false)
                        setAuthStep(1)
                        setShowAuthModal(true)
                      }}
                      className="w-full py-3.5 btn-theme-fill text-white font-bold text-xs uppercase tracking-wider flex justify-center items-center gap-1.5"
                    >
                      Login to checkout
                      <Lock className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setShowCartDrawer(false)
                        setCheckoutStep(1)
                        setShowCheckoutModal(true)
                      }}
                      className="w-full py-3.5 btn-theme-fill text-white font-bold text-xs uppercase tracking-wider flex justify-center items-center gap-1.5 animate-pulse"
                    >
                      Proceed to checkout
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Wizard Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white rounded-t-[2.5rem] sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col p-6 space-y-6 max-h-[90vh] overflow-y-auto scrollbar-none">
            <div className="flex justify-between items-center shrink-0">
              <h3 className="text-base font-bold font-serif text-[#1E3A5F]" style={{ color: c.primary }}>
                Checkout {checkoutStep < 3 && `(Step ${checkoutStep} of 2)`}
              </h3>
              {checkoutStep < 3 && (
                <button onClick={() => setShowCheckoutModal(false)} className="p-1 border rounded-lg text-stone-400">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {checkoutStep === 1 && (
              <form onSubmit={(e) => { e.preventDefault(); setCheckoutStep(2) }} className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider opacity-60">Shipping & Delivery Details</h4>
                <div>
                  <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Consignee Full Name *</label>
                  <input
                    type="text"
                    className="w-full border rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    placeholder="Ramesh Kumar"
                    value={shippingName}
                    onChange={e => setShippingName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">WhatsApp Phone Number *</label>
                  <input
                    type="tel"
                    className="w-full border rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    placeholder="+91 98765 43210"
                    value={shippingPhone}
                    onChange={e => setShippingPhone(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Delivery Address *</label>
                  <textarea
                    className="w-full border rounded-xl px-3 py-2.5 text-xs h-20 resize-none outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    placeholder="Street, Landmark, City, State, Pincode"
                    value={shippingAddress}
                    onChange={e => setShippingAddress(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Special Delivery Notes</label>
                  <input
                    type="text"
                    className="w-full border rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    placeholder="Deliver between 2 PM to 5 PM"
                    value={shippingNotes}
                    onChange={e => setShippingNotes(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3.5 btn-theme-fill text-white font-bold text-xs uppercase tracking-wider flex justify-center items-center gap-1.5"
                >
                  Continue to Payment
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            {checkoutStep === 2 && (
              <form onSubmit={handleCheckoutSubmit} className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider opacity-60">Payment Protocol</h4>
                  <div className="p-4 bg-stone-50 border rounded-2xl space-y-3" style={{ backgroundColor: c.surface, borderColor: c.borders }}>
                    <p className="text-[11px] leading-relaxed text-stone-600 font-light">
                      Please transfer the checkout total directly to <strong>{reseller.owner_name}</strong> via UPI or Cash. Your order enters production once payment is authenticated by our desk.
                    </p>
                    <div className="space-y-1.5 text-xs font-semibold">
                      <p className="text-[#1E3A5F]" style={{ color: c.primary }}>Store UPI: {reseller.upi_id || 'TBD'}</p>
                      {reseller.bank_name && (
                        <p className="text-stone-500">
                          Bank: {reseller.bank_name} <br/>
                          A/C: {reseller.account_number} <br/>
                          IFSC: {reseller.ifsc_code}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold pt-3 border-t">
                    <span className="opacity-60">Due Amount</span>
                    <span className="text-sm font-black" style={{ color: c.primary }}>₹{cartTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutStep(1)}
                    className="flex-1 py-3 text-xs font-bold btn-theme-outline"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={checkoutLoading}
                    className="flex-1 py-3 text-xs font-bold text-white btn-theme-fill"
                  >
                    {checkoutLoading ? 'Placing Order...' : 'Confirm Order'}
                  </button>
                </div>
              </form>
            )}

            {checkoutStep === 3 && (
              <div className="text-center space-y-5 py-4">
                <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center border border-green-200 mx-auto">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold font-serif text-stone-900">Order Successfully Placed</h4>
                  <p className="text-[10px] text-stone-400">Your order will be verified shortly by our boutique desk.</p>
                </div>

                <div className="bg-stone-50 p-4 rounded-2xl border text-left text-xs font-mono space-y-1" style={{ backgroundColor: c.surface, borderColor: c.borders }}>
                  <p className="font-semibold text-stone-500 uppercase tracking-wider text-[9px] mb-2 font-sans">Placed Orders</p>
                  {confirmedOrders.map((o: any) => (
                    <div key={o.id} className="flex justify-between font-bold">
                      <span>Order Ref:</span>
                      <span className="text-[#1E3A5F]" style={{ color: c.primary }}>{o.order_number}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => {
                      const message = `Hi! I just placed an order on your storefront. Here are the Order Ref(s): ${confirmedOrders.map(o => o.order_number).join(', ')}. Please verify and confirm.`
                      const cleanPhone = reseller.phone.replace(/\D/g, '')
                      window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank')
                    }}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Share on WhatsApp
                  </button>
                  <button
                    onClick={() => {
                      setShowCheckoutModal(false)
                      if (customer) {
                        setActiveTab('profile')
                      }
                    }}
                    className="w-full py-3.5 btn-theme-outline font-bold text-xs uppercase tracking-wider"
                  >
                    Return to Storefront
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Product detail drawer */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-xl h-[85vh] sm:h-auto sm:max-h-[90vh] bg-white rounded-t-[2.5rem] sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between">
            <div className="w-12 h-1 bg-stone-300 rounded-full mx-auto my-3.5 sm:hidden shrink-0" />

            <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: c.borders }}>
              <div>
                <span className="text-[9px] font-bold font-mono opacity-50 tracking-wider">{selectedProduct.code}</span>
                <h4 className="font-bold text-sm tracking-wide mt-0.5">{selectedProduct.name}</h4>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 border rounded-xl hover:bg-stone-50 text-stone-500 transition-colors"
                style={{ borderColor: c.borders }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 scrollbar-none flex-1">
              <div className="aspect-[4/5] bg-stone-50 rounded-2xl overflow-hidden flex items-center justify-center border" style={{ borderColor: c.borders }}>
                {selectedProduct.photo_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedProduct.photo_urls[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-12 h-12 opacity-20 stroke-1" />
                )}
              </div>

              {selectedProduct.description && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Description</p>
                  <p className="text-xs leading-relaxed opacity-85 font-light">{selectedProduct.description}</p>
                </div>
              )}

              {/* Made-to-order configurator inputs */}
              <div className="p-4 border rounded-2xl space-y-4" style={{ backgroundColor: c.surface, borderColor: c.borders }}>
                <h5 className="font-bold text-xs uppercase tracking-wider opacity-60">Personalization Configuration</h5>
                
                {/* Gold Karat Selection */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">Select Gold Karat</label>
                  <div className="flex gap-2">
                    {[14, 18, 22].map(k => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setSelectedKarat(k)}
                        className={`flex-1 py-2 text-xs font-bold border rounded-xl transition-all ${
                          selectedKarat === k ? 'text-white' : 'bg-white text-stone-600'
                        }`}
                        style={{
                          backgroundColor: selectedKarat === k ? c.primary : undefined,
                          borderColor: selectedKarat === k ? c.primary : c.borders
                        }}
                      >
                        {k}K Gold
                      </button>
                    ))}
                  </div>
                </div>

                {/* Size Selection */}
                {selectedProduct.category?.toLowerCase() !== 'necklace' && selectedProduct.category?.toLowerCase() !== 'pendant' && (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">Select Ring Size (India)</label>
                    <div className="relative">
                      <select
                        value={selectedSize}
                        onChange={e => setSelectedSize(e.target.value)}
                        className="w-full bg-white border rounded-xl px-3 py-2.5 text-xs outline-none appearance-none cursor-pointer"
                        style={{ borderColor: c.borders }}
                      >
                        {Array.from({ length: 20 }, (_, i) => String(i + 6)).map(s => (
                          <option key={s} value={s}>Size {s}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 absolute right-3 top-3.5 opacity-55 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Custom briefs design upload */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">Custom Design Brief / notes</label>
                  <textarea
                    className="w-full bg-white border rounded-xl px-3 py-2 text-xs h-16 resize-none outline-none"
                    style={{ borderColor: c.borders }}
                    placeholder="Specify special notes, customizations or engraving..."
                    value={customNotes}
                    onChange={e => setCustomNotes(e.target.value)}
                  />
                  
                  {/* Reference Image Upload */}
                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-stone-500 uppercase hover:text-stone-700">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Attach design photos ({briefImages.length})</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={e => handleBriefImageUpload(e.target.files)}
                        disabled={uploadingImage}
                      />
                    </label>

                    {briefImages.length > 0 && (
                      <div className="flex gap-1.5 overflow-x-auto py-1">
                        {briefImages.map((img, idx) => (
                          <div key={idx} className="relative w-10 h-10 border rounded overflow-hidden shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} className="w-full h-full object-cover" alt="" />
                            <button
                              onClick={() => setBriefImages(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Specifications */}
              {selectedProduct.attributes && Object.keys(selectedProduct.attributes).length > 0 && (
                <div className="space-y-3 pt-4 border-t" style={{ borderColor: c.borders }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Specifications</p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    {Object.entries(selectedProduct.attributes).map(([k, v]) => (
                      <div key={k} className="border-b pb-1.5" style={{ borderColor: c.borders }}>
                        <dt className="opacity-45 text-[9px] uppercase tracking-wider">{k.replace(/_/g, ' ')}</dt>
                        <dd className="font-bold text-stone-900 mt-1">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/* Product Reviews */}
              <div className="space-y-4 pt-4 border-t" style={{ borderColor: c.borders }}>
                <div className="flex justify-between items-center">
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Customer reviews ({reviews.length})</p>
                  <button onClick={() => setShowReviewForm(!showReviewForm)} className="text-[9px] font-bold uppercase text-[#1E3A5F]" style={{ color: c.primary }}>
                    {showReviewForm ? 'Cancel' : 'Write Review'}
                  </button>
                </div>

                {showReviewForm && (
                  <form onSubmit={handleReviewSubmit} className="space-y-3 p-4 bg-stone-50 rounded-2xl border" style={{ borderColor: c.borders }}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-stone-400 uppercase">Rating:</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setNewRating(r)}
                            className="p-0.5 text-amber-500 hover:scale-105"
                          >
                            <Star className={`w-4 h-4 ${newRating >= r ? 'fill-amber-500 text-amber-500' : 'text-stone-300'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <textarea
                        required
                        rows={2}
                        className="w-full p-2 border rounded-xl text-xs bg-white focus:outline-none"
                        style={{ borderColor: c.borders }}
                        placeholder="Write your honest review here..."
                        value={newReviewText}
                        onChange={e => setNewReviewText(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="btn-theme-fill text-xxs uppercase tracking-wider font-bold py-2 px-4 text-white"
                    >
                      {submittingReview ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </form>
                )}

                {loadingReviews ? (
                  <p className="text-center py-4 text-xxs font-bold text-stone-400">Loading reviews...</p>
                ) : reviews.length === 0 ? (
                  <p className="text-center py-4 text-xxs italic text-stone-400 font-light">No reviews posted yet.</p>
                ) : (
                  <div className="space-y-3.5 divide-y divide-stone-100">
                    {reviews.map((r, i) => (
                      <div key={i} className="pt-3.5 first:pt-0 space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-stone-800">{r.reseller_storefront_customers?.name || 'Verified Buyer'}</span>
                          <div className="flex gap-0.5">
                            {Array.from({ length: r.rating }).map((_, idx) => (
                              <Star key={idx} className="w-3 h-3 fill-amber-500 text-amber-500" />
                            ))}
                          </div>
                        </div>
                        <p className="opacity-80 leading-relaxed font-light">"{r.review_text}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t flex items-center justify-between gap-4 shrink-0 bg-stone-50/50" style={{ borderColor: c.borders }}>
              <div className="flex flex-col">
                <span className="text-[8px] font-bold opacity-45 uppercase tracking-wider">Estimated Price</span>
                <span className="text-lg font-black tracking-tight" style={{ color: c.primary }}>
                  ₹{(estimatedPrice || selectedProduct.selling_price_rupees).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEnquiryClick(selectedProduct)}
                  className="btn-theme-outline font-bold text-xxs tracking-wider uppercase py-3 px-5 flex items-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" /> Ask
                </button>
                <button
                  onClick={handleAddToCart}
                  className="btn-theme-fill text-white font-bold text-xxs tracking-wider uppercase py-3 px-6"
                >
                  Add To Basket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Callback Request Modal */}
      {showCallbackModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-sm bg-white rounded-t-[2.5rem] sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col p-6 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold font-serif text-[#1E3A5F]" style={{ color: c.primary }}>Bespoke Callback</h3>
              <button onClick={() => setShowCallbackModal(false)} className="p-1 border rounded-lg text-stone-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {callbackSuccess ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center border border-green-200 mx-auto">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-stone-900">Request Logged</h4>
                <p className="text-[10px] text-stone-400 max-w-[200px] mx-auto">Our boutique specialist will contact you on WhatsApp shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleCallbackSubmit} className="space-y-4">
                <p className="text-stone-500 text-xs font-light leading-relaxed">
                  Submit your details and request a personalized design callback.
                </p>
                <div>
                  <label className="block text-[9px] font-bold text-stone-400 uppercase mb-1">Your Name *</label>
                  <input
                    type="text"
                    className="w-full border rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    placeholder="e.g. Shalini Roy"
                    value={callbackName}
                    onChange={e => setCallbackName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-stone-400 uppercase mb-1">WhatsApp Mobile *</label>
                  <input
                    type="tel"
                    className="w-full border rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    placeholder="e.g. +91 99999 88888"
                    value={callbackPhone}
                    onChange={e => setCallbackPhone(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-stone-400 uppercase mb-1">Inquiry details / specifications</label>
                  <textarea
                    rows={2}
                    className="w-full border rounded-xl p-2 text-xs outline-none focus:ring-1 focus:ring-amber-500 bg-white resize-none"
                    placeholder="Specify metal changes, budgets or karat options..."
                    value={callbackMsg}
                    onChange={e => setCallbackMsg(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingCallback}
                  className="w-full py-3 text-xs font-bold text-white btn-theme-fill flex justify-center items-center gap-1.5"
                >
                  {submittingCallback ? 'Submitting...' : 'Register Callback'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
