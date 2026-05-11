/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#0A0F1C',
        foreground: '#E8EDF4',
        primary: {
          DEFAULT: '#00C2A8',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#0A1628',
          foreground: '#94A3B8',
        },
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#1E293B',
          foreground: '#64748B',
        },
        accent: {
          DEFAULT: '#00C2A8',
          foreground: '#FFFFFF',
        },
        card: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          foreground: '#E8EDF4',
        },
        border: 'rgba(255,255,255,0.10)',
        input: 'rgba(255,255,255,0.07)',
        ring: '#00C2A8',
      },
    },
  },
  plugins: [],
}