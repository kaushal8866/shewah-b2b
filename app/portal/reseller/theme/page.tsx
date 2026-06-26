'use client'

import { useEffect, useState } from 'react'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import { DEFAULT_HOMEPAGE_SECTIONS, SectionBlock } from '@/lib/defaultSections'
import {
  Palette,
  Save,
  Upload,
  RefreshCw,
  Camera,
  Smartphone,
  Laptop,
  Eye,
  EyeOff,
  Type,
  Layout,
  MousePointer,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  Plus,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Info
} from 'lucide-react'

const CURATED_PRESETS = [
  {
    name: 'Palmonas Minimal',
    colors: {
      primary: '#1C1917',
      secondary: '#C9A86A',
      background: '#FBF7F0',
      surface: '#FFFFFF',
      text: '#2A241B',
      borders: '#E8DFC9',
      accent: '#A88A4F'
    },
    typography: {
      heading: 'Plus Jakarta Sans',
      body: 'Plus Jakarta Sans',
      scale: 'medium'
    },
    buttons: {
      shape: 'rounded-none', // sharp
      style: 'fill',
      hover: 'darken',
      shadow: 'none'
    },
    layout: {
      density: 'comfortable',
      spacing: 'medium'
    }
  },
  {
    name: 'Midnight Onyx (Dark)',
    colors: {
      primary: '#D4AF37',
      secondary: '#FFFFFF',
      background: '#121212',
      surface: '#1E1E1E',
      text: '#F5F5F5',
      borders: '#2A2A2A',
      accent: '#D4AF37'
    },
    typography: {
      heading: 'Plus Jakarta Sans',
      body: 'Plus Jakarta Sans',
      scale: 'medium'
    },
    buttons: {
      shape: 'rounded-xl',
      style: 'outline',
      hover: 'darken',
      shadow: 'sm'
    },
    layout: {
      density: 'compact',
      spacing: 'medium'
    }
  },
  {
    name: 'Bold Modern',
    colors: {
      primary: '#111827',
      secondary: '#10B981',
      background: '#FFFFFF',
      surface: '#F3F4F6',
      text: '#111827',
      borders: '#E5E7EB',
      accent: '#F59E0B'
    },
    typography: {
      heading: 'Inter',
      body: 'Inter',
      scale: 'medium'
    },
    buttons: {
      shape: 'rounded-full', // pill
      style: 'fill',
      hover: 'darken',
      shadow: 'md'
    },
    layout: {
      density: 'spacious',
      spacing: 'medium'
    }
  }
]

