import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#faf9f9',
          low: '#f5f3f3',
          highest: '#e3e2e2',
          lowest: '#ffffff',
          dim: '#dbdad9',
        },
        primary: {
          DEFAULT: '#000000',
          container: '#1b1b1b',
        },
        'on-surface': '#1b1c1c',
        'outline-variant': '#cfc4c5',
        secondary: '#5f5e5e',
      },
      boxShadow: {
        'ambient': '0 20px 40px rgba(0,0,0, 0.04)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
