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
        gold: {
          50:  '#FAF5EA',
          100: '#F2E8D5',
          200: '#E8D4A8',
          400: '#C49C64',
          600: '#9B7A40',
          800: '#6B5228',
          900: '#4A3818',
        },
        charcoal: {
          50:  '#F7F5F2',
          100: '#EDEAE4',
          400: '#7A7163',
          600: '#4A4540',
          800: '#2E2B26',
          900: '#1C1A17',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
