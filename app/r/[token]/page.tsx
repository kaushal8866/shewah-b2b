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

  // Carts (survives refresh via localStorage + database sync)
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
        // In simulation, we immediately populate OTP code field for ease
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
    setLoadingProfile(false)
    // Fetch profile orders list
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
    } catch {}
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
      // Check if duplicate item exists
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

    // Reset brief states
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
        setCheckoutStep(3) // redirect to confirmation screen
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

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-stone-200 border-t-stone-800 animate-spin mx-auto"></div>
          <p className="text-stone-400 text-xs font-semibold tracking-widest uppercase">Loading collection...</p>
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

  const categories = products ? ['all', ...Array.from(new Set(products.map(p => p.category)))] : []

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter
    return matchesSearch && matchesCategory
  })

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

  return (
    <div
      className="min-h-screen flex flex-col justify-between"
      style={{
        backgroundColor: c.background,
        color: c.text,
        fontFamily: `'Plus Jakarta Sans', sans-serif`
      }}
    >
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
          font-family: 'Plus Jakarta Sans', sans-serif !important;
        }
        h1, h2, h3, h4, h5, h6, .brand-font {
          font-family: 'Cormorant Garamond', serif !important;
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
        `
      }} />

      {/* Header */}
      <header
        className="px-6 py-4 flex items-center justify-between sticky top-0 z-30 border-b header-blur transition-all duration-300"
        style={{ borderColor: c.borders }}
      >
        <div className="flex items-center gap-3">
          {theme?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.logo_url} alt="" className="h-8 max-w-[120px] object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-stone-50 border border-stone-200" style={{ backgroundColor: c.surface, borderColor: c.borders }}>
              <Sparkles className="w-4 h-4" style={{ color: c.secondary }} />
            </div>
          )}
          <span className="font-bold text-xl tracking-wide brand-font" style={{ color: c.primary }}>
            {theme?.store_name || reseller.store_name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Cart trigger button */}
          <button
            onClick={() => setShowCartDrawer(true)}
            className="p-2 border rounded-xl hover:bg-stone-50 text-stone-700 relative"
            style={{ borderColor: c.borders }}
          >
            <ShoppingCart className="w-4 h-4" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white font-bold text-[8px] rounded-full w-4 h-4 flex items-center justify-center">
                {cart.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            )}
          </button>

          {/* Profile Auth button */}
          {customer ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab(activeTab === 'catalog' ? 'profile' : 'catalog')}
                className="p-2 border rounded-xl text-stone-700 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ borderColor: c.borders, backgroundColor: activeTab === 'profile' ? c.surface : 'transparent' }}
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{customer.name.split(' ')[0]}</span>
              </button>
              <button onClick={handleLogout} className="p-2 text-stone-400 hover:text-stone-700 text-xs font-semibold">
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setAuthStep(1)
                setShowAuthModal(true)
              }}
              className="p-2 border rounded-xl text-stone-700 hover:bg-stone-50 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
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
            className="hidden sm:block text-[10px] font-bold uppercase tracking-[0.15em] px-4 py-2.5 btn-theme-fill text-white"
          >
            Request Callback
          </button>
        </div>
      </header>

      {/* Tab Switcher if customer logged in */}
      {customer && (
        <div className="border-b flex justify-center bg-stone-50/40" style={{ borderColor: c.borders }}>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-6 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'catalog' ? 'border-[#1E3A5F] text-[#1E3A5F]' : 'border-transparent text-stone-400'
            }`}
            style={{ borderBottomColor: activeTab === 'catalog' ? c.primary : 'transparent', color: activeTab === 'catalog' ? c.primary : undefined }}
          >
            Shop Collection
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'profile' ? 'border-[#1E3A5F] text-[#1E3A5F]' : 'border-transparent text-stone-400'
            }`}
            style={{ borderBottomColor: activeTab === 'profile' ? c.primary : 'transparent', color: activeTab === 'profile' ? c.primary : undefined }}
          >
            My Orders & Saved
          </button>
        </div>
      )}

      {activeTab === 'catalog' ? (
        <>
          {/* Hero Banner Area */}
          <section
            className="relative px-6 py-20 text-center space-y-4 overflow-hidden border-b"
            style={{
              background: `linear-gradient(180deg, ${c.surface} 0%, ${c.background} 100%)`,
              borderColor: c.borders
            }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-gradient-to-tr from-amber-500/5 to-transparent blur-3xl pointer-events-none" />
            
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: c.secondary }}>
                The Fine Collection
              </span>
              <h1 className="text-3xl md:text-4xl font-extralight tracking-wide italic brand-font mt-2" style={{ color: c.primary }}>
                Bespoke Luxury Jewelry
              </h1>
            </div>
            
            <div className="w-12 h-[1px] mx-auto bg-stone-300" style={{ backgroundColor: c.secondary }} />
            
            <p className="text-xs opacity-75 max-w-sm mx-auto leading-relaxed font-light">
              Discover a curation of hand-crafted masterworks designed for life's precious moments. Configure metal, size, or request personal custom orders.
            </p>
          </section>

          {/* Filters & Search */}
          <div className="px-6 py-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 opacity-40" />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-3 text-xs border rounded-2xl focus:outline-none focus:ring-1 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.01)]"
                style={{
                  backgroundColor: c.background,
                  borderColor: c.borders,
                  color: c.text
                }}
                placeholder="Search our catalog..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Categories sliders list */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
              {categories.map(cat => {
                const active = categoryFilter === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-4.5 py-2 rounded-full text-[9px] font-bold uppercase tracking-[0.15em] transition-all shrink-0 snap-start border ${
                      active
                        ? 'text-white'
                        : 'bg-stone-50 border-stone-200 text-stone-500 hover:bg-stone-100'
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

          {/* Products Grid */}
          <div className="px-6 py-2 flex-1">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20 space-y-3 opacity-40">
                <Package className="w-10 h-10 mx-auto stroke-1" />
                <p className="text-xs font-semibold tracking-wider uppercase">No jewelry items found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredProducts.map(p => {
                  const coverImg = p.photo_urls?.[0]
                  return (
                    <div
                      key={p.id}
                      className="group rounded-3xl overflow-hidden border bg-white flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300"
                      style={{ backgroundColor: c.background, borderColor: c.borders }}
                    >
                      {/* Aspect image */}
                      <div
                        className="relative aspect-[4/5] bg-stone-50 flex items-center justify-center overflow-hidden cursor-pointer"
                        onClick={() => {
                          setSelectedProduct(p)
                          setSelectedKarat(18)
                          setSelectedSize('14')
                          setEstimatedPrice(p.selling_price_rupees)
                        }}
                      >
                        {coverImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={coverImg}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-103 transition-all duration-500"
                          />
                        ) : (
                          <Package className="w-10 h-10 opacity-20 stroke-1" />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.02] transition-colors duration-300" />
                      </div>

                      {/* Body details */}
                      <div className="p-4.5 space-y-3 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center text-[9px] font-bold font-mono opacity-50 tracking-wider">
                            <span>{p.code}</span>
                            {p.category && (
                              <span className="uppercase text-[8px] bg-stone-50 px-1.5 py-0.5 rounded-full border" style={{ backgroundColor: c.surface, borderColor: c.borders }}>
                                {p.category}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold leading-relaxed line-clamp-2 mt-1.5 cursor-pointer"
                            onClick={() => {
                              setSelectedProduct(p)
                              setSelectedKarat(18)
                              setSelectedSize('14')
                              setEstimatedPrice(p.selling_price_rupees)
                            }}
                            style={{ color: c.text }}>
                            {p.name}
                          </h4>
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t" style={{ borderColor: c.borders }}>
                          <div className="flex flex-col">
                            <span className="text-[8px] font-bold opacity-45 uppercase tracking-wider">Starting Price</span>
                            <span className="text-base font-black tracking-tight" style={{ color: c.primary }}>
                              ₹{p.selling_price_rupees.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedProduct(p)
                              setSelectedKarat(18)
                              setSelectedSize('14')
                              setEstimatedPrice(p.selling_price_rupees)
                            }}
                            className="p-3 rounded-xl btn-theme-fill text-white shrink-0 shadow-sm flex items-center justify-center"
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Customer Profile Order History & Saved Page */
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
                  <p className="font-semibold text-stone-800">{customer.name}</p>
                  <p className="text-stone-500">{customer.phone}</p>
                  {customer.email && <p className="text-stone-500">{customer.email}</p>}
                </div>
              </div>
            </div>

            {/* Right panel: Order history */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-6 border rounded-2xl shadow-sm space-y-4" style={{ borderColor: c.borders }}>
                <h3 className="font-bold text-xs uppercase tracking-wider opacity-60">Order History</h3>
                
                {profileOrders.length === 0 ? (
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
                            <p className="font-semibold text-stone-800">{o.products?.name}</p>
                            <p className="text-stone-400 mt-0.5">Karat: {o.custom_attributes?.karat || '18K'} · Qty: {o.quantity}</p>
                          </div>
                          <p className="font-bold text-stone-800 text-xs">₹{(o.customer_selling_price_paise / 100).toLocaleString('en-IN')}</p>
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

      {/* Footer */}
      <footer
        className="mt-12 px-6 py-10 border-t text-center space-y-4 text-xs"
        style={{ borderColor: c.borders, backgroundColor: c.surface }}
      >
        <div className="max-w-md mx-auto space-y-2">
          <p className="font-extrabold text-sm brand-font" style={{ color: c.primary }}>
            {theme?.store_name || reseller.store_name}
          </p>
          <p className="opacity-60 text-stone-500 font-light leading-relaxed">
            A premium white-labeled digital boutique partner. Discover high-end, customizable, and authentic jewelry masterworks.
          </p>
        </div>
        <div className="w-8 h-[1px] bg-stone-200 mx-auto" />
        <p className="opacity-40 text-[9px] tracking-wider uppercase">
          © {new Date().getFullYear()} {reseller.owner_name}. All rights reserved.
        </p>
      </footer>

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
                    className="w-full border rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-1"
                    placeholder="e.g. Priya Sharma"
                    value={authName}
                    onChange={e => setAuthName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">WhatsApp Phone Number *</label>
                  <input
                    type="tel"
                    className="w-full border rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-1"
                    placeholder="e.g. +91 98765 43210"
                    value={authPhone}
                    onChange={e => setAuthPhone(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 text-xs font-bold text-white btn-theme-fill flex justify-center items-center gap-1.5"
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
                    className="w-full border rounded-xl px-3 py-2.5 text-xs text-center font-mono font-bold tracking-[0.5em] outline-none focus:ring-1"
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
              <div className="flex justify-between items-center">
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
                      <div className="flex-1 min-w-0 text-xs space-y-1">
                        <p className="font-bold text-stone-800 truncate">{item.name}</p>
                        <p className="text-stone-400 text-[10px]">
                          Metal: {item.custom_attributes?.karat} {item.ring_size ? `· Size: ${item.ring_size}` : ''}
                        </p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateCartQty(idx, -1)} className="p-1 border rounded hover:bg-stone-50">
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="w-5 text-center font-bold">{item.quantity}</span>
                          <button onClick={() => updateCartQty(idx, 1)} className="p-1 border rounded hover:bg-stone-50">
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <p className="font-bold text-stone-800 text-xs">₹{(item.selling_price * item.quantity).toLocaleString('en-IN')}</p>
                        <button onClick={() => removeFromCart(idx)} className="text-stone-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5 ml-auto" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="pt-4 border-t space-y-4" style={{ borderColor: c.borders }}>
                {/* Promo Code Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border rounded-xl px-3 py-2 text-xs uppercase font-bold"
                    placeholder="Enter Coupon (e.g. SAVE10)"
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value)}
                  />
                  <button onClick={checkCoupon} className="px-4 py-2 text-xs font-bold btn-theme-outline">
                    Apply
                  </button>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-stone-500">
                    <span>Subtotal</span>
                    <span>₹{cartSubtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {appliedDiscount && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Promo Applied ({appliedDiscount.code})</span>
                      <span>- ₹{discountAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-sm text-stone-900 pt-2 border-t" style={{ borderColor: c.borders }}>
                    <span>Total Estimate</span>
                    <span>₹{cartTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowCartDrawer(false)
                    setShippingName(customer?.name || '')
                    setShippingPhone(customer?.phone || '')
                    setCheckoutStep(1)
                    setShowCheckoutModal(true)
                  }}
                  className="w-full py-3.5 btn-theme-fill text-white font-bold text-xs uppercase tracking-wider flex justify-center items-center gap-1.5"
                >
                  Proceed to Checkout
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
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
                    className="w-full border rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-1"
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
                    className="w-full border rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-1"
                    placeholder="+91 98765 43210"
                    value={shippingPhone}
                    onChange={e => setShippingPhone(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Delivery Address *</label>
                  <textarea
                    className="w-full border rounded-xl px-3 py-2.5 text-xs h-20 resize-none outline-none focus:ring-1"
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
                    className="w-full border rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-1"
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
                      Please transfer the checkout total directly to <strong>{reseller.owner_name}</strong> via UPI or Cash. Your order enters Shewah manufacturing once payment is authenticated by our desk.
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

                <button
                  onClick={() => {
                    setShowCheckoutModal(false)
                    if (customer) {
                      setActiveTab('profile')
                    }
                  }}
                  className="w-full py-3.5 btn-theme-fill text-white font-bold text-xs uppercase tracking-wider"
                >
                  Return to Storefront
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Made-to-order Product Detail Popup Drawer */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-300">
          <div
            className="w-full sm:max-w-lg rounded-t-[2.5rem] sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] transition-transform duration-300"
            style={{ backgroundColor: c.background }}
          >
            <div className="w-12 h-1 bg-stone-300 rounded-full mx-auto my-3.5 sm:hidden shrink-0" />

            {/* Header popup */}
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

            {/* Content popup */}
            <div className="p-6 overflow-y-auto space-y-6 scrollbar-none flex-1">
              {/* Product Cover image */}
              <div className="aspect-[4/5] bg-stone-50 rounded-2xl overflow-hidden flex items-center justify-center border" style={{ borderColor: c.borders }}>
                {selectedProduct.photo_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedProduct.photo_urls[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-12 h-12 opacity-20 stroke-1" />
                )}
              </div>

              {/* Description */}
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

                {/* Size Selection (Only if not a necklace/pendant) */}
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
                  <button onClick={() => setShowReviewForm(!showReviewForm)} className="text-[9px] font-bold uppercase text-[#1E3A5F]">
                    {showReviewForm ? 'Cancel' : 'Write Review'}
                  </button>
                </div>

                {showReviewForm && (
                  <form onSubmit={handleReviewSubmit} className="p-4 border rounded-2xl space-y-3 bg-stone-50" style={{ borderColor: c.borders }}>
                    <div className="flex gap-1.5 items-center">
                      <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Rating:</span>
                      {[1, 2, 3, 4, 5].map(r => (
                        <button key={r} type="button" onClick={() => setNewRating(r)}>
                          <Star className={`w-4 h-4 ${r <= newRating ? 'text-amber-500 fill-amber-500' : 'text-stone-300'}`} />
                        </button>
                      ))}
                    </div>
                    <textarea
                      required
                      placeholder="Share your thoughts about this piece..."
                      className="w-full border rounded-xl p-3 text-xs outline-none h-20 bg-white"
                      value={newReviewText}
                      onChange={e => setNewReviewText(e.target.value)}
                    />
                    <button type="submit" disabled={submittingReview} className="px-4 py-2 text-xs font-bold text-white btn-theme-fill">
                      {submittingReview ? 'Submitting...' : 'Post Review'}
                    </button>
                  </form>
                )}

                {loadingReviews ? (
                  <p className="text-stone-400 text-[10px] italic">Loading feedback...</p>
                ) : reviews.length === 0 ? (
                  <p className="text-stone-400 text-[10px] italic">No reviews yet for this product.</p>
                ) : (
                  <div className="space-y-3 divide-y divide-stone-100">
                    {reviews.map((r: any) => (
                      <div key={r.id} className="pt-3 first:pt-0 space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="font-bold text-stone-700">{r.customer?.name || 'Verified Buyer'}</span>
                          <span className="text-stone-400">{new Date(r.created_at).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div className="flex">
                          {Array.from({ length: r.rating }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 text-amber-500 fill-amber-500" />
                          ))}
                        </div>
                        <p className="text-xs text-stone-600 font-light">{r.review_text}</p>
                        {r.reseller_reply && (
                          <div className="pl-3 border-l-2 border-amber-300 text-[10px] text-stone-500 italic bg-amber-50/20 py-1">
                            <strong>Reply:</strong> "{r.reseller_reply}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Guarantees */}
              <div className="grid grid-cols-3 gap-2.5 pt-4 border-t text-[9px] text-center" style={{ borderColor: c.borders }}>
                <div className="p-2.5 bg-stone-50 rounded-2xl border flex flex-col items-center justify-center space-y-1" style={{ backgroundColor: c.surface, borderColor: c.borders }}>
                  <Award className="w-4 h-4 text-stone-600" style={{ color: c.secondary }} />
                  <span className="font-bold opacity-75">IGI Certified</span>
                </div>
                <div className="p-2.5 bg-stone-50 rounded-2xl border flex flex-col items-center justify-center space-y-1" style={{ backgroundColor: c.surface, borderColor: c.borders }}>
                  <ShieldCheck className="w-4 h-4 text-stone-600" style={{ color: c.secondary }} />
                  <span className="font-bold opacity-75">Pure Gold</span>
                </div>
                <div className="p-2.5 bg-stone-50 rounded-2xl border flex flex-col items-center justify-center space-y-1" style={{ backgroundColor: c.surface, borderColor: c.borders }}>
                  <Scale className="w-4 h-4 text-stone-600" style={{ color: c.secondary }} />
                  <span className="font-bold opacity-75">Secure Insured</span>
                </div>
              </div>
            </div>

            {/* Pricing & CTA */}
            <div className="p-6 border-t flex items-center justify-between bg-stone-50/10 shrink-0" style={{ borderColor: c.borders }}>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Price Estimate</p>
                <p className="text-lg font-black tracking-tight" style={{ color: c.primary }}>
                  ₹{(estimatedPrice || selectedProduct.selling_price_rupees).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCallbackName(customer?.name || '')
                    setCallbackPhone(customer?.phone || '')
                    setShowCallbackModal(true)
                  }}
                  className="px-4 py-2.5 text-xs font-bold btn-theme-outline"
                >
                  Callback
                </button>
                <button
                  onClick={handleAddToCart}
                  className="px-4.5 py-2.5 btn-theme-fill text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <ShoppingCart className="w-4 h-4" /> Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Callback Modal */}
      {showCallbackModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleCallbackSubmit}
            className="w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            style={{ backgroundColor: c.background }}
          >
            <div className="w-12 h-1 bg-stone-300 rounded-full mx-auto my-3.5 sm:hidden shrink-0" />

            {/* Header callback */}
            <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: c.borders }}>
              <div>
                <h4 className="font-bold text-sm tracking-wide">Request Callback</h4>
                <p className="text-[9px] opacity-60 mt-0.5">We will contact you on WhatsApp to discuss details.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCallbackModal(false)}
                className="p-1.5 border rounded-xl text-stone-500 transition-colors"
                style={{ borderColor: c.borders }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Callback */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {callbackSuccess ? (
                <div
                  className="p-5 rounded-2xl text-xs font-bold flex items-center gap-2 border"
                  style={{
                    backgroundColor: c.surface,
                    borderColor: c.borders,
                    color: c.primary
                  }}
                >
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  <span>Thank you! We will reach out to you shortly.</span>
                </div>
              ) : (
                <>
                  {selectedProduct && (
                    <div className="p-3 bg-stone-50 rounded-xl border flex items-center justify-between text-xs" style={{ backgroundColor: c.surface, borderColor: c.borders }}>
                      <span className="opacity-50">Inquiry Target SKU:</span>
                      <span className="font-bold">{selectedProduct.code}</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Your Full Name *</label>
                    <input
                      type="text"
                      className="w-full border rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:ring-1"
                      style={{ backgroundColor: c.background, borderColor: c.borders }}
                      placeholder="e.g. Ramesh Kumar"
                      value={callbackName}
                      onChange={e => setCallbackName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">WhatsApp Phone Number *</label>
                    <input
                      type="tel"
                      className="w-full border rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:ring-1"
                      style={{ backgroundColor: c.background, borderColor: c.borders }}
                      placeholder="e.g. +91 98765 43210"
                      value={callbackPhone}
                      onChange={e => setCallbackPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Your Message (Optional)</label>
                    <textarea
                      className="w-full border rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:ring-1 h-24 resize-none"
                      style={{ backgroundColor: c.background, borderColor: c.borders }}
                      placeholder="Specify customizing requests or preferences..."
                      value={callbackMsg}
                      onChange={e => setCallbackMsg(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            {!callbackSuccess && (
              <div className="p-6 border-t bg-stone-50/10 flex justify-end gap-2 shrink-0" style={{ borderColor: c.borders }}>
                <button
                  type="button"
                  onClick={() => setShowCallbackModal(false)}
                  className="px-4 py-2.5 border text-xs font-bold btn-theme-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCallback}
                  className="px-5 py-2.5 btn-theme-fill text-white text-xs font-bold disabled:opacity-50"
                >
                  {submittingCallback ? 'Submitting...' : 'Request Callback'}
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
