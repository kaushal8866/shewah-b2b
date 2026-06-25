'use client'

import { useEffect, useState } from 'react'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import {
  Palette,
  Save,
  Upload,
  RefreshCw,
  Camera,
  Smartphone,
  Eye,
  Type,
  Layout,
  MousePointer,
  CheckCircle
} from 'lucide-react'

const DEFAULT_THEME = {
  store_name: 'My Jewelry Store',
  logo_url: '',
  favicon_url: '',
  colors: {
    primary: '#1E3A5F',
    secondary: '#C9A86A',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#1C1917',
    borders: '#E7E5E4',
    accent: '#F59E0B'
  },
  typography: {
    heading: 'Inter',
    body: 'Inter',
    scale: 'medium'
  },
  buttons: {
    shape: 'rounded-xl',
    style: 'fill',
    hover: 'darken',
    shadow: 'sm'
  },
  layout: {
    density: 'comfortable',
    spacing: 'medium'
  }
}

const COLOR_PRESETS = [
  {
    name: 'Royal Sapphire & Gold',
    primary: '#1E3A5F',
    secondary: '#C9A86A',
    background: '#FFFFFF',
    surface: '#F8F9FA',
    text: '#1A1A1A',
    borders: '#E9ECEF',
    accent: '#D4AF37'
  },
  {
    name: 'Emerald Luxury',
    primary: '#0F2C24',
    secondary: '#D4AF37',
    background: '#FFFFFF',
    surface: '#F4F7F6',
    text: '#1C2E2A',
    borders: '#E2EBE9',
    accent: '#C5A880'
  },
  {
    name: 'Midnight Onyx (Dark)',
    primary: '#1A1A1A',
    secondary: '#E5E5E5',
    background: '#121212',
    surface: '#1E1E1E',
    text: '#F5F5F5',
    borders: '#2A2A2A',
    accent: '#F59E0B'
  },
  {
    name: 'Rose Gold Romance',
    primary: '#8C6262',
    secondary: '#E5A9A9',
    background: '#FFF5F5',
    surface: '#FFF0F0',
    text: '#3D2F2F',
    borders: '#F5D3D3',
    accent: '#B87333'
  }
]

