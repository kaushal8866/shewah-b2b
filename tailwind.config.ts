import type { Config } from 'tailwindcss'

// Architectural Authority palette — deep navy primary, layered neutral
// surfaces, low-saturation status tints. Stone scale is overridden so existing
// `text-stone-*` / `bg-stone-*` classes pick up the new tonal neutrals
// automatically across the app.
const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Override the stone scale to the new tonal neutrals so legacy classes
        // keep working under the rebrand.
        stone: {
          50:  '#F5F6F8',
          100: '#EEF0F4',
          200: '#E5E8EE',
          300: '#D5D9E2',
          400: '#7B8295',
          500: '#5C6478',
          600: '#454B5C',
          700: '#2F3445',
          800: '#1C2333',
          900: '#1A1F2E',
        },
        // Primary — deep authoritative navy
        primary: {
          DEFAULT:  '#1E3A5F',
          50:       '#F1F5FA',
          100:      '#E0E9F2',
          200:      '#B7C8DD',
          400:      '#446EA0',
          500:      '#2C5180',
          600:      '#1E3A5F',
          700:      '#162B47',
          800:      '#0F1F33',
          900:      '#091422',
          container:   '#E8EFF7',
          'on':        '#FFFFFF',
          'on-container': '#091422',
        },
        // Layered surfaces — page → section → card → accent
        surface: {
          base:    '#F5F6F8',  // page background
          low:     '#EEF0F4',  // section / sidebar background
          lowest:  '#FFFFFF',  // card on a section
          high:    '#1C2333',  // dark accent (top bar / floating bar)
          highest: '#0F1626',  // deepest dark surface
        },
        // Tertiary warmth — small accent for "premium" moments only
        tertiary: {
          container: '#FCF1E6',
          on:        '#7A4A1A',
        },
        // Outline — almost invisible 1px lines (used sparingly)
        outline: {
          DEFAULT: '#D5D9E2',
          variant: '#E5E8EE',
        },
        // Status — low saturation tonal variants
        status: {
          'success-bg':  '#E6F3EC',
          'success-fg':  '#1F5A38',
          'warning-bg':  '#FBF1DC',
          'warning-fg':  '#7A5210',
          'danger-bg':   '#F7E3E3',
          'danger-fg':   '#7A1F1F',
          'info-bg':     '#E5EDF5',
          'info-fg':     '#1F3F6A',
          'neutral-bg':  '#EEF0F4',
          'neutral-fg':  '#454B5C',
        },
        'on-surface': '#1b1c1c',
        'outline-variant': '#cfc4c5',
        secondary: '#5f5e5e',
      },
      boxShadow: {
        'ambient': '0 20px 40px rgba(0,0,0, 0.04)',
      },
      fontFamily: {
        sans:    ['Inter',   'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Numeric / metric font — Manrope tabular
        metric:  ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '22px',
      },
      boxShadow: {
        // Tinted ambient elevation (no harsh drops)
        ambient: '0 12px 32px -12px rgba(15, 22, 38, 0.18)',
        modal:   '0 24px 60px -16px rgba(15, 22, 38, 0.32)',
      },
      backgroundImage: {
        // Primary gradient — used on hero buttons and active accents
        'primary-gradient': 'linear-gradient(135deg, #2C5180 0%, #1E3A5F 100%)',
        'glass':             'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.55) 100%)',
        'glass-dark':        'linear-gradient(180deg, rgba(28,35,51,0.72) 0%, rgba(15,22,38,0.55) 100%)',
      },
    },
  },
  plugins: [],
}

export default config
