import type { Config } from 'tailwindcss'

// ── Semantic ramps ──────────────────────────────────────────────────────
// The app carries 2,377 raw Tailwind palette classes (red-600, amber-500,
// emerald-700 …). Traffic-light brights would wreck a near-monochrome system,
// but rewriting 2,377 call sites by hand would be reckless. Instead the
// palettes themselves are redefined here: every existing class keeps working
// and simply resolves to a low-saturation equivalent.
//
// Only standard shades are defined on purpose. The codebase also contains
// non-standard ones (`border-red-150`, `text-indigo-650`, `bg-green-55`) that
// Tailwind never generated, so they emit no CSS today. Defining those shades
// would silently switch ~86 dead classes back on.

// Oxblood — errors, destructive actions, overdue.
const oxblood = {
  50: '#FAF6F5', 100: '#F2E9E7', 200: '#E5D2CF', 300: '#D2B0AB', 400: '#B87F77',
  500: '#A05A50', 600: '#8C3A32', 700: '#7A322B', 800: '#5E2721', 900: '#481E19',
  950: '#2E1310',
}

// Ochre — warnings, pending, awaiting action.
const ochre = {
  50: '#FAF7F0', 100: '#F2EAD8', 200: '#E6D6B4', 300: '#D4BC85', 400: '#BC9C50',
  500: '#A17E28', 600: '#8A6410', 700: '#75540E', 800: '#5A410B', 900: '#443108',
  950: '#2B1F05',
}

// Olive — success, paid, delivered. Sits beside the accent without competing.
const olive = {
  50: '#F5F8F2', 100: '#E9F0E3', 200: '#D3E0C8', 300: '#B2C7A0', 400: '#86A46E',
  500: '#628247', 600: '#4A6B32', 700: '#3E5A2A', 800: '#304621', 900: '#253519',
  950: '#16200F',
}

// The system's neutral ramp. Informational blues and decorative purples have no
// place in a monochrome system, so they resolve to ink.
const ink = {
  50: '#F5F5F5', 100: '#EEEEEE', 200: '#E6E6E6', 300: '#CCCCCC',
  // The reference measures #7D7D7D here, which is 4.12:1 on white — below AA.
  // The spec calls it a metadata-only token, but the app uses `text-stone-400`
  // in 1,249 places as ordinary body and label text. Rather than police 1,249
  // call sites, the token is darkened to the lightest grey that clears 4.5:1
  // (#767676 = 4.54:1). Deliberate deviation from the reference: legibility
  // wins over fidelity, and the difference is not perceptible at this value.
  400: '#767676',
  500: '#666666', 600: '#4A4A4A', 700: '#333333', 800: '#222222', 900: '#111111',
  950: '#0A0A0A',
}