export default function ResellerThemeEditor() {
  const [theme, setTheme] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/portal/reseller/theme')
      .then(r => r.json())
      .then(data => {
        if (data.theme) {
          setTheme(data.theme)
        } else {
          setTheme(DEFAULT_THEME)
        }
      })
      .catch(() => setTheme(DEFAULT_THEME))
      .finally(() => setLoading(false))
  }, [])

  async function handleLogoUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadingLogo(true)
    try {
      const url = await uploadToCloudinary(files[0])
      setTheme((prev: any) => ({ ...prev, logo_url: url }))
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
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

  function applyPreset(preset: typeof COLOR_PRESETS[0]) {
    setTheme((prev: any) => ({
      ...prev,
      colors: {
        primary: preset.primary,
        secondary: preset.secondary,
        background: preset.background,
        surface: preset.surface,
        text: preset.text,
        borders: preset.borders,
        accent: preset.accent
      }
    }))
  }

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading Brand Studio...</div>
  if (!theme) return <div className="p-4 lg:p-7 text-stone-450 text-sm">Branding configuration not available.</div>

  const lbl = 'block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1'
  const inp = 'w-full border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 bg-white font-semibold text-stone-850 shadow-sm'

  return (
    <div className="p-4 lg:p-7 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <Palette className="w-5.5 h-5.5 text-amber-600" />
          White-Label Brand Studio
        </h1>
        <p className="text-xs text-stone-500 mt-0.5">
          Design your custom customer-facing storefront. Choose colors, fonts, logo, and styles.
        </p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span>Branding theme saved successfully! Storefront links will reflect these changes immediately.</span>
        </div>
      )}

      {/* Editor Layout split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Editor Config Forms */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
          {/* Preset Palettes */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1">
              <Palette className="w-4 h-4 text-stone-400" /> Curated Theme Presets
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {COLOR_PRESETS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="border border-stone-200 hover:border-amber-500 p-2.5 rounded-xl text-left bg-stone-50 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="text-[11px] font-bold text-stone-800 truncate">{preset.name}</span>
                  <div className="flex gap-0.5 shrink-0">
                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: preset.primary }}></div>
                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: preset.secondary }}></div>
                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: preset.surface }}></div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Store Name & Logo */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm pb-1 border-b border-stone-100 flex items-center gap-1.5">
              Identity details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Storefront Display Name *</label>
                <input
                  type="text"
                  className={inp}
                  value={theme.store_name}
                  onChange={e => setTheme((p: any) => ({ ...p, store_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className={lbl}>Logo URL / Upload</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 border border-stone-250 bg-white hover:bg-stone-50 text-stone-600 text-xs font-bold py-2 px-3.5 rounded-xl cursor-pointer shrink-0">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleLogoUpload(e.target.files)}
                      disabled={uploadingLogo}
                    />
                    <Camera className="w-3.5 h-3.5 text-stone-500" /> Upload Logo
                  </label>
                  <input
                    type="text"
                    className={inp}
                    value={theme.logo_url || ''}
                    placeholder="Or enter direct image URL..."
                    onChange={e => setTheme((p: any) => ({ ...p, logo_url: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Custom Colors Wheels */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm pb-1 border-b border-stone-100 flex items-center gap-1.5">
              Custom color palette
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className={lbl}>Primary Brand</label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="color"
                    className="w-8 h-8 rounded-lg cursor-pointer border border-stone-200 shrink-0"
                    value={theme.colors.primary}
                    onChange={e => setTheme((p: any) => ({ ...p, colors: { ...p.colors, primary: e.target.value } }))}
                  />
                  <input
                    type="text"
                    className="w-full border border-stone-200 rounded-lg p-1 text-[10px] uppercase font-mono font-bold text-center"
                    value={theme.colors.primary}
                    onChange={e => setTheme((p: any) => ({ ...p, colors: { ...p.colors, primary: e.target.value } }))}
                  />
                </div>
              </div>

              <div>
                <label className={lbl}>Secondary / Trim</label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="color"
                    className="w-8 h-8 rounded-lg cursor-pointer border border-stone-200 shrink-0"
                    value={theme.colors.secondary}
                    onChange={e => setTheme((p: any) => ({ ...p, colors: { ...p.colors, secondary: e.target.value } }))}
                  />
                  <input
                    type="text"
                    className="w-full border border-stone-200 rounded-lg p-1 text-[10px] uppercase font-mono font-bold text-center"
                    value={theme.colors.secondary}
                    onChange={e => setTheme((p: any) => ({ ...p, colors: { ...p.colors, secondary: e.target.value } }))}
                  />
                </div>
              </div>

              <div>
                <label className={lbl}>Background</label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="color"
                    className="w-8 h-8 rounded-lg cursor-pointer border border-stone-200 shrink-0"
                    value={theme.colors.background}
                    onChange={e => setTheme((p: any) => ({ ...p, colors: { ...p.colors, background: e.target.value } }))}
                  />
                  <input
                    type="text"
                    className="w-full border border-stone-200 rounded-lg p-1 text-[10px] uppercase font-mono font-bold text-center"
                    value={theme.colors.background}
                    onChange={e => setTheme((p: any) => ({ ...p, colors: { ...p.colors, background: e.target.value } }))}
                  />
                </div>
              </div>

              <div>
                <label className={lbl}>Surface Cards</label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="color"
                    className="w-8 h-8 rounded-lg cursor-pointer border border-stone-200 shrink-0"
                    value={theme.colors.surface}
                    onChange={e => setTheme((p: any) => ({ ...p, colors: { ...p.colors, surface: e.target.value } }))}
                  />
                  <input
                    type="text"
                    className="w-full border border-stone-200 rounded-lg p-1 text-[10px] uppercase font-mono font-bold text-center"
                    value={theme.colors.surface}
                    onChange={e => setTheme((p: any) => ({ ...p, colors: { ...p.colors, surface: e.target.value } }))}
                  />
                </div>
              </div>

              <div>
                <label className={lbl}>Text Color</label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="color"
                    className="w-8 h-8 rounded-lg cursor-pointer border border-stone-200 shrink-0"
                    value={theme.colors.text}
                    onChange={e => setTheme((p: any) => ({ ...p, colors: { ...p.colors, text: e.target.value } }))}
                  />
                  <input
                    type="text"
                    className="w-full border border-stone-200 rounded-lg p-1 text-[10px] uppercase font-mono font-bold text-center"
                    value={theme.colors.text}
                    onChange={e => setTheme((p: any) => ({ ...p, colors: { ...p.colors, text: e.target.value } }))}
                  />
                </div>
              </div>

              <div>
                <label className={lbl}>Borders &amp; Lines</label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="color"
                    className="w-8 h-8 rounded-lg cursor-pointer border border-stone-200 shrink-0"
                    value={theme.colors.borders}
                    onChange={e => setTheme((p: any) => ({ ...p, colors: { ...p.colors, borders: e.target.value } }))}
                  />
                  <input
                    type="text"
                    className="w-full border border-stone-200 rounded-lg p-1 text-[10px] uppercase font-mono font-bold text-center"
                    value={theme.colors.borders}
                    onChange={e => setTheme((p: any) => ({ ...p, colors: { ...p.colors, borders: e.target.value } }))}
                  />
                </div>
              </div>

              <div>
                <label className={lbl}>Accent Highlight</label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="color"
                    className="w-8 h-8 rounded-lg cursor-pointer border border-stone-200 shrink-0"
                    value={theme.colors.accent}
                    onChange={e => setTheme((p: any) => ({ ...p, colors: { ...p.colors, accent: e.target.value } }))}
                  />
                  <input
                    type="text"
                    className="w-full border border-stone-200 rounded-lg p-1 text-[10px] uppercase font-mono font-bold text-center"
                    value={theme.colors.accent}
                    onChange={e => setTheme((p: any) => ({ ...p, colors: { ...p.colors, accent: e.target.value } }))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Typography & Design Details */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm pb-1 border-b border-stone-100 flex items-center gap-1.5">
              Typography &amp; Components Styling
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={lbl}>Heading Font</label>
                <select
                  className={inp}
                  value={theme.typography.heading}
                  onChange={e => setTheme((p: any) => ({ ...p, typography: { ...p.typography, heading: e.target.value } }))}
                >
                  <option value="Inter">Inter (Sans-serif)</option>
                  <option value="Playfair Display">Playfair Display (Serif)</option>
                  <option value="Outfit">Outfit (Geometric)</option>
                  <option value="Lora">Lora (Elegant Serif)</option>
                </select>
              </div>

              <div>
                <label className={lbl}>Button Shape</label>
                <select
                  className={inp}
                  value={theme.buttons.shape}
                  onChange={e => setTheme((p: any) => ({ ...p, buttons: { ...p.buttons, shape: e.target.value } }))}
                >
                  <option value="rounded-none">Square / Sharp</option>
                  <option value="rounded-md">Subtle Rounded</option>
                  <option value="rounded-xl">Comfortable Rounded</option>
                  <option value="rounded-full">Pill / Oval</option>
                </select>
              </div>

              <div>
                <label className={lbl}>Button Shadow</label>
                <select
                  className={inp}
                  value={theme.buttons.shadow}
                  onChange={e => setTheme((p: any) => ({ ...p, buttons: { ...p.buttons, shadow: e.target.value } }))}
                >
                  <option value="none">None</option>
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-8 rounded-xl shadow-sm text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving Theme...' : 'Apply Branding Palette'}
            </button>
          </div>
        </form>

        {/* Right Side: Smartphone Mock Preview */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="sticky top-6 flex flex-col items-center space-y-3 w-full">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-500 uppercase tracking-wider">
              <Smartphone className="w-4 h-4" /> Live Mobile Mockup Preview
            </div>

            {/* Smartphone Case container */}
            <div className="relative border-[8px] border-stone-800 w-[290px] h-[550px] rounded-[36px] overflow-hidden bg-stone-100 shadow-2xl flex flex-col shrink-0">
              {/* Camera Notch notch */}
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-28 h-4 bg-stone-800 rounded-full z-50"></div>

              {/* Simulated Screen inside phone */}
              <div
                className="flex-1 flex flex-col overflow-y-auto pt-8 pb-3 px-3.5 space-y-4"
                style={{
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  fontFamily: theme.typography.body
                }}
              >
                {/* Store Header in preview */}
                <div
                  className="flex items-center justify-between pb-2"
                  style={{ borderColor: theme.colors.borders, borderBottomWidth: '1px' }}
                >
                  <div className="flex items-center gap-1.5">
                    {theme.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={theme.logo_url} alt="" className="h-5 object-contain" />
                    ) : (
                      <Palette className="w-4 h-4" style={{ color: theme.colors.accent }} />
                    )}
                    <span
                      className="text-xs font-black tracking-tight"
                      style={{
                        color: theme.colors.primary,
                        fontFamily: theme.typography.heading
                      }}
                    >
                      {theme.store_name}
                    </span>
                  </div>
                  <Smartphone className="w-3.5 h-3.5 opacity-40" />
                </div>

                {/* Cover Banner Card */}
                <div
                  className="rounded-2xl p-4 text-center space-y-1.5"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.borders,
                    borderWidth: '1px'
                  }}
                >
                  <h4
                    className="text-xs font-black tracking-tight uppercase"
                    style={{
                      color: theme.colors.primary,
                      fontFamily: theme.typography.heading
                    }}
                  >
                    Exquisite Jewelry Collections
                  </h4>
                  <p className="text-[9px] opacity-75 font-medium leading-relaxed">
                    Personalized markup designs. Fast direct dropshipping with full package brand erasure.
                  </p>
                </div>

                {/* Showcase Jewelry Card */}
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.borders,
                    borderWidth: '1px'
                  }}
                >
                  {/* cover img */}
                  <div className="bg-stone-150 h-28 flex items-center justify-center relative">
                    <Palette className="w-8 h-8 opacity-25" />
                    <span className="absolute bottom-1.5 right-1.5 text-[9px] bg-stone-900/80 text-white px-1.5 py-0.5 rounded font-mono">18K Gold</span>
                  </div>
                  {/* card details */}
                  <div className="p-3 space-y-2">
                    <div>
                      <span className="text-[8px] font-bold opacity-60 font-mono">SKU-BRAC102</span>
                      <h5 className="text-[11px] font-bold line-clamp-1 mt-0.5">Diamond Halo Bracelet</h5>
                    </div>
                    {/* price & CTA */}
                    <div className="flex justify-between items-center pt-1.5 border-t" style={{ borderColor: theme.colors.borders }}>
                      <span className="text-xs font-black" style={{ color: theme.colors.primary }}>₹45,999</span>
                      <button
                        type="button"
                        className={`text-[9px] font-black px-2.5 py-1.5 transition-all text-white flex items-center gap-0.5 ${theme.buttons.shape} ${
                          theme.buttons.shadow === 'sm' ? 'shadow-sm' :
                          theme.buttons.shadow === 'md' ? 'shadow' :
                          theme.buttons.shadow === 'lg' ? 'shadow-md' : ''
                        }`}
                        style={{ backgroundColor: theme.colors.primary }}
                      >
                        Enquire
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-stone-400 max-w-[200px] text-center font-medium leading-relaxed">
              This preview updates instantly as you tweak color wheels and typography selections.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