const SECTION_LIBRARY = [
  { type: 'announcement', label: 'Announcement Bar', defaultSettings: { text: 'Free shipping on orders above ₹2000 | Ships in 24 hours', bgColor: '#1E3A5F', textColor: '#FFFFFF', fontSize: '11px', letterSpacing: 'wider', animation: 'marquee', isDismissible: false } },
  { type: 'hero', label: 'Hero Banner', defaultSettings: { autoplay: true, slides: [{ image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=1600', title: 'NEW LOOKS', subtitle: 'EXQUISITE QUALITY', ctaText: 'SHOP THE COLLECTION', ctaLink: '#shop', align: 'center', valign: 'center', overlayColor: '#000000', overlayOpacity: 40 }] } },
  { type: 'trust_bar', label: 'Trust signals Bar', defaultSettings: { bgColor: '#FBF7F0', textColor: '#1C1917', speed: 'normal', items: ['8L+ Happy Customers', 'Gifts For Her @ 50% OFF', 'Ships in 24 hours'] } },
  { type: 'category_grid', label: 'Category Grid', defaultSettings: { title: 'SHOP BY CATEGORY', columns: 4, items: [{ name: 'Rings', image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=600', category: 'ring' }, { name: 'Necklaces', image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=600', category: 'necklace' }] } },
  { type: 'product_grid', label: 'Product Grid', defaultSettings: { title: 'PALMONAS TOP STYLES', columnsDesktop: 4, columnsMobile: 2, showOriginalPrice: true, showDiscountBadge: true, showQuickView: true, showWishlist: true, cardStyle: 'minimal' } },
  { type: 'editorial', label: 'Editorial text & Image', defaultSettings: { title: 'OUR STORY', description: 'Crafted with premium materials and designed to feel comfortable for everyday wear.', image: 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?q=80&w=800', imagePosition: 'right', bgColor: '#FBF7F0', textColor: '#1C1917', ctaText: 'Explore Narrative', ctaLink: '#about' } },
  { type: 'video', label: 'Video Showcase', defaultSettings: { videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-jewelry-in-a-gift-box-41589-large.mp4', autoplay: true, loop: true, muted: true } },
  { type: 'testimonials', label: 'Customer Reviews', defaultSettings: { title: 'CUSTOMER TESTIMONIALS', bgColor: '#FFFFFF', reviews: [{ author: 'Karan S.', rating: 5, text: 'The best gold plating quality I have seen in demi-fine jewelry.' }] } },
  { type: 'newsletter', label: 'Newsletter Signup', defaultSettings: { title: 'NEWSLETTER', description: 'Be the first to hear about new launches.', bgColor: '#FBF7F0', textColor: '#1C1917', buttonBg: '#1E3A5F', buttonText: '#FFFFFF', placeholder: 'Enter your email' } }
]

export default function ResellerThemeEditor() {
  const [theme, setTheme] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [uploadingImage, setUploadingImage] = useState<string | null>(null)

  // Editor Panels State
  const [activeControlTab, setActiveControlTab] = useState<'sections' | 'globals' | 'presets'>('sections')
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [deviceViewport, setDeviceViewport] = useState<'desktop' | 'mobile'>('mobile')
  const [showAddSectionMenu, setShowAddSectionMenu] = useState(false)

  useEffect(() => {
    fetch('/api/portal/reseller/theme')
      .then(r => r.json())
      .then(data => {
        if (data.theme) {
          const loadedTheme = data.theme
          if (!loadedTheme.sections || !Array.isArray(loadedTheme.sections) || loadedTheme.sections.length === 0) {
            loadedTheme.sections = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_SECTIONS))
          }
          setTheme(loadedTheme)
        } else {
          setTheme({
            store_name: 'My Luxury Shop',
            logo_url: '',
            favicon_url: '',
            colors: { ...CURATED_PRESETS[0].colors },
            typography: { ...CURATED_PRESETS[0].typography },
            buttons: { ...CURATED_PRESETS[0].buttons },
            layout: { ...CURATED_PRESETS[0].layout },
            sections: JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_SECTIONS))
          })
        }
      })
      .catch(() => {
        setTheme({
          store_name: 'My Luxury Shop',
          logo_url: '',
          favicon_url: '',
          colors: { ...CURATED_PRESETS[0].colors },
          typography: { ...CURATED_PRESETS[0].typography },
          buttons: { ...CURATED_PRESETS[0].buttons },
          layout: { ...CURATED_PRESETS[0].layout },
          sections: JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_SECTIONS))
        })
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleLogoUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadingImage('logo')
    try {
      const url = await uploadToCloudinary(files[0])
      setTheme((prev: any) => ({ ...prev, logo_url: url }))
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploadingImage(null)
    }
  }

  async function handleFaviconUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadingImage('favicon')
    try {
      const url = await uploadToCloudinary(files[0])
      setTheme((prev: any) => ({ ...prev, favicon_url: url }))
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploadingImage(null)
    }
  }

  function setNestedPath(obj: any, path: string, value: any): any {
    const keys = path.split('.')
    let current = obj
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      const nextKey = keys[i + 1]
      const isNextKeyIndex = !isNaN(Number(nextKey))
      
      if (isNextKeyIndex) {
        if (!Array.isArray(current[key])) {
          current[key] = []
        }
      } else {
        if (typeof current[key] !== 'object' || current[key] === null) {
          current[key] = {}
        }
      }
      
      if (Array.isArray(current[key])) {
        current[key] = [...current[key]]
      } else {
        current[key] = { ...current[key] }
      }
      
      current = current[key]
    }
    
    const lastKey = keys[keys.length - 1]
    current[lastKey] = value
    return obj
  }

  async function handleSectionImageUpload(sectionId: string, path: string, files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadingImage(sectionId + '-' + path)
    try {
      const url = await uploadToCloudinary(files[0])
      setTheme((prev: any) => {
        const sectionsCopy = [...prev.sections]
        const secIndex = sectionsCopy.findIndex(s => s.id === sectionId)
        if (secIndex > -1) {
          const sec = { ...sectionsCopy[secIndex] }
          const settings = setNestedPath({ ...sec.settings }, path, url)
          
          sec.settings = settings
          sectionsCopy[secIndex] = sec
        }
        return { ...prev, sections: sectionsCopy }
      })
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploadingImage(null)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSuccess(false)
    try {
      const res = await fetch('/api/portal/reseller/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(theme)
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch (err: any) {
      alert('Error saving theme: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function applyPreset(preset: typeof CURATED_PRESETS[0]) {
    setTheme((prev: any) => ({
      ...prev,
      colors: { ...preset.colors },
      typography: { ...preset.typography },
      buttons: { ...preset.buttons },
      layout: { ...preset.layout }
    }))
  }

  // Section Ordering & Operations
  function moveSection(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= theme.sections.length) return
    
    setTheme((prev: any) => {
      const list = [...prev.sections]
      const temp = list[index]
      list[index] = list[targetIndex]
      list[targetIndex] = temp
      return { ...prev, sections: list }
    })
  }

  function toggleSectionVisibility(id: string) {
    setTheme((prev: any) => ({
      ...prev,
      sections: prev.sections.map((s: SectionBlock) => 
        s.id === id ? { ...s, visible: !s.visible } : s
      )
    }))
  }

  function deleteSection(id: string) {
    if (selectedSectionId === id) setSelectedSectionId(null)
    setTheme((prev: any) => ({
      ...prev,
      sections: prev.sections.filter((s: SectionBlock) => s.id !== id)
    }))
  }

  function duplicateSection(id: string) {
    setTheme((prev: any) => {
      const targetSec = prev.sections.find((s: SectionBlock) => s.id === id)
      if (!targetSec) return prev
      
      const newSec: SectionBlock = {
        ...targetSec,
        id: `${targetSec.type}-${Date.now()}`,
        settings: JSON.parse(JSON.stringify(targetSec.settings))
      }
      
      const targetIdx = prev.sections.findIndex((s: SectionBlock) => s.id === id)
      const list = [...prev.sections]
      list.splice(targetIdx + 1, 0, newSec)
      return { ...prev, sections: list }
    })
  }

  function addSection(type: string) {
    const libItem = SECTION_LIBRARY.find(item => item.type === type)
    if (!libItem) return
    
    const newSec: SectionBlock = {
      id: `${type}-${Date.now()}`,
      type,
      visible: true,
      settings: JSON.parse(JSON.stringify(libItem.defaultSettings))
    }
    
    setTheme((prev: any) => ({
      ...prev,
      sections: [...prev.sections, newSec]
    }))
    
    setSelectedSectionId(newSec.id)
    setShowAddSectionMenu(false)
  }

  if (loading) {
    return <div className="p-10 text-center text-stone-400 font-semibold animate-pulse text-sm">Initializing Brand Studio...</div>
  }

  const selectedSection = theme.sections.find((s: SectionBlock) => s.id === selectedSectionId)

  // Layout Tailwind Helpers
  const borderRad = theme.buttons.shape === 'rounded-none' ? 'rounded-none' :
                    theme.buttons.shape === 'rounded-md' ? 'rounded-md' :
                    theme.buttons.shape === 'rounded-xl' ? 'rounded-xl' : 'rounded-full'

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-stone-50 border-t border-stone-200">
      {/* Brand Studio Banner Action Header */}
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div>
          <h1 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <Palette className="w-5 h-5 text-amber-600" />
            Brand Studio &amp; Storefront Editor
          </h1>
          <p className="text-xxs text-stone-500 font-medium mt-0.5">
            Construct your White-Label storefront using customized editorial layout sections.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {success && (
            <span className="text-xxs font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 flex items-center gap-1.5 transition-all">
              <CheckCircle className="w-4 h-4 text-green-600" /> Theme published live!
            </span>
          )}
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-amber-650 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xxs tracking-wider uppercase py-2 px-5 rounded-xl shadow-sm transition-colors flex items-center gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Publish Live'}
          </button>
        </div>
      </div>

      {/* Editor Workplace Pane Split: 3 Panels */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* PANEL 1: LEFT PANEL (Global presets & Reorderable Layout Sections) */}
        <div className="w-[320px] bg-white border-r border-stone-200 flex flex-col shrink-0">
          
          {/* Sub Navigation tabs */}
          <div className="grid grid-cols-3 border-b border-stone-150 text-xxs font-bold uppercase tracking-wider text-center shrink-0">
            <button
              onClick={() => { setActiveControlTab('sections'); setSelectedSectionId(null) }}
              className={`py-3.5 ${activeControlTab === 'sections' ? 'text-amber-600 border-b-2 border-amber-600 bg-stone-50/50' : 'text-stone-500 hover:text-stone-850'}`}
            >
              Layout
            </button>
            <button
              onClick={() => { setActiveControlTab('globals'); setSelectedSectionId(null) }}
              className={`py-3.5 ${activeControlTab === 'globals' ? 'text-amber-600 border-b-2 border-amber-600 bg-stone-50/50' : 'text-stone-500 hover:text-stone-850'}`}
            >
              Styles
            </button>
            <button
              onClick={() => { setActiveControlTab('presets'); setSelectedSectionId(null) }}
              className={`py-3.5 ${activeControlTab === 'presets' ? 'text-amber-600 border-b-2 border-amber-600 bg-stone-50/50' : 'text-stone-500 hover:text-stone-850'}`}
            >
              Presets
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeControlTab === 'sections' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <h3 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">Storefront Layout</h3>
                  <div className="relative">
                    <button
                      onClick={() => setShowAddSectionMenu(!showAddSectionMenu)}
                      className="text-xxs font-extrabold bg-stone-900 hover:bg-stone-800 text-white rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Section
                    </button>
                    
                    {showAddSectionMenu && (
                      <div className="absolute left-0 mt-2 w-48 bg-white border border-stone-200 rounded-xl shadow-xl z-50 py-1.5 text-xxs font-semibold text-stone-700">
                        <div className="px-3 py-1 text-[10px] text-stone-400 font-bold uppercase tracking-wider border-b border-stone-100 mb-1">
                          Select Section
                        </div>
                        {SECTION_LIBRARY.map(lib => (
                          <button
                            key={lib.type}
                            onClick={() => addSection(lib.type)}
                            className="w-full text-left px-3 py-2 hover:bg-stone-50 hover:text-stone-900 transition-colors"
                          >
                            {lib.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  {theme.sections.map((section: SectionBlock, idx: number) => {
                    const isSelected = selectedSectionId === section.id
                    const displayLabel = SECTION_LIBRARY.find(l => l.type === section.type)?.label || section.type
                    return (
                      <div
                        key={section.id}
                        onClick={() => setSelectedSectionId(section.id)}
                        className={`group border rounded-xl p-2.5 flex items-center justify-between cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-amber-50/50 border-amber-400 shadow-sm' 
                            : 'bg-white border-stone-200 hover:bg-stone-50/80'
                        } ${!section.visible ? 'opacity-55' : ''}`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${section.visible ? 'bg-amber-500' : 'bg-stone-300'}`}></div>
                          <span className="text-xxs font-bold text-stone-800 truncate tracking-wide uppercase">
                            {displayLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            title="Move Up"
                            onClick={(e) => { e.stopPropagation(); moveSection(idx, 'up') }}
                            disabled={idx === 0}
                            className="p-1 hover:bg-stone-200 text-stone-500 rounded disabled:opacity-30"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            title="Move Down"
                            onClick={(e) => { e.stopPropagation(); moveSection(idx, 'down') }}
                            disabled={idx === theme.sections.length - 1}
                            className="p-1 hover:bg-stone-200 text-stone-500 rounded disabled:opacity-30"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            title="Toggle Visibility"
                            onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(section.id) }}
                            className="p-1 hover:bg-stone-200 text-stone-500 rounded"
                          >
                            {section.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </button>
                          <button
                            title="Duplicate"
                            onClick={(e) => { e.stopPropagation(); duplicateSection(section.id) }}
                            className="p-1 hover:bg-stone-200 text-stone-500 rounded"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            title="Delete"
                            onClick={(e) => { e.stopPropagation(); deleteSection(section.id) }}
                            className="p-1 hover:bg-red-50 text-red-500 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {activeControlTab === 'globals' && (
              <div className="space-y-4">
                {/* Identity Settings */}
                <div className="space-y-3 bg-stone-50 border border-stone-200 p-3.5 rounded-xl">
                  <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider pb-1.5 border-b border-stone-200 flex items-center gap-1.5">
                    Store Identity
                  </h4>
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[9px] font-bold text-stone-500 uppercase mb-1">Storefront Name *</label>
                      <input
                        type="text"
                        className="w-full border border-stone-200 rounded-lg p-2 text-xxs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        value={theme.store_name}
                        onChange={e => setTheme((p: any) => ({ ...p, store_name: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-stone-500 uppercase mb-1">Store Logo</label>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-1 border border-stone-250 bg-white hover:bg-stone-50 text-stone-600 text-[10px] font-bold py-1.5 px-2.5 rounded-lg cursor-pointer shrink-0 shadow-xxs">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => handleLogoUpload(e.target.files)}
                            disabled={uploadingImage === 'logo'}
                          />
                          <Camera className="w-3 h-3 text-stone-500" />
                          {uploadingImage === 'logo' ? 'Uploading...' : 'Upload'}
                        </label>
                        <input
                          type="text"
                          className="w-full border border-stone-200 rounded-lg p-1.5 text-xxs bg-white focus:outline-none"
                          value={theme.logo_url || ''}
                          placeholder="Or logo URL..."
                          onChange={e => setTheme((p: any) => ({ ...p, logo_url: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-stone-500 uppercase mb-1">Store Favicon</label>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-1 border border-stone-250 bg-white hover:bg-stone-50 text-stone-600 text-[10px] font-bold py-1.5 px-2.5 rounded-lg cursor-pointer shrink-0 shadow-xxs">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => handleFaviconUpload(e.target.files)}
                            disabled={uploadingImage === 'favicon'}
                          />
                          <Camera className="w-3 h-3 text-stone-500" />
                          {uploadingImage === 'favicon' ? 'Uploading...' : 'Upload'}
                        </label>
                        <input
                          type="text"
                          className="w-full border border-stone-200 rounded-lg p-1.5 text-xxs bg-white focus:outline-none"
                          value={theme.favicon_url || ''}
                          placeholder="Or favicon URL..."
                          onChange={e => setTheme((p: any) => ({ ...p, favicon_url: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Styling Details */}
                <div className="space-y-3 bg-stone-50 border border-stone-200 p-3.5 rounded-xl text-xxs font-semibold">
                  <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider pb-1.5 border-b border-stone-200 flex items-center gap-1.5">
                    Typography &amp; Buttons
                  </h4>
                  
                  <div>
                    <label className="block text-[9px] font-bold text-stone-500 uppercase mb-1">Heading Font Family</label>
                    <select
                      className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none"
                      value={theme.typography.heading}
                      onChange={e => setTheme((p: any) => ({ ...p, typography: { ...p.typography, heading: e.target.value } }))}
                    >
                      <option value="Plus Jakarta Sans">Plus Jakarta Sans (Luxury Sans)</option>
                      <option value="Inter">Inter (Clean Sans)</option>
                      <option value="Playfair Display">Playfair Display (Serif)</option>
                      <option value="Lora">Lora (Elegant Serif)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-stone-500 uppercase mb-1">Button Corner Shape</label>
                    <select
                      className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none"
                      value={theme.buttons.shape}
                      onChange={e => setTheme((p: any) => ({ ...p, buttons: { ...p.buttons, shape: e.target.value } }))}
                    >
                      <option value="rounded-none">Square / Sharp</option>
                      <option value="rounded-md">Subtle Rounded (4px)</option>
                      <option value="rounded-xl">Comfortable Rounded (12px)</option>
                      <option value="rounded-full">Pill / Oval</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-stone-500 uppercase mb-1">Button Fill Style</label>
                    <select
                      className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none"
                      value={theme.buttons.style}
                      onChange={e => setTheme((p: any) => ({ ...p, buttons: { ...p.buttons, style: e.target.value } }))}
                    >
                      <option value="fill">Solid Fill</option>
                      <option value="outline">Outline / Bordered</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-stone-500 uppercase mb-1">Button Shadow</label>
                    <select
                      className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none"
                      value={theme.buttons.shadow}
                      onChange={e => setTheme((p: any) => ({ ...p, buttons: { ...p.buttons, shadow: e.target.value } }))}
                    >
                      <option value="none">None</option>
                      <option value="sm">Subtle Shadow</option>
                      <option value="md">Pronounced Shadow</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeControlTab === 'presets' && (
              <div className="space-y-3">
                <div className="text-xxs font-bold text-stone-400 uppercase tracking-widest pb-1 border-b">Theme Presets</div>
                <div className="grid grid-cols-1 gap-2.5 pt-1">
                  {CURATED_PRESETS.map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="border border-stone-200 hover:border-amber-500 p-3 rounded-xl text-left bg-stone-50 hover:bg-amber-50/10 transition-colors flex items-center justify-between gap-3 shadow-xxs"
                    >
                      <div className="flex flex-col">
                        <span className="text-xxs font-bold text-stone-850">{preset.name}</span>
                        <span className="text-[9px] text-stone-400 mt-0.5">{preset.typography.heading} · {preset.buttons.shape === 'rounded-none' ? 'Sharp' : 'Rounded'}</span>
                      </div>
                      <div className="flex gap-0.5 shrink-0 bg-white p-1 rounded-lg border border-stone-150">
                        <div className="w-3.5 h-3.5 rounded-full border border-stone-100" style={{ backgroundColor: preset.colors.background }}></div>
                        <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: preset.colors.primary }}></div>
                        <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: preset.colors.secondary }}></div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PANEL 2: CENTER PANEL (Storefront live interactive view canvas) */}
        <div className="flex-1 flex flex-col items-center bg-stone-100 border-r border-stone-200 overflow-hidden relative">
          
          {/* Top Bar Switcher Viewport toggle */}
          <div className="w-full bg-white border-b border-stone-200 py-2.5 px-4 flex items-center justify-between shrink-0 shadow-xxs">
            <div className="text-xxs font-extrabold text-stone-400 uppercase tracking-wider">Storefront Live Preview</div>
            
            <div className="flex items-center gap-1.5 border border-stone-200 rounded-lg p-0.5 bg-stone-50">
              <button
                onClick={() => setDeviceViewport('mobile')}
                className={`p-1.5 rounded-md flex items-center gap-1 text-xxs font-bold transition-all ${
                  deviceViewport === 'mobile' 
                    ? 'bg-white text-stone-900 shadow-sm' 
                    : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Mobile
              </button>
              <button
                onClick={() => setDeviceViewport('desktop')}
                className={`p-1.5 rounded-md flex items-center gap-1 text-xxs font-bold transition-all ${
                  deviceViewport === 'desktop' 
                    ? 'bg-white text-stone-900 shadow-sm' 
                    : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" /> Desktop
              </button>
            </div>
            
            <div className="w-20"></div> {/* Spacer for symmetry */}
          </div>

          {/* Interactive Screen container */}
          <div className="flex-1 w-full overflow-y-auto p-6 flex justify-center items-start">
            <div
              className={`transition-all bg-white shadow-2xl relative border border-stone-200 flex flex-col ${
                deviceViewport === 'mobile' 
                  ? 'w-[360px] min-h-[640px] rounded-[32px] border-[10px] border-stone-900 overflow-hidden' 
                  : 'w-full max-w-4xl min-h-[500px] rounded-lg overflow-hidden'
              }`}
              style={{
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontFamily: theme.typography.body
              }}
            >
              {/* Dynamic Theme Styles Injection */}
              <style>{`
                .preview-btn-primary {
                  background-color: ${theme.colors.primary};
                  color: ${theme.colors.background};
                  border: 1px solid ${theme.colors.primary};
                }
                .preview-btn-primary:hover {
                  opacity: 0.9;
                }
                .preview-btn-secondary {
                  border: 1px solid ${theme.colors.primary};
                  color: ${theme.colors.primary};
                  background-color: transparent;
                }
                .preview-btn-accent {
                  background-color: ${theme.colors.accent};
                  color: #FFFFFF;
                }
              `}</style>

              {/* Camera Notch for Mobile */}
              {deviceViewport === 'mobile' && (
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-28 h-4 bg-stone-900 rounded-full z-50"></div>
              )}

              {/* Simulated Screen Inner Container */}
              <div className={`flex-1 flex flex-col ${deviceViewport === 'mobile' ? 'pt-7' : ''}`}>
                {theme.sections.map((section: SectionBlock) => {
                  if (!section.visible) return null
                  const isSelected = selectedSectionId === section.id
                  const wrapperClass = `relative cursor-pointer transition-all border ${
                    isSelected ? 'border-amber-400 bg-amber-500/5 ring-2 ring-amber-400 z-10' : 'border-transparent hover:border-stone-300'
                  }`

                  switch (section.type) {
                    case 'announcement':
                      return (
                        <div
                          key={section.id}
                          onClick={() => setSelectedSectionId(section.id)}
                          className={wrapperClass}
                          style={{ backgroundColor: section.settings.bgColor || theme.colors.primary, color: section.settings.textColor || '#FFFFFF' }}
                        >
                          <div className="text-center py-2 px-4 text-xxs font-bold uppercase tracking-wider overflow-hidden truncate">
                            {section.settings.text}
                          </div>
                        </div>
                      )

                    case 'header':
                      return (
                        <div
                          key={section.id}
                          onClick={() => setSelectedSectionId(section.id)}
                          className={wrapperClass}
                          style={{ backgroundColor: section.settings.bgColor || '#FFFFFF', color: section.settings.textColor || theme.colors.text }}
                        >
                          <div className={`flex items-center justify-between px-4 py-3 border-b`} style={{ borderColor: theme.colors.borders }}>
                            <div className={`flex items-center gap-1.5 w-full ${section.settings.logoPosition === 'center' ? 'justify-center' : section.settings.logoPosition === 'right' ? 'justify-end' : 'justify-start'}`}>
                              {theme.logo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={theme.logo_url} alt="" className="h-4 object-contain" />
                              ) : (
                                <span className="text-xs font-black tracking-widest uppercase" style={{ color: theme.colors.primary }}>
                                  {theme.store_name}
                                </span>
                              )}
                            </div>
                          </div>
                          {deviceViewport === 'desktop' && (
                            <div className="flex justify-center gap-5 py-2 text-xxs font-bold uppercase tracking-widest border-b" style={{ borderColor: theme.colors.borders }}>
                              {(Array.isArray(section.settings.navLinks) ? section.settings.navLinks : []).map((link: any, i: number) => (
                                <span key={i} className="hover:text-stone-500">{link.label}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )

                    case 'hero':
                      const slide = (Array.isArray(section.settings.slides) ? section.settings.slides : [])[0] || {}
                      return (
                        <div
                          key={section.id}
                          onClick={() => setSelectedSectionId(section.id)}
                          className={`${wrapperClass} relative h-48 bg-stone-200 overflow-hidden flex items-center justify-center`}
                          style={{
                            backgroundImage: `url(${slide.image})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                        >
                          {/* Slide overlay */}
                          <div 
                            className="absolute inset-0" 
                            style={{ 
                              backgroundColor: slide.overlayColor || '#000000', 
                              opacity: (slide.overlayOpacity || 30) / 100 
                            }}
                          ></div>
                          
                          <div className="relative text-center text-white px-4 space-y-1">
                            <span className="text-[8px] font-bold tracking-widest uppercase block opacity-85">
                              {slide.subtitle || 'LIMITED TIME OFFER'}
                            </span>
                            <h2 className="text-lg font-black tracking-tight" style={{ fontFamily: theme.typography.heading }}>
                              {slide.title || 'FLAT ₹999'}
                            </h2>
                            {slide.ctaText && (
                              <span className="inline-block text-[9px] font-bold border-b border-white pb-0.5 pt-1 uppercase tracking-widest hover:opacity-85">
                                {slide.ctaText}
                              </span>
                            )}
                          </div>
                        </div>
                      )

                    case 'trust_bar':
                      return (
                        <div
                          key={section.id}
                          onClick={() => setSelectedSectionId(section.id)}
                          className={wrapperClass}
                          style={{ backgroundColor: section.settings.bgColor || theme.colors.surface, color: section.settings.textColor || theme.colors.text }}
                        >
                          <div className="flex justify-around items-center py-2 px-3 text-[8px] font-bold uppercase tracking-widest overflow-hidden border-b" style={{ borderColor: theme.colors.borders }}>
                            {(Array.isArray(section.settings.items) ? section.settings.items : []).slice(0, deviceViewport === 'mobile' ? 2 : 4).map((item: string, i: number) => (
                              <span key={i} className="flex items-center gap-1.5">
                                <CheckCircle className="w-2.5 h-2.5 text-stone-400" />
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )

                    case 'category_grid':
                      return (
                        <div
                          key={section.id}
                          onClick={() => setSelectedSectionId(section.id)}
                          className={`${wrapperClass} p-4 space-y-3`}
                        >
                          <h3 className="text-[10px] font-bold text-center uppercase tracking-widest" style={{ color: theme.colors.primary }}>
                            {section.settings.title || 'SHOP BY CATEGORY'}
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(Array.isArray(section.settings.items) ? section.settings.items : []).map((cat: any, i: number) => (
                              <div key={i} className="aspect-square bg-stone-100 relative rounded-lg overflow-hidden flex flex-col justify-end p-2 border" style={{ borderColor: theme.colors.borders }}>
                                <div className="absolute inset-0" style={{ backgroundImage: `url(${cat.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                <span className="relative text-[9px] font-bold text-white uppercase tracking-wider text-center block">{cat.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )

                    case 'product_grid':
                      return (
                        <div
                          key={section.id}
                          onClick={() => setSelectedSectionId(section.id)}
                          className={`${wrapperClass} p-4 space-y-4`}
                        >
                          <h3 className="text-[10px] font-bold text-center uppercase tracking-widest" style={{ color: theme.colors.primary }}>
                            {section.settings.title || 'PALMONAS TOP STYLES'}
                          </h3>
                          <div className={`grid ${deviceViewport === 'mobile' ? 'grid-cols-2' : 'grid-cols-4'} gap-3`}>
                            {/* Product Card 1 */}
                            <div className={`flex flex-col bg-white overflow-hidden rounded-xl border border-stone-150`}>
                              <div className="aspect-square bg-stone-50 flex items-center justify-center relative">
                                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-xxs">
                                  <span className="text-stone-400">♥</span>
                                </div>
                                <span className="text-[9px] text-stone-300">Product Photo</span>
                              </div>
                              <div className="p-2 space-y-1">
                                <h4 className="text-[10px] font-bold text-stone-850 truncate">Rose Tulip Necklace</h4>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-black text-stone-900">₹1,999</span>
                                  {section.settings.showOriginalPrice && (
                                    <span className="text-[9px] line-through text-stone-400">₹3,999</span>
                                  )}
                                  {section.settings.showDiscountBadge && (
                                    <span className="text-[8px] text-emerald-600 font-bold">(50% OFF)</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Product Card 2 */}
                            <div className={`flex flex-col bg-white overflow-hidden rounded-xl border border-stone-150`}>
                              <div className="aspect-square bg-stone-50 flex items-center justify-center relative">
                                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-xxs">
                                  <span className="text-stone-400">♥</span>
                                </div>
                                <span className="text-[9px] text-stone-300">Product Photo</span>
                              </div>
                              <div className="p-2 space-y-1">
                                <h4 className="text-[10px] font-bold text-stone-850 truncate">Classic Solitaire Ring</h4>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-black text-stone-900">₹2,499</span>
                                  {section.settings.showOriginalPrice && (
                                    <span className="text-[9px] line-through text-stone-400">₹4,999</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )

                    case 'editorial':
                      const ed = section.settings
                      return (
                        <div
                          key={section.id}
                          onClick={() => setSelectedSectionId(section.id)}
                          className={`${wrapperClass} p-4`}
                          style={{ backgroundColor: ed.bgColor || theme.colors.surface }}
                        >
                          <div className={`flex ${deviceViewport === 'desktop' ? 'flex-row' : 'flex-col'} gap-4 items-center`}>
                            {ed.imagePosition === 'left' && (
                              <div className="w-full sm:w-1/2 aspect-video sm:aspect-square bg-stone-200 rounded-lg overflow-hidden shrink-0" style={{ backgroundImage: `url(${ed.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                            )}
                            <div className="space-y-1.5 text-center sm:text-left flex-1">
                              <h3 className="text-[11px] font-bold tracking-widest uppercase" style={{ color: theme.colors.primary }}>{ed.title}</h3>
                              <p className="text-[9px] leading-relaxed opacity-80" style={{ color: ed.textColor || theme.colors.text }}>{ed.description}</p>
                              {ed.ctaText && (
                                <button type="button" className={`preview-btn-secondary text-[8px] font-bold tracking-wider uppercase px-3 py-1.5 ${borderRad}`}>
                                  {ed.ctaText}
                                </button>
                              )}
                            </div>
                            {ed.imagePosition === 'right' && (
                              <div className="w-full sm:w-1/2 aspect-video sm:aspect-square bg-stone-200 rounded-lg overflow-hidden shrink-0" style={{ backgroundImage: `url(${ed.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                            )}
                          </div>
                        </div>
                      )

                    case 'video':
                      return (
                        <div
                          key={section.id}
                          onClick={() => setSelectedSectionId(section.id)}
                          className={`${wrapperClass} h-36 bg-stone-900 flex items-center justify-center text-white`}
                        >
                          <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">Simulated Video Showcase</span>
                        </div>
                      )

                    case 'testimonials':
                      return (
                        <div
                          key={section.id}
                          onClick={() => setSelectedSectionId(section.id)}
                          className={`${wrapperClass} p-4 space-y-3 text-center`}
                          style={{ backgroundColor: section.settings.bgColor || '#FFFFFF' }}
                        >
                          <h3 className="text-[9px] font-extrabold tracking-widest uppercase text-stone-500">{section.settings.title || 'TESTIMONIALS'}</h3>
                          <div className="space-y-2">
                            {(Array.isArray(section.settings.reviews) ? section.settings.reviews : []).slice(0, 1).map((rev: any, i: number) => (
                              <div key={i} className="space-y-1">
                                <p className="text-[10px] italic opacity-85">"{rev.text}"</p>
                                <span className="text-[9px] font-bold block text-amber-600">— {rev.author}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )

                    case 'newsletter':
                      const news = section.settings
                      return (
                        <div
                          key={section.id}
                          onClick={() => setSelectedSectionId(section.id)}
                          className={`${wrapperClass} p-4 text-center space-y-2.5`}
                          style={{ backgroundColor: news.bgColor || theme.colors.surface, color: news.textColor || theme.colors.text }}
                        >
                          <div className="space-y-0.5">
                            <h3 className="text-[11px] font-bold uppercase tracking-widest">{news.title}</h3>
                            <p className="text-[9px] opacity-75">{news.description}</p>
                          </div>
                          <div className="flex gap-1.5 max-w-xs mx-auto">
                            <input type="text" placeholder={news.placeholder} className="border border-stone-200 p-1.5 rounded-lg text-xxs flex-1 bg-white focus:outline-none" disabled />
                            <button type="button" className={`preview-btn-primary text-[8px] font-bold tracking-wider uppercase px-3 py-1.5 ${borderRad}`}>Join</button>
                          </div>
                        </div>
                      )

                    case 'footer':
                      return (
                        <div
                          key={section.id}
                          onClick={() => setSelectedSectionId(section.id)}
                          className={`${wrapperClass} p-4 space-y-4 text-xxs`}
                          style={{ backgroundColor: section.settings.bgColor || '#1C1917', color: section.settings.textColor || '#FFFFFF' }}
                        >
                          <div className="grid grid-cols-3 gap-3 border-b pb-4 opacity-80" style={{ borderColor: theme.colors.borders }}>
                            {(Array.isArray(section.settings.columns) ? section.settings.columns : []).map((col: any, i: number) => (
                              <div key={i} className="space-y-1.5">
                                <h4 className="font-bold uppercase tracking-wider">{col.title}</h4>
                                <ul className="space-y-1 opacity-75 text-[10px]">
                                  {(Array.isArray(col.links) ? col.links : []).map((l: any, j: number) => (
                                    <li key={j}>{l.label}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                          <div className="text-[9px] opacity-60 text-center">
                            {(section.settings.copyright || 'Copyright © {year} {store_name}').replace('{store_name}', theme.store_name).replace('{year}', new Date().getFullYear())}
                          </div>
                        </div>
                      )

                    default:
                      return null
                  }
                })}
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 3: RIGHT PANEL (Contextual editor controls panel) */}
        <div className="w-[340px] bg-white border-l border-stone-200 flex flex-col shrink-0 overflow-y-auto p-4 space-y-4">
          {selectedSectionId ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Section Settings</span>
                  <h3 className="text-xs font-black text-stone-900 tracking-wide uppercase mt-0.5">
                    {SECTION_LIBRARY.find(l => l.type === selectedSection?.type)?.label || selectedSection?.type}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedSectionId(null)}
                  className="text-stone-400 hover:text-stone-600 text-xxs font-bold bg-stone-100 px-2 py-1 rounded-lg"
                >
                  Close
                </button>
              </div>

              {/* Announcement Editor */}
              {selectedSection?.type === 'announcement' && (
                <div className="space-y-3.5 text-xxs font-semibold text-stone-700">
                  <div>
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Message Text</label>
                    <textarea
                      rows={2}
                      className="w-full border border-stone-200 rounded-lg p-2 bg-stone-50 text-xxs focus:outline-none"
                      value={selectedSection.settings.text}
                      onChange={e => {
                        const textVal = e.target.value
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => 
                            s.id === selectedSectionId ? { ...s, settings: { ...s.settings, text: textVal } } : s
                          )
                        }))
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Bg Color</label>
                      <input
                        type="color"
                        className="w-full h-8 rounded-lg cursor-pointer border border-stone-200"
                        value={selectedSection.settings.bgColor}
                        onChange={e => {
                          const col = e.target.value
                          setTheme((prev: any) => ({
                            ...prev,
                            sections: prev.sections.map((s: SectionBlock) => 
                              s.id === selectedSectionId ? { ...s, settings: { ...s.settings, bgColor: col } } : s
                            )
                          }))
                        }}
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Text Color</label>
                      <input
                        type="color"
                        className="w-full h-8 rounded-lg cursor-pointer border border-stone-200"
                        value={selectedSection.settings.textColor}
                        onChange={e => {
                          const col = e.target.value
                          setTheme((prev: any) => ({
                            ...prev,
                            sections: prev.sections.map((s: SectionBlock) => 
                              s.id === selectedSectionId ? { ...s, settings: { ...s.settings, textColor: col } } : s
                            )
                          }))
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Header Editor */}
              {selectedSection?.type === 'header' && (
                <div className="space-y-3.5 text-xxs font-semibold text-stone-700">
                  <div>
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Logo Placement</label>
                    <select
                      className="w-full border border-stone-200 rounded-lg p-2 bg-stone-50 text-xxs focus:outline-none"
                      value={selectedSection.settings.logoPosition}
                      onChange={e => {
                        const val = e.target.value
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => 
                            s.id === selectedSectionId ? { ...s, settings: { ...s.settings, logoPosition: val } } : s
                          )
                        }))
                      }}
                    >
                      <option value="left">Left Align</option>
                      <option value="center">Center Align</option>
                      <option value="right">Right Align</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="header-sticky"
                      checked={selectedSection.settings.sticky}
                      onChange={e => {
                        const checked = e.target.checked
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => 
                            s.id === selectedSectionId ? { ...s, settings: { ...s.settings, sticky: checked } } : s
                          )
                        }))
                      }}
                    />
                    <label htmlFor="header-sticky" className="font-bold text-stone-600 uppercase tracking-wider cursor-pointer">Sticky Header on Scroll</label>
                  </div>
                </div>
              )}

              {/* Hero Banner Editor */}
              {selectedSection?.type === 'hero' && (
                <div className="space-y-4 text-xxs font-semibold text-stone-700">
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                    <div className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider">Slide Configuration</div>
                    
                    <div>
                      <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Hero Image (1600x600 recommended)</label>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-1 border border-stone-250 bg-white hover:bg-stone-50 text-stone-600 text-[10px] font-bold py-1.5 px-2.5 rounded-lg cursor-pointer shrink-0 shadow-xxs">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => handleSectionImageUpload(selectedSection.id, 'slides.0.image', e.target.files)}
                            disabled={uploadingImage === `${selectedSection.id}-slides.0.image`}
                          />
                          <Camera className="w-3.5 h-3.5" />
                          {uploadingImage === `${selectedSection.id}-slides.0.image` ? 'Uploading...' : 'Upload'}
                        </label>
                        <input
                          type="text"
                          className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none"
                          value={selectedSection.settings.slides?.[0]?.image || ''}
                          placeholder="Image URL..."
                          onChange={e => {
                            const url = e.target.value
                            setTheme((prev: any) => {
                              const list = [...prev.sections]
                              const secIdx = list.findIndex(s => s.id === selectedSectionId)
                              if (secIdx > -1) {
                                const slides = Array.isArray(list[secIdx].settings.slides) ? [...list[secIdx].settings.slides] : []
                                slides[0] = { ...slides[0], image: url }
                                list[secIdx].settings = { ...list[secIdx].settings, slides }
                              }
                              return { ...prev, sections: list }
                            })
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Main Heading (Bold numeral/offer)</label>
                      <input
                        type="text"
                        className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none font-bold"
                        value={selectedSection.settings.slides?.[0]?.title || ''}
                        onChange={e => {
                          const val = e.target.value
                          setTheme((prev: any) => {
                            const list = [...prev.sections]
                            const secIdx = list.findIndex(s => s.id === selectedSectionId)
                            if (secIdx > -1) {
                              const slides = Array.isArray(list[secIdx].settings.slides) ? [...list[secIdx].settings.slides] : []
                              slides[0] = { ...slides[0], title: val }
                              list[secIdx].settings = { ...list[secIdx].settings, slides }
                            }
                            return { ...prev, sections: list }
                          })
                        }}
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Sub-heading (Promo caps label)</label>
                      <input
                        type="text"
                        className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none font-bold"
                        value={selectedSection.settings.slides?.[0]?.subtitle || ''}
                        onChange={e => {
                          const val = e.target.value
                          setTheme((prev: any) => {
                            const list = [...prev.sections]
                            const secIdx = list.findIndex(s => s.id === selectedSectionId)
                            if (secIdx > -1) {
                              const slides = Array.isArray(list[secIdx].settings.slides) ? [...list[secIdx].settings.slides] : []
                              slides[0] = { ...slides[0], subtitle: val }
                              list[secIdx].settings = { ...list[secIdx].settings, slides }
                            }
                            return { ...prev, sections: list }
                          })
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">CTA Label</label>
                        <input
                          type="text"
                          className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none font-bold"
                          value={selectedSection.settings.slides?.[0]?.ctaText || ''}
                          onChange={e => {
                            const val = e.target.value
                            setTheme((prev: any) => {
                              const list = [...prev.sections]
                              const secIdx = list.findIndex(s => s.id === selectedSectionId)
                              if (secIdx > -1) {
                                const slides = Array.isArray(list[secIdx].settings.slides) ? [...list[secIdx].settings.slides] : []
                                slides[0] = { ...slides[0], ctaText: val }
                                list[secIdx].settings = { ...list[secIdx].settings, slides }
                              }
                              return { ...prev, sections: list }
                            })
                          }}
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Overlay Opacity %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none"
                          value={selectedSection.settings.slides?.[0]?.overlayOpacity || 30}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0
                            setTheme((prev: any) => {
                              const list = [...prev.sections]
                              const secIdx = list.findIndex(s => s.id === selectedSectionId)
                              if (secIdx > -1) {
                                const slides = Array.isArray(list[secIdx].settings.slides) ? [...list[secIdx].settings.slides] : []
                                slides[0] = { ...slides[0], overlayOpacity: val }
                                list[secIdx].settings = { ...list[secIdx].settings, slides }
                              }
                              return { ...prev, sections: list }
                            })
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Product Grid Editor */}
              {selectedSection?.type === 'product_grid' && (
                <div className="space-y-3.5 text-xxs font-semibold text-stone-700">
                  <div>
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Section Title</label>
                    <input
                      type="text"
                      className="w-full border border-stone-200 rounded-lg p-2 bg-stone-50 text-xxs focus:outline-none font-bold"
                      value={selectedSection.settings.title}
                      onChange={e => {
                        const titleVal = e.target.value
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => 
                            s.id === selectedSectionId ? { ...s, settings: { ...s.settings, title: titleVal } } : s
                          )
                        }))
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Desktop Columns</label>
                      <select
                        className="w-full border border-stone-200 rounded-lg p-2 bg-stone-50 text-xxs focus:outline-none"
                        value={selectedSection.settings.columnsDesktop}
                        onChange={e => {
                          const val = parseInt(e.target.value)
                          setTheme((prev: any) => ({
                            ...prev,
                            sections: prev.sections.map((s: SectionBlock) => 
                              s.id === selectedSectionId ? { ...s, settings: { ...s.settings, columnsDesktop: val } } : s
                            )
                          }))
                        }}
                      >
                        <option value={3}>3 Columns</option>
                        <option value={4}>4 Columns</option>
                        <option value={5}>5 Columns</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Mobile Columns</label>
                      <select
                        className="w-full border border-stone-200 rounded-lg p-2 bg-stone-50 text-xxs focus:outline-none"
                        value={selectedSection.settings.columnsMobile}
                        onChange={e => {
                          const val = parseInt(e.target.value)
                          setTheme((prev: any) => ({
                            ...prev,
                            sections: prev.sections.map((s: SectionBlock) => 
                              s.id === selectedSectionId ? { ...s, settings: { ...s.settings, columnsMobile: val } } : s
                            )
                          }))
                        }}
                      >
                        <option value={1}>1 Column</option>
                        <option value={2}>2 Columns</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-stone-150">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="grid-show-orig"
                        checked={selectedSection.settings.showOriginalPrice}
                        onChange={e => {
                          const val = e.target.checked
                          setTheme((prev: any) => ({
                            ...prev,
                            sections: prev.sections.map((s: SectionBlock) => 
                              s.id === selectedSectionId ? { ...s, settings: { ...s.settings, showOriginalPrice: val } } : s
                            )
                          }))
                        }}
                      />
                      <label htmlFor="grid-show-orig" className="font-bold text-stone-600 uppercase tracking-wider cursor-pointer">Show Original Price (Struckthrough)</label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="grid-show-badge"
                        checked={selectedSection.settings.showDiscountBadge}
                        onChange={e => {
                          const val = e.target.checked
                          setTheme((prev: any) => ({
                            ...prev,
                            sections: prev.sections.map((s: SectionBlock) => 
                              s.id === selectedSectionId ? { ...s, settings: { ...s.settings, showDiscountBadge: val } } : s
                            )
                          }))
                        }}
                      />
                      <label htmlFor="grid-show-badge" className="font-bold text-stone-600 uppercase tracking-wider cursor-pointer">Show Discount Percent Badge</label>
                    </div>
                  </div>
                </div>
              )}

              {/* Editorial Block Editor */}
              {selectedSection?.type === 'editorial' && (
                <div className="space-y-3.5 text-xxs font-semibold text-stone-700">
                  <div>
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Title</label>
                    <input
                      type="text"
                      className="w-full border border-stone-200 rounded-lg p-2 bg-stone-50 text-xxs focus:outline-none font-bold"
                      value={selectedSection.settings.title}
                      onChange={e => {
                        const titleVal = e.target.value
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => 
                            s.id === selectedSectionId ? { ...s, settings: { ...s.settings, title: titleVal } } : s
                          )
                        }))
                      }}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Narrative Description</label>
                    <textarea
                      rows={4}
                      className="w-full border border-stone-200 rounded-lg p-2 bg-stone-50 text-xxs focus:outline-none"
                      value={selectedSection.settings.description}
                      onChange={e => {
                        const val = e.target.value
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => 
                            s.id === selectedSectionId ? { ...s, settings: { ...s.settings, description: val } } : s
                          )
                        }))
                      }}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Editorial Image</label>
                    <div className="flex gap-2">
                      <label className="flex items-center gap-1 border border-stone-250 bg-white hover:bg-stone-50 text-stone-600 text-[10px] font-bold py-1.5 px-2.5 rounded-lg cursor-pointer shrink-0 shadow-xxs">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => handleSectionImageUpload(selectedSection.id, 'image', e.target.files)}
                          disabled={uploadingImage === `${selectedSection.id}-image`}
                        />
                        <Camera className="w-3.5 h-3.5" />
                        {uploadingImage === `${selectedSection.id}-image` ? 'Uploading...' : 'Upload'}
                      </label>
                      <input
                        type="text"
                        className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none"
                        value={selectedSection.settings.image || ''}
                        placeholder="Image URL..."
                        onChange={e => {
                          const url = e.target.value
                          setTheme((prev: any) => ({
                            ...prev,
                            sections: prev.sections.map((s: SectionBlock) => 
                              s.id === selectedSectionId ? { ...s, settings: { ...s.settings, image: url } } : s
                            )
                          }))
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Image Placement</label>
                      <select
                        className="w-full border border-stone-200 rounded-lg p-2 bg-stone-50 text-xxs focus:outline-none"
                        value={selectedSection.settings.imagePosition}
                        onChange={e => {
                          const val = e.target.value
                          setTheme((prev: any) => ({
                            ...prev,
                            sections: prev.sections.map((s: SectionBlock) => 
                              s.id === selectedSectionId ? { ...s, settings: { ...s.settings, imagePosition: val } } : s
                            )
                          }))
                        }}
                      >
                        <option value="left">Left Column</option>
                        <option value="right">Right Column</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Background Color</label>
                      <input
                        type="color"
                        className="w-full h-8 rounded-lg cursor-pointer border border-stone-200"
                        value={selectedSection.settings.bgColor}
                        onChange={e => {
                          const col = e.target.value
                          setTheme((prev: any) => ({
                            ...prev,
                            sections: prev.sections.map((s: SectionBlock) => 
                              s.id === selectedSectionId ? { ...s, settings: { ...s.settings, bgColor: col } } : s
                            )
                          }))
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Newsletter Editor */}
              {selectedSection?.type === 'newsletter' && (
                <div className="space-y-3.5 text-xxs font-semibold text-stone-700">
                  <div>
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Title</label>
                    <input
                      type="text"
                      className="w-full border border-stone-200 rounded-lg p-2 bg-stone-50 text-xxs focus:outline-none font-bold"
                      value={selectedSection.settings.title}
                      onChange={e => {
                        const val = e.target.value
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => 
                            s.id === selectedSectionId ? { ...s, settings: { ...s.settings, title: val } } : s
                          )
                        }))
                      }}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Description</label>
                    <textarea
                      rows={2}
                      className="w-full border border-stone-200 rounded-lg p-2 bg-stone-50 text-xxs focus:outline-none"
                      value={selectedSection.settings.description}
                      onChange={e => {
                        const val = e.target.value
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => 
                            s.id === selectedSectionId ? { ...s, settings: { ...s.settings, description: val } } : s
                          )
                        }))
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Trust Bar Editor */}
              {selectedSection?.type === 'trust_bar' && (
                <div className="space-y-3.5 text-xxs font-semibold text-stone-700">
                  <div>
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Background Color</label>
                    <input
                      type="color"
                      className="w-full h-8 rounded-lg cursor-pointer border border-stone-200"
                      value={selectedSection.settings.bgColor || '#FBF7F0'}
                      onChange={e => {
                        const col = e.target.value
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => 
                            s.id === selectedSectionId ? { ...s, settings: { ...s.settings, bgColor: col } } : s
                          )
                        }))
                      }}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Text Color</label>
                    <input
                      type="color"
                      className="w-full h-8 rounded-lg cursor-pointer border border-stone-200"
                      value={selectedSection.settings.textColor || '#1C1917'}
                      onChange={e => {
                        const col = e.target.value
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => 
                            s.id === selectedSectionId ? { ...s, settings: { ...s.settings, textColor: col } } : s
                          )
                        }))
                      }}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Scroll Speed</label>
                    <select
                      className="w-full border border-stone-200 rounded-lg p-2 bg-stone-50 text-xxs focus:outline-none"
                      value={selectedSection.settings.speed || 'normal'}
                      onChange={e => {
                        const val = e.target.value
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => 
                            s.id === selectedSectionId ? { ...s, settings: { ...s.settings, speed: val } } : s
                          )
                        }))
                      }}
                    >
                      <option value="slow">Slow</option>
                      <option value="normal">Normal</option>
                      <option value="fast">Fast</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Trust Signals Text (Up to 3)</label>
                    {(Array.isArray(selectedSection.settings.items) ? selectedSection.settings.items : []).map((item: string, idx: number) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          className="w-full border border-stone-200 rounded-lg p-2 bg-stone-50 text-xxs focus:outline-none font-bold"
                          value={item}
                          onChange={e => {
                            const val = e.target.value
                            setTheme((prev: any) => ({
                              ...prev,
                              sections: prev.sections.map((s: SectionBlock) => {
                                if (s.id === selectedSectionId) {
                                  const items = Array.isArray(s.settings.items) ? [...s.settings.items] : []
                                  items[idx] = val
                                  return { ...s, settings: { ...s.settings, items } }
                                }
                                return s
                              })
                            }))
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Grid Editor */}
              {selectedSection?.type === 'category_grid' && (
                <div className="space-y-3.5 text-xxs font-semibold text-stone-700">
                  <div>
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Section Title</label>
                    <input
                      type="text"
                      className="w-full border border-stone-200 rounded-lg p-2 bg-stone-50 text-xxs focus:outline-none font-bold"
                      value={selectedSection.settings.title || 'SHOP BY CATEGORY'}
                      onChange={e => {
                        const val = e.target.value
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => 
                            s.id === selectedSectionId ? { ...s, settings: { ...s.settings, title: val } } : s
                          )
                        }))
                      }}
                    />
                  </div>

                  <div className="space-y-3.5 border-t border-stone-150 pt-3">
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Categories List</label>
                    {(Array.isArray(selectedSection.settings.items) ? selectedSection.settings.items : []).map((cat: any, idx: number) => (
                      <div key={idx} className="border border-stone-200 rounded-xl p-3 bg-stone-50 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-stone-600 text-[10px] uppercase">Category {idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setTheme((prev: any) => ({
                                ...prev,
                                sections: prev.sections.map((s: SectionBlock) => {
                                  if (s.id === selectedSectionId) {
                                    const items = (Array.isArray(s.settings.items) ? s.settings.items : []).filter((_: any, i: number) => i !== idx)
                                    return { ...s, settings: { ...s.settings, items } }
                                  }
                                  return s
                                })
                              }))
                            }}
                            className="text-red-500 hover:text-red-700 font-bold uppercase text-[9px]"
                          >
                            Remove
                          </button>
                        </div>

                        <div>
                          <label className="block text-stone-400 font-semibold mb-0.5">Category Name</label>
                          <input
                            type="text"
                            className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none font-bold"
                            value={cat.name}
                            onChange={e => {
                              const val = e.target.value
                              setTheme((prev: any) => ({
                                ...prev,
                                sections: prev.sections.map((s: SectionBlock) => {
                                  if (s.id === selectedSectionId) {
                                    const items = Array.isArray(s.settings.items) ? [...s.settings.items] : []
                                    items[idx] = { ...items[idx], name: val }
                                    return { ...s, settings: { ...s.settings, items } }
                                  }
                                  return s
                                })
                              }))
                            }}
                          />
                        </div>

                        <div>
                          <label className="block text-stone-400 font-semibold mb-0.5">Target Category ID/Slug</label>
                          <select
                            className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none"
                            value={cat.category}
                            onChange={e => {
                              const val = e.target.value
                              setTheme((prev: any) => ({
                                ...prev,
                                sections: prev.sections.map((s: SectionBlock) => {
                                  if (s.id === selectedSectionId) {
                                    const items = Array.isArray(s.settings.items) ? [...s.settings.items] : []
                                    items[idx] = { ...items[idx], category: val }
                                    return { ...s, settings: { ...s.settings, items } }
                                  }
                                  return s
                                })
                              }))
                            }}
                          >
                            <option value="ring">Rings</option>
                            <option value="necklace">Necklaces</option>
                            <option value="earring">Earrings</option>
                            <option value="bracelet">Bracelets</option>
                            <option value="all">All Products</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-stone-400 font-semibold mb-0.5">Image URL</label>
                          <div className="flex gap-2">
                            <label className="flex items-center gap-1 border border-stone-250 bg-white hover:bg-stone-50 text-stone-600 text-[10px] font-bold py-1 px-2 rounded-lg cursor-pointer shrink-0 shadow-xxs">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => handleSectionImageUpload(selectedSection.id, `items.${idx}.image`, e.target.files)}
                                disabled={uploadingImage === `${selectedSection.id}-items.${idx}.image`}
                              />
                              <Camera className="w-3.5 h-3.5" />
                              {uploadingImage === `${selectedSection.id}-items.${idx}.image` ? '...' : 'Upload'}
                            </label>
                            <input
                              type="text"
                              className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none"
                              value={cat.image || ''}
                              onChange={e => {
                                const val = e.target.value
                                setTheme((prev: any) => ({
                                  ...prev,
                                  sections: prev.sections.map((s: SectionBlock) => {
                                    if (s.id === selectedSectionId) {
                                      const items = Array.isArray(s.settings.items) ? [...s.settings.items] : []
                                      items[idx] = { ...items[idx], image: val }
                                      return { ...s, settings: { ...s.settings, items } }
                                    }
                                    return s
                                  })
                                }))
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => {
                            if (s.id === selectedSectionId) {
                              const items = [...(Array.isArray(s.settings.items) ? s.settings.items : []), { name: 'New Collection', image: '', category: 'all' }]
                              return { ...s, settings: { ...s.settings, items } }
                            }
                            return s
                          })
                        }))
                      }}
                      className="w-full bg-white hover:bg-stone-50 text-stone-900 border border-stone-200 font-bold uppercase py-2 text-xxs rounded-xl transition-colors"
                    >
                      + Add New Category Card
                    </button>
                  </div>
                </div>
              )}

              {/* Video Showcase Editor */}
              {selectedSection?.type === 'video' && (
                <div className="space-y-3.5 text-xxs font-semibold text-stone-700">
                  <div>
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Video MP4 URL</label>
                    <input
                      type="text"
                      className="w-full border border-stone-200 rounded-lg p-2 bg-stone-50 text-xxs focus:outline-none font-bold"
                      value={selectedSection.settings.videoUrl || ''}
                      placeholder="https://assets.mixkit.co/..."
                      onChange={e => {
                        const val = e.target.value
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => 
                            s.id === selectedSectionId ? { ...s, settings: { ...s.settings, videoUrl: val } } : s
                          )
                        }))
                      }}
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-stone-150">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="video-autoplay"
                        checked={selectedSection.settings.autoplay !== false}
                        onChange={e => {
                          const val = e.target.checked
                          setTheme((prev: any) => ({
                            ...prev,
                            sections: prev.sections.map((s: SectionBlock) => 
                              s.id === selectedSectionId ? { ...s, settings: { ...s.settings, autoplay: val } } : s
                            )
                          }))
                        }}
                      />
                      <label htmlFor="video-autoplay" className="font-bold text-stone-600 uppercase tracking-wider cursor-pointer">Autoplay Video</label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="video-loop"
                        checked={selectedSection.settings.loop !== false}
                        onChange={e => {
                          const val = e.target.checked
                          setTheme((prev: any) => ({
                            ...prev,
                            sections: prev.sections.map((s: SectionBlock) => 
                              s.id === selectedSectionId ? { ...s, settings: { ...s.settings, loop: val } } : s
                            )
                          }))
                        }}
                      />
                      <label htmlFor="video-loop" className="font-bold text-stone-600 uppercase tracking-wider cursor-pointer">Loop Continuously</label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="video-muted"
                        checked={selectedSection.settings.muted !== false}
                        onChange={e => {
                          const val = e.target.checked
                          setTheme((prev: any) => ({
                            ...prev,
                            sections: prev.sections.map((s: SectionBlock) => 
                              s.id === selectedSectionId ? { ...s, settings: { ...s.settings, muted: val } } : s
                            )
                          }))
                        }}
                      />
                      <label htmlFor="video-muted" className="font-bold text-stone-600 uppercase tracking-wider cursor-pointer">Muted (Required for Autoplay)</label>
                    </div>
                  </div>
                </div>
              )}

              {/* Testimonials Editor */}
              {selectedSection?.type === 'testimonials' && (
                <div className="space-y-3.5 text-xxs font-semibold text-stone-700">
                  <div>
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Section Title</label>
                    <input
                      type="text"
                      className="w-full border border-stone-200 rounded-lg p-2 bg-stone-50 text-xxs focus:outline-none font-bold"
                      value={selectedSection.settings.title || 'CUSTOMER TESTIMONIALS'}
                      onChange={e => {
                        const val = e.target.value
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => 
                            s.id === selectedSectionId ? { ...s, settings: { ...s.settings, title: val } } : s
                          )
                        }))
                      }}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Background Color</label>
                    <input
                      type="color"
                      className="w-full h-8 rounded-lg cursor-pointer border border-stone-200"
                      value={selectedSection.settings.bgColor || '#FFFFFF'}
                      onChange={e => {
                        const col = e.target.value
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => 
                            s.id === selectedSectionId ? { ...s, settings: { ...s.settings, bgColor: col } } : s
                          )
                        }))
                      }}
                    />
                  </div>

                  <div className="space-y-3.5 border-t border-stone-150 pt-3">
                    <label className="block font-bold text-stone-500 uppercase tracking-wider mb-1">Reviews List</label>
                    {(Array.isArray(selectedSection.settings.reviews) ? selectedSection.settings.reviews : []).map((rev: any, idx: number) => (
                      <div key={idx} className="border border-stone-200 rounded-xl p-3 bg-stone-50 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-stone-600 text-[10px] uppercase">Review {idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setTheme((prev: any) => ({
                                ...prev,
                                sections: prev.sections.map((s: SectionBlock) => {
                                  if (s.id === selectedSectionId) {
                                    const reviews = (Array.isArray(s.settings.reviews) ? s.settings.reviews : []).filter((_: any, i: number) => i !== idx)
                                    return { ...s, settings: { ...s.settings, reviews } }
                                  }
                                  return s
                                })
                              }))
                            }}
                            className="text-red-500 hover:text-red-700 font-bold uppercase text-[9px]"
                          >
                            Remove
                          </button>
                        </div>

                        <div>
                          <label className="block text-stone-400 font-semibold mb-0.5">Author Name</label>
                          <input
                            type="text"
                            className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none font-bold"
                            value={rev.author}
                            onChange={e => {
                              const val = e.target.value
                              setTheme((prev: any) => ({
                                ...prev,
                                sections: prev.sections.map((s: SectionBlock) => {
                                  if (s.id === selectedSectionId) {
                                    const reviews = Array.isArray(s.settings.reviews) ? [...s.settings.reviews] : []
                                    reviews[idx] = { ...reviews[idx], author: val }
                                    return { ...s, settings: { ...s.settings, reviews } }
                                  }
                                  return s
                                })
                              }))
                            }}
                          />
                        </div>

                        <div>
                          <label className="block text-stone-400 font-semibold mb-0.5">Rating (1-5 Stars)</label>
                          <select
                            className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none"
                            value={rev.rating || 5}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 5
                              setTheme((prev: any) => ({
                                ...prev,
                                sections: prev.sections.map((s: SectionBlock) => {
                                  if (s.id === selectedSectionId) {
                                    const reviews = Array.isArray(s.settings.reviews) ? [...s.settings.reviews] : []
                                    reviews[idx] = { ...reviews[idx], rating: val }
                                    return { ...s, settings: { ...s.settings, reviews } }
                                  }
                                  return s
                                })
                              }))
                            }}
                          >
                            <option value={5}>5 Stars</option>
                            <option value={4}>4 Stars</option>
                            <option value={3}>3 Stars</option>
                            <option value={2}>2 Stars</option>
                            <option value={1}>1 Star</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-stone-400 font-semibold mb-0.5">Review Content</label>
                          <textarea
                            rows={3}
                            className="w-full border border-stone-200 rounded-lg p-1.5 bg-white text-xxs focus:outline-none"
                            value={rev.text}
                            onChange={e => {
                              const val = e.target.value
                              setTheme((prev: any) => ({
                                ...prev,
                                sections: prev.sections.map((s: SectionBlock) => {
                                  if (s.id === selectedSectionId) {
                                    const reviews = Array.isArray(s.settings.reviews) ? [...s.settings.reviews] : []
                                    reviews[idx] = { ...reviews[idx], text: val }
                                    return { ...s, settings: { ...s.settings, reviews } }
                                  }
                                  return s
                                })
                              }))
                            }}
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setTheme((prev: any) => ({
                          ...prev,
                          sections: prev.sections.map((s: SectionBlock) => {
                            if (s.id === selectedSectionId) {
                              const reviews = [...(Array.isArray(s.settings.reviews) ? s.settings.reviews : []), { author: 'New Reviewer', rating: 5, text: 'Amazing service and product quality!' }]
                              return { ...s, settings: { ...s.settings, reviews } }
                            }
                            return s
                          })
                        }))
                      }}
                      className="w-full bg-white hover:bg-stone-50 text-stone-900 border border-stone-200 font-bold uppercase py-2 text-xxs rounded-xl transition-colors"
                    >
                      + Add New Review
                    </button>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 space-y-2">
              <MousePointer className="w-8 h-8 opacity-40 text-stone-500" />
              <div className="text-xxs font-bold uppercase tracking-wider">No Selection Selected</div>
              <p className="text-[10px] leading-relaxed max-w-[200px]">
                Click on any section block in the layout list or live preview canvas to customize its settings here.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