// Shewah Design System — measured from a high-jewelry reference and applied
// app-wide (admin, all three portals, every client-facing page).
//
// Four rules the system is built on:
//   1. One weight. Emphasis is uppercase + letter-spacing, not bold.
//   2. Zero radius. No rounded corners, no shadows.
//   3. Structure is carried by 1px rules and empty space.
//   4. One accent. Everything else is neutral.
//
// Most of that is enforced here rather than by code review: the `stone` scale,
// the radius scale and the shadow scale are all remapped, so ~8,700 existing
// class usages across the app pick up the system without touching a screen.
const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // The system's neutral ramp, mapped onto `stone` so the ~6,673 existing
        // `text-stone-*` / `bg-stone-*` / `border-stone-*` usages retarget with
        // no screen edits. Greys are deliberately pure — no hue bias — which is
        // what lets a single accent read as the only color in the app.
        stone: ink,

        // Every other neutral family resolves to the same ink ramp, so
        // `gray-100` and `slate-700` stop drifting away from `stone-*`.
        gray: ink,
        slate: ink,
        zinc: ink,
        neutral: ink,

        // Semantic families, desaturated. Existing class names keep working.
        red: oxblood,
        rose: oxblood,
        amber: ochre,
        yellow: ochre,
        orange: ochre,
        green: olive,
        emerald: olive,
        lime: olive,
        teal: olive,

        // No informational blue, no decorative purple in this system.
        blue: ink,
        sky: ink,
        indigo: ink,
        cyan: ink,
        purple: ink,
        violet: ink,
        fuchsia: ink,
        pink: ink,
        // Primary is no longer a hue — it is the ink ramp. Keeps the 118
        // existing `bg-primary-600` / `text-primary-*` usages meaningful.
        primary: {
          DEFAULT:  '#222222',
          50:       '#F5F5F5',
          100:      '#EEEEEE',
          200:      '#E6E6E6',
          400:      '#7D7D7D',
          500:      '#666666',
          600:      '#222222',
          700:      '#111111',
          800:      '#0A0A0A',
          900:      '#000000',
          container:      '#F5F5F5',
          'on':           '#FFFFFF',
          'on-container': '#111111',
        },
        // The single chromatic value in the system.
        //
        // The reference house uses an olive (#788C40). Measured faithfully, it
        // reads botanical rather than jewelry once it is sitting on every
        // screen of a diamond business, so the accent is an antique gold
        // instead — restrained enough not to fight the monochrome, and the
        // consolidation point for the eight golds that used to be in the app.
        // Revert to '#788C40' here to go back to the reference olive.
        //
        // 3.27:1 on white: permitted on rules, hover states, iconography and
        // text at 18px or larger — never on body copy.
        accent: {
          DEFAULT: '#A88A4F',
          soft:    '#C9A86A',
          deep:    '#8A6E3A',
        },
        // Layered surfaces — ground change replaces elevation.
        surface: {
          base:    '#FFFFFF',
          low:     '#F5F5F5',
          lowest:  '#FFFFFF',
          high:    '#222222',
          highest: '#111111',
        },
        tertiary: {
          container: '#F5F5F5',
          on:        '#666666',
        },
        outline: {
          DEFAULT: '#E6E6E6',
          variant: '#CCCCCC',
        },
        // Semantic status — deliberately separate from the accent, and never
        // the only signal (wording carries the state too).
        status: {
          'success-bg':  '#F5F5F5',
          'success-fg':  '#4A6B32',
          'warning-bg':  '#F5F5F5',
          'warning-fg':  '#8A6410',
          'danger-bg':   '#F5F5F5',
          'danger-fg':   '#8C3A32',
          'info-bg':     '#F5F5F5',
          'info-fg':     '#4A4A4A',
          'neutral-bg':  '#F5F5F5',
          'neutral-fg':  '#666666',
        },
        'on-surface': '#222222',
        'outline-variant': '#E6E6E6',
        secondary: '#666666',
      },

      fontFamily: {
        // Neutral grotesque for everything functional.
        sans:    ['Inter', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        // Old-style serif, reserved for editorial headlines and product names.
        // Cormorant Garamond was already the chosen serif in lib/consumerTheme.
        serif:   ['Cormorant Garamond', 'Hoefler Text', 'Baskerville', 'Georgia', 'serif'],
        display: ['Cormorant Garamond', 'Hoefler Text', 'Baskerville', 'Georgia', 'serif'],
        // Previously undefined despite 131 `font-mono` usages, so it silently
        // fell back to the Tailwind default.
        mono:    ['ui-monospace', 'SF Mono', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        // Numeric / metric — the functional tier's tabular figures.
        metric:  ['Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },

      letterSpacing: {
        eyebrow: '1.9px',
        cta:     '1.5px',
        nav:     '1.43px',
        micro:   '1.2px',
      },

      // The system allows one weight; the functional tier allows 500 so dense
      // tables stay scannable. The app currently carries 2,671 weight classes
      // (font-bold 788, font-semibold 853, font-medium 1030), so rather than
      // rewriting every call site, the heavy weights are collapsed onto 500.
      // Nothing renders at 600–800 any more, and emphasis becomes the subtle
      // 400/500 step the system asks for. Per-surface sweeps can drop the
      // remaining 500s to 400 on editorial pages.
      fontWeight: {
        thin:       '400',
        extralight: '400',
        light:      '400',
        normal:     '400',
        medium:     '500',
        semibold:   '500',
        bold:       '500',
        extrabold:  '500',
        black:      '500',
      },

      // Zero radius, enforced structurally. Every rectangular corner in the app
      // flattens from here — no screen edits, no review burden.
      //
      // `full` is deliberately left circular: it is load-bearing geometry for
      // avatars, status dots and spinners, where squaring the shape would look
      // like a rendering bug rather than a design choice. The ~118 pill-shaped
      // badges that also use it are squared individually during the sweep.
      borderRadius: {
        none:   '0',
        sm:     '0',
        DEFAULT:'0',
        md:     '0',
        lg:     '0',
        xl:     '0',
        '2xl':  '0',
        '3xl':  '0',
        full:   '9999px',
      },

      // No shadows. The whole Tailwind scale is remapped, not just the two
      // custom keys — 231 `shadow-sm` and 329 bare `shadow` usages come from
      // the defaults. Elevation is expressed as a ground change plus a rule.
      boxShadow: {
        none:    'none',
        sm:      'none',
        DEFAULT: 'none',
        md:      'none',
        lg:      'none',
        xl:      'none',
        '2xl':   'none',
        inner:   'none',
        rule:    '0 1px 0 0 #E6E6E6',
        // Modals sit on the page with a hairline, not a drop shadow.
        ambient: 'none',
        modal:   '0 0 0 1px #E6E6E6',
      },

      // Gradients are not part of the system; these resolve flat so any
      // remaining `bg-primary-gradient` / `bg-glass` usage degrades cleanly.
      backgroundImage: {
        'primary-gradient': 'linear-gradient(#222222, #222222)',
        'glass':            'linear-gradient(#FFFFFF, #FFFFFF)',
        'glass-dark':       'linear-gradient(#222222, #222222)',
      },
    },
  },
  plugins: [],
}

export default config
