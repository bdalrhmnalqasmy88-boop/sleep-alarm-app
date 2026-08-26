/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'system-ui', 'sans-serif'],
      },
      colors: {
        night: {
          950: '#05060f',
          900: '#0a0c1b',
          800: '#11142b',
          700: '#1a1f3d',
          600: '#272e54',
          500: '#3a4377',
        },
        moon: {
          50: '#f3f6ff',
          100: '#e3e9ff',
          200: '#c8d3ff',
          300: '#a3b3ff',
          400: '#7c8eff',
          500: '#5a6bf0',
          600: '#4350d6',
          700: '#353fab',
          800: '#2b3088',
          900: '#262b6e',
        },
        accent: {
          400: '#5eead4',
          500: '#14b8a6',
          600: '#0d9488',
        },
        gold: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
        },
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(122, 134, 240, 0.45)',
        'glow-accent': '0 0 40px -8px rgba(94, 234, 212, 0.5)',
        'glow-gold': '0 0 50px -10px rgba(251, 191, 36, 0.5)',
      },
      keyframes: {
        twinkle: {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.95)', opacity: '0.7' },
          '70%': { transform: 'scale(1.3)', opacity: '0' },
          '100%': { transform: 'scale(1.3)', opacity: '0' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.05)', opacity: '1' },
        },
      },
      animation: {
        twinkle: 'twinkle 3s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'pulse-ring': 'pulseRing 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        breathe: 'breathe 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
