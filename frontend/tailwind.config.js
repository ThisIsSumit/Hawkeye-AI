/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#121315',
        'surface-lowest': '#0d0e10',
        'surface-low': '#1b1c1e',
        'surface-high': '#292a2c',
        'surface-highest': '#343537',
        primary: '#a5c8ff',
        'primary-container': '#3792f7',
        secondary: '#00e5a0',
        tertiary: '#ffb955',
        error: '#ffb4ab',
        'outline-variant': '#404753',
        'on-surface': '#e3e2e5',
        'on-surface-variant': '#c0c7d5',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px 0 rgba(165, 200, 255, 0.1)',
        'glow-primary': '0 0 40px 0 rgba(165, 200, 255, 0.3)',
        'glow-error': '0 0 20px 0 rgba(255, 180, 171, 0.3)',
        'glow-secondary': '0 0 20px 0 rgba(0, 229, 160, 0.3)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #a5c8ff 0%, #3792f7 100%)',
        'gradient-ghost': 'linear-gradient(135deg, rgba(165,200,255,0.4) 0%, transparent 100%)',
      }
    },
  },
  plugins: [],
};
