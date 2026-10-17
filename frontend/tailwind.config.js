/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0b1010',
        'surface-lowest': '#0b1010',
        'surface-low': '#111919',
        'surface-high': '#131b1b',
        'surface-highest': '#172221',
        primary: '#c8f36a',
        'primary-container': '#dbff8f',
        secondary: '#91a29d',
        tertiary: '#d9ae66',
        error: '#f2a59d',
        'outline-variant': '#4b5b57',
        'on-surface': '#edf1ed',
        'on-surface-variant': '#91a29d',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px 0 rgba(200, 243, 106, 0.1)',
        'glow-primary': '0 0 40px 0 rgba(200, 243, 106, 0.3)',
        'glow-error': '0 0 20px 0 rgba(242, 165, 157, 0.3)',
        'glow-secondary': '0 0 20px 0 rgba(145, 162, 157, 0.3)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #c8f36a 0%, #9fca42 100%)',
        'gradient-ghost': 'linear-gradient(135deg, rgba(200,243,106,0.4) 0%, transparent 100%)',
      }
    },
  },
  plugins: [],
};
